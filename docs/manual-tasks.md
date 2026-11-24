# Manual tasks: what is left, how to do it, how to check it

This file covers the work that only you can do: it needs your phone, your accounts, your judgement or
your presence. Each task says **how to do it on this laptop**, **how to check it worked**, and
**where to record it**. The code work that remains (the V2 Phase 3 Stretch) is not listed here.

Run every command from the repository root (`smart-nepal-guide/`) unless a step says otherwise.
Starting the servers is covered in [../runlocal.md](runlocal.md), and the 40 test cases in
[testing-guide.md](testing/testing-guide.md).

**Tracker** means the **Bato Project Tracker** Google Sheet. Update it as you go: set the task to
*In progress* with a **Started** date, then to *Done* with a **Finished** date.

---

## Overview

| # | Task | Area | Tracker | Priority | When |
|---|---|---|---|---|---|
| 1 | [Confirm registration works](#1-confirm-registration-works-bug-05) | Testing | BUG-05 | High | Now |
| 2 | [Launch the trekker survey](#2-launch-the-trekker-survey) | Data | V1-P1-18 | Must-have | Now (slowest to collect) |
| 3 | [Check the data against official sources](#3-check-the-data-against-official-sources) | Data | — | Must-have | Before mid-term |
| 4 | [Replace the budget rate estimates](#4-replace-the-budget-rate-estimates) | Data | V2-P2-06 | Good | Before final |
| 5 | [Review the Nepali text](#5-review-the-nepali-text) | Content | — | Must-have | Before mid-term |
| 6 | [Phase 1 demo on a phone](#6-phase-1-demo-on-a-phone) | Testing | V1-P1-19 | Must-have | Before mid-term |
| 7 | [Mid-term (Phase 2) demo on a phone](#7-mid-term-phase-2-demo-on-a-phone) | Testing | V1-P2-13 | Must-have | Before mid-term |
| 8 | [Screenshots for the report](#8-screenshots-for-the-report) | Report | V1-P1-20 | Good | Before mid-term |
| 9 | [V2 Phase 2 features on a phone](#9-v2-phase-2-features-on-a-phone-tc-41-to-tc-52) | Testing | V2-P2-02/04/05/07/09 | Good | Before final |
| 10 | [The 40 manual test cases on two phones](#10-the-40-manual-test-cases-on-two-phones) | Testing | V1-P3-08 | Must-have | Before final |
| 11 | [Log and retest bugs](#11-log-and-retest-bugs) | Testing | V1-P3-09 | Must-have | During #10 |
| 12 | [Add survey answers and retrain the model](#12-add-survey-answers-and-retrain-the-model) | ML | V1-P2-14 | Must-have | When answers are in |
| 13 | [Google sign-in setup](#13-google-sign-in-setup-optional) | Setup | — | Optional | Any time |
| 14 | [Fresh-start test of start-demo.sh](#14-fresh-start-test-of-start-demosh) | Release | V1-P3-10 | Good | Before final |
| 15 | [Build the release APK](#15-build-the-release-apk) | Release | V1-P3-12 | Must-have | Before final |
| 16 | [Record the demo video](#16-record-the-demo-video) | Release | V1-P3-13 | Good | Before final |
| 17 | [Push to GitHub](#17-push-to-github) | DevOps | — | Must-have | Now, then often |
| 18 | [Tag v1.0](#18-tag-v10) | DevOps | V1-P3-14 | Must-have | Last |
| 19 | [Set the defense dates](#19-set-the-defense-dates) | Planning | Milestones | Good | When announced |
| 20 | [Decide the open V2 questions](#20-decide-the-open-v2-questions) | Decisions | V2-P3-04/05 | Medium | Only for the Stretch (safety Core: decided) |
| 21 | [Final report and defenses](#21-final-report-and-defenses) | Report | Milestones | Must-have | Weeks 13–16 |
| 22 | [Safety features on a real phone](#22-safety-features-on-a-real-phone-tc-68-to-tc-76) | Testing | V2-P3-01/02/03/07 | Must-have | Now (before the final demo) |

---

## Before any phone task: start everything and check it

```bash
./scripts/start-demo.sh          # PostgreSQL, Redis, API, admin panel, Metro
```

| Check | How | Expected |
|---|---|---|
| API is up | Open http://localhost:8000/health | `{"status":"ok"}` |
| Phone can reach the API | Open `http://<laptop IP>:8000/health` in the **phone's browser**. Get the IP with `ipconfig getifaddr en0` | Same `{"status":"ok"}`. If it doesn't load, the phone is on a different Wi-Fi or the macOS firewall is blocking Python |
| App uses the right address | Bato app → **Settings → API server** | `http://<laptop IP>:8000`, or `http://10.0.2.2:8000` on the emulator |
| Admin panel | Open http://localhost:5173 | The login page |

`mobile/.env` must **not** set `EXPO_PUBLIC_API_URL` in development. If it does, the app ignores the
laptop's real address.

---

## 1. Confirm registration works (BUG-05)

**Do:**
1. Start everything (see above). If Metro was already running, restart it with `cd mobile && npx expo start -c`.
2. In the app, open **Register**, enter a new email and a password of 8 or more characters, and tap **Create account**.

**Check:**
- The profile form opens. No "No internet connection" message appears.
- The new user exists in the database:
  `psql -U snguide -d snguide -c 'select email, created_at from "user" order by created_at desc limit 1'`
- Or check the admin panel: **Users** lists the new email.

**Record:** in the Bugs tab, BUG-05 → Status **Fixed**, with the commit hash once committed.

*Status 2026-11-19:* confirmed by TC-02 on the emulator; BUG-05 is **Fixed** in the tracker. Fill in the commit hash after committing.

---

## 2. Launch the trekker survey

**Do:**
1. Open https://script.google.com → **New project**. Delete the sample code and paste all of
   [trekker-survey-form.gs](../backend/docs/survey/trekker-survey-form.gs). Save.
2. Choose `createTrekkerSurvey` at the top → **Run**. Allow the permissions the first time
   (Advanced → Go to project → Allow; it is your own script).
3. Open **Execution log**: it prints the link to share, the edit link and the responses sheet.
   The form is anonymous (no emails) and has the 11 questions in the order the import script expects.
   Don't reorder questions or rename options.
4. Send it to trekkers: trekking Facebook groups, Reddit r/Nepal and r/trekking, friends, agencies,
   and guides in Thamel or Pokhara. Aim for 50+ answers.

**Check:**
- Fill it in once yourself as a test, then open **Responses → View in Sheets**. There should be one
  row, with the Timestamp first and then the 11 answers in order.
- Delete that test row before you collect real answers.

**Record:** in the tracker, V1-P1-18 → **Done**; paste the form link in Notes. Note the date it went live (needed for the report).

---

## 3. Check the data against official sources

The coordinates, walking times and **fees** in `data/` were drafted from general knowledge.

**Do:** go through these files and correct them using official sources:

| File | What to check | Where to check |
|---|---|---|
| `data/places.csv` | Latitude/longitude, entry fees, best months | Google Maps (right-click → coordinates), NTB (ntb.gov.np), each site's ticket counter or website |
| `data/treks.json` | Stage altitudes, distances, walking hours | ACAP and park office maps, trekking agency itineraries, Wikipedia/OSM peaks |
| `data/permits.csv` | TIMS, ACAP, Sagarmatha NP and other permit fees by nationality | NTB / TAAN / ACAP official fee lists (fees change, so note the date you checked) |
| `data/teahouses.csv` | Names, villages | Agency itineraries, Google Maps |

After editing, reload the data:

```bash
cd backend && uv run python -m app.seed
```

**Check:**
- `./scripts/verify.sh` still ends with **"All checks passed."** Some tests use fixed values (for
  example 4.17 vs 4.48, or the Kathmandu–Pokhara distance). If one fails because you corrected a
  number, tell Claude which number you changed.
- In the app, open a place you corrected: the detail screen shows the new fee or months.
- On the **Map** tab, every marker is in the right spot. Nothing in the sea, nothing in India.

**Record:** add every source, with the date you checked it, to `data/README.md`. The report's references come from there.

---

## 4. Replace the budget rate estimates

**Do:**
1. Get real prices for transport, food and rooms at each budget level (low, medium, high): ask 2–3
   agencies, use survey answers, or use posted bus fares.
2. Edit them in `data/budget_rates.csv` and run `cd backend && uv run python -m app.seed`.
   Or change them in the admin panel under **Budget rates**; that change is lost on the next seed.

**Check:** in the app, Trips → Valley → **Optimise** → **Estimate budget**. The breakdown uses the new rates. Set the profile budget to *High* and estimate again: the total goes up.

**Record:** add the sources to `data/README.md`, and remove "estimates" from the V2-P2-06 note in the tracker.

---

## 5. Review the Nepali text

It's an AI draft. Read it as a Nepali speaker and fix anything unnatural or wrong.

| File | What's in it |
|---|---|
| `mobile/src/i18n/locales/ne.json` | Every button, label and message in the app |
| `admin/src/i18n.ts` (the `ne` part) | The admin panel's Nepali text |
| `data/places.csv` (`name_ne`, `description_ne`, `how_to_reach_ne`) | Place names and descriptions |
| `data/treks.json` (`*_ne` fields) | Trek names, stage names, descriptions |
| `data/permits.csv` | Permit names |

**Do:** edit the text in place. Keep the JSON keys and CSV columns as they are, and only change the
text. After data changes, run `cd backend && uv run python -m app.seed`.

**Check:**
- `./scripts/verify.sh` passes. This catches broken JSON or a missing key.
- In the app, Settings → **नेपाली**: go through every tab and the detail screens. No English is left
  in the Nepali UI, except descriptions that have no Nepali yet (the English fallback is expected).
- Long Nepali words don't overflow buttons, especially on a small phone.

**Record:** add a note "Nepali reviewed by <name>, <date>" in the tracker, and mention it in the report.

---

## 6. Phase 1 demo on a phone

**Do:** follow the **Check the demo (the Phase 1 "Done when" list)** checklist in
[../runlocal.md](runlocal.md), section 3, on a **real Android phone**. It is the same as Sessions A and B in
[testing-guide.md](testing/testing-guide.md), so you can do both at once.

**Check:** every box in that checklist behaves as written.

**Record:** V1-P1-19 → **Done**. Any failure → a row in the Bugs tab (see #11).

---

## 7. Mid-term (Phase 2) demo on a phone

**Do:** follow **Check the Phase 2 demo (mid-term)** in `runlocal.md` section 3 (Session C in the
testing guide). Then run the evaluation once to refresh the figures:

```bash
cd backend && uv run python -m app.ml.evaluate
```

**Check:**
- EBC → itinerary shows 11 days; days 3 and 6 are rest days; days 2, 5 and 7 have **Caution**.
- Fitness *Medium*, experience *None*, EBC, January → **Risky** with 3 reasons.
- `backend/docs/ml/comparison.md` and the `.png` figures have today's modification time:
  `ls -l backend/docs/ml`.

**Record:** V1-P2-13 → **Done**. Practise the demo twice; time it (aim for under 10 minutes).

---

## 8. Screenshots for the report

**Do:** with the phone connected by USB, take each screenshot from the laptop. The files go straight into the folder:

```bash
mkdir -p docs/screenshots
adb exec-out screencap -p > docs/screenshots/01-login-en.png
```

Or take them on the phone (Power + Volume down) and copy them over. Take each screen in **English and Nepali**:

| # | Screen | File names |
|---|---|---|
| 1 | Language choice | `00-language.png` |
| 2 | Login, Register | `01-login-en.png`, `01-login-ne.png`, `02-register-*.png` |
| 3 | Profile form | `03-profile-*.png` |
| 4 | Explore, Recommended, Near me | `04-explore-*.png` |
| 5 | Place detail, Trek detail | `05-place-*.png`, `06-trek-*.png` |
| 6 | Itinerary with badges, Risk result | `07-itinerary-*.png`, `08-risk-*.png` |
| 7 | Map, Search with filters | `09-map-*.png`, `10-search-*.png` |
| 8 | Trips, Optimised plan, Budget | `11-trip-*.png`, `12-budget-*.png` |
| 9 | Admin dashboard, Places form | `20-admin-*.png` (browser screenshot: Cmd+Shift+4) |
| 10 | Swagger | `21-swagger.png` (http://localhost:8000/docs) |

**Check:** `ls docs/screenshots` lists both languages for each screen. Open a few and confirm there's
no debug overlay, no red error box, and the status bar is clean.

**Record:** V1-P1-20 → **Done**.

---

## 9. V2 Phase 2 features on a phone (TC-41 to TC-52)

**Do:** follow **Check the V2 Phase 2 demo** in `runlocal.md` section 3. First time only:

```bash
cd backend && uv run python -m app.seed      # migration 0004, budget rates, teahouses
```

The dev build already includes `expo-location` (rebuilt on 2026-11-15).

**Check, per feature:**

| Feature | Test cases | Pass when |
|---|---|---|
| Recommended for you | TC-41–43 | Culture+Religious → temples first with "Because you like…"; new account → **Popular now** |
| Reviews | TC-44–46 | Review shows at once; posting again updates it; admin **Hide** removes it from the list |
| Near me | TC-47–48 | Allow → closest first with "x km away"; deny → "Turn on location…" message |
| Budget | TC-49–50 | Breakdown + "Estimate only"; SAARC/Nepali nationality → cheaper permits |
| Share trip | TC-51 | The link opens a read-only page in a private browser window; **Stop sharing** → 404 |
| Teahouses | TC-52 | EBC day 4 → **Teahouses (4)** in Tengboche |

On the **emulator**, set a fake location for Near me: Extended controls (⋯) → **Location** → search
"Thamel" → **Set location**.

**Record:** in the Test cases tab, fill in Actual result and Pass/Fail for TC-41 to TC-52. Then move
V2-P2-02, 04, 05, 07 and 09 from *Testing* to **Done**.

---

## 10. The 40 manual test cases on two phones

**Do:** follow [testing-guide.md](testing/testing-guide.md) exactly. It has six sessions (A–F) on Phone 1, about
2½ hours, plus 8 layout checks on Phone 2, about 20 minutes. Before Session A:

```bash
./scripts/verify.sh                         # must end with "All checks passed."
adb uninstall com.smartnepalguide.app       # so TC-01 sees a real first launch
cd mobile && npx expo run:android --device  # reinstall the dev build
```

Use a phone with a **different screen size** (small or older) as Phone 2.

**Check:** each case's *Expected result* in [testing.md](testing/testing.md) matches what you see.

**Record:**
- Test cases tab: **Actual result**, **Pass/Fail**, **Phone** and **Date tested** for every row.
- At the end, copy the results into `docs/testing/testing.md` for the report.
- V1-P3-08 → **Done** when every row has a result.

*Status 2026-11-19:* Phone 1 done on the Android emulator (all 52 cases: 51 Pass, 1 Blocked, TC-47 needs real
GPS). Still to do: **Phone 2** (a real phone): the 8 layout cases, TC-47 Near me, and BUG-06 (Nepali labels).

---

## 11. Log and retest bugs

**Do:** for every failed case, add a row to the **Bugs** tab:
- **ID:** the next number (BUG-06, …). Also fill in Found on, Area, Where, and **What happened (steps)**, written so someone else can repeat it.
- Severity: **High** if a feature is broken, **Medium** if it works but is wrong, **Low** if it's cosmetic.
- Give Claude the BUG number. Claude fixes it and fills in Cause and Fix.

**Check:** after a fix, run the **same test case** again. Pass → set the bug to **Fixed** and the case to **Pass**.

**Record:** V1-P3-09 → **Done** when no bug of severity High is left open.

*Status 2026-11-19:* BUG-06 to BUG-14 fixed by Claude and re-tested on the emulator (13 bugs Fixed in the
tracker). Left: check BUG-06 on Phone 2 (it depends on how the phone draws Nepali text), then commit and
fill in the commit hashes.

---

## 12. Add survey answers and retrain the model

Do this once the survey (#2) has enough answers. Aim for 50 or more.

**Do:**
1. In the form's linked Google Sheet: **File → Download → CSV**. Save it as `backend/survey.csv`.
2. Rebuild the dataset, reload, retrain and evaluate:

```bash
cd backend
uv run python -m app.ml.dataset --survey survey.csv
uv run python -m app.seed
uv run python -m app.ml.train
uv run python -m app.ml.evaluate
```

**Check:**
- The dataset step prints `sources: … survey=N`. N should equal the number of responses. If it's
  lower, some rows didn't match a trek or had a missing answer: check the CSV's column order.
- `backend/docs/ml/data_sources.png` now shows a **survey** bar.
- `backend/docs/ml/comparison.md`: compare the accuracy with the old value (forest 0.814). It may go up or
  down. Either is fine; write down why.
- In the app, **Check my risk** still works (no "No trained model yet" error).
- `./scripts/verify.sh` passes.

**Record:** V1-P2-14 → **Done**. Put the new accuracy in Notes and update the ML chapter of the report.

---

## 13. Google sign-in setup (optional)

**Do:**
1. https://console.cloud.google.com → create or choose a project → **APIs & Services → OAuth consent
   screen**: External, app name "Bato", add your email as a test user.
2. **Credentials → Create credentials → OAuth client ID → Web application**. Copy the client ID.
3. Create another client of type **Android**, with package `com.smartnepalguide.app` and the SHA-1 from:
   ```bash
   keytool -list -v -keystore mobile/android/app/debug.keystore -storepass android | grep SHA1
   ```
4. Put the **web** client ID in both files:
   - `mobile/.env` → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>`
   - `backend/.env` → `GOOGLE_CLIENT_IDS=<web client id>`
5. Restart the backend, then rebuild the app: `cd mobile && npx expo run:android`.

**Check:** **Continue with Google** → choose your test account → the profile form (new user) or the
Explore tab (existing user) opens. The user appears under **Users** in the admin panel.

The **release APK** (#15) is signed with a different key, so it has a different SHA-1. Add a second Android client with that SHA-1 (`eas credentials` shows it).

---

## 14. Fresh-start test of start-demo.sh

So far the script has only been tested with the servers already running. On defense day they won't be.

**Do:**
1. Stop everything: Ctrl+C in every terminal, then
   ```bash
   brew services stop postgresql@16 redis
   ```
2. Run `./scripts/start-demo.sh`.

**Check:**
- The script starts PostgreSQL and Redis by itself, and prints the API health as **OK**.
- http://localhost:5173 (admin) and the app on the phone both work.
- Ctrl+C stops the API and admin that it started.

**Record:** in V1-P3-10's Notes, change "fresh-start path not yet run" to "fresh start tested <date>".

---

## 15. Build the release APK

The automatic API address only works in **development** builds. A release APK must be told where the API is.

**Do:**
1. Decide where the API runs during the demo. For laptop hosting, the laptop must have a **fixed
   IP**. Use the phone's hotspot, which usually gives the laptop the same address each time; check it
   with `ipconfig getifaddr en0`.
2. Add the URL to the `preview` profile in `mobile/eas.json`:
   ```json
   "preview": {
     "distribution": "internal",
     "android": { "buildType": "apk" },
     "env": { "EXPO_PUBLIC_API_URL": "http://<laptop IP>:8000" }
   }
   ```
3. Build:
   ```bash
   cd mobile
   npm install -g eas-cli         # once
   eas login                      # your Expo account
   eas build -p android --profile preview
   ```
4. Download the APK from the link it prints.

**Before building:** `mobile/.env` must **not** have `EXPO_PUBLIC_SAFETY_TEST_NUMBERS` (task #22). EAS
builds in the cloud from the committed files, so the gitignored `.env` isn't uploaded, but a local
`npx expo run:android --variant release` would use it.

**Check:**
- Install it on a phone that has **never had Bato**: `adb install path/to/app.apk`, or open the link on the phone.
- It opens without Metro running. **Settings → API server** shows the URL from step 2.
- Register, browse, and check a risk: all work.

**Record:** V1-P3-12 → **Done**. Keep the APK file next to the demo video as a backup.

---

## 16. Record the demo video

**Do:**
- Laptop screen: **Cmd+Shift+5** → Record entire screen (or QuickTime → New Screen Recording).
- Phone screen: mirror it to the laptop with `scrcpy` (`brew install scrcpy`, then run `scrcpy`), so
  one recording shows both the phone and the admin panel.
- Script (3–5 minutes): register → profile → Explore → search "punhill" → EBC itinerary and risk →
  Trip optimise → admin adds a place → the place appears in the app → switch to Nepali.

**Check:** watch it back. The audio is clear, nothing private is visible (emails, tokens, other tabs),
and it's under 5 minutes.

**Record:** V1-P3-13 → **Done**. Save the video somewhere outside the laptop too (Google Drive).

---

## 17. Push to GitHub

The repository already exists on GitHub (`origin`). `main` was pushed 6 days ago, but the **`v2`
branch has never been pushed**: all the V2 work exists only on this laptop.

**Do:**
1. On github.com, open the repository → **Settings** → make sure it is **Private**.
2. Commit your current work and push both branches:
   ```bash
   git status                        # check that no .env files are listed
   git add -A && git commit -m "Your message"
   git push -u origin v2             # first push of the V2 branch
   git push origin main
   ```

**Check:**
- `git ls-remote --heads origin` lists both `main` and `v2`.
- **`.env` files are not on GitHub.** Search the repository for `JWT_SECRET`: only `.env.example` should match.
- `git status` says "nothing to commit, working tree clean".

**Record:** put the repository link in the tracker's Guide tab.

---

## 18. Tag v1.0

Do this last, after #10, #11 and #15.

**Do:**
```bash
./scripts/verify.sh                 # must pass
git checkout main
git tag -a v1.0 -m "Bato version 1"
git push origin v1.0
```

**Check:** `git tag` lists `v1.0`, and GitHub → **Tags** shows it.

**Record:** V1-P3-14 → **Done**, with the commit hash.

---

## 19. Set the defense dates

**Do:** once the department announces the dates, open the tracker's **Milestones** tab and change the
blue **Start week** and **End week** cells for Mid-term defense, Final report and Final defense.

**Check:** the Gantt chart moves to match. Every task's *Planned week* still falls before its milestone.

---

## 20. Decide the open V2 questions

These are scope decisions for V2 Phase 3. Claude can build either option once you choose.

| Question | Options | Plan's suggestion |
|---|---|---|
| Include the safety features (SOS, check-in)? | Yes / only SOS / no | **Decided 2026-11-24: yes, the Core** (contacts, SOS, symptom checker) is built. The check-in is Stretch |
| Missed check-in alert by… | SMS gateway (paid, e.g. Sparrow SMS) / email (free, SMTP) | Email |
| Daily reminder by… | FCM push (needs Firebase) / local notification (`expo-notifications`) | Local notification |

**Record:** add each decision as a row in the tracker's **Decisions** tab, with the reason, and update the V2-P3-02/04/05 notes.

---

## 21. Final report and defenses

**Do:** write the report chapters using what this project already produced:

| Chapter | Material |
|---|---|
| System design | ER, use case, DFD and class diagrams (`docs/diagrams/`) |
| Algorithms | Levenshtein search, Haversine, CART and random forest, nearest neighbour + 2-opt, cosine similarity, Bayesian average, the Lake Louise score (cite Roach et al., High Altitude Medicine & Biology 19(1), 2018) |
| ML results | `backend/docs/ml/comparison.md` and the figures (after #12) |
| Route results | `backend/docs/benchmarks/route_gap.md` |
| Testing | `docs/testing/testing.md` with results (#10) and the Bugs tab |
| Screenshots | `docs/screenshots/` (#8) |
| References | Sources from `data/README.md` (#3, #4) |

**Check, before each defense:**
- Fresh start works (#14), and the demo runs end to end twice without a problem.
- The backups are ready: the demo video (#16) and the APK (#15).
- You can explain each algorithm on a whiteboard without notes.

**Record:** Milestones tab → Mid-term defense / Final report / Final defense → **Done**.

---

## 22. Safety features on a real phone (TC-68 to TC-76)

The emergency contacts, SOS and the symptom checker (V2 Phase 3 Core) pass every automated check, but
SOS opens the SMS app and reads the GPS, which the emulator can't do properly. Use a real phone with a
SIM card.

**Do:**
1. **Rebuild the development build once**, because `expo-sms` is a new native module:
   ```bash
   cd mobile
   npx expo run:android            # phone connected by USB, USB debugging on
   ```
   (An older build still works: it opens the SMS app through an `sms:` link instead.)
2. **Turn on test mode**, so SOS and the call buttons never reach the real police. In `mobile/.env`:
   ```
   EXPO_PUBLIC_SAFETY_TEST_NUMBERS=98XXXXXXXX,98XXXXXXXX
   ```
   Use two numbers you own (already set on this laptop). Then restart Metro so it reads the line:
   `npx expo start -c`. Open Settings → Safety → SOS & emergency numbers: a yellow **TEST MODE**
   banner must show. If it doesn't, stop: the real numbers are still in use.
3. Run **Session J** in [testing-guide.md](testing/testing-guide.md) (9 cases). Do the SOS cases
   outdoors, and TC-72 / TC-75 with mobile data **and** Wi-Fi off.
4. **Turn test mode off** afterwards: delete the line from `mobile/.env` and run `npx expo start -c`.
   The banner must be gone and Tourist Police must show 1144.
5. *(Optional)* Confirm the **Himalayan Rescue Association** number. Its website lists two different
   office numbers (01-4440292 and 01-4540292); call or email HRA, or find it on a government travel
   page. Then tell Claude to add it to `data/emergency_numbers.csv` with the source. Until then it stays
   out (a wrong rescue number is worse than none).

**Check:** each case's Actual result matches; the SMS arrives on the test phone and its map link opens
the right place; the admin dashboard's SOS events and Symptom checks counts go up after you come back
online.

**Record:** fill in TC-68 to TC-76 in the **Test cases** tab and in `docs/testing/testing.md`; log any
bug in the **Bugs** tab. When all pass, move V2-P3-01, 02, 03 and 07 from *Testing* to **Done**.
