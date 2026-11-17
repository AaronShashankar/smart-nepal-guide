# Version 2 · Phase 1 — Smart Trek Features

**Week:** about 13 (Gantt "V2 Phase 1"). Start only after the Version 1 gate in [README.md](README.md) is passed.
**Goal:** the trek page helps a traveller prepare. It shows how the altitude changes day by day, suggests
an easier trek when the chosen one is too risky, shows the weather forecast, and makes a packing list
for the trek and the month.

Overview: [README.md](README.md) · Next: [phase2.md](phase2.md) · Algorithms: [algorithm.md](../../design/algorithm.md)

**Status:** not started. Tracker rows `V2-P1-01` … `V2-P1-08`.

**What already exists from Version 1:** stages with sleeping altitude and highest point
(`app/services/itinerary.py`), the risk model and `predict()` (`app/services/risk.py`), and Redis in
docker-compose / Homebrew (not used yet).

**Native packages for this phase** (install on day 1, then rebuild once): `react-native-svg`,
`@react-native-async-storage/async-storage`.

---

## Demo at the end of this phase
1. **Everest Base Camp → Day-by-day itinerary.** An altitude chart sits above the day cards. The line climbs from Lukla (2,860 m) to Kala Patthar (5,644 m), and the rest days at Namche and Dingboche are flat. Tap a point to see "Day 4 · Tengboche 3,860 m".
2. **Profile:** medium fitness, no experience. **EBC → Check my risk → January → Risky.** Below the reasons, a "Safer alternatives for you" box lists 1–3 similar treks that the same model rates lower for *this* user in January (expected: Poon Hill or Mardi Himal; record the real result). Tap one to open that trek.
3. **Trek page and place page:** a 7-day forecast (icon, max/min °C, rain mm) for the trek's highest sleeping place. Open it again: the response header `X-Cache: HIT` shows it came from Redis.
4. **EBC → Packing list → January.** It includes a down jacket, microspikes and a −10 °C sleeping bag. **Poon Hill → October** gives a much shorter list. Tick items, close the app and reopen it: the ticks are still there.

---

## 1. Altitude profile graph (`V2-P1-01`) — Core

