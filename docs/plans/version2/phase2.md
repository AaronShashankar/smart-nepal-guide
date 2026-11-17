# Version 2 · Phase 2 — Personalisation & Community

**Week:** about 14 (Gantt "V2 Phase 2").
**Goal:** the app gets personal and social. It recommends places and treks that match your interests,
the season and your budget. Travellers can rate and review. You can find places near you, see what a
trip will cost, share a trip with a link, and see the teahouses along a trek.

Previous: [phase1.md](phase1.md) · Next: [phase3.md](phase3.md) · Overview: [README.md](README.md)

**Status:** code done 2026-11-09 (Core and Extra), 175 backend tests, `./scripts/verify.sh` passes. Still to do by hand: run the demo on a phone (rebuild the dev build first for `expo-location`). Tracker rows `V2-P2-01` … `V2-P2-10`.

**What already exists from Version 1:**
- profile `budget_level`, `travel_style` and interests (nature / culture / adventure / religious)
- the best-month score per place (`app/algorithms/best_time.py`)
- the `review` table and admin moderation (hide / show)
- `trip.estimated_budget_npr` and `trip.share_token` columns (still empty)
- Haversine and the map bounding-box filter

**Native packages for this phase:** `expo-location` (Near me). Sharing uses React Native's built-in `Share`.

**Order inside the week:** Reviews → Recommendations → Near me → Budget are *Core*. Share trip and
Teahouses are *Extra*.

---

## Demo at the end of this phase
1. **Recommended for you.**
   - Log in as a traveller with interests *Culture + Religious* → Explore shows "Recommended for you" with temples and heritage sites first.
   - Change the interests to *Nature + Adventure* and pull to refresh → lakes, viewpoints and treks come first.
   - A brand-new user with no interests sees "Popular now" instead.
2. **Reviews.**
   - Open Poon Hill → write a 4★ review → it appears at once with your name.
   - In the admin panel, hide it → it disappears from the app.
   - Show the ranking example: a place with one 5★ review ranks below a place with 20 reviews averaging 4.6★.
3. **Near me** (on a real phone in Kathmandu, or set the location in the emulator to Thamel) → the closest places are listed first, with "1.2 km".
4. **Budget estimate.** The "Valley" trip from the Version 1 demo → **Estimate budget** → a breakdown of transport, food, stay and entry fees for the 2 days. Change the budget level in the profile → the total changes. **EBC → Budget** shows permits at the foreign / SAARC / Nepali rate, chosen from your profile's nationality.
5. **Share** (Extra): Valley → **Share** → the Android share sheet → open the link in a browser that isn't logged in → a read-only trip page with the stops and the day plan.
6. **Teahouses** (Extra): EBC itinerary → day 4 → "Teahouses in Tengboche".

---

## 1. Reviews & ratings (`V2-P2-03`, `V2-P2-04`) — Core

**Algorithm: Bayesian average.** `score = (C · m + Σ ratings) / (C + n)`.
- *n* is the number of visible reviews of this item.
- *m* is the mean rating over **all** visible reviews in the app.
- *C* = 5 is how many "average" reviews every item starts with.

Few reviews → the score stays near *m*. Many reviews → the score moves to the item's own average.
Worked example for the report (with m = 4.0):
- one 5★ review: (5·4 + 5) / 6 = **4.17**
- 20 reviews averaging 4.6★: (5·4 + 92) / 25 = **4.48**, so it ranks higher.

- [x] Migration `0005`: partial unique indexes
  *Note:* The migration is **`0004`** (V2 Phase 1 is not built yet, so it gets the next number later). It also adds `review.updated_at`, and removes older duplicates before creating the indexes. The second post is an `INSERT … ON CONFLICT DO UPDATE` on the partial index (atomic); an admin's *hidden* status stays hidden after an edit. so a user can review a place or a trek only once (`(user_id, place_id)` and `(user_id, trek_id)` where not null). A second post **updates** the review.
- [x] `app/algorithms/rating.py`
  *Note:* Before the app has any review, m = 3.0 (the middle of 1–5).: `bayesian_average(sum, n, global_mean, c=5)`
- [x] `POST /places/{id}/reviews` and `POST /treks/{id}/reviews`
  *Note:* 201 for a new review, 200 when it replaced yours. The list also returns `rating` and `mine` (your own review, even if hidden) when you are logged in. Reviews show the user's full name, never the email. `{rating 1–5, comment ≤ 1,000 chars}`. `lang` is taken from `Accept-Language`. `GET …/reviews?page=` lists newest first, visible only.
- [x] `DELETE /reviews/{id}` (your own review only)
- [x] Add `rating: {score, count}` to the place and trek detail and list responses (one grouped query, no N+1). Add `sort=rating` to `/places` and `/treks`.
- [x] Mobile: stars + count on cards and detail pages; a "Write a review" sheet (stars + text); the review list with "Your review" pinned first
- [x] Admin: the existing Reviews page now has real data; show the comment's language

## 2. "Recommended for you" (`V2-P2-01`, `V2-P2-02`) — Core

**Algorithm: content-based filtering with cosine similarity.** `cos θ = (A · B) / (‖A‖ ‖B‖)`.

1. **Item vector** (places and treks share the same 6 dimensions):
   - `[nature, culture, adventure, religious, season_fit, budget_fit]`
   - The 4 interest values come from a fixed table of category → interest weights, for example temple → religious 1, culture 0.7, and lake → nature 1. Treks are adventure 1, nature 0.8.
   - `season_fit` is the place's best-time score for the current month (0–1, already computed in Version 1). For treks it is 1 in the main seasons and 0.3 otherwise.
   - `budget_fit` is 1 when the item suits the user's budget level, 0.5 for one level off, and 0 otherwise.
2. **User vector:** 1 for each chosen interest, 0 otherwise, plus `season_fit = 1` and `budget_fit = 1`.
3. Score every item with cosine similarity, sort, and return the top 10. Exclude items the user has already reviewed or added to a trip. Mix places and treks.
4. **Cold start** (no interests): "Popular now" = items ranked by Bayesian rating, then by how often they were added to trips.

- [x] `app/algorithms/similarity.py`: `cosine(a, b)` (written by hand; a zero vector gives 0)
- [x] `app/services/recommend.py`
  *Note:* Trek villages (category `village`) are not recommended on their own; their trek is. `budget_fit` treats *cheaper* as suiting: 1 when the item's cost level is at or below the user's level, 0.5 one level above, 0 two above (cost level: entry fee ≤ 500 / ≤ 1,500 / more; treks ≤ 5 / ≤ 9 / 10+ days). "because" lists shared interests first, then `GOOD_SEASON` / `FITS_BUDGET`. Popular mode uses `HIGHLY_RATED` / `OFTEN_PLANNED`. with the category → interest weight table in one place (copy it into the report)
- [x] `GET /recommendations?limit=10`
  *Note:* Optional `month=` (default: this month in Nepal) for tests and the demo. (login required) → `{mode: "personal" | "popular", items[{type, item, score, because[]}]}`. Here *because* holds the top two matching dimensions, e.g. `INTEREST_CULTURE`, `GOOD_SEASON`.
- [x] Mobile: a "Recommended for you" row that scrolls sideways, at the top of Explore (logged-in users only), with a small "Because you like culture" line on each card
- [x] Report: a worked example
  *Note:* Written in algorithm.md (temple 0.989 > heritage 0.938 > lake 0.550) and checked by `test_cosine_worked_example_for_the_report`. with one user vector and 3 item vectors, showing the cosine values step by step

## 3. Near me (`V2-P2-05`) — Core

**Algorithm:** a bounding box first (a fast, indexed SQL filter on latitude and longitude), then exact
Haversine distance, then sort. The box half-size is `Δlat = r / 111 km` and `Δlng = r / (111 km · cos lat)`.

