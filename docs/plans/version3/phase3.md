# Version 3 · Phase 3 — Agency pilot and business

**When:** months 4–6, across one trekking season (spring: March–May, or autumn: September–November).
**Goal:** test the business idea from Phase 1 with real agencies and guides: they publish their
itineraries in Bato, guides watch their group's safety, and at least one agency is willing to pay.
End with a **grow / change / stop** decision.

Previous: [phase2.md](phase2.md) · Overview: [README.md](README.md)

**Status:** not started. Tracker rows `V3-P3-01` … `V3-P3-06`.
**This phase assumes Phase 1 picked agencies.** If it picked travellers instead, swap tasks 1–2 for the
premium offline packs in task 4 and an in-app referral, and keep tasks 3, 5 and 6.

---

## Demo at the end of this phase
1. An agency signs up in the admin panel, adds its logo and publishes "ABC 7 days" with its own stages.
2. The agency creates a group trip and invites 3 clients by link; they join in the app and see the agency's itinerary.
3. On the trail, each client does the daily check-in and a symptom check. The **guide view** lists the group: last check-in, last symptom result, and a red mark on anyone with "descend".
4. The agency pays the monthly subscription (sandbox), and the admin dashboard shows the paying agencies and active users.

---

## 1. Agency accounts (`V3-P3-01`) — Core

- [ ] New roles: `agency_admin` and `guide`, linked to an `agency` table (name, licence number, logo, contact, verified flag)
- [ ] An agency sees and edits **only its own** itineraries, trips and guides
- [ ] Agency itineraries reuse the trek and stage tables (an `agency_id` column, `NULL` = Bato's own content); the acclimatisation check runs on them too
- [ ] You verify each agency by hand (licence number) before it can publish
- [ ] Tests: an agency can't read or change another agency's data

## 2. Group trips and the guide view (`V3-P3-02`) — Core

- [ ] Agency creates a group trip from one of its itineraries, with dates; clients join through an invite link (the V2 share token idea)
- [ ] Clients choose to share check-ins and symptom results with their guide (consent screen)
- [ ] Guide view in the app: the group list with last check-in time, last symptom result, last known location (only from check-ins and SOS, no live tracking)
- [ ] Builds on V2 Phase 3 (check-in and symptom checker) and its offline queue: results sync when someone has signal

## 3. Pilot (`V3-P3-03`) — Core

- [ ] 2–3 agencies from the interviews, free for the season, in writing (what you provide, what data you collect, either side can stop)
- [ ] Onboard each one in person; put their itineraries in with them
- [ ] A weekly 15-minute call or visit; notes in `docs/product/pilot/`
- [ ] Bugs go to the Bugs tab with the agency code (A1, A2…)
- [ ] At the end: `docs/product/pilot/report.md` (usage numbers, what they liked, what they missed, what they'd pay)

## 4. Pricing and payments (`V3-P3-04`) — Extra

- [ ] Agency subscription: a simple monthly price per agency (set from the interviews). Paid by Khalti or eSewa, or a bank transfer with an invoice to start with
- [ ] If travellers pay for premium offline packs: **in-app digital purchases must use Google Play Billing**
- [ ] Sandbox test payments for both; webhooks or callbacks verified on the server, never trusted from the app
- [ ] Ask an accountant about registering a business and tax before charging real money

## 5. Business metrics (`V3-P3-05`) — Extra

- [ ] Weekly numbers in the admin dashboard: active users, 4-week retention, offline packs downloaded, agencies (pilot / paying), revenue
- [ ] Compare with the success measures from Phase 1

## 6. Grow / change / stop (`V3-P3-06`) — Core

Write the decision in the Decisions tab with the pilot numbers:

| Outcome | When | Next |
|---|---|---|
| **Grow** | ≥ 1 agency pays and users come back | More regions, iOS, maybe a co-founder or a Nepali content partner |
| **Change** | People use it but nobody pays, or a different group asks for it | Change the customer or the paid feature and run one more season |
| **Stop** | Little use after a full season | Keep it live if it's cheap, open-source it, and use it as a portfolio piece |

---

## Tests
- [ ] Agencies and guides only see their own data (API tests for every new route)
- [ ] Clients' health data reaches a guide only with consent
- [ ] Payment callbacks: valid one → subscription active; forged or repeated one → ignored
- [ ] `./scripts/verify.sh` passes

## Done when
- [ ] The pilot ran for a full season with at least 2 agencies
- [ ] The pilot report and the grow / change / stop decision are written
- [ ] Tracker rows `V3-P3-01` … `V3-P3-06` are *Done* or moved with a Decisions row

## Risks
| Risk | What to do |
|---|---|
| Agencies don't use it after setup | Make it part of their routine: their itinerary PDF links to Bato; check in weekly |
| Health data is sensitive | Consent screens, only share with the group's guide, delete after the trip + 30 days unless the client keeps it |
| Payment setup takes too long | Start with invoices; automate payments only when there are paying agencies |
| One person can't run a pilot and a job | Two agencies are enough; pick a season when you have time |
