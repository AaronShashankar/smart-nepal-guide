# Bato: feature ratings

*Review of the code on `main`, 2026-11-23. Tracker task V2-DOC-02.*

This report scores each feature of Bato out of 10 for **how well it is implemented**. For each
feature it lists what works, what keeps the score down, and what would raise it. The scores
come from reading the code, the data and the test results. The app was not re-run for this
review; the phone results are the ones recorded in the tracker and in [PROGRESS.md](../PROGRESS.md).

## How the scores were given

Each score weighs four things:

1. **Code quality:** correct, clear, safe, and fast enough.
2. **Completeness:** does it do what the plan says, end to end (backend, app, admin)?
3. **Proof:** automated tests, manual test cases, and checks on a real phone.
4. **Real-world use:** would it help a real traveller today? This depends on the data behind it.

| Score | Meaning |
|---|---|
| 9–10 | Excellent. Little left to do, and it would hold up in a real product |
| 7–8 | Good. Works well, with a few clear gaps |
| 5–6 | Works, but has important gaps |
| 3–4 | Built, but too thin to be useful yet (usually because of missing data) |
| 0–2 | Not built |

---

## Summary

**Overall: 7.7 / 10** (the average of the 24 built features below; 7.6 before the search and recommendation work of 2026-11-23).
The code quality is high almost everywhere. The scores are pulled down mainly by
**data** (teahouses, Nepali content, real training data), **hosting** (the app only works
on the laptop's network), and **features that were planned but not built yet**
(safety and offline).

| # | Feature | Score | In one line |
|---|---|---|---|
| 1 | Search | **9.5** | Trigram + our own Levenshtein, transliteration, word-by-word, villages → treks, districts, categories, initials; measured: hit@1 92%, MRR 0.958 |
| 2 | Weather forecast | **9** | Cache-aside with a stale copy kept as a backup; keeps working when Redis or Open-Meteo is down |
| 3 | "Why this rating?" reasons | **9** | Every reason shown is true for this user and comes from the model's own decision paths |
| 4 | Itinerary + acclimatisation checker | **8.5** | Rules from WMS / CDC guidance, rest-day suggestions, well tested |
| 5 | Altitude profile chart | **8.5** | Clear chart, fast climbs coloured, checked in both languages |
| 6 | Reviews and ratings | **8.5** | Bayesian average, one review per user, moderation survives edits |
| 7 | Share a trip | **8.5** | Secure token, works without login, a web page for people without the app |
| 8 | Testing and quality checks | **8.5** | 243 backend tests, 66 manual cases, search test set, bug log; no automated tests for the app or admin |
| 9 | Recommendations | **8.5** | Cosine with tags; learns from reviews, trips and Not interested; risk-aware; nearby bonus; MMR variety (measured); weights still hand-set, no real users yet |
| 10 | AI risk predictor | **8** | Excellent from-scratch forest; but 95% of the training data comes from our own rule |
| 11 | Explore, place and trek pages | **8** | Rich pages, 63 of 69 places have photos; treks have none |
| 12 | Traveller profile | **8** | Simple, optional health questions, prompts when needed |
| 13 | Packing checklist | **8** | Rule-based expert system with reasons; ticks are remembered |
| 14 | Near me | **8** | Bounding box + Haversine, permission flows done, passes on a real phone |
| 15 | UI design | **8** | Redesign checked on a real phone; a few canvas parts left out |
| 16 | Trip planner | **7.5** | Strong algorithms, but the app doesn't use them fully |
| 17 | Admin panel | **7.5** | Full CRUD for all content; packing items and trek photos missing |
| 18 | Accounts and login | **7** | Safe basics; no password reset, account deletion or rate limiting |
| 19 | Bilingual (English / नेपाली) | **7** | Every screen translated; most place and trek *content* is English only |
| 20 | Safer alternatives (KNN) | **7** | Correct and honest; only 8 treks to choose from |
| 21 | Budget estimate | **7** | Sourced rates and nationality fees; no guide fees, which most foreign treks now need |
| 22 | Map | **6.5** | Works, but basic: no route lines, no "you are here", online only |
| 23 | Teahouses | **4** | Built end to end, but only 4 lodges in one village |
| 24 | Hosting and release | **4** | Runs from the laptop; the APK needs the laptop's IP |
| — | Safety and offline (V2 Phase 3) | **0** | Not started: SOS, emergency contacts, symptom checker, offline treks |

---

## 1. Users

### Accounts and login: 7 / 10

**What works well**
- Passwords are hashed with bcrypt, and the 72-byte bcrypt limit is enforced in
  [schemas/auth.py](../backend/app/schemas/auth.py).
- Login gives the same message for "no such email" and "wrong password", so it does not reveal
  which emails exist ([api/auth.py](../backend/app/api/auth.py)).
- Google sign-in checks the token's signature and audience, and accepts only a verified email
  ([services/google.py](../backend/app/services/google.py)).
- Blocking a user works at once, even for tokens issued before the block
  ([api/deps.py](../backend/app/api/deps.py)).
- On the phone, many requests that fail with 401 at the same time share **one** refresh call
  ([lib/api.ts](../mobile/src/lib/api.ts)).
- *Update 2026-11-23:* the login and register forms now have placeholders and a show/hide
  password button, and they stay above the keyboard on Android (BUG-17, TC-59 to TC-61). These
  make the forms easier to use, but don't change the score: the gaps below are still open.

**What holds it back**
- No "Forgot password". A user who forgets it is locked out for good.
- No "Delete my account". Google Play requires this for apps with accounts.
- No rate limiting on `/auth/login`, so passwords can be guessed without limit.
- Logout only deletes the tokens on the phone. A stolen refresh token keeps working for 30 days.
- If `JWT_SECRET` is not set, the server quietly uses `change-me-in-.env`
  ([core/config.py](../backend/app/core/config.py)).

**To raise the score:** password reset by email, account deletion, a login rate limit, and
refuse to start outside development when the secret is the default.

### Traveller profile: 8 / 10

**What works well:** age, fitness, experience, interests, nationality and budget level feed the
risk model, recommendations and budget. The health questions are optional. The risk screen
names the missing fields and sends the user to the profile
([services/risk.py](../backend/app/services/risk.py)).

**What holds it back:** only two health questions (heart condition, asthma). Past altitude
sickness is the strongest known predictor of getting it again, and it is not asked.

**To raise the score:** add "Have you had altitude sickness before?" to the profile and as a
model feature (this needs new training data).

---

## 2. Discover

### Search: 9.5 / 10

**What works well**
- Two steps: PostgreSQL `pg_trgm` finds candidates quickly using the index, then our own
  Levenshtein ranks them ([services/search.py](../backend/app/services/search.py),
  [algorithms/levenshtein.py](../backend/app/algorithms/levenshtein.py)).
- It compares the query with every run of words in a name, so "anapurna" scores well against
  "Annapurna Base Camp".
- It searches 71 aliases, handles Devanagari, and escapes `%` and `_` in the query.
- Trek filters for region, duration and difficulty in the app.

- *Update 2026-11-23 (V2-SR-08 … 10, score 9 → 9.5):* our own Devanagari → Latin transliteration
  (every name gets a saved `name_latin`), word-by-word matching, villages find the treks through
  them, districts and categories list their places, trek initials ("ebc"). A 43-query test set
  runs in pytest: right answer first 72% → 92%, MRR 0.725 → 0.958
  ([search_quality.md](search_quality.md)).

**What holds it back:** the test set is written by us, not taken from real searches; text and
filters can't be combined in one request; a fuzzy alias can still sneak in ("bhaktapur" also
lists Kathmandu Durbar Square through its alias "Basantapur").

