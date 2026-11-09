# Testing guide: how many tests, in which order, how to check each

This is the "what do I actually do" companion to [testing.md](testing.md) (the test case table for
the report). Everything runs on this laptop: PostgreSQL, the API, the admin panel and Metro.

## How many tests

| Kind | How many | How you run it | Time |
|---|---|---|---|
| Automated | **1 command** (129 backend tests + mobile/admin typecheck and lint) | `./scripts/verify.sh` | ~2 min |
| Manual, Phone 1 | **40 cases** (TC-01 … TC-40), in 6 sessions below | by hand, phone + browser | ~2½ h |
| Manual, Phone 2 | **8 cases** (layout check on a different screen size) | by hand | ~20 min |
| Phone demos | 2 (mid-term demo, final demo) — **no extra work**: sessions C and D are the demos | — | — |

So: **1 command + 48 manual checks**. The phase 1 demo is covered by sessions A and B.

## Where to record results

The **Bato Project Tracker** Google Sheet, tab **Test cases** (one row per TC):

- **Actual result**: what you saw, in a few words ("as expected" is fine when it matches).
- **Pass/Fail**: pick from the dropdown.
- **Phone**: `Phone 1`, or `Phone 1 + 2` for the 8 cases you also ran on Phone 2.
- **Date tested**: the day you ran it.

When a case fails: add a row in the **Bugs** tab (BUG-05, BUG-06, …) with the TC number, what
happened and the steps. After the fix, run the case again and change it to Pass. At the end, copy the
results into `testing.md` for the report.

## Before you start

