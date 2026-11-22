# Bato beyond college: product scope report

**Date:** 2026-11-20 · **Status:** discussion and plan, nothing built yet.
**Plan:** [Version 3](../plans/version3/README.md) (3 phases, about 6 months after the final defense).
**Tracker:** rows `V3-P0-01` and `V3-P1-01` … `V3-P3-06` in the
[Bato Project Tracker](https://docs.google.com/spreadsheets/d/1LWie4PGyiRj2xzo-zmTeK6Zd2-Rd_LAcVR2xOdkE33I/edit).

---

## 1. Summary

Bato can become more than a college project, but **not as it is today**. Version 1 and 2 prove the
idea: a bilingual Nepal guide with trek itineraries, an acclimatisation checker and a personal risk
rating. To become a product people rely on, it needs four things it does not have yet:

1. **Proof that people want it.** Nobody outside the project has used it yet.
2. **Works on the trail.** Full offline use, including the map.
3. **Real data.** The risk model is trained mostly on rule-generated rows.
4. **A way to pay for itself.** Servers, data upkeep and the Play Store all cost time or money.

**Recommendation:** finish the college project first, without changing its scope. After the defense,
spend **one month validating** before writing new code (Version 3 Phase 1). Build only if the
interviews show a clear customer. The most likely paying customer is **trekking agencies**, not
individual travellers (section 4).

---

## 2. Why there is room for Bato

| Reason | Evidence | What it means for Bato |
|---|---|---|
| **The market is large and steady** | About 1.16 million foreign visitors came to Nepal in 2025, roughly flat on 2024 (1.15 million) and still about 3% below 2019. India was the biggest source (about 25%), then the USA. | Enough travellers to matter, but the market is not growing fast; Bato must win users from existing habits. |
| **No Nepal-specific trek app dominates** | Travellers mostly use global apps (Maps.me, AllTrails, Komoot) plus agency PDFs and WhatsApp. (To confirm in the competitor table, `V3-P1-02`.) | A local app that knows permits, teahouses, altitude rules and Nepali can stand out. |
| **Nepali-language users are underserved** | Domestic trekking (Mardi Himal, Gosaikunda, ABC) is popular with young Nepalis, and global apps don't offer Nepali. | Bato's bilingual design is a real advantage that global apps are unlikely to copy. |
| **The risk check is unusual** | A personal "how risky is this trek for *me*, in *this* month?" with reasons, plus the acclimatisation and Lake Louise checks. | A clear selling point, as long as it is honest about its limits (section 5). |

## 3. The rule that changes the audience

Since **1 April 2023**, the Nepal Tourism Board requires **foreign trekkers in national parks and
conservation areas to trek with a licensed guide** hired through a registered agency, and the TIMS card
is issued through that agency. Enforcement has been uneven (the Everest region's local government
objected at first), and Nepali citizens are not covered by it.

What this means:
- Many foreign trekkers don't plan alone; **an agency plans the trek for them**.
- Agencies and guides are therefore **the gatekeepers and the likely payers**.
- **Nepali domestic trekkers** can still trek independently, so they are the best group of individual users.

## 4. Who could pay, and how

| Model | Who pays | How it works | Fit |
|---|---|---|---|
| **Agency subscription (B2B)** | Trekking agencies | Agencies publish their itineraries in Bato, give the app to their clients, and guides see the group's daily check-ins and symptom checks | **Best fit**: matches the guide rule; a few customers bring many users |
| Premium offline packs | Travellers | The app is free; offline maps and trek packs per region are paid | Possible. In-app digital goods must go through Google Play Billing (Google takes a fee) |
| Booking commission | Teahouses, guides | Bato takes a cut of bookings | Hard: needs many partners and payment handling before it pays |
| Sponsorship / grants | Tourism bodies, NGOs | Funding for the safety and Nepali-language parts | Good for a first year; not a long-term model |

**First guess to test in the interviews:** a free app for travellers, paid by agencies. Payments in
Nepal can go through Khalti or eSewa, or a simple invoice.

## 5. What Bato lacks today (honest gaps)

| Gap | Why it matters | Fixed in |
|---|---|---|
| **Runs on a laptop** | Real users need a server that is always on, with backups | V3 Phase 2 (`V3-P2-01`, `-02`) |
| **No offline map** | There is often no signal on the trail. V2 Phase 3 plans offline trek packs but not map tiles | `V3-P2-05` |
| **Risk model on synthetic data** | Fine for a college defense; for real safety advice it's a liability. Needs real answers and a model card | `V3-P2-06` |
| **Data goes stale** | Permit fees, entry fees and teahouse info change every season | `V3-P2-07` |
| **Not on the Play Store** | New personal developer accounts must run a closed test with **at least 12 testers for 14 days** before production. Account deletion and a data-safety form are also required | `V3-P2-04`, `-09` |
| **Package ID** | `com.smartnepalguide.app` **can never change after the first Play Store upload**. Decide the final ID before then | `V3-P2-09` |
| **Legal** | Privacy policy, terms, medical disclaimer; check with the college who owns the project code | `V3-P1-04` |

## 6. Risks

| Risk | How likely | What to do |
|---|---|---|
| Nobody pays | High | Validate first (V3 Phase 1); stop early if the interviews say no. A live portfolio app is still a good outcome |
| Wrong safety advice harms someone | Low, serious | Disclaimers, standard medical scores (Lake Louise), always "descend now" on red flags, real data before claiming accuracy |
| Data upkeep is too much for one person | High | One region first; "last verified" dates; agencies keep their own itineraries up to date |
| Global apps add Nepal features | Medium | Compete on Nepali language, local rules and agency tools, not on maps |
| Time: job + Bato | High | Fixed weekly hours; the Version 3 phases are months, not weeks |

## 7. Recommended path

1. **Now → final defense:** finish V1 and V2 as planned. No new scope.
2. **Month 1 (V3 Phase 1): validate.** 20 interviews, a competitor table, a landing page with a
   waitlist, the legal basics, then a written **go / no-go** decision.
3. **Months 2–3 (V3 Phase 2): launch-ready.** Cloud hosting, offline maps for one region (Annapurna is
   the suggested first), real data collection, Play Store release.
4. **Months 4–6 (V3 Phase 3): pilot.** 2–3 agencies for one trekking season (the spring season from
   March to May, or autumn from September to November), payments, metrics, then **grow / change / stop**.

**Measures of success after 6 months (to adjust in Phase 1):** 500 active users in the season, 2 agencies
willing to pay, and 200 real survey answers for the model.

**Even if it stops:** a published app with real users, cloud hosting, monitoring and a pilot is a much
stronger portfolio piece and interview story than a college report.

---

## Sources

- Tourist arrivals 2025: [IANS Live](https://ianslive.in/over-115-million-foreign-tourists-visited-nepal-in-2025--20260101203034), [The Himalayan Times](https://thehimalayantimes.com/nepal/more-than-11-million-foreign-visitors-arrived-in-nepal-in-2025), [Himal Press](https://en.himalpress.com/tourist-arrivals-cross-one-million-mark-for-third-straight-year/)
- Guide rule: [ShareSansar (rule in effect)](https://www.sharesansar.com/newsdetail/decision-requiring-trekkers-to-be-accompanied-by-licensed-guides-comes-into-effect-2023-06-02), [Kathmandu Post (Everest region objection)](https://kathmandupost.com/money/2023/03/30/tourism-board-everest-region-lock-horns-over-new-trekking-rule), [Viristar](https://www.viristar.com/post/nepal-requires-licensed-guides-for-treks-in-protected-areas/)
- Play Store testing rule: [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)

Check the guide rule and the TIMS fee against an official Nepal Tourism Board notice before using them in
a pitch: news and agency sources differ on the details.