**To raise the score:** log real searches and add the zero-result ones to the test set
(V3-SR-01); combine text and filters (V2-SR-12).

### Explore, place and trek pages: 8 / 10

**What works well:** category chips, place and trek lists, photo carousel, entry fees by
nationality, how to get there, and the 5 nearest places. The "best months" score adjusts
Kathmandu's climate for each place's altitude (lapse rate) and district rain
([algorithms/best_time.py](../backend/app/algorithms/best_time.py), `seed.py`).
63 of 69 places now have a credited photo.

**What holds it back**
- Treks have **no photos** in the data. The app draws a mountain picture instead.
- 6 trek villages still have no photo.
- Visibility uses the same baseline for every place, so "best months" mostly reflects rain and
  temperature.
- "Nearby" loads every place and measures each one in Python. That is fine for 69 places, but
  it should use the bounding-box query that Near me already uses once there are thousands.

**To raise the score:** add trek photos (one table and one admin upload), and reuse the
bounding box for nearby places.

### Map: 6.5 / 10

**What works well:** MapLibre with OpenStreetMap tiles, markers coloured by category, category
filter, and tapping a marker opens the place ([app/(tabs)/map.tsx](../mobile/src/app/(tabs)/map.tsx)).

**What holds it back**
- No "you are here" dot, even though the app already asks for location for Near me.
- Trek routes are not drawn on the main map. For a trek app, this is the first thing people
  look for.
