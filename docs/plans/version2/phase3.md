# Version 2 · Phase 3 — Safety & Offline

**Week:** about 15 (Gantt "V2 Phase 3"), the last build week before the final defense.
**Goal:** Bato helps on the trail itself. The traveller can call or text for help with their GPS
location even without mobile data, check altitude sickness symptoms with a standard medical score, and
(stretch) check in each day and use a downloaded trek offline.

Previous: [phase2.md](phase2.md) · Overview: [README.md](README.md)

**Status:** not started. Tracker rows `V2-P3-01` … `V2-P3-07`, then `V2-OPT-01` … `V2-OPT-03`.
**Open decisions** (settle these before starting, see [README.md](README.md#open-decisions-decisions-tab)): include the safety features, email or SMS for missed check-ins, and local notifications or FCM.

**Native packages for this phase:** `expo-location` (from Phase 2), `expo-sms`, `expo-notifications`
(stretch), `expo-sqlite` (stretch). Install the ones you need on day 1 and rebuild once.

**Split:**
- **Core** (do first, about 3 days): emergency contacts, SOS, symptom checker.
- **Stretch** (only if Core is finished): daily check-in, offline treks.

The Stretch items are the most expensive features in the whole project. Moving them to "Future scope"
is a fine outcome.

> **Disclaimer on every safety screen** (both languages): *"Bato is not a rescue service and not
> medical advice. In an emergency, call the numbers below."*

---

## Demo at the end of this phase
1. **Settings → Emergency contacts.** Add "Dad", +977 98…, with an email. The fixed list underneath has Police 100, Tourist Police 1144 and Ambulance 102. Tap one → the phone dialler opens.
2. **Turn off mobile data and Wi-Fi.** Hold the red **SOS** button for 2 seconds → the SMS app opens to your contacts with *"SOS from Bato: I need help. My location: 27.98, 86.83 (accuracy 12 m) https://maps.google.com/?q=27.98,86.83 · 14:05"*. Turn the internet back on → the SOS is synced to the server (`sos_event`).
3. **Symptom checker.**
   - "I'm at 4,400 m": headache 2, nausea 1, fatigue 1, dizziness 0 → total 4 with a headache → **Rest: don't go higher today**.
   - Headache 3, nausea 2, fatigue 3, dizziness 2 → total 10 → **Descend now**.
   - Ticking "confusion" or "breathless at rest" → **Descend now**, whatever the total.
4. *(Stretch)* **Daily check-in.** Start a trip with a 18:00 check-in time → a notification at 18:00 says "Did you reach your next stop safely?" → **I'm safe**. Skip one (set the deadline to 2 minutes for the demo) → the emergency contact gets an email: "<traveller name> has not checked in since …".
5. *(Stretch)* **Offline.** EBC → **Download for offline** → airplane mode → close the app and reopen it → EBC's overview, itinerary, acclimatisation, permits and packing list all open. Edit the trek in the admin panel, go online and open the app → "Updated" (delta sync).

---

## 1. Emergency contacts (`V2-P3-01`) — Core

- [ ] Migration `0006`: table `emergency_contact` (id, user_id, name, phone, email nullable, relation, sort_order, updated_at, deleted_at; at most 5 per user). The class diagram already has `EmergencyContact`.
- [ ] `GET/POST /me/emergency-contacts`, `PATCH/DELETE /me/emergency-contacts/{id}`. Phone numbers are checked as E.164 (`+97798…`), and `98…` is accepted and turned into `+977…`.
- [ ] Fixed numbers in `data/emergency_numbers.csv` (code, phone, name_en, name_ne, note): Police 100, Tourist Police 1144, Ambulance 102, Fire 101, plus the Himalayan Rescue Association and the main embassies if you want. **Check every number against an official source** and list the sources in `data/README.md`. The CSV is also shipped inside the app bundle, so the numbers show offline.
- [ ] Mobile: Settings → **Emergency contacts** (list + form; "Pick from phone contacts" is Extra). The fixed numbers are underneath. Tap → `Linking.openURL('tel:…')`.
- [ ] The contacts are also kept on the phone (SecureStore, small JSON), so SOS works offline

## 2. SOS (`V2-P3-02`) — Core (Wow)

**How it works without internet:** the phone's GPS gets the location from satellites (no data needed),
and an SMS goes over the GSM network. Bato only fills in the message. The user presses Send, because
Android doesn't let an app send SMS silently without a special permission that Play Store apps can't use.

- [ ] Mobile: a red **SOS** button on the trip and trek screens and in Settings. Hold it for 2 s (to avoid accidental taps), with a vibration and a countdown ring.
- [ ] `expo-location`: `getCurrentPositionAsync` with high accuracy and a 10 s timeout. Fall back to `getLastKnownPositionAsync`, and say "last known location from 14:02" when you use it.
- [ ] `expo-sms`: `sendSMSAsync(phones, message)` with a localised message (the template is in `en.json` / `ne.json`). If there are no contacts, open the dialler on 1144.
- [ ] Save the event in an offline queue (SecureStore, a small array). When the app is online again, `POST /sos-events {latitude, longitude, accuracy_m, message, sent_at}` → table `sos_event` (in database.md; add `accuracy_m`). Clear the queue only after a `201`.
- [ ] Admin dashboard: a count of SOS events (no live tracking: that is future scope)

## 3. Altitude sickness symptom checker (`V2-P3-03`) — Core (Wow)

**Algorithm: Lake Louise AMS score (2018 version).**
- Four symptoms, each scored 0–3: headache, gastrointestinal (nausea / vomiting), fatigue / weakness, dizziness / light-headedness.
- **Total = sum (0–12).** AMS is likely when there has been a recent gain in altitude, a headache ≥ 1, and a total ≥ 3. Severity: **3–5 mild, 6–9 moderate, 10–12 severe**.

| Result (`symptom_result` enum) | When | Text |
|---|---|---|
| `ok` | total < 3, or no headache | No sign of AMS. Keep drinking water and go up slowly. |
| `rest` | AMS mild (3–5) | Rest at this altitude, don't go higher until the symptoms are gone. |
| `descend` | AMS moderate or severe (≥ 6), **or** any red flag | Descend now and get help. |

**Red flags** (ticked separately) always give `descend`: confusion or unsteady walking (signs of HACE),
breathless at rest or a wet cough (signs of HAPE), and symptoms getting worse after a rest day.

- [ ] `app/algorithms/lake_louise.py`: `score(answers) -> (total, severity, result, reason_codes)`, plus the same function in `mobile/src/lib/lakeLouise.ts`, so it works offline. Both are tested against **one shared table** of cases (`backend/tests/data/lake_louise_cases.json`; pytest reads it, and a small Node script run by `verify.sh` checks the TypeScript copy against it), so they can't drift apart.
- [ ] Mobile: "How do you feel?" on the itinerary and trek screens → 4 questions with the official 0–3 wording, red-flag checkboxes, and the current altitude (from GPS altitude, or "pick today's stop") → a big coloured result + the disclaimer + "Call for help" buttons
- [ ] When online: `POST /symptom-checks` saves to `symptom_check` (the table is already in database.md). Settings → "My symptom checks" shows the history.
- [ ] Report: cite Roach et al., *"The 2018 Lake Louise Acute Mountain Sickness Score"*, High Altitude Medicine & Biology 19(1), 2018

## 4. Daily check-in (`V2-P3-04`, `V2-P3-05`) — Stretch

**Algorithm: a scheduled job.** Every 10 minutes, find check-ins whose deadline has passed and are still
`pending`. Mark them `missed` and send one alert.

- [ ] Trip settings: "Daily check-in" on/off, check-in time (e.g. 18:00), grace period (default 2 h), which contacts to alert
- [ ] Table `check_in` (in database.md): one `pending` row per trip day, created when check-in is turned on. `POST /trips/{id}/check-ins/today {latitude?, longitude?}` → `done`.
- [ ] **Reminder:** a local notification scheduled on the phone by `expo-notifications` at the check-in time (works offline). Tapping it opens the app on "I'm safe". *(Decision: local instead of FCM.)*
- [ ] **Missed alert:** APScheduler `BackgroundScheduler` started in the FastAPI lifespan (one process only). The job `missed_check_ins()` sends **email over SMTP** (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` in `.env`; a Gmail app password works) to contacts with an email. Each check-in is alerted **at most once** (`alerted_at` column).
- [ ] Without internet, the check-in can't reach the server, so the family may get a false alarm. Say this in the email ("They may simply have no signal") and in the report.
- [ ] Demo setting: `CHECKIN_GRACE_MINUTES=2` in `.env`

## 5. Offline treks (`V2-P3-06`) — Stretch

**Algorithm: timestamp-based delta sync.** The phone remembers when it last synced. The server sends
only rows with `updated_at > last_sync`, including soft-deleted ones (`deleted_at` set), so the phone
can remove them. The server's change always wins (the content is read-only on the phone).

- [ ] `GET /treks/{id}/offline-pack` → one JSON with everything the trek screens need (overview, stages, acclimatisation, altitude profile, permits, packing list for all 12 months, teahouses, emergency numbers) + `generated_at`
- [ ] `GET /sync?since=<ISO time>&trek_ids=…` → the changed treks / places / permits since then + `server_time` (use the server's clock for the next `since`, never the phone's)
- [ ] Mobile: `expo-sqlite` table `offline_pack(trek_id, lang, json, synced_at)`. A "Download for offline" button with its size. Settings → "Downloaded treks" with delete. The trek screens read from SQLite when the request fails or the phone is offline (`@react-native-community/netinfo` or the TanStack Query `onlineManager`).
- [ ] An "Offline · saved 3 days ago" banner. Risk prediction, weather and reviews need internet, so those screens say so.
- [ ] Out of scope (write it in the report): offline map tiles. The map tab shows "Map needs internet".

## 6. Tests (`V2-P3-07`) — Core

- [ ] Lake Louise: every case in the shared table (boundaries 2/3, 5/6, 9/10; no headache → `ok` even with a total of 6; a red flag → `descend` with a total of 0)
- [ ] Emergency contacts: a user only sees their own; the 6th contact → 422; `98…` is turned into `+977…`
- [ ] SOS: `POST /sos-events` saves with the user; unauthenticated → 401
- [ ] *(Stretch)* Check-in job: a frozen clock (pass `now` in) → pending past grace → `missed` + one email (fake SMTP); running the job again sends no second email; a `done` check-in is never alerted
- [ ] *(Stretch)* Sync: an edited trek appears for `since` = before the edit and not for `since` = after; a soft-deleted place comes back with `deleted_at`
- [ ] `./scripts/verify.sh` passes

---

## Optional (only if time remains)

| ID | Feature | How | Done when |
|---|---|---|---|
| `V2-OPT-01` | AI-translated Nepali drafts | Admin "Translate to Nepali" button → a translation API fills an empty `ne` field and marks it `is_machine_translated`; the field shows a "Needs review" badge until the admin saves it | A draft stays marked until approved |
| `V2-OPT-02` | Retrain from the admin panel | Upload a survey CSV → run `app.ml.dataset` + `app.ml.train` in a background task → a table of models with accuracy and F1 → "Activate" | A new model becomes active without the terminal |
| `V2-OPT-03` | Bikram Sambat dates | An AD ↔ BS conversion table (BS month lengths for 2080–2090, from a published calendar) in `format.ts`; dates show in BS when Nepali is chosen | 2026-11-08 shows the correct BS date |

---

## Done when
- [ ] The Core demo (steps 1–3) works on a real phone **with mobile data off**
- [ ] Tracker rows `V2-P3-01` … `V2-P3-07` are *Done*, or Stretch rows are moved to future scope with a Decisions row
- [ ] The disclaimer shows on every safety screen in both languages
- [ ] algorithm.md (Lake Louise table, check-in job, delta sync) and database.md (`emergency_contact`, `accuracy_m`, `alerted_at`) are updated
- [ ] The Version 2 checklist in [README.md](README.md#version-2-is-done-when) is complete → git tag `v2.0`

## Risks
| Risk | What to do |
|---|---|
| An examiner asks "what if the SMS isn't sent?" | Be honest: Bato prepares the message, and the user sends it. This works offline and needs no paid gateway. A gateway and live tracking are future scope. |
| Wrong emergency numbers | Check each one against an official source, list the sources, and date them |
| Medical liability | The disclaimer, the standard Lake Louise wording, and always "descend now" on red flags. Never say "you are fine to go up". |
| GPS takes long indoors at the defense | Use the last known location with its time, and test the demo outdoors or with the emulator's fake location |
| APScheduler runs twice with `--reload` or several workers | Start it only when `ENABLE_SCHEDULER=true`, and run one worker for the demo |
| The week runs out | Ship Core only, and write the daily check-in and offline treks as future scope with this design |
