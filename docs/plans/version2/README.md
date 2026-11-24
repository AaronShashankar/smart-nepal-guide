# Version 2 — Overview

Version 2 adds the "Good" and "Wow" features from [feature.md](../../design/feature.md) on top of the
finished Version 1. It has three phases, one week each in the 16-week Gantt chart (weeks 13–15), plus an
optional list for spare time. Every task already has a row in the
[Bato Project Tracker](https://docs.google.com/spreadsheets/d/1LWie4PGyiRj2xzo-zmTeK6Zd2-Rd_LAcVR2xOdkE33I/edit)
(IDs `V2-P1-01` …), and each checkbox below shows its tracker ID.

Version 1 plan: [phase1](../version1/phase1.md) · [phase2](../version1/phase2.md) · [phase3](../version1/phase3.md)

---

## The three phases at a glance

| Phase | Week | Theme | Features | Main algorithms (for the viva) |
|---|---|---|---|---|
| [Phase 1](phase1.md) | 13 | **Smart trek features**: make the trek page more useful before a trip | Altitude profile graph · Safer alternative · Weather forecast · Packing checklist | Linear interpolation · **KNN** + the risk model · cache-aside with TTL (Redis) · rule-based expert system |
| [Phase 2](phase2.md) | 14 | **Personalisation & community**: the app learns what you like and what others think | Recommended for you · Reviews & ratings · Near me · Budget estimate · Share a trip · Teahouses | **Cosine similarity** (content-based filtering) · **Bayesian average** · bounding box + Haversine · formula-based estimate · random share tokens |
| [Phase 3](phase3.md) | 15 | **Safety & offline**: help on the trail, even without internet | Emergency contacts · SOS by SMS · Symptom checker · Daily check-in *(stretch)* · Offline treks *(stretch)* | **Lake Louise score** · scheduled job (APScheduler) · timestamp-based delta sync |
| [Optional](phase3.md#optional-only-if-time-remains) | 15+ | Only if time remains | AI-translated drafts · Retrain from the admin panel · Bikram Sambat dates | — |

**Status (2026-11-23):** Phase 1 and Phase 2 code is done and merged into `main` (phone demos still to run); Phase 3 is not started. Summary: [PROGRESS.md](../../../PROGRESS.md).

**Extra work on search and recommendations (V2-SR, 2026-11-23):** Stage 1 of [search-recommendation.md](../../product/search-recommendation.md) is built (V2-SR-01 … 10: transliteration, search by village/district/category, a search test set; recommendations that learn from feedback, use the risk model, a nearby bonus, MMR variety, "Not interested", place tags). V2-SR-14 (search by city and trek region: "pokhara", "kathmandu valley", "khumbu") was added the same day. V2-SR-11 … 13 are still to do.

**Why this order:** Phase 1 builds on what Version 1 already has (stages, the risk model, Redis in
docker-compose), so it is the cheapest way to add marks. Phase 2 needs new tables but no new device
features. Phase 3 needs device features (GPS, SMS, notifications, SQLite), each of which means a new
native package and a rebuilt development build, so it carries the most risk and goes last.

**One week per phase is tight for one person.** Each phase file marks its tasks *Core* (do these
first) or *Extra*. If the week runs out, move the Extra tasks to "Future scope" in the report rather
than letting Phase 3 slip into report-writing time (weeks 13–16).

---

## Before you start Version 2 (gate)

Do not start Version 2 until Version 1 is finished and tagged. These rows are still open in the tracker:

- [ ] Survey launched and real answers added, model retrained (`V1-P1-18`, `V1-P2-14`)
- [ ] Phase 1, 2 and 3 demos run on a real phone (`V1-P1-19`, `V1-P2-13`)
- [ ] 40 manual test cases run on two phones, High bugs fixed (`V1-P3-08`, `V1-P3-09`)
- [ ] Screenshots for the report (`V1-P1-20`)
- [ ] APK built and installed on a fresh phone (`V1-P3-12`)
- [ ] Demo video recorded (`V1-P3-13`)
- [ ] Code pushed to a private GitHub repository, then the git tag `v1.0` (`V1-P3-14`)

Version 2 work then happens on a branch (`git switch -c v2`), so `v1.0` always stays a working demo.

---

## Rules for every phase (same as Version 1)

1. **Tracker first.** Set the task to *In progress* and fill in *Started* before writing code. Log new bugs in the Bugs tab and choices in the Decisions tab.
2. **Plan → build → test.** Follow the phase file. When the build differs from the plan, add a *Note:* line under the checkbox.
3. **One migration per phase:** `0004_v2_phase1_…`, `0005_v2_phase2_…`, `0006_v2_phase3_…`. Autogenerate it, read it, then run `alembic upgrade head`.
4. **Both languages.** Every new string goes into `en.json` and `ne.json`. Every new content table gets a `*_translation` table with the same English fallback as Version 1.
5. **New native package = rebuild.** Use `npx expo install <pkg>`, then `npx expo run:android`. Group the native packages for each phase and install them on the first day of that phase.
6. **Finish with** `./scripts/verify.sh`. Then update README.md, runlocal.md (add a "Check the V2 Phase N demo" list), [algorithm.md](../../../backend/docs/algorithm.md) and [database.md](../../../backend/docs/database.md), and commit once per phase.

## Open decisions (Decisions tab)

| Decision | Recommendation | Decide by |
|---|---|---|
| Include the safety features in Version 2? | **Yes, but only the cheap ones as Core:** emergency contacts, SOS by SMS and the symptom checker. They work offline, need no server cost and make the best demo moment. The daily check-in and offline treks are *Stretch*. | Start of week 15 |
| Missed check-in alert: SMS gateway or email? | **Email (SMTP).** It is free and needs no business registration. Say in the report that a Nepali SMS gateway (Sparrow, Aakash) is the production choice. | Start of week 15 |
| Check-in reminder: FCM push or a local notification? | **Local notification** (`expo-notifications`, scheduled on the phone). It works offline and needs no Firebase project. FCM becomes future scope. | Start of week 15 |

## Version 2 is done when
- [ ] Every Core task in the three phase files is ticked, and its tracker row is *Done* with a commit hash
- [ ] The demo list at the top of each phase file works on a phone, in English and Nepali
- [ ] `./scripts/verify.sh` passes, with the new tests listed in each phase
- [ ] New test cases are added to `docs/testing/testing.md` and the Test cases tab (TC-41 onwards) and run once
- [ ] The report has a section for each new algorithm (what it is, why it was chosen, a worked example)
- [ ] Git tag `v2.0`
