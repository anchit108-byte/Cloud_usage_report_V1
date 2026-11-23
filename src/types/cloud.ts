export type SemanticMetric =
  | 'cost'
  | 'cpu'
  | 'ram'
  | 'storage'
  | 'usage'
  | 'resource_id'
  | 'resource_type'
  | 'service'
  | 'region'
  | 'date'
  | 'uptime'
  | 'iops';

export type ColumnDataType = 'numeric' | 'currency' | 'percentage' | 'datetime' | 'identifier' | 'categorical' | 'empty';

export interface DetectedColumn {
  originalName: string;
  mappedMetric: SemanticMetric | null;
  confidence: number; // 0..1
  dataType: ColumnDataType;
  nonNullCount: number;
  missingCount: number;
  sampleValues: string[];
  unitHint?: string;
}

export interface AmbiguousColumn {
  originalName: string;
  candidateMetrics: SemanticMetric[];
  reason: string;
  dataType: ColumnDataType;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  rowCount: number;
  columnCount: number;
  headers: string[];
  fileHash: string;
}

export interface CleaningSummary {
  totalRawRows: number;
  cleanedRowCount: number;
  droppedEmptyRows: number;
  invalidValuesCoerced: Record<string, number>;
  missingValuesByColumn: Record<string, number>;
  duplicateRowsRemoved: number;
}

export interface NormalizedRecord {
  resourceId: string | null;
  resourceType: string | null;
  service: string | null;
  region: string | null;
  date: string | null; // ISO YYYY-MM-DD
  year: number | null;
  month: number | null; // 1..12
  cost: number | null;
  usage: number | null;
  cpu: number | null;
  ram: number | null;
  storage: number | null;
  uptime: number | null;
  iops: number | null;
}

export interface NumericStats {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  p95: number;
}

export interface UsageVsCostPoint {
  label: string;
  usage: number;
  cost: number;
  recordCount: number;
}

export interface YearlyMonthComparisonPoint {
  monthIndex: number; // 1..12
  monthLabel: string;
  currentYearCost: number | null;
  previousYearCost: number | null;
}

export interface BreakdownPoint {
  label: string;
  value: number;
  sharePct: number;
  count: number;
}

export interface TrendPoint {
  period: string;
  cost: number | null;
  cpuMean: number | null;
  ramMean: number | null;
  usageSum: number | null;
  count: number;
}

export interface AnalyticsResult {
  totalCost: NumericStats | null;
  cpuStats: NumericStats | null;
  ramStats: NumericStats | null;
  storageStats: NumericStats | null;
  usageStats: NumericStats | null;
  dateRange: { start: string; end: string; distinctDays: number } | null;
  usageVsCost: {
    available: boolean;
    reason?: string;
    groupByLabel: string;
    usageUnit: string;
    data: UsageVsCostPoint[];
  };
  yearOverYear: {
    available: boolean;
    reason?: string;
    currentYear: number | null;
    previousYear: number | null;
    usedHistoricalDb: boolean;
    data: YearlyMonthComparisonPoint[];
  };
  serviceBreakdown: BreakdownPoint[];
  regionBreakdown: BreakdownPoint[];
  resourceTypeBreakdown: BreakdownPoint[];
  usageTrends: TrendPoint[];
  utilizationDistribution: {
    available: boolean;
    reason?: string;
    buckets: Array<{ label: string; cpuCount: number; ramCount: number }>;
  };
}

export interface MlModelStatus {
  moduleName: string;
  algorithm: string;
  trainedModelAvailable: boolean;
  forecastingAvailable: boolean;
  message: string;
  historicalPeriodsAvailable: number;
  minimumPeriodsRequired: number;
  forecasts: Array<{ period: string; predictedCost: number }> | null;
  evaluationMetrics: { r2Score: number | null; mae: number | null; rmse: number | null } | null;
}

export type RecommendationClassification = 'CONTINUE' | 'OPTIMIZE' | 'DISCONTINUE';

export interface RecommendationItem {
  id: string;
  classification: RecommendationClassification;
  resourceId: string;
  service: string | null;
  region: string | null;
  reason: string;
  supportingMetrics: Record<string, string | number>;
  suggestedAction: string;
  estimatedMonthlySavings: number | null;
  savingsBasis: string;
}

export interface OptimizationReport {
  id: string;
  uploadId: string;
  filename: string;
  createdAt: string;
  title: string;
  validation: ValidationResult;
  cleaning: CleaningSummary;
  detectedColumns: DetectedColumn[];
  ambiguousColumns: AmbiguousColumn[];
  unmappedColumns: string[];
  analytics: AnalyticsResult;
  mlStatus: MlModelStatus;
  findings: string[];
  recommendations: RecommendationItem[];
  recommendationSummary: {
    continueCount: number;
    optimizeCount: number;
    discontinueCount: number;
    totalCalculableSavings: number | null;
  };
}

export interface UploadHistoryItem {
  id: string;
  reportId: string;
  filename: string;
  fileHash: string;
  uploadedAt: string;
  rowCount: number;
  cleanedRowCount: number;
  totalCost: number | null;
  recommendationCounts: {
    continueCount: number;
    optimizeCount: number;
    discontinueCount: number;
  };
}