- No marker clustering: it loads up to 500 places at once.
- Tiles need the internet. On a trek there often is none.

**To raise the score:** show the user's location, draw each trek's stages as a line, and
cluster markers. Offline tiles belong to V2 Phase 3 and V3.

### Near me: 8 / 10

**What works well:** a bounding box in SQL first (uses the index), then the exact Haversine
distance, closest place first ([api/places.py](../backend/app/api/places.py)). All permission
cases are handled (ask, denied, open settings). It passes on a real phone (TC-47).

**What holds it back:** the radius is fixed at 20 km in the app
([lib/queries.ts](../mobile/src/lib/queries.ts)). In remote areas it often finds nothing.
Treks are not included.

**To raise the score:** widen the radius automatically when nothing is found, and include
trek start points.

### Recommendations: 8.5 / 10

*Corrected 2026-11-23: the first version of this report said places already reviewed or planned
were still recommended. They are not (`_already_used()`), so the score went from 6.5 to 7.*

**What works well:** cosine similarity over a 6-value vector (4 interests, season, budget),
"Popular now" for new users, trek villages are not recommended on their own, places and treks the
user already reviewed or put in a trip are left out, ties are broken by the Bayesian rating, and
each recommendation says why ("Because you like culture")
([services/recommend.py](../backend/app/services/recommend.py)).

**What holds it back**
- The weights are typed in by hand (`INTEREST_WEIGHTS`). With 6 categories, this is close to
  filtering by category.
- It doesn't learn the user's taste: a 5★ or 1★ review from the user doesn't change what they
  are shown next. Reviews and trips are used only to leave items out, and for "Popular now".
- The user vector always has season = 1 and budget = 1, so an item that matches **none** of the
  user's interests still scores about 0.6 (a lake for someone who only likes religious sites:
  0.65). The order is still right, but the "why" for such items is only "good season, fits
  budget".

*Update 2026-11-23 (V2-SR-01 … 07, score 7 → 8.5):* every point above is now handled. Reviews,
trips and the new "Not interested" (× with Undo) change the user's vector; items must share an
interest or tag (12 place tags) with the user, others only fill the list as "Something different to
explore"; treks risky for you this month go down; places near you or your latest trip go up; MMR
makes the list varied (λ chosen by measuring: [recommend_quality.md](recommend_quality.md)).
What still holds it back: the weights are still set by hand, and nobody outside the project has
used it, so we can't measure whether people like the suggestions.

**To raise the score:** record what users open and plan (V3-SR-05, V3-SR-08) and measure it;
"people who planned X also planned Y" (V3-SR-06).

---

## 3. Treks and safety

### Itinerary and acclimatisation checker: 8.5 / 10

**What works well:** each day shows sleeping altitude, height gained, km and hours. The checker
applies the WMS / CDC rules to sleeping altitude: *caution* for more than 500 m gained in a day
above 3,000 m, *danger* when no rest day comes within about 1,000 m of climbing, and it
suggests where to rest ([algorithms/acclimatisation.py](../backend/app/algorithms/acclimatisation.py)).
The rules are explained in the code and tested.

**What holds it back:** going down and then up again counts the climb twice. That is the safe
mistake to make, but it can mark a day *danger* when it isn't. Stage notes have no Nepali
text (V1-P3-19).

