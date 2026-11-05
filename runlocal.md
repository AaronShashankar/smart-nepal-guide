# Run the project locally

How to run and check every part of Bato on your Mac.
Run each command from the repository root (`smart-nepal-guide/`) unless a step says otherwise.

| Part | Runs at | Terminal |
|---|---|---|
| Backend API | http://localhost:8000 (docs at `/docs`) | Terminal 1 |
| Mobile app | Android emulator or your phone | Terminal 2 |
| Admin panel | http://localhost:5173 | Terminal 3 |

---

## 0. Prerequisites (already on this Mac)

| Tool | Check | Used for |
|---|---|---|
| PostgreSQL 16 | `pg_isready` → "accepting connections" | database (Homebrew service) |
| Redis | `redis-cli ping` → `PONG` | not used until Phase 2 |
| uv (Python 3.12) | `uv --version` | backend |
| Node.js + npm | `node -v` | mobile + admin |
| Android Studio, SDK, JDK 17 | `adb version`, `java -version` | building the Android app |
| Emulator `Medium_Phone` | `emulator -list-avds` | testing without a phone |

If Postgres or Redis is stopped: `brew services start postgresql@16` / `brew services start redis`.

On a new machine, set up the databases once with these commands. They have already been run on this Mac.
```bash
psql -d postgres -c "CREATE ROLE snguide LOGIN PASSWORD 'snguide' CREATEDB"
psql -d postgres -c "CREATE DATABASE snguide OWNER snguide"
psql -d postgres -c "CREATE DATABASE snguide_test OWNER snguide"
cp backend/.env.example backend/.env    # then put a random value in JWT_SECRET
```

---

## 1. Automated checks (run these first, ~1 minute)

```bash
./scripts/verify.sh
```

This runs:
- **backend:** ruff lint and format check, a check that the migrations match the models, and the 51 pytest tests;
- **mobile:** the TypeScript typecheck and ESLint;
- **admin:** the build and lint.

The run is good if it ends with **"All checks passed."**
The tests cover register/login, the wrong-password case, the expired-token case, profile save and load,
the fuzzy search cases ("punhill", "anapurna", "अन्नपूर्ण"), the English fallback, and the Haversine
distance from Kathmandu to Pokhara.

---

## 2. Backend — Terminal 1

```bash
cd backend
uv sync                                   # install Python packages (first time / after changes)
uv run python -m app.seed                 # migrate the schema and load data/ (safe to re-run)
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
`--host 0.0.0.0` lets your phone reach the API over Wi-Fi. Keep this terminal open.

**Check it works:**
1. http://localhost:8000/health should show `{"status":"ok"}`.
2. Open http://localhost:8000/docs → `GET /search` → **Try it out** → set `q` to `punhill` → **Execute**.
   Poon Hill should be the first result.
3. Do the same in Nepali: in Terminal 4, run
   ```bash
   curl -s -H "Accept-Language: ne" "http://localhost:8000/search?q=punhill"
   curl -s "http://localhost:8000/treks?difficulty=easy"
   ```
   The first command should return `"पुन हिल"`.

An admin account for the admin panel already exists (`admin@example.com` / `admin-pass-2026`).
To make another one:
```bash
uv run python -m app.create_admin you@example.com 'a-long-password'
```

---

## 3. Mobile app — Terminal 2

The app uses MapLibre and Google sign-in, which contain native code. So it runs as a
**development build** (your own debug app), **not in Expo Go**.

### Option A — Android emulator (easiest)
```bash
emulator -avd Medium_Phone &              # or start it from Android Studio → Device Manager
cd mobile
npm install                               # first time / after package changes
npx expo run:android                      # builds and installs the app, then starts Metro
```
- The **first build takes 5–15 minutes**; later builds are much faster.
- No `.env` is needed for the emulator. The app's default API URL, `http://10.0.2.2:8000`, means
  "my computer" from inside the emulator.

### Option B — your Android phone
1. On the phone, open **Settings → About phone** and tap **Build number** 7 times. Then go to
   **Developer options** and turn on **USB debugging**.
2. Connect the phone by USB. Run `adb devices`; the phone should be listed as `device`. Accept the
   prompt on the phone if one appears.
