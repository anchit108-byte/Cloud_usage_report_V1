import assert from 'node:assert/strict';
import test from 'node:test';
import { runNumericalAnalytics } from './analytics';
import { detectColumns } from './columnDetector';
import { parseCsvText } from './csvParser';
import { validateCsvInput } from './csvValidator';
import { cleanAndNormalizeRows } from './dataCleaner';
import { CloudDatabase } from './database';
import { evaluateMlForecastAvailability } from './mlModel';
import { generateRecommendations } from './recommendationEngine';
import { generateOptimizationReport } from './reportGenerator';

test('CSV parser handles BOM, quoted commas, and CRLF', () => {
  const csv = '\uFEFF"Service, Name",Cost_USD,CPUUtilization\r\n"EC2, Compute",$120.50,8.2%\r\n';
  const parsed = parseCsvText(csv);
  assert.deepEqual(parsed.headers, ['Service, Name', 'Cost_USD', 'CPUUtilization']);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]['Service, Name'], 'EC2, Compute');
  assert.equal(parsed.rows[0]['Cost_USD'], '$120.50');
});

test('Validator rejects empty CSV and header-only CSV', () => {
  const empty = parseCsvText('');
  assert.equal(validateCsvInput('empty.csv', '', empty).valid, false);

  const headerOnly = parseCsvText('Cost,CPU\n');
  assert.equal(validateCsvInput('headers.csv', 'Cost,CPU\n', headerOnly).valid, false);
});

test('Column detector maps diverse AWS names and flags generic ambiguous headers', () => {
  const csv = [
    'lineItem/UnblendedCost,lineItem/UsageAmount,CPUUtilization,MemoryUtilization,product/ProductName,lineItem/AvailabilityZone,lineItem/UsageStartDate,lineItem/ResourceId,amount',
    '45.20,120,6.5,12.0,AmazonEC2,us-east-1a,2026-01-15,i-001,99',
    '48.10,125,7.0,11.5,AmazonEC2,us-east-1a,2026-01-16,i-001,105',
  ].join('\n');

  const parsed = parseCsvText(csv);
  const detection = detectColumns(parsed.headers, parsed.rows);

  assert.equal(detection.metricToHeader.cost, 'lineItem/UnblendedCost');
  assert.equal(detection.metricToHeader.usage, 'lineItem/UsageAmount');
  assert.equal(detection.metricToHeader.cpu, 'CPUUtilization');
  assert.equal(detection.metricToHeader.ram, 'MemoryUtilization');
  assert.equal(detection.metricToHeader.service, 'product/ProductName');
  assert.equal(detection.metricToHeader.region, 'lineItem/AvailabilityZone');
  assert.equal(detection.metricToHeader.date, 'lineItem/UsageStartDate');
  assert.equal(detection.metricToHeader.resource_id, 'lineItem/ResourceId');
  assert.ok(detection.ambiguousColumns.some((a) => a.originalName === 'amount'));
});

test('Data cleaner coerces invalid numeric values and removes duplicates', () => {
  const csv = [
    'ResourceId,Cost,CPU',
    'i-1,$100.00,45%',
    'i-1,$100.00,45%',
    'i-2,not-a-number,120',
  ].join('\n');

  const parsed = parseCsvText(csv);
  const detection = detectColumns(parsed.headers, parsed.rows);
  const cleaned = cleanAndNormalizeRows(parsed.rows, detection.metricToHeader);

  assert.equal(cleaned.summary.duplicateRowsRemoved, 1);
  assert.equal(cleaned.records.length, 2);
  assert.equal(cleaned.records[0].cost, 100);
  assert.equal(cleaned.records[0].cpu, 45);
  assert.equal(cleaned.records[1].cost, null);
  assert.equal(cleaned.records[1].cpu, null);
});

test('YoY comparison is unavailable with single year and available with two years', () => {
  const singleYearCsv = [
    'Date,Cost,Usage,Service',
    '2026-01-10,100,50,EC2',
    '2026-02-10,120,60,EC2',
  ].join('\n');
  const p1 = parseCsvText(singleYearCsv);
  const d1 = detectColumns(p1.headers, p1.rows);
  const c1 = cleanAndNormalizeRows(p1.rows, d1.metricToHeader);
  const a1 = runNumericalAnalytics(c1.records, c1.records, d1.detectedColumns);

  assert.equal(a1.usageVsCost.available, true);
  assert.equal(a1.yearOverYear.available, false);

  const twoYearCsv = [
    'Date,Cost,Usage,Service',
    '2025-01-10,80,40,EC2',
    '2026-01-10,100,50,EC2',
  ].join('\n');
  const p2 = parseCsvText(twoYearCsv);
  const d2 = detectColumns(p2.headers, p2.rows);
  const c2 = cleanAndNormalizeRows(p2.rows, d2.metricToHeader);
  const a2 = runNumericalAnalytics(c2.records, c2.records, d2.detectedColumns);

  assert.equal(a2.yearOverYear.available, true);
  assert.equal(a2.yearOverYear.currentYear, 2026);
  assert.equal(a2.yearOverYear.previousYear, 2025);
  assert.equal(a2.yearOverYear.data[0].currentYearCost, 100);
  assert.equal(a2.yearOverYear.data[0].previousYearCost, 80);

  const ml = evaluateMlForecastAvailability(a2);
  assert.equal(ml.forecastingAvailable, false);
  assert.equal(ml.forecasts, null);
});

test('Recommendation engine never recommends DISCONTINUE without sufficient evidence', () => {
  const csv = [
    'ResourceId,Cost,Service',
    'i-no-telemetry,250,EC2',
  ].join('\n');
  const p = parseCsvText(csv);
  const d = detectColumns(p.headers, p.rows);
  const c = cleanAndNormalizeRows(p.rows, d.metricToHeader);
  const recs = generateRecommendations(c.records);

  assert.equal(recs.length, 1);
  assert.equal(recs[0].classification, 'CONTINUE');

  const idleCsv = [
    'ResourceId,Cost,CPU,RAM,Service',
    'i-idle,200,3.2,8.0,EC2',
    'i-idle,200,4.1,9.5,EC2',
  ].join('\n');
  const pIdle = parseCsvText(idleCsv);
  const dIdle = detectColumns(pIdle.headers, pIdle.rows);
  const cIdle = cleanAndNormalizeRows(pIdle.rows, dIdle.metricToHeader);
  const recsIdle = generateRecommendations(cIdle.records);

  assert.equal(recsIdle[0].classification, 'DISCONTINUE');
  assert.equal(recsIdle[0].estimatedMonthlySavings, 340);
});

test('SQLite database starts completely empty and persists real uploads without duplication', () => {
  const db = new CloudDatabase(':memory:');
  assert.equal(db.listHistory().length, 0);
  assert.equal(db.getLatestReport(), null);

  const csv = [
    'Date,ResourceId,Service,Cost,CPU',
    '2026-03-01,i-abc,EC2,150,22',
  ].join('\n');
  const parsed = parseCsvText(csv);
  const validation = validateCsvInput('test.csv', csv, parsed);
  const detection = detectColumns(parsed.headers, parsed.rows);
  const cleaned = cleanAndNormalizeRows(parsed.rows, detection.metricToHeader);
  const analytics = runNumericalAnalytics(cleaned.records, cleaned.records, detection.detectedColumns);
  const mlStatus = evaluateMlForecastAvailability(analytics);
  const recommendations = generateRecommendations(cleaned.records);
  const report = generateOptimizationReport({
    uploadId: 'u-1',
    filename: 'test.csv',
    validation,
    cleaning: cleaned.summary,
    detection,
    analytics,
    mlStatus,
    recommendations,
  });

  db.saveAnalysis('u-1', report, cleaned.records);
  assert.equal(db.listHistory().length, 1);
  assert.ok(db.findUploadByHash(validation.fileHash));
  assert.equal(db.getLatestReport()?.id, report.id);
  db.close();
});
