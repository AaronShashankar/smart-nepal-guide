"""Random forest built on our own DecisionTree (algorithm.md, core algorithm 1).

- Each tree is trained on a bootstrap sample (n rows drawn with replacement).
- Each split looks at a random subset of sqrt(n_features) features.
- Prediction is a majority vote; the confidence is the share of trees that voted for it.
"""

import math
from collections import Counter
from dataclasses import dataclass, field

import numpy as np

from app.ml.tree import Condition, DecisionTree


@dataclass
class RandomForest:
    n_trees: int = 50
    max_depth: int = 8
    min_samples_split: int = 4
    max_features: int | str = "sqrt"
    random_state: int | None = None
    n_classes: int | None = None
    trees: list[DecisionTree] = field(default_factory=list, repr=False)
    n_features: int = 0

    def fit(self, X: np.ndarray, y: np.ndarray) -> "RandomForest":
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=int)
        self.n_classes = self.n_classes or int(y.max()) + 1
        self.n_features = X.shape[1]
        k = (
            max(1, round(math.sqrt(self.n_features)))
            if self.max_features == "sqrt"
            else int(self.max_features)
        )
        rng = np.random.default_rng(self.random_state)
        self.trees = []
        for _ in range(self.n_trees):
            rows = rng.integers(0, len(y), len(y))  # bootstrap sample
            tree = DecisionTree(
                max_depth=self.max_depth,
                min_samples_split=self.min_samples_split,
                max_features=k,
                random_state=int(rng.integers(2**31)),
                n_classes=self.n_classes,
            )
            self.trees.append(tree.fit(X[rows], y[rows]))
        return self

    def votes(self, X: np.ndarray) -> np.ndarray:
        """(rows, trees) matrix of each tree's predicted class."""
        return np.stack([t.predict(X) for t in self.trees], axis=1)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Share of the votes for each class."""
        v = self.votes(np.atleast_2d(X))
        return np.stack([(v == c).mean(axis=1) for c in range(self.n_classes)], axis=1)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.predict_proba(X).argmax(axis=1)

    def winning_paths(self, x: np.ndarray) -> list[list[Condition]]:
        """Decision paths of the trees that voted for the forest's answer (for 'Why?').

        `x` is one input row (1-D, or a 2-D array with one row)."""
        row = np.atleast_2d(np.asarray(x, dtype=float))[0]
        winner = int(self.predict(row)[0])
        return [t.decision_path(row) for t in self.trees if int(t.predict(row)[0]) == winner]

    def decision_path(self, x: np.ndarray) -> list[Condition]:
        """The most common conditions among the winning trees (most frequent first)."""
        counts = Counter(c for path in self.winning_paths(x) for c in path)
        return [c for c, _ in counts.most_common()]

    @property
    def feature_importances_(self) -> np.ndarray:
        return np.mean([t.feature_importances_ for t in self.trees], axis=0)
