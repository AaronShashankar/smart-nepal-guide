# Bato (बाटो): Smart Nepal Tourist & Trek Guide

*Find your way, trek safely.*

BCA 6th semester Project II. A mobile app to discover places in Nepal, explore treks day by day and
get a personal trek difficulty & risk rating with a "Why this rating?" explanation, in English or Nepali.

**Status:** Version 1 code is complete: Phase 1 (users, explore, search, map), Phase 2 (itinerary,
acclimatisation checker, AI risk predictor) and Phase 3 (trip planner, admin panel). Still to do by
hand: the manual test table ([docs/testing.md](docs/testing.md), run it with [docs/testing-guide.md](docs/testing-guide.md)), hosting, the APK and the demo video.

| Folder | What | Stack |
|---|---|---|
| [backend/](backend/) | REST API, database migrations, seed loader, tests | FastAPI, SQLAlchemy 2, Alembic, PostgreSQL 16 + pg_trgm |
| [mobile/](mobile/) | Traveller app (Android/iOS) | React Native + Expo (SDK 58), Expo Router, TanStack Query, Zustand, i18next, MapLibre |
| [admin/](admin/) | Admin panel: content, users, reviews, stats | React + Vite + TypeScript, Mantine, MapLibre GL |
| [data/](data/) | Seed data (places, treks with stages, permits…) | CSV / JSON, see [data/README.md](data/README.md) |
| [backend/app/ml/](backend/app/ml/) | Risk model: our own CART decision tree + random forest, training, evaluation | NumPy (scikit-learn only to compare) |
| [ml/](ml/) | Evaluation notebook for the report | Jupyter |
| [docs/](docs/) | Report material (screenshots, ML figures, route benchmark, test cases) | |

**To run and check everything locally, follow [runlocal.md](runlocal.md).** One command runs all automated checks: `./scripts/verify.sh`.

The phase plans are in `../version1/` ([phase1](../version1/phase1.md), [phase2](../version1/phase2.md), [phase3](../version1/phase3.md)).

---

> **Quick start on this laptop (V1 is hosted here):** after the first-time setup below, `./scripts/start-demo.sh`
> starts the database, API, admin panel and Metro in one go (see [runlocal.md](runlocal.md) → Day-to-day).

## 1. Backend

