import re
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

NULL_TOKENS = {"", "null", "none", "na", "n/a", "nan", "undefined", "-", "--"}


def normalize_header_name(header: str) -> str:
    s = re.sub(r"([a-z])([A-Z])", r"\1_\2", header)
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def parse_numeric_candidate(raw: str) -> Optional[float]:
    trimmed = raw.strip()
    if not trimmed or trimmed.lower() in NULL_TOKENS:
        return None
    cleaned = re.sub(r"[$,€£₹%\s]", "", trimmed)
    if re.match(r"^\(.+\)$", cleaned):
        cleaned = "-" + cleaned[1:-1]
    if not re.match(r"^-?\d+(\.\d+)?([eE][+-]?\d+)?$", cleaned):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_date_candidate(raw: str) -> Optional[str]:
    trimmed = raw.strip()
    if not trimmed or trimmed.lower() in NULL_TOKENS:
        return None
    if re.match(r"^-?\d+(\.\d+)?$", trimmed):
        return None
    iso_match = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$", trimmed)
    if iso_match:
        y, m, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        if 2000 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"
    ym_match = re.match(r"^(\d{4})[-/](\d{1,2})$", trimmed)
    if ym_match:
        y, m = int(ym_match.group(1)), int(ym_match.group(2))
        if 2000 <= y <= 2100 and 1 <= m <= 12:
            return f"{y:04d}-{m:02d}-01"
    return None


METRIC_RULES: List[Dict[str, Any]] = [
    {
        "metric": "cost",
        "exact": {"cost", "total_cost", "unblended_cost", "line_item_unblended_cost", "blended_cost", "billing_amount", "cost_usd", "monthly_cost"},
        "patterns": [(r"(unblended_cost|blended_cost|total_cost|monthly_cost)", 0.96), (r"(^|_)(cost|spend|charge|billing|fee|price)(_|$)", 0.86)],
        "allowed_types": {"currency", "numeric"},
        "anti_patterns": [r"(unit_price|rate_per|savings|discount_pct)"],
    },
    {
        "metric": "cpu",
        "exact": {"cpu", "cpu_utilization", "cpu_usage", "cpu_pct", "cpu_percent", "avg_cpu"},
        "patterns": [(r"cpu_?(util|usage|pct|percent|load|avg)", 0.95), (r"(^|_)cpu($|_)", 0.88)],
        "allowed_types": {"percentage", "numeric"},
        "anti_patterns": [r"(vcpu_count|cpu_cores|cost)"],
    },
    {
        "metric": "ram",
        "exact": {"ram", "ram_utilization", "ram_usage", "memory_utilization", "memory_usage", "mem_pct"},
        "patterns": [(r"(ram|memory|mem)_?(util|usage|pct|percent|avg)", 0.95), (r"(^|_)(ram|memory|mem)($|_)", 0.84)],
        "allowed_types": {"percentage", "numeric"},
        "anti_patterns": [r"(cost|price|capacity_gb)"],
    },
    {
        "metric": "storage",
        "exact": {"storage", "storage_gb", "disk_gb", "ebs_gb", "volume_size", "disk_space_utilization"},
        "patterns": [(r"(storage|disk|volume|ebs|s3)_?(gb|tb|mb|size|used|usage|util|space)", 0.93)],
        "allowed_types": {"numeric", "percentage"},
        "anti_patterns": [r"(cost|price|iops)"],
    },
    {
        "metric": "usage",
        "exact": {"usage", "usage_amount", "line_item_usage_amount", "usage_quantity", "usage_hours"},
        "patterns": [(r"(line_item_)?usage_?(amount|quantity|qty|hours|units)", 0.95), (r"(^|_)(usage|hours|consumed)($|_)", 0.80)],
        "allowed_types": {"numeric"},
        "anti_patterns": [r"(cpu|ram|memory|storage|cost|date|type)"],
    },
    {
        "metric": "resource_id",
        "exact": {"resource_id", "line_item_resource_id", "instance_id", "volume_id", "resource_arn", "id"},
        "patterns": [(r"(resource|instance|vm|node|volume|cluster)_?(id|arn|name)", 0.94)],
        "allowed_types": {"identifier", "categorical"},
    },
    {
        "metric": "resource_type",
        "exact": {"resource_type", "instance_type", "product_instance_type", "line_item_usage_type", "usage_type"},
        "patterns": [(r"(instance|resource|machine|node|usage)_?type|sku|tier|flavor", 0.92)],
        "allowed_types": {"categorical", "identifier"},
    },
    {
        "metric": "service",
        "exact": {"service", "service_name", "product_name", "product_product_name", "line_item_product_code"},
        "patterns": [(r"(product_name|product_code|service_name|cloud_service|aws_service)", 0.95), (r"(^|_)(service|product)($|_)", 0.86)],
        "allowed_types": {"categorical"},
    },
    {
        "metric": "region",
        "exact": {"region", "aws_region", "availability_zone", "line_item_availability_zone", "product_region", "location"},
        "patterns": [(r"(aws_region|product_region|availability_zone|datacenter|region_name)", 0.95), (r"(^|_)(region|zone|location)($|_)", 0.85)],
        "allowed_types": {"categorical"},
    },
    {
        "metric": "date",
        "exact": {"date", "timestamp", "usage_start_date", "line_item_usage_start_date", "billing_date", "billing_period"},
        "patterns": [(r"(usage_start_date|billing_date|billing_period|record_date)", 0.96), (r"(^|_)(date|timestamp|day|period)($|_)", 0.86)],
        "allowed_types": {"datetime"},
    },
    {
        "metric": "uptime",
        "exact": {"uptime", "uptime_pct", "uptime_percent"},
        "patterns": [(r"uptime|active_hours_pct", 0.90)],
        "allowed_types": {"percentage", "numeric"},
    },
    {
        "metric": "iops",
        "exact": {"iops", "disk_iops", "volume_iops"},
        "patterns": [(r"iops", 0.94)],
        "allowed_types": {"numeric"},
    },
]


