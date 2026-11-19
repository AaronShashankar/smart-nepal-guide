# Bato (Smart Nepal Tourist & Trek Guide) — Algorithms, Functions & Protocols

Drafted 2026-11-05. See [feature.md](feature.md) for the feature list (all features kept).

---

# Part 1: Algorithms

## Core algorithms (the ones the viva will focus on)

### 1. Trek Difficulty & Risk Prediction: Decision Tree (CART) → Random Forest
- **Inputs:** max altitude, biggest one-day altitude gain, total days, distance per day, month/season, user age, fitness level, trekking experience, health conditions
- **Output:** Easy / Moderate / Hard / Risky
- **How it works:** CART splits the data on the question that best separates the classes, measured by **Gini impurity**:

  `Gini = 1 − Σ pᵢ²`

  A random forest is many such trees, each trained on a random sample of the data, that vote on the answer.
- **Implementation:** both the decision tree and the random forest are written from scratch in Python/NumPy (`backend/app/ml/tree.py`, `forest.py`). scikit-learn's `DecisionTreeClassifier` and `RandomForestClassifier` are used only to compare accuracy on the same split.
- **Evaluation for the report:** accuracy, precision, recall, F1-score, confusion matrix.

### 2. "Why this rating?": Decision Path Tracing
- Follow the path the user's data took through the tree and turn each split into a sentence.
- Example: `experience = beginner` and `max_gain > 800 m` become "You are a beginner, and day 4 climbs 900 m."

### 3. Trip Planner: Haversine + Nearest-Neighbour TSP + 2-opt + Greedy Day Split
- **Haversine formula:** the real distance between two GPS points on Earth

  `d = 2R · asin(√(sin²(Δφ/2) + cos φ₁ · cos φ₂ · sin²(Δλ/2)))`, where R = 6371 km

- **Nearest-neighbour heuristic:** start at the user's location if given (it then stays first), otherwise at the first place added; always go to the closest place not yet visited.
- **2-opt improvement:** reverse parts of the route whenever that makes it shorter. The route is an *open* path (no return to the start); without a start location 2-opt may also change which place comes first.
- **Brute force (exact) for 8 places or fewer**, used to measure how far 2-opt is from the best answer: over random trips the mean gap is about 1% and 2-opt finds the exact answer in most trips (`smart-nepal-guide/docs/route_gap.md`).
- **Greedy day split:** travel time = distance × 1.4 (road factor) ÷ 25 km/h, plus each stop's visit hours (default 1.5 h); start a new day when 8 hours would be passed.
- Demo: the 6 Kathmandu Valley places → 2 days, 31.3 km after 2-opt against 38.8 km from nearest neighbour alone.

### 4. Acclimatisation Warning: Rule-Based System (standard high-altitude guidelines)
- Above 3,000 m, a day where the sleeping altitude rises by more than 500 m → ⚠️ caution.
- Above 3,000 m, more than 1,000 m gained since the last rest day → ❌ danger, and a rest day is suggested the night before.
- Output per day: ✅ ok / ⚠️ caution / ❌ add a rest day. An itinerary passes when no day is ❌ (a standard EBC itinerary passes with cautions).

### 5. Altitude Sickness Symptom Checker: Lake Louise Score
- Standard scoring for acute mountain sickness: headache, nausea, fatigue and dizziness each scored 0–3.
- A total of 3 or more that includes a headache means acute mountain sickness is likely. Severe symptoms → "Descend now".
- Show a disclaimer: "Not medical advice."

## Smart features

| Feature | Algorithm |
|---|---|
| Recommended for you | **Content-based filtering**: turn the user's preferences and each trek into vectors, compare them with **cosine similarity** `cos θ = (A·B)/(‖A‖‖B‖)`, and rank the results |
| Safer alternative | **KNN**: find the K treks most similar to the one chosen, keep only those predicted as a lower risk, and show the closest |
| Best time to visit | **Weighted scoring** of each month from average rainfall, temperature and visibility |
| Search with typos ("Anapurna") | **Levenshtein edit distance** for fuzzy matching |
| Near me | **Haversine** distance + sorting (a bounding box first, to make it fast) |
| Review ranking | **Bayesian average**, so a trek with one 5★ review doesn't beat one with a hundred 4.5★ reviews |
| Packing checklist | **Rule-based expert system** (e.g. altitude above 4,000 m or winter → down jacket) |
| Budget estimate | **Formula-based estimation**: (days × daily cost) + transport + permits |
| Altitude graph | Plot stage altitudes, with **linear interpolation** between points |

### Version 2 Phase 2: how they were built (with worked examples for the report)

