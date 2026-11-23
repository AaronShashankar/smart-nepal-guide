# Bato (बाटो): Smart Nepal Tourist & Trek Guide

*Find your way, trek safely.*

BCA 6th semester Project II. A mobile app to discover places in Nepal, explore treks day by day and
get a personal trek difficulty & risk rating with a "Why this rating?" explanation, in English or Nepali.

**Status:** Version 1 code is complete: Phase 1 (users, explore, search, map), Phase 2 (itinerary,
acclimatisation checker, AI risk predictor) and Phase 3 (trip planner, admin panel). Still to do by
hand: the manual test table ([docs/testing/testing.md](docs/testing/testing.md), run it with [docs/testing/testing-guide.md](docs/testing/testing-guide.md)), hosting, the APK and the demo video.
**Version 2 Phase 1** (altitude chart, safer alternatives, weather, packing list,
[plan](docs/plans/version2/phase1.md)) and **Phase 2** (reviews with a Bayesian rating,
"Recommended for you" (cosine similarity), Near me, budget estimate, share a trip, teahouses,
[plan](docs/plans/version2/phase2.md)) code is done. The app has the **new UI** from the "Bato App
Redesign" canvas. V2 Phase 3 (safety & offline) is not started. All work happens on `main`.

**What has been done so far, with numbers and what is left: [PROGRESS.md](PROGRESS.md).**

| Folder | What | Stack |
|---|---|---|
| [backend/](backend/) | REST API, database migrations, seed loader, tests | FastAPI, SQLAlchemy 2, Alembic, PostgreSQL 16 + pg_trgm |
| [mobile/](mobile/) | Traveller app (Android/iOS) | React Native + Expo (SDK 58), Expo Router, TanStack Query, Zustand, i18next, MapLibre |
| [admin/](admin/) | Admin panel: content, users, reviews, stats | React + Vite + TypeScript, Mantine, MapLibre GL |
| [data/](data/) | Seed data (places, treks with stages, permits…) | CSV / JSON, see [data/README.md](data/README.md) |
| [backend/app/ml/](backend/app/ml/) | Risk model: our own CART decision tree + random forest, training, evaluation | NumPy (scikit-learn only to compare) |
| [ml/](ml/) | Evaluation notebook for the report | Jupyter |
| [docs/](docs/) | Design docs, diagrams, phase plans, testing, survey, ML results, screenshots | Markdown, see [docs/README.md](docs/README.md) |
| [scripts/](scripts/) | `start-demo.sh` (start everything), `verify.sh` (all checks) | Bash |

**To run and check everything locally, follow [runlocal.md](runlocal.md).** One command runs all automated checks: `./scripts/verify.sh`.

