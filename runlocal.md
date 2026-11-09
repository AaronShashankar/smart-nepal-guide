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
- **backend:** ruff lint and format check, a check that the migrations match the models, and the 129 pytest tests;
- **mobile:** the TypeScript typecheck and ESLint;
- **admin:** the build and lint.

The run is good if it ends with **"All checks passed."**
The tests cover register/login, the wrong-password case, the expired-token case, profile save and load,
the fuzzy search cases ("punhill", "anapurna", "अन्नपूर्ण"), the English fallback, the Haversine
distance from Kathmandu to Pokhara, and (Phase 2) the acclimatisation rules on the EBC itinerary,
`gini`, the tree and forest, our accuracy against scikit-learn's, and `/predict-risk`; (Phase 3) nearest
neighbour, 2-opt against brute force, the day split, the trips API, every admin route, photo upload,
and blocking. The manual test cases for the report are in [docs/testing.md](docs/testing.md); the order to run them
in and how to check each one is in [docs/testing-guide.md](docs/testing-guide.md).

---

## 2. Backend — Terminal 1

```bash
cd backend
uv sync                                   # install Python packages (first time / after changes)
uv run python -m app.seed                 # migrate the schema and load data/ (safe to re-run)
uv run python -m app.ml.train             # train the risk model (once, and after the data changes)
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

### Check the Phase 2 demo (mid-term)
- [ ] Explore → **Everest Base Camp Trek** → **Day-by-day itinerary** → 11 day cards; days 3 and 6 are rest days
- [ ] Days 2, 5 and 7 have an orange **Caution** badge; the summary box at the top is orange (passes)
- [ ] **Annapurna Base Camp Trek** → itinerary → day 5 is red (**Add rest**) and the box suggests a rest day at Deurali
- [ ] Profile: fitness *Medium*, experience *None* → EBC → **Check my risk** → January → **Risky** with 3 reasons
- [ ] Profile: fitness *High*, experience *Experienced* → EBC → October → **Hard**, with different reasons
- [ ] Settings → **My risk checks** → both checks, newest first
- [ ] Register a new account, tap **Skip for now** on the profile → **Check my risk** asks you to complete the profile first
- [ ] Switch to नेपाली → itinerary and reasons are in Nepali, numbers in Devanagari digits
- [ ] `cd backend && uv run python -m app.ml.evaluate` → the table and figures appear in `docs/ml/`

### Check the Phase 3 demo (trip planner)
- [ ] **Pashupatinath Temple** → **Add to My Trip** → type "Valley" → **New trip with this place**
- [ ] Add **Boudhanath Stupa**, **Swayambhunath Stupa**, **Patan Durbar Square**, **Bhaktapur Durbar Square**, **Nagarkot** to "Valley"
- [ ] **Trips** tab → Valley → 6 stops and markers on the map
- [ ] **Optimise** → Day 1 and Day 2, 31.3 km; "Nearest neighbour gave 38.8 km; 2-opt shortened it to 31.3 km."
- [ ] Remove a stop → the plan disappears until you optimise again
- [ ] Add the same place twice → "This place is already in the trip"

"Continue with Google" will show *"Google sign-in is not set up in this build"* until you do
section 6.

---

## 4. Admin panel — Terminal 3

```bash
cd admin
npm install
npm run dev                               # http://localhost:5173
```
- [ ] Log in as `admin@example.com` / `admin-pass-2026` → the dashboard shows the counts and the bar chart
- [ ] Log in with a traveller account (one registered in the app) → "This account is not an admin"
- [ ] **EN / ने** in the header switches the panel to Nepali
- [ ] **Places → New place**: English name, नेपाली tab name, category, click the map → **Save** → upload a photo
      → in the app pull to refresh Explore / search for it: it is there with the photo
- [ ] **Places → Namche Bazaar → Delete** → refused (a trek uses it)
- [ ] **Treks → Everest Base Camp Trek**: remove days 3 and 6 (the rest days) → **Save** → Days = 9;
      in the app the itinerary shows **Add rest** warnings. Then add them back, or run `app.seed`.
- [ ] **Users** → **Block** your traveller account → the app logs out; logging in says the account is blocked → **Unblock**
- [ ] **Reviews** shows "No reviews yet" (writing reviews in the app is Version 2)

If you create the admin with a different email, use that. Running `app.seed` again resets seeded places
and treks to the files in `data/` (admin edits to them are lost; places the admin added are kept).

---

## 5. Day-to-day

| Task | Command |
|---|---|
| Start everything | `./scripts/start-demo.sh` (PostgreSQL, Redis, API, admin panel, Metro; writes this laptop's Wi-Fi IP into `mobile/.env`). `--seed` reloads data/ first; `--no-metro` starts only the servers. Running servers are reused. Ctrl+C stops what it started |
| Changed `data/*.csv` or `treks.json` | `cd backend && uv run python -m app.seed` (overwrites admin edits to seeded content) |
| Changed treks or survey data → retrain | `uv run python -m app.ml.dataset [--survey form.csv]`, `uv run python -m app.seed`, `uv run python -m app.ml.train`, `uv run python -m app.ml.evaluate` |
| "No trained model yet" (503) in the app | `cd backend && uv run python -m app.ml.train` (no restart needed) |
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
7. **App icon and splash: done.** The Bato icon and splash are generated by
   `mobile/assets/brand/make_icons.py` (the SVG sources sit next to it). To change them, edit the script, run
   `cd mobile && uv run --with resvg-py python assets/brand/make_icons.py`, then `npx expo run:android`.
8. **Run the manual test table** (follow [docs/testing-guide.md](docs/testing-guide.md)) in [docs/testing.md](docs/testing.md) on two Android phones of
   different sizes and fill in *Actual result* and *Pass/Fail*.
9. **Release Version 1** (Phase 3 §6): backend + database on Render/Railway or your laptop; admin on
   Vercel/Netlify (set `VITE_API_URL`, and add its URL to `CORS_ORIGINS`); the APK with
   `eas build -p android --profile preview`; a 3–5 minute demo video; then the git tag `v1.0`.
   On Render's free plan the disk is reset on every deploy, so photos uploaded from the admin panel
   are lost. For the defense, run locally or re-upload them.

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
