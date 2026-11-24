# Backend docs

Docs about the FastAPI backend only. Project-wide docs (plans, testing, design, how to run) are in
[../../docs/](../../docs/README.md).

| File / folder | What is in it | Made by |
|---|---|---|
| [algorithm.md](algorithm.md) | Algorithms, main API functions, protocols, architecture, viva focus | Written by hand |
| [database.md](database.md) | Database design: tables, keys, relations | Written by hand |
| [ml/](ml/) | Risk model results: `comparison.md`, confusion matrices, feature importance, CV depth, data sources, `metrics.json` | **Generated**: `uv run python -m app.ml.train`, then `uv run python -m app.ml.evaluate` |
| [survey/](survey/) | [trekker-survey.md](survey/trekker-survey.md) (questions and labelling rule), [trekker-survey-form.gs](survey/trekker-survey-form.gs) (builds the Google Form) | Written by hand |
| [benchmarks/search_quality.md](benchmarks/search_quality.md) | 51 search queries with the expected answer: hit@1, hit@3, MRR | **Generated**: `uv run python -m app.search_benchmark` |
| [benchmarks/recommend_quality.md](benchmarks/recommend_quality.md) | How MMR's λ trades relevance for variety | **Generated**: `uv run python -m app.recommend_benchmark` |
| [benchmarks/route_gap.md](benchmarks/route_gap.md) | How far 2-opt is from the exact best route | **Generated**: `uv run python -m app.algorithms.route_benchmark` |

Run the generators from `backend/`. Don't edit generated files by hand.
