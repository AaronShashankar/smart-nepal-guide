# Report material

- `screenshots/` — Phase 1 screenshots for the report: login, profile, explore, place detail, map,
  search, and the same screens in Nepali. Also the Swagger page (`http://localhost:8000/docs`).
- `ml/` — Phase 2 model evaluation, made by `cd backend && uv run python -m app.ml.evaluate`:
  `comparison.md` (our tree/forest vs scikit-learn), `confusion_*.png`, `feature_importance.png`,
  `cv_depth.png`, `data_sources.png`, and `metrics.json` (written by `app.ml.train`).
- `trekker-survey.md` — the Google Form for real training data.
- `route_gap.md` — Phase 3: how far 2-opt is from the exact (brute-force) best route on random
  trips of 5–8 places, made by `cd backend && uv run python -m app.algorithms.route_benchmark`.
- `testing.md` — the manual test cases table (40 cases) and the bugs found, for the testing chapter.
- The design documents (features, tech stack, database, algorithms, diagrams) are kept next to this
  repository in the project notes folder (`../feature.md`, `../database.md`, …).
