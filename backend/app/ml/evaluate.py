"""Figures and tables for the report and the defense (saved in docs/ml/).

    uv run python -m app.ml.evaluate

Uses the same stratified 80/20 split (seed 42) and settings as app.ml.train, and compares:
our DecisionTree, our RandomForest, scikit-learn's DecisionTreeClassifier and
RandomForestClassifier. ml/evaluation.ipynb runs this and shows the results.

Output:
  comparison.md / comparison.csv   accuracy, macro precision / recall / F1, per-class F1
  confusion_<model>.png            confusion matrices (rows = true level, columns = predicted)
  feature_importance.png           total Gini gain per feature (our forest vs scikit-learn's)
  cv_depth.png                     5-fold cross-validation accuracy for max_depth 3-8
  data_sources.png                 rows per label and source (agency / survey / rule)
"""

import csv
from dataclasses import dataclass
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # files only, no window
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from sklearn.ensemble import RandomForestClassifier  # noqa: E402
from sklearn.tree import DecisionTreeClassifier  # noqa: E402

from app.core.db import SessionLocal  # noqa: E402
from app.ml.features import FEATURES, LABELS  # noqa: E402
from app.ml.forest import RandomForest  # noqa: E402
from app.ml.metrics import Report, evaluate, stratified_split  # noqa: E402
from app.ml.train import SEED, cross_validate_depth, load_dataset  # noqa: E402
from app.ml.tree import DecisionTree  # noqa: E402

OUT_DIR = Path(__file__).resolve().parents[3] / "docs" / "ml"
N_TREES = 50
FOREST_DEPTH = 8


@dataclass
class Result:
    name: str
    report: Report
    importances: np.ndarray


def run(out_dir: Path = OUT_DIR) -> list[Result]:
    out_dir.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        data = load_dataset(db)
    train, test = stratified_split(data.y, 0.2, SEED)
    Xtr, ytr, Xte, yte = data.X[train], data.y[train], data.X[test], data.y[test]
    cv = cross_validate_depth(Xtr, ytr)
    depth = max(cv, key=lambda d: (cv[d], -d))
    k = len(LABELS)

    models = {
        "Our decision tree": DecisionTree(max_depth=depth, n_classes=k),
        "Our random forest": RandomForest(
            n_trees=N_TREES, max_depth=FOREST_DEPTH, random_state=SEED, n_classes=k
        ),
        "scikit-learn decision tree": DecisionTreeClassifier(max_depth=depth, random_state=SEED),
        "scikit-learn random forest": RandomForestClassifier(
            n_estimators=N_TREES, max_depth=FOREST_DEPTH, max_features=3, random_state=SEED
        ),
    }
    results = []
    for name, model in models.items():
        model.fit(Xtr, ytr)
        report = evaluate(yte, np.asarray(model.predict(Xte), dtype=int), k)
        results.append(Result(name, report, np.asarray(model.feature_importances_)))

    _comparison_table(results, out_dir, depth)
    for r in results:
        _confusion_png(r, out_dir)
    _importance_png(results, out_dir)
    _cv_png(cv, depth, out_dir)
    _sources_png(data.y, data.sources, out_dir)
    return results


def _slug(name: str) -> str:
    return name.lower().replace("scikit-learn", "sklearn").replace(" ", "_")