1. Laptop and phone on the **same Wi-Fi** (or the laptop on the phone's hotspot).
2. Run the automated tests: `./scripts/verify.sh` → everything green. Write "129 passed" in the
   tracker (task V1-P3-08 notes).
3. Start everything: `./scripts/start-demo.sh` (add `--seed` once for fresh seed data).
4. **Phone 1:** uninstall Bato, then install the development build again, so TC-01 sees a real
   first launch.
5. Admin account: see `runlocal.md` → "Admin panel" (made with `uv run python -m app.create_admin`).

Take the screenshots marked 📸 as you go; they go into the report (task V1-P1-20). Save them as
`docs/screenshots/<TC>-<short-name>.png`.

---

## Session A — First launch, account, profile (8 cases, Phone 1)

| Order | TC | Do | Check (pass when…) |
|---|---|---|---|
| 1 | TC-01 | Open the fresh app, choose **नेपाली** | Every screen is Nepali, numbers in Devanagari (१२३). 📸 language screen. Switch back to English in Settings afterwards |
| 2 | TC-03 | Register with password `abc` | An error under the password; you stay on the register screen |
| 3 | TC-02 | Register with a new email + 8+ character password | The profile form opens. **Skip it** (don't fill it yet) |
| 4 | TC-23 | Explore → Everest Base Camp → Check my risk | You are asked to complete your profile first; no result screen |
| 5 | TC-08 | Settings → Profile: DOB, fitness *Medium*, experience *None* → Save; close and reopen the screen | The same values are shown again. 📸 profile |
| 6 | TC-04 | Log out → Register with the **same** email | "Email is already registered" |
| 7 | TC-06 | Log in with the wrong password | "Incorrect email or password" |
| 8 | TC-05 | Log in with the right password | The Explore tab opens |

## Session B — Explore, search, map (9 cases, Phone 1)

| Order | TC | Do | Check |
|---|---|---|---|
| 1 | TC-09 | Explore → chip *Temples & Stupas* | Only temples/stupas in the list. 📸 explore |
| 2 | TC-10 | Open Pashupatinath | Photos, best months, entry fee, how to reach, 5 nearby places. 📸 place detail |
| 3 | TC-11 | Settings → नेपाली → open Ghorepani | Name in Nepali, description in English (no blank text). Switch back to English |
| 4 | TC-12 | Search `punhill` | Poon Hill is in the results |
| 5 | TC-13 | Search `अन्नपूर्ण` | Annapurna treks/places are found. 📸 search |
| 6 | TC-14 | Search `xqzv` | "No results" message; the app doesn't crash |
| 7 | TC-15 | Search → trek filters: region *Annapurna*, difficulty *Moderate* | Exactly ABC and Mardi Himal |
| 8 | TC-16 | Map tab → tap any marker | That place's detail page opens. 📸 map |
| 9 | TC-17 | Map tab → chip *Viewpoints* | Only viewpoint markers remain |

## Session C — Trek itinerary and risk = the mid-term demo (6 cases, Phone 1)

Profile from session A: fitness *Medium*, experience *None*.

| Order | TC | Do | Check |
|---|---|---|---|
| 1 | TC-18 | Everest Base Camp → Day-by-day itinerary | 11 day cards; days 3 and 6 are rest days (Namche, Dingboche). 📸 itinerary |
| 2 | TC-19 | Same screen, look at the badges | Days 2, 5, 7 show **Caution**; the summary box says it passes |
| 3 | TC-20 | Annapurna Base Camp → itinerary | Day 5 shows **Add rest**; a rest day at Deurali is suggested |
| 4 | TC-21 | EBC → Check my risk → **January** | **Risky** (red), a confidence %, up to 3 reasons that are true for you. 📸 risk result |
| 5 | TC-22 | Profile: fitness *High*, *Experienced* → EBC → Check my risk → **October** | **Hard**, with different reasons (altitude/daily gain only) |
| 6 | TC-24 | Settings → My risk checks | Both checks, newest (October) first |

## Session D — Trip planner = the final demo, part 1 (6 cases, Phone 1)

| Order | TC | Do | Check |
|---|---|---|---|
| 1 | TC-25 | Pashupatinath → Add to My Trip → new trip "Valley" | "Pashupatinath Temple added to “Valley”."; the trip is in the Trips tab |
| 2 | TC-26 | Add Boudhanath, Swayambhunath, Patan Durbar Square, Bhaktapur, Nagarkot | 6 stops; numbered markers on the trip map |
| 3 | TC-27 | Add Pashupatinath to "Valley" again | "This place is already in the trip" |
| 4 | TC-28 | Tap **Optimise** | 2 days, **31.3 km**; "Nearest neighbour gave 38.8 km; 2-opt shortened it to 31.3 km."; markers renumbered, line follows the order. 📸 day plan + 📸 trip map |
| 5 | TC-29 | Remove one stop | The day plan disappears; **Optimise** is shown again |
| 6 | TC-30 | Delete the trip | A confirmation, then the trip is gone |

## Session E — Admin panel = the final demo, part 2 (9 cases, laptop browser + Phone 1)

Open `http://localhost:5173` on the laptop.

| Order | TC | Do | Check |
|---|---|---|---|
| 1 | TC-32 | Log in with the **traveller** account | "This account is not an admin" |
| 2 | TC-33 | Log in as admin | Counts + bar chart; the per-level bars include your 2 checks from session C. 📸 dashboard |
| 3 | TC-34 | Places → New: "Test Viewpoint", English + नेपाली, click the map, save, upload a JPEG | Saved, photo shows. On the phone: pull to refresh → it's in the list and in search. 📸 place form |
| 4 | TC-35 | Upload a PDF as the photo | "Upload a JPEG, PNG or WebP image" |
| 5 | TC-36 | Delete Namche Bazaar | Refused with a message; it's still there |
| 6 | TC-37 | Treks → EBC → remove the two rest days → save | Days = 9; on the phone the itinerary now shows **Add rest** warnings. 📸 stage editor |
| 7 | TC-38 | Users → block the traveller | On the phone the next action logs you out; logging in shows "This account has been blocked. Contact the Bato team." |
| 8 | TC-39 | Unblock the traveller | You can log in again on the phone |
| 9 | TC-40 | Switch the panel to नेपाली | Menus, labels and buttons are Nepali |

**Clean up after session E:** put the two EBC rest days back in the stage editor (days 3 and 6 at
Namche and Dingboche), or stop the script and run `./scripts/start-demo.sh --seed` (re-seeding
restores seeded treks and keeps "Test Viewpoint"). Re-run TC-18 to confirm 11 days.

## Session F — Offline and long use (2 cases, Phone 1)

| Order | TC | Do | Check |
|---|---|---|---|
| 1 | TC-31 | Turn off Wi-Fi and mobile data → pull to refresh on Explore | Friendly "no internet" message with **Try again**; turn Wi-Fi on → Try again works. 📸 offline |
| 2 | TC-07 | Leave the app open (logged in) for more than 30 minutes, then open a place | Still logged in, no error (the token was refreshed silently). Do this while you write up results |

---

## Phone 2 — layout check (8 cases)

A phone with a **different screen size** (small or large). Log in with the same traveller account.
You're checking that nothing is cut off, overlaps or needs sideways scrolling — in **both
languages** for the cases marked (EN+NE).

| TC | Screen | Check |
|---|---|---|
| TC-01 | Language screen (fresh install) | Both buttons fit |
| TC-09 | Explore list + chips (EN+NE) | Chips scroll, cards not cut |
| TC-10 | Place detail (EN+NE) | Photos and text fit the width |
| TC-18 | EBC itinerary (EN+NE) | Day cards and badges readable |
| TC-21 | Risk result (EN+NE) | Level, confidence and reasons fit; Devanagari not clipped on buttons |
| TC-28 | Trip day plan + map | Plan and map both usable |
| TC-31 | Offline message | Message and button visible |
| TC-40 | — (use the risk and trip screens in नेपाली) | Long Nepali button labels still fit |

In the tracker, set **Phone** to `Phone 1 + 2` for these 8 rows. If something only breaks on Phone 2,
write that in **Actual result** and log a bug.

---

## What this closes in the tracker

| Task | Closed when |
|---|---|
| V1-P1-19 Phase 1 demo on a phone | Sessions A and B pass |
| V1-P2-13 Mid-term demo on a phone | Session C passes |
| V1-P3-08 Manual test table | All 40 rows have Actual result + Pass/Fail |
| V1-P1-20 Screenshots for the report | The 📸 screenshots are saved in `docs/screenshots/` |
| V1-P3-09 Bug fixes | Every BUG row is Fixed and its TC re-run as Pass |

Suggested schedule: day 1 sessions A–C, day 2 sessions D–F + Phone 2, day 3 fix bugs and re-run.
