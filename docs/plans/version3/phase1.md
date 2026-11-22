# Version 3 · Phase 1 — Validate

**When:** month 1 after the final defense. **Code:** almost none.
**Goal:** find out who would use and pay for Bato before spending months building it. End with a
written **go / no-go** decision.

Overview: [README.md](README.md) · Next: [phase2.md](phase2.md) · Why: [product scope report](../../product/beyond-college.md)

**Status:** not started. Tracker rows `V3-P1-01` … `V3-P1-05`.

---

## What "done" looks like
1. `docs/product/interviews/` has 20 short notes and a one-page summary.
2. `docs/product/competitors.md` compares Bato with the apps people actually use.
3. A landing page is live with a waitlist, and you know how many people signed up.
4. The privacy policy, terms and disclaimer are published; you know who owns the code.
5. The Decisions tab has a go / no-go row with the evidence.

---

## 1. Interviews (`V3-P1-01`) — Core

**Who (20 people):**

| Group | How many | Where to find them |
|---|---|---|
| Foreign trekkers | 8 | Thamel and Lakeside Pokhara cafés, hostels, trekking Facebook groups and Reddit |
| Nepali domestic trekkers | 4 | Friends, college, hiking clubs, Instagram trek pages |
| Agency owners or managers | 5 | TAAN member list, agencies in Thamel |
| Licensed guides | 3 | Through the agencies |

**Rules:** 15–20 minutes each, ask before recording, write notes the same day, no names in the notes
(use T1…, N1…, A1…, G1…). Ask about the **past** ("last time you…"), not "would you use…".

**Questions for trekkers:**
1. Tell me about your last trek. How did you plan it?
2. Which apps or websites did you use before and during the trek? What was missing?
3. Did you worry about altitude sickness? How did you decide whether a trek was right for you?
4. Did you have phone signal on the trail? What did you do without it?
5. Did you use an agency or a guide? How did you choose?
6. Have you paid for a travel or hiking app? Which one, and why?
7. *(Show Bato for 3 minutes.)* What would you use? What would you never use?

**Questions for agencies and guides:**
1. How do you send itineraries to clients today (PDF, WhatsApp, your website)?
2. How do you track a group's progress and health on the trail?
3. What goes wrong most often with clients? (Altitude, fitness, permits, communication…)
4. What software do you pay for now, and how much a month?
5. *(Show Bato.)* Would your clients use this? Would *you* pay for a guide view of the group? How much?
6. Can I come back with a test version for your next group?

- [ ] Interview script copied to `docs/product/interviews/script.md`
- [ ] 20 notes in `docs/product/interviews/` (one file each)
- [ ] `summary.md`: top 5 problems, what they use, what they pay, quotes, and who said yes to a pilot

## 2. Competitor table (`V3-P1-02`) — Extra

- [ ] `docs/product/competitors.md` with one row per app: Maps.me, AllTrails, Komoot, any Nepal-specific trek apps you find, and the tools agencies use
- [ ] Columns: offline maps, Nepal itineraries, permits, altitude/risk advice, Nepali language, price, what Bato does better, what Bato does worse
- [ ] Add the apps the interviewees named

## 3. Landing page and waitlist (`V3-P1-03`) — Extra

- [ ] One static page (English and Nepali): the tagline "Find your way, trek safely", 3 screenshots, what Bato does, "Join the waitlist" (email + traveller / agency / guide)
- [ ] Host it free (any static host) on a domain if you buy one now; the domain can also decide the package ID (see README)
- [ ] Count signups each week. **Goal: 100 in 4 weeks**, including at least 5 agencies or guides

## 4. Legal basics (`V3-P1-04`) — Core

- [ ] Ask your supervisor or the college in writing whether you can keep developing and publishing the project yourself
- [ ] Privacy policy: what Bato collects (account, profile, trips, risk checks, location for SOS), why, how long, how to delete it
- [ ] Terms of use + the safety disclaimer from V2 Phase 3 ("not a rescue service and not medical advice")
- [ ] Publish them on the landing page (the Play Store needs a privacy policy URL)

## 5. Go / no-go (`V3-P1-05`) — Core

Decide with the evidence, and write it in the Decisions tab:

| Signal | Go | No-go |
|---|---|---|
| Agencies | ≥ 2 say they would pilot it, ≥ 1 names a price | Nobody wants to try it |
| Travellers | The same 2–3 problems come up again and again, and Bato solves one | Everyone is happy with their current apps |
| Waitlist | ≥ 100 signups | < 30 signups |

- [ ] Target customer (agencies or travellers), first region, success measures for Phase 3
- [ ] If no-go: write what you learned in the report, publish the APK and code as a portfolio project, and stop here

---

## Risks
| Risk | What to do |
|---|---|
| People are polite and say "nice app" | Ask about past behaviour and money; a promise to pilot counts, praise doesn't |
| Hard to reach agencies | Go in person in Thamel; bring the demo on your phone |
| Building instead of talking | No new features in Phase 1, only fixes for bugs that interviewees hit |