**1. Reviews: Bayesian average** ([rating.py](../../backend/app/algorithms/rating.py)).
`score = (C·m + Σ ratings) / (C + n)`, where n = visible reviews of the item, m = mean of all visible
reviews in the app (3.0 before the first review), C = 5. Hidden reviews are not counted. Worked example
with m = 4.0: one 5★ review → (5·4 + 5) / 6 = **4.17**; twenty reviews averaging 4.6★ → (5·4 + 92) / 25 =
**4.48**, so the second ranks higher. (If the app mean were above 4.49 the single 5★ would win: the prior
pulls both items towards m.) Lists get the rating from one grouped query (`GROUP BY place_id`), and
`sort=rating` uses the same formula in SQL.

**2. Recommended for you: content-based filtering + cosine similarity**
([similarity.py](../../backend/app/algorithms/similarity.py),
[recommend.py](../../backend/app/services/recommend.py)).
Every item is a vector `[nature, culture, adventure, religious, season_fit, budget_fit]`.

| Category | nature | culture | adventure | religious |
|---|---|---|---|---|
| temple | 0 | 0.7 | 0 | 1 |
| heritage | 0 | 1 | 0 | 0.3 |
| lake | 1 | 0 | 0.2 | 0 |
| viewpoint | 0.9 | 0 | 0.5 | 0 |
| national_park | 1 | 0 | 0.4 | 0 |
| village (not recommended on its own) | 0.5 | 0.5 | 0.3 | 0 |
| **trek** | 0.8 | 0 | 1 | 0 |

- `season_fit`: places use this month's best-time score (0–1, Version 1); treks are 1 in Mar–May and Sep–Nov, 0.3 otherwise.
- `budget_fit`: the item's cost level is low/medium/high (places: entry fee for the user's nationality ≤ 500 / ≤ 1,500 / more; treks: ≤ 5 / ≤ 9 / 10+ days). It is 1 if that level is at or below the user's budget level, 0.5 one level above, 0 two levels above (a free temple suits every budget). No budget level → 1.
- User vector: 1 per chosen interest, then `season_fit = 1`, `budget_fit = 1`. Score = cos θ; sort; top 10; items the user already reviewed or put in a trip are left out; trek villages are left out (the trek is recommended instead).
- **because**: the top two matching dimensions, shared interests first (`INTEREST_CULTURE`…), then `GOOD_SEASON` (season_fit ≥ 0.6) and `FITS_BUDGET`.
- **Cold start**: no interests → `mode: "popular"`: Bayesian rating, then the number of trips the place was added to.

Worked example (user likes culture + religious; season_fit 0.8 and budget_fit 1 for all three items):
u = [0, 1, 0, 1, 1, 1], ‖u‖ = 2.

| Item | Vector | u·v | ‖v‖ | cos θ |
|---|---|---|---|---|
| Temple | [0, 0.7, 0, 1, 0.8, 1] | 0.7 + 1 + 0.8 + 1 = 3.5 | √3.13 = 1.769 | 3.5 / (2 × 1.769) = **0.989** |
| Heritage | [0, 1, 0, 0.3, 0.8, 1] | 1 + 0.3 + 0.8 + 1 = 3.1 | √2.73 = 1.652 | 3.1 / 3.305 = **0.938** |
| Lake | [1, 0, 0.2, 0, 0.8, 1] | 0.8 + 1 = 1.8 | √2.68 = 1.637 | 1.8 / 3.274 = **0.550** |

So the temple comes first and the lake last (`test_cosine_worked_example_for_the_report`).

**3. Near me: bounding box + Haversine** ([geo_box.py](../../backend/app/algorithms/geo_box.py)).
Box half-size Δlat = r / 111 km, Δlng = r / (111 km · cos lat) → indexed `BETWEEN` filter in SQL →
exact Haversine for each candidate → drop the box corners (distance > r) → sort by distance.

**4. Budget estimate: formula-based** ([budget.py](../../backend/app/services/budget.py)).
Per person, NPR, rates from `budget_rate`:
- **Trip** = days × (food + stay)[level, city] + total_km × transport rate[level, city] + Σ entry fees[nationality]
- **Trek** = days × (food + stay)[level, region] + Σ permits[nationality] + trailhead return trip[level, region]

Worked example (the "Valley" trip, medium budget, foreign, 2 days, *K* km after optimising):
2 × (2,500 + 4,000) + K × 60 + (1,000 + 400 + 200 + 1,000 + 1,800) = 13,000 + 60K + 4,400
(`test_valley_trip_budget_by_hand`). EBC permits: foreign 6,000 > SAARC 1,500 > Nepali 100.

**5. Share a trip: random tokens.** `secrets.token_urlsafe(16)` (128 random bits, impossible to guess);
the token is the only key; a wrong token, a stopped share and a deleted trip all give the same 404.

