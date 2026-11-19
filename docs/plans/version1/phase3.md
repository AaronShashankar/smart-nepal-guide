# Version 1 · Phase 3 — Trip Planner, Admin Panel & V1 Release

**Weeks:** about 10–12 (Gantt "Sprint 3"), then testing and release before Version 2 work starts
**Goal:** a traveller can build a trip and get the best visiting order split into days; an admin can manage all content from the web panel; Version 1 is tested and installed as an APK.

Previous: [phase2.md](phase2.md) · Algorithms: [algorithm.md](../../design/algorithm.md)

**Status (2026-11-06): code done.** Trip planner (backend + mobile), admin API and admin panel are
built; 129 backend tests pass, and the mobile and admin typecheck, lint and build are clean. Still open (yours): app icon,
running the manual test table on two phones, hosting, the APK, the demo video and the `v1.0` tag.

**Status (2026-11-19):** all 52 manual test cases run on Phone 1 (Android emulator): 51 Pass, 1 Blocked
(TC-47 Near me, emulator GPS). The 9 bugs found (BUG-06 to BUG-14 in
[testing.md](../../testing/testing.md)) are fixed and their cases re-run; 175 backend tests pass. Left:
Phone 2 (a real phone: layout checks, TC-47, BUG-06), commit, and Nepali stage notes (V1-P3-19).
Changes from the plan below are marked *Note*.

---

## Demo at the end of this phase
1. In the app, add Pashupatinath, Boudhanath, Swayambhunath, Patan Durbar Square, Bhaktapur and Nagarkot to "My Trip".
2. Tap "Optimise" → best order, split into 2 days, total distance shown; the route is drawn on the map.
3. On the admin panel, add a new place in English and Nepali with a photo → it appears in the app at once.
   *Note:* the app caches lists for 5 minutes, so pull to refresh (or reopen the screen) to see it.
4. Edit a trek's stages in the admin panel → the itinerary and the acclimatisation warnings update.
5. The admin blocks a user → that user can no longer log in.
   *Note:* there was no "blocked" field in the database design; `user.is_blocked` was added. Tokens issued
   before the block stop working too (403 on every call), and the app then logs the user out.

---

## 1. Trip planner — backend

- [x] Tables: `trip`, `trip_stop` (migration `0003`, which also adds `review` and `user.is_blocked`). *Note:* `trip.total_km` added; `visit_hours` defaults to 1.5
- [x] `GET/POST /trips`, `GET/PATCH/DELETE /trips/{id}`, `POST/DELETE /trips/{id}/stops`
- [x] `POST /trips/{id}/optimise` → `{ordered_stops, days[], total_km}`, saves `visit_order` and `day_no`. *Note:* also returns `nearest_neighbour_km` to show the 2-opt improvement; adding or removing a stop clears the plan

### Algorithms (`app/algorithms/route.py`)
- [x] `haversine(a, b)` (from Phase 1) → distance matrix for the trip's places
- [x] `nearest_neighbour(matrix, start)`: start from the user's location or the first place, always go to the closest unvisited one
- [x] `two_opt(route, matrix)`: reverse segments while the total distance gets shorter. *Note:* the route is an open path; the first place stays fixed only when a start location is given
- [x] `split_days(route, max_hours=8)`: greedy; travel time = distance × road factor (1.4) ÷ average speed (25 km/h) + each stop's `visit_hours`; start a new day when the limit is passed
- [x] Tests: 2-opt is never worse than nearest neighbour; for 8 places or fewer, compare with brute force (exact answer) and record the gap for the report. *Note:* 2-opt is sometimes 20%+ worse on a single trip, so the test checks the **mean** gap (< 3%); the gap table is in `smart-nepal-guide/docs/route_gap.md` (mean ≈ 1%, exact in most trips)

## 2. Trip planner — mobile

- [x] "Add to My Trip" button on place detail (choose an existing trip or make a new one)
- [x] My Trips list → trip screen: title, start date, stops (remove a stop)
- [x] "Optimise" button → day-by-day plan ("Day 1: Swayambhunath → Pashupatinath → Boudhanath")
- [x] Map view of the trip: numbered markers + lines in visiting order (straight lines; real road routing is future scope)

## 3. Admin panel (React + Vite)

