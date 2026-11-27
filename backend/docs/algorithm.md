# Bato (Smart Nepal Tourist & Trek Guide) — Algorithms, Functions & Protocols

Drafted 2026-11-05. See [feature.md](../../docs/design/feature.md) for the feature list (all features kept).

---

# Part 1: Algorithms

## Core algorithms (the ones the viva will focus on)

### 1. Trek Difficulty & Risk Prediction: Decision Tree (CART) → Random Forest
- **Inputs:** max altitude, biggest one-day altitude gain, total days, distance per day, month/season, user age, fitness level, trekking experience, health conditions (a Yes to any of: heart condition, asthma, high blood pressure, significant anemia, recent injury → one `has_health_issue` input)
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
*Built in V2 Phase 3 (`V2-P3-03`): `backend/app/algorithms/lake_louise.py` and the same function in
`mobile/src/lib/lakeLouise.ts`, so the check works with no internet.*
Source: Roach RC et al., *"The 2018 Lake Louise Acute Mountain Sickness Score"*, High Altitude Medicine
& Biology 19(1), 2018.

**Input.** Four symptoms, each scored 0–3 with the official wording (0 none, 1 mild, 2 moderate,
3 severe): headache, gastrointestinal (nausea / vomiting), fatigue / weakness, dizziness /
light-headedness. Plus three **red flags**, ticked separately: confusion or unsteady walking (signs of
HACE), breathless at rest or a wet cough (signs of HAPE), and symptoms getting worse after a rest day.

**Step 1: score.** Total = headache + gi + fatigue + dizziness (0–12).

**Step 2: severity (the 2018 definition).** AMS is likely when the **headache is at least 1 and the
total is at least 3**. Then: 3–5 **mild**, 6–9 **moderate**, 10–12 **severe**. Otherwise the severity
is `none`.

**Step 3: advice** (`symptom_result` enum), checked in this order:

| Result | When | Reason codes |
|---|---|---|
| `descend` | any red flag | `RED_FLAG_CONFUSION`, `RED_FLAG_BREATHLESS`, `RED_FLAG_WORSE_AFTER_REST` |
| `descend` | moderate or severe AMS (total ≥ 6 with a headache) | `AMS_MODERATE`, `AMS_SEVERE` |
| `rest` | mild AMS (3–5 with a headache) | `AMS_MILD` |
| `rest` | total ≥ 3 but **no headache** | `NO_HEADACHE` |
| `ok` | total < 3 | `LOW_SCORE` |

The reasons list starts with the red flags (once each, in a fixed order) and then one score reason,
so the app can explain the result ("Confusion is a sign of HACE…", "Mild altitude sickness…").

**Our change to the published rule.** A total of 3 or more without a headache is not AMS by the 2018
definition, so a direct reading would say `ok`. Bato says `rest` instead (severity stays `none`):
vomiting, weakness and dizziness at 4,400 m are still a reason not to climb higher, and the app must
never tell someone with clear symptoms that they are fine to go up. This is in the Decisions tab.

**Worked examples** (all in the shared test table):

| Headache | GI | Fatigue | Dizziness | Red flag | Total | Severity | Result |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 0 | 0 | – | 2 | none | `ok` |
| 2 | 1 | 1 | 0 | – | 4 | mild | `rest` |
| 2 | 2 | 1 | 1 | – | 6 | moderate | `descend` |
| 3 | 2 | 3 | 2 | – | 10 | severe | `descend` |
| 0 | 2 | 2 | 2 | – | 6 | none | `rest` (no headache) |
| 0 | 0 | 0 | 0 | confusion | 0 | none | `descend` |

**Same answer on the phone and the server.** The phone scores the answers so the advice shows offline.
When the check reaches the server (maybe hours later, from the offline queue), the server scores the
raw answers again and saves its own result. Both copies are tested against one table of 17 cases,
`backend/tests/data/lake_louise_cases.json`: pytest reads it for the Python copy, and
`scripts/check-lake-louise.mjs` (run by `verify.sh`) reads it for the TypeScript copy. The cases cover
the boundaries 2/3, 5/6 and 9/10, the no-headache rule and every red flag.