- [x] `GET /places/near
  *Note:* `EXPLAIN`: with 69 rows PostgreSQL uses a sequential scan; the `(latitude, longitude)` index from Version 1 is used once the table grows (checked with `enable_seqscan = off`). Max radius 200 km.?lat=&lng=&radius_km=20&limit=20` → places with `distance_km`, closest first. Reuse `haversine.py`. Add an index on `(latitude, longitude)` if `EXPLAIN` shows a sequential scan.
- [x] Mobile: a "Near me" chip
  *Note:* The chip first explains why, then asks; when permission is refused for good it offers "Open settings". on Explore. It asks for location permission with a clear message, and shows "Turn on location to see places near you" when permission is refused. Uses `expo-location` with balanced accuracy.
- [ ] Optional: a "Near me" button on the map that centres on the user (MapLibre `UserLocation`)
  *Note:* not done (optional): future scope.

## 4. Budget estimate (`V2-P2-06`, `V2-P2-07`) — Core

**Algorithm: formula-based estimate.**
- **Trip** = `days × (food + stay)[budget level] + total_km × transport rate[budget level] + Σ entry fees[nationality]`
- **Trek** = `days × (teahouse food + stay)[region] + permits[nationality] + transport to the trailhead`

- [x] Migration `0005`: add `traveller_profile.nationality`
  *Note:* In migration `0004`. `budget_rate` is keyed (budget_level, region) with regions `city`, Annapurna, Khumbu, Langtang, Manaslu and `other` (fallback for a new region), plus a `trailhead_transport_npr` column for the trek's "transport to the trailhead". The rates are round-number estimates (see data/README.md). (enum `nepali` / `saarc` / `foreign`, default `foreign`; asked on the profile screen). Add table `budget_rate` (budget_level, region or `city`, food_per_day_npr, stay_per_day_npr, transport_per_km_npr), seeded from `data/budget_rates.csv`.
- [x] Places: add `entry_fee_saarc_npr`
  *Note:* Sources and the date are in data/README.md. Changu Narayan and Lumbini SAARC fees are not confirmed by a second source: check them. and `entry_fee_nepali_npr` next to the existing `entry_fee_npr` (which becomes the foreign fee), the same way as permits. **Check the real fees and write down the source**, as for Version 1.
- [x] `app/services/budget.py`
  *Note:* `trip_budget(db, trip, profile, lang)` / `trek_budget(…)`; lines also carry a `label` (place or permit name). Trek formula uses the user's budget level too: `[level, region]`. No profile → medium + foreign.: `trip_budget(trip, profile)` and `trek_budget(trek, profile)` → `{total_npr, lines[{code, qty, rate, amount}]}`
- [x] `POST /trips/{id}/budget`
  *Note:* Changing the stops clears the saved estimate together with the plan. `GET /treks/{id}/budget` works without login (defaults). (saves `trip.estimated_budget_npr`; needs an optimised trip so that days and km are known, otherwise 409 `NOT_OPTIMISED`) and `GET /treks/{id}/budget`
- [x] Mobile: an "Estimate budget" button on the trip screen and a Budget card on the trek page: a table of lines and a total in NPR (`रु` and Devanagari digits in Nepali), with an "Estimate only" note
- [x] Admin (Extra): edit `budget_rate` in a small table page

## 5. Share a trip (`V2-P2-08`) — Extra

- [x] `POST /trips/{id}/share`
  *Note:* Also returns `app_url` (the deep link). Sharing an already shared trip returns the same link. `PUBLIC_BASE_URL` in `.env` can fix the link's address; empty = the address the phone used. creates `share_token = secrets.token_urlsafe(16)` (owner only) → `{url}`. `DELETE /trips/{id}/share` stops sharing (clears the token).
