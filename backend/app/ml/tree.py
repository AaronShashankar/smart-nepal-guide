"""CART decision tree, written from scratch with NumPy (algorithm.md, core algorithm 1).

    Gini(S) = 1 - sum_i p_i^2                       (p_i = share of class i in S)
    gain    = Gini(parent) - (n_L/n) Gini(L) - (n_R/n) Gini(R)

At every node we try, for each feature, every threshold halfway between two neighbouring
distinct values, and keep the split with the largest Gini gain. A leaf stores its class counts:
the prediction is the majority class and the confidence is that class's share of the leaf.
"""

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, field

import numpy as np


def gini(labels: Sequence) -> float:
    """Gini impurity of a list of labels: 0 for a pure node, 0.5 for a 50/50 two-class node."""
    n = len(labels)
    if n == 0:
        return 0.0
    return 1.0 - sum((c / n) ** 2 for c in Counter(labels).values())


def _gini_from_counts(counts: np.ndarray) -> np.ndarray:
    """Gini for each row of a (rows, classes) count matrix."""
    n = counts.sum(axis=-1, keepdims=True)
    p = np.divide(counts, n, out=np.zeros_like(counts, dtype=float), where=n > 0)
    return 1.0 - (p**2).sum(axis=-1)


@dataclass
class Split:
    feature: int
    threshold: float
    gain: float


@dataclass
class Node:
    counts: np.ndarray  # samples of each class that reached this node
    feature: int | None = None  # None for a leaf
    threshold: float = 0.0
    gain: float = 0.0
    left: "Node | None" = None  # x[feature] <= threshold
    right: "Node | None" = None  # x[feature] >  threshold

    @property
    def is_leaf(self) -> bool:
        return self.feature is None


@dataclass(frozen=True)
class Condition:
    """One step of a decision path, e.g. max_daily_gain_m > 545.0"""

    feature: int
    op: str  # "<=" or ">"
    threshold: float

    def holds(self, x: Sequence[float]) -> bool:
        return (
            x[self.feature] <= self.threshold
            if self.op == "<="
            else (x[self.feature] > self.threshold)
        )


def best_split(
    X: np.ndarray, y: np.ndarray, n_classes: int, features: Sequence[int]
) -> Split | None:
    """The split with the largest Gini gain, or None if no split separates anything."""
    n = len(y)
    parent = gini(y.tolist())
    if n < 2:
        return None
    one_hot = np.eye(n_classes)[y]
    total = one_hot.sum(axis=0)
    best: Split | None = None
    for f in features:
        order = np.argsort(X[:, f], kind="stable")
        xs = X[order, f]
        left = np.cumsum(one_hot[order], axis=0)[:-1]  # class counts left of each gap
        right = total - left
        valid = xs[:-1] < xs[1:]  # only cut between two different values
        if not valid.any():
            continue
        n_left = np.arange(1, n)
        weighted = (n_left * _gini_from_counts(left) + (n - n_left) * _gini_from_counts(right)) / n
        weighted = np.where(valid, weighted, np.inf)
        i = int(np.argmin(weighted))
        gain = parent - weighted[i]
        if best is None or gain > best.gain + 1e-12:
            best = Split(feature=int(f), threshold=float((xs[i] + xs[i + 1]) / 2), gain=gain)
    return best if best is not None and best.gain > 1e-12 else None


@dataclass
class DecisionTree:
    max_depth: int = 6
    min_samples_split: int = 4
    max_features: int | None = None  # random feature subset per split (used by the forest)
    random_state: int | None = None
    n_classes: int | None = None
    root: Node | None = field(default=None, repr=False)
    n_features: int = 0

    # ------------------------------------------------------------- training
    def fit(self, X: np.ndarray, y: np.ndarray) -> "DecisionTree":
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=int)
        self.n_classes = self.n_classes or int(y.max()) + 1
        self.n_features = X.shape[1]
        self._rng = np.random.default_rng(self.random_state)
        self.root = self._build(X, y, depth=0)
        return self

    def _build(self, X: np.ndarray, y: np.ndarray, depth: int) -> Node:
        node = Node(counts=np.bincount(y, minlength=self.n_classes).astype(float))
        pure = np.count_nonzero(node.counts) <= 1
        if pure or depth >= self.max_depth or len(y) < self.min_samples_split:
            return node
        split = self._choose_split(X, y)
        if split is None:
            return node
        mask = X[:, split.feature] <= split.threshold
        node.feature, node.threshold, node.gain = split.feature, split.threshold, split.gain
        node.left = self._build(X[mask], y[mask], depth + 1)
        node.right = self._build(X[~mask], y[~mask], depth + 1)
        return node

    def _choose_split(self, X: np.ndarray, y: np.ndarray) -> Split | None:
        k = self.max_features
        if not k or k >= self.n_features:
            return best_split(X, y, self.n_classes, range(self.n_features))
        # Random forest: look at k random features. If none of them can split this node
        # (e.g. they are all constant here), keep drawing more, like scikit-learn does.
        order = self._rng.permutation(self.n_features)
        split = best_split(X, y, self.n_classes, order[:k])
        for f in order[k:]:
            if split is not None:
                break
            split = best_split(X, y, self.n_classes, [f])
        return split

    # ----------------------------------------------------------- prediction
    def _leaf(self, x: Sequence[float]) -> Node:
        node = self.root
        while not node.is_leaf:
            node = node.left if x[node.feature] <= node.threshold else node.right
        return node

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Share of each class in the leaf each row falls into."""
        rows = []
        for x in np.atleast_2d(X):
            counts = self._leaf(x).counts
            rows.append(counts / counts.sum())
        return np.array(rows)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.predict_proba(X).argmax(axis=1)

    def decision_path(self, x: Sequence[float]) -> list[Condition]:
        """The conditions checked on the way from the root to x's leaf."""
        path, node = [], self.root
        while not node.is_leaf:
            go_left = x[node.feature] <= node.threshold
            path.append(Condition(node.feature, "<=" if go_left else ">", node.threshold))
            node = node.left if go_left else node.right
        return path

    # ------------------------------------------------------------ reporting
    @property
    def feature_importances_(self) -> np.ndarray:
        """Total Gini gain per feature, weighted by the share of samples at the node."""
        imp = np.zeros(self.n_features)
        total = self.root.counts.sum()

        def walk(node: Node) -> None:
            if node.is_leaf:
                return
            imp[node.feature] += node.counts.sum() / total * node.gain
            walk(node.left)
            walk(node.right)

        walk(self.root)
        return imp / imp.sum() if imp.sum() else imp

    @property
    def depth(self) -> int:
        def d(node: Node) -> int:
            return 0 if node.is_leaf else 1 + max(d(node.left), d(node.right))

        return d(self.root)

    def __getstate__(self) -> dict:  # the random generator is only needed while training
        state = self.__dict__.copy()
        state.pop("_rng", None)
        return state