### Version 2 Phase 1: how they were built (with worked examples for the report)

**1. Altitude graph: linear interpolation**
([altitude_profile.py](../../backend/app/algorithms/altitude_profile.py)).
Each day gives up to three known points: where it starts, the day's highest point (only when it is
higher than both ends, placed in the middle of the day) and where you sleep. Between two known points
the altitude is assumed to change in a straight line:
`alt(x) = a₁ + (a₂ − a₁) · (x − x₁) / (x₂ − x₁)`.
Worked example: between (0 km, 2,000 m) and (10 km, 3,000 m), at 5 km → 2,000 + 1,000 · 5/10 = **2,500 m**.
A rest day adds a point with no extra km. For EBC the highest point is Kala Patthar, 5,644 m on day 9.
The chart in the app puts **days** on the x-axis (not km): day *d*'s high point at *d* − 0.5 and its
sleeping place at *d*, so rest days stay visible as flat steps. Each segment takes the colour of that
day's acclimatisation status, so the chart and the day badges always agree.

**2. Safer alternatives: K-nearest neighbours + the risk model**
([knn.py](../../backend/app/algorithms/knn.py),
[alternatives.py](../../backend/app/services/alternatives.py)).
1. Every published trek becomes a vector `[max sleeping altitude, max daily gain, total days, km per day]`.
2. **Min-max normalisation** per column, `x' = (x − min) / (max − min)`, so metres don't outweigh days
   (a column where every trek is equal becomes 0).
3. **Euclidean distance** `d(a, b) = √Σ(aᵢ − bᵢ)²` from the chosen trek to every other trek; keep the
   **K = 4** nearest.
4. Ask the same risk model about each neighbour for **this** traveller and month; keep only the ones
   rated lower than the chosen trek (never suggest one that is just as risky), and show at most 3.
5. "Why": the feature where the alternative improves most on the chosen trek (lower altitude, smaller
   gain, fewer days, shorter days), with both values.

Real result (demo profile: medium fitness, no multi-day experience, EBC in January → **Risky**):
Annapurna Base Camp (Hard, *lower altitude* 5,644 → 4,130 m) and Annapurna Circuit (Hard, *fewer days*
11 → 8). An expert on Poon Hill in October gets none, because Poon Hill is already the lowest rating.
Nothing is saved to the risk history.

**3. Weather forecast: cache-aside with a time-to-live (Redis)**
([cache.py](../../backend/app/core/cache.py), [weather.py](../../backend/app/services/weather.py)).
1. Look in Redis under `weather:{lat:.2f}:{lng:.2f}`. Rounding to 2 decimals (about 1 km) lets nearby
   places share one entry. Found → **HIT**.
2. Not found → call Open-Meteo (free, no key, 5 s timeout), save the answer for **3,600 s** → **MISS**.
   A second copy, `weather:stale:…`, is kept for 24 h.
3. Open-Meteo fails → return the 24-hour copy marked `stale` → **STALE**; no copy → 503.
4. Redis down → every request is a MISS, but the forecast still works.

The response header `X-Cache` says which case happened. A trek's forecast is for its **highest
sleeping place** (the coldest night), e.g. Gorak Shep (5,164 m) for EBC. Checked live on 2026-11-19:
MISS, then HIT; TTL 3,600 s and 86,400 s.

**4. Packing checklist: rule-based expert system**
([packing.py](../../backend/app/algorithms/packing.py),
[services/packing.py](../../backend/app/services/packing.py)).
- **Knowledge base:** one rule per item in `packing_item` (34 rules, `data/packing_items.csv`). A rule
  is either `always`, or has up to three conditions: `min_altitude_m` (the trek's highest point is at
  least this), `months` (the chosen month is one of these) and `min_days`.
- **Facts:** the trek's highest point and number of days (computed from the stages) and the month.
- **Inference (forward chaining over a flat rule table):** an item is on the list when it is `always`,
  or when **all** of its set conditions are true. A rule with no condition never fires (a database
  `CHECK` stops such rows).
- **Explanation:** each item says which rule fired: `ALWAYS`, `ALTITUDE` (4,000 m), `WINTER`
  (Dec–Feb, above 3,500 m), `MONSOON` (Jun–Sep), `LONG_TREK` (10+ days) or `PERMIT`.
- **Permits:** the trek's own permits are added as documents, so the list and the permit section match.

