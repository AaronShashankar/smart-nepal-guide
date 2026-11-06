"""Train, evaluate and register the risk model.

    uv run python -m app.ml.train            # tree + forest, activates the better one
    uv run python -m app.ml.train --trees 25 # smaller forest

Steps:
1. read training_sample from the database (load it with `python -m app.seed`)
2. stratified 80/20 split with a fixed seed
3. choose the tree's max_depth (3-8) by 5-fold cross-validation on the training part
4. train our DecisionTree and RandomForest, evaluate both on the test part
5. save each with joblib to backend/models/, insert ml_model rows, and mark the one with the
   higher macro F1 as active (the API picks it up on the next request)
6. write the numbers to docs/ml/metrics.json (used by app.ml.evaluate and the report)
"""

import argparse
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import joblib
import numpy as np
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.ml.features import FEATURES, LABELS, Sample, encode_many, label_index
from app.ml.forest import RandomForest
from app.ml.metrics import Report, evaluate, stratified_folds, stratified_split
from app.ml.tree import DecisionTree
from app.models import MlModel, TrainingSample
from app.models.enums import MlAlgorithm

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODELS_DIR = BACKEND_DIR / "models"
METRICS_FILE = BACKEND_DIR.parent / "docs" / "ml" / "metrics.json"
SEED = 42
DEPTHS = range(3, 9)


@dataclass
class Dataset:
    X: np.ndarray
    y: np.ndarray
    samples: list[Sample]
    sources: list[str]


def load_dataset(db: Session) -> Dataset:
    rows = db.scalars(select(TrainingSample).order_by(TrainingSample.id)).all()  # stable order
    if not rows:
        raise SystemExit("training_sample is empty: run `uv run python -m app.seed` first")
    samples = [
        Sample(
            max_altitude_m=r.max_altitude_m,
            max_daily_gain_m=r.max_daily_gain_m,
            total_days=r.total_days,
            distance_per_day_km=float(r.distance_per_day_km),
            month=r.month,
            age=r.age,
            fitness_level=r.fitness_level.value,
            trek_experience=r.trek_experience.value,
            has_health_issue=r.has_health_issue,
        )
        for r in rows
    ]
    y = np.array([label_index(r.label.value) for r in rows])
    return Dataset(encode_many(samples), y, samples, [r.source for r in rows])


def cross_validate_depth(X: np.ndarray, y: np.ndarray, k: int = 5) -> dict[int, float]:
    """Mean validation accuracy of a DecisionTree for each max_depth."""
    folds = stratified_folds(y, k, SEED)
    scores = {}
    for depth in DEPTHS:
        accs = []
        for i in range(k):
            val = folds[i]
            train = np.concatenate([f for j, f in enumerate(folds) if j != i])
            tree = DecisionTree(max_depth=depth, n_classes=len(LABELS)).fit(X[train], y[train])
            accs.append(float((tree.predict(X[val]) == y[val]).mean()))
        scores[depth] = round(float(np.mean(accs)), 4)
    return scores


@dataclass
class TrainResult:
    tree: DecisionTree
    forest: RandomForest
    tree_report: Report
    forest_report: Report
    cv_scores: dict[int, float]
    best_depth: int
    train_idx: np.ndarray
    test_idx: np.ndarray


def train(data: Dataset, n_trees: int = 50) -> TrainResult:
    train_idx, test_idx = stratified_split(data.y, 0.2, SEED)
    Xtr, ytr, Xte, yte = data.X[train_idx], data.y[train_idx], data.X[test_idx], data.y[test_idx]
    cv = cross_validate_depth(Xtr, ytr)
    best_depth = max(cv, key=lambda d: (cv[d], -d))  # best score; the shallower on a tie
    tree = DecisionTree(max_depth=best_depth, n_classes=len(LABELS)).fit(Xtr, ytr)
    forest = RandomForest(
        n_trees=n_trees, max_depth=8, random_state=SEED, n_classes=len(LABELS)
    ).fit(Xtr, ytr)
    k = len(LABELS)
    return TrainResult(
        tree,
        forest,
        evaluate(yte, tree.predict(Xte), k),
        evaluate(yte, forest.predict(Xte), k),
        cv,
        best_depth,
        train_idx,
        test_idx,
    )


def register(
    db: Session,
    model,
    algorithm: MlAlgorithm,
    report: Report,
    version: str,
    models_dir: Path = MODELS_DIR,
) -> MlModel:
    models_dir.mkdir(parents=True, exist_ok=True)
    path = models_dir / f"{algorithm.value}-{version}.joblib"
    joblib.dump(model, path)
    row = MlModel(
        version=version,
        algorithm=algorithm,
        accuracy=Decimal(f"{report.accuracy:.4f}"),
        f1_score=Decimal(f"{report.macro_f1:.4f}"),
        is_active=False,
        # relative to backend/ when possible, so the database row works on any machine
        file_path=str(path.relative_to(BACKEND_DIR))
        if path.is_relative_to(BACKEND_DIR)
        else str(path),
    )
    db.add(row)
    db.flush()
    return row


def activate(db: Session, model: MlModel) -> None:
    db.execute(update(MlModel).where(MlModel.is_active).values(is_active=False))
    db.flush()
    model.is_active = True


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--trees", type=int, default=50)
    args = parser.parse_args()

    version = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    with SessionLocal() as db, db.begin():
        data = load_dataset(db)
        result = train(data, args.trees)
        tree_row = register(db, result.tree, MlAlgorithm.decision_tree, result.tree_report, version)
        forest_row = register(
            db, result.forest, MlAlgorithm.random_forest, result.forest_report, version
        )
        best = (
            forest_row if result.forest_report.macro_f1 >= result.tree_report.macro_f1 else tree_row
        )
        activate(db, best)

    METRICS_FILE.parent.mkdir(parents=True, exist_ok=True)
    METRICS_FILE.write_text(
        json.dumps(
            {
                "version": version,
                "labels": LABELS,
                "features": FEATURES,
                "rows": {
                    "total": len(data.y),
                    "train": len(result.train_idx),
                    "test": len(result.test_idx),
                    "by_source": {s: data.sources.count(s) for s in sorted(set(data.sources))},
                },
                "cv_accuracy_by_depth": result.cv_scores,
                "tree": {"max_depth": result.best_depth, **result.tree_report.as_dict()},
                "forest": {"n_trees": args.trees, **result.forest_report.as_dict()},
                "active": best.algorithm.value,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"{len(data.y)} rows: train {len(result.train_idx)}, test {len(result.test_idx)}")
    print("5-fold CV accuracy by depth:", result.cv_scores, "-> depth", result.best_depth)
    for name, r in (("Decision tree", result.tree_report), ("Random forest", result.forest_report)):
        print(f"{name:14s} accuracy {r.accuracy:.3f}  macro F1 {r.macro_f1:.3f}")
    print(f"Active model: {best.algorithm.value} {version} ({best.file_path})")
    print(f"Metrics: {METRICS_FILE}")


if __name__ == "__main__":
    main()