The phase plans are in `docs/plans/` (Version 1: [phase1](docs/plans/version1/phase1.md), [phase2](docs/plans/version1/phase2.md), [phase3](docs/plans/version1/phase3.md); [Version 2](docs/plans/version2/README.md)).
Every folder and important file is described in **[filestructure.md](filestructure.md)**.

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
uv run pytest            # 209 tests
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
| GET / POST | `/places/{id}/reviews`, `/treks/{id}/reviews` | **V2 P2.** List (visible, newest first, `page`; `mine` = your own review when logged in) / write `{rating 1–5, comment ≤ 1,000}`. Posting again **updates** your review (201 new, 200 updated); `lang` comes from `Accept-Language` |
| DELETE | `/reviews/{id}` | **V2 P2.** Your own review only (someone else's → 404) |
| GET | `/places`, `/treks`, details | **V2 P2.** Every item now has `rating: {score, count}` (Bayesian average, one grouped query); `sort=rating` |
| GET | `/recommendations?limit=10` | **V2 P2, login.** `{mode: "personal" \| "popular", items[{type, item, score, because[]}]}` (cosine similarity; "Popular now" without interests) |
| GET | `/places/near?lat=&lng=&radius_km=20&limit=20` | **V2 P2.** Bounding box → Haversine → closest first, with `distance_km` |
| GET | `/places/{id}/teahouses` | **V2 P2.** Lodges in a village; the itinerary's stages carry `teahouse_count` |
| GET | `/treks/{id}/budget` | **V2 P2.** Food + stay per day, permits at your nationality's rate, trailhead transport (defaults: medium, foreign) |
| POST | `/trips/{id}/budget` | **V2 P2.** Trip estimate (needs an optimised trip, else 409 `NOT_OPTIMISED`); saves `estimated_budget_npr` |
| POST / DELETE | `/trips/{id}/share` | **V2 P2.** Make a read-only link `{token, url, app_url}` (owner only; same link if already shared) / stop sharing |
| GET | `/shared/trips/{token}`, `/s/{token}` | **V2 P2, no login.** Read-only trip as JSON / as a small HTML page; no user data; wrong or stopped token → 404 |
| * | `/admin/...` | **Phase 3, admins only (403 otherwise).** `stats`; CRUD for `categories`, `places` (+ `photos` upload), `permits`, `treks` (whole stage list); `users` (search, `PUT /users/{id}/block`); `reviews` (`PUT /reviews/{id}/status`); **V2 P2:** `budget-rates` (GET, PUT), `teahouses` (CRUD). Full list in Swagger |

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
- **V2 P2 · Bayesian average rating:** [backend/app/algorithms/rating.py](backend/app/algorithms/rating.py) (SQL version for `sort=rating`: [services/rating.py](backend/app/services/rating.py))
- **V2 P2 · Cosine similarity (hand-written) + content-based recommender:** [algorithms/similarity.py](backend/app/algorithms/similarity.py), [services/recommend.py](backend/app/services/recommend.py) (the category → interest weight table is at the top)
- **V2 P2 · Bounding box for Near me:** [algorithms/geo_box.py](backend/app/algorithms/geo_box.py), used in [api/places.py](backend/app/api/places.py)
- **V2 P2 · Budget formula:** [services/budget.py](backend/app/services/budget.py)

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
**Optimise** → day-by-day plan and "down from X km" comparison, delete). **V2 Phase 2:** "Recommended
for you" row on Explore (sideways, with a "Because you like…" line; "Popular now" without interests;
pull to refresh) · **Near me** chip (asks for location with a clear message, `expo-location`) · stars
on cards, reviews on place and trek pages ("Write a review" sheet, your review pinned first) ·
nationality on the profile · Budget card on the trek page and **Estimate budget** on the trip ·
**Share** (Android share sheet; `smartnepalguide://shared/{token}` opens a read-only trip) ·
"Teahouses (n)" on itinerary days. **`expo-location` is native: rebuild the dev build once
(`npx expo run:android`).** All text is in `src/i18n/locales/en.json` / `ne.json`;
Plus Jakarta Sans is used for English text and Noto Sans Devanagari for Nepali.

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
- **Reviews:** filter, hide / show, and the language each review was written in. Travellers write them in the app (V2 Phase 2).
- **Teahouses** *(V2 P2)*: table + form (village, names, phone, Wi-Fi / hot shower, price note, **source required**).
- **Budget rates** *(V2 P2)*: edit the daily food / stay / transport rates per budget level and region; add a region.
- **Places** now have three entry fees: foreigner, SAARC, Nepali.

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

## Demo script (Version 2 Phase 2)
1. Profile → interests *Culture + Religious* → Explore → **Recommended for you** starts with temples and
   heritage sites ("Because you like religious places"). Change to *Nature + Adventure*, pull to refresh →
   lakes, viewpoints and treks first. A new account with no interests sees **Popular now**.
2. **Poon Hill** → **Write a review** → 4★ → it appears at once under "Your review". Admin panel →
   Reviews → **Hide** → gone from the app. Ranking example: [algorithm.md](docs/design/algorithm.md) (4.17 vs 4.48).
3. Explore → **Near me** → allow location (emulator: Extended controls → Location → Thamel 27.7154, 85.3123)
   → Kathmandu Durbar Square first, "1.3 km away".
4. Trips → **Valley** → Optimise → **Estimate budget** → food, stay, transport, entry fees for 2 days.
   Profile → budget *High* → estimate again → higher total. **EBC** → Budget card → permits at your
   nationality's rate (profile → Nationality).
5. Valley → **Share trip** → share sheet → open the link in a browser that is not logged in → read-only page.
6. EBC → itinerary → day 4 → **Teahouses (4)** → Teahouses in Tengboche.

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
6. Show [docs/route_gap.md](docs/route_gap.md) (2-opt vs exact answer) and [docs/testing/testing.md](docs/testing/testing.md).