**To raise the score:** write the Nepali stage notes, and add a test for a down-and-up
itinerary.

### Altitude profile chart: 8.5 / 10

**What works well:** sleeping altitude and the highest point each day, too-fast climbs
coloured, tap a day for details, Nepali digits
([components/AltitudeChart.tsx](../mobile/src/components/AltitudeChart.tsx),
[algorithms/altitude_profile.py](../backend/app/algorithms/altitude_profile.py)).

**What holds it back:** the x-axis is days, not distance, so a long day looks the same as a
short one.

**To raise the score:** an option to plot against distance walked.

### AI risk predictor: 8 / 10

**What works well**
- CART decision tree and random forest written from scratch, with the split search written as
  NumPy array operations ([ml/tree.py](../backend/app/ml/tree.py), [ml/forest.py](../backend/app/ml/forest.py)).
  Our forest's results are as good as scikit-learn's (0.814 against 0.805 accuracy).
- Month is turned into "winter" and "monsoon" flags, not a number from 1 to 12. This is
  correct, because December and January are both risky but far apart as numbers
  ([ml/features.py](../backend/app/ml/features.py)).
- Every prediction saves its input, model version and reasons, so old results can be explained
  later.
- A newly trained model is loaded without restarting the server
  ([ml/registry.py](../backend/app/ml/registry.py)).

**What holds it back**
- **560 of the 592 training rows are labelled by our own scoring rule**
  ([ml/dataset.py](../backend/app/ml/dataset.py)). So the 0.814 accuracy mostly measures how
  well the forest *copies the rule*, not how well it predicts real trekkers. An examiner may
  ask about this.
- The model only knows heart condition and asthma for health.
- The model file is loaded with `joblib` (pickle). That is safe only while the file comes from
  our own training script. Keep it that way if "retrain from the admin panel" is built.

**To raise the score:** add the survey answers (V1-P1-18, V1-P2-14). Then report accuracy on
the **real rows only**, next to the rule rows, so the report is honest about what the
numbers mean.

### "Why this rating?": 9 / 10

**What works well:** reasons come from the decision paths of the trees that voted for the
answer. A reason is shown only if it points towards more risk **and** is true for this user,
so the app never says "because you are a beginner" to an expert
([ml/reasons.py](../backend/app/ml/reasons.py)). The reasons are in both languages, with the
user's own numbers ("+830 m on day 3"). This is the strongest part of the project for the
viva.

**What holds it back:** it shows at most 3 reasons and cannot say how much each one
contributed.

### Safer alternatives (KNN): 7 / 10

**What works well:** min-max scaling, then Euclidean KNN, then each neighbour is rated by the
same model **for this user and month**. Only treks rated lower are shown, each with the reason
("fewer days", "lower altitude") ([services/alternatives.py](../backend/app/services/alternatives.py)).

**What holds it back:** with 8 treks, K = 4 is half of all treks, so "nearest" means little
(the code comment says so). The neighbours are rated again on every request.

**To raise the score:** more treks in the data. The code itself needs no change.

### Weather forecast: 9 / 10

**What works well:** Open-Meteo, kept in Redis for 1 hour, plus a 24-hour stale copy used when
Open-Meteo is down. If Redis itself is down the app still works, only slower. An `X-Cache`
header shows HIT, MISS or STALE for testing ([services/weather.py](../backend/app/services/weather.py),
[core/cache.py](../backend/app/core/cache.py)). 6 tests cover it.

**What holds it back:** a trek's forecast is for its highest sleeping place only.

**To raise the score:** show the forecast for the start and the highest point together.

### Packing checklist: 8 / 10

**What works well:** a rule-based expert system (34 rules) using the trek's highest point, the
month and the number of days. Each item shows why it is there, and the trek's permits are
added as documents ([algorithms/packing.py](../backend/app/algorithms/packing.py)). Ticks are
saved on the phone ([lib/packingTicks.ts](../mobile/src/lib/packingTicks.ts)).

**What holds it back:** no admin page for the items (an Extra task). The Nepali item text is a
draft. Ticks are not shared between devices.

**To raise the score:** the admin page for packing items, and a Nepali review of the text.

### Safety and offline (V2 Phase 3): 0 / 10, not started

