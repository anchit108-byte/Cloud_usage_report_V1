"""
Dedicated Machine Learning Module (`ml_model.py`).

Kept separate from the rest of the application so Scikit-learn Linear Regression
models can be trained, evaluated, and versioned over time on real accumulated
historical billing records.

IMPORTANT:
- Never trains on fabricated or hardcoded data.
- Never generates artificial cost forecasts when no trained model is available.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.linear_model import LinearRegression

MINIMUM_HISTORICAL_PERIODS = 6
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "cost_forecast_lr.joblib"


def is_trained_model_available(model_path: Path = DEFAULT_MODEL_PATH) -> bool:
    """Check whether a serialized, genuinely trained Linear Regression model exists."""
    return model_path.exists() and model_path.is_file()


def train_cost_forecast_model(
    historical_monthly_records: List[Dict[str, Any]],
    model_output_path: Path = DEFAULT_MODEL_PATH,
) -> Dict[str, Any]:
    """
    Interface for future Linear Regression training on accumulated real SQLite billing history.

    TODO:
    1. Validate that `historical_monthly_records` contains >= MINIMUM_HISTORICAL_PERIODS
       consecutive monthly observations with real `cost` values.
    2. Engineer temporal features (e.g., period_index, seasonal month encodings, usage lag).
    3. Split into chronological train/validation windows (never random shuffle on time-series).
    4. Fit `sklearn.linear_model.LinearRegression()` on training split.
    5. Evaluate with `evaluate_cost_model()` and persist artifact via `joblib.dump()`.
    """
    _ = LinearRegression  # Reserved Scikit-learn estimator for future training implementation
    _ = np
    _ = model_output_path

    if len(historical_monthly_records) < MINIMUM_HISTORICAL_PERIODS:
        return {
            "trained": False,
            "reason": (
                f"Insufficient real historical periods ({len(historical_monthly_records)} "
                f"available, {MINIMUM_HISTORICAL_PERIODS} minimum required)."
            ),
        }

    return {
        "trained": False,
        "reason": "Training pipeline TODO not yet implemented; refusing to create a fake model.",
    }


def predict_cost_forecast(
    future_periods: int = 3,
    model_path: Path = DEFAULT_MODEL_PATH,
) -> Optional[List[Dict[str, Any]]]:
    """
    Interface for future cost forecasting using a trained Linear Regression model.

    TODO:
    1. Load trained LinearRegression artifact from `model_path` using `joblib.load()`.
    2. Construct feature matrix X_future for the next `future_periods` months.
    3. Return model.predict(X_future) with confidence bounds.

    Returns None when no trained model is available so callers never show fake predictions.
    """
    _ = future_periods
    if not is_trained_model_available(model_path):
        return None
    return None


def evaluate_cost_model(
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> Dict[str, Optional[float]]:
    """
    Interface for model evaluation (R2, MAE, RMSE) once a real trained model exists.

    TODO:
    - Import `r2_score`, `mean_absolute_error`, `root_mean_squared_error` from `sklearn.metrics`
      and compute metrics on held-out historical billing periods.
    """
    _ = (y_true, y_pred)
    return {"r2_score": None, "mae": None, "rmse": None}


def get_ml_status(historical_periods_available: int) -> Dict[str, Any]:
    """
    Report honest ML forecasting availability for the optimization report.
    """
    trained_available = is_trained_model_available()
    forecasts = predict_cost_forecast() if trained_available else None

    if not trained_available:
        if historical_periods_available < MINIMUM_HISTORICAL_PERIODS:
            message = (
                f"Cost forecasting unavailable: no trained Linear Regression model is loaded and only "
                f"{historical_periods_available} dated billing period(s) exist "
                f"(minimum {MINIMUM_HISTORICAL_PERIODS} required for future training). "
                "Non-ML statistical analysis continues normally."
            )
        else:
            message = (
                f"Cost forecasting unavailable: {historical_periods_available} historical billing periods "
                "detected, but no trained Linear Regression model artifact exists in ml_model.py yet."
            )
    else:
        message = "Trained Linear Regression forecasting model active."

    return {
        "module_name": "ml_model.py (Scikit-learn LinearRegression Interface)",
        "algorithm": "Linear Regression (sklearn.linear_model.LinearRegression)",
        "trained_model_available": trained_available,
        "forecasting_available": trained_available and forecasts is not None,
        "message": message,
        "historical_periods_available": historical_periods_available,
        "minimum_periods_required": MINIMUM_HISTORICAL_PERIODS,
        "forecasts": forecasts,
        "evaluation_metrics": None,
    }
