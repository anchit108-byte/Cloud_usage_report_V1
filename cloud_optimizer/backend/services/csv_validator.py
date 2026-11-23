import hashlib
import io
from typing import Any, Dict, List, Tuple

import pandas as pd


def compute_file_hash(raw_bytes: bytes) -> str:
    return hashlib.sha256(raw_bytes).hexdigest()


def validate_and_load_csv(filename: str, raw_bytes: bytes) -> Tuple[Dict[str, Any], pd.DataFrame]:
    errors: List[str] = []
    warnings: List[str] = []
    file_hash = compute_file_hash(raw_bytes)

    if not filename.lower().endswith(".csv"):
        warnings.append("File extension is not .csv; attempting CSV parsing based on content.")

    if not raw_bytes or not raw_bytes.strip():
        errors.append("Uploaded file is empty.")
        return (
            {
                "valid": False,
                "errors": errors,
                "warnings": warnings,
                "row_count": 0,
                "column_count": 0,
                "headers": [],
                "file_hash": file_hash,
            },
            pd.DataFrame(),
        )

    try:
        df = pd.read_csv(io.BytesIO(raw_bytes), dtype=str, keep_default_na=False)
    except Exception as exc:
        errors.append(f"CSV parsing failed: {exc}")
        return (
            {
                "valid": False,
                "errors": errors,
                "warnings": warnings,
                "row_count": 0,
                "column_count": 0,
                "headers": [],
                "file_hash": file_hash,
            },
            pd.DataFrame(),
        )

    if df.empty or len(df.columns) == 0:
        errors.append("CSV contains headers but zero data rows.")

    if len(df) > 50000:
        errors.append("CSV exceeds the 50,000-row single-upload limit.")

    return (
        {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "row_count": int(len(df)),
            "column_count": int(len(df.columns)),
            "headers": [str(c) for c in df.columns],
            "file_hash": file_hash,
        },
        df,
    )