3. Make sure the phone is on the **same Wi-Fi** as the Mac. Then tell the app where the API is
   (this Mac's IP is currently `192.168.1.66`; check it with `ipconfig getifaddr en0`):
   ```bash
   cd mobile
   cp .env.example .env
   # edit .env:  EXPO_PUBLIC_API_URL=http://192.168.1.66:8000
   npx expo run:android --device          # pick your phone from the list
   ```
4. Next time you only need `npx expo start`, then open the **Bato** app on the phone.
   After editing `.env`, restart with `npx expo start -c` (`-c` clears the cache).

### Check the demo (the Phase 1 "Done when" list)
- [ ] First launch asks for a language → choose **English**
- [ ] Register with an email and a password of 8+ characters → the profile form opens
- [ ] Fill in the profile: date of birth, fitness, experience; skip the health questions ("Prefer not to say") → Save
- [ ] Explore → tap **Temples & Stupas** → **Pashupatinath** → photo, best months, entry fee, nearby places
- [ ] Explore → **Ghorepani Poon Hill Trek** → days, highest point, route Nayapul → Ghandruk, permits
- [ ] Search → type `punhill` → Poon Hill appears; try `anapurna` and `अन्नपूर्ण` too
- [ ] Search → trek filters: Region *Annapurna* + Difficulty *Moderate* → ABC and Mardi Himal
- [ ] Map → markers across Nepal → tap one → its detail page opens
- [ ] Settings → **नेपाली** → tab names, buttons **and** place/trek names switch to Nepali
- [ ] Open **Ghorepani** in Nepali → the name is Nepali, the description is English (the fallback)
- [ ] Log out → log in again with a **wrong password** → you see an error message
- [ ] Stop the backend (Ctrl+C) and pull to refresh a list → you see an error with a **Try again** button

"Continue with Google" will show *"Google sign-in is not set up in this build"* until you do
section 6.

---

## 4. Admin panel — Terminal 3

```bash
cd admin
npm install
npm run dev                               # http://localhost:5173
```
- [ ] Log in as `admin@example.com` / `admin-pass-2026` → the welcome page appears
- [ ] Log in with a traveller account (one registered in the app) → "This account is not an admin"
- [ ] Switching the language to नेपाली changes the page text

Place and trek editing comes in Phase 3. Until then, edit the files in `data/` and run
`uv run python -m app.seed` again.

---

## 5. Day-to-day

| Task | Command |
|---|---|
| Start everything | Terminal 1: backend `uvicorn …` · Terminal 2: `cd mobile && npx expo start` · Terminal 3: `cd admin && npm run dev` |
| Changed `data/*.csv` or `treks.json` | `cd backend && uv run python -m app.seed` |
| Changed a model in `backend/app/models` | `uv run alembic revision --autogenerate -m "what changed"`, review the new file, then `uv run alembic upgrade head` |
| Added an npm package with native code to mobile | `npx expo install <pkg>` then `npx expo run:android` again (rebuild) |
| Before every commit | `./scripts/verify.sh` |
| Reset the dev database completely | `psql -d postgres -c "DROP DATABASE snguide" -c "CREATE DATABASE snguide OWNER snguide"` then re-seed |

---

## 6. Things only you can do

1. **Check the data.** The coordinates, walking times and especially the **fees** in `data/` were
   drafted from general knowledge. Check them against NTB, ACAP and the park offices, and list your
   sources in the report (see `data/README.md`).
2. **Review the Nepali text.** It is in `data/places.csv`, `treks.json`, `permits.csv` and
   `mobile/src/i18n/locales/ne.json`. It is an AI draft, so read and correct it.
3. **Set up Google sign-in** (optional for the demo):
   1. In Google Cloud Console → APIs & Services → Credentials, create an OAuth client of type **Web application**.
   2. Create another of type **Android**, with package `com.smartnepalguide.app` and the SHA-1 from
      `keytool -list -v -keystore mobile/android/app/debug.keystore -storepass android`
      (that file exists after the first `expo run:android`).
   3. Put the **web** client ID in `mobile/.env` → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=…` and in
      `backend/.env` → `GOOGLE_CLIENT_IDS=…`.
   4. Restart the backend and run `npx expo run:android` again.
4. **Launch the trekker survey.** Build the Google Form from `docs/trekker-survey.md`.
5. **Take screenshots** of every screen in both languages, plus the Swagger page, and save them in
   `docs/screenshots/`.
6. **Push to GitHub.** Commit and push to a private repository (see the README).

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| App says "Cannot reach the server (http://…)" | Is the backend running with `--host 0.0.0.0`? On a phone: same Wi-Fi, the correct IP in `mobile/.env`, then `npx expo start -c`. If the macOS firewall asks about Python, allow incoming connections. Test from the phone's browser: `http://192.168.1.66:8000/health` |
| Map is blank (no streets) | The phone needs internet access for the OpenStreetMap tiles. The markers come from your API. |
| "Expo Go" opens / the map crashes | Open the **Bato** app (the dev build), not Expo Go. |
| `expo run:android` fails with an SDK/Java error | Open Android Studio once and install the SDK it suggests. Check that `java -version` shows 17 and that `ANDROID_HOME` is set. |
| Login works in the app but `/me` returns 401 later | The access token expires after 30 minutes and should refresh automatically. If it still fails, log out and in again. |
| Backend: `connection refused` on port 5432 | `brew services start postgresql@16` |
| Backend tests fail at setup | The `snguide_test` database must exist and belong to `snguide` (section 0). |
| Want to use Docker instead of Homebrew Postgres | Install Docker Desktop. Stop the Homebrew Postgres or use `POSTGRES_PORT=5433 docker compose up -d` and change the port in `backend/.env`. |
| Admin: CORS error in the browser console | The admin must run on `http://localhost:5173` (or add your URL to `CORS_ORIGINS` in `backend/.env`). |
