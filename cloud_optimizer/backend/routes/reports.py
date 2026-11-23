from fastapi import APIRouter, HTTPException

from database import delete_upload, get_latest_report, get_report_by_id, list_history

router = APIRouter(prefix="/api", tags=["reports"])


@router.get("/history")
def get_history():
    return {"items": list_history()}


@router.get("/reports/latest")
def latest_report():
    return {"report": get_latest_report()}


@router.get("/reports/{report_id}")
def read_report(report_id: str):
    report = get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    return {"report": report}


@router.delete("/uploads/{upload_id}")
def remove_upload(upload_id: str):
    if not delete_upload(upload_id):
        raise HTTPException(status_code=404, detail="Upload record not found.")
    return {"deleted": True}