**Algorithm: linear interpolation.** Each day has three known points: start altitude (km 0 of the day),
highest point (placed in the middle of the day's distance when it is higher than both ends) and sleeping
altitude (end of the day). Between known points the altitude is assumed to change in a straight line:
`alt(x) = a₁ + (a₂ − a₁) · (x − x₁) / (x₂ − x₁)`.

- [ ] `app/algorithms/altitude_profile.py`: `profile_points(stages) -> list[Point(km, altitude_m, day, place, kind)]`. Here *km* is the distance added up along the trek, and *kind* is `start` / `high` / `sleep`. A rest day adds a point at the same km and altitude.
- [ ] `interpolate(points, km) -> altitude_m`, used by the tests and by the chart's tap tooltip
- [ ] `GET /treks/{id}/altitude-profile` → `{points[], max_altitude_m, total_km}`, with localised place names
- [ ] Mobile: `AltitudeChart` component drawn with `react-native-svg` (a polyline plus a filled area). It has dashed lines at 3,000 m and 5,000 m and day labels on the x-axis. It sits at the top of the itinerary screen. No chart library is needed, and drawing it yourself is easy to explain.
- [ ] Colour each line segment by that day's acclimatisation status (green / orange / red) so the chart and the badges match
- [ ] Nepali: axis labels and numbers in Devanagari digits (reuse `format.ts`)

## 2. Safer alternative suggestion (`V2-P1-02`, `V2-P1-03`) — Core (Wow)

**Algorithm: K-nearest neighbours (KNN) + the risk model.**
1. Describe each trek with a vector of its 4 trek features: max altitude, max daily gain, total days and km per day.
2. Scale every feature to 0–1 with **min–max normalisation** over all published treks, so that metres don't swamp days.
3. Work out the **Euclidean distance** `d = √Σ(aᵢ − bᵢ)²` from the chosen trek to every other trek, sort, and keep the K = 4 nearest.
4. Run the active risk model for **this user and this month** on each neighbour. Keep only treks rated **lower** than the chosen one, and show the 3 nearest of those.
5. If none is lower, show nothing (don't suggest a trek that is just as risky).

- [ ] `app/algorithms/knn.py`: `normalise(vectors)`, `euclidean(a, b)` and `k_nearest(target, others, k)`, all written by hand (NumPy only)
- [ ] `app/services/alternatives.py`: `safer_alternatives(db, user, trek, month)`. Reuse the feature building from `risk.predict` (move it into one shared helper first, so both code paths use the same features). Don't save these extra predictions in `risk_prediction`.
- [ ] `GET /treks/{id}/safer-alternatives?month=` (login required) → `[{trek, level, distance, why}]`. Here *why* is a short reason code such as `LOWER_ALTITUDE` / `FEWER_DAYS` / `SMALLER_GAIN`: the feature where the alternative improves most on the chosen trek.
- [ ] Mobile: on the risk result screen, when the level is *hard* or *risky*, a "Safer alternatives for you" card list (name, level badge, one reason) that opens the trek
- [ ] Report: a worked example table (EBC vs the 7 other treks: normalised vectors, distances, predicted level)

*Limitation to write in the report:* with only 8 treks, the "4 nearest" are half of all treks. KNN
becomes more meaningful as the admin adds treks.

## 3. Weather forecast (`V2-P1-04`, `V2-P1-05`) — Core

**Pattern: cache-aside with a TTL.** Look in Redis first. On a miss, call Open-Meteo, store the answer
for 1 hour, then return it. Open-Meteo is free and needs no API key.

- [ ] Add `redis` (redis-py) to the backend. `app/core/cache.py`: `get_json(key)` and `set_json(key, value, ttl)`. If Redis is down, log a warning and carry on without a cache (the app must not break).
- [ ] `app/services/weather.py`: `forecast(lat, lng)` calls `https://api.open-meteo.com/v1/forecast` with `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum`, `timezone=Asia/Kathmandu` and `forecast_days=7`, using `httpx` with a 5 s timeout
- [ ] Cache key `weather:{lat:.2f}:{lng:.2f}` (rounding means nearby requests share one entry), TTL 3,600 s. Also keep a `weather:stale:…` copy for 24 h, returned with `stale: true` when Open-Meteo fails.
- [ ] `GET /places/{id}/weather` and `GET /treks/{id}/weather` (a trek uses its highest sleeping place; the response says which place). Response header `X-Cache: HIT|MISS` for the demo.
- [ ] Map WMO weather codes to an icon and a sentence key (`weather.code.61` = "Light rain") in `en.json` / `ne.json`
- [ ] Mobile: `ForecastStrip` on the trek overview and place detail (7 small cards that scroll sideways). Show "Updated 20 min ago". On error, hide the strip instead of showing a big error.
- [ ] `.env`: `WEATHER_CACHE_SECONDS=3600`. Add Redis to the "is it running?" checks in runlocal.md (it is now used).

## 4. Packing checklist (`V2-P1-06`, `V2-P1-07`) — Core

**Algorithm: rule-based expert system.** Every item has conditions. An item is on the list when all of
its conditions are true for this trek and month (forward chaining over a flat rule table).

- [ ] Table `packing_item` (id, code, group: `clothing` / `gear` / `health` / `documents`, sort_order) plus `packing_item_translation` (name, note). Rule columns: `min_altitude_m`, `months` (int[], empty = any month), `min_days`, `always` (bool).
- [ ] Seed `data/packing_items.csv` (about 30 items). Examples:
  - always: passport copy, water purification, first-aid kit, sunscreen
  - altitude above 4,000 m: down jacket, −10 °C sleeping bag, Diamox (*"ask a doctor"*)
  - December–February above 3,500 m: microspikes, gaiters, insulated gloves
  - June–August: rain cover, leech socks
  - 10+ days: extra batteries / power bank
  - required permits: taken from the trek's permits (TIMS, ACAP …), so the list and the permit section always match
- [ ] `app/algorithms/packing.py`: `packing_list(trek_facts, month, permits) -> list[(item, reason_code)]`, where *reason* is `ALWAYS` / `ALTITUDE` / `WINTER` / `MONSOON` / `LONG_TREK` / `PERMIT`. Show the reason as a small grey label ("because you go above 4,000 m").
- [ ] `GET /treks/{id}/packing?month=` → items grouped by `group`
- [ ] Mobile: "Packing list" button on the trek page → month picker (default: this month) → a checklist grouped by section. Ticks are saved on the phone with AsyncStorage under `packing:{trekId}:{month}`. A "Reset" button clears them.
- [ ] Admin panel (Extra): a Packing items page using the same table + form pattern as Permits

## 5. Tests (`V2-P1-08`) — Core

- [ ] Interpolation: the midpoint between (0 km, 2,000 m) and (10 km, 3,000 m) is 2,500 m. EBC's highest profile point is 5,644 m (Kala Patthar). A rest day adds no km.
- [ ] KNN: `euclidean` on known vectors; min–max scaling gives 0 and 1 at the ends; the nearest neighbour of a trek is never the trek itself
- [ ] Safer alternatives: beginner + EBC + January returns only treks with a lower level. An expert on Poon Hill in October returns nothing.
- [ ] Weather (Open-Meteo mocked with `respx` or a fake client): the first call is a MISS and calls the API once; the second call within the TTL is a HIT and doesn't call the API; when the API fails, the stale copy is returned; when Redis is down it still works
- [ ] Packing: EBC + January includes the down jacket and microspikes; Poon Hill + October has neither; the permit items match the trek's permits
- [ ] `./scripts/verify.sh` passes (the backend test count goes up; write the new number in README.md)

---

## Done when
- [ ] The demo above works on a phone, in English and Nepali
- [ ] Tracker rows `V2-P1-01` … `V2-P1-08` are *Done* with a commit hash
- [ ] algorithm.md and database.md are updated (`packing_item`, endpoints); runlocal.md has a "Check the V2 Phase 1 demo" list
- [ ] Test cases TC-41 onwards are added for the chart, alternatives, weather and packing list

## Risks
| Risk | What to do |
|---|---|
| Open-Meteo is slow or down during the demo | The stale cache copy (24 h). Open the trek once before the defense so the cache is warm. |
| Too few treks for KNN to look smart | Explain the limitation. If you add treks for the ML data (Version 1 review), KNN gets better for free. |
| No alternative is rated lower | Show nothing, and test with the demo profile beforehand. Never show a "safer" trek that isn't. |
| SVG chart is fiddly on small screens | Fixed height (180 dp), width = screen width; put labels for every day only when there are 12 days or fewer, otherwise every other day |
| Packing advice reads as medical or safety advice | Add a "General guidance — check with your agency" note; Diamox says "ask a doctor" |
