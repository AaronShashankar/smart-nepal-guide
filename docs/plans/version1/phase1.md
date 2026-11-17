# Version 1 · Phase 1 — Setup, Users & Explore

**Weeks:** about 4–6 of the semester (Gantt "Sprint 1: auth, profile, explore, map")
**Goal:** a working app on a real phone where a traveller can sign up, fill in a profile, browse and search places and treks, and see them on a map, in English or Nepali.

Next: [phase2.md](phase2.md) · Plan sources: [feature.md](../../design/feature.md), [techstack.md](../../design/techstack.md), [database.md](../../design/database.md), [algorithm.md](../../design/algorithm.md)

---

## Demo at the end of this phase
1. Open the app → choose a language → register with email.
2. Fill in the profile (age, fitness, experience, optional health questions).
3. Browse "Temples" and open Pashupatinath; open the Poon Hill trek overview.
4. Type "punhill" in search → Poon Hill is found (fuzzy search).
5. Open the map → markers → tap one → detail page.
6. Switch to नेपाली → the menus and the content change language.

---

## 1. Project setup (first 3–4 days)

### Repository
- [x] One git repo `smart-nepal-guide/` with `backend/`, `ml/`, `mobile/`, `admin/`, `data/`, `docs/`
- [x] `.gitignore`, `.env.example` (never commit real keys), `README.md` with how to run each part
- [x] `docker-compose.yml` with PostgreSQL 16 and Redis

### Backend (FastAPI)
- [x] Structure: `app/main.py`, `app/core/` (config, security, db), `app/models/`, `app/schemas/`, `app/api/`, `app/services/`, `app/algorithms/`
- [x] SQLAlchemy 2 + Alembic migrations, settings from `.env` with pydantic-settings
- [x] `GET /health`, auto docs at `/docs` (Swagger, which also goes in the report)
- [x] Tooling: ruff (lint and format), pytest with a test database

### Mobile (React Native + Expo, TypeScript)
- [x] `npx create-expo-app` with TypeScript and Expo Router (or React Navigation)
- [x] **Development build** (`expo-dev-client`) from day one: MapLibre and Google sign-in do not run in Expo Go
- [x] TanStack Query for API calls, a small `api.ts` client (axios/fetch) that adds `Authorization` and `Accept-Language` headers
- [x] Zustand for auth and language state; `expo-secure-store` for the token
- [x] i18next + react-i18next with `en.json` and `ne.json`; font with Devanagari support (Noto Sans Devanagari)
- [x] ESLint + Prettier

### Admin (React + Vite)
- [x] Only the skeleton and the login page in this phase (content CRUD comes in Phase 3; until then data comes from seed files)

---

## 2. Database (Alembic migrations)

Create these tables from [database.md](../../design/database.md) (everything Explore needs, including trek stages so Phase 2 can start straight away):

- [x] Extension `pg_trgm`; all enums
- [x] `user`, `traveller_profile`, `interest` + `interest_translation`, `user_interest`
- [x] `category` + `category_translation`
- [x] `place`, `place_translation`, `place_alias`, `place_photo`, `place_climate`
- [x] `trek`, `trek_translation`, `trek_stage`, `stage_translation`
- [x] `permit` + `permit_translation`, `trek_permit`
- [x] Indexes: trigram GIN on `place_translation.name` and `place_alias.alias`; `(latitude, longitude)` on place

---

## 3. Backend API

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/auth/register` | email + password, bcrypt hash |
| POST | `/auth/login` | returns JWT access token (HS256) + refresh token |
| POST | `/auth/google` | verifies the Google ID token, creates the user if new |
| POST | `/auth/refresh` | new access token |
| GET / PATCH | `/me` | name, phone, preferred language |
| GET / PUT | `/me/profile` | traveller profile + interests |
| GET | `/categories` | localised names |
| GET | `/places` | filters: `category`, `district`, `province`, `q`, bounding box for the map; paginated |
| GET | `/places/{id}` | details, photos, best months, nearby places (Haversine, closest 5) |
| GET | `/treks` | filters: `region`, `min_days`, `max_days`, `difficulty` |
| GET | `/treks/{id}` | overview, permits, start/end place (derived from the first and last stage) |
| GET | `/search?q=` | places + treks; trigram similarity on names and aliases, Levenshtein to rank |

**Localisation rule (write once, used everywhere):** read `Accept-Language` (`en` or `ne`), join the matching `*_translation` row, and fall back to English if the Nepali row is missing.

---

## 4. Mobile screens

- [x] Language choice (first launch) and Settings → language switch
- [x] Login, Register, "Continue with Google"
- [x] Profile form: date of birth, fitness level, trek experience, health questions (optional, with a short note on why they are asked), budget, travel style, interests
- [x] Explore (home): category chips, place list, trek list
- [x] Place detail: photo carousel, description, best season, entry fee, how to reach, nearby places
- [x] Trek overview: region, days, max altitude, base difficulty, permits (the itinerary comes in Phase 2)
- [x] Map: MapLibre + OpenStreetMap tiles, markers by category, tap → detail
- [x] Search with filters (region, duration, difficulty)
- [x] Loading, empty and error states on every list

---

## 5. Data (start now, it is the biggest risk)

- [x] Seed files in `data/`: `places.csv`, `treks.json` (with day-by-day stages), `aliases.csv`, `permits.csv`, `categories.csv`
- [x] A seed script: `python -m app.seed` loads everything into the database
- [x] **Places:** 40–60 (temples, lakes, viewpoints, national parks, trek villages); coordinates, altitude, district, fee, English text
- [x] **Treks:** 8–10 with full stages (Poon Hill, Annapurna Base Camp, Everest Base Camp, Langtang Valley, Mardi Himal, Annapurna Circuit, Gosaikunda, Manaslu…): from/to place, distance, walking hours, highest point
- [x] Nepali text for at least the categories and the 10 most important places (the rest can be machine drafts, reviewed later)
- [x] Photos: use your own or openly licensed ones; record the source and licence for each (needed for the report)
- [ ] **Launch the trekker survey (Google Form)** now so answers are ready for Phase 2's training data

---

## 6. Tests
- [x] Register → login → `/me` works; wrong password fails; expired token is rejected
- [x] Profile save and load
- [x] Search: "punhill", "anapurna" and "अन्नपूर्ण" find the right items
- [x] Translation fallback: a place with no Nepali row returns English
- [x] Haversine against a known distance (Kathmandu → Pokhara ≈ 145 km straight line)

---

## Done when
- [ ] All the demo steps above work on a real Android phone
- [x] Seed data loads from scratch with one command
- [x] Tests pass
- [ ] Screenshots taken for the report (login, profile, explore, detail, map, search, both languages)

## Risks
| Risk | What to do |
|---|---|
| Map or Google login breaks in Expo Go | Use the development build from the start |
| Data collection takes longer than coding | Collect a little every day; the treks with stages matter most |
| Spending too long on design | Use one simple component library; polish in Phase 3 |