### Backend
- [x] `/admin/*` routes protected by `role = admin`
- [x] CRUD: categories, places (+ translations, aliases, photos, monthly climate), treks (+ translations, permits), stages, permits
- [x] Photo upload (multipart) → saved under `uploads/` and served as static files. *Note:* JPEG/PNG/WebP up to 5 MB; the URL is stored relative (`/uploads/...`) and the app and panel add the API address, so it works on any host. Render's free disk is wiped on redeploy (see §6)
- [x] Users: list, search, block/unblock (blocked users get 403 on login, Google sign-in, token refresh and every API call)
- [x] Reviews: list, hide/show (the table and the moderation screen are ready; writing reviews in the app arrives with Version 2). *Note:* the `review` table did not exist yet; it was created here
- [x] `GET /admin/stats`: counts of users, places, treks, risk predictions, and predictions per level

### Screens
- [x] Login (admin only)
- [x] Dashboard: the counts above + a simple bar chart of predictions per risk level
- [x] Places: table with search → form with **English / नेपाली tabs**, map picker for latitude/longitude, photo upload
- [x] Treks: form + **stage editor** (add day, choose from/to place, distance, hours; reorder). *Note:* total days, distance and highest point are recomputed from the stages on save, so the itinerary, acclimatisation check and risk model see the change at once
- [x] Categories and permits: simple forms
- [x] Users and reviews: tables with actions
- [x] Use one component library (e.g. Mantine or Ant Design) to save time: Mantine 7 + MapLibre GL for the map picker

## 4. Polish

- [x] Nepali text for every screen in `ne.json` (and the admin panel); check that Devanagari text fits on buttons (check on your phones)
- [x] Consistent loading, empty and error states; friendly messages when there is no internet
- [x] App icon, splash screen, app name. *Note:* the name is Bato. The icon and splash (a retro teal badge with an orange sunset behind cream peaks and a winding road, on cream) are generated by `mobile/assets/brand/make_icons.py`; the splash has a dark-mode background too

## 5. Testing (also needed for the report's testing chapter)

- [x] Backend: pytest for all algorithms and the main API routes (129 tests)
- [x] **Manual test cases table:** ID, feature, steps, input, expected result, actual result, pass/fail (about 30–40 cases covering login, profile, search, map, itinerary, acclimatisation, risk, trip planner, admin): 40 cases in `smart-nepal-guide/docs/testing/testing.md`; *Actual result* and *Pass/Fail* are filled in when you run them
- [ ] Test on at least two Android phones (different screen sizes). *Note:* order, counts and checks in `smart-nepal-guide/docs/testing/testing-guide.md` (1 command + 40 cases on Phone 1 + 8 layout cases on Phone 2). *Note (2026-11-19):* Phone 1 done on the emulator, all 52 cases (40 + 12 from V2 Phase 2); Phone 2 still to do
- [ ] Fix all bugs found before moving on. *Note (2026-11-19):* BUG-05 to BUG-14 fixed and re-tested on the emulator; BUG-06 (High, Nepali labels cut off) still needs a check on a real phone

## 6. Version 1 release

- [x] Backend + database on a free host (Render or Railway) or on your laptop for the defense; keep a seed-and-run script. *Note (2026-11-08):* decided to run on the laptop for now; `scripts/start-demo.sh` starts PostgreSQL, Redis, the API, the admin panel and Metro, and writes the laptop's Wi-Fi IP into `mobile/.env` (`--seed` reloads data). *Note:* `app.seed` overwrites admin edits to seeded places/treks (it keeps what the admin added), so don't re-seed after real edits
- [x] Admin panel on Vercel or Netlify. *Note:* runs from the laptop instead (`http://localhost:5173`, started by the same script); a free host can come later
- [ ] Android APK with EAS Build (`eas build -p android --profile preview`). *Note:* `mobile/.env` is not uploaded, so set `EXPO_PUBLIC_API_URL` to the laptop's IP in the `preview` profile's `env` in `eas.json`; the phone must then be on the same Wi-Fi/hotspot
- [ ] Record a 3–5 minute demo video as a backup in case the network fails at the defense
- [ ] Git tag `v1.0`

---

## Done when
- [ ] Every Version 1 feature in [feature.md](../../design/feature.md) works end to end on a phone
- [x] The admin panel can manage all content without touching the database
- [ ] The test case table is filled in and the tests pass
- [ ] The APK installs on a fresh phone

**Then:** Version 2, see [version2/README.md](../version2/README.md) (Phase 1 smart trek features → Phase 2 personalisation & community → Phase 3 safety & offline).

## Risks
| Risk | What to do |
|---|---|
| The admin panel takes too long | Plain forms from the component library; no custom design |
| Stage editor is fiddly | Start with a simple ordered list with "move up/down" buttons |
| Hosting fails on defense day | Run everything locally and keep the demo video |
