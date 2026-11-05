# Bato (बाटो): Smart Nepal Tourist & Trek Guide

*Find your way, trek safely.*

BCA 6th semester Project II. A mobile app to discover places in Nepal, explore treks and (in later
phases) get a personal trek-risk rating, in English or Nepali.

| Folder | What | Stack |
|---|---|---|
| [backend/](backend/) | REST API, database migrations, seed loader, tests | FastAPI, SQLAlchemy 2, Alembic, PostgreSQL 16 + pg_trgm |
| [mobile/](mobile/) | Traveller app (Android/iOS) | React Native + Expo (SDK 58), Expo Router, TanStack Query, Zustand, i18next, MapLibre |
| [admin/](admin/) | Admin panel (Phase 1: login skeleton only) | React + Vite + TypeScript |
| [data/](data/) | Seed data (places, treks with stages, permits…) | CSV / JSON, see [data/README.md](data/README.md) |
| [ml/](ml/) | Risk-prediction model (Phase 2) | NumPy, scikit-learn |
| [docs/](docs/) | Report material (screenshots, API docs) | |

**To run and check everything locally, follow [runlocal.md](runlocal.md).** One command runs all automated checks: `./scripts/verify.sh`.

The plan for this phase is in `../version1/phase1.md`.

---

## 1. Backend

Requirements: Python 3.12 via [uv](https://docs.astral.sh/uv/), PostgreSQL 16, (Redis, not used until Phase 2).

```bash
docker compose up -d               # or use a local PostgreSQL 16 / Redis
cd backend
cp .env.example .env               # then set JWT_SECRET (and GOOGLE_CLIENT_IDS for Google login)
uv sync
uv run python -m app.seed          # one command: migrate to the latest schema + load all seed data
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API docs (Swagger): http://localhost:8000/docs (use this screenshot in the report)
- Health check: http://localhost:8000/health
- Create an admin for the admin panel: `uv run python -m app.create_admin admin@example.com 'a-long-password'`

Tests (they rebuild the `snguide_test` database from the migration and seed files on every run):

```bash
uv run pytest            # 51 tests
uv run ruff check . && uv run ruff format --check .
```

### API (Phase 1)

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

**Localisation rule** ([app/core/i18n.py](backend/app/core/i18n.py)): read `Accept-Language` (`en`/`ne`),
use the matching `*_translation` row, and fall back to English for a missing row *or* a missing field.

### Where the algorithms are (for the viva)
- Haversine + nearest places: [backend/app/algorithms/haversine.py](backend/app/algorithms/haversine.py)
- Levenshtein edit distance: [backend/app/algorithms/levenshtein.py](backend/app/algorithms/levenshtein.py)
- Best time to visit (weighted scoring): [backend/app/algorithms/best_time.py](backend/app/algorithms/best_time.py)
- Fuzzy search (trigram candidates → Levenshtein ranking): [backend/app/services/search.py](backend/app/services/search.py)

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
· settings (language switch, profile, log out). All text is in `src/i18n/locales/en.json` / `ne.json`;
Noto Sans Devanagari is used everywhere.

**Google sign-in setup** (only needed for that button): in Google Cloud Console create an OAuth
*Web* client and an *Android* client (package `com.smartnepalguide.app` + the SHA-1 of your build's
signing key). Put the web client ID in `mobile/.env` (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) and in
`backend/.env` (`GOOGLE_CLIENT_IDS`), then rebuild the development build.

## 3. Admin panel

```bash
cd admin && npm install && cp .env.example .env && npm run dev   # http://localhost:5173
```
Only admins (see `create_admin` above) can log in. Content CRUD comes in Phase 3.

## Demo script (end of Phase 1)
1. Open the app → choose a language → register with email.
2. Fill in the profile (age, fitness, experience, optional health questions).
3. Explore → "Temples & Stupas" → Pashupatinath; open the Ghorepani Poon Hill trek.
4. Search "punhill" → Poon Hill is found.
5. Map → tap a marker → detail page.
6. Settings → नेपाली → menus and content switch language.
