import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  NormalizedRecord,
  OptimizationReport,
  UploadHistoryItem,
} from '../types/cloud';

export class CloudDatabase {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const resolvedPath =
      dbPath ?? process.env.CLOUD_DB_PATH ?? path.resolve(process.cwd(), 'data', 'cloud_optimizer.db');
    if (resolvedPath !== ':memory:') {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    }
    this.db = new DatabaseSync(resolvedPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS uploads (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        file_hash TEXT NOT NULL UNIQUE,
        uploaded_at TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        cleaned_row_count INTEGER NOT NULL,
        headers_json TEXT NOT NULL,
        detected_columns_json TEXT NOT NULL,
        ambiguous_columns_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        upload_id TEXT NOT NULL,
        resource_id TEXT,
        resource_type TEXT,
        service TEXT,
        region TEXT,
        date TEXT,
        year INTEGER,
        month INTEGER,
        cost REAL,
        usage REAL,
        cpu REAL,
        ram REAL,
        storage REAL,
        uptime REAL,
        iops REAL,
        FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_records_year_month ON records(year, month);
      CREATE INDEX IF NOT EXISTS idx_records_upload ON records(upload_id);

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        upload_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        title TEXT NOT NULL,
        report_json TEXT NOT NULL,
        FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE
      );
    `);
  }

  findUploadByHash(fileHash: string): { uploadId: string; reportId: string; filename: string; uploadedAt: string } | null {
    const row = this.db
      .prepare(
        `SELECT u.id as uploadId, r.id as reportId, u.filename as filename, u.uploaded_at as uploadedAt
         FROM uploads u
         JOIN reports r ON r.upload_id = u.id
         WHERE u.file_hash = ?
         LIMIT 1`
      )
      .get(fileHash) as { uploadId: string; reportId: string; filename: string; uploadedAt: string } | undefined;
    return row ?? null;
  }

  getHistoricalRecords(): NormalizedRecord[] {
    const rows = this.db
      .prepare(
        `SELECT resource_id, resource_type, service, region, date, year, month,
                cost, usage, cpu, ram, storage, uptime, iops
         FROM records`
      )
      .all() as Array<{
      resource_id: string | null;
      resource_type: string | null;
      service: string | null;
      region: string | null;
      date: string | null;
      year: number | null;
      month: number | null;
      cost: number | null;
      usage: number | null;
      cpu: number | null;
      ram: number | null;
      storage: number | null;
      uptime: number | null;
      iops: number | null;
    }>;

    return rows.map((r) => ({
      resourceId: r.resource_id,
      resourceType: r.resource_type,
      service: r.service,
      region: r.region,
      date: r.date,
      year: r.year,
      month: r.month,
      cost: r.cost,
      usage: r.usage,
      cpu: r.cpu,
      ram: r.ram,
      storage: r.storage,
      uptime: r.uptime,
      iops: r.iops,
    }));
  }

  saveAnalysis(
    uploadId: string,
    report: OptimizationReport,
    records: NormalizedRecord[]
  ): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `INSERT INTO uploads (
            id, filename, file_hash, uploaded_at, row_count, cleaned_row_count,
            headers_json, detected_columns_json, ambiguous_columns_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          uploadId,
          report.filename,
          report.validation.fileHash,
          report.createdAt,
          report.validation.rowCount,
          report.cleaning.cleanedRowCount,
          JSON.stringify(report.validation.headers),
          JSON.stringify(report.detectedColumns),
          JSON.stringify(report.ambiguousColumns)
        );

      const insertRecord = this.db.prepare(
        `INSERT INTO records (
          upload_id, resource_id, resource_type, service, region, date, year, month,
          cost, usage, cpu, ram, storage, uptime, iops
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const rec of records) {
        insertRecord.run(
          uploadId,
          rec.resourceId,
          rec.resourceType,
          rec.service,
          rec.region,
          rec.date,
          rec.year,
          rec.month,
          rec.cost,
          rec.usage,
          rec.cpu,
          rec.ram,
          rec.storage,
          rec.uptime,
          rec.iops
        );
      }

      this.db
        .prepare(
          `INSERT INTO reports (id, upload_id, created_at, title, report_json)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(report.id, uploadId, report.createdAt, report.title, JSON.stringify(report));

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  listHistory(): UploadHistoryItem[] {
    const rows = this.db
      .prepare(
        `SELECT u.id as uploadId, r.id as reportId, u.filename, u.file_hash as fileHash,
                u.uploaded_at as uploadedAt, u.row_count as rowCount,
                u.cleaned_row_count as cleanedRowCount, r.report_json as reportJson
         FROM uploads u
         JOIN reports r ON r.upload_id = u.id
         ORDER BY u.uploaded_at DESC`
      )
      .all() as Array<{
      uploadId: string;
      reportId: string;
      filename: string;
      fileHash: string;
      uploadedAt: string;
      rowCount: number;
      cleanedRowCount: number;
      reportJson: string;
    }>;

    return rows.map((row) => {
      const parsed = JSON.parse(row.reportJson) as OptimizationReport;
      return {
        id: row.uploadId,
        reportId: row.reportId,
        filename: row.filename,
        fileHash: row.fileHash,
        uploadedAt: row.uploadedAt,
        rowCount: row.rowCount,
        cleanedRowCount: row.cleanedRowCount,
        totalCost: parsed.analytics.totalCost?.sum ?? null,
        recommendationCounts: {
          continueCount: parsed.recommendationSummary.continueCount,
          optimizeCount: parsed.recommendationSummary.optimizeCount,
          discontinueCount: parsed.recommendationSummary.discontinueCount,
        },
      };
    });
  }

  getReportById(reportId: string): OptimizationReport | null {
    const row = this.db
      .prepare(`SELECT report_json FROM reports WHERE id = ? LIMIT 1`)
      .get(reportId) as { report_json: string } | undefined;
    return row ? (JSON.parse(row.report_json) as OptimizationReport) : null;
  }

  getLatestReport(): OptimizationReport | null {
    const row = this.db
      .prepare(`SELECT report_json FROM reports ORDER BY created_at DESC LIMIT 1`)
      .get() as { report_json: string } | undefined;
    return row ? (JSON.parse(row.report_json) as OptimizationReport) : null;
  }

  deleteUpload(uploadId: string): boolean {
    const result = this.db.prepare(`DELETE FROM uploads WHERE id = ?`).run(uploadId);
    return Number(result.changes) > 0;
  }

  close(): void {
    this.db.close();
  }
}
