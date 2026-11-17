# Version 1 · Phase 2 — Trek Itinerary & AI Risk Predictor

**Weeks:** about 7–9 (Gantt "Sprint 2: trek module, ML risk model"). **The mid-term defense falls here**, so this phase is what you will demo.
**Goal:** day-by-day trek itineraries with acclimatisation warnings, and a personal difficulty and risk rating with a "Why this rating?" explanation, made by a decision tree and random forest written from scratch.

Previous: [phase1.md](phase1.md) · Next: [phase3.md](phase3.md) · Algorithms: [algorithm.md](../../design/algorithm.md)

**Status (2026-11-06): code done.** Backend, ML, mobile screens and tests are built (81 backend tests
pass). Still open: real survey answers, running the demo on a phone, and the report write-up (see
"Done when"). The ML code is in `smart-nepal-guide/backend/app/ml/` (not a top-level `ml/` folder), so
the API can import the classes it unpickles; `smart-nepal-guide/ml/` holds only the notebook.

---

## Demo at the end of this phase (mid-term)
1. Open Everest Base Camp → see days 1–11 (our seed itinerary) with altitude, distance and hours; days 3 and 6 are rest days at Namche and Dingboche.
2. Days with more than 500 m sleeping gain (EBC days 2, 5, 7: +830, +550, +530 m) show a **Caution** badge. Annapurna Base Camp (no rest day) shows **Add rest** on day 5 and suggests a rest day at Deurali.
3. Profile: medium fitness, no experience. Tap "Check my risk" → choose January → **Risky**, with up to 3 reasons from the model, e.g. "no multi-day trekking experience", "goes up to 5,644 m", "gains 830 m on day 2" (or "cold winter month").
4. Change the profile to experienced + high fitness, choose October → **Hard**, with different reasons (altitude and daily gain only).
5. Show the evaluation: our tree's and forest's accuracy and confusion matrices next to scikit-learn's (`docs/ml/`).

---

## 1. Trek itinerary

