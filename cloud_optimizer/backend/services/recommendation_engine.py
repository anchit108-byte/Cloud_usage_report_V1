from typing import Any, Dict, List, Optional


def _avg(values: List[float]) -> Optional[float]:
    return round(sum(values) / len(values), 2) if values else None


def generate_recommendations(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not records:
        return []

    has_resource_id = any(r.get("resource_id") is not None for r in records)
    grouped: Dict[str, List[Dict[str, Any]]] = {}

    for idx, r in enumerate(records):
        if has_resource_id:
            key = r.get("resource_id") or f"Unidentified-{r.get('service') or 'Resource'}-{idx + 1}"
        elif r.get("service"):
            region_suffix = f" ({r['region']})" if r.get("region") else ""
            key = f"{r['service']}{region_suffix}"
        else:
            key = f"Record-{idx + 1}"
        grouped.setdefault(key, []).append(r)

    recommendations: List[Dict[str, Any]] = []

    for key, recs in grouped.items():
        costs = [float(r["cost"]) for r in recs if r["cost"] is not None]
        cpus = [float(r["cpu"]) for r in recs if r["cpu"] is not None]
        rams = [float(r["ram"]) for r in recs if r["ram"] is not None]
        storages = [float(r["storage"]) for r in recs if r["storage"] is not None]
        uptimes = [float(r["uptime"]) for r in recs if r["uptime"] is not None]
        iops_vals = [float(r["iops"]) for r in recs if r["iops"] is not None]

        total_cost = round(sum(costs), 2) if costs else None
        avg_cpu = _avg(cpus)
        peak_cpu = round(max(cpus), 2) if cpus else None
        avg_ram = _avg(rams)
        avg_storage = _avg(storages)
        avg_uptime = _avg(uptimes)
        avg_iops = _avg(iops_vals)

        service = next((r["service"] for r in recs if r.get("service")), None)
        region = next((r["region"] for r in recs if r.get("region")), None)

        metrics: Dict[str, Any] = {"observations": len(recs)}
        if total_cost is not None:
            metrics["Observed Cost ($)"] = total_cost
        if avg_cpu is not None:
            metrics["Avg CPU (%)"] = avg_cpu
        if peak_cpu is not None:
            metrics["Peak CPU (%)"] = peak_cpu
        if avg_ram is not None:
            metrics["Avg RAM (%)"] = avg_ram
        if avg_storage is not None:
            metrics["Avg Storage (GB)"] = avg_storage
        if avg_uptime is not None:
            metrics["Avg Uptime (%)"] = avg_uptime
        if avg_iops is not None:
            metrics["Avg IOPS"] = avg_iops

        has_unattached_storage = avg_iops is not None and avg_iops == 0.0 and (
            avg_storage is not None or (service or "").lower() in {"ebs", "storage", "amazon ebs"}
        )
        has_idle_compute = (
            avg_cpu is not None
            and avg_cpu < 10.0
            and (peak_cpu is None or peak_cpu < 15.0)
            and (avg_ram is None or avg_ram < 20.0)
            and (len(recs) >= 2 or (avg_cpu < 5.0 and (avg_ram is None or avg_ram < 15.0)))
        )

        if has_unattached_storage:
            recommendations.append(
                {
                    "id": f"rec-{len(recommendations) + 1}",
                    "classification": "DISCONTINUE",
                    "resource_id": key,
                    "service": service,
                    "region": region,
                    "reason": f"Zero IOPS activity across {len(recs)} observation(s), indicating an unattached storage volume.",
                    "supporting_metrics": metrics,
                    "suggested_action": "Snapshot volume for compliance retention and delete unattached storage.",
                    "estimated_monthly_savings": total_cost,
                    "savings_basis": "100% of observed volume cost" if total_cost is not None else "Not calculable (cost unavailable)",
                }
            )
            continue

        if has_idle_compute:
            recommendations.append(
                {
                    "id": f"rec-{len(recommendations) + 1}",
                    "classification": "DISCONTINUE",
                    "resource_id": key,
                    "service": service,
                    "region": region,
                    "reason": f"Idle compute utilization: avg CPU {avg_cpu}% across {len(recs)} observation(s).",
                    "supporting_metrics": metrics,
                    "suggested_action": "Confirm workload decommission and terminate or enable scheduled auto-stop.",
                    "estimated_monthly_savings": round(total_cost * 0.85, 2) if total_cost is not None else None,
                    "savings_basis": "Conservative 85% termination savings" if total_cost is not None else "Not calculable (cost unavailable)",
                }
            )
            continue

        is_over_provisioned = (avg_cpu is not None and avg_cpu < 30.0 and (avg_ram is None or avg_ram < 35.0)) or (
            avg_ram is not None and avg_ram < 25.0 and (avg_cpu is None or avg_cpu < 35.0)
        )
        is_steady_state = avg_uptime is not None and avg_uptime > 80.0 and (avg_cpu is None or avg_cpu >= 30.0)

        if is_over_provisioned:
            recommendations.append(
                {
                    "id": f"rec-{len(recommendations) + 1}",
                    "classification": "OPTIMIZE",
                    "resource_id": key,
                    "service": service,
                    "region": region,
                    "reason": "Average CPU/RAM utilization sits below the 30% efficiency threshold.",
                    "supporting_metrics": metrics,
                    "suggested_action": "Downsize to a smaller instance family or configure auto-scaling.",
                    "estimated_monthly_savings": round(total_cost * 0.35, 2) if total_cost is not None else None,
                    "savings_basis": "Conservative 35% rightsizing reduction" if total_cost is not None else "Not calculable (cost unavailable)",
                }
            )
            continue

        if is_steady_state:
            recommendations.append(
                {
                    "id": f"rec-{len(recommendations) + 1}",
                    "classification": "OPTIMIZE",
                    "resource_id": key,
                    "service": service,
                    "region": region,
                    "reason": f"Steady-state workload ({avg_uptime}% uptime) running on on-demand pricing.",
                    "supporting_metrics": metrics,
                    "suggested_action": "Evaluate 1-year Reserved Instances or Compute Savings Plans.",
                    "estimated_monthly_savings": round(total_cost * 0.28, 2) if total_cost is not None else None,
                    "savings_basis": "Conservative 28% reservation discount" if total_cost is not None else "Not calculable (cost unavailable)",
                }
            )
            continue

        has_telemetry = avg_cpu is not None or avg_ram is not None or avg_iops is not None
        recommendations.append(
            {
                "id": f"rec-{len(recommendations) + 1}",
                "classification": "CONTINUE",
                "resource_id": key,
                "service": service,
                "region": region,
                "reason": (
                    "Balanced resource utilization with no waste flags."
                    if has_telemetry
                    else "Insufficient CPU/RAM/IOPS telemetry to justify downsizing or discontinuation."
                ),
                "supporting_metrics": metrics,
                "suggested_action": "Maintain current allocation and continue telemetry monitoring.",
                "estimated_monthly_savings": None,
                "savings_basis": "No waste detected",
            }
        )

    priority = {"DISCONTINUE": 0, "OPTIMIZE": 1, "CONTINUE": 2}
    recommendations.sort(key=lambda x: (priority[x["classification"]], -(x["estimated_monthly_savings"] or 0.0)))
    return recommendations
