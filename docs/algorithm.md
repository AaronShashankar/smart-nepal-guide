# Bato — Algorithms in the Code

Checked against the code and `algorithm.md`. Bato has about **35 algorithms** implemented in code. The table at the end lists a few that `algorithm.md` mentions but that were never built.

---

## 1. Core algorithms (the ones the viva focuses on)

| # | Algorithm | Use case in Bato | Code |
|---|-----------|------------------|------|
| 1 | CART decision tree (splits chosen by Gini impurity, 1 − Σpᵢ²) | Predicts a trek's level (Easy / Moderate / Hard / Risky) from altitude, daily gain, days, km per day, month, age, fitness, experience and health | `tree.py` |
| 2 | Random forest (each tree trained on a bootstrap sample, √n features tried at each split, majority vote) | The final risk model. It's more stable than a single tree. Written from scratch; scikit-learn is used only to compare accuracy | `forest.py` |
| 3 | Decision path tracing | "Why this rating?" turns the splits on the winning trees' paths into sentences | `reasons.py` |
| 4 | Haversine formula | Real distance between two GPS points. Used by the trip planner, Near me and the "nearby" bonus in recommendations | `haversine.py` |
| 5 | Nearest-neighbour heuristic (TSP) | First visiting order for the places in a trip: always go to the closest place not yet visited | `route.py` |
| 6 | 2-opt | Shortens that route by reversing segments (Valley demo: 38.8 → 31.3 km) | `route.py` |
| 7 | Brute force (exact TSP, 8 places or fewer) | Benchmark only: shows 2-opt is about 1% from the best route | `route.py`, `route_benchmark.py` |
| 8 | Greedy day split | Splits the ordered trip into days of at most 8 hours (travel time + visit time) | `route.py` |
| 9 | Rule-based acclimatisation check | Above 3,000 m: a day that climbs more than 500 m → caution; more than 1,000 m since the last rest day → danger, suggest a rest day | `acclimatisation.py` |
| 10 | Lake Louise Score (2018) | Altitude sickness symptom checker → ok / rest / descend. Runs on both the phone and the server, so it works offline | `lake_louise.py`, `lakeLouise.ts` |

## 2. Search and recommendations

| # | Algorithm | Use case | Code |
|---|-----------|----------|------|
| 11 | Levenshtein edit distance (dynamic programming) | Search that tolerates typos ("Anapurna" → Annapurna) | `levenshtein.py` |
| 12 | Word-by-word similarity (length-weighted best match per word) | Multi-word names: "chitwan nikunja" still matches "chitwan rashtriya nikunja" | `levenshtein.py` |
| 13 | Devanagari → Latin transliteration with schwa deletion | Nepali-script queries (सगरमाथा → sagarmatha); the result is also saved as `name_latin` | `transliterate.py` |
| 14 | Content-based filtering + cosine similarity | "Recommended for you": user vector vs item vectors (interests, tags, season fit, budget fit) | `similarity.py`, `recommend.py` |
| 15 | Learning from feedback (weighted average of signals) | Reviews, trip stops and "Not interested" taps adjust the user's vector | `recommend.py` |
| 16 | Exponential distance decay (0.15·e^(−d/40)) | Bonus for items near the user or their latest trip | `recommend.py` |
| 17 | MMR (maximal marginal relevance), λ = 0.75 | Adds variety so the top 10 aren't all temples | `recommend.py` |
| 18 | KNN (min-max normalisation + Euclidean distance, K = 4) | "Safer alternative": similar treks that the risk model rates lower for this user | `knn.py`, `alternatives.py` |
| 19 | Bounding box + Haversine | "Near me": a fast indexed SQL box filter first, then exact distances | `geo_box.py` |
| 20 | Bayesian average ((C·m + Σr)/(C + n), C = 5) | Review ranking, so a single 5★ review doesn't beat many 4.5★ reviews | `rating.py` |

## 3. Trek and trip features

| # | Algorithm | Use case | Code |
|---|-----------|----------|------|
| 21 | Weighted scoring (0.5 rain + 0.3 temperature + 0.2 visibility) | Best months to visit a place | `best_time.py` |
| 22 | Rule-based expert system (forward chaining over 34 rules) | Packing checklist, e.g. altitude ≥ 4,000 m → down jacket; winter → microspikes | `packing.py` |
| 23 | Linear interpolation | Altitude graph between the known points of each day | `altitude_profile.py` |
| 24 | Formula-based estimation | Budget = days × (food + stay) + transport + entry fees or permits | `budget.py` |

## 4. ML training and evaluation

| # | Algorithm | Use case | Code |
|---|-----------|----------|------|
| 25 | Rule-based labelling (risk points) | Generates training labels until the survey answers arrive | `dataset.py` |
| 26 | Stratified train/test split | Keeps each risk class's share the same in train and test | `metrics.py` |
| 27 | Stratified 5-fold cross-validation | Picks the tree's `max_depth` (3–8) | `train.py` |
| 28 | Accuracy, precision, recall, macro F1, confusion matrix | Model evaluation for the report | `metrics.py`, `evaluate.py` |
| 29 | Gini feature importance (averaged over the forest) | Shows which inputs drive the risk rating (a report figure) | `tree.py`, `forest.py` |

## 5. Security, caching and sync

| # | Algorithm | Use case | Code |
|---|-----------|----------|------|
| 30 | bcrypt (salted hash) | Storing passwords | `security.py` |
| 31 | JWT signed with HMAC-SHA256 | Login sessions and API authentication | `security.py` |
| 32 | Cryptographically random token (128-bit `token_urlsafe`) | Share-a-trip links that can't be guessed | `sharing.py` |
| 33 | Cache-aside with TTL + stale fallback (Redis) | Weather forecast: cached for 1 h, with a 24 h backup copy if Open-Meteo is down | `cache.py`, `weather.py` |
| 34 | FIFO offline outbox with idempotent UUIDs | SOS and symptom checks made offline are sent in order later, and never saved twice | `safety.ts` |
| 35 | Debounce (300 ms) | Search box waits until the user stops typing before calling the API | `useDebounced.ts` |

---

## Listed in `algorithm.md` but not built

None of these exist in the code, so don't claim them in the report or the viva unless you build them:

- **Dijkstra / A\*** for map routes
- **Timestamp-based delta sync** for offline data
- **Cron job for missed daily check-ins** (the check-in is still a Stretch task)
- **WebSocket live location** (a protocol, not an algorithm, and also not built)

---

## Viva focus

`algorithm.md` says to learn three really well:

1. **Decision tree + random forest**
2. **Nearest-neighbour + 2-opt with Haversine**
3. **Lake Louise Score**

A short explanation is enough for the rest.