import os
import warnings
from typing import Tuple, List, Dict

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OrdinalEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error

from prophet import Prophet
from prophet.serialize import model_to_json, model_from_json
import joblib

warnings.filterwarnings("ignore")

def warm_start_params(m):
    # Taken Directly from Prophet source code to enable warm starting.
    res = {}
    for pname in ['k', 'm', 'sigma_obs']:
        if m.mcmc_samples == 0:
            res[pname] = m.params[pname][0][0]
        else:
            res[pname] = np.mean(m.params[pname])
    for pname in ['delta', 'beta']:
        if m.mcmc_samples == 0:
            res[pname] = m.params[pname][0]
        else:
            res[pname] = np.mean(m.params[pname], axis=0)
    return res

def load_dataset(csv_path: str) -> pd.DataFrame:
	df = pd.read_csv(csv_path)
	if "ds" not in df.columns or "y" not in df.columns:
		raise ValueError("Input CSV must contain 'ds' and 'y' columns")
	df["ds"] = pd.to_datetime(df["ds"], errors="coerce")
	df = df.sort_values("ds").reset_index(drop=True)
	df = df.dropna(subset=["ds", "y"])  # ensure target/date exist
	df = df.fillna(0)
	return df


def time_series_split(df: pd.DataFrame, test_size: float = 0.5) -> Tuple[pd.DataFrame, pd.DataFrame]:
	n = len(df)
	split_idx = int(n * (1 - test_size))
	train_df = df.iloc[:split_idx].copy()
	test_df = df.iloc[split_idx:].copy()
	return train_df, test_df


def fit_prophet(train_df: pd.DataFrame, regressor_df: pd.DataFrame, feature_names: List[str], prev_Model: Prophet | None = None) -> Prophet:
	m = Prophet()
	safe_feature_names = [name for name in feature_names if name not in ['ds', 'y', 'cap', 'floor']]
	for name in safe_feature_names:
		m.add_regressor(name)
	train_for_prophet = pd.DataFrame({
		"ds": train_df["ds"].values,
		"y": train_df["y"].values,
		**{name: regressor_df[name].values for name in safe_feature_names},
	})
	
	if prev_Model is not None:
		m.fit(train_for_prophet, init=warm_start_params(prev_Model))
	else:
		m.fit(train_for_prophet)
	
	return m

