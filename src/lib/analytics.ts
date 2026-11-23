import type {
  AnalyticsResult,
  BreakdownPoint,
  DetectedColumn,
  NormalizedRecord,
  NumericStats,
  TrendPoint,
  UsageVsCostPoint,
  YearlyMonthComparisonPoint,
} from '../types/cloud';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function computeNumericStats(values: number[]): NumericStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);
  const p95Index = Math.min(count - 1, Math.floor(0.95 * (count - 1)));

  return {
    count,
    sum: round2(sum),
    mean: round2(mean),
    median: round2(median),
    min: round2(sorted[0]),
    max: round2(sorted[count - 1]),
    stdDev: round2(stdDev),
    p95: round2(sorted[p95Index]),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function runNumericalAnalytics(
  currentRecords: NormalizedRecord[],
  historicalRecords: NormalizedRecord[],
  detectedColumns: DetectedColumn[]
): AnalyticsResult {
  const costs = currentRecords.map((r) => r.cost).filter((v): v is number => v !== null);
  const cpus = currentRecords.map((r) => r.cpu).filter((v): v is number => v !== null);
  const rams = currentRecords.map((r) => r.ram).filter((v): v is number => v !== null);
  const storages = currentRecords.map((r) => r.storage).filter((v): v is number => v !== null);
  const usages = currentRecords.map((r) => r.usage).filter((v): v is number => v !== null);

  const dates = currentRecords
    .map((r) => r.date)
    .filter((d): d is string => d !== null)
    .sort();
  const dateRange =
    dates.length > 0
      ? {
          start: dates[0],
          end: dates[dates.length - 1],
          distinctDays: new Set(dates).size,
        }
      : null;

  // Graph 1: Usage vs Cost (Grouped Bar Chart)
  const usageVsCost = buildUsageVsCost(currentRecords, detectedColumns);

  // Graph 2: Current Year vs Previous Year (Month-wise Grouped Bar Chart)
  const combinedForYoY = historicalRecords.length > 0 ? historicalRecords : currentRecords;
  const yearOverYear = buildYearOverYear(
    combinedForYoY,
    historicalRecords.length > currentRecords.length
  );

  // Service-wise & Region-wise Breakdowns
  const serviceBreakdown = buildBreakdown(currentRecords, (r) => r.service);
  const regionBreakdown = buildBreakdown(currentRecords, (r) => r.region);
  const resourceTypeBreakdown = buildBreakdown(currentRecords, (r) => r.resourceType);

  // Usage & Cost Trends by Month/Date
  const usageTrends = buildTrends(currentRecords);

  // CPU & RAM Distribution Buckets (0-10%, 10-30%, 30-60%, 60-85%, 85-100%)
  const utilizationDistribution = buildUtilizationDistribution(cpus, rams);

  return {
    totalCost: computeNumericStats(costs),
    cpuStats: computeNumericStats(cpus),
    ramStats: computeNumericStats(rams),
    storageStats: computeNumericStats(storages),
    usageStats: computeNumericStats(usages),
    dateRange,
    usageVsCost,
    yearOverYear,
    serviceBreakdown,
    regionBreakdown,
    resourceTypeBreakdown,
    usageTrends,
    utilizationDistribution,
  };
}

function buildUsageVsCost(
  records: NormalizedRecord[],
  detectedColumns: DetectedColumn[]
): AnalyticsResult['usageVsCost'] {
  const hasCost = records.some((r) => r.cost !== null);
  const hasUsage = records.some((r) => r.usage !== null);
  const hasCpu = records.some((r) => r.cpu !== null);

  if (!hasCost) {
    return {
      available: false,
      reason: 'Cost column was not detected in this CSV; Usage vs Cost comparison cannot be plotted.',
      groupByLabel: 'Service',
      usageUnit: 'Units',
      data: [],
    };
  }

  if (!hasUsage && !hasCpu) {
    return {
      available: false,
      reason: 'Neither Usage Quantity nor CPU Utilization metric was detected to compare against Cost.',
      groupByLabel: 'Service',
      usageUnit: 'Units',
      data: [],
    };
  }

  const useCpuAsUsage = !hasUsage && hasCpu;
  const usageCol = detectedColumns.find((c) => c.mappedMetric === (useCpuAsUsage ? 'cpu' : 'usage'));
  const usageUnit = useCpuAsUsage ? 'Avg CPU (%)' : usageCol?.unitHint || 'Usage Units';

  // Pick grouping key: service -> resourceType -> resourceId -> overall
  let groupByLabel = 'Service';
  let keyFn = (r: NormalizedRecord) => r.service;
  if (!records.some((r) => r.service)) {
    if (records.some((r) => r.resourceType)) {
      groupByLabel = 'Resource Type';
      keyFn = (r) => r.resourceType;
    } else if (records.some((r) => r.resourceId)) {
      groupByLabel = 'Resource ID';
      keyFn = (r) => r.resourceId;
    } else if (records.some((r) => r.region)) {
      groupByLabel = 'Region';
      keyFn = (r) => r.region;
    } else {
      groupByLabel = 'Record';
      keyFn = (_r, idx?: number) => `Row ${(idx ?? 0) + 1}`;
    }
  }

  const groups = new Map<string, { usageSum: number; usageCount: number; costSum: number; count: number }>();
  records.forEach((r, idx) => {
    const label = (groupByLabel === 'Record' ? `Row ${idx + 1}` : keyFn(r)) || 'Unspecified';
    const costVal = r.cost;
    const usageVal = useCpuAsUsage ? r.cpu : r.usage;
    if (costVal === null && usageVal === null) return;

    const entry = groups.get(label) ?? { usageSum: 0, usageCount: 0, costSum: 0, count: 0 };
    if (costVal !== null) entry.costSum += costVal;
    if (usageVal !== null) {
      entry.usageSum += usageVal;
      entry.usageCount += 1;
    }
    entry.count += 1;
    groups.set(label, entry);
  });

  const data: UsageVsCostPoint[] = Array.from(groups.entries())
    .map(([label, g]) => ({
      label,
      usage: round2(useCpuAsUsage && g.usageCount > 0 ? g.usageSum / g.usageCount : g.usageSum),
      cost: round2(g.costSum),
      recordCount: g.count,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  if (data.length === 0) {
    return {
      available: false,
      reason: 'No compatible paired Usage and Cost records exist.',
      groupByLabel,
      usageUnit,
      data: [],
    };
  }

  return {
    available: true,
    groupByLabel,
    usageUnit,
    data,
  };
}

function buildYearOverYear(
  records: NormalizedRecord[],
  usedHistoricalDb: boolean
): AnalyticsResult['yearOverYear'] {
  const datedCostRecords = records.filter(
    (r): r is NormalizedRecord & { year: number; month: number; cost: number } =>
      r.year !== null && r.month !== null && r.cost !== null
  );

  if (datedCostRecords.length === 0) {
    return {
      available: false,
      reason: 'Both Date and Cost columns are required to compute a year-over-year monthly comparison.',
      currentYear: null,
      previousYear: null,
      usedHistoricalDb: false,
      data: [],
    };
  }

  const yearsPresent = Array.from(new Set(datedCostRecords.map((r) => r.year))).sort((a, b) => b - a);
  if (yearsPresent.length < 2) {
    return {
      available: false,
      reason: `Only ${yearsPresent[0]} billing data is available (${datedCostRecords.length} dated records). Upload CSV data covering a second consecutive year to unlock Current Year vs Previous Year comparison without fabricating historical figures.`,
      currentYear: yearsPresent[0],
      previousYear: yearsPresent[0] - 1,
      usedHistoricalDb,
      data: [],
    };
  }

  // Prefer consecutive years (latest year & latest - 1) if available, otherwise top 2 years
  let currentYear = yearsPresent[0];
  let previousYear = yearsPresent.includes(currentYear - 1) ? currentYear - 1 : yearsPresent[1];

  const monthMap = new Map<number, { curr: number | null; prev: number | null }>();
  for (let m = 1; m <= 12; m++) {
    monthMap.set(m, { curr: null, prev: null });
  }

  for (const r of datedCostRecords) {
    const slot = monthMap.get(r.month)!;
    if (r.year === currentYear) {
      slot.curr = round2((slot.curr ?? 0) + r.cost);
    } else if (r.year === previousYear) {
      slot.prev = round2((slot.prev ?? 0) + r.cost);
    }
  }

  const data: YearlyMonthComparisonPoint[] = MONTH_NAMES.map((label, idx) => {
    const slot = monthMap.get(idx + 1)!;
    return {
      monthIndex: idx + 1,
      monthLabel: label,
      currentYearCost: slot.curr,
      previousYearCost: slot.prev,
    };
  });

  return {
    available: true,
    currentYear,
    previousYear,
    usedHistoricalDb,
    data,
  };
}

function buildBreakdown(
  records: NormalizedRecord[],
  getter: (r: NormalizedRecord) => string | null
): BreakdownPoint[] {
  const hasCost = records.some((r) => r.cost !== null);
  if (!hasCost) return [];

  const totals = new Map<string, { sum: number; count: number }>();
  let grandTotal = 0;

  for (const r of records) {
    const key = getter(r);
    if (!key || r.cost === null) continue;
    const entry = totals.get(key) ?? { sum: 0, count: 0 };
    entry.sum += r.cost;
    entry.count += 1;
    totals.set(key, entry);
    grandTotal += r.cost;
  }

  if (totals.size === 0 || grandTotal <= 0) return [];

  return Array.from(totals.entries())
    .map(([label, v]) => ({
      label,
      value: round2(v.sum),
      sharePct: round2((v.sum / grandTotal) * 100),
      count: v.count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function buildTrends(records: NormalizedRecord[]): TrendPoint[] {
  const dated = records.filter((r) => r.date !== null);
  if (dated.length === 0) return [];

  // Group by YYYY-MM if span > 45 days, else YYYY-MM-DD
  const sortedDates = dated.map((r) => r.date!).sort();
  const distinctDays = new Set(sortedDates).size;
  const byMonth = distinctDays > 31;

  const groups = new Map<
    string,
    { costSum: number; costCount: number; cpuSum: number; cpuCount: number; ramSum: number; ramCount: number; usageSum: number; usageCount: number; count: number }
  >();

  for (const r of dated) {
    const period = byMonth ? r.date!.slice(0, 7) : r.date!;
    const g = groups.get(period) ?? {
      costSum: 0,
      costCount: 0,
      cpuSum: 0,
      cpuCount: 0,
      ramSum: 0,
      ramCount: 0,
      usageSum: 0,
      usageCount: 0,
      count: 0,
    };
    if (r.cost !== null) {
      g.costSum += r.cost;
      g.costCount += 1;
    }
    if (r.cpu !== null) {
      g.cpuSum += r.cpu;
      g.cpuCount += 1;
    }
    if (r.ram !== null) {
      g.ramSum += r.ram;
      g.ramCount += 1;
    }
    if (r.usage !== null) {
      g.usageSum += r.usage;
      g.usageCount += 1;
    }
    g.count += 1;
    groups.set(period, g);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, g]) => ({
      period,
      cost: g.costCount > 0 ? round2(g.costSum) : null,
      cpuMean: g.cpuCount > 0 ? round2(g.cpuSum / g.cpuCount) : null,
      ramMean: g.ramCount > 0 ? round2(g.ramSum / g.ramCount) : null,
      usageSum: g.usageCount > 0 ? round2(g.usageSum) : null,
      count: g.count,
    }));
}

function buildUtilizationDistribution(
  cpus: number[],
  rams: number[]
): AnalyticsResult['utilizationDistribution'] {
  if (cpus.length === 0 && rams.length === 0) {
    return {
      available: false,
      reason: 'Neither CPU nor RAM utilization percentages were detected in the uploaded CSV.',
      buckets: [],
    };
  }

  const ranges = [
    { label: '0–10% (Idle)', min: 0, max: 10 },
    { label: '10–30% (Low)', min: 10, max: 30 },
    { label: '30–60% (Moderate)', min: 30, max: 60 },
    { label: '60–85% (Healthy)', min: 60, max: 85 },
    { label: '85–100% (Peak)', min: 85, max: 100.1 },
  ];

  const buckets = ranges.map((range) => ({
    label: range.label,
    cpuCount: cpus.filter((v) => v >= range.min && v < range.max).length,
    ramCount: rams.filter((v) => v >= range.min && v < range.max).length,
  }));

  return {
    available: true,
    buckets,
  };
}
