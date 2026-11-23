import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import type { OptimizationReport, UploadHistoryItem } from '../types/cloud';

interface HomePageProps {
  history: UploadHistoryItem[];
  isLoadingHistory: boolean;
  onUploadComplete: (report: OptimizationReport, duplicateMessage?: string) => void;
  onOpenReport: (reportId: string) => void;
  onDeleteUpload: (uploadId: string) => Promise<void>;
  onNavigateToReportPage: () => void;
}

const PIPELINE_STAGES = [
  'CSV Upload',
  'Validation',
  'Pandas Data Cleaning',
  'Column Detection',
  'Numerical Analysis',
  'ML Model Interface',
  'Recommendation Engine',
  'Report Generation',
];

export function HomePage({
  history,
  isLoadingHistory,
  onUploadComplete,
  onOpenReport,
  onDeleteUpload,
  onNavigateToReportPage,
}: HomePageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationState, setValidationState] = useState<{
    status: 'idle' | 'ready' | 'validating' | 'valid' | 'error';
    message: string;
  }>({
    status: 'idle',
    message: 'Select a cloud usage or billing CSV file to validate structure.',
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStageIdx, setActiveStageIdx] = useState<number>(-1);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    reportId: string;
    filename: string;
    blinking: boolean;
    duplicateMessage?: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!successInfo?.blinking) return;
    const timer = window.setTimeout(() => {
      setSuccessInfo((prev) => (prev ? { ...prev, blinking: false } : null));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [successInfo?.blinking]);

  const handleFileSelection = async (file: File | null) => {
    setUploadError(null);
    setSuccessInfo(null);
    if (!file) {
      setSelectedFile(null);
      setValidationState({
        status: 'idle',
        message: 'Select a cloud usage or billing CSV file to validate structure.',
      });
      return;
    }

    setSelectedFile(file);
    setValidationState({
      status: 'validating',
      message: `Inspecting "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`,
    });

    if (file.size === 0) {
      setValidationState({
        status: 'error',
        message: 'Validation failed: file is empty (0 bytes).',
      });
      return;
    }

    try {
      const previewText = await file.slice(0, 64 * 1024).text();
      const lines = previewText
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setValidationState({
          status: 'error',
          message: 'Validation failed: CSV must contain a header row and at least one data row.',
        });
        return;
      }

      setValidationState({
        status: 'ready',
        message: `Validated locally: "${file.name}" (${(file.size / 1024).toFixed(1)} KB). Ready to upload and analyze.`,
      });
    } catch {
      setValidationState({
        status: 'error',
        message: 'Unable to read selected file.',
      });
    }
  };

  const handleAnalyzeSubmit = async () => {
    if (!selectedFile || validationState.status === 'error') return;

    setIsAnalyzing(true);
    setUploadError(null);
    setSuccessInfo(null);
    setActiveStageIdx(0);

    // Advance visual pipeline stages smoothly while the REST request runs
    const stageInterval = window.setInterval(() => {
      setActiveStageIdx((prev) => (prev < PIPELINE_STAGES.length - 2 ? prev + 1 : prev));
    }, 180);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();
      window.clearInterval(stageInterval);

      if (!response.ok) {
        setActiveStageIdx(-1);
        setValidationState({
          status: 'error',
          message: payload.error || 'CSV validation failed on server.',
        });
        setUploadError(payload.error || 'Failed to analyze CSV.');
        return;
      }

      setActiveStageIdx(PIPELINE_STAGES.length - 1);
      setValidationState({
        status: 'valid',
        message: `Server validation passed: ${payload.report.cleaning.cleanedRowCount} cleaned records processed across ${payload.report.detectedColumns.length} columns.`,
      });

      setSuccessInfo({
        reportId: payload.report.id,
        filename: payload.report.filename,
        blinking: true,
        duplicateMessage: payload.duplicateDetected ? payload.message : undefined,
      });

      onUploadComplete(payload.report, payload.duplicateDetected ? payload.message : undefined);
    } catch (err) {
      window.clearInterval(stageInterval);
      setActiveStageIdx(-1);
      setUploadError(err instanceof Error ? err.message : 'Network error communicating with backend API.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = async (uploadId: string) => {
    setDeletingId(uploadId);
    try {
      await onDeleteUpload(uploadId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-6 py-10">
      {/* Hero Introduction */}
      <section className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <p className="text-xs font-semibold tracking-wide text-blue-600 dark:text-blue-400">
            Automated Telemetry Audit & FinOps Pipeline
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white [text-wrap:balance]">
            AI-Based Cloud Usage and Cloud Cost Optimization System
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Upload AWS or multi-cloud usage and billing CSV exports to automatically detect column
            schemas, clean inconsistent records, compute utilization telemetry, and generate
            evidence-backed optimization recommendations backed by persistent SQLite history.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Processing Architecture
          </h2>
          <ol className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <li className="flex items-center justify-between border-b border-slate-200/70 pb-1.5 dark:border-slate-800">
              <span>01. Schema Mapping</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">Auto-Detect</span>
            </li>
            <li className="flex items-center justify-between border-b border-slate-200/70 pb-1.5 dark:border-slate-800">
              <span>02. Metric Analysis</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">Numerical Stats</span>
            </li>
            <li className="flex items-center justify-between border-b border-slate-200/70 pb-1.5 dark:border-slate-800">
              <span>03. ML Interface</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">ml_model.py</span>
            </li>
            <li className="flex items-center justify-between">
              <span>04. Persistence</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">SQLite History</span>
            </li>
          </ol>
        </div>
      </section>

      {/* CSV Upload & Validation Workspace */}
      <section
        id="upload-section"
        className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
              Upload Cloud Usage & Billing CSV
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Supports variable column headers (AWS CUR, Cost Explorer, CloudWatch, or custom exports).
              Missing metrics are reported transparently rather than fabricated.
            </p>
          </div>
        </div>

        {/* Dropzone + File Input */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = e.dataTransfer.files?.[0] ?? null;
            void handleFileSelection(dropped);
          }}
          className={`mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            isDragging
              ? 'border-blue-600 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
              : 'border-slate-300 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-950/40'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400">
            <FileSpreadsheet className="h-6 w-6" />
          </div>

          <p className="mt-4 text-sm font-medium text-slate-900 dark:text-white">
            {selectedFile ? selectedFile.name : 'Drag and drop a CSV file here, or browse from disk'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            UTF-8 CSV files up to 25 MB · Sent directly to REST API for validation & SQLite storage
          </p>

          <input
            ref={fileInputRef}
            id="csv-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleFileSelection(e.target.files?.[0] ?? null)}
            className="sr-only"
          />

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <label
              htmlFor="csv-file-input"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-700 focus-within:outline-2 focus-within:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 cursor-pointer whitespace-nowrap"
            >
              <Upload className="h-4 w-4" />
              <span>Choose CSV File</span>
            </label>

            <button
              type="button"
              disabled={!selectedFile || validationState.status === 'error' || isAnalyzing}
              onClick={() => void handleAnalyzeSubmit()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer whitespace-nowrap"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing Dataset...</span>
                </>
              ) : (
                <>
                  <span>Analyze & Generate Report</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* File Validation Status */}
        <div
          role="status"
          aria-live="polite"
          className={`mt-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            validationState.status === 'error'
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
              : validationState.status === 'valid'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300'
          }`}
        >
          {validationState.status === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          ) : (
            <CheckCircle2
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                validationState.status === 'valid' || validationState.status === 'ready'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-400'
              }`}
            />
          )}
          <div>
            <span className="font-semibold">File Validation Status: </span>
            <span>{validationState.message}</span>
          </div>
        </div>

        {/* Analysis Progress Indicator */}
        {(isAnalyzing || activeStageIdx >= 0) && (
          <div className="mt-6 space-y-3" aria-label="Analysis pipeline progress">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
              <span>Pipeline Execution Progress</span>
              <span className="font-mono tabular-nums">
                {Math.min(100, Math.round(((activeStageIdx + 1) / PIPELINE_STAGES.length) * 100))}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-200"
                style={{
                  width: `${Math.min(100, ((activeStageIdx + 1) / PIPELINE_STAGES.length) * 100)}%`,
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PIPELINE_STAGES.map((stage, idx) => {
                const done = idx <= activeStageIdx;
                return (
                  <div
                    key={stage}
                    className={`rounded-md border px-3 py-2 text-xs transition-colors ${
                      done
                        ? 'border-blue-200 bg-blue-50/70 font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200'
                        : 'border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500'
                    }`}
                  >
                    <span className="font-mono">{String(idx + 1).padStart(2, '0')}.</span> {stage}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {uploadError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Processing Error</p>
              <p className="mt-0.5">{uploadError}</p>
            </div>
          </div>
        )}

        {/* Green Success Banner (blinks for exactly 3 seconds after successful report generation) */}
        {successInfo && (
          <div
            role="status"
            data-testid="upload-success-banner"
            data-blinking={successInfo.blinking ? 'true' : 'false'}
            className={`mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100 ${
              successInfo.blinking ? 'animate-blink-3s' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-semibold">
                  {successInfo.duplicateMessage
                    ? 'Existing Report Loaded (Duplicate Upload Prevented)'
                    : `Report Generated Successfully for "${successInfo.filename}"`}
                </p>
                <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-200">
                  {successInfo.duplicateMessage ||
                    'Analysis completed and persisted in SQLite historical records.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenReport(successInfo.reportId)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
            >
              <span>Open Report</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* Persisted Historical Records (SQLite) */}
      <section
        id="history-section"
        className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
              Historical Uploads & Reports
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Real records persisted in SQLite across sessions and used for compatible multi-year
              comparisons.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {history.length} persisted record{history.length === 1 ? '' : 's'}
          </span>
        </div>

        {isLoadingHistory ? (
          <div className="mt-6 space-y-3">
            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : history.length === 0 ? (
          <div
            data-testid="empty-history-state"
            className="mt-6 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-950/40"
          >
            <Database className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              No data available. Upload a CSV file to begin analysis.
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
              The database initializes completely empty with zero sample or fabricated billing rows.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-3 pr-4">File Name</th>
                  <th className="py-3 px-4">Uploaded At</th>
                  <th className="py-3 px-4 text-right">Cleaned Rows</th>
                  <th className="py-3 px-4 text-right">Total Cost</th>
                  <th className="py-3 px-4">Actions Flagged</th>
                  <th className="py-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {history.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3.5 pr-4 font-medium text-slate-900 dark:text-white">
                      {item.filename}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                      {new Date(item.uploadedAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                      {item.cleanedRowCount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                      {item.totalCost !== null
                        ? `$${item.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : 'Unavailable'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                      <span>{item.recommendationCounts.discontinueCount} Discontinue</span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.recommendationCounts.optimizeCount} Optimize</span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.recommendationCounts.continueCount} Continue</span>
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenReport(item.reportId)}
                          className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 cursor-pointer whitespace-nowrap"
                        >
                          Open Report
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete upload ${item.filename}`}
                          disabled={deletingId === item.id}
                          onClick={() => void handleDelete(item.id)}
                          className="inline-flex items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-700 dark:hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bottom Report Navigation Section */}
      <section
        id="bottom-report-section"
        className="flex flex-col items-start justify-between gap-6 rounded-xl border border-blue-200 bg-blue-50/60 p-6 sm:flex-row sm:items-center sm:p-8 dark:border-blue-900/70 dark:bg-blue-950/25"
      >
        <div className="space-y-1.5">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Cloud Cost & Utilization Report
          </h2>
          <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">
            Inspect the full optimization audit, dynamic Usage vs Cost and Year-over-Year charts,
            schema ambiguity diagnostics, and prioritized resource recommendations.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToReportPage}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>Go to Report Page</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </main>
  );
}