- [x] `GET /treks/{id}/stages`: day, from → to, sleeping altitude (the `to` place's altitude), gain or loss, distance, hours, highest point on the way
- [x] Mobile: itinerary screen with a card per day; "Day 4: Namche → Tengboche, 3,440 m → 3,860 m (+420 m), 5.5 h"
- [x] Trek summary computed from the stages: start, end, total days, max altitude, **max daily gain** (also used by the ML model)
  - *max altitude* = highest point reached (including viewpoints such as Kala Patthar); the highest *sleeping* altitude is also returned
  - *max daily gain* = the biggest one-day rise in sleeping altitude on a day that ends above 3,000 m (0 for treks that stay lower)

## 2. Acclimatisation checker (rule-based)

Function `check_acclimatisation(stages) -> AcclimatisationReport` in `app/algorithms/acclimatisation.py`:
- [x] Above 3,000 m, a sleeping-altitude gain of more than 500 m in one day → **`caution`** on that day (code `GAIN_OVER_500`). Real itineraries do this (Phakding → Namche is +830 m), so on its own it is not a failure.
- [x] Above 3,000 m, a rest day for every 1,000 m gained: add up the sleeping gain above 3,000 m since the last rest day; a day that pushes it past 1,000 m is **`danger`** (code `NEEDS_REST`) and a rest day is suggested the night before. A rest day (from = to) resets the count. (The "every 3–4 days" variant was dropped: the 1,000 m rule is the standard one and is easier to explain.)
- [x] Output: per-day status (`ok` / `caution` / `danger`) + suggested rest days + reason codes. **An itinerary passes when no day is `danger`.**
- [x] `GET /treks/{id}/acclimatisation`
- [x] Mobile: coloured badge on each day card + a summary box at the top
- [x] Tests on real itineraries: the standard Everest Base Camp itinerary (with Namche and Dingboche rest days) passes with cautions on days 2, 5, 7; the same without rest days is flagged (rest suggested at Tengboche)

## 3. Training data

- [x] `training_sample` table + import (part of `python -m app.seed`) from `data/training_samples.csv`, which `python -m app.ml.dataset` generates
- [x] **Features (9):** max_altitude_m, max_daily_gain_m, total_days, distance_per_day_km, month, age, fitness_level, trek_experience, has_health_issue
  - age = from the profile's date of birth; has_health_issue = heart condition **or** asthma (an unanswered question counts as no)
  - the model sees 10 columns: `month` becomes `winter` (Dec–Feb) and `monsoon` (Jun–Aug) flags, because Dec and Jan are both risky but far apart as numbers
- [x] **Label:** easy / moderate / hard / risky
- [x] Sources, each recorded in a `source` column:
  1. agency difficulty ratings for each trek (base label) — 32 rows: 8 treks × Mar/Apr/Oct/Nov for a typical trekker (30, medium fitness, beginner)
  2. survey answers ("which trek, which month, your fitness/experience, how hard was it, did you get altitude sickness?") — **importer ready** (`--survey form.csv`), **no answers yet**
  3. rule-generated rows to fill the gaps and balance the classes — 560 rows; scoring rule + 8% label noise written in `backend/app/ml/dataset.py` (copy into the report). The rule reproduces all 8 agency labels.
- [x] Target: 400–600 rows, no class below ~15% → 592 rows, 23–26% per class
- [x] Stratified 80/20 train/test split with a fixed random seed (42)

## 4. Decision tree from scratch (`ml/tree.py`)

File: `backend/app/ml/tree.py` (NumPy).
- [x] `gini(labels)` → 1 − Σ pᵢ²
- [x] `best_split(...)`: for each feature, try thresholds at the midpoints between sorted values; choose the largest Gini gain
- [x] Encode categories as ordered numbers (fitness low/medium/high → 0/1/2; experience none/beginner/experienced → 0/1/2; month → winter/monsoon flags)
- [x] Recursive `_build(X, y, depth)` with `max_depth` and `min_samples_split`; leaf = class counts
- [x] `predict(x)`, `predict_proba(x)` (leaf class share = confidence), `decision_path(x)` (list of conditions used)
- [x] Tune `max_depth` (3–8) with 5-fold cross-validation (picked 8)

## 5. Random forest (`backend/app/ml/forest.py`), also from scratch

- [x] Bootstrap sampling (sample with replacement) for each tree
- [x] Random feature subset at each split (√10 ≈ 3 features; if none of them can split the node, more are tried, as scikit-learn does)
- [x] `n_trees` 50, majority vote, confidence = share of votes
- [x] Explanation: use the decision paths of the trees that voted for the winning class; count the most common conditions

## 6. Evaluation (for the report and the defense)

- [x] Accuracy, precision, recall and F1 per class; confusion matrix image
- [x] Our decision tree vs our random forest vs scikit-learn `DecisionTreeClassifier` / `RandomForestClassifier` in one table — tree 0.669 / forest **0.814** / sklearn tree 0.661 / sklearn forest 0.805 accuracy
- [x] Feature importance chart (total Gini gain per feature)
- [x] Notebook `ml/evaluation.ipynb` that makes all the figures (it runs `python -m app.ml.evaluate`; output in `docs/ml/`)

## 7. Serving the model

- [x] `python -m app.ml.train` trains tree + forest, evaluates, saves with joblib to `backend/models/`, inserts `ml_model` rows, marks the one with the better macro F1 active (the forest)
- [x] The backend loads the active model at startup (and reloads it when another becomes active)
- [x] `POST /predict-risk {trek_id, month}` → builds the feature vector from the user's profile + trek summary → `{level, confidence, reasons[], acclimatisation, input}`; saves a `risk_prediction` row. Incomplete profile → 409 `PROFILE_INCOMPLETE`
- [x] `GET /me/predictions`: history

### Reason codes → sentences
Map conditions in the decision path to codes, then to sentences in `en.json` / `ne.json`. A code is shown only when (a) a winning tree's path has a condition on that feature pointing towards more risk, and (b) the user's own value passes the rule below — so every sentence is true for this user. Top 3 by how many trees used it; none for an `easy` result.

| Code | Rule on the user's value | English text |
|---|---|---|
| HIGH_ALTITUDE | max_altitude_m > 5,000 | Goes up to {altitude}, above 5,000 m |
| HIGH_DAILY_GAIN | max_daily_gain_m > 500 | Gains {gain} on day {day} |
| WINTER_MONTH | month in Dec–Feb | Cold winter month with snow on high passes |
| MONSOON_MONTH | month in Jun–Aug | Monsoon: rain, leeches and landslides |
| NO_EXPERIENCE | trek_experience = none | You have no multi-day trekking experience |
| BEGINNER | trek_experience = beginner | You have little trekking experience |
| LOW_FITNESS | fitness_level = low | Low fitness level |
| HEALTH_ISSUE | has_health_issue | Heart or breathing condition |
| AGE_RISK | age > 60 or < 14 | Age {age} increases altitude risk |
| LONG_DAYS | distance_per_day_km > 12 | Long walking days (about {km} a day) |

## 8. Mobile screens

- [x] "Check my risk" on the trek page → month picker → result screen
- [x] Result: level with colour (green / yellow / orange / red), confidence, "Why this rating?" list, acclimatisation warnings
- [x] If the profile is incomplete (date of birth, fitness or experience missing), ask the user to finish it first
- [x] Risk history: Settings tab → "My risk checks" (there is no profile tab; profile is a screen opened from Settings)

## 9. Tests
- [x] `gini([a, a, b, b]) == 0.5`; a pure node gives 0
- [x] The tree learns a tiny hand-made dataset perfectly
- [x] The forest gives the same result with the same random seed
- [x] Our accuracy is within a few percent of scikit-learn's on the same split (tree: same depth; forest: average of 3 seeds, within 5 points)
- [x] `/predict-risk`: beginner + EBC + January scores higher risk than experienced + Poon Hill + October

---

## Done when
- [ ] The mid-term demo above works on a phone (checklist in `smart-nepal-guide/runlocal.md`)
- [x] Evaluation table, confusion matrix and feature importance figures are saved in `docs/` (`docs/ml/`)
- [x] The data sources and labelling rules are written down (`backend/app/ml/dataset.py` docstring; copy into the report's "Data collection" section)
- [ ] Real survey answers collected and added (`python -m app.ml.dataset --survey form.csv`), model retrained

## Risks
| Risk | What to do |
|---|---|
| Not enough real survey data | Be honest: real + rule-generated, show the split in the report (`docs/ml/data_sources.png`) |
| Only 8 treks, so the 4 trek features have few distinct values | Say so in the report; survey answers vary `total_days`; the model mostly learns "which trek" + personal factors |
| The tree overfits | Limit depth, use cross-validation, prefer the forest if it scores better |
| Reasons look random | Show only the top 3 conditions, and only ones that point towards the predicted level |