def _comparison_table(results: list[Result], out_dir: Path, depth: int) -> None:
    header = ["Model", "Accuracy", "Precision (macro)", "Recall (macro)", "F1 (macro)"]
    header += [f"F1 {label}" for label in LABELS]
    rows = [
        [
            r.name,
            f"{r.report.accuracy:.3f}",
            f"{np.mean(r.report.precision):.3f}",
            f"{np.mean(r.report.recall):.3f}",
            f"{r.report.macro_f1:.3f}",
            *(f"{f:.3f}" for f in r.report.f1),
        ]
        for r in results
    ]
    with (out_dir / "comparison.csv").open("w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows([header, *rows])
    lines = [
        f"Test set: {sum(results[0].report.support)} rows (stratified 20%, seed {SEED}). "
        f"Tree max_depth = {depth} (5-fold CV); forests: {N_TREES} trees, max_depth "
        f"{FOREST_DEPTH}, 3 features per split.",
        "",
        "| " + " | ".join(header) + " |",
        "|" + "---|" * len(header),
        *("| " + " | ".join(r) + " |" for r in rows),
    ]
    (out_dir / "comparison.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def _confusion_png(r: Result, out_dir: Path) -> None:
    cm = np.array(r.report.confusion)
    fig, ax = plt.subplots(figsize=(4.6, 4))
    ax.imshow(cm, cmap="Blues")
    for i in range(len(LABELS)):
        for j in range(len(LABELS)):
            color = "white" if cm[i, j] > cm.max() / 2 else "black"
            ax.text(j, i, cm[i, j], ha="center", va="center", color=color)
    ax.set_xticks(range(len(LABELS)), LABELS)
    ax.set_yticks(range(len(LABELS)), LABELS)
    ax.set_xlabel("Predicted level")
    ax.set_ylabel("True level")
    ax.set_title(f"{r.name}\naccuracy {r.report.accuracy:.1%}", fontsize=10)
    fig.tight_layout()
    fig.savefig(out_dir / f"confusion_{_slug(r.name)}.png", dpi=160)
    plt.close(fig)


def _importance_png(results: list[Result], out_dir: Path) -> None:
    ours = next(r for r in results if r.name == "Our random forest").importances
    theirs = next(r for r in results if r.name == "scikit-learn random forest").importances
    order = np.argsort(ours)
    y = np.arange(len(FEATURES))
    fig, ax = plt.subplots(figsize=(6.5, 4.2))
    ax.barh(y + 0.2, ours[order], height=0.4, label="Our random forest", color="#C8102E")
    ax.barh(y - 0.2, theirs[order], height=0.4, label="scikit-learn", color="#9AA5B1")
    ax.set_yticks(y, [FEATURES[i] for i in order])
    ax.set_xlabel("Share of total Gini gain")
    ax.set_title("Feature importance", fontsize=11)
    ax.legend(loc="lower right", frameon=False)
    fig.tight_layout()
    fig.savefig(out_dir / "feature_importance.png", dpi=160)
    plt.close(fig)


def _cv_png(cv: dict[int, float], best: int, out_dir: Path) -> None:
    fig, ax = plt.subplots(figsize=(5, 3.2))
    depths = list(cv)
    ax.plot(depths, [cv[d] for d in depths], marker="o", color="#003893")
    ax.scatter([best], [cv[best]], s=120, facecolors="none", edgecolors="#C8102E", linewidths=2)
    ax.set_xlabel("max_depth")
    ax.set_ylabel("Mean validation accuracy")
    ax.set_title("Decision tree: 5-fold cross-validation", fontsize=11)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_dir / "cv_depth.png", dpi=160)
    plt.close(fig)


def _sources_png(y: np.ndarray, sources: list[str], out_dir: Path) -> None:
    names = sorted(set(sources))
    colors = {"agency": "#003893", "survey": "#2E7D32", "rule": "#9AA5B1"}
    fig, ax = plt.subplots(figsize=(5, 3.2))
    bottom = np.zeros(len(LABELS))
    src = np.array(sources)
    for name in names:
        counts = np.array([np.sum((y == i) & (src == name)) for i in range(len(LABELS))])
        ax.bar(LABELS, counts, bottom=bottom, label=name, color=colors.get(name))
        bottom += counts
    ax.set_ylabel("Rows")
    ax.set_title(f"Training data: {len(y)} rows", fontsize=11)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(out_dir / "data_sources.png", dpi=160)
    plt.close(fig)


def main() -> None:
    run()
    print((OUT_DIR / "comparison.md").read_text(encoding="utf-8"))
    print(f"Figures saved in {OUT_DIR}")


if __name__ == "__main__":
    main()
