from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from .column_detector import NULL_TOKENS, parse_date_candidate, parse_numeric_candidate


def clean_dataframe(
    df: pd.DataFrame,
    metric_to_header: Dict[str, str],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    raw_rows = len(df)
    cleaned_df = df.copy()

    # Drop completely empty rows
    non_empty_mask = cleaned_df.apply(
        lambda row: any(str(v).strip() and str(v).strip().lower() not in NULL_TOKENS for v in row),
        axis=1,
    )
    dropped_empty_rows = int((~non_empty_mask).sum())
    cleaned_df = cleaned_df[non_empty_mask]

    # Remove exact duplicate rows
    before_dedup = len(cleaned_df)
    cleaned_df = cleaned_df.drop_duplicates()
    duplicate_rows_removed = int(before_dedup - len(cleaned_df))

    invalid_values_coerced: Dict[str, int] = {}
    missing_values_by_column: Dict[str, int] = {}
    records: List[Dict[str, Any]] = []

    def track_missing(col: str) -> None:
        missing_values_by_column[col] = missing_values_by_column.get(col, 0) + 1

    def track_invalid(col: str) -> None:
        invalid_values_coerced[col] = invalid_values_coerced.get(col, 0) + 1

    def read_str(metric: str, row: pd.Series) -> Optional[str]:
        col = metric_to_header.get(metric)
        if not col:
            return None
        val = str(row[col]).strip()
        if not val or val.lower() in NULL_TOKENS:
            track_missing(col)
            return None
        return val

    def read_num(
        metric: str,
        row: pd.Series,
        min_val: Optional[float] = 0.0,
        max_val: Optional[float] = None,
    ) -> Optional[float]:
        col = metric_to_header.get(metric)
        if not col:
            return None
        raw = str(row[col]).strip()
        if not raw or raw.lower() in NULL_TOKENS:
            track_missing(col)
            return None
        num = parse_numeric_candidate(raw)
        if num is None:
            track_invalid(col)
            return None
        if min_val is not None and num < min_val:
            track_invalid(col)
            return None
        if max_val is not None and num > max_val:
            track_invalid(col)
            return None
        return num

    for _, row in cleaned_df.iterrows():
        date_col = metric_to_header.get("date")
        iso_date: Optional[str] = None
        if date_col:
            raw_date = str(row[date_col]).strip()
            if not raw_date or raw_date.lower() in NULL_TOKENS:
                track_missing(date_col)
            else:
                iso_date = parse_date_candidate(raw_date)
                if iso_date is None:
                    track_invalid(date_col)

        year = int(iso_date[:4]) if iso_date else None
        month = int(iso_date[5:7]) if iso_date else None

        records.append(
            {
                "resource_id": read_str("resource_id", row),
                "resource_type": read_str("resource_type", row),
                "service": read_str("service", row),
                "region": read_str("region", row),
                "date": iso_date,
                "year": year,
                "month": month,
                "cost": read_num("cost", row, min_val=0.0),
                "usage": read_num("usage", row, min_val=0.0),
                "cpu": read_num("cpu", row, min_val=0.0, max_val=100.0),
                "ram": read_num("ram", row, min_val=0.0, max_val=100.0),
                "storage": read_num("storage", row, min_val=0.0),
                "uptime": read_num("uptime", row, min_val=0.0, max_val=100.0),
                "iops": read_num("iops", row, min_val=0.0),
            }
        )

    return records, {
        "total_raw_rows": raw_rows,
        "cleaned_row_count": len(records),
        "dropped_empty_rows": dropped_empty_rows,
        "duplicate_rows_removed": duplicate_rows_removed,
        "invalid_values_coerced": invalid_values_coerced,
        "missing_values_by_column": missing_values_by_column,
    }