Emergency contacts, SOS by SMS, the Lake Louise symptom checker, daily check-in and offline
treks are all still to do. The app has **no offline mode at all**: the query cache is not saved
to the phone, so the itinerary cannot be opened without the internet. For an app whose tagline
is *"trek safely"*, this is the biggest gap.

**To raise the score:** the cheapest high-value steps are (1) emergency numbers and SOS by SMS,
which work without data, and (2) saving the TanStack Query cache to the phone so treks already
opened still show offline.

---

## 4. Plan

### Trip planner: 7.5 / 10

**What works well:** distance matrix, nearest neighbour, then 2-opt with an O(1) check per swap,
then a greedy split into days. A brute-force solver measures how good it is: on average 2-opt is
within 1.5% of the best route for 8 places ([algorithms/route.py](../backend/app/algorithms/route.py),
[route_gap.md](route_gap.md)). Only the owner can see a trip.

**What holds it back**
- The API accepts a start point (the phone's location or the hotel), but the app always sends
  an empty body, so routes start at the first place added
  ([lib/queries.ts](../mobile/src/lib/queries.ts)).
- Visit time is fixed at 1.5 hours for every place, and there is no endpoint to change it.
  A temple and a national park get the same time.
- Distances are straight lines × 1.4 at 25 km/h. That is a fair guess in the valley, but wrong
  on mountain roads.
- No drag to reorder (left out of the redesign).

**To raise the score:** send the phone's location as the start point, and let the user set
the visit time for each stop. Both need only small changes, because the backend already
supports most of it.

### Budget estimate: 7 / 10

**What works well:** 18 rates with a dated source each, permits and entry fees for foreign,
SAARC and Nepali visitors, and a breakdown line for each cost
([services/budget.py](../backend/app/services/budget.py), [data/README.md](../data/README.md)).

**What holds it back**
- **No guide or porter fees.** Since April 2023, foreign trekkers in national parks and
  conservation areas must trek with a licensed guide (the Everest region objected; see
  [beyond-college.md](product/beyond-college.md)). So most foreign trek estimates are too low.
- The app has no switch for the budget level, so users can't compare low and high.
- City food and the high-level city room are still estimates.

**To raise the score:** add a guide-fee line for foreign trekkers, and a budget-level switch.

### Share a trip: 8.5 / 10

**What works well:** a 128-bit random token, no login needed, no personal data shared, and
sharing can be stopped. A web page for people without the app has every value HTML-escaped and
a proper "link no longer works" page ([api/shared.py](../backend/app/api/shared.py)).

**What holds it back:** the link only opens while the laptop is on the same network, and the
app link still uses the old `smartnepalguide://` name.

### Teahouses: 4 / 10

**What works well:** the table, API, admin page and itinerary link all work, and the data is
real, not made up.

**What holds it back:** there are **4 lodges, all in Tengboche**, and none has a phone number.
For the other 56 trek villages the feature shows nothing.

**To raise the score:** add lodges for at least the main stops of Poon Hill, ABC and EBC.
This is data entry in the admin panel, not code.

---

## 5. Community

### Reviews and ratings: 8.5 / 10

**What works well:** one review per user and item, saved with an atomic
`INSERT … ON CONFLICT` ([api/reviews.py](../backend/app/api/reviews.py)). The Bayesian average
stops one 5★ review from beating many good ones ([algorithms/rating.py](../backend/app/algorithms/rating.py)).
A review hidden by an admin stays hidden when its author edits it. Lists get all their ratings
in one query.

**What holds it back:** users can't report a review, and there is no word filter, so
moderation depends on an admin reading everything. The author's full name is shown publicly.

**To raise the score:** a "Report" button that marks the review for the admin, and show only
the first name.

---

## 6. Platform

### Bilingual (English / नेपाली): 7 / 10

**What works well:** every screen is translated (441 English and 467 Nepali keys), numbers
use Devanagari digits, the Nepali font is chosen for each piece of text, and a missing Nepali
field falls back to English. Hard bugs were found and fixed (BUG-06 cut labels, BUG-14 digits
with the React Compiler).

**What holds it back:** the **content** is mostly English.

| Content | In Nepali |
|---|---|
| Place names | 69 of 69 |
| Place descriptions | 10 of 69 |
| How to get there | 10 of 69 |
| Trek stage notes | 0 of 57 |
| Packing items | draft |

A Nepali user sees Nepali buttons around English paragraphs on most pages. BUG-06 also still
needs one phone re-test.

**To raise the score:** write the Nepali descriptions (V1-P3-19 and the 59 places), and use the
optional AI-translation task (V2-OPT-01) for drafts that a person checks.

### UI design: 8 / 10

**What works well:** the redesign is consistent (theme, type scale, stat tiles, risk gauge),
it was checked on a real phone in both languages, and every screen has loading, empty and
error states. Server errors are shown in the user's language. There are 74 accessibility
labels and roles.

**What holds it back:** canvas parts are still missing (Save and Share on the photo header,
the duration slider, the budget switch, drag to reorder). Screenshots in `docs/screenshots/`
are from before the redesign.

### Admin panel: 7.5 / 10

**What works well:** dashboard, places with English and Nepali tabs, a map picker, photo upload,
treks with a stage editor, categories, permits, users (block), reviews (hide), teahouses and
budget rates. All admin routes need the admin role. Photo uploads check the type and size and
get a random file name ([api/admin.py](../backend/app/api/admin.py)).

**What holds it back**
- No page for packing items, and no photos for treks.
- The upload trusts the `Content-Type` the browser sends instead of checking the file's
  content.
- No record of which admin changed what.

**To raise the score:** the packing items page and trek photos. Check images with Pillow before
saving them.

### Testing and quality checks: 8.5 / 10

**What works well:** 209 backend tests (algorithms, ML, API, permissions), one script that runs
lint, format, migration check, tests, typecheck and the admin build
([scripts/verify.sh](../scripts/verify.sh)), 61 manual test cases with a guide, and 17 bugs
logged with their fixes. This is more than most student projects have.

**What holds it back:** **no automated tests for the mobile app or the admin panel**, and no CI,
so `verify.sh` only runs when someone remembers to run it.

**To raise the score:** a few Jest tests for the app's pure functions (`format.ts`,
`packingTicks.ts`, the error messages in `api.ts`), and a GitHub Actions workflow that runs
`verify.sh` on every push.

