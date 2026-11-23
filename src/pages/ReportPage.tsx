import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  Download,
  FileText,
  Info,
  XCircle,
} from 'lucide-react';
import {
  BreakdownBarChart,
  CostTrendChart,
  UsageVsCostChart,
  UtilizationDistributionChart,
  YearOverYearChart,
} from '../components/Charts';
import type {
  OptimizationReport,
  RecommendationClassification,
  UploadHistoryItem,
} from '../types/cloud';

interface ReportPageProps {
  report: OptimizationReport | null;
  history: UploadHistoryItem[];
  onSelectReport: (reportId: string) => void;
  onNavigateHome: () => void;
}

export function ReportPage({
  report,
  history,
  onSelectReport,
  onNavigateHome,
}: ReportPageProps) {
  const [filterClass, setFilterClass] = useState<'ALL' | RecommendationClassification>('ALL');

  if (!report) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div
          data-testid="empty-report-state"
          className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900"
        >
          <FileText className="h-10 w-10 text-slate-400 dark:text-slate-500" />
          <h1 className="mt-4 font-display text-2xl font-bold text-slate-900 dark:text-white">
            No Optimization Report Available
          </h1>
          <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
            No data available. Upload a CSV file to begin analysis.
          </p>
          <button
            type="button"
            onClick={onNavigateHome}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Upload Page</span>
          </button>
        </div>
      </main>
    );
  }

  const filteredRecommendations =
    filterClass === 'ALL'
      ? report.recommendations
      : report.recommendations.filter((r) => r.classification === filterClass);

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloud-optimization-report-${report.filename.replace(/\.csv$/i, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadRecommendationsCsv = () => {
    const headers = [
      'Classification',
      'Resource ID',
      'Service',
      'Region',
      'Estimated Monthly Savings (USD)',
      'Savings Basis',
      'Reason',
      'Suggested Action',
    ];
    const escapeCell = (val: string | number | null | undefined) => {
      const s = val === null || val === undefined ? '' : String(val);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = report.recommendations.map((r) =>
      [
        r.classification,
        r.resourceId,
        r.service ?? '',
        r.region ?? '',
        r.estimatedMonthlySavings ?? '',
        r.savingsBasis,
        r.reason,
        r.suggestedAction,
      ]
        .map(escapeCell)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recommendations-${report.filename}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { analytics, recommendationSummary } = report;

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      {/* Report Header & Historical Selector */}
      <section className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 lg:flex-row lg:items-end dark:border-slate-800">
        <div className="space-y-2">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Home & CSV Upload</span>
          </button>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white wrap-anywhere">
            {report.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Generated {new Date(report.createdAt).toLocaleString()}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {report.cleaning.cleanedRowCount.toLocaleString()} cleaned records
            </span>
            {analytics.dateRange && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {analytics.dateRange.start} to {analytics.dateRange.end}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {history.length > 0 && (
            <div className="flex max-w-full items-center gap-2">
              <label
                htmlFor="report-history-select"
                className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
              >
                Report:
              </label>
              <select
                id="report-history-select"
                value={report.id}
                onChange={(e) => onSelectReport(e.target.value)}
                className="max-w-[200px] truncate rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {history.map((h) => (
                  <option key={h.reportId} value={h.reportId}>
                    {h.filename} ({new Date(h.uploadedAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleDownloadRecommendationsCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </section>

      {/* 1. Overall Cloud Cost & Resource Utilization KPI Grid */}
      <section aria-labelledby="kpi-heading">
        <h2
          id="kpi-heading"
          className="font-display text-lg font-semibold text-slate-900 dark:text-white"
        >
          Overall Cloud Cost & Utilization Summary
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Observed Cost
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {analytics.totalCost
                ? `$${analytics.totalCost.sum.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : 'Unavailable'}
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {analytics.totalCost
                ? `Mean $${analytics.totalCost.mean.toFixed(2)} · Median $${analytics.totalCost.median.toFixed(2)}`
                : 'No cost column detected'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Potential Savings
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
              {recommendationSummary.totalCalculableSavings !== null
                ? `$${recommendationSummary.totalCalculableSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : 'Unavailable'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {recommendationSummary.totalCalculableSavings !== null
                ? `${recommendationSummary.discontinueCount + recommendationSummary.optimizeCount} actionable resource(s)`
                : 'Requires cost + waste evidence'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              CPU Utilization
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {analytics.cpuStats ? `${analytics.cpuStats.mean}%` : 'Unavailable'}
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {analytics.cpuStats
                ? `P95: ${analytics.cpuStats.p95}% · Max: ${analytics.cpuStats.max}%`
                : 'No CPU metric in CSV'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              RAM Utilization
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {analytics.ramStats ? `${analytics.ramStats.mean}%` : 'Unavailable'}
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {analytics.ramStats
                ? `P95: ${analytics.ramStats.p95}% · Max: ${analytics.ramStats.max}%`
                : 'No RAM metric in CSV'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Storage Consumption
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {analytics.storageStats
                ? `${analytics.storageStats.sum.toLocaleString('en-US', { maximumFractionDigits: 1 })} GB`
                : 'Unavailable'}
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {analytics.storageStats
                ? `Avg ${analytics.storageStats.mean} GB · ${analytics.storageStats.count} records`
                : 'No storage metric in CSV'}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Dynamic Visualizations */}
      <section aria-labelledby="charts-heading" className="space-y-6">
        <h2
          id="charts-heading"
          className="font-display text-lg font-semibold text-slate-900 dark:text-white"
        >
          Dynamic Cost & Resource Utilization Analytics
        </h2>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <UsageVsCostChart data={analytics.usageVsCost} />
          <YearOverYearChart data={analytics.yearOverYear} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <BreakdownBarChart
            title="Service-wise Cost Breakdown"
            emptyReason="Service or Cost column unavailable in this dataset."
            items={analytics.serviceBreakdown}
          />
          <BreakdownBarChart
            title="Region-wise Cost Breakdown"
            emptyReason="Region / Availability Zone or Cost column unavailable in this dataset."
            items={analytics.regionBreakdown}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <UtilizationDistributionChart data={analytics.utilizationDistribution} />
          <CostTrendChart trends={analytics.usageTrends} />
        </div>
      </section>

      {/* 3. Important Findings & ML Forecasting Module Status */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Important Findings
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
            {report.findings.map((finding, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0 dark:border-slate-800"
              >
                <span className="mt-0.5 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <Cpu className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              ML Cost Forecasting Interface
            </h2>
          </div>
          <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
            {report.mlStatus.moduleName}
          </p>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-semibold">
              Forecasting Status:{' '}
              {report.mlStatus.forecastingAvailable ? 'Active' : 'Unavailable (Model Not Trained)'}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed">{report.mlStatus.message}</p>
          </div>
          <dl className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex justify-between">
              <dt>Reserved Algorithm</dt>
              <dd className="font-mono">Linear Regression</dd>
            </div>
            <div className="flex justify-between">
              <dt>Dated Periods Observed</dt>
              <dd className="font-mono tabular-nums">
                {report.mlStatus.historicalPeriodsAvailable} /{' '}
                {report.mlStatus.minimumPeriodsRequired} min
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* 4. Optimization Recommendations & Potential Savings */}
      <section
        aria-labelledby="recommendations-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2
              id="recommendations-heading"
              className="font-display text-lg font-semibold text-slate-900 dark:text-white"
            >
              Optimization Recommendations
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Evidence-based classifications · {recommendationSummary.discontinueCount} Discontinue ·{' '}
              {recommendationSummary.optimizeCount} Optimize · {recommendationSummary.continueCount}{' '}
              Continue
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter recommendations by classification"
            className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
          >
            {(['ALL', 'DISCONTINUE', 'OPTIMIZE', 'CONTINUE'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterClass(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  filterClass === tab
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {tab === 'ALL' ? `All (${report.recommendations.length})` : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filteredRecommendations.map((rec) => {
            const isDisc = rec.classification === 'DISCONTINUE';
            const isOpt = rec.classification === 'OPTIMIZE';

            return (
              <div
                key={rec.id}
                className="rounded-xl border border-slate-200 p-5 transition-colors dark:border-slate-800"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${
                          isDisc
                            ? 'text-red-700 dark:text-red-400'
                            : isOpt
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {isDisc ? (
                          <XCircle className="h-4 w-4" />
                        ) : isOpt ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        <span>{rec.classification}</span>
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                        ·
                      </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {rec.resourceId}
                      </span>
                      {rec.service && (
                        <>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                            ·
                          </span>
                          <span className="text-slate-600 dark:text-slate-300">{rec.service}</span>
                        </>
                      )}
                      {rec.region && (
                        <>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                            ·
                          </span>
                          <span className="font-mono text-slate-500 dark:text-slate-400">
                            {rec.region}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="pt-1 text-sm text-slate-800 dark:text-slate-100">{rec.reason}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">Suggested Action:</span> {rec.suggestedAction}
                    </p>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Estimated Savings</p>
                    <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">
                      {rec.estimatedMonthlySavings !== null
                        ? `$${rec.estimatedMonthlySavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {rec.savingsBasis}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 font-mono text-xs text-slate-600 tabular-nums dark:border-slate-800 dark:text-slate-300">
                  {Object.entries(rec.supportingMetrics).map(([k, v]) => (
                    <span key={k}>
                      <span className="text-slate-400 dark:text-slate-500">{k}:</span> {v}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Automatic Column Detection & Data Cleaning Audit */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
          Column Detection, Cleaning & Schema Ambiguity Audit
        </h2>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
          <span>
            Raw Rows: <strong className="font-mono tabular-nums">{report.cleaning.totalRawRows}</strong>
          </span>
          <span>
            Cleaned Rows:{' '}
            <strong className="font-mono tabular-nums">{report.cleaning.cleanedRowCount}</strong>
          </span>
          <span>
            Duplicates Removed:{' '}
            <strong className="font-mono tabular-nums">{report.cleaning.duplicateRowsRemoved}</strong>
          </span>
          <span>
            Empty Rows Dropped:{' '}
            <strong className="font-mono tabular-nums">{report.cleaning.droppedEmptyRows}</strong>
          </span>
        </div>

        {report.ambiguousColumns.length > 0 && (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <Info className="h-4 w-4" />
              <span>Ambiguous Columns Reported (Not Assumed)</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-amber-900 dark:text-amber-100">
              {report.ambiguousColumns.map((amb) => (
                <li key={amb.originalName}>
                  <span className="font-mono font-semibold">{amb.originalName}</span> (
                  {amb.dataType}) — {amb.reason} Candidates: {amb.candidateMetrics.join(', ')}.
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2.5 pr-4">CSV Column</th>
                <th className="py-2.5 px-4">Detected Metric</th>
                <th className="py-2.5 px-4">Data Type</th>
                <th className="py-2.5 px-4 text-right">Confidence</th>
                <th className="py-2.5 px-4 text-right">Missing</th>
                <th className="py-2.5 pl-4">Sample Values</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {report.detectedColumns.map((col) => (
                <tr key={col.originalName}>
                  <td className="py-2.5 pr-4 font-mono font-medium text-slate-900 dark:text-white">
                    {col.originalName}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-blue-700 dark:text-blue-400">
                    {col.mappedMetric ?? 'Unmapped'}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{col.dataType}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                    {col.confidence > 0 ? `${Math.round(col.confidence * 100)}%` : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {col.missingCount}
                  </td>
                  <td className="py-2.5 pl-4 font-mono text-slate-500 dark:text-slate-400">
                    {col.sampleValues.join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
