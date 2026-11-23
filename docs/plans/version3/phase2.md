# Version 3 · Phase 2 — Launch-ready

**When:** months 2–3, only after a **go** in Phase 1.
**Goal:** strangers can install Bato from Google Play, it runs without your laptop, it keeps working on
the trail without signal, and the risk model starts learning from real trekkers.

Previous: [phase1.md](phase1.md) · Overview: [README.md](README.md) · Next: [phase3.md](phase3.md)

**Status:** not started. Tracker rows `V3-P2-01` … `V3-P2-09`.

---

## Demo at the end of this phase
1. Install Bato from Google Play on a phone that has never had it, on mobile data (not your Wi-Fi).
2. Register, open Annapurna Base Camp, **download it for offline** (trek pack + map).
3. Airplane mode → the trek, itinerary, packing list **and the map with the route** all work.
4. After the trek date, the app asks "How did your trek go?" (consent first) → the answer appears in the admin panel.
5. Settings → **Delete my account** → the account and personal data are gone.
6. Sentry shows the app and API with no unresolved crashes; last night's backup exists and the last restore test passed.

---

## 1. Cloud hosting (`V3-P2-01`) — Core

- [ ] Managed PostgreSQL 16 with `pg_trgm`; Redis; the API in Docker on a small VPS or a PaaS
- [ ] HTTPS and a domain (`api.<your-domain>`); the admin panel on a static host (`admin.<your-domain>`)
- [ ] Photo uploads move from the local `uploads/` folder to object storage (S3-compatible), since a server's disk can be wiped
- [ ] Environment settings per stage: `development` (laptop), `production`; production secrets only in the host's settings
- [ ] `eas.json` production profile with `EXPO_PUBLIC_API_URL=https://api.<your-domain>`
- [ ] Write the monthly cost in NPR in the tracker notes

## 2. Backups and monitoring (`V3-P2-02`) — Core

- [ ] Daily database backup kept for 14 days; **restore it into a fresh database once a month** and write the date down
- [ ] Sentry (free tier) in the mobile app and the API; source maps uploaded for release builds
- [ ] An uptime check on `/health` that emails you when it's down
- [ ] Logs without personal data (no emails, tokens or exact locations)

## 3. Security pass (`V3-P2-03`) — Core

- [ ] `docs/product/security.md` checklist: rate limits on login, register and password reset; CORS limited to the admin domain; secrets never in git (scan the history); dependency audit (`uv` and `npm audit`); upload size and type limits (already in V1); admin accounts with long passwords or 2FA
- [ ] JWT secret rotated for production; refresh tokens can be revoked

## 4. Account deletion and data export (`V3-P2-04`) — Core

- [ ] Settings → **Delete my account**: confirmation, then delete the user's profile, trips, reviews (or make them anonymous), risk checks, contacts, SOS events and check-ins
- [ ] A web page to request deletion (Google Play asks for a link that works without the app)
- [ ] Settings → **Download my data** (JSON)
- [ ] Tests: after deletion, nothing in any table points to the user

## 5. Offline maps (`V3-P2-05`) — Core

Builds on the V2 offline trek pack (`V2-P3-06`), which has everything except the map.

- [ ] For the first region, download map tiles for a box around each trek at zoom levels about 10–15 (MapLibre's offline packs, or a PMTiles file per region)
- [ ] Show the size before downloading; delete in Settings → Downloaded treks
- [ ] The trek route line and the stops come from the offline pack
- [ ] The map style's fonts and icons are also stored offline
- [ ] Check the tile source's licence and terms for offline use; show the OpenStreetMap credit
- [ ] Test on a cheap phone with little storage

## 6. Real data for the risk model (`V3-P2-06`) — Core

- [ ] After a trip's end date, ask "How did your trek go?" with the same questions as the [survey](../../survey/trekker-survey.md); **ask for consent** to use the answer for training
- [ ] Answers → `training_sample` with `source = app_survey`
- [ ] Retrain once there are **200+ real answers**; report accuracy on **real rows only** next to the old numbers
- [ ] `docs/ml/model-card.md`: training data (real vs rule-generated share), accuracy, known limits, "not medical advice"
- [ ] In the app, show "based on N trekkers" next to the rating once N is real

## 7. Content freshness (`V3-P2-07`) — Extra

- [ ] A `verified_at` date on fees, permits, teahouses and budget rates
- [ ] Admin panel page "Needs checking": everything older than 6 months
- [ ] The app shows "Price checked Mar 2027" next to fees

## 8. Analytics (`V3-P2-08`) — Extra

- [ ] Opt-in only (asked on first launch, can be changed in Settings); no personal data
- [ ] Events: app opened, trek viewed, risk checked, trip saved, offline pack downloaded, SOS used (count only)
- [ ] A weekly view in the admin dashboard or the analytics tool

## 8b. Search and recommendations with real users (`V3-SR-01` … `V3-SR-08`) — Extra

Stage 2 of [search-recommendation.md](../../product/search-recommendation.md). Needs the analytics consent above.

- [ ] `V3-SR-05` Record user actions (opened, saved, added to trip, reviewed, risk checked), with consent; deleted with the account
- [ ] `V3-SR-01` Log searches; admin page "top searches with no results"
- [ ] `V3-SR-08` Measure recommendations: shown, opened, added to trip (weekly in the admin dashboard)
- [ ] `V3-SR-06` "People who planned X also planned Y"
- [ ] `V3-SR-07` Taste from behaviour, recent actions count more
- [ ] `V3-SR-02` Offline search · `V3-SR-03` Recent and popular searches · `V3-SR-04` Full-text search in descriptions

## 9. Play Store release (`V3-P2-09`) — Core

- [ ] **Decide the final package ID first** (Decisions tab). It can't be changed after the first upload. Changing it now also means a new Google OAuth client and a new development build.
- [ ] Google Play developer account (personal or organisation, see README)
- [ ] Store listing in English and Nepali: short and long description, 4–8 screenshots, feature graphic, category Travel & Local
- [ ] Privacy policy URL, data-safety form, account deletion URL, content rating
- [ ] Production build with EAS (`eas build -p android --profile production`), version code and version name
- [ ] **Closed test:** a new personal account must keep at least 12 testers opted in for 14 days in a row before it can apply for production. Recruit 15–20 testers from the waitlist and interviewees.
- [ ] Apply for production access → release

---

## Tests
- [ ] Account deletion leaves no rows that point to the user
- [ ] Rate limits return 429 after the limit
- [ ] Survey answers only become training rows when consent is given
- [ ] Offline: the trek and the map open in airplane mode after a cold start (manual case)
- [ ] `./scripts/verify.sh` passes; migrations tested on a copy of production

## Done when
- [ ] The demo above works on a phone that was never used for development
- [ ] Tracker rows `V3-P2-01` … `V3-P2-09` are *Done* (or Extra rows moved to later with a Decisions row)

## Risks
| Risk | What to do |
|---|---|
| Hosting costs more than planned | Start with the smallest plan; one region; check the bill every month |
| The 14-day closed test fails | Recruit more than 12 testers; remind them weekly; don't remove anyone |
| Offline tiles are too big | Only the trek corridors, not whole regions; limit the zoom levels |
| Too few real survey answers | Ask agencies in the pilot to send the survey to their clients |