- [x] `GET /shared/trips/{token}`
  *Note:* The page is `app/templates/shared_trip.html` (string.Template, every value HTML-escaped), in English or Nepali from `Accept-Language`, with an "Open in the Bato app" link. → read-only JSON (title, stops, day plan, no user data). `GET /s/{token}` → a small HTML page served by FastAPI (one template, no framework) for people without the app.
- [x] Mobile: a "Share" button
  *Note:* The shared screen works logged in or not. → `Share.share({ message: url })`. Also add a deep link `smartnepalguide://shared/{token}` that opens the trip read-only in the app.
- [x] Security: the token is 128 random bits; a wrong token gives 404; a deleted trip gives 404; stopping sharing makes old links stop working (test this)

## 6. Teahouses (`V2-P2-09`) — Extra

- [x] Table `teahouse`
  *Note:* `name` and `price_note` live in `teahouse_translation` (both can be translated); `has_wifi` / `has_hot_shower` may be null (= not known); a `source` column was added so every lodge says where it comes from. (id, place_id → the village, name, phone, price_note, has_wifi, has_hot_shower, updated_at, deleted_at) + `teahouse_translation`
- [x] Seed `data/teahouses.csv`
  *Note:* 4 real lodges in Tengboche from named sources (blog, agency guides, a booking listing); no phone numbers, because none were found in a source. Other villages: future work (say so in the report). with **real** lodges only, from sources you can name (agency itineraries, ACAP lists, your survey). Don't invent names or phone numbers. If you can't find real ones, ship the screen with a few entries and say so in the report.
- [x] `GET /places/{id}/teahouses`
  *Note:* The itinerary's stages now carry `teahouse_count`; the link shows on any day (also rest days) whose sleeping place has lodges.. The itinerary day card shows "Teahouses (3)" for the sleeping place → a list.
- [x] Admin: a Teahouses table + form (copy the Permits page)

## 7. Tests (`V2-P2-10`) — Core

- [x] Bayesian average: the worked example above (4.17 vs 4.48); n = 0 gives m; a hidden review is not counted
- [x] Reviews: posting twice updates instead of duplicating; rating 0 or 6 → 422; you can't delete someone else's review (404); a blocked user can't post
- [x] Cosine: identical vectors → 1; orthogonal vectors → 0; a zero vector → 0. A culture user gets a temple above a lake; a nature user gets the opposite; a new user gets `mode: "popular"`.
- [x] Near me: from Thamel, the Kathmandu places come before Pokhara; `radius_km` is respected; results are sorted by distance
- [x] Budget: a hand-computed example for the Valley trip; the foreign permit rate is above SAARC, which is above Nepali; a trip that isn't optimised → 409
- [x] Share: a public link works without login; after stopping sharing → 404; no email or user id in the public JSON
- [x] `./scripts/verify.sh` passes
  *Note:* 46 new tests in `tests/test_reviews.py` and `tests/test_personalisation.py` (129 → 175).

---

## Done when
- [ ] The demo above works on a phone (Core items at least), in English and Nepali
- [ ] Tracker rows `V2-P2-01` … `V2-P2-10` are *Done* (or Extra ones moved to future scope with a Decisions row)
- [x] algorithm.md (cosine worked example, Bayesian example, budget formula) and database.md (`budget_rate`, `teahouse`, `nationality`, review unique indexes) are updated
- [x] New test cases are added to `docs/testing/testing.md`
  *Note:* TC-41 … TC-52.

## Risks
| Risk | What to do |
|---|---|
| No reviews yet, so the ranking looks empty | Add a few clearly marked test reviews for the demo only, from test accounts. Remove them before any real release. |
| Budget numbers look invented | Put the sources and the date in `data/README.md`, and show "Estimate only" in the app |
| Location permission refused in the demo | Allow it beforehand; the emulator can set a fake location (Extended controls → Location) |
| Share link only works on the laptop's network | Say so in the report; it works on the hotspot / Wi-Fi used for the demo |
| Recommendations look random | Keep the "because" line, so every item says *why* it was picked |
