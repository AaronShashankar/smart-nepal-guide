# Bato (Smart Nepal Tourist & Trek Guide) — Tech Stack

Drafted 2026-11-05. Languages: **English (primary)**, **Nepali (secondary)**.
See also: [feature.md](feature.md) · [algorithm.md](algorithm.md) · [project-notes.md](project-notes.md)

---

## 1. Stack Overview

| Layer | Choice | Why |
|---|---|---|
| **Mobile app** | **React Native + Expo + TypeScript** | The team already knows React Native; one codebase for Android and iOS |
| **Admin panel** | **React + Vite + TypeScript** | Shares the language, types and i18n setup with the mobile app |
| **Backend API** | **Python + FastAPI** | The ML is in Python, so the backend and model share one language; WebSocket built in; automatic API docs |
| **ML** | **NumPy** (own decision tree **and** random forest) + **scikit-learn** (only to compare) + **matplotlib** (report figures) | Write your own algorithms, then compare them with the library versions |
| **Database** | **PostgreSQL** (+ `pg_trgm` extension) | Full Unicode support for Nepali; trigram fuzzy search |
| **Translation** | **i18next** + an AI translation script/service (LLM API or Google Cloud Translation) | Automatic English → Nepali with human review |
| **Cache / jobs** | **Redis** + **APScheduler** | Weather caching, daily check-in job |
| **Maps** | **MapLibre** (`@maplibre/maplibre-react-native`) + **OpenStreetMap** | Free; supports offline map regions |
| **Weather** | **Open-Meteo** | Free, no API key |
| **Push notifications** | `expo-notifications` (Firebase Cloud Messaging underneath) | Check-in reminders, weather alerts |
| **Images** | Cloudinary (free tier) or local storage | Place and trek photos |
| **Deployment** | Docker + Render, Railway or a VPS; **EAS Build** for the app | Easy to demo online |
| **Team tools** | Git + GitHub, Figma, Postman, Trello/Jira | Covers the syllabus's "project management & collaboration" unit |

---

## 2. Mobile App Packages (React Native / Expo)

| Purpose | Package |
|---|---|
| Multi-language | `i18next`, `react-i18next`, `expo-localization` |
| Nepali dates (Bikram Sambat) | an npm BS converter such as `nepali-date-converter` |
| Nepali digits | small helper mapping 0–9 → ०–९ (more reliable than `Intl` on all phones) |
| Nepali font | `expo-font` + Noto Sans Devanagari / Mukta |
| API + caching | `@tanstack/react-query` + `axios` |
| State | `zustand` |
| Navigation | `expo-router` |
| Location | `expo-location` |
| Maps + offline regions | `@maplibre/maplibre-react-native` |
| Offline database | `expo-sqlite` (+ Drizzle ORM) |
| Charts (altitude graph) | `react-native-gifted-charts` or `victory-native` |
| SMS (SOS) | `expo-sms` |
| Secure token storage | `expo-secure-store` |
| Push notifications | `expo-notifications` |

## 3. Admin Panel Packages (React)

| Purpose | Package |
|---|---|
| Multi-language | `i18next`, `react-i18next` |
| API + caching | `@tanstack/react-query` + `axios` |
| Routing | `react-router` |
| UI components | MUI or shadcn/ui |
| Maps | Leaflet (`react-leaflet`) + OpenStreetMap |
| Charts (dashboard) | Recharts |

## 4. Backend Libraries (Python)

| Purpose | Library |
|---|---|
| API + WebSocket | `fastapi`, `uvicorn` |
| Database | `sqlalchemy`, `alembic` (migrations), `psycopg` |
| Validation | `pydantic` |
| Auth | `pyjwt`, `passlib[bcrypt]`, `authlib` (Google login) |
| ML | `numpy`, `joblib` (serving); `scikit-learn`, `matplotlib`, `ipykernel` (evaluation, uv group `ml`) |
| Jobs | `apscheduler` |
| Email | `fastapi-mail` (SMTP) |
| Translation | LLM SDK or `google-cloud-translate` |

---

## 5. Bilingual Design (English + Nepali)

### 5.1 App text (buttons, labels, messages)
- Translation files with i18next:
  - `locales/en.json`: `"explore": "Explore"`
  - `locales/ne.json`: `"explore": "अन्वेषण गर्नुहोस्"`
- **English is the default and fallback.** A missing Nepali string shows in English.
- Language switch in Settings, saved on the device and in the user's profile.
- The mobile app and admin panel can share the same translation-file structure.

### 5.2 Database content: translation tables
```
place                     place_translation
──────────                ─────────────────────────────
id                        place_id  → place.id
latitude                  lang       ('en' | 'ne')
longitude                 name
altitude                  description
category                  how_to_reach
                          best_season_note
                          is_machine_translated (bool)
                          is_reviewed (bool)
```
- The same pattern applies to `trek`, `trek_stage`, `permit` and `packing_item`.
- **Why:** clean and normalised, looks good in the ER diagram, and adding a third language later needs no schema change.
- (Simpler alternative: a JSONB column `name: {"en": "...", "ne": "..."}`, quicker to build but a weaker ER diagram.)