### Hosting and release: 4 / 10

**What works well:** one script starts everything for a demo
([scripts/start-demo.sh](../scripts/start-demo.sh)), and the APK builds and installs.

**What holds it back:** the server is the laptop. The phone must be on the same Wi-Fi, the APK
has the laptop's IP built in, there is no HTTPS, and the demo would fail if the IP changed on
defense day. That is fine for the college demo, which was decided on 2026-11-08, but it is a
risk on the day.

**To raise the score:** before the defense, test the demo on the network you will use there,
and keep the demo video (V1-P3-13) as a backup. Cloud hosting is planned in V3-P2-01.

---

## Top improvements, in order

These give the most points for the least work, with the defense in mind.

| # | Do this | Raises | Size |
|---|---|---|---|
| 1 | Add survey answers and report accuracy on real rows separately | Risk predictor (8 → 9), and protects you in the viva | Medium (needs survey answers) |
| 2 | Send the phone's location as the trip start, and allow a visit time per stop | Trip planner (7.5 → 8.5) | Small |
| 3 | Emergency numbers + SOS by SMS, and save the query cache to the phone for offline | Safety (0 → 4 or more) | Medium |
| 4 | Nepali descriptions for places and stage notes | Bilingual (7 → 8.5) | Medium (writing) |
| 5 | Guide-fee line in the budget, and a budget-level switch | Budget (7 → 8) | Small |
| 6 | Show the user's location and the trek routes on the map | Map (6.5 → 8) | Small–medium |
| 7 | Add teahouses for the main stops of 3 treks | Teahouses (4 → 6.5) | Data entry |
| 8 | Login rate limit, forgot password, delete account | Accounts (7 → 8.5) | Medium |
| 9 | CI for `verify.sh` and a few mobile unit tests | Testing (8.5 → 9) | Small |
| 10 | Rehearse the demo on the defense-day network; record the video | Hosting risk | Small |
