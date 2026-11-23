from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel


class DetectedColumn(BaseModel):
    original_name: str
    mapped_metric: Optional[str] = None
    confidence: float
    data_type: str
    non_null_count: int
    missing_count: int
    sample_values: List[str] = []


class AmbiguousColumn(BaseModel):
    original_name: str
    candidate_metrics: List[str]
    reason: str
    data_type: str


class ValidationSummary(BaseModel):
    valid: bool
    errors: List[str]
    warnings: List[str]
    row_count: int
    column_count: int
    headers: List[str]
    file_hash: str


class CleaningSummary(BaseModel):
    total_raw_rows: int
    cleaned_row_count: int
    dropped_empty_rows: int
    duplicate_rows_removed: int
    invalid_values_coerced: Dict[str, int]
    missing_values_by_column: Dict[str, int]


class RecommendationItem(BaseModel):
    id: str
    classification: Literal["CONTINUE", "OPTIMIZE", "DISCONTINUE"]
    resource_id: str
    service: Optional[str] = None
    region: Optional[str] = None
    reason: str
    supporting_metrics: Dict[str, Any]
    suggested_action: str
    estimated_monthly_savings: Optional[float] = None
    savings_basis: str


class MLForecastStatus(BaseModel):
    module_name: str
    algorithm: str
    trained_model_available: bool
    forecasting_available: bool
    message: str
    historical_periods_available: int
    minimum_periods_required: int
    forecasts: Optional[List[Dict[str, Any]]] = None
    evaluation_metrics: Optional[Dict[str, Optional[float]]] = None


class OptimizationReport(BaseModel):
    id: str
    upload_id: str
    filename: str
    created_at: str
    title: str
    validation: ValidationSummary
    cleaning: CleaningSummary
    detected_columns: List[DetectedColumn]
    ambiguous_columns: List[AmbiguousColumn]
    unmapped_columns: List[str]
    analytics: Dict[str, Any]
    ml_status: MLForecastStatus
    findings: List[str]
    recommendations: List[RecommendationItem]
    recommendation_summary: Dict[str, Any]