### 5.3 API language: `Accept-Language` header
- The app sends `Accept-Language: ne` (or `en`) with every request.
- The backend returns that language and falls back to English when a translation is missing.
- A standard HTTP mechanism, good for the protocols section of the report.

### 5.4 AI explanations ("Why this rating?")
- The decision tree returns **reason codes** (e.g. `HIGH_DAILY_GAIN`, `BEGINNER`, `WINTER_SEASON`).
- The app turns the codes into sentences with templates:
  - EN: `"Day {day} climbs {gain} m, which is risky for beginners."`
  - NE: `"दिन {day} मा {gain} मिटर चढाइ छ, जुन नयाँ ट्रेकरका लागि जोखिमपूर्ण छ।"`
- Keeping the logic and the wording separate is a good design pattern to mention in the report.

### 5.5 Numbers & dates
- Nepali digits when Nepali is selected: 1,234 → १,२३४
- Bikram Sambat dates shown with AD dates: "15 Nov 2026" / "२९ कात्तिक २०८३"
- Units (m, km, NPR) stay the same in both languages.

### 5.6 Fonts
- Noto Sans Devanagari or Mukta (Google Fonts) so Nepali renders correctly on every phone.

### 5.7 Search in both languages
- Users may type "Annapurna", "अन्नपूर्ण" or "anapurna".
- Store **aliases** for each place: English, Devanagari, and common romanised spellings.
- PostgreSQL `pg_trgm` trigram similarity + your own Levenshtein algorithm for typos.

### 5.8 SOS SMS
- A Nepali (Unicode) SMS fits only **70 characters**, while an English one fits **160**.
- So send the SOS in **English or romanised text**, as one short SMS with a location link, even when the app is in Nepali.

### 5.9 Admin panel
- Every content form has **EN / NE tabs**; English is required, Nepali optional.
- **"Auto-translate" button** fills the Nepali tab using AI.
- **"Missing / unreviewed translations" report** lists items to check.

---

## 6. AI-Assisted Translation

### Two kinds of text
| Text type | Example | Approach |
|---|---|---|
| **App text** (fixed) | "Explore", "Plan Trip", "Login" | **AI-translate once at build time**: a script generates `ne.json` from `en.json` |
| **Database content** (dynamic) | Place descriptions, trek stages, permit info | **AI-translate when the admin saves** and store the Nepali version in the database |

### Options
1. **Localization platforms with machine translation:** Tolgee, Crowdin, Locize, Lingo.dev. They connect to i18next, translate the JSON files automatically, and provide a review dashboard.
2. **LLM API (e.g. Claude) or Google Cloud Translation** (chosen approach):
   - **App text:** a script sends `en.json` to the AI with a **glossary** and the instruction "polite, simple Nepali for tourists", then writes `ne.json`.
   - **Database content:** the backend calls the AI when the admin saves English content, stores the Nepali draft, and marks it **"machine translated – needs review"**.
3. **Self-hosted open-source models (bonus):** Meta **NLLB-200** or AI4Bharat **IndicTrans2**, both of which support Nepali. These are free but heavier to set up, and running them would count towards the syllabus's "Application of GPUs" unit.

### Rules
1. **Never translate live in the app on every screen.** It breaks offline mode, makes screens slow, costs money on every view, and exposes the API key. Translate once and store the result.
2. **A human must review safety text:** altitude sickness warnings, SOS instructions, the symptom checker.
3. **Use a glossary** so place and permit names stay consistent (Annapurna → अन्नपूर्ण, TIMS → TIMS).
4. **Fall back to English** when a Nepali translation is missing.
5. API keys stay on the **backend only**, never in the mobile app.

### Translation flow
```
Developer writes en.json ──► AI translate script ──► ne.json ──► human review ──► app build
Admin saves English place ──► Backend calls AI ──► Nepali draft (needs review) ──► Admin approves
App sends Accept-Language: ne ──► API returns Nepali (falls back to English)
```

---

## 7. Architecture

```
 Mobile App (React Native + Expo)      Admin Panel (React)
   │  SQLite + offline map regions            │
   │                                          │
   └──────── HTTPS / REST + JWT ──────────────┘
             Accept-Language: en | ne
                     │
             FastAPI Backend ── WebSocket (live location)
                     │
   ┌──────────┬──────┴──────┬────────────┬──────────────┬───────────────┐
 PostgreSQL  ML Service    Open-Meteo    FCM Push    SMS / SMTP     AI Translation
            (Decision Tree  (weather)                                (LLM / Google)
             / Random Forest)
```
