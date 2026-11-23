import type {
  AmbiguousColumn,
  ColumnDataType,
  DetectedColumn,
  SemanticMetric,
} from '../types/cloud';

interface ColumnCandidate {
  metric: SemanticMetric;
  score: number;
  reason: string;
}

const NULL_TOKENS = new Set(['', 'null', 'none', 'na', 'n/a', 'nan', 'undefined', '-', '--']);

export function normalizeHeaderName(header: string): string {
  return header
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function parseNumericCandidate(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || NULL_TOKENS.has(trimmed.toLowerCase())) {
    return null;
  }
  // Handle currency ($1,234.56), percentages (42.5%), accounting negatives ($12.34)
  let s = trimmed.replace(/[$,€£₹%\s]/g, '');
  if (/^\(.+\)$/.test(s)) {
    s = '-' + s.slice(1, -1);
  }
  if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
    return null;
  }
  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

export function parseDateCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || NULL_TOKENS.has(trimmed.toLowerCase())) {
    return null;
  }
  // Reject pure numbers (e.g. "42" or "100.5") from being parsed as dates
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  // ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  // YYYY-MM (monthly billing export like "2025-04")
  const ymMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ymMatch) {
    const y = Number(ymMatch[1]);
    const m = Number(ymMatch[2]);
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, '0')}-01`;
    }
  }
  // DD/MM/YYYY or MM/DD/YYYY (prefer YYYY at end)
  const slashMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const y = Number(slashMatch[3]);
    if (y >= 2000 && y <= 2100) {
      let m = a;
      let d = b;
      if (a > 12 && b <= 12) {
        d = a;
        m = b;
      }
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }
  // Month-name dates (e.g. "Jan 15, 2026" or "15-Jan-2026")
  if (/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(trimmed) && /\d{4}/.test(trimmed)) {
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      const dt = new Date(parsed);
      const y = dt.getUTCFullYear();
      if (y >= 2000 && y <= 2100) {
        return dt.toISOString().slice(0, 10);
      }
    }
  }
  return null;
}

function inferColumnDataType(values: string[], headerNorm: string): {
  dataType: ColumnDataType;
  nonNullCount: number;
  missingCount: number;
  numericValues: number[];
} {
  let nonNullCount = 0;
  let missingCount = 0;
  let currencyCount = 0;
  let pctCount = 0;
  let dateCount = 0;
  const numericValues: number[] = [];

  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed || NULL_TOKENS.has(trimmed.toLowerCase())) {
      missingCount++;
      continue;
    }
    nonNullCount++;
    if (/[$€£₹]/.test(trimmed)) currencyCount++;
    if (/%/.test(trimmed)) pctCount++;
    if (parseDateCandidate(trimmed) !== null) dateCount++;
    const num = parseNumericCandidate(trimmed);
    if (num !== null) numericValues.push(num);
  }

  if (nonNullCount === 0) {
    return { dataType: 'empty', nonNullCount, missingCount, numericValues };
  }

  if (dateCount / nonNullCount >= 0.6) {
    return { dataType: 'datetime', nonNullCount, missingCount, numericValues };
  }
  if (numericValues.length / nonNullCount >= 0.5) {
    if (currencyCount / nonNullCount >= 0.25 || /(cost|price|spend|charge|bill|amount_usd|fee)/.test(headerNorm)) {
      return { dataType: 'currency', nonNullCount, missingCount, numericValues };
    }
    if (pctCount / nonNullCount >= 0.25 || /(pct|percent|ratio|utilization)/.test(headerNorm)) {
      return { dataType: 'percentage', nonNullCount, missingCount, numericValues };
    }
    return { dataType: 'numeric', nonNullCount, missingCount, numericValues };
  }

  const uniqueCount = new Set(values.filter((v) => v.trim() && !NULL_TOKENS.has(v.trim().toLowerCase()))).size;
  if (/(^|_)(id|arn|uuid|key)$/.test(headerNorm) || (uniqueCount / nonNullCount > 0.85 && nonNullCount > 3)) {
    return { dataType: 'identifier', nonNullCount, missingCount, numericValues };
  }

  return { dataType: 'categorical', nonNullCount, missingCount, numericValues };
}

interface RuleSpec {
  metric: SemanticMetric;
  exactNames: string[];
  patterns: Array<{ regex: RegExp; weight: number; reason: string }>;
  allowedTypes: ColumnDataType[];
  antiPatterns?: RegExp[];
}

const METRIC_RULES: RuleSpec[] = [
  {
    metric: 'cost',
    exactNames: [
      'cost',
      'total_cost',
      'unblended_cost',
      'line_item_unblended_cost',
      'blended_cost',
      'line_item_blended_cost',
      'billing_amount',
      'cost_usd',
      'monthly_cost',
      'net_unblended_cost',
      'total_costs',
      'spend',
    ],
    patterns: [
      { regex: /(unblended_cost|blended_cost|net_cost|total_cost|monthly_cost)/, weight: 0.96, reason: 'Matches billing cost field' },
      { regex: /(^|_)(cost|spend|charge|billing|fee|price)(_|$)/, weight: 0.86, reason: 'Matches cost/spend terminology' },
      { regex: /(usd|eur|inr|dollar)/, weight: 0.72, reason: 'Contains currency indicator' },
    ],
    allowedTypes: ['currency', 'numeric'],
    antiPatterns: [/(unit_price|rate_per|savings|discount_pct)/],
  },
  {
    metric: 'cpu',
    exactNames: ['cpu', 'cpu_utilization', 'cpu_usage', 'cpu_pct', 'cpu_percent', 'avg_cpu', 'vcpu_utilization'],
    patterns: [
      { regex: /cpu_?(util|usage|pct|percent|load|avg|max)/, weight: 0.95, reason: 'Matches CPU utilization metric' },
      { regex: /(^|_)cpu($|_)/, weight: 0.88, reason: 'References CPU metric' },
    ],
    allowedTypes: ['percentage', 'numeric'],
    antiPatterns: [/(vcpu_count|cpu_cores|cpu_count|cost)/],
  },
  {
    metric: 'ram',
    exactNames: ['ram', 'ram_utilization', 'ram_usage', 'memory_utilization', 'memory_usage', 'mem_pct', 'ram_pct'],
    patterns: [
      { regex: /(ram|memory|mem)_?(util|usage|pct|percent|avg|used)/, weight: 0.95, reason: 'Matches RAM/Memory utilization' },
      { regex: /(^|_)(ram|memory|mem)($|_)/, weight: 0.84, reason: 'References memory metric' },
    ],
    allowedTypes: ['percentage', 'numeric'],
    antiPatterns: [/(cost|price|capacity_gb|total_ram_gb)/],
  },
  {
    metric: 'storage',
    exactNames: ['storage', 'storage_gb', 'disk_gb', 'ebs_gb', 'volume_size', 'disk_space_utilization', 'storage_used'],
    patterns: [
      { regex: /(storage|disk|volume|ebs|s3)_?(gb|tb|mb|size|used|usage|util|space)/, weight: 0.93, reason: 'Matches storage consumption' },
      { regex: /(^|_)(storage|disk_space)($|_)/, weight: 0.85, reason: 'References storage metric' },
    ],
    allowedTypes: ['numeric', 'percentage'],
    antiPatterns: [/(cost|price|iops)/],
  },
  {
    metric: 'usage',
    exactNames: ['usage', 'usage_amount', 'line_item_usage_amount', 'usage_quantity', 'usage_hours', 'consumed_units'],
    patterns: [
      { regex: /(line_item_)?usage_?(amount|quantity|qty|hours|units)/, weight: 0.95, reason: 'Matches cloud usage quantity' },
      { regex: /(^|_)(usage|hours|runtime|consumed)($|_)/, weight: 0.8, reason: 'References usage quantity' },
    ],
    allowedTypes: ['numeric'],
    antiPatterns: [/(cpu|ram|memory|storage|cost|date|start|end|type)/],
  },
  {
    metric: 'resource_id',
    exactNames: ['resource_id', 'line_item_resource_id', 'instance_id', 'volume_id', 'resource_arn', 'id'],
    patterns: [
      { regex: /(resource|instance|vm|node|volume|cluster)_?(id|arn|name)/, weight: 0.94, reason: 'Matches resource identifier' },
    ],
    allowedTypes: ['identifier', 'categorical'],
  },
  {
    metric: 'resource_type',
    exactNames: ['resource_type', 'instance_type', 'product_instance_type', 'line_item_usage_type', 'usage_type', 'vm_size'],
    patterns: [
      { regex: /(instance|resource|machine|node|usage)_?type|sku|tier|flavor/, weight: 0.92, reason: 'Matches resource/instance type' },
    ],
    allowedTypes: ['categorical', 'identifier'],
  },
  {
    metric: 'service',
    exactNames: ['service', 'service_name', 'product_name', 'product_product_name', 'line_item_product_code', 'aws_service'],
    patterns: [
      { regex: /(product_name|product_code|service_name|cloud_service|aws_service)/, weight: 0.95, reason: 'Matches cloud service field' },
      { regex: /(^|_)(service|product)($|_)/, weight: 0.86, reason: 'References service/product' },
    ],
    allowedTypes: ['categorical'],
  },
  {
    metric: 'region',
    exactNames: ['region', 'aws_region', 'availability_zone', 'line_item_availability_zone', 'product_region', 'location', 'zone'],
    patterns: [
      { regex: /(aws_region|product_region|availability_zone|datacenter|region_name)/, weight: 0.95, reason: 'Matches cloud region/zone' },
      { regex: /(^|_)(region|zone|location)($|_)/, weight: 0.85, reason: 'References region/location' },
    ],
    allowedTypes: ['categorical'],
  },
  {
    metric: 'date',
    exactNames: ['date', 'timestamp', 'usage_start_date', 'line_item_usage_start_date', 'billing_date', 'billing_period', 'month'],
    patterns: [
      { regex: /(usage_start_date|billing_date|billing_period|record_date|created_at)/, weight: 0.96, reason: 'Matches billing/usage date' },
      { regex: /(^|_)(date|timestamp|time|day|period)($|_)/, weight: 0.86, reason: 'References temporal field' },
    ],
    allowedTypes: ['datetime'],
  },
  {
    metric: 'uptime',
    exactNames: ['uptime', 'uptime_pct', 'uptime_percent', 'availability_pct'],
    patterns: [
      { regex: /uptime|active_hours_pct/, weight: 0.9, reason: 'Matches uptime metric' },
    ],
    allowedTypes: ['percentage', 'numeric'],
  },
  {
    metric: 'iops',
    exactNames: ['iops', 'disk_iops', 'volume_iops', 'read_write_iops'],
    patterns: [
      { regex: /iops/, weight: 0.94, reason: 'Matches storage IOPS telemetry' },
    ],
    allowedTypes: ['numeric'],
  },
];

export interface ColumnDetectionOutput {
  detectedColumns: DetectedColumn[];
  ambiguousColumns: AmbiguousColumn[];
  unmappedColumns: string[];
  metricToHeader: Partial<Record<SemanticMetric, string>>;
}

export function detectColumns(
  headers: string[],
  rows: Record<string, string>[]
): ColumnDetectionOutput {
  const sampleRows = rows.slice(0, 500);
  const detectedColumns: DetectedColumn[] = [];
  const ambiguousColumns: AmbiguousColumn[] = [];
  const unmappedColumns: string[] = [];

  const columnCandidates = new Map<string, ColumnCandidate[]>();

  for (const header of headers) {
    const norm = normalizeHeaderName(header);
    const values = sampleRows.map((r) => r[header] ?? '');
    const { dataType, nonNullCount, missingCount, numericValues } = inferColumnDataType(values, norm);
    const sampleValues = values
      .filter((v) => v.trim() && !NULL_TOKENS.has(v.trim().toLowerCase()))
      .slice(0, 3);

    const candidates: ColumnCandidate[] = [];

    for (const rule of METRIC_RULES) {
      if (!rule.allowedTypes.includes(dataType)) {
        continue;
      }
      if (rule.antiPatterns?.some((re) => re.test(norm))) {
        continue;
      }

      let score = 0;
      let reason = '';

      if (rule.exactNames.includes(norm)) {
        score = 0.98;
        reason = `Exact semantic match for ${rule.metric}`;
      } else {
        for (const p of rule.patterns) {
          if (p.regex.test(norm)) {
            if (p.weight > score) {
              score = p.weight;
              reason = p.reason;
            }
          }
        }
      }

      if (score > 0) {
        // Value-range sanity checks to avoid mis-mapping unrelated columns
        if ((rule.metric === 'cpu' || rule.metric === 'ram' || rule.metric === 'uptime') && numericValues.length > 0 && dataType !== 'percentage') {
          const inRangeCount = numericValues.filter((v) => v >= 0 && v <= 100.5).length;
          const inRangeRatio = inRangeCount / numericValues.length;
          if (inRangeRatio < 0.5) {
            if (rule.metric === 'cpu' && !/(pct|percent|util)/.test(norm)) {
              score *= 0.55;
              reason += ' (majority of values exceed 100, unit uncertain)';
            } else if (rule.metric === 'ram' && !/(mb|gb|bytes)/.test(norm)) {
              score *= 0.65;
              reason += ' (majority of values exceed 100%, unit may be MB/GB)';
            }
          }
        }
        if (rule.metric === 'cost' && numericValues.length > 0) {
          const hasCurrencySymbol = values.some((v) => /[$€£₹]/.test(v));
          if (hasCurrencySymbol) score = Math.min(1, score + 0.04);
        }
        candidates.push({ metric: rule.metric, score, reason });
      }
    }

    // Special ambiguity check: generic column names like "value", "metric", "amount", "total"
    if (
      candidates.length === 0 &&
      (dataType === 'numeric' || dataType === 'currency') &&
      /^(value|val|metric|amount|total|score|num|data|col)[_\d]*$/.test(norm)
    ) {
      ambiguousColumns.push({
        originalName: header,
        candidateMetrics: dataType === 'currency' ? ['cost'] : ['cost', 'usage', 'cpu', 'storage'],
        reason: `Generic column header "${header}" cannot be confidently mapped to a specific cloud metric without assuming intent.`,
        dataType,
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    columnCandidates.set(header, candidates);

    const top = candidates[0];
    const second = candidates[1];

    // Check if top two candidates are too close to call confidently
    if (top && second && Math.abs(top.score - second.score) < 0.1 && top.score < 0.92) {
      ambiguousColumns.push({
        originalName: header,
        candidateMetrics: [top.metric, second.metric],
        reason: `Header "${header}" closely matches both "${top.metric}" and "${second.metric}".`,
        dataType,
      });
      detectedColumns.push({
        originalName: header,
        mappedMetric: null,
        confidence: Number(top.score.toFixed(2)),
        dataType,
        nonNullCount,
        missingCount,
        sampleValues,
      });
      continue;
    }

    detectedColumns.push({
      originalName: header,
      mappedMetric: top && top.score >= 0.72 ? top.metric : null,
      confidence: top ? Number(top.score.toFixed(2)) : 0,
      dataType,
      nonNullCount,
      missingCount,
      sampleValues,
      unitHint:
        dataType === 'currency'
          ? 'USD'
          : dataType === 'percentage'
            ? '%'
            : /(gb|gigabyte)/i.test(header)
              ? 'GB'
              : /(mb|megabyte)/i.test(header)
                ? 'MB'
                : undefined,
    });
  }

  // Resolve duplicate metric assignments (e.g., two columns both matched 'cost')
  const metricToHeader: Partial<Record<SemanticMetric, string>> = {};
  const metricGroups = new Map<SemanticMetric, DetectedColumn[]>();

  for (const col of detectedColumns) {
    if (col.mappedMetric) {
      const list = metricGroups.get(col.mappedMetric) ?? [];
      list.push(col);
      metricGroups.set(col.mappedMetric, list);
    }
  }

  for (const [metric, cols] of metricGroups.entries()) {
    cols.sort((a, b) => b.confidence - a.confidence);
    metricToHeader[metric] = cols[0].originalName;
    if (cols.length > 1) {
      for (let i = 1; i < cols.length; i++) {
        const secondary = cols[i];
        if (Math.abs(cols[0].confidence - secondary.confidence) < 0.08) {
          ambiguousColumns.push({
            originalName: secondary.originalName,
            candidateMetrics: [metric],
            reason: `Multiple columns match "${metric}" (${cols[0].originalName} vs ${secondary.originalName}); kept "${cols[0].originalName}" and left "${secondary.originalName}" unmapped to avoid double counting.`,
            dataType: secondary.dataType,
          });
        }
        secondary.mappedMetric = null;
      }
    }
  }

  for (const col of detectedColumns) {
    if (!col.mappedMetric && !ambiguousColumns.some((a) => a.originalName === col.originalName)) {
      unmappedColumns.push(col.originalName);
    }
  }

  return {
    detectedColumns,
    ambiguousColumns,
    unmappedColumns,
    metricToHeader,
  };
}
