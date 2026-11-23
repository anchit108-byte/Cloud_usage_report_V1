import type { AnalyticsResult, MlModelStatus } from '../types/cloud';

/**
 * Interface mirroring `cloud_optimizer/backend/ml_model.py`.
 * Reserves Linear Regression for cost forecasting when sufficient historical
 * periods and a trained model artifact exist. Never fabricates predictions.
 */
export const MINIMUM_HISTORICAL_PERIODS = 6;

export function evaluateMlForecastAvailability(analytics: AnalyticsResult): MlModelStatus {
  const historicalPeriodsAvailable = analytics.usageTrends.filter((t) => t.cost !== null).length;

  return {
    moduleName: 'ml_model.py (Scikit-learn LinearRegression Interface)',
    algorithm: 'Linear Regression (sklearn.linear_model.LinearRegression)',
    trainedModelAvailable: false,
    forecastingAvailable: false,
    message:
      historicalPeriodsAvailable < MINIMUM_HISTORICAL_PERIODS
        ? `Cost forecasting unavailable: no trained Linear Regression model is loaded and only ${historicalPeriodsAvailable} dated billing period(s) exist (minimum ${MINIMUM_HISTORICAL_PERIODS} required for future training). Non-ML statistical analysis and rule-based optimization continue below.`
        : `Cost forecasting unavailable: ${historicalPeriodsAvailable} billing periods detected, but no trained Linear Regression model artifact is loaded in ml_model.py yet. Non-ML analysis continues normally.`,
    historicalPeriodsAvailable,
    minimumPeriodsRequired: MINIMUM_HISTORICAL_PERIODS,
    forecasts: null,
    evaluationMetrics: null,
  };
}
