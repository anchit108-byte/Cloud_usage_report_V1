import { useState } from 'react';
import { Info } from 'lucide-react';
import type {
  AnalyticsResult,
  BreakdownPoint,
  TrendPoint,
} from '../types/cloud';

function UnavailableNotice({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <p>{reason}</p>
      </div>
    </div>
  );
}

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(n % 1 === 0 ? 0 : 1);
}

/**
 * Graph 1: Usage vs Cost (Grouped Bar Chart with Dual Y-Axes)
 */
export function UsageVsCostChart({ data }: { data: AnalyticsResult['usageVsCost'] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data.available || data.data.length === 0) {
    return (
      <UnavailableNotice
        title="Usage vs Cost Comparison"
        reason={data.reason || 'Compatible usage and cost metrics are unavailable for this CSV.'}
      />
    );
  }

  const points = data.data;
  const maxUsage = Math.max(...points.map((p) => p.usage), 1);
  const maxCost = Math.max(...points.map((p) => p.cost), 1);

  const width = 680;
  const height = 310;
  const padL = 58;
  const padR = 58;
  const padT = 24;
  const padB = 72;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const groupW = plotW / points.length;
  const barW = Math.min(22, Math.max(8, groupW * 0.3));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Graph 1: Usage vs Cost ({data.groupByLabel})
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Dual-scaled grouped bar chart · Left axis: {data.usageUnit} · Right axis: Cost (USD)
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-blue-600" />
            <span>Usage ({data.usageUnit})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-sky-400 dark:bg-cyan-400" />
            <span>Cost (USD)</span>
          </span>
        </div>
      </div>

      <div className="relative mt-4 w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label="Grouped bar chart comparing resource usage and cost"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = padT + plotH * (1 - tick);
            return (
              <g key={tick}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                >
                  {formatCompact(maxUsage * tick)}
                </text>
                <text
                  x={width - padR + 8}
                  y={y + 4}
                  textAnchor="start"
                  className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                >
                  ${formatCompact(maxCost * tick)}
                </text>
              </g>
            );
          })}

          {points.map((p, idx) => {
            const cx = padL + idx * groupW + groupW / 2;
            const usageH = (p.usage / maxUsage) * plotH;
            const costH = (p.cost / maxCost) * plotH;
            const isHovered = hoveredIdx === idx;
            const shortLabel = p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label;

            return (
              <g
                key={p.label}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {isHovered && (
                  <rect
                    x={padL + idx * groupW + 2}
                    y={padT}
                    width={Math.max(4, groupW - 4)}
                    height={plotH}
                    className="fill-blue-50/70 dark:fill-slate-800/60"
                    rx={4}
                  />
                )}
                <rect
                  x={cx - barW - 2}
                  y={padT + plotH - usageH}
                  width={barW}
                  height={Math.max(2, usageH)}
                  rx={3}
                  className="fill-blue-600 transition-opacity"
                  opacity={hoveredIdx === null || isHovered ? 1 : 0.45}
                />
                <rect
                  x={cx + 2}
                  y={padT + plotH - costH}
                  width={barW}
                  height={Math.max(2, costH)}
                  rx={3}
                  className="fill-sky-400 transition-opacity dark:fill-cyan-400"
                  opacity={hoveredIdx === null || isHovered ? 1 : 0.45}
                />
                <text
                  x={cx}
                  y={padT + plotH + 16}
                  textAnchor="end"
                  transform={`rotate(-25 ${cx} ${padT + plotH + 16})`}
                  className="fill-slate-600 text-[10px] dark:fill-slate-300"
                >
                  {shortLabel}
                </text>
              </g>
            );
          })}

          <line
            x1={padL}
            y1={padT + plotH}
            x2={width - padR}
            y2={padT + plotH}
            className="stroke-slate-300 dark:stroke-slate-700"
          />
        </svg>

        {hoveredIdx !== null && points[hoveredIdx] && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs text-slate-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-slate-100">
            <span className="font-semibold">{points[hoveredIdx].label}</span>
            <span className="font-mono tabular-nums">
              Usage: {points[hoveredIdx].usage.toLocaleString()} {data.usageUnit} · Cost: $
              {points[hoveredIdx].cost.toLocaleString('en-US', { minimumFractionDigits: 2 })} ·{' '}
              {points[hoveredIdx].recordCount} records
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Graph 2: Current Year vs Previous Year (Month-wise Grouped Bar Chart)
 */
export function YearOverYearChart({ data }: { data: AnalyticsResult['yearOverYear'] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data.available || data.data.length === 0) {
    return (
      <UnavailableNotice
        title="Graph 2: Current Year vs Previous Year Monthly Cost"
        reason={
          data.reason ||
          'Multi-year dated billing records are not yet available. No historical values are fabricated.'
        }
      />
    );
  }

  const points = data.data;
  const maxCost = Math.max(
    ...points.flatMap((p) => [p.currentYearCost ?? 0, p.previousYearCost ?? 0]),
    1
  );

  const width = 680;
  const height = 295;
  const padL = 58;
  const padR = 20;
  const padT = 24;
  const padB = 46;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const groupW = plotW / points.length;
  const barW = Math.min(18, Math.max(6, groupW * 0.3));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Graph 2: {data.currentYear} vs {data.previousYear} Monthly Cost
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Actual month-wise expenditure comparison
            {data.usedHistoricalDb ? ' · Combined with persisted SQLite history' : ''}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-slate-400 dark:bg-slate-500" />
            <span>{data.previousYear}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-blue-600" />
            <span>{data.currentYear}</span>
          </span>
        </div>
      </div>

      <div className="mt-4 w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Month-wise grouped bar chart comparing ${data.currentYear} and ${data.previousYear} cloud costs`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = padT + plotH * (1 - tick);
            return (
              <g key={tick}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                >
                  ${formatCompact(maxCost * tick)}
                </text>
              </g>
            );
          })}

          {points.map((p, idx) => {
            const cx = padL + idx * groupW + groupW / 2;
            const prevH = p.previousYearCost !== null ? (p.previousYearCost / maxCost) * plotH : 0;
            const currH = p.currentYearCost !== null ? (p.currentYearCost / maxCost) * plotH : 0;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={p.monthLabel}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {isHovered && (
                  <rect
                    x={padL + idx * groupW + 2}
                    y={padT}
                    width={Math.max(4, groupW - 4)}
                    height={plotH}
                    className="fill-blue-50/70 dark:fill-slate-800/60"
                    rx={4}
                  />
                )}
                {p.previousYearCost !== null && (
                  <rect
                    x={cx - barW - 1.5}
                    y={padT + plotH - prevH}
                    width={barW}
                    height={Math.max(2, prevH)}
                    rx={3}
                    className="fill-slate-400 transition-opacity dark:fill-slate-500"
                    opacity={hoveredIdx === null || isHovered ? 1 : 0.45}
                  />
                )}
                {p.currentYearCost !== null && (
                  <rect
                    x={cx + 1.5}
                    y={padT + plotH - currH}
                    width={barW}
                    height={Math.max(2, currH)}
                    rx={3}
                    className="fill-blue-600 transition-opacity"
                    opacity={hoveredIdx === null || isHovered ? 1 : 0.45}
                  />
                )}
                <text
                  x={cx}
                  y={padT + plotH + 18}
                  textAnchor="middle"
                  className="fill-slate-600 text-[11px] dark:fill-slate-300"
                >
                  {p.monthLabel}
                </text>
              </g>
            );
          })}

          <line
            x1={padL}
            y1={padT + plotH}
            x2={width - padR}
            y2={padT + plotH}
            className="stroke-slate-300 dark:stroke-slate-700"
          />
        </svg>

        {hoveredIdx !== null && points[hoveredIdx] && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs text-slate-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-slate-100">
            <span className="font-semibold">{points[hoveredIdx].monthLabel}</span>
            <span className="font-mono tabular-nums">
              {data.previousYear}:{' '}
              {points[hoveredIdx].previousYearCost !== null
                ? `$${points[hoveredIdx].previousYearCost!.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : 'No data'}{' '}
              · {data.currentYear}:{' '}
              {points[hoveredIdx].currentYearCost !== null
                ? `$${points[hoveredIdx].currentYearCost!.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : 'No data'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Horizontal Breakdown Bar Chart (Service-wise / Region-wise)
 */
export function BreakdownBarChart({
  title,
  emptyReason,
  items,
}: {
  title: string;
  emptyReason: string;
  items: BreakdownPoint[];
}) {
  if (items.length === 0) {
    return <UnavailableNotice title={title} reason={emptyReason} />;
  }

  const maxVal = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const pct = (item.value / maxVal) * 100;
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                  {item.label}
                </span>
                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                  ${item.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({item.sharePct}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500 dark:bg-blue-500"
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Utilization Distribution (CPU & RAM Buckets)
 */
export function UtilizationDistributionChart({
  data,
}: {
  data: AnalyticsResult['utilizationDistribution'];
}) {
  if (!data.available || data.buckets.length === 0) {
    return (
      <UnavailableNotice
        title="CPU & RAM Utilization Distribution"
        reason={data.reason || 'CPU and RAM percentage columns were not detected in this dataset.'}
      />
    );
  }

  const maxCount = Math.max(
    ...data.buckets.flatMap((b) => [b.cpuCount, b.ramCount]),
    1
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            CPU & RAM Utilization Tiers
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Observation counts across utilization thresholds
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-blue-600" />
            <span>CPU Records</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-indigo-400" />
            <span>RAM Records</span>
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3.5">
        {data.buckets.map((bucket) => (
          <div key={bucket.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-200">{bucket.label}</span>
              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                CPU: {bucket.cpuCount} · RAM: {bucket.ramCount}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${(bucket.cpuCount / maxCount) * 100}%` }}
                />
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-indigo-400"
                  style={{ width: `${(bucket.ramCount / maxCount) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Resource Usage & Cost Trend Line Chart
 */
export function CostTrendChart({ trends }: { trends: TrendPoint[] }) {
  const costPoints = trends.filter((t): t is TrendPoint & { cost: number } => t.cost !== null);

  if (costPoints.length < 2) {
    return (
      <UnavailableNotice
        title="Temporal Cost Trend"
        reason="At least 2 distinct dated billing periods with cost values are required to render a time-series trend."
      />
    );
  }

  const width = 680;
  const height = 240;
  const padL = 58;
  const padR = 24;
  const padT = 20;
  const padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxCost = Math.max(...costPoints.map((p) => p.cost), 1);

  const coords = costPoints.map((p, i) => {
    const x = padL + (i / (costPoints.length - 1)) * plotW;
    const y = padT + plotH - (p.cost / maxCost) * plotH;
    return { x, y, ...p };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
        Cloud Expenditure Trend Over Time
      </h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Period-by-period actual cost trajectory ({costPoints[0].period} to{' '}
        {costPoints[costPoints.length - 1].period})
      </p>
      <div className="mt-4 w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
          {[0, 0.5, 1].map((tick) => {
            const y = padT + plotH * (1 - tick);
            return (
              <g key={tick}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                >
                  ${formatCompact(maxCost * tick)}
                </text>
              </g>
            );
          })}

          <polyline
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polyline}
          />

          {coords.map((c, idx) => (
            <g key={c.period}>
              <circle cx={c.x} cy={c.y} r="4" className="fill-blue-600 stroke-white dark:stroke-slate-900" strokeWidth="1.5" />
              {(idx === 0 || idx === coords.length - 1 || idx % Math.ceil(coords.length / 6) === 0) && (
                <text
                  x={c.x}
                  y={padT + plotH + 18}
                  textAnchor="middle"
                  className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                >
                  {c.period}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