| Rule (from the table) | EBC, January (5,644 m, 11 days) | Poon Hill, October (3,210 m, 4 days) |
|---|---|---|
| Down jacket: altitude ≥ 4,000 m | 5,644 ≥ 4,000 → **yes** | 3,210 < 4,000 → no |
| Microspikes: altitude ≥ 3,500 m **and** month ∈ {12, 1, 2} | yes and yes → **yes** | no and no → no |
| Trekking poles: altitude ≥ 3,000 m | **yes** | 3,210 ≥ 3,000 → **yes** |
| Power bank: days ≥ 10 | 11 ≥ 10 → **yes** | 4 < 10 → no |
| Leech socks: month ∈ {6, 7, 8, 9} | no | no (yes in July) |
| Permits | KPLRM, SNP | ACAP, TIMS |
| **Items on the list** | **32** | **20** |

(`test_ebc_in_january_has_cold_weather_gear`, `test_poon_hill_in_october_is_a_much_shorter_list`.)
In the app the ticks are kept on the phone (AsyncStorage key `packing:{trekId}:{month}`), so a list
works without an account. The advice is general: the screen says to check with an agency, and Diamox
says "ask a doctor".

## Supporting algorithms

| Feature | Algorithm |
|---|---|
| Passwords | **bcrypt** hashing with a salt |
| Login session | **JWT** with an HMAC-SHA256 signature |
| Offline sync | **Timestamp-based delta sync**, where the newest change wins |
| Daily check-in | **Scheduled job (cron)**: no check-in by the deadline → alert the family |
| Map route display | **Dijkstra / A\*** (from a routing service, or your own implementation on a small graph) |

---

# Part 2: Main Functions (Backend API)

| Module | Main functions |
|---|---|
| Auth | `register()`, `login()`, `googleLogin()`, `refreshToken()`, `resetPassword()` |
| Profile | `getProfile()`, `updateProfile()`, `updatePreferences()` |
| Explore | `listPlaces(filters)`, `getPlaceDetail(id)`, `search(query)`, `nearMe(lat, lng, radius)` |
| Trek | `getItinerary(trekId)`, `getAltitudeProfile(trekId)`, `getPermits(trekId)`, `getTeahouses(trekId)` |
| AI | `predictRisk(userId, trekId, month)`, `explainRisk(...)`, `checkAcclimatisation(trekId)`, `getSaferAlternatives(trekId)` |
| Planner | `createTrip()`, `addPlace()`, `optimiseRoute(tripId)`, `splitIntoDays()`, `estimateBudget()`, `shareTrip()` |
| Recommend | `getRecommendations(userId)`, `bestTimeToVisit(placeId)`, `getPackingList(trekId, month)` |
| Safety | `sendSOS(location)`, `scoreSymptoms(answers)`, `checkIn(tripId)`, `missedCheckInJob()` |
| Weather | `getForecast(lat, lng)`, with results cached |
| Reviews | `addReview()`, `getReviews()`, `computeRating()` |
| Offline | `downloadTrekPack(trekId)`, `syncChanges(lastSyncTime)` |
| Admin | CRUD for places/treks/stages, `manageUsers()`, `dashboardStats()`, `uploadDataset()`, `retrainModel()` |

---

# Part 3: Protocols

| Protocol | Used for |
|---|---|
| **HTTPS (HTTP over TLS)** | All app ↔ server communication, encrypted |
| **REST + JSON** | API design style and data format |
| **JWT (Bearer token)** | Authenticating every API request after login |
| **OAuth 2.0 / OpenID Connect** | "Sign in with Google" |
| **SMTP** | Email verification and password reset emails |
| **SMS (GSM)** | SOS messages; works without internet using the phone's own SMS, or through a Nepali SMS gateway API online |
| **GPS / GNSS** | User location for Near Me, SOS and tracking |
| **WebSocket** | Live location sharing and real-time check-in status |
| **FCM (Firebase Cloud Messaging)** | Push notifications: check-in reminders, weather alerts |
| **XYZ tile protocol (OpenStreetMap)** | Loading map tiles |
| **Multipart/form-data** | Uploading photos and the ML dataset |
| **SQLite + sync over HTTPS** | Offline storage and syncing changes back to the server |

---

# Architecture Overview

```
 Mobile App (React Native)             Admin Panel (React)
   │  SQLite (offline)                        │
   │                                          │
   └──────── HTTPS / REST + JWT ──────────────┘
                     │
             Backend API Server ── WebSocket (live location)
                     │
   ┌──────────┬──────┴──────┬────────────┬──────────────┐
 Database   ML Service    Weather API   FCM Push    SMS Gateway / SMTP
(PostgreSQL) (Decision
              Tree / RF)
```

---

## Viva focus
Learn these three really well:
1. **Decision tree (CART, Gini)** and **random forest**, both coded yourself, compared with scikit-learn
2. **TSP nearest-neighbour + 2-opt** with Haversine distance
3. **Lake Louise Score** for altitude sickness

The rest are supporting algorithms; a short explanation of each is enough.
