# Version 3 — Overview: Bato as a product

Version 3 is **not part of the college project**. It starts after the final defense and turns Bato
from a demo into something real people use on the trail. Why and for whom is in the
[product scope report](../../product/beyond-college.md).

Every task has a row in the
[Bato Project Tracker](https://docs.google.com/spreadsheets/d/1LWie4PGyiRj2xzo-zmTeK6Zd2-Rd_LAcVR2xOdkE33I/edit)
(IDs `V3-P1-01` …), and each checkbox below shows its tracker ID.

Earlier plans: [Version 1](../version1/phase1.md) · [Version 2](../version2/README.md)

---

## The three phases at a glance

| Phase | When | Theme | Main work | Ends with |
|---|---|---|---|---|
| [Phase 1](phase1.md) | Month 1 | **Validate**: does anyone want this? | 20 interviews · competitor table · landing page + waitlist · privacy, terms, ownership | A **go / no-go** decision |
| [Phase 2](phase2.md) | Months 2–3 | **Launch-ready**: works for strangers, on the trail | Cloud hosting + backups · security · account deletion · offline maps · real data · Play Store | Bato on Google Play |
| [Phase 3](phase3.md) | Months 4–6 | **Pilot and business**: will someone pay? | Agency accounts · group trips for guides · 2–3 agency pilot · payments · metrics | A **grow / change / stop** decision |

**Why this order:** Phase 1 costs almost no code and can stop a six-month mistake. Phase 2 is needed by
any customer. Phase 3 is the bet on agencies, so it waits for the evidence from Phase 1.

**Time:** you have a job, so the phases are in months, not weeks. Plan fixed hours (for example 8–10 a week)
and keep the tracker's *Planned week* column in months.

---

## Before you start Version 3 (gate)

- [ ] Final defense done; the college's rules on who owns the code are checked (`V3-P1-04`)
- [ ] Version 2 is tagged `v2.0` and the main branch is clean
- [ ] Version 2 Phase 3 (safety and offline treks) is either done or written up as future scope, since Version 3 builds on it

## Rules for every phase

The same rules as Version 1 and 2 (tracker first, plan → build → test, one migration per phase, both
languages, `./scripts/verify.sh` before every commit), plus:

1. **Evidence before code.** Every Phase 3 feature needs a line from the interviews or the pilot that asks for it.
2. **Real users' data is real.** No personal data in logs or screenshots; ask before recording interviews; delete test accounts from production.
3. **Releases are versioned.** Production builds get a version number and release notes; database migrations are tested on a copy of production first.

## Version 3 decisions (Decisions tab)

| Decision | Recommendation | Decide by |
|---|---|---|
| Target customer: agencies (B2B) or travellers (B2C)? | **Agencies first**, travellers free; confirm with the interviews | End of Phase 1 |
| First region | **Annapurna** (most popular, ABC + Poon Hill + Mardi Himal already in the seed) | End of Phase 1 |
| Final Android package ID | Decide before the first Play Store upload (it can't change later); e.g. `np.bato.app` if you own a matching domain | Before `V3-P2-09` |
| Hosting | A small VPS or a PaaS with managed PostgreSQL; pick on price in NPR per month | Start of Phase 2 |
| Play developer account | Personal (needs the 12-tester closed test) or organisation (needs a registered business and a D-U-N-S number) | Start of Phase 2 |

## Version 3 is done when
- [ ] Phase 1 ends with a written go / no-go in the Decisions tab (a no-go ends Version 3 here, and that's fine)
- [ ] Bato is live on Google Play, hosted in the cloud, with backups and crash reporting
- [ ] At least one trekking season of pilot use with agencies, with numbers
- [ ] A written grow / change / stop decision
