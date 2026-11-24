# Testing guide: how many tests, in which order, how to check each

This is the "what do I actually do" companion to [testing.md](testing.md) (the test case table for
the report). Everything runs on this laptop: PostgreSQL, the API, the admin panel and Metro.

## How many tests

| Kind | How many | How you run it | Time |
|---|---|---|---|
| Automated | **1 command** (302 backend tests + the Lake Louise check + mobile/admin typecheck and lint) | `./scripts/verify.sh` | ~2 min |
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
2. Run the automated tests: `./scripts/verify.sh` → everything green. Write "302 passed" in the
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
| 1 | TC-31 | Turn off Wi-Fi and mobile data → pull to refresh on Explore | Lists already loaded stay, with a "no internet" note above them. Then tap a category not opened yet → message with **Try again**; turn Wi-Fi on → Try again loads it. 📸 offline |
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

## Session G — V2 Phase 1 smart trek features (6 cases, Phone 1)

Before: `cd backend && uv run python -m app.seed` (migration 0005 + packing items) and Redis running.
Do it in नेपाली once and English once.

| Order | TC | Do | Check |
|---|---|---|---|
| 1 | TC-53 | EBC → Day-by-day itinerary | Altitude chart: top 5,644 m on day 9, flat rest days, orange big-climb days; tap day 4. 📸 chart |
| 2 | TC-54 | Medium fitness, no experience → EBC → Check my risk → January | Risky + "Safer alternatives" with why; tap one. 📸 alternatives |
| 3 | TC-55 | Expert profile → Poon Hill → October | No alternatives box |
| 4 | TC-56 | EBC page, then Boudhanath page | 7-day forecast (Gorak Shep / Kathmandu); tap a day; `curl -I …/weather` twice → MISS then HIT. 📸 weather |
| 5 | TC-57 | EBC → Packing list → January; Poon Hill → October | Cold-weather gear with reasons + permits; Poon Hill list much shorter. 📸 packing |
| 6 | TC-58 | Tick a few → close the app fully → reopen | Ticks kept; Clear ticks works; label not cut off |

## Session H — Login and register forms (3 cases, Phone 1 + Phone 2)

Log out first. Use the on-screen keyboard: on the emulator, turn on *Show on-screen keyboard* (or
`adb shell settings put secure show_ime_with_hard_keyboard 1`). Phone 2 matters most here, because its
screen is shorter.

| Order | TC | Do | Check |
|---|---|---|---|
| 1 | TC-59 | Welcome → Log in → tap Email, type, press Next, type a password | The sheet sits above the keyboard; both fields and the Log in button stay visible; Next goes to Password |
| 2 | TC-60 | Tap the eye in the password field, then tap it again (login and Create account) | Password shown with a crossed eye, then hidden again; the keyboard stays open |
| 3 | TC-61 | Create account → Full name, Next, Email, Next; scroll with the keyboard open | Placeholders in every field (EN and NE); Next moves through the fields; the page scrolls to the Create account button |

## Session I — Search and recommendations (6 cases, Phone 1 + laptop browser)

Use an account with a complete profile and interests culture + religious. For TC-66 also start the admin
panel (`cd admin && npm run dev`) and log in as admin.

| Order | TC | Do | Check |
|---|---|---|---|
| 1 | TC-62 | Search → Places → `pashupati mandir` | Pashupatinath Temple; hint shows पशुपतिनाथ मन्दिर |
| 2 | TC-63 | Treks → `namche`; Places → `bhaktapur` | EBC Trek "Passes through Namche Bazaar"; Bhaktapur's places first |
| 3 | TC-64 | Explore → × on the first recommended card → Undo | Card goes at once; Undo bar; Undo brings it back |
| 4 | TC-65 | Explore → first two cards; open Bhaktapur Durbar Square | Two kinds of place at the top; tag chips with icons |
| 5 | TC-66 | Admin → edit Phewa Lake → add a tag → save; app in नेपाली → Explore, place page, search `namche` | Tag shows in the app; reasons, tags and "हुँदै जान्छ" in Nepali |
| 6 | TC-67 | Places → `pokhara`, open Sarangkot; Places → `kathmandu valley`; Treks → `khumbu`. In the admin, edit Sarangkot: "City or trek region" shows Pokhara | 3 Pokhara places, "· Pokhara"; place page "Pokhara, Kaski, Gandaki"; 8 valley places; EBC Trek |

---

## Session J — Safety: contacts, SOS, symptom checker (9 cases, real phone with a SIM)

Not the emulator: it has no SMS app and no real GPS. First set **test mode** (see the Safety section in
[testing.md](testing.md)): two of your own numbers in `mobile/.env`, then `npx expo start -c`. Check the
yellow TEST MODE banner is on the Safety screen before holding SOS. Do the SOS cases **outdoors**, so
the GPS gets a fix. Have the admin dashboard open on the laptop to see the counts go up.

| Order | TC | Do | Check |
|---|---|---|---|
| 1 | TC-68 | Settings → Emergency contacts → add test phone 1 (`98…`), edit it, add and delete a second | Saved as `+977…`; edit saved; delete asks first |
| 2 | TC-69 | Empty phone; phone `12ab`; fill up to 5 contacts | A message each time; no 6th form |
| 3 | TC-70 | Tap Tourist Police in the fixed list | TEST MODE banner; dialler shows a test number |
| 4 | TC-71 | SOS screen → quick tap, then hold 2 s → Send | Quick tap does nothing; SMS app with location + map link; test phone gets it |
| 5 | TC-72 | Data and Wi-Fi off → hold SOS → Send; then online, open the app | SMS still goes; admin "SOS events" +1 |
| 6 | TC-73 | Delete all contacts → hold SOS | Dialler on test number 1 (Tourist Police's slot) |
| 7 | TC-74 | EBC → Itinerary → How do you feel? → the 3 demo answer sets | Rest (4) / Descend (10) / Descend (confusion) |
| 8 | TC-75 | Offline check → My symptom checks → online → pull to refresh | "waiting to be sent", then in the history; admin "Symptom checks" +1 |
| 9 | TC-76 | Switch to नेपाली → the safety screens and SOS | Disclaimer and texts in Nepali; link in the SMS works |

After the run: **remove `EXPO_PUBLIC_SAFETY_TEST_NUMBERS` from `mobile/.env`** and restart Metro, so the
real numbers are back.

---

## What this closes in the tracker

| Task | Closed when |
|---|---|
| V1-P1-19 Phase 1 demo on a phone | Sessions A and B pass |
| V1-P2-13 Mid-term demo on a phone | Session C passes |
| V1-P3-08 Manual test table | All 40 rows have Actual result + Pass/Fail |
| V1-P1-20 Screenshots for the report | The 📸 screenshots are saved in `docs/screenshots/` |
| V1-P3-09 Bug fixes | Every BUG row is Fixed and its TC re-run as Pass |
| V2-P3-01 / 02 / 03 / 07 (safety Core) | Session J passes; then the rows go from Testing to Done |

Suggested schedule: day 1 sessions A–C, day 2 sessions D–F + Phone 2, day 3 fix bugs and re-run.
