import os
import warnings
from typing import Dict, Tuple, Optional

import mlflow
import mlflow.sklearn
import mlflow.prophet
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

from prophet.serialize import model_to_json, model_from_json

from ml.models.inference import (
    load_dataset,
    time_series_split,
    train_prophet,
    get_feature_pipeline,
    fit_prophet,
    infer_prophet,
    load_income_stats,
    income_from_standardized,
    plot_results,
    retrain_prophet,
)

warnings.filterwarnings("ignore")


class TrainingPipeline:

    def __init__(self, experiment_name: str = "arthya_income_prediction", tracking_uri: str = "http://localhost:5000"):
        """
        Initialize the training pipeline.

        Args:
            experiment_name: Name of the MLflow experiment
            tracking_uri: MLflow tracking server URI
        """
        self.experiment_name = experiment_name
        mlflow.set_experiment(experiment_name)
        mlflow.set_tracking_uri(tracking_uri)

    def train_model(
        self,
        userId: int,
        csv_path: str,
        test_size: float = 0.2,
        train_frac: float = 0.9,
        plot: bool = True,
        save_plot_path: Optional[str] = None,
    ) -> Dict:
        """
        Train a Prophet model with regressors for income prediction.

        Args:
            userId: User ID for model identification
            csv_path: Path to CSV file containing features
            test_size: Fraction of data to use for testing
            train_frac: Fraction of training data to use for actual training (rest for validation)
            plot: Whether to plot results
            save_plot_path: Path to save plots (optional)

        Returns:
            Dictionary containing training metrics and model info
        """
        with mlflow.start_run(run_name=f"user_{userId}_training"):
            try:
                # Log parameters
                mlflow.log_param("user_id", userId)
                mlflow.log_param("test_size", test_size)
                mlflow.log_param("train_frac", train_frac)
                mlflow.log_param("csv_path", csv_path)

                # Load and prepare data
                print(f"Loading dataset from {csv_path}...")
                feats = load_dataset(csv_path)
                mlflow.log_metric("total_samples", len(feats))

                # Split data
                train_df, test_df = time_series_split(feats, test_size=test_size)
                mlflow.log_metric("train_samples", len(train_df))
                mlflow.log_metric("test_samples", len(test_df))

                # Get feature pipeline
                feature_pipe, feat_names = get_feature_pipeline(feats)
                mlflow.log_param("feature_count", len(feat_names))
                mlflow.log_param("features", ",".join(feat_names))

                # Train model
                print(f"Training Prophet model for user {userId}...")
                prophet_model, mu_sigma = train_prophet(userId, feats, train_frac=train_frac)
                mu, sigma = mu_sigma
                mlflow.log_metric("income_mean", mu)
                mlflow.log_metric("income_std", sigma)

                # Evaluate on test set
                print("Evaluating model on test set...")
                reg_test_df = pd.DataFrame(
                    feature_pipe.transform(test_df[feat_names]),
                    columns=feat_names,
                    index=test_df.index,
                )

                forecast_test = infer_prophet(
                    f"../models/artifacts/modelUser_{userId}.json",
                    test_df,
                    reg_test_df,
                    feat_names,
                )

                mae = mean_absolute_error(test_df["y"], forecast_test["yhat"])
                rmse = np.sqrt(mean_squared_error(test_df["y"], forecast_test["yhat"]))

                mlflow.log_metric("test_mae", mae)
                mlflow.log_metric("test_rmse", rmse)

                print(f"Test MAE: {mae:.4f}, Test RMSE: {rmse:.4f}")

                # Log model
                model_artifact_path = f"../models/artifacts/modelUser_{userId}.json"
                mlflow.prophet.log_model(
                    prophet_model=prophet_model,
                    artifact_path=model_artifact_path,
                    metadata={
                        "userId": userId,
                        "income_mean": mu,
                        "income_std": sigma,
                        "test_mae": mae,
                        "test_rmse": rmse,
                    },
                )

                # Plot results if requested
                if plot:
                    plot_path = save_plot_path or f"models/user_{userId}_inference_plot.png"
                    results = {
                        "test_dates": test_df["ds"].values,
                        "test_actual": test_df["y"].values,
                        "prophet_predictions": forecast_test["yhat"].values,
                        "combined_predictions": forecast_test["yhat"].values,  # Can extend with LSTM later
                    }
                    plot_results(results, save_path=plot_path)
                    mlflow.log_artifact(plot_path)

                run_info = {
                    "user_id": userId,
                    "mae": mae,
                    "rmse": rmse,
                    "income_mean": mu,
                    "income_std": sigma,
                    "total_samples": len(feats),
                    "train_samples": len(train_df),
                    "test_samples": len(test_df),
                }

                print(f"Model training completed successfully for user {userId}")
                return run_info

            except Exception as e:
                print(f"Error during model training: {str(e)}")
                mlflow.log_param("error", str(e))
                raise

    def retrain_model(self, userId: int, csv_path: str, train_frac: float = 0.9) -> Dict:
        """
        Retrain an existing model with new data.

        Args:
            userId: User ID for model identification
            csv_path: Path to CSV file containing updated features
            train_frac: Fraction of data to use for training

        Returns:
            Dictionary containing retraining metrics
        """
        with mlflow.start_run(run_name=f"user_{userId}_retrain"):
            try:
                mlflow.log_param("user_id", userId)
                mlflow.log_param("csv_path", csv_path)
                mlflow.log_param("train_frac", train_frac)

                # Load data
                print(f"Loading updated dataset from {csv_path}...")
                feats = load_dataset(csv_path)
                mlflow.log_metric("total_samples", len(feats))

                # Retrain model
                print(f"Retraining Prophet model for user {userId}...")
                metrics = retrain_prophet(userId, feats, train_frac=train_frac)

                mlflow.log_metric("retrain_mae", metrics["mae"])
                mlflow.log_metric("retrain_rmse", metrics["rmse"])

                print(f"Retrain MAE: {metrics['mae']:.4f}, Retrain RMSE: {metrics['rmse']:.4f}")

                return metrics

            except Exception as e:
                print(f"Error during model retraining: {str(e)}")
                mlflow.log_param("error", str(e))
                raise

    def batch_train_models(self, user_data: Dict[int, str], **kwargs) -> Dict[int, Dict]:
        """
        Train models for multiple users in batch.

        Args:
            user_data: Dictionary mapping user_id to csv_path
            **kwargs: Additional arguments to pass to train_model

        Returns:
            Dictionary mapping user_id to training results
        """
        results = {}
        for user_id, csv_path in user_data.items():
            print(f"\n{'='*60}")
            print(f"Training model for user {user_id}...")
            print(f"{'='*60}")
            results[user_id] = self.train_model(user_id, csv_path, **kwargs)

        return results