**Disclaimer** on every safety screen, in both languages: *"Bato is not a rescue service and not
medical advice. In an emergency, call the numbers below."*

**SOS (V2-P3-02) is not an algorithm but has one rule worth explaining:** the phone gets its position
from GPS (high accuracy, 10 s at most, else the last known position with its time), writes the SMS
and opens the SMS app; the user presses Send. The record for the server goes into an **offline queue**
with an id made on the phone; the queue is sent in order when there is internet, each item is removed
only after the server accepts it, and the server saves each id once. So nothing is lost when the
connection drops, and nothing is saved twice.

## Smart features

| Feature | Algorithm |
|---|---|
| Recommended for you | **Content-based filtering**: turn the user's preferences and each trek into vectors, compare them with **cosine similarity** `cos θ = (A·B)/(‖A‖‖B‖)`, and rank the results. V2-SR adds learning from feedback, the risk model, a nearby bonus and **MMR** for variety ([below](#v2-sr-better-search-and-recommendations)) |
| Safer alternative | **KNN**: find the K treks most similar to the one chosen, keep only those predicted as a lower risk, and show the closest |
| Best time to visit | **Weighted scoring** of each month from average rainfall, temperature and visibility |
| Search with typos ("Anapurna") | **Levenshtein edit distance** for fuzzy matching; V2-SR adds **Devanagari → Latin transliteration**, word-by-word matching and search by village, district, city or trek region, and category ([below](#v2-sr-better-search-and-recommendations)) |
| Near me | **Haversine** distance + sorting (a bounding box first, to make it fast) |
| Review ranking | **Bayesian average**, so a trek with one 5★ review doesn't beat one with a hundred 4.5★ reviews |
| Packing checklist | **Rule-based expert system** (e.g. altitude above 4,000 m or winter → down jacket) |
| Budget estimate | **Formula-based estimation**: (days × daily cost) + transport + permits |
| Altitude graph | Plot stage altitudes, with **linear interpolation** between points |

### Version 2 Phase 2: how they were built (with worked examples for the report)

**1. Reviews: Bayesian average** ([rating.py](../app/algorithms/rating.py)).
`score = (C·m + Σ ratings) / (C + n)`, where n = visible reviews of the item, m = mean of all visible
reviews in the app (3.0 before the first review), C = 5. Hidden reviews are not counted. Worked example
with m = 4.0: one 5★ review → (5·4 + 5) / 6 = **4.17**; twenty reviews averaging 4.6★ → (5·4 + 92) / 25 =
**4.48**, so the second ranks higher. (If the app mean were above 4.49 the single 5★ would win: the prior
pulls both items towards m.) Lists get the rating from one grouped query (`GROUP BY place_id`), and
`sort=rating` uses the same formula in SQL.

**2. Recommended for you: content-based filtering + cosine similarity**
([similarity.py](../app/algorithms/similarity.py),
[recommend.py](../app/services/recommend.py)).
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

**3. Near me: bounding box + Haversine** ([geo_box.py](../app/algorithms/geo_box.py)).
Box half-size Δlat = r / 111 km, Δlng = r / (111 km · cos lat) → indexed `BETWEEN` filter in SQL →
exact Haversine for each candidate → drop the box corners (distance > r) → sort by distance.

**4. Budget estimate: formula-based** ([budget.py](../app/services/budget.py)).
Per person, NPR, rates from `budget_rate`:
- **Trip** = days × (food + stay)[level, city] + total_km × transport rate[level, city] + Σ entry fees[nationality]
- **Trek** = days × (food + stay)[level, region] + Σ permits[nationality] + trailhead return trip[level, region]

Worked example (the "Valley" trip, medium budget, foreign, 2 days, *K* km after optimising):
2 × (2,500 + 4,000) + K × 60 + (1,000 + 400 + 200 + 1,000 + 1,800) = 13,000 + 60K + 4,400
(`test_valley_trip_budget_by_hand`). EBC permits: foreign 6,000 > SAARC 1,500 > Nepali 100.

**5. Share a trip: random tokens.** `secrets.token_urlsafe(16)` (128 random bits, impossible to guess);
the token is the only key; a wrong token, a stopped share and a deleted trip all give the same 404.

### V2-SR: better search and recommendations

Plan and status: [search-recommendation.md](../../docs/product/search-recommendation.md). Measured with our own
test sets: [search_quality.md](benchmarks/search_quality.md), [recommend_quality.md](benchmarks/recommend_quality.md).

**1. Devanagari → Latin transliteration** ([transliterate.py](../app/algorithms/transliterate.py)).
Each word is split into syllables: a consonant carries the inherent "a" (क = ka), a vowel sign replaces
it (कि = ki), the virama ् removes it (क्त = kt). Then **schwa deletion** drops the "a" Nepali does not
say: at the end of a word (नगरकोट → nagarkot) unless it follows a consonant cluster (क्षेत्र → kshetra),
and inside a word in the pattern vowel + C(a) + C + vowel, scanning right to left (दरबार → darbar,
सगरमाथा → sagarmatha). Every place and trek name also gets a saved `name_latin`, and a Devanagari query
is searched in both scripts.

**2. Word-by-word similarity** ([levenshtein.py](../app/algorithms/levenshtein.py)).
Plain Levenshtein punishes extra words: "chitwan nikunja" vs "chitwan rashtriya nikunja" scores 0.6.
Word similarity matches each query word with its best word in the name and averages, weighted by word
length (here 1.0). Score = max(plain, 0.95 × word similarity) → 0.95.

**3. Search over more than names** ([search.py](../app/services/search.py)).
Candidates also come from districts (score × 0.9), cities and trek regions (× 0.88, below), categories
(× 0.85), villages on a trek (× 0.95, shown as "Passes through …") and trek initials ("ebc"). Rules from
the test set: anything below 0.7 is dropped, and a query shorter than 5 letters needs 0.85 ("lake" must
not find "Larke"). Result on 51 queries: hit@1 60% → **83%**, hit@3 60% → **100%**, MRR 0.604 →
**0.906** ("before" = the old code run on the same 51 queries).

*Cities and trek regions (V2-SR-14).* A district is not what a traveller types: Pokhara is a city in
Kaski district, Patan is in Lalitpur, not Kathmandu. So the `area` table ([data/areas.csv](../../data/areas.csv))
lists 6 areas, each with an English name, a Nepali name and other names (Pokhara, Lakeside, पोखरा …),
and each place may belong to one area. The query is compared with every area name by the same
Levenshtein score (there are few areas, so this is done in Python); a match × 0.88 is given to every
place in that area. A trek region ("Khumbu", "Langtang") uses the trek's `region` as its code, so the
same match also finds the treks there. 0.88 is just below the district weight, so "kathmandu" lists
the Kathmandu district places first, then Patan and Bhaktapur. The app shows the area under each hit
("Viewpoints · Pokhara").

**4. Recommendations, step by step** ([recommend.py](../app/services/recommend.py)).

1. *Vectors with tags.* Item = 4 interests + 12 tags × 0.5 + season_fit + budget_fit (18 numbers).
   The user gets the tags their interests suggest, e.g. religious → pilgrimage 1, unesco 0.3.
2. *Learning from feedback.* Signal s: review 5★ +1, 4★ +0.5, 3★ 0, 2★ −0.5, 1★ −1; trip stop +0.5;
   "Not interested" −1. learned = average of s × item vector; user = max(0, interests + learned).
3. *Risk-aware.* For treks, our risk model predicts the level for this user and month. Score × 1.0
   (easy, moderate), × 0.7 (hard), × 0.4 (risky).
4. *Nearby.* + 0.15 × e^(−d / 40), d = km from the phone (only if location is already allowed) or from the
   middle of the latest trip. 0 km → +0.15, 40 km → +0.055, 200 km → +0.001.
5. *Only matching items.* An item must share an interest or tag with the user; empty places are filled
   with popular items marked "Something different to explore".
6. *MMR for variety.* Pick one item at a time:
   `next = argmax λ·score − (1 − λ)·max sim(item, picked)`, sim = ½ cosine + ½ (same kind of item).

Worked example of MMR (λ = 0.75, culture + religious user): after Pashupatinath (0.989) is picked,
Janaki Temple (score 0.972, sim to Pashupatinath 0.974) gets 0.75 × 0.972 − 0.25 × 0.974 = **0.486**,
while Bhaktapur Durbar Square (heritage, score 0.888, sim 0.384) gets 0.75 × 0.888 − 0.25 × 0.384 =
**0.570**, so the heritage site comes second (October, dev data). Choosing λ (6 typical users, top 10):

| λ | Relevance | Variety | Kinds of item |
|---|---|---|---|
| 1 (no MMR) | 0.877 | 0.297 | 2.2 |
| **0.75 (used)** | 0.862 (−1.7%) | 0.406 (+37%) | 3.3 |
| 0.6 | 0.819 (−6.5%) | 0.537 (+81%) | 4.5 |

### Version 2 Phase 1: how they were built (with worked examples for the report)

**1. Altitude graph: linear interpolation**
([altitude_profile.py](../app/algorithms/altitude_profile.py)).
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
([knn.py](../app/algorithms/knn.py),
[alternatives.py](../app/services/alternatives.py)).
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
([cache.py](../app/core/cache.py), [weather.py](../app/services/weather.py)).
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
([packing.py](../app/algorithms/packing.py),
[services/packing.py](../app/services/packing.py)).
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
| Trek lines on the map (V2-MAP-01) | **Polyline through the stage villages** in day order (first stage's start, then each stage's end; a rest day adds no point), coloured by the **random forest's level for this user and month** ([map_routes.py](../app/services/map_routes.py)) |
| Marker clustering (V2-MAP-07) | MapLibre's built-in **grid-based point clustering** (supercluster); not our code |
| Hillshade (V2-MAP-04) | MapLibre shades a **digital elevation model** (AWS Terrain Tiles, Terrarium encoding); not our code |

## Planned, not built

*Checked against the code on 2026-11-25.* These algorithms have been part of the design from the
start, but the code does not have them yet. Put them under "Future scope" in the report, and do not
describe them as working in the viva.

| Algorithm | What it is for | Where it is planned | What the app does today |
|---|---|---|---|
| **Scheduled job** (cron-style, APScheduler) | Daily check-in: every 10 minutes, find check-ins that are past their deadline and still `pending`, mark them `missed` and email the emergency contacts once | [V2 Phase 3](../../docs/plans/version2/phase3.md) §4, `V2-P3-04` and `V2-P3-05` (Stretch, not started) | There is no check-in. The traveller can send an SOS by SMS themselves |
| **Timestamp-based delta sync** (the server's change wins) | Offline treks: the phone keeps a downloaded trek in SQLite and asks only for rows with `updated_at > last_sync`, including deleted ones | [V2 Phase 3](../../docs/plans/version2/phase3.md) §5, `V2-P3-06` (Stretch, not started) | The trek screens need the internet. Only the SOS and symptom-check **outbox** works offline: it sends queued items in order, which makes it a queue, not a sync |
| **Dijkstra / A\*** (shortest path on a road graph) | Drawing the real road route between trip stops on the map | No plan task | The map joins the stops with straight dashed lines ([TripMap.tsx](../../mobile/src/components/TripMap.tsx)). Travel time uses the Haversine distance × 1.4 road factor |
| **WebSocket** live location | Sharing the traveller's position with family in real time ("SOS with live location tracking" in [feature.md](../../docs/design/feature.md)) | No plan task | The SOS SMS carries one GPS fix, with its time and a map link |

Other parts of this file belong to the same planned features:
- **Part 2:** `checkIn()`, `missedCheckInJob()`, `downloadTrekPack()` and `syncChanges()`.
- **Part 3 and the architecture overview:** **WebSocket**, **SMTP** (check-in emails), **FCM** (the V2 plan
  chose local notifications instead) and **SQLite + sync** (offline treks).

None of these is in the code yet.

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
