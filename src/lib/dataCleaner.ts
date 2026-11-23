import { parseDateCandidate, parseNumericCandidate } from './columnDetector';
import type { CleaningSummary, NormalizedRecord, SemanticMetric } from '../types/cloud';

const NULL_TOKENS = new Set(['', 'null', 'none', 'na', 'n/a', 'nan', 'undefined', '-', '--']);

export interface CleaningOutput {
  records: NormalizedRecord[];
  summary: CleaningSummary;
}

export function cleanAndNormalizeRows(
  rows: Record<string, string>[],
  metricToHeader: Partial<Record<SemanticMetric, string>>
): CleaningOutput {
  const invalidValuesCoerced: Record<string, number> = {};
  const missingValuesByColumn: Record<string, number> = {};
  const seenRowSignatures = new Set<string>();
  const records: NormalizedRecord[] = [];

  let droppedEmptyRows = 0;
  let duplicateRowsRemoved = 0;

  const trackMissing = (colName: string) => {
    missingValuesByColumn[colName] = (missingValuesByColumn[colName] ?? 0) + 1;
  };
  const trackInvalid = (colName: string) => {
    invalidValuesCoerced[colName] = (invalidValuesCoerced[colName] ?? 0) + 1;
  };

  const getString = (metric: SemanticMetric, row: Record<string, string>): string | null => {
    const h = metricToHeader[metric];
    if (!h) return null;
    const val = (row[h] ?? '').trim();
    if (!val || NULL_TOKENS.has(val.toLowerCase())) {
      trackMissing(h);
      return null;
    }
    return val;
  };

  const getNumeric = (
    metric: SemanticMetric,
    row: Record<string, string>,
    opts?: { min?: number; max?: number }
  ): number | null => {
    const h = metricToHeader[metric];
    if (!h) return null;
    const raw = (row[h] ?? '').trim();
    if (!raw || NULL_TOKENS.has(raw.toLowerCase())) {
      trackMissing(h);
      return null;
    }
    const num = parseNumericCandidate(raw);
    if (num === null) {
      trackInvalid(h);
      return null;
    }
    if (opts?.min !== undefined && num < opts.min) {
      trackInvalid(h);
      return null;
    }
    if (opts?.max !== undefined && num > opts.max) {
      trackInvalid(h);
      return null;
    }
    return num;
  };

  const getDate = (row: Record<string, string>): string | null => {
    const h = metricToHeader.date;
    if (!h) return null;
    const raw = (row[h] ?? '').trim();
    if (!raw || NULL_TOKENS.has(raw.toLowerCase())) {
      trackMissing(h);
      return null;
    }
    const iso = parseDateCandidate(raw);
    if (!iso) {
      trackInvalid(h);
      return null;
    }
    return iso;
  };

  for (const row of rows) {
    const hasMappedValues = Object.values(metricToHeader).some((h) => {
      if (!h) return false;
      const v = (row[h] ?? '').trim();
      return v.length > 0 && !NULL_TOKENS.has(v.toLowerCase());
    });

    if (!hasMappedValues && Object.values(row).every((v) => !v.trim())) {
      droppedEmptyRows++;
      continue;
    }

    const signature = JSON.stringify(row);
    if (seenRowSignatures.has(signature)) {
      duplicateRowsRemoved++;
      continue;
    }
    seenRowSignatures.add(signature);

    const isoDate = getDate(row);
    let year: number | null = null;
    let month: number | null = null;
    if (isoDate) {
      year = Number(isoDate.slice(0, 4));
      month = Number(isoDate.slice(5, 7));
    }

    records.push({
      resourceId: getString('resource_id', row),
      resourceType: getString('resource_type', row),
      service: getString('service', row),
      region: getString('region', row),
      date: isoDate,
      year,
      month,
      cost: getNumeric('cost', row, { min: 0 }),
      usage: getNumeric('usage', row, { min: 0 }),
      cpu: getNumeric('cpu', row, { min: 0, max: 100 }),
      ram: getNumeric('ram', row, { min: 0, max: 100 }),
      storage: getNumeric('storage', row, { min: 0 }),
      uptime: getNumeric('uptime', row, { min: 0, max: 100 }),
      iops: getNumeric('iops', row, { min: 0 }),
    });
  }

  return {
    records,
    summary: {
      totalRawRows: rows.length,
      cleanedRowCount: records.length,
      droppedEmptyRows,
      invalidValuesCoerced,
      missingValuesByColumn,
      duplicateRowsRemoved,
    },
  };
}
