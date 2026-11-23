# File structure

What every folder in the Bato repository is for, and where to find things.
Generated folders such as `node_modules/`, `.venv/`, `android/` and `dist/` are left out; see [What is not in git](#what-is-not-in-git).

## Top level

```
smart-nepal-guide/
├── README.md            Project overview, status, setup for each part, algorithm list
├── PROGRESS.md          What has been done so far (features, numbers, tests, bugs) and what is left
├── runlocal.md          How to run and check everything on this laptop, step by step
├── filestructure.md     This file
├── Makefile             Backend shortcuts: make dev / seed / train / test / verify / stop
├── docker-compose.yml   PostgreSQL 16 + Redis (alternative to Homebrew)
├── backend/             FastAPI REST API, database, ML model, tests          (Python)
├── mobile/              Traveller app for Android/iOS                        (React Native + Expo)
├── admin/               Admin panel for content, users, reviews, stats       (React + Vite)
├── data/                Seed data: places, treks, permits, budget rates…     (CSV / JSON)
├── ml/                  Jupyter notebook that shows the model evaluation
├── docs/                Design docs, diagrams, plans, testing, survey, report material
└── scripts/             start-demo.sh (start everything), verify.sh (run every check)
```

## backend/

```
backend/
├── app/
│   ├── main.py              Creates the FastAPI app, adds every router, loads the active risk model
│   ├── seed.py              Loads data/ into the database (safe to re-run)
│   ├── create_admin.py      Creates an admin account (make create-admin)
│   ├── search_benchmark.py  Search test set (43 queries) → docs/search_quality.md; same cases in pytest
│   ├── recommend_benchmark.py  MMR λ: relevance vs variety → docs/recommend_quality.md
│   ├── api/                 HTTP endpoints, one file per area
│   │   ├── auth.py              register, login, Google login, refresh
│   │   ├── me.py                /me, profile, interests
│   │   ├── places.py, treks.py  explore, detail, near me, itinerary, acclimatisation, budget
│   │   ├── search.py            fuzzy search
│   │   ├── risk.py              /predict-risk and prediction history
│   │   ├── trips.py, shared.py  trip planner, optimise, share link
│   │   ├── reviews.py, recommendations.py
│   │   ├── lookups.py           categories, interests, permits
│   │   ├── admin.py, admin_community.py   admin-only endpoints
│   │   └── deps.py              shared dependencies (current user, admin guard, language)
│   ├── algorithms/          Hand-written algorithms (each one is in the report)
│   │   ├── haversine.py, geo_box.py      distance, bounding box
│   │   ├── levenshtein.py                edit distance + word-by-word similarity for search
│   │   ├── transliterate.py              Devanagari → Latin letters (schwa deletion), for search
│   │   ├── best_time.py                  best months to visit
│   │   ├── acclimatisation.py            rule-based altitude checker
│   │   ├── route.py, route_benchmark.py  nearest neighbour + 2-opt, brute force, day split
│   │   ├── rating.py                     Bayesian average rating
│   │   └── similarity.py                 cosine similarity (recommendations; MMR is in services/recommend.py)
│   ├── ml/                  Risk model, written from scratch
│   │   ├── tree.py, forest.py            CART decision tree, random forest
│   │   ├── features.py, reasons.py       inputs → features, "Why this rating?"
│   │   ├── dataset.py                    builds data/training_samples.csv (agency + survey + rule rows)
│   │   ├── train.py, evaluate.py         training with CV, report figures → docs/ml/
│   │   ├── metrics.py                    accuracy, F1, confusion matrix, k-fold
│   │   └── registry.py                   loads the active model for the API
│   ├── services/            Business logic used by api/ (budget, itinerary, recommend, risk, search…)
│   ├── models/              SQLAlchemy tables (user, content, trip, community, ml)
│   ├── schemas/             Pydantic request/response shapes
│   ├── core/                config (.env), database session, JWT/bcrypt security, language fallback
│   └── templates/           shared_trip.html (the public page for a shared trip)
├── alembic/versions/        Database migrations 0001–0006 (one per phase; 0006 = place tags, name_latin, dismissed_item)
├── tests/                   pytest: 243 tests, one file per area
├── docker/                  init-test-db.sql (creates the test database)
├── models/                  Trained .joblib model files (not in git, made by app.ml.train)
├── uploads/                 Photos uploaded in the admin panel (not in git)
├── pyproject.toml, uv.lock  Python dependencies (managed by uv)
├── alembic.ini
└── .env.example             Copy to .env (DATABASE_URL, JWT_SECRET, …)
```

## mobile/

```
mobile/
├── src/
│   ├── app/                 Screens (Expo Router: every file is a route)
│   │   ├── _layout.tsx          root layout, auth redirect, providers
│   │   ├── language.tsx, login.tsx, register.tsx, profile.tsx, predictions.tsx
│   │   ├── (tabs)/              bottom tabs: index (Explore), map, search, trips, settings
│   │   ├── place/[id].tsx       place detail
│   │   ├── trek/[id]/           trek overview (index), itinerary, risk check
│   │   ├── trip/[id].tsx        one trip: map, optimise, budget, share
│   │   ├── shared/[token].tsx   a trip someone shared
│   │   └── teahouses/[placeId].tsx
│   ├── components/          Reusable UI: cards, buttons, risk badge, stars, reviews, budget table…
│   ├── lib/                 api.ts (API address + axios), queries.ts (TanStack Query hooks), types.ts,
│   │                        storage, Google sign-in, location, map style, formatting
│   ├── store/               Zustand stores: auth (tokens), settings (language)
│   └── i18n/                i18next setup + locales/en.json, locales/ne.json (all app text)
├── assets/
│   ├── brand/               Icon and splash sources (.svg) + make_icons.py
│   └── images/              Generated icon/splash .png used by app.json
├── app.json                 Expo config (name, package com.smartnepalguide.app, plugins)
├── eas.json                 EAS build profiles (development, preview APK, production)
├── package.json             Install packages with: npx expo install <name>
└── .env.example             Copy to .env (Google client ID; do NOT put the laptop IP here, see BUG-05)
```

## admin/

```
admin/
├── src/
│   ├── main.tsx, App.tsx    Entry point and routes
│   ├── pages/               Dashboard, Places + PlaceForm, Treks + TrekForm (stage editor), Categories,
│   │                        Permits, Users, Reviews, BudgetRates, Teahouses, Login
│   ├── components/          Layout (menu), MapPicker (MapLibre), ui helpers
│   ├── api.ts, queries.ts   API calls
│   ├── auth.tsx             Login state
│   └── i18n.ts              English and Nepali text
├── public/                  favicon, icons
└── .env.example             VITE_API_URL
```

## data/

```
data/
├── README.md                What each file holds, every source with its date, known limits  ← read first
├── places.csv               69 places: coordinates, altitude, district, fees by nationality, EN/NE text
├── treks.json               8 treks with day-by-day stages, permits, EN/NE text
├── aliases.csv              Other spellings for search ("punhill", "अन्नपूर्ण")
├── place_tags.csv           Tags per place (sunrise, pilgrimage, unesco…) for recommendations and the place page
├── categories.csv, interests.csv, permits.csv
├── budget_rates.csv         Food, room, transport per budget level and region (sourced 2026-11-17)
├── teahouses.csv            Real lodges only, each with its source
├── photos.csv               Wikimedia Commons photos with author and licence
├── climate_baseline.csv, climate_regions.csv   Inputs to the approximate climate model
├── training_samples.csv     Risk-model training rows. Generated by app.ml.dataset: do not edit
└── tools/fetch_photos.py    Downloads the photo list from Wikipedia/Commons
```

## docs/

```
docs/
├── README.md                Index of everything below
├── design/                  project-notes.md (start here), feature.md, algorithm.md, techstack.md, database.md
├── diagrams/                Architecture, ER, use case, DFD, class diagrams (.png/.svg) + make_*.py
├── plans/
│   ├── version1/            phase1.md, phase2.md, phase3.md
│   ├── version2/            README.md + phase1.md, phase2.md, phase3.md
│   └── version3/            README.md + phase1.md, phase2.md, phase3.md (product, after the defense)
├── product/                 beyond-college.md (product scope report), search-recommendation.md (Stage 1–3 plan); later interviews/, competitors.md, pilot/
├── testing/                 testing.md (test cases), testing-guide.md (how to run them)
├── survey/                  trekker-survey.md, trekker-survey-form.gs (builds the Google Form)
├── ml/                      Model evaluation figures and metrics (generated by app.ml.evaluate)
├── route_gap.md             2-opt vs exact route benchmark (generated by app.algorithms.route_benchmark)
├── search_quality.md        Search test set results (generated by app.search_benchmark)
├── recommend_quality.md     MMR λ results (generated by app.recommend_benchmark)
├── screenshots/             Report screenshots
└── manual-tasks.md          Everything left to do by hand, with how to check each
```

## ml/ and scripts/

```
ml/
├── evaluation.ipynb         Runs backend/app/ml/evaluate.py and shows every figure (kernel: backend/.venv)
└── README.md                What each file in backend/app/ml/ does
scripts/
├── start-demo.sh            Starts PostgreSQL, Redis, API, admin panel and Metro; prints the phone address
└── verify.sh                Backend tests + lint, mobile typecheck + lint, admin typecheck + build + lint
```

## Where do I find…?

| I want to… | Go to |
|---|---|
| Run the project | [runlocal.md](runlocal.md) or `make dev` |
| Check everything before a commit | `./scripts/verify.sh` |
| Change a place, trek or fee | `data/` then `make seed` (or the admin panel) |
| Change app text (English/Nepali) | `mobile/src/i18n/locales/en.json`, `ne.json` |
| Add an API endpoint | `backend/app/api/` (+ logic in `services/`, shapes in `schemas/`, test in `tests/`) |
| Add a screen | `mobile/src/app/` (the file path is the route) |
| Change the database | `backend/app/models/` + a new migration in `backend/alembic/versions/` |
| Find an algorithm for the report | `backend/app/algorithms/` and `backend/app/ml/`; explained in `docs/design/algorithm.md` |
| Get report figures | `docs/diagrams/`, `docs/ml/`, `docs/screenshots/` |
| See what is left to do | `docs/manual-tasks.md` and the Bato Project Tracker sheet |

## What is not in git

These are made on each computer and listed in `.gitignore`: `.env` files (secrets), `node_modules/`,
`backend/.venv/`, `backend/models/` (trained models: `make train`), `backend/uploads/` (admin photos),
`.logs/` (start-demo.sh logs), `dist/`, caches, and `mobile/android/` + `mobile/ios/` (generated by
`npx expo run:android`; never edit them by hand, change `app.json` instead).
