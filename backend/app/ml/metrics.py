"""Evaluation helpers written by hand (scikit-learn is used only to compare against)."""

from dataclasses import dataclass

import numpy as np


def stratified_split(
    y: np.ndarray, test_size: float = 0.2, seed: int = 42
) -> tuple[np.ndarray, np.ndarray]:
    """Row indices (train, test); every class keeps the same share in both parts."""
    rng = np.random.default_rng(seed)
    train, test = [], []
    for c in np.unique(y):
        idx = rng.permutation(np.flatnonzero(y == c))
        n_test = round(len(idx) * test_size)
        test.extend(idx[:n_test])
        train.extend(idx[n_test:])
    return np.sort(train), np.sort(test)


def stratified_folds(y: np.ndarray, k: int = 5, seed: int = 42) -> list[np.ndarray]:
    """k lists of row indices; each class is spread evenly over the folds."""
    rng = np.random.default_rng(seed)
    folds: list[list[int]] = [[] for _ in range(k)]
    for c in np.unique(y):
        for i, row in enumerate(rng.permutation(np.flatnonzero(y == c))):
            folds[i % k].append(row)
    return [np.sort(f) for f in folds]


def confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, n_classes: int) -> np.ndarray:
    """cm[i, j] = rows whose true class is i and predicted class is j."""
    cm = np.zeros((n_classes, n_classes), dtype=int)
    for t, p in zip(y_true, y_pred, strict=True):
        cm[t, p] += 1
    return cm


@dataclass
class Report:
    accuracy: float
    precision: list[float]
    recall: list[float]
    f1: list[float]
    support: list[int]
    confusion: list[list[int]]

    @property
    def macro_f1(self) -> float:
        return float(np.mean(self.f1))

    def as_dict(self) -> dict:
        return {**self.__dict__, "macro_f1": self.macro_f1}


def evaluate(y_true: np.ndarray, y_pred: np.ndarray, n_classes: int) -> Report:
    cm = confusion_matrix(y_true, y_pred, n_classes)
    tp = np.diag(cm).astype(float)
    predicted, actual = cm.sum(axis=0), cm.sum(axis=1)
    precision = np.divide(tp, predicted, out=np.zeros_like(tp), where=predicted > 0)
    recall = np.divide(tp, actual, out=np.zeros_like(tp), where=actual > 0)
    denom = precision + recall
    f1 = np.divide(2 * precision * recall, denom, out=np.zeros_like(tp), where=denom > 0)
    return Report(
        accuracy=float(tp.sum() / cm.sum()),
        precision=precision.round(4).tolist(),
        recall=recall.round(4).tolist(),
        f1=f1.round(4).tolist(),
        support=actual.tolist(),
        confusion=cm.tolist(),
    )