def get_feature_pipeline(feats: pd.DataFrame) -> Tuple[sklearn.pipeline.Pipeline, List[str]]:
	feat_cols = [c for c in feats.columns if c not in ["ds", "y"]] 
	cat_cols = [c for c in feat_cols if feats[c].dtype == "object"]
	num_cols = [c for c in feat_cols if c not in cat_cols]
	
	transformer = ColumnTransformer([
			("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
			("num", "passthrough", num_cols),
		])
	feature_pipe = Pipeline([("transform", transformer)])
	feat_names = cat_cols + num_cols
	return feature_pipe, feat_names

def infer_prophet(model_path: str, df: pd.DataFrame, regressor_df: pd.DataFrame, feature_names: List[str]) -> pd.DataFrame:
	m: Prophet | None = None
	with open(model_path, "r") as f:
		m = model_from_json(f.read())

	safe_feature_names = [name for name in feature_names if name not in ['ds', 'y', 'cap', 'floor']]
	future = pd.DataFrame({
		"ds": df["ds"].values,
		**{name: regressor_df[name].values for name in safe_feature_names},
	})
	forecast = m.predict(future)
	return forecast

def retrain_prophet(userId: int, feats: pd.DataFrame, train_frac: float = 0.9) -> Tuple[float, float]:
	m: Prophet | None = None
	with open(f"../models/artifacts/model_user_{userId}.json", "r") as f:
		m = model_from_json(f.read())

	feats = feats.sort_values('ds').reset_index(drop=True)

	if 'Income_Total' not in feats.columns:
		raise ValueError("'Income_Total' is required in features for standardization stats")

	mu = float(feats['Income_Total'].mean())
	# population std to match extract_features default
	sigma = float(feats['Income_Total'].std(ddof=0)) or 1.0
	_mu_sigma = (mu, sigma)

	if 'y' not in feats.columns:
		feats['y'] = (feats['Income_Total'] - mu) / sigma

	split_idx = max(1, int(len(feats) * train_frac))
	train_df = feats.iloc[:split_idx].copy()
	val_df = feats.iloc[split_idx:].copy() if split_idx < len(feats) else None

	# Instantiate a fresh, unfitted feature pipeline from current features
	feature_pipe, feat_names = get_feature_pipeline(feats)

	# Fit the pipeline on training data and transform
	feature_pipe.fit(train_df[feat_names])
	reg_train_df = pd.DataFrame(
		feature_pipe.transform(train_df[feat_names]),
		columns=feat_names,
		index=train_df.index,
	)

	# Train Prophet with regressors on train set
	prophet_model = fit_prophet(train_df, reg_train_df, feat_names, m)
	
	forecast_train = prophet_model.predict(train_df[['ds'] + feat_names])
	prophet_model.plot_components(forecast_train)

	mae = mean_absolute_error(train_df['y'], forecast_train['yhat'])
	rmse = np.sqrt(mean_squared_error(train_df['y'], forecast_train['yhat']))

	return {
		"mae": mae,
		"rmse": rmse
	}

def create_residual_sequences(residuals: np.ndarray, regressors: np.ndarray, seq_len: int = 30) -> Tuple[np.ndarray, np.ndarray]:
	X, y = [], []
	combined_features = np.concatenate([residuals.reshape(-1, 1), regressors], axis=1)
	
	for i in range(seq_len, len(residuals)):
		X.append(combined_features[i - seq_len:i])
		y.append(residuals[i])
	return np.array(X), np.array(y)

def load_income_stats(stats_csv: str = "worker_c_hybrid.csv", income_col: str = "Income_Total") -> Tuple[float, float]:
    """
    Read stats CSV and return mean (mu) and std (sigma) of Income_Total.
    """
    if not os.path.exists(stats_csv):
        raise FileNotFoundError(f"Stats CSV not found: {stats_csv}")
    df_stats = pd.read_csv(stats_csv)
    if income_col not in df_stats.columns:
        raise ValueError(f"Column '{income_col}' not found in {stats_csv}")
    series = df_stats[income_col].dropna()
    mu = float(series.mean())
    # std() uses sample std (ddof=1) by default; change ddof=0 if you want population std.
    sigma = float(series.std())
    return mu, sigma

def income_from_standardized(pred_y: np.ndarray, mu: float, sigma: float) -> np.ndarray:
    """
    Map standardized predictions y_pred back to income space: income = y_pred * sigma + mu
    """
    return round(pred_y * sigma + mu, -1)

def plot_results(results: Dict[str, np.ndarray], save_path: str = 'models/inference_half_plot.png') -> None:
	dates = results['test_dates']
	actual = results['test_actual']
	prophet_pred = results['prophet_predictions']
	combined_pred = results['combined_predictions']

	fig, axes = plt.subplots(2, 1, figsize=(14, 10))

	axes[0].plot(dates, actual, label='Actual', color='black', linewidth=2, marker='o', markersize=4)
	axes[0].plot(dates, prophet_pred, label='Prophet', color='blue', linestyle='--', linewidth=1.5)
	axes[0].plot(dates, combined_pred, label='Prophet+LSTM', color='red', linewidth=1.5)
	axes[0].set_title('Forecast Comparison (Test Half of features_c.csv)')
	axes[0].set_xlabel('Date')
	axes[0].set_ylabel('y')
	axes[0].legend()
	axes[0].grid(alpha=0.3)
	axes[0].tick_params(axis='x', rotation=45)

	prophet_residuals = actual - prophet_pred
	combined_residuals = actual - combined_pred
	axes[1].plot(dates, prophet_residuals, label='Prophet Residuals', color='blue', linewidth=1.5)
	axes[1].plot(dates, combined_residuals, label='Prophet+LSTM Residuals', color='red', linewidth=1.5)
	axes[1].axhline(0, color='black', linewidth=0.8)
	axes[1].set_title('Residual Comparison')
	axes[1].set_xlabel('Date')
	axes[1].set_ylabel('Residual')
	axes[1].legend()
	axes[1].grid(alpha=0.3)
	axes[1].tick_params(axis='x', rotation=45)

	plt.tight_layout()
	os.makedirs(os.path.dirname(save_path), exist_ok=True)
	plt.savefig(save_path, dpi=150, bbox_inches='tight')
	print(f"Plot saved to: {save_path}")
	plt.show()

def train_prophet(userId: int, feats: pd.DataFrame, train_frac: float = 0.9) -> Tuple[Prophet, Tuple[float, float]]:
	feats = feats.sort_values('ds').reset_index(drop=True)

	if 'Income_Total' not in feats.columns:
		raise ValueError("'Income_Total' is required in features for standardization stats")

	mu = float(feats['Income_Total'].mean())
	# population std to match extract_features default
	sigma = float(feats['Income_Total'].std(ddof=0)) or 1.0
	_mu_sigma = (mu, sigma)

	if 'y' not in feats.columns:
		feats['y'] = (feats['Income_Total'] - mu) / sigma

	split_idx = max(1, int(len(feats) * train_frac))
	train_df = feats.iloc[:split_idx].copy()
	val_df = feats.iloc[split_idx:].copy() if split_idx < len(feats) else None

	# Instantiate a fresh, unfitted feature pipeline from current features
	feature_pipe, feat_names = get_feature_pipeline(feats)

	# Fit the pipeline on training data and transform
	feature_pipe.fit(train_df[feat_names])
	reg_train_df = pd.DataFrame(
		feature_pipe.transform(train_df[feat_names]),
		columns=feat_names,
		index=train_df.index,
	)

	_prophet_model = fit_prophet(train_df, reg_train_df, feat_names)

	with open(f'../models/artifacts/modelUser_{userId}.json', 'wb') as f:
		f.write(model_to_json(_prophet_model))

	return (_prophet_model, _mu_sigma)
