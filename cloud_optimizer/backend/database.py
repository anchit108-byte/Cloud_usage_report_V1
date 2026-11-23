import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional


DB_PATH = Path(os.environ.get("CLOUD_OPTIMIZER_DB", Path(__file__).resolve().parent / "cloud_optimizer.db"))


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """
    Initialize an empty SQLite database schema.
    Strictly avoids inserting any sample CSV rows, mock billing records, or dummy reports.
    """
    with get_connection() as conn:
        conn.executescript(
            """
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
            """
        )


def find_upload_by_hash(file_hash: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT u.id AS upload_id, r.id AS report_id, u.filename, u.uploaded_at
            FROM uploads u
            JOIN reports r ON r.upload_id = u.id
            WHERE u.file_hash = ?
            LIMIT 1
            """,
            (file_hash,),
        ).fetchone()
        return dict(row) if row else None


def get_historical_records() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT resource_id, resource_type, service, region, date, year, month,
                   cost, usage, cpu, ram, storage, uptime, iops
            FROM records
            """
        ).fetchall()
        return [dict(r) for r in rows]


def save_analysis(upload_id: str, report: Dict[str, Any], records: List[Dict[str, Any]]) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO uploads (
                id, filename, file_hash, uploaded_at, row_count, cleaned_row_count,
                headers_json, detected_columns_json, ambiguous_columns_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                upload_id,
                report["filename"],
                report["validation"]["file_hash"],
                report["created_at"],
                report["validation"]["row_count"],
                report["cleaning"]["cleaned_row_count"],
                json.dumps(report["validation"]["headers"]),
                json.dumps(report["detected_columns"]),
                json.dumps(report["ambiguous_columns"]),
            ),
        )

        conn.executemany(
            """
            INSERT INTO records (
                upload_id, resource_id, resource_type, service, region, date, year, month,
                cost, usage, cpu, ram, storage, uptime, iops
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    upload_id,
                    rec.get("resource_id"),
                    rec.get("resource_type"),
                    rec.get("service"),
                    rec.get("region"),
                    rec.get("date"),
                    rec.get("year"),
                    rec.get("month"),
                    rec.get("cost"),
                    rec.get("usage"),
                    rec.get("cpu"),
                    rec.get("ram"),
                    rec.get("storage"),
                    rec.get("uptime"),
                    rec.get("iops"),
                )
                for rec in records
            ],
        )

        conn.execute(
            """
            INSERT INTO reports (id, upload_id, created_at, title, report_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (report["id"], upload_id, report["created_at"], report["title"], json.dumps(report)),
        )
        conn.commit()


def list_history() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT u.id AS upload_id, r.id AS report_id, u.filename, u.file_hash,
                   u.uploaded_at, u.row_count, u.cleaned_row_count, r.report_json
            FROM uploads u
            JOIN reports r ON r.upload_id = u.id
            ORDER BY u.uploaded_at DESC
            """
        ).fetchall()

    items: List[Dict[str, Any]] = []
    for row in rows:
        report = json.loads(row["report_json"])
        total_cost_stats = report.get("analytics", {}).get("total_cost")
        items.append(
            {
                "id": row["upload_id"],
                "report_id": row["report_id"],
                "filename": row["filename"],
                "file_hash": row["file_hash"],
                "uploaded_at": row["uploaded_at"],
                "row_count": row["row_count"],
                "cleaned_row_count": row["cleaned_row_count"],
                "total_cost": total_cost_stats["sum"] if total_cost_stats else None,
                "recommendation_counts": report.get("recommendation_summary", {}),
            }
        )
    return items


def get_report_by_id(report_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT report_json FROM reports WHERE id = ? LIMIT 1",
            (report_id,),
        ).fetchone()
        return json.loads(row["report_json"]) if row else None


def get_latest_report() -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT report_json FROM reports ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        return json.loads(row["report_json"]) if row else None


def delete_upload(upload_id: str) -> bool:
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM uploads WHERE id = ?", (upload_id,))
        conn.commit()
        return cur.rowcount > 0
