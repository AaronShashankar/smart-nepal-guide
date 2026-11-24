# Search and recommendations: from college project to real product

**Date:** 2026-11-23 · **Status:** Stage 1 core built (V2-SR-01 … V2-SR-10, V2-SR-14); 04, 07 and 09 wait for a last manual check; the rest is planned.
**Tracker:** rows `V2-SR-00` … `V2-SR-14` and `V3-SR-01` … `V3-SR-12` in the
[Bato Project Tracker](https://docs.google.com/spreadsheets/d/1LWie4PGyiRj2xzo-zmTeK6Zd2-Rd_LAcVR2xOdkE33I/edit).
**How the algorithms work:** [algorithm.md → V2-SR](../../backend/docs/algorithm.md#v2-sr-better-search-and-recommendations).
**Measured results:** [search_quality.md](../../backend/docs/benchmarks/search_quality.md), [recommend_quality.md](../../backend/docs/benchmarks/recommend_quality.md).

---

## 1. Where we started (before V2-SR)

| | Search | Recommendations |
|---|---|---|
| What it did | Fuzzy match (pg_trgm + our Levenshtein) on place and trek **names** and aliases only | Cosine similarity between 4 interests + season + budget and each item; "Popular now" for new users |
| Main gaps | "pashupati mandir", "namche" (a village on a trek), "bhaktapur" (a district), "temple" (a category), "ebc" all found nothing; nothing measured | Ignored risk (recommended EBC to a beginner in January), never learned from reviews, no way to say "not interested", ignored where you are, lists were all one kind |

## 2. The three stages

- **Stage 1 (now, no users needed):** make the algorithms smarter with the data we already have. Version 2.
- **Stage 2 (with real users, Version 3 Phase 2):** learn from what people actually do. Needs event logs.
- **Stage 3 (at scale, Version 3 Phase 3):** heavier tools that only pay off with many users.

Doing Stage 3 first would be a mistake: collaborative filtering and A/B tests need thousands of
active users, and a search engine like Meilisearch is not needed for 69 places and 8 treks.

## 3. Stage 1: built now

| ID | What | How | Status |
|---|---|---|---|
| V2-SR-01 | **Risk-aware treks** | Each trek is rated with the active risk model for this user and month. Score × 1.0 (easy, moderate), 0.7 (hard), 0.4 (risky). Easy/moderate get the reason "Suits your fitness this month" (`FITS_YOU`). Skipped if the profile is incomplete. | Done |
| V2-SR-02 | **Learn from feedback** | Each review (5★ +1, 4★ +0.5, 3★ 0, 2★ −0.5, 1★ −1), trip stop (+0.5) and "Not interested" (−1) is a signal. The average of signal × item vector is added to the user vector (below 0 → 0). Works even with no interests chosen. | Done |
| V2-SR-03 | **Not interested** | × on each recommendation card; the card goes at once, "Undo" for 6 seconds. Table `dismissed_item`, `POST /recommendations/dismissed`, `DELETE /recommendations/dismissed/{type}/{id}`. | Done |
| V2-SR-04 | **Nearby bonus** | + 0.15 × e^(−d / 40 km). d is measured from the phone's position, sent only when location was already allowed (the app never asks for it here), else from the middle of the user's latest trip. Reasons "Near you" / "Near your latest trip" within 25 km. | Built; check on a real phone with location allowed |
| V2-SR-05 | **Variety (MMR)** | Pick items one by one: λ × score − (1 − λ) × similarity to what is already picked; similarity = ½ cosine + ½ "same kind". λ = 0.75 chosen by measuring (below). | Done |
| V2-SR-06 | **Only matching items, then "Explore more"** | The personal part only has items sharing an interest or tag with the user; empty places are filled with popular items marked "Something different to explore". | Done |
| V2-SR-07 | **Place tags** | 12 tags (sunrise, mountain views, hiking, boating, wildlife, pilgrimage, UNESCO, architecture, local culture, family, high altitude, few crowds) in `data/place_tags.csv`, editable in the admin panel, shown as chips on the place page, part of the recommendation vectors. | Built; TC-66 (admin form, Nepali labels) left |
| V2-SR-08 | **Roman ↔ Devanagari** | Our own Devanagari → Latin transliteration with schwa deletion; `name_latin` saved for every name; a Devanagari query is also searched in Latin letters. | Done |
| V2-SR-09 | **Search more than names** | Villages find the treks through them ("namche" → EBC Trek, "Passes through Namche Bazaar"); districts list their places; category words (temple, lake) list that category; trek initials ("ebc", "abc"); word-by-word matching for extra words in Nepali names. | Built; Nepali subtitles check left (TC-66) |
| V2-SR-10 | **Search test set** | 51 real queries with the expected answer (43 at first, 8 city/region cases added with V2-SR-14); hit@1, hit@3, MRR. Runs in pytest; `python -m app.search_benchmark` writes the report. | Done |
| V2-SR-14 | **Search by city and trek region** | Asked for after "pokhara" found only Phewa Lake (Pokhara is a city in Kaski district) and "kathmandu" missed Patan and Bhaktapur. New `area` table from `data/areas.csv`: 6 areas (Kathmandu Valley, Pokhara, Everest/Khumbu, Annapurna, Langtang, Manaslu) with English, Nepali and other names; 63 of 69 places belong to one. A match on an area name (× 0.88) lists every place in it; a trek region also finds its treks ("khumbu" → EBC Trek). Shown in the app ("Viewpoints · Pokhara", place page "Pokhara, Kaski, Gandaki"), editable per place in the admin panel, `GET /areas`, `/places?area=`. Migration 0007. | Done (TC-67) |
| V2-SR-11 | Search ranking boosts | Exact and starts-with matches, rating, distance from the user. | To do |
| V2-SR-12 | Text + filters together | "temple" + district Kathmandu in one request; category chips on the Places tab. | To do |
| V2-SR-13 | Simple phrases | "easy trek 5 days", "temples in Bhaktapur" → filters from known words. | To do |

### Results we measured

**Search** (same 51 queries, [search_quality.md](../../backend/docs/benchmarks/search_quality.md); "before" = the old search code run on the same queries):

| | Before V2-SR | After |
|---|---|---|
| Expected item first (hit@1) | 60% | **83%** |
| Expected item in the top 3 (hit@3) | 60% | **100%** |
| MRR | 0.604 | **0.906** |
| Made-up words that return nothing | 67% | **100%** |

**Recommendations** (6 typical new users, top 10, [recommend_quality.md](../../backend/docs/benchmarks/recommend_quality.md)):
MMR with λ = 0.75 raises variety by about 37% and the kinds of item in a list from 2.2 to 3.3,
and costs only about 2% of relevance; λ = 0.6 costs over 6%.

## 4. Stage 2: with real users (Version 3 Phase 2)

| ID | What | Why it waits |
|---|---|---|
| V3-SR-05 | Record user actions (opened, saved, added to trip, reviewed, risk checked), with consent | Everything else here needs this; must be private and deleted with the account |
| V3-SR-01 | Log searches; admin page "top searches with no results" | Shows what data to add next |
| V3-SR-08 | Measure recommendations: shown, opened, added to trip | Without numbers we cannot tell if a change helps |
| V3-SR-06 | "People who planned X also planned Y" | Needs many trips |
| V3-SR-07 | Taste from behaviour, recent actions count more | Builds on V2-SR-02 |
| V3-SR-02 | Offline search on the phone | Goes with offline treks (V2-P3-06) |
| V3-SR-03 | Recent and popular searches | Popular needs logs |
| V3-SR-04 | Full-text search in descriptions | Needs more descriptions, in Nepali too |

## 5. Stage 3: at scale (Version 3 Phase 3, optional)

| ID | What | Only when |
|---|---|---|
| V3-SR-09 | Dedicated search engine (Meilisearch / Typesense) | PostgreSQL search is too slow or limited |
| V3-SR-10 | Meaning-based search (multilingual embeddings, pgvector) | Search logs show question-like queries |
| V3-SR-11 | Collaborative filtering (matrix factorization) | Thousands of active users, and it beats Stage 2 on the measured numbers |
| V3-SR-12 | A/B testing of ranking changes | Enough users to compare two versions |

## 6. Known limits of what is built

- Transliteration uses a rule of thumb for dropping the silent "a". A few names come out a little
  wrong (पशुपति → "pashupti", जानकी → "janki"); Levenshtein forgives this, and the English name is
  always searched too.
- Category and tag weights are set by hand (tables in algorithm.md), not learned.
- The risk factor uses the same model as the risk screen: it is only as good as that model,
  which is still trained mostly on rule-labelled rows (see [ml/](../../backend/docs/ml/)).
- Nearby bonus without GPS uses the latest trip, which may be an old one.
- hit@1 is lower than for the first 43 queries (92%) because a city query ("pokhara") has several right answers: only one of them can be first, so the city cases are judged on hit@3.
- Places in one city or region are listed in name order; nothing yet says which is the most important (V2-SR-11 could use ratings).
- The search test set has 51 queries written by us. Real search logs (V3-SR-01) should replace it.
