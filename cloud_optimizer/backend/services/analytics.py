from typing import Any, Dict, List, Optional

import numpy as np

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def compute_numeric_stats(values: List[float]) -> Optional[Dict[str, float]]:
    if not values:
        return None
    arr = np.array(values, dtype=float)
    return {
        "count": int(arr.size),
        "sum": round(float(np.sum(arr)), 2),
        "mean": round(float(np.mean(arr)), 2),
        "median": round(float(np.median(arr)), 2),
        "min": round(float(np.min(arr)), 2),
        "max": round(float(np.max(arr)), 2),
        "std_dev": round(float(np.std(arr)), 2),
        "p95": round(float(np.percentile(arr, 95)), 2),
    }


def _build_usage_vs_cost(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    has_cost = any(r["cost"] is not None for r in records)
    has_usage = any(r["usage"] is not None for r in records)
    has_cpu = any(r["cpu"] is not None for r in records)

    if not has_cost:
        return {
            "available": False,
            "reason": "Cost column unavailable in uploaded CSV.",
            "group_by_label": "Service",
            "usage_unit": "Units",
            "data": [],
        }
    if not has_usage and not has_cpu:
        return {
            "available": False,
            "reason": "Neither Usage Quantity nor CPU Utilization column detected.",
            "group_by_label": "Service",
            "usage_unit": "Units",
            "data": [],
        }

    use_cpu = not has_usage and has_cpu
    group_key = "service" if any(r["service"] for r in records) else (
        "resource_type" if any(r["resource_type"] for r in records) else (
            "resource_id" if any(r["resource_id"] for r in records) else "region"
        )
    )

    groups: Dict[str, Dict[str, float]] = {}
    for idx, r in enumerate(records):
        label = r.get(group_key) or (f"Row {idx + 1}" if not any(r.get(k) for k in ("service", "resource_type", "resource_id", "region")) else "Unspecified")
        cost_val = r["cost"]
        usage_val = r["cpu"] if use_cpu else r["usage"]
        if cost_val is None and usage_val is None:
            continue
        slot = groups.setdefault(label, {"usage_sum": 0.0, "usage_count": 0.0, "cost_sum": 0.0, "count": 0.0})
        if cost_val is not None:
            slot["cost_sum"] += cost_val
        if usage_val is not None:
            slot["usage_sum"] += usage_val
            slot["usage_count"] += 1
        slot["count"] += 1

    points = []
    for label, g in groups.items():
        usage_metric = (g["usage_sum"] / g["usage_count"]) if (use_cpu and g["usage_count"] > 0) else g["usage_sum"]
        points.append(
            {
                "label": label,
                "usage": round(usage_metric, 2),
                "cost": round(g["cost_sum"], 2),
                "record_count": int(g["count"]),
            }
        )
    points.sort(key=lambda p: p["cost"], reverse=True)

    return {
        "available": len(points) > 0,
        "group_by_label": group_key.replace("_", " ").title(),
        "usage_unit": "Avg CPU (%)" if use_cpu else "Usage Units",
        "data": points[:10],
    }


def _build_year_over_year(records: List[Dict[str, Any]], used_historical_db: bool) -> Dict[str, Any]:
    dated = [r for r in records if r["year"] is not None and r["month"] is not None and r["cost"] is not None]
    if not dated:
        return {
            "available": False,
            "reason": "Date and Cost columns are required for Current Year vs Previous Year comparison.",
            "current_year": None,
            "previous_year": None,
            "used_historical_db": False,
            "data": [],
        }

    years = sorted({int(r["year"]) for r in dated}, reverse=True)
    if len(years) < 2:
        return {
            "available": False,
            "reason": f"Only {years[0]} data available. Upload compatible data for a second year without fabricating history.",
            "current_year": years[0],
            "previous_year": years[0] - 1,
            "used_historical_db": used_historical_db,
            "data": [],
        }

    curr_year = years[0]
    prev_year = (curr_year - 1) if (curr_year - 1) in years else years[1]
    months: Dict[int, Dict[str, Optional[float]]] = {m: {"curr": None, "prev": None} for m in range(1, 13)}

    for r in dated:
        m = int(r["month"])
        if r["year"] == curr_year:
            months[m]["curr"] = round((months[m]["curr"] or 0.0) + float(r["cost"]), 2)
        elif r["year"] == prev_year:
            months[m]["prev"] = round((months[m]["prev"] or 0.0) + float(r["cost"]), 2)

    data = [
        {
            "month_index": m,
            "month_label": MONTH_NAMES[m - 1],
            "current_year_cost": months[m]["curr"],
            "previous_year_cost": months[m]["prev"],
        }
        for m in range(1, 13)
    ]
    return {
        "available": True,
        "current_year": curr_year,
        "previous_year": prev_year,
        "used_historical_db": used_historical_db,
        "data": data,
    }


def _build_breakdown(records: List[Dict[str, Any]], field: str) -> List[Dict[str, Any]]:
    totals: Dict[str, Dict[str, float]] = {}
    grand = 0.0
    for r in records:
        key = r.get(field)
        cost = r.get("cost")
        if not key or cost is None:
            continue
        slot = totals.setdefault(key, {"sum": 0.0, "count": 0.0})
        slot["sum"] += float(cost)
        slot["count"] += 1
        grand += float(cost)

    if grand <= 0:
        return []

    out = [
        {
            "label": k,
            "value": round(v["sum"], 2),
            "share_pct": round((v["sum"] / grand) * 100.0, 2),
            "count": int(v["count"]),
        }
        for k, v in totals.items()
    ]
    out.sort(key=lambda x: x["value"], reverse=True)
    return out[:10]


def run_numerical_analytics(
    current_records: List[Dict[str, Any]],
    historical_records: List[Dict[str, Any]],
) -> Dict[str, Any]:
    costs = [float(r["cost"]) for r in current_records if r["cost"] is not None]
    cpus = [float(r["cpu"]) for r in current_records if r["cpu"] is not None]
    rams = [float(r["ram"]) for r in current_records if r["ram"] is not None]
    storages = [float(r["storage"]) for r in current_records if r["storage"] is not None]
    usages = [float(r["usage"]) for r in current_records if r["usage"] is not None]

    dates = sorted([r["date"] for r in current_records if r["date"] is not None])
    date_range = (
        {"start": dates[0], "end": dates[-1], "distinct_days": len(set(dates))}
        if dates
        else None
    )

    combined = historical_records if historical_records else current_records
    used_hist = len(historical_records) > len(current_records)

    # Trends grouped by YYYY-MM if > 31 distinct days, else YYYY-MM-DD
    by_month = len(set(dates)) > 31
    trend_map: Dict[str, Dict[str, float]] = {}
    for r in current_records:
        if not r["date"]:
            continue
        period = r["date"][:7] if by_month else r["date"]
        t = trend_map.setdefault(period, {"cost": 0.0, "cost_n": 0.0, "cpu": 0.0, "cpu_n": 0.0, "count": 0.0})
        if r["cost"] is not None:
            t["cost"] += float(r["cost"])
            t["cost_n"] += 1
        if r["cpu"] is not None:
            t["cpu"] += float(r["cpu"])
            t["cpu_n"] += 1
        t["count"] += 1

    trends = [
        {
            "period": p,
            "cost": round(v["cost"], 2) if v["cost_n"] > 0 else None,
            "cpu_mean": round(v["cpu"] / v["cpu_n"], 2) if v["cpu_n"] > 0 else None,
            "count": int(v["count"]),
        }
        for p, v in sorted(trend_map.items())
    ]

    return {
        "total_cost": compute_numeric_stats(costs),
        "cpu_stats": compute_numeric_stats(cpus),
        "ram_stats": compute_numeric_stats(rams),
        "storage_stats": compute_numeric_stats(storages),
        "usage_stats": compute_numeric_stats(usages),
        "date_range": date_range,
        "usage_vs_cost": _build_usage_vs_cost(current_records),
        "year_over_year": _build_year_over_year(combined, used_hist),
        "service_breakdown": _build_breakdown(current_records, "service"),
        "region_breakdown": _build_breakdown(current_records, "region"),
        "usage_trends": trends,
    }