Requirements: Python 3.12 via [uv](https://docs.astral.sh/uv/), PostgreSQL 16 (Redis is in docker-compose but not used yet).

```bash
docker compose up -d               # or use a local PostgreSQL 16 / Redis
cd backend
cp .env.example .env               # then set JWT_SECRET (and GOOGLE_CLIENT_IDS for Google login)
uv sync
uv run python -m app.seed          # one command: migrate to the latest schema + load all seed data
uv run python -m app.ml.train      # train the risk model (tree + forest) and activate the better one
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API docs (Swagger): http://localhost:8000/docs (use this screenshot in the report)
- Health check: http://localhost:8000/health
- Create an admin for the admin panel: `uv run python -m app.create_admin admin@example.com 'a-long-password'`

Tests (they rebuild the `snguide_test` database from the migration and seed files on every run):

```bash
uv run pytest            # 129 tests
uv run ruff check . && uv run ruff format --check .
```

### API

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/auth/register` | email + password (bcrypt) → access + refresh JWT (HS256) |
| POST | `/auth/login` | |
| POST | `/auth/google` | verifies a Google ID token, creates the user if new |
| POST | `/auth/refresh` | new token pair |
| GET / PATCH | `/me` | name, phone, preferred language |
| GET / PUT | `/me/profile` | traveller profile + interests |
| GET | `/categories`, `/interests` | localised names |
| GET | `/places` | `category`, `district`, `province`, `q`, map bounding box (`min_lat`, `min_lng`, `max_lat`, `max_lng`), `page`, `page_size` |
| GET | `/places/{id}` | photos, best months (weighted scoring), 5 nearest places (Haversine) |
| GET | `/treks`, `/treks/regions` | `region`, `min_days`, `max_days`, `difficulty` |
| GET | `/treks/{id}` | overview, permits, start/end place derived from first/last stage |
| GET | `/search?q=` | pg_trgm candidates (names + aliases, any language) ranked by our own Levenshtein |
| GET | `/treks/{id}/stages` | **Phase 2.** Day-by-day itinerary (sleeping altitude, gain, km, hours, highest point, rest days) + summary computed from it (max daily gain…) |
| GET | `/treks/{id}/acclimatisation` | **Phase 2.** Per-day `ok` / `caution` / `danger`, reason codes, suggested rest days |
| POST | `/predict-risk` | **Phase 2.** `{trek_id, month}` → `{level, confidence, reasons[], acclimatisation, input}`; needs a profile with date of birth, fitness and experience (else 409 `PROFILE_INCOMPLETE`); saved to history |
| GET | `/me/predictions` | **Phase 2.** The user's risk history, newest first |
| GET / POST | `/trips` | **Phase 3.** The user's trips / new trip (`title`, optional `start_date`, `place_ids`) |
| GET / PATCH / DELETE | `/trips/{id}` | **Phase 3.** Trip with stops and day plan / rename, start date / soft delete. Only the owner sees a trip (others get 404) |
| POST | `/trips/{id}/stops` | **Phase 3.** Add a place (`visit_hours`, default 1.5); the same place twice → 409. Changing stops clears the plan |
| DELETE | `/trips/{id}/stops/{stop_id}` | **Phase 3.** Remove a stop |
| POST | `/trips/{id}/optimise` | **Phase 3.** Optional `{start_lat, start_lng}` → visiting order (nearest neighbour + 2-opt), days (greedy, 8 h/day), `total_km`, and `nearest_neighbour_km` for comparison |
| * | `/admin/...` | **Phase 3, admins only (403 otherwise).** `stats`; CRUD for `categories`, `places` (+ `photos` upload), `permits`, `treks` (whole stage list); `users` (search, `PUT /users/{id}/block`); `reviews` (`PUT /reviews/{id}/status`). Full list in Swagger |

**Localisation rule** ([app/core/i18n.py](backend/app/core/i18n.py)): read `Accept-Language` (`en`/`ne`),
use the matching `*_translation` row, and fall back to English for a missing row *or* a missing field.

### Where the algorithms are (for the viva)
- Haversine + nearest places: [backend/app/algorithms/haversine.py](backend/app/algorithms/haversine.py)
- Levenshtein edit distance: [backend/app/algorithms/levenshtein.py](backend/app/algorithms/levenshtein.py)
- Best time to visit (weighted scoring): [backend/app/algorithms/best_time.py](backend/app/algorithms/best_time.py)
- Fuzzy search (trigram candidates → Levenshtein ranking): [backend/app/services/search.py](backend/app/services/search.py)
- Acclimatisation checker (rule-based): [backend/app/algorithms/acclimatisation.py](backend/app/algorithms/acclimatisation.py)
- **CART decision tree (Gini), from scratch:** [backend/app/ml/tree.py](backend/app/ml/tree.py)
- **Random forest (bootstrap + √n features + vote), from scratch:** [backend/app/ml/forest.py](backend/app/ml/forest.py)
- "Why this rating?" (decision-path tracing): [backend/app/ml/reasons.py](backend/app/ml/reasons.py)
- Metrics, stratified split, k-fold CV (hand-written): [backend/app/ml/metrics.py](backend/app/ml/metrics.py)
- **Trip planner (distance matrix, nearest neighbour, 2-opt, brute force, greedy day split):** [backend/app/algorithms/route.py](backend/app/algorithms/route.py); 2-opt vs exact benchmark: [route_benchmark.py](backend/app/algorithms/route_benchmark.py) → [docs/route_gap.md](docs/route_gap.md)

### Risk model (Phase 2)

```bash
cd backend
uv run python -m app.ml.dataset    # rebuild data/training_samples.csv (add --survey form.csv for survey answers)
uv run python -m app.seed          # load it into training_sample
uv run python -m app.ml.train      # 5-fold CV for depth, train tree + forest, save to backend/models/, activate the better
uv run python -m app.ml.evaluate   # figures + comparison with scikit-learn → docs/ml/
```

- **Features (10):** max altitude, biggest one-day sleeping gain above 3,000 m, total days, km per
  day, winter flag, monsoon flag (the month becomes these two flags), age, fitness, experience, health
  issue (heart condition or asthma). **Label:** easy / moderate / hard / risky.
- **Data:** 592 rows = 32 agency ratings + 560 rule-generated rows (scoring rule and 8% label noise
  documented in [dataset.py](backend/app/ml/dataset.py)); survey answers are added with `--survey`.
- **Current results** (118-row test set, seed 42), see [docs/ml/comparison.md](docs/ml/comparison.md):

  | Model | Accuracy | Macro F1 |
  |---|---|---|
  | Our decision tree (depth 8) | 0.669 | 0.678 |
  | **Our random forest (50 trees) — active** | **0.814** | **0.815** |
  | scikit-learn decision tree | 0.661 | 0.669 |
  | scikit-learn random forest | 0.805 | 0.807 |

- The API loads the active `ml_model` at startup and reloads it when another becomes active (no restart).
  Model files (`backend/models/`) are not committed: run `app.ml.train` after cloning.
- The acclimatisation rule: above 3,000 m a sleeping gain over 500 m is *caution*; more than 1,000 m
  gained since the last rest day is *danger* with a suggested rest day. A standard EBC itinerary passes
  (cautions only); the same itinerary without its rest days is flagged.

## 2. Mobile app

MapLibre and Google sign-in contain native code, so the app runs in a **development build**, not Expo Go.

```bash
cd mobile
npm install
cp .env.example .env     # EXPO_PUBLIC_API_URL = http://<your computer's LAN IP>:8000 for a real phone
npx expo run:android     # local build (needs Android Studio / SDK), or:
npx eas-cli@latest build --profile development --platform android   # cloud build → install the APK
npx expo start           # then open the dev build on the phone
```

Checks: `npx tsc --noEmit`, `npx expo lint` (ESLint + Prettier), `npx expo-doctor`.

Screens: language choice (first launch) · login / register / Continue with Google · traveller profile
(with optional health questions) · Explore (category chips, treks, places) · place detail (photo carousel,
best season, fee, how to reach, nearby) · trek overview (stats, route, permits) · map (OSM tiles,
markers coloured by category, tap → detail) · search with trek filters (region, duration, difficulty)
· settings (language switch, profile, risk history, log out). **Phase 2:** day-by-day itinerary with a
coloured acclimatisation badge per day and a summary box · "Check my risk" (month picker → level,
confidence, "Why this rating?", acclimatisation warnings; asks to complete the profile first) · risk
history (Settings → My risk checks). **Phase 3:** "Add to My Trip" on place detail (choose a trip or
make a new one) · Trips tab · trip screen (map with numbered stops coloured by day, remove stops,
**Optimise** → day-by-day plan and "down from X km" comparison, delete). All text is in `src/i18n/locales/en.json` / `ne.json`;
Noto Sans Devanagari is used everywhere.

**Google sign-in setup** (only needed for that button): in Google Cloud Console create an OAuth
*Web* client and an *Android* client (package `com.smartnepalguide.app` + the SHA-1 of your build's
signing key). Put the web client ID in `mobile/.env` (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) and in
`backend/.env` (`GOOGLE_CLIENT_IDS`), then rebuild the development build.

## 3. Admin panel

```bash
cd admin && npm install && cp .env.example .env && npm run dev   # http://localhost:5173
npm run build && npm run lint                                    # checks
```
Only admins (see `create_admin` above) can log in. Screens (English / नेपाली switch in the header):

- **Dashboard:** counts (users, places, treks, trips, reviews, risk predictions) and a bar chart of predictions per level.
- **Places:** search and category filter → form with **English / नेपाली tabs**, map picker (click or drag
  the pin), aliases, optional 12-month climate, photo upload (JPEG/PNG/WebP, 5 MB) and delete.
- **Treks:** form + **stage editor** (add day, from/to place, km, hours, highest point, notes, move up/down,
  remove; same from and to = rest day) and permits. Totals (days, km, highest point) are worked out from the stages.
- **Categories, Permits:** table + form. A category with places, a permit used by a trek, or a place used in a
  trek stage cannot be deleted (409).
- **Users:** search, block / unblock (a blocked user is logged out at once and cannot log in again).
- **Reviews:** filter, hide / show. (Writing reviews in the app is Version 2.)

Notes: uploaded photos go to `backend/uploads/` (not committed) and are served at `/uploads/...`.
Deletes are soft (`deleted_at`). **Running `app.seed` again overwrites admin edits to seeded places and
treks** (it never deletes what the admin added), so after the panel is in use, edit content there.

## Demo script (Phase 1)
1. Open the app → choose a language → register with email.
2. Fill in the profile (age, fitness, experience, optional health questions).
3. Explore → "Temples & Stupas" → Pashupatinath; open the Ghorepani Poon Hill trek.
4. Search "punhill" → Poon Hill is found.
5. Map → tap a marker → detail page.
6. Settings → नेपाली → menus and content switch language.

## Demo script (Phase 2, mid-term defense)
1. Open **Everest Base Camp Trek** → **Day-by-day itinerary** → days 1–11 with altitude, gain, km and
   hours; days 3 and 6 are rest days at Namche and Dingboche.
2. Days 2 (+830 m), 5 (+550 m) and 7 (+530 m) show **Caution**; the summary box says the itinerary
   passes. Compare **Annapurna Base Camp**: day 5 (Deurali → ABC, +930 m) is **Add rest**, with "Rest at Deurali (Annapurna) before day 5".
3. Back → **Check my risk** → January, with the profile set to fitness *Medium*, experience *None*
   → **Risky**, with reasons such as "no multi-day trekking experience", "goes up to 5,644 m",
   "gains 830 m on day 2".
4. Settings → profile: experience *Experienced*, fitness *High* → check October → **Hard**, with
   different reasons (altitude and daily gain only).
5. Settings → **My risk checks** shows both results.
6. Show `docs/ml/comparison.md`, the confusion matrices and `feature_importance.png` (or run
   `ml/evaluation.ipynb`): our tree and forest against scikit-learn on the same split.

## Demo script (Phase 3, final defense)
1. App → **Pashupatinath** → **Add to My Trip** → new trip "Valley". Add Boudhanath, Swayambhunath,
   Patan Durbar Square, Bhaktapur Durbar Square and Nagarkot the same way.
2. **Trips** tab → Valley → **Optimise** → 2 days, 31.3 km ("Nearest neighbour gave 38.8 km; 2-opt
   shortened it to 31.3 km."); the map shows numbered stops in order, coloured by day.
3. Admin panel → **Places → New place**, English and नेपाली names, click the map, save, upload a photo
   → in the app pull to refresh: the place is in Explore and in search.
4. Admin → **Treks → Everest Base Camp** → remove the two rest days → save → in the app the itinerary
   has 9 days and shows **Add rest** warnings. (Put them back afterwards, or run `app.seed`.)
5. Admin → **Users** → block the traveller → the app logs out, and logging in says the account is blocked.
6. Show [docs/route_gap.md](docs/route_gap.md) (2-opt vs exact answer) and [docs/testing.md](docs/testing.md).
