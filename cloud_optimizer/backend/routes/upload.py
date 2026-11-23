import uuid
from fastapi import APIRouter, File, HTTPException, UploadFile

from database import find_upload_by_hash, get_historical_records, get_report_by_id, save_analysis
from ml_model import get_ml_status
from services.analytics import run_numerical_analytics
from services.column_detector import detect_columns
from services.csv_validator import validate_and_load_csv
from services.data_cleaner import clean_dataframe
from services.recommendation_engine import generate_recommendations
from services.report_generator import generate_report

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    filename = file.filename or "uploaded.csv"
    raw_bytes = await file.read()

    # 1. Validation & CSV parsing
    validation, df = validate_and_load_csv(filename, raw_bytes)
    if not validation["valid"]:
        raise HTTPException(status_code=422, detail={"errors": validation["errors"], "validation": validation})

    # Prevent duplicate ingestion of identical files
    existing = find_upload_by_hash(validation["file_hash"])
    if existing:
        existing_report = get_report_by_id(existing["report_id"])
        if existing_report:
            return {
                "duplicate_detected": True,
                "message": f"Identical file '{existing['filename']}' was already analyzed. Returning persisted report.",
                "report": existing_report,
            }

    # 2. Automatic Column Detection
    detection = detect_columns(df)

    # 3. Pandas Data Cleaning
    records, cleaning_summary = clean_dataframe(df, detection["metric_to_header"])
    if not records:
        raise HTTPException(status_code=422, detail="No valid records remained after cleaning.")

    # 4. NumPy Numerical Analysis (combining SQLite history for YoY compatibility)
    prior_history = get_historical_records()
    analytics = run_numerical_analytics(records, prior_history + records)

    # 5. ML Model Interface (no fabricated predictions)
    dated_periods = len([t for t in analytics.get("usage_trends", []) if t.get("cost") is not None])
    ml_status = get_ml_status(dated_periods)

    # 6. Recommendation Engine
    recommendations = generate_recommendations(records)

    # 7. Report Generation
    upload_id = str(uuid.uuid4())
    report = generate_report(
        upload_id=upload_id,
        filename=filename,
        validation=validation,
        cleaning=cleaning_summary,
        detection=detection,
        analytics=analytics,
        ml_status=ml_status,
        recommendations=recommendations,
    )

    # 8. SQLite Persistence
    save_analysis(upload_id, report, records)

    return {"duplicate_detected": False, "report": report}
