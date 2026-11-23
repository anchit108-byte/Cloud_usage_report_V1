import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List


def generate_report(
    upload_id: str,
    filename: str,
    validation: Dict[str, Any],
    cleaning: Dict[str, Any],
    detection: Dict[str, Any],
    analytics: Dict[str, Any],
    ml_status: Dict[str, Any],
    recommendations: List[Dict[str, Any]],
) -> Dict[str, Any]:
    findings: List[str] = []

    if analytics.get("total_cost"):
        tc = analytics["total_cost"]
        findings.append(
            f"Total observed cloud spend across {tc['count']} records is ${tc['sum']:,.2f} "
            f"(mean ${tc['mean']:.2f}, median ${tc['median']:.2f})."
        )
    else:
        findings.append("No cost column detected; dollar totals and savings cannot be calculated.")

    if analytics.get("service_breakdown"):
        top_svc = analytics["service_breakdown"][0]
        findings.append(
            f"Top spend service is {top_svc['label']} at ${top_svc['value']:,.2f} ({top_svc['share_pct']}%)."
        )

    if analytics.get("cpu_stats"):
        cpu = analytics["cpu_stats"]
        findings.append(f"Average CPU utilization is {cpu['mean']}% (P95: {cpu['p95']}%).")

    if detection.get("ambiguous_columns"):
        findings.append(
            f"{len(detection['ambiguous_columns'])} column(s) were flagged as ambiguous and left unmapped."
        )

    disc_count = sum(1 for r in recommendations if r["classification"] == "DISCONTINUE")
    opt_count = sum(1 for r in recommendations if r["classification"] == "OPTIMIZE")
    cont_count = sum(1 for r in recommendations if r["classification"] == "CONTINUE")

    savings_values = [r["estimated_monthly_savings"] for r in recommendations if r["estimated_monthly_savings"] is not None]
    total_savings = round(sum(savings_values), 2) if savings_values else None

    return {
        "id": str(uuid.uuid4()),
        "upload_id": upload_id,
        "filename": filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "title": f"Cloud Audit — {filename}",
        "validation": validation,
        "cleaning": cleaning,
        "detected_columns": detection["detected_columns"],
        "ambiguous_columns": detection["ambiguous_columns"],
        "unmapped_columns": detection["unmapped_columns"],
        "analytics": analytics,
        "ml_status": ml_status,
        "findings": findings,
        "recommendations": recommendations,
        "recommendation_summary": {
            "continue_count": cont_count,
            "optimize_count": opt_count,
            "discontinue_count": disc_count,
            "total_calculable_savings": total_savings,
        },
    }
