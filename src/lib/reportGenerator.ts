import { randomUUID } from 'node:crypto';
import type { ColumnDetectionOutput } from './columnDetector';
import type {
  AnalyticsResult,
  CleaningSummary,
  MlModelStatus,
  OptimizationReport,
  RecommendationItem,
  ValidationResult,
} from '../types/cloud';

export function buildImportantFindings(
  analytics: AnalyticsResult,
  recommendations: RecommendationItem[],
  detection: ColumnDetectionOutput
): string[] {
  const findings: string[] = [];

  if (analytics.totalCost) {
    findings.push(
      `Total observed cloud expenditure across ${analytics.totalCost.count} billing records is $${analytics.totalCost.sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (mean $${analytics.totalCost.mean.toFixed(2)}, median $${analytics.totalCost.median.toFixed(2)}).`
    );
  } else {
    findings.push('No cost column was confidently detected; financial totals and dollar savings cannot be computed from this upload.');
  }

  if (analytics.serviceBreakdown.length > 0) {
    const topService = analytics.serviceBreakdown[0];
    findings.push(
      `Highest spend service is "${topService.label}" accounting for $${topService.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${topService.sharePct}% of total observed cost).`
    );
  }

  if (analytics.regionBreakdown.length > 0) {
    const topRegion = analytics.regionBreakdown[0];
    findings.push(
      `Primary cost concentration by region is "${topRegion.label}" at $${topRegion.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${topRegion.sharePct}%).`
    );
  }

  if (analytics.cpuStats) {
    findings.push(
      `CPU utilization averages ${analytics.cpuStats.mean}% (median ${analytics.cpuStats.median}%, 95th percentile ${analytics.cpuStats.p95}%).`
    );
  }

  if (analytics.ramStats) {
    findings.push(
      `RAM utilization averages ${analytics.ramStats.mean}% (median ${analytics.ramStats.median}%, 95th percentile ${analytics.ramStats.p95}%).`
    );
  }

  if (analytics.storageStats) {
    findings.push(
      `Total provisioned storage across records is ${analytics.storageStats.sum.toLocaleString('en-US', { maximumFractionDigits: 2 })} GB (average ${analytics.storageStats.mean} GB per record).`
    );
  }

  const discCount = recommendations.filter((r) => r.classification === 'DISCONTINUE').length;
  const optCount = recommendations.filter((r) => r.classification === 'OPTIMIZE').length;
  if (discCount > 0 || optCount > 0) {
    findings.push(
      `Audit identified ${discCount} resource(s) eligible for discontinuation and ${optCount} resource(s) suitable for optimization.`
    );
  }

  if (detection.ambiguousColumns.length > 0) {
    findings.push(
      `${detection.ambiguousColumns.length} column(s) exhibited schema ambiguity and were intentionally left unmapped to preserve data accuracy.`
    );
  }

  return findings;
}

export function generateOptimizationReport(params: {
  uploadId: string;
  filename: string;
  validation: ValidationResult;
  cleaning: CleaningSummary;
  detection: ColumnDetectionOutput;
  analytics: AnalyticsResult;
  mlStatus: MlModelStatus;
  recommendations: RecommendationItem[];
}): OptimizationReport {
  const { uploadId, filename, validation, cleaning, detection, analytics, mlStatus, recommendations } = params;

  const continueCount = recommendations.filter((r) => r.classification === 'CONTINUE').length;
  const optimizeCount = recommendations.filter((r) => r.classification === 'OPTIMIZE').length;
  const discontinueCount = recommendations.filter((r) => r.classification === 'DISCONTINUE').length;

  const calculableSavingsList = recommendations
    .map((r) => r.estimatedMonthlySavings)
    .filter((v): v is number => v !== null);
  const totalCalculableSavings =
    calculableSavingsList.length > 0
      ? Math.round(calculableSavingsList.reduce((a, b) => a + b, 0) * 100) / 100
      : null;

  const findings = buildImportantFindings(analytics, recommendations, detection);

  return {
    id: randomUUID(),
    uploadId,
    filename,
    createdAt: new Date().toISOString(),
    title: `Cloud Audit — ${filename}`,
    validation,
    cleaning,
    detectedColumns: detection.detectedColumns,
    ambiguousColumns: detection.ambiguousColumns,
    unmappedColumns: detection.unmappedColumns,
    analytics,
    mlStatus,
    findings,
    recommendations,
    recommendationSummary: {
      continueCount,
      optimizeCount,
      discontinueCount,
      totalCalculableSavings,
    },
  };
}
