# ML: trek difficulty & risk model (Phase 2)

The model code lives in the backend, so the API can load saved models:
[`backend/app/ml/`](../backend/app/ml/).

| File | What |
|---|---|
| `features.py` | The 9 inputs → 10 features (month → winter / monsoon flags; categories → 0/1/2) |
| `tree.py` | **CART decision tree from scratch**: `gini`, `best_split` (midpoint thresholds, largest Gini gain), `predict_proba`, `decision_path`, feature importance |
| `forest.py` | **Random forest from scratch**: bootstrap samples, √10 ≈ 3 random features per split, majority vote, vote share = confidence |
| `reasons.py` | "Why this rating?": risk-side conditions on the winning trees' paths → top 3 reason codes |
| `dataset.py` | Builds `data/training_samples.csv` (agency + survey + rule rows; the scoring rule is documented here) |
| `metrics.py` | Accuracy, per-class precision/recall/F1, confusion matrix, stratified split, k-fold (hand-written) |
| `train.py` | CV for `max_depth`, trains tree + forest, saves with joblib to `backend/models/`, activates the better |
| `evaluate.py` | Report figures and the comparison with scikit-learn → `docs/ml/` |
| `registry.py` | Loads the active model for the API |

[`evaluation.ipynb`](evaluation.ipynb) runs `evaluate.py` and shows every figure, plus one decision path.
Open it in VS Code with the `backend/.venv` Python as the kernel (PostgreSQL running, data seeded).

```bash
cd backend
uv run python -m app.ml.dataset && uv run python -m app.seed && uv run python -m app.ml.train
uv run python -m app.ml.evaluate
```
