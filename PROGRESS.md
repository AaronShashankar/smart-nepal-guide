# Bato: progress so far

*Status on 2026-11-27. Everything below is on the `main` branch, and all new work happens there.*

Bato (बाटो) is a bilingual (English / नेपाली) app for travelling in Nepal. You can discover places,
plan a trip, and check how hard and risky a trek is **for you**, with the reasons shown.
This page sums up what has been built and checked so far, and what is still left.
To set up and run the project, see [README.md](README.md) and [runlocal.md](docs/runlocal.md).
Every task, bug, test case and decision is tracked in the
[Bato Project Tracker](https://docs.google.com/spreadsheets/d/1LWie4PGyiRj2xzo-zmTeK6Zd2-Rd_LAcVR2xOdkE33I/edit).

---

## At a glance

| Part | Status |
|---|---|
| **Version 1:** users, explore, search, map, itinerary, acclimatisation, AI risk predictor, trip planner, admin panel | Code done. Demos run on a real phone and the APK works (2026-11-23). The video and the `v1.0` tag are still to do |
| **Version 2 Phase 1:** altitude chart, safer alternatives, weather, packing list | Done: tested on the emulator and a real phone |
| **Version 2 Phase 2:** recommendations, reviews, Near me, budget, share a trip, teahouses | Done: *Near me* passes on a real phone (TC-47) |
| **UI redesign:** "Bato App Redesign" canvas | Done: checked on a real phone in both languages (V2-UI-01) |
| **Search & recommendations (V2-SR):** college → real product | Stage 1 core built (V2-SR-01 … 10, plus 14: search by city and trek region): smarter search and recommendations, measured; tested on the emulator in English. Left: TC-66 (admin tags, Nepali labels) and NEAR_YOU on a real phone. Stage 1 extras (V2-SR-11 … 13) and Stages 2–3 planned in [search-recommendation.md](docs/product/search-recommendation.md) |
| **Version 2 Phase 3:** safety & offline | Core built (2026-11-24): emergency contacts, SOS by SMS with GPS and an offline queue, the Lake Louise symptom checker, 53 new tests. The backend is tested; the app screens still need a real-phone run with mobile data off (TC-68 to TC-76). Stretch (daily check-in, offline treks) not started |
| **Automated checks** | 306 backend tests; the app's Lake Louise copy passes the same 17 cases; mobile and admin typecheck and lint pass (`./scripts/verify.sh`) |
| **Manual test cases** | 77 written; 65 pass; TC-01 failed on the real phone (BUG-06 again), fixed again and waiting for a phone re-test; TC-66, the 9 safety cases (TC-68 to TC-76) and TC-77 (health questions) not run yet |
| **Bugs** | 18 logged; 17 fixed; BUG-06 fixed a second time and waiting for a phone re-test |

**Size of the code** (Python and TypeScript only, 2026-11-24): backend ≈ 10,300 lines, mobile app ≈ 10,300 lines,
admin panel ≈ 3,600 lines.

## Timeline

| Date | What happened | Commit |
|---|---|---|
| 2026-11-05 | Picked the project, the stack and the feature list. Proposal written in TU format | — |
| 2026-11-06 | Named the app **Bato**. Built V1 Phase 1 (setup, users, explore), Phase 2 (itinerary, risk model) and Phase 3 (trip planner, admin panel) | `c68cf29`, `394b9db`, `b8bd502` |
| 2026-11-08 | App icon and splash screen. Project tracker sheet created | `7d843a1` |
| 2026-11-09 | First testing report. Built V2 Phase 2: personalisation & community | `7bed884`, `2659fc6` |
| 2026-11-17 | Moved all docs into the repo. Added the Makefile, the trekker survey and the testing guide | `0dfcbff`, `fd26f4f` |
| 2026-11-19 | Ran 58 manual test cases on the emulator and fixed BUG-05 to BUG-15. Built V2 Phase 1: smart trek features | `51e4e31`, `726a81e`, `a6bc910` |
| 2026-11-22 | Plans for Version 3 (Bato as a product after the defense) | `d107ee6` |
| 2026-11-23 | UI redesign. Merged every branch into `main`. Fixed BUG-16 (Render Error on tappable cards). Feature ratings report. Login and register forms: placeholders, show-password button, keyboard no longer covers the form (BUG-17) | `f448f33`, `66cea3b` |
| 2026-11-23 | Search and recommendations, Stage 1 (V2-SR-01 … 10): transliteration, search by village/district/category/initials, a 43-query search test set; recommendations learn from feedback, use the risk model, nearby bonus, MMR variety, "Not interested" with Undo, place tags. Migration 0006 | `ea72cef` |
| 2026-11-23 | Search by city and trek region (V2-SR-14): `area` table and `data/areas.csv`, "pokhara" lists all 3 Pokhara sights, "kathmandu valley" all 8, "khumbu" the EBC Trek; area shown in the app and editable in the admin panel; 8 new search test cases (51 in all). Migration 0007. Search opens the tab that has results and shows counts ("Places · 8", BUG-18) | not committed yet |
| 2026-11-24 | Docs reorganised (V2-DOC-03): backend-only docs (algorithm, database, ML results, survey, benchmark reports) moved to `backend/docs/`; `runlocal.md` and `filestructure.md` moved into `docs/`; every link and every script output path updated | not committed yet |
| 2026-11-24 | V2 Phase 3 Core (V2-P3-01, 02, 03, 07): emergency contacts, SOS by SMS with GPS and an offline queue, the Lake Louise symptom checker with history, sourced emergency numbers, safety test mode, admin counts. Migration 0008, 53 new tests (302 in all), TC-68 to TC-76 written | not committed yet |
| 2026-11-27 | Health questions (V2-PROF-01): the traveller profile also asks about high blood pressure, significant anemia and an injury in the last 3 months, in English and Nepali. A Yes to any of the 5 health questions counts as a health issue for the risk model (its input is unchanged, no retraining). Migration 0009, 4 new tests (306 in all), TC-77 written | not committed yet |

---

## What the app can do now

### Version 1 Phase 1: users and explore
- **First launch:** you pick English or नेपाली. Then you register with email or *Continue with Google*. Passwords are hashed with bcrypt, and sessions use JWT access and refresh tokens. The forms have placeholders, a show/hide password button, and stay above the keyboard.
- **Traveller profile:** age, fitness, trekking experience, interests and nationality, plus optional health questions (heart condition, asthma, high blood pressure, significant anemia, a recent injury).
- **Explore:** category chips, a list of treks and a list of places.
- **Place page:** photos, best months to visit, entry fees, how to get there, and the 5 nearest places.
- **Trek page:** route, permits and stats.
- **Map:** OpenStreetMap through MapLibre, with markers coloured by category. Tapping a marker opens its page.
- **Fuzzy search:** "punhill" finds Poon Hill. You can filter treks by region, duration and difficulty.
- **Language:** every screen is translated, numbers are shown in Devanagari digits, and anything missing in Nepali falls back to English.

### Version 1 Phase 2: itinerary and the AI risk predictor
- **Day-by-day itinerary:** sleeping altitude, height gained, km and hours for each day, with rest days marked.
- **Acclimatisation checker:** each day is rated *ok*, *caution* or *danger*, and missing rest days are suggested.
- **Check my risk:** you pick a month and get *easy*, *moderate*, *hard* or *risky*, with a confidence level and **"Why this rating?"** reasons in both languages. The model is our own random forest.
- **Risk history:** your past checks are under Settings → My risk checks.

### Version 1 Phase 3: trip planner and admin panel
- **Trips:** *Add to My Trip* on any place, then **Optimise**. This gives the best visiting order (nearest neighbour, then 2-opt), splits it into days and shows "down from X km". The map numbers the stops and colours them by day.
- **Admin panel** (React + Mantine, English and नेपाली):
  - dashboard with counts and a chart
  - places with English and Nepali tabs, a map picker and photo upload
  - treks with a stage editor
  - categories and permits
  - users (block and unblock)
  - reviews (hide and show)
  - V2 additions: teahouses and budget rates

### Version 2 Phase 1: smart trek features
- **Altitude profile chart:** the itinerary shows a line chart, and the sections that climb too fast are coloured.
- **Safer alternatives:** for a *hard* or *risky* result, Bato suggests similar treks (KNN) that the risk model rates lower for you.
- **Weather forecast** on trek and place pages, from Open-Meteo. Forecasts are kept in Redis for 1 hour, and a 24-hour stale copy is used if the service is down.
- **Packing checklist** worked out from the trek's top altitude, the season and the number of days. Your ticks are remembered.

### Version 2 Phase 2: personalisation and community
- **Recommended for you** on Explore, using cosine similarity against your interests. New users see "Popular now" instead.
- **Reviews and star ratings** on places and treks. Ratings use a Bayesian average, so one 5★ review doesn't beat many good ones.
- **Near me:** GPS plus a bounding box and Haversine distance, closest place first.
- **Budget estimate** for a trek or a trip: food, stay, transport, and permits at your nationality's rate.
- **Share a trip:** a read-only link that works without logging in, as an app screen or a small web page.
- **Teahouses** listed on itinerary days. So far these are 4 sourced lodges in Tengboche.

### Search and recommendations, Stage 1 (V2-SR)
- **Search understands more:** Nepali typed in English letters ("pashupati mandir", "phewa tal") and in Devanagari, villages ("namche" → Everest Base Camp Trek, "Passes through Namche Bazaar"), districts ("bhaktapur"), categories ("temple"), trek initials ("ebc"). Measured on 51 queries: right answer first 60% → 83%, in the top 3 60% → 100%, MRR 0.604 → 0.906 ("before" = the old code on the same queries).
- **Search by city and trek region (V2-SR-14):** "pokhara" lists Phewa Lake, Sarangkot and World Peace Pagoda (before: only Phewa Lake, because Pokhara is a city in Kaski district); "kathmandu valley" lists all 8 valley sights, including Patan and Bhaktapur; "khumbu" / "everest region" finds the EBC Trek; "पोखरा" works too. The app shows the area under each result ("Viewpoints · Pokhara") and on the place page ("Pokhara, Kaski, Gandaki"). 6 areas in `data/areas.csv`, editable per place in the admin panel.
- **Recommendations learn:** from your reviews, trips and the new **×  Not interested** (with Undo). Treks that are risky for you this month go down; places near you (if location is already allowed) or near your latest trip go up; the list is varied (MMR); new reasons such as "Suits your fitness this month" and "Near you".
- **Place tags** (sunrise, mountain views, pilgrimage, UNESCO…) on the place page, editable in the admin panel.

### Version 2 Phase 3 Core: safety on the trail
Built on 2026-11-24; the screens still need a run on a real phone with mobile data off.
- **Emergency contacts:** up to 5 people (Settings → Safety). `98…` is saved as `+977…`. A copy stays on the phone, so SOS works with no internet. The fixed numbers (Police 100, Tourist Police 1144, Ambulance 102, Fire 101) come with the app, each checked against two government travel pages.
- **SOS:** hold the red button for 2 seconds (a ring fills, the phone vibrates). Bato gets the GPS position (or the last known one, with its time), writes the message with a map link and opens the SMS app to your contacts; you press Send. With no contacts, it calls the Tourist Police. This needs no mobile data. The record waits in an offline queue and reaches the server when you are online, saved once even if it is sent twice.
- **Altitude sickness check:** "How do you feel?" on the itinerary and the trek page. The four Lake Louise questions plus three danger signs give **OK**, **Rest: don't go higher today** or **Descend now**, with the reasons. It works offline; the server scores it again and keeps a history (Settings → My symptom checks).
- **Disclaimer** on every safety screen: Bato is not a rescue service and not medical advice.
- **Test mode:** test numbers in `mobile/.env` replace the emergency numbers, with a yellow banner, so SOS can be tried without calling the police.
- **Admin dashboard:** counts of SOS events and symptom checks.

### UI redesign (from the Claude Design canvas)
- **New look:**
  - Nepal-crimson actions and navy panels
  - Plus Jakarta Sans for English, Noto Sans Devanagari for Nepali
  - a floating tab bar
  - photo headers with a sheet that overlaps them
  - stat tiles
- **New components:** a half-circle risk gauge, the redesigned altitude chart with a small line preview on the trek page, and a photo welcome screen.
- **Treks have no photos in the data yet**, so their cards and headers show a drawn navy mountain picture.
- **Changes from the canvas, for now:**
  - no Save or Share buttons on the photo header
  - duration chips instead of a slider
  - no budget-level switch
  - trip stops can't be dragged to reorder

---

## Algorithms written for the viva

All of these are written by hand. scikit-learn is used only to compare the risk model against.

| Algorithm | Used for | Code |
|---|---|---|
| Haversine distance | Nearest places, trip distances, Near me | [haversine.py](backend/app/algorithms/haversine.py) |
| Levenshtein edit distance (after pg_trgm finds candidates) | Fuzzy search | [levenshtein.py](backend/app/algorithms/levenshtein.py), [search.py](backend/app/services/search.py) |
| Weighted scoring | Best time to visit | [best_time.py](backend/app/algorithms/best_time.py) |
| Rule-based checker | Acclimatisation (more than 500 m gained in a day above 3,000 m; rest days) | [acclimatisation.py](backend/app/algorithms/acclimatisation.py) |
| **Lake Louise AMS score (2018)**, the same code on the phone and the server | Altitude sickness check | [lake_louise.py](backend/app/algorithms/lake_louise.py), [lakeLouise.ts](mobile/src/lib/lakeLouise.ts) |
| Offline queue with ids made on the phone (sent once, in order) | SOS events and symptom checks made without internet | [safety.ts](mobile/src/lib/safety.ts), [services/safety.py](backend/app/services/safety.py) |
| **CART decision tree (Gini)** | Risk model | [tree.py](backend/app/ml/tree.py) |
| **Random forest** (bootstrap, √n features, vote) | Risk model, the one in use | [forest.py](backend/app/ml/forest.py) |
| Decision-path tracing | "Why this rating?" | [reasons.py](backend/app/ml/reasons.py) |
| Metrics, stratified split, k-fold CV | Model evaluation | [metrics.py](backend/app/ml/metrics.py) |
| Nearest neighbour + 2-opt, brute force, greedy day split | Trip planner | [route.py](backend/app/algorithms/route.py) |
| Linear interpolation | Altitude profile | [altitude_profile.py](backend/app/algorithms/altitude_profile.py) |
| K-nearest neighbours (min-max scaled, Euclidean) | Safer alternatives | [knn.py](backend/app/algorithms/knn.py) |
| Cache-aside with a TTL | Weather | [weather.py](backend/app/services/weather.py), [cache.py](backend/app/core/cache.py) |
| Rule-based expert system | Packing list | [packing.py](backend/app/algorithms/packing.py) |
| Cosine similarity | Recommendations | [similarity.py](backend/app/algorithms/similarity.py), [recommend.py](backend/app/services/recommend.py) |
| Learning from feedback (signal-weighted average of item vectors) | Recommendations learn from reviews, trips and "Not interested" | [recommend.py](backend/app/services/recommend.py) |
| Maximal marginal relevance (MMR) | A varied recommendation list | [recommend.py](backend/app/services/recommend.py), [recommend_benchmark.py](backend/app/recommend_benchmark.py) |
| Devanagari → Latin transliteration with schwa deletion | Search in either script ("pashupati mandir", "सगरमाथा") | [transliterate.py](backend/app/algorithms/transliterate.py) |
| Word-by-word similarity, trek initials | Search ("chitwan nikunja", "ebc") | [levenshtein.py](backend/app/algorithms/levenshtein.py), [search.py](backend/app/services/search.py) |
| hit@k and MRR on a test set | Measuring search quality | [search_benchmark.py](backend/app/search_benchmark.py) |
| Bayesian average | Ratings | [rating.py](backend/app/algorithms/rating.py) |
| Bounding box | Near me | [geo_box.py](backend/app/algorithms/geo_box.py) |

**Risk model results** on a test set of 118 rows (seed 42). Full details are in [docs/ml/comparison.md](backend/docs/ml/comparison.md).

| Model | Accuracy | Macro F1 |
|---|---|---|
| Our decision tree (depth 8) | 0.669 | 0.678 |
| **Our random forest (50 trees), in use** | **0.814** | **0.815** |
| scikit-learn decision tree | 0.661 | 0.669 |
| scikit-learn random forest | 0.805 | 0.807 |

Our forest does as well as scikit-learn's. The training data is 592 rows: 32 trekking-agency ratings
plus 560 rows generated from a rule. Real survey answers will replace part of that later.

## Data

All seed data is in [data/](data/), with a source and date for each item in [data/README.md](data/README.md).

| File | Contents |
|---|---|
| `places.csv` and `photos.csv` | 69 places, 63 photos (63 places have one; the other 6 show a drawn picture) |
| `aliases.csv` | 71 alternative names, used by search |
| `areas.csv` | 6 cities and trek regions (Kathmandu Valley, Pokhara, Everest, Annapurna, Langtang, Manaslu) and the places in each, for search |
| `place_tags.csv` | Tags for the 24 places that are not trek villages (sunrise, pilgrimage, UNESCO…), used by recommendations and shown on the place page |
| `treks.json` | 8 treks with their daily stages: Poon Hill, ABC, EBC, Langtang Valley, Mardi Himal, Annapurna Circuit, Gosaikunda, Manaslu Circuit |
| `categories.csv` | 6 categories |
| `permits.csv` | 7 permits |
| `training_samples.csv` | 592 rows of training data for the risk model |
| `packing_items.csv` | 34 packing items |
| `budget_rates.csv` | 18 sourced budget rates |
| `teahouses.csv` | 4 teahouses |
| `climate_baseline.csv` and `climate_regions.csv` | Kathmandu's monthly weather plus a rain factor for each district, used for the best-time scores |
| `emergency_numbers.csv` | Police 100, Tourist Police 1144, Ambulance 102, Fire 101, each with its source; the app ships a copy so they show offline |

The database is PostgreSQL 16 with 9 migrations: Phase 1, Phase 2, Phase 3, V2 Phase 2, V2 Phase 1, V2-SR (place tags, `name_latin`, `dismissed_item`), V2-SR-14 (`area`, `place.area_id`), V2 Phase 3 (`emergency_contact`, `sos_event`, `symptom_check`), then V2-PROF-01 (three health columns on `traveller_profile`).

## Testing and quality

- **Automated:** [`./scripts/verify.sh`](scripts/verify.sh) runs all of these:
  - backend ruff lint and format check
  - a check that the migrations match the models
  - 306 pytest tests
  - the app's copy of the Lake Louise score against the same 17 cases as the backend
  - mobile typecheck and lint
  - admin typecheck, build and lint
- **Manual test cases:** 77 cases, TC-01 to TC-77, listed in [docs/testing/testing.md](docs/testing/testing.md) and run in the order set by [docs/testing/testing-guide.md](docs/testing/testing-guide.md).
  - All were run on the emulator (Phone 1). The layout cases, TC-47 (Near me, real GPS) and TC-51 were run on a
    real phone (Phone 2: Samsung Galaxy A07, 720 × 1600) on 2026-11-23.
  - TC-59 to TC-61 (login and register forms) were added on 2026-11-23 and pass on both phones.
  - TC-62 to TC-66 (search and recommendations) were added on 2026-11-23; TC-62 to TC-65 pass on the emulator, TC-66 (admin tags, Nepali labels) is not run yet.
  - TC-67 (search by city and trek region) was added on 2026-11-23 and passes on the emulator.
  - TC-68 to TC-76 (safety: contacts, SOS, symptom checker) were added on 2026-11-24. They need a real phone with a SIM and are not run yet.
  - 64 pass. TC-01 failed on Phone 2: two Nepali buttons on the welcome screen were cut (BUG-06). It is fixed
    again and passes on the emulator; it needs one more check on the phone.
- **Bugs:** 18 logged in the tracker. The ones worth knowing:
  - BUG-06: Nepali labels lost their last word on Android. The first fix did not hold on a real phone after a
    language switch; the second fix (2026-11-23) gives the text a few pixels of slack. It needs a phone re-test.
  - BUG-14: numbers stayed in English after switching language, because of the React Compiler.
  - BUG-16: the redesign's cards crashed inside expo-router's `Link`.
  - BUG-17: the keyboard covered the login form, because Android apps are now edge-to-edge and the
    window no longer shrinks for the keyboard. Fixed with `behavior="padding"`; passes on the real phone.
- **Screenshots:** 41 in [docs/screenshots/](docs/screenshots/), in English and Nepali. They were taken before the redesign, so the report will need new ones.

## Documents and report material

- **Design** ([docs/design/](docs/design/)):
  - [project-notes.md](docs/design/project-notes.md) (start here)
  - [feature.md](docs/design/feature.md)
  - [algorithm.md](backend/docs/algorithm.md)
  - [techstack.md](docs/design/techstack.md)
  - [database.md](backend/docs/database.md)
- **Diagrams** ([docs/diagrams/](docs/diagrams/)): architecture, ER, use case, DFD level 0 and level 1, and the class diagram. They are drawn by Python scripts.
- **Machine learning** ([docs/ml/](backend/docs/ml/)): confusion matrices, feature importance, the CV depth chart and the data sources chart. There is also the [evaluation notebook](ml/evaluation.ipynb).
- **Route benchmark** ([docs/route_gap.md](backend/docs/benchmarks/route_gap.md)): how close 2-opt gets to the exact best route.
- **Search and recommendation quality** ([docs/search_quality.md](backend/docs/benchmarks/search_quality.md), [docs/recommend_quality.md](backend/docs/benchmarks/recommend_quality.md)): search hit@1 60% → 83%, hit@3 60% → 100%, MRR 0.604 → 0.906 (51 queries); MMR adds 37% variety for 1.7% less relevance. Plan: [search-recommendation.md](docs/product/search-recommendation.md).
- **Plans:**
  - Version 1 phases [1](docs/plans/version1/phase1.md), [2](docs/plans/version1/phase2.md) and [3](docs/plans/version1/phase3.md)
  - [Version 2](docs/plans/version2/README.md)
  - [Version 3](docs/plans/version3/README.md), with the [product scope report](docs/product/beyond-college.md)
- **Survey:** [trekker survey](backend/docs/survey/trekker-survey.md), and an Apps Script that builds the Google Form.
- **Tooling:**
  - `make dev` starts the database and the API
  - [`scripts/start-demo.sh`](scripts/start-demo.sh) starts everything for a demo
  - [`scripts/verify.sh`](scripts/verify.sh) runs every check

---

## What is left

**Finishing touches:** the current focus, all on `main`.
- Re-check the welcome screen in नेपाली on the real phone (BUG-06, second fix): switch English → नेपाली and look at the Google and Create account buttons.
- Polish the design, and add the parts of the canvas left out above.
- Improve how things work wherever testing on a phone shows a problem.
- Confirm that the welcome photo (Poon Hill sunrise, taken from the design canvas) may be used, or replace it.

**Version 1 release** (see [docs/manual-tasks.md](docs/manual-tasks.md)):
- Collect survey answers, add them to the training data and retrain the model (V1-P1-18, V1-P2-14).
- Write Nepali notes for every trek stage (V1-P3-19).
- Take new screenshots for the report.
- Record the demo video, and tag `v1.0`.

**Search and recommendations** ([plan](docs/product/search-recommendation.md)):
- Run TC-66: admin tag editing, and the new labels in नेपाली. Check "Near you" on the real phone with location allowed.
- Stage 1 extras: ranking boosts (V2-SR-11), text + filters together (V2-SR-12), simple phrases like "easy trek 5 days" (V2-SR-13).
- Stage 2 (with real users) and Stage 3 (at scale) are Version 3 work (V3-SR-01 … 12).

**Version 2:**
- Phase 3 Core (safety): run TC-68 to TC-76 on a real phone with test mode on and mobile data off (rebuild the development build first, for `expo-sms`), then mark V2-P3-01/02/03/07 done. Remove the test numbers from `mobile/.env` before any release build. Cite Roach et al. 2018 in the report.
- Phase 3 Stretch, only if there is time: the daily check-in and offline treks. Otherwise they go to future scope with a Decisions row.
- Optional extras: AI-translated drafts, retraining the model from the admin panel, and Bikram Sambat dates.
- The admin page for packing items (an Extra task from V2 Phase 1).
