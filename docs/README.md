# Bato documentation

Everything written for the project: design, plans, testing and report material.
For the whole repository layout see [../filestructure.md](../filestructure.md).

| Folder / file | What is in it | Used for |
|---|---|---|
| [design/](design/) | [project-notes.md](design/project-notes.md) (start here: overview, links to everything), [feature.md](design/feature.md), [algorithm.md](design/algorithm.md), [techstack.md](design/techstack.md), [database.md](design/database.md) | Proposal and report chapters 1–4 |
| [diagrams/](diagrams/) | Architecture, ER, use case, DFD (level 0 and 1) and class diagrams as `.png` + `.svg`, and the `make_*.py` scripts that draw them | Report figures. Redraw with `python3 docs/diagrams/make_er_diagram.py` (writes the `.svg` next to the script) |
| [plans/version1/](plans/version1/) | Phase 1–3 plans with checkboxes and *Note:* lines for changes | Done: what was built and why |
| [plans/version2/](plans/version2/) | [README.md](plans/version2/README.md) (overview, gate, open decisions) + phase 1–3 plans | Next work |
| [testing/](testing/) | [testing.md](testing/testing.md) (the 40 + 12 manual test cases and bugs), [testing-guide.md](testing/testing-guide.md) (order, sessions, how to check each) | Testing chapter |
| [survey/](survey/) | [trekker-survey.md](survey/trekker-survey.md) (questions and labelling rule), [trekker-survey-form.gs](survey/trekker-survey-form.gs) (Apps Script that builds the Google Form) | Real training data for the risk model |
| [ml/](ml/) | `comparison.md`, confusion matrices, feature importance, CV depth, data sources, `metrics.json` | ML chapter. **Generated**: `cd backend && uv run python -m app.ml.evaluate` (do not edit by hand) |
| [route_gap.md](route_gap.md) | How far 2-opt is from the exact best route on random trips of 5–8 places | Algorithms chapter. **Generated**: `cd backend && uv run python -m app.algorithms.route_benchmark` |
| [screenshots/](screenshots/) | App and admin screenshots in English and Nepali | Report. How to take them: [manual-tasks.md #8](manual-tasks.md#8-screenshots-for-the-report) |
| [manual-tasks.md](manual-tasks.md) | Everything left to do by hand (survey, data checks, phone tests, APK, release), with how to check each | Your to-do list |