def _infer_column_type(values: List[str], header_norm: str) -> Tuple[str, int, int, List[float]]:
    non_null = 0
    missing = 0
    currency_hits = 0
    pct_hits = 0
    date_hits = 0
    nums: List[float] = []

    for raw in values:
        trimmed = raw.strip()
        if not trimmed or trimmed.lower() in NULL_TOKENS:
            missing += 1
            continue
        non_null += 1
        if any(sym in trimmed for sym in ("$", "€", "£", "₹")):
            currency_hits += 1
        if "%" in trimmed:
            pct_hits += 1
        if parse_date_candidate(trimmed) is not None:
            date_hits += 1
        val = parse_numeric_candidate(trimmed)
        if val is not None:
            nums.append(val)

    if non_null == 0:
        return ("empty", non_null, missing, nums)
    if date_hits / non_null >= 0.6:
        return ("datetime", non_null, missing, nums)
    if len(nums) / non_null >= 0.5:
        if currency_hits / non_null >= 0.25 or re.search(r"(cost|price|spend|charge|bill|fee)", header_norm):
            return ("currency", non_null, missing, nums)
        if pct_hits / non_null >= 0.25 or re.search(r"(pct|percent|ratio|utilization)", header_norm):
            return ("percentage", non_null, missing, nums)
        return ("numeric", non_null, missing, nums)

    unique_count = len({v.strip() for v in values if v.strip() and v.strip().lower() not in NULL_TOKENS})
    if re.search(r"(^|_)(id|arn|uuid|key)$", header_norm) or (unique_count / non_null > 0.85 and non_null > 3):
        return ("identifier", non_null, missing, nums)
    return ("categorical", non_null, missing, nums)


def detect_columns(df: pd.DataFrame) -> Dict[str, Any]:
    sample_df = df.head(500)
    detected_columns: List[Dict[str, Any]] = []
    ambiguous_columns: List[Dict[str, Any]] = []
    unmapped_columns: List[str] = []

    for header in df.columns:
        header_str = str(header)
        norm = normalize_header_name(header_str)
        values = sample_df[header].astype(str).tolist()
        data_type, non_null, missing, nums = _infer_column_type(values, norm)
        samples = [v.strip() for v in values if v.strip() and v.strip().lower() not in NULL_TOKENS][:3]

        candidates: List[Tuple[str, float]] = []
        for rule in METRIC_RULES:
            if data_type not in rule["allowed_types"]:
                continue
            if any(re.search(ap, norm) for ap in rule.get("anti_patterns", [])):
                continue

            score = 0.0
            if norm in rule["exact"]:
                score = 0.98
            else:
                for pat, w in rule["patterns"]:
                    if re.search(pat, norm):
                        score = max(score, w)

            if score > 0:
                if rule["metric"] in {"cpu", "ram", "uptime"} and nums and data_type != "percentage":
                    in_range = sum(1 for x in nums if 0 <= x <= 100.5) / len(nums)
                    if in_range < 0.5:
                        score *= 0.6
                candidates.append((rule["metric"], score))

        if not candidates and data_type in {"numeric", "currency"} and re.match(r"^(value|val|metric|amount|total|score|num|data)[_\d]*$", norm):
            ambiguous_columns.append(
                {
                    "original_name": header_str,
                    "candidate_metrics": ["cost"] if data_type == "currency" else ["cost", "usage", "cpu", "storage"],
                    "reason": f"Generic column header '{header_str}' cannot be confidently mapped without assuming intent.",
                    "data_type": data_type,
                }
            )

        candidates.sort(key=lambda x: x[1], reverse=True)
        mapped_metric = candidates[0][0] if candidates and candidates[0][1] >= 0.72 else None
        confidence = round(candidates[0][1], 2) if candidates else 0.0

        detected_columns.append(
            {
                "original_name": header_str,
                "mapped_metric": mapped_metric,
                "confidence": confidence,
                "data_type": data_type,
                "non_null_count": non_null,
                "missing_count": missing,
                "sample_values": samples,
            }
        )

    metric_to_header: Dict[str, str] = {}
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for col in detected_columns:
        m = col["mapped_metric"]
        if m:
            grouped.setdefault(m, []).append(col)

    for metric, cols in grouped.items():
        cols.sort(key=lambda c: c["confidence"], reverse=True)
        metric_to_header[metric] = cols[0]["original_name"]
        for extra in cols[1:]:
            extra["mapped_metric"] = None
            ambiguous_columns.append(
                {
                    "original_name": extra["original_name"],
                    "candidate_metrics": [metric],
                    "reason": f"Multiple columns matched '{metric}'; retained '{cols[0]['original_name']}' to prevent double counting.",
                    "data_type": extra["data_type"],
                }
            )

    ambiguous_names = {a["original_name"] for a in ambiguous_columns}
    for col in detected_columns:
        if not col["mapped_metric"] and col["original_name"] not in ambiguous_names:
            unmapped_columns.append(col["original_name"])

    return {
        "detected_columns": detected_columns,
        "ambiguous_columns": ambiguous_columns,
        "unmapped_columns": unmapped_columns,
        "metric_to_header": metric_to_header,
    }
