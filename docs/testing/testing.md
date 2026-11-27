# Testing (for the report's testing chapter)

Two kinds of testing. **Step-by-step order, test counts and how to check each case:** [testing-guide.md](testing-guide.md).

1. **Automated tests**: 302 backend pytest tests (`cd backend && uv run pytest`), the Lake Louise
   check of the app's copy of the score (`scripts/check-lake-louise.mjs`), plus the TypeScript
   typecheck and lint for the mobile app and the admin panel. All of them run with
   `./scripts/verify.sh`.
2. **Manual test cases**: the table below. Run each case on a real phone (and the admin panel in a
   browser), then fill in **Actual result** and **Pass/Fail**. Test on at least two Android phones
   with different screen sizes, and write the phone models here:

   - Phone 1: Android emulator "Medium Phone", Android 17 (screen size 1080 × 2400, 420 dpi). First full run on
     2026-11-19, driven with mobile-mcp; the admin panel with Playwright (Chromium). Screenshots in
     `docs/screenshots/TC-*.png`.
   - Phone 2: Samsung Galaxy A07 (SM-A075F), Android 16 (screen size 720 × 1600). Run by hand on 2026-11-23:
     the 8 layout cases, TC-47 (real GPS) and TC-51 (share link).

   Result of the first run (52 cases): 50 Pass, 1 Fail (TC-01, Nepali labels cut off), 1 Blocked (TC-47,
   emulator GPS; the API gives the right answer). After fixing BUG-06 to BUG-14, TC-01 and TC-31 were run again
   and passed, and every case that noted a bug was re-checked: **51 Pass, 1 Blocked**.

   Phone 2 (2026-11-23): TC-47 Near me passes with real GPS, so it is no longer blocked. The layout cases
   pass, except the welcome screen in Nepali: "Google बाट अगाडि बढ्नुहोस्" and "खाता बनाउनुहोस्" lost their
   last word again (BUG-06). That was fixed again the same day and passes on the emulator; TC-01 is
   **Fail** until it passes on Phone 2.

   Login and register forms (2026-11-23): TC-59 to TC-61 were added for the keyboard, the show-password
   button and the placeholders (BUG-17). They pass on the emulator and on Phone 2.
   Search and recommendations (V2-SR, 2026-11-23): TC-62 to TC-66 were added. TC-62 to TC-65 pass on the
   emulator; TC-66 (admin tags, Nepali labels) is not run yet.
   Search by city and trek region (V2-SR-14, 2026-11-23): TC-67 was added and passes on the emulator.
   Since then a place's search subtitle shows its city or region instead of its district
   (TC-62 now shows "Temples & Stupas · Kathmandu Valley").
   Safety (V2 Phase 3 Core, 2026-11-24): TC-68 to TC-76 were added. They need a real phone (SMS app,
   GPS, mobile data off), so they are not run yet.
   Now: **65 Pass, 1 Fail (TC-01, re-test on Phone 2), 11 Not run (TC-66, TC-68 to TC-77)**.
   Health questions (V2-PROF-01, 2026-11-27): TC-77 was added.

The **Auto** column names the pytest test that checks the same behaviour through the API, where
there is one. The manual case still checks the screen.

Test data: the seed data (`uv run python -m app.seed`), an admin made with
`uv run python -m app.create_admin`, and a traveller account registered in the app.

## Manual test cases

| ID | Feature | Steps | Input | Expected result | Actual result | Pass/Fail | Auto |
|---|---|---|---|---|---|---|---|
| TC-01 | Language | First launch → choose a language | नेपाली | Every screen is in Nepali, with numbers in Devanagari digits | First run: many Nepali labels lost their last word and regions stayed English (BUG-06, BUG-09). Re-test after the fixes: login, register, profile, Explore, place, trek and itinerary screens complete in Nepali ("Google बाट अगाडि बढ्नुहोस्", "अन्नपूर्ण · ८ दिन · ८१ कि.मि.", "म्याग्दी, गण्डकी"); text with no Nepali version in the data falls back to English as in TC-11. Phone 2 (2026-11-23): the welcome screen's "Google बाट अगाडि बढ्नुहोस्" and "खाता बनाउनुहोस्" lost their last word again (BUG-06, second fix); passes on the emulator, re-test on Phone 2 | **Fail** (fixed, re-test on Phone 2) | |
| TC-02 | Register | Register with email | new email, 8+ char password | Account created; the profile form opens | Account created; profile form opened. First run: "Skip for now" showed the form a second time (BUG-08). Re-test after the fix: Skip goes straight to Explore | Pass | `test_register_login_me` |
| TC-03 | Register | Register with a short password | `abc` | Error message; no account created | Error shown, no account in the database. First run: the text was the server's raw English "String should have at least 8 characters", also in Nepali (BUG-07). Re-test after the fix: "Password must be at least 8 characters." / "पासवर्ड कम्तीमा ८ अक्षरको हुनुपर्छ।" | Pass | `test_short_password_rejected` |
| TC-04 | Register | Register an email that is already used | existing email | "Email is already registered" message | "Email is already registered" | Pass | `test_duplicate_email_rejected` |
| TC-05 | Login | Log out, then log in | correct email + password | Explore tab opens | Explore tab opened | Pass | `test_register_login_me` |
| TC-06 | Login | Log in with a wrong password | wrong password | "Incorrect email or password" message | "Incorrect email or password" | Pass | `test_wrong_password_fails` |
| TC-07 | Login | Leave the app open > 30 min, then use it | — | Still logged in (token refreshed silently) | 32 min after login: still logged in; the profile loaded fresh data from the server | Pass | `test_refresh_token_flow` |
| TC-08 | Profile | Fill in and save the profile, reopen it | DOB, fitness *Medium*, experience *None* | Saved values are shown again | DOB 1995-01-15, fitness Medium, experience None, budget Medium shown again | Pass | `test_profile_save_and_load` |
| TC-09 | Explore | Explore → a category chip | *Temples & Stupas* | Only temples and stupas are listed | 9 places, all temples and stupas | Pass | `test_list_places_by_category_paginated` |
| TC-10 | Place detail | Open a place | Pashupatinath | Photos, best months, entry fee, how to reach, 5 nearby places | Photo, altitude, entry fee (Foreign NPR 1,000 · SAARC/Nepali free), best months, how to get there, 5 nearby places (Boudhanath 1.8 km … Changu Narayan 7.8 km) | Pass | `test_place_detail` |
| TC-11 | Language fallback | Switch to Nepali → open a place with no Nepali description | Ghorepani | Nepali name, English description | घोरेपानी: Nepali name and labels, English description, no blank text. First run: the district stayed English (BUG-09); re-test: "म्याग्दी, गण्डकी" | Pass | `test_partial_nepali_row_falls_back_per_field` |
| TC-12 | Search | Search with a spelling mistake | `punhill` | Poon Hill is found | Poon Hill and Ghorepani Poon Hill Trek found | Pass | `test_search_fuzzy` |
| TC-13 | Search | Search in Devanagari | `अन्नपूर्ण` | Annapurna treks / places are found | Annapurna Base Camp, ABC Trek and Annapurna Circuit Trek found | Pass | `test_search_fuzzy` |
| TC-14 | Search | Search for nonsense | `xqzv` | "No results" message, no crash | "Nothing found for “xqzv”.", no crash | Pass | `test_search_nonsense_returns_nothing` |
| TC-15 | Trek filters | Search → trek filters | Region *Annapurna*, difficulty *Moderate* | ABC and Mardi Himal | Exactly ABC Trek and Mardi Himal Trek | Pass | `test_list_treks_filters` |
| TC-16 | Map | Map tab → tap a marker | any marker | Its detail page opens | Tapped the Lumbini marker → Lumbini detail opened | Pass | `test_list_places_bbox_for_map` |
| TC-17 | Map | Map tab → category chip | *Viewpoints* | Only viewpoint markers stay | Only the 5 viewpoint markers remain | Pass | |
| TC-18 | Itinerary | EBC → Day-by-day itinerary | — | 11 day cards; days 3 and 6 are rest days | 11 day cards; day 3 Namche and day 6 Dingboche are rest days; summary +830 m (day 2), highest night 5,164 m, 2 rest days | Pass | `test_stages_and_summary` |
| TC-19 | Acclimatisation | EBC itinerary | — | Days 2, 5, 7 show **Caution**; summary says it passes | Days 2, 5, 7 Caution; orange summary "Some days climb more than 500 m" (passes) | Pass | `test_standard_ebc_passes_with_cautions` |
| TC-20 | Acclimatisation | ABC itinerary | — | Day 5 shows **Add rest**; suggests a rest day at Deurali | "This itinerary climbs too fast. Add rest days: Rest at Deurali (3,200 m) before day 5"; day 5 Add rest | Pass | `test_acclimatisation_endpoint` |
| TC-21 | Risk | EBC → Check my risk | January; fitness *Medium*, experience *None* | **Risky**, confidence, up to 3 reasons | Risky, 98%, 3 reasons (no multi-day experience; up to 5,644 m; +830 m on day 2) | Pass | `test_beginner_ebc_january_riskier_than_expert_poon_hill_october` |
| TC-22 | Risk | Change profile → EBC → Check my risk | October; fitness *High*, *Experienced* | **Hard**, with different reasons | Hard, 82%, 2 reasons (above 5,000 m; +830 m on day 2) | Pass | same as above |
| TC-23 | Risk | New account, skip the profile → Check my risk | — | Asked to complete the profile first | "Complete your traveller profile first" with a button to the profile | Pass | `test_predict_needs_complete_profile` |
| TC-24 | Risk history | Settings → My risk checks | — | Both checks, newest first | EBC · Oct Hard 82% first, then EBC · Jan Risky 98% | Pass | |
| TC-25 | Trip planner | Place detail → Add to My Trip → new trip | Pashupatinath Temple, title "Valley" | "Pashupatinath Temple added to “Valley”."; trip appears in Trips tab | "Pashupatinath Temple added to “Valley”."; trip in the Trips tab. First run: the first tap on the sheet button only closed the keyboard (BUG-11); re-test: one tap is enough | Pass | `test_create_list_and_get` |
| TC-26 | Trip planner | Add 5 more places to the same trip | Boudhanath, Swayambhunath, Patan Durbar Sq., Bhaktapur, Nagarkot | Trip shows 6 stops and numbered markers on the map | 6 places, numbered markers 1–6 with a dashed line | Pass | |
| TC-27 | Trip planner | Add the same place twice | Pashupatinath again | "This place is already in the trip" | "This place is already in the trip" | Pass | `test_create_list_and_get` |
| TC-28 | Route optimisation | Tap **Optimise** | the 6 valley places | 2 days, 31.3 km in total; "Nearest neighbour gave 38.8 km; 2-opt shortened it to 31.3 km."; markers renumbered, line in visiting order | 2 days, 31.3 km; "Nearest neighbour gave 38.8 km; 2-opt shortened it to 31.3 km."; markers renumbered per day | Pass | `test_demo_trip_two_days` |
| TC-29 | Trip planner | Remove a stop after optimising | — | Plan disappears; "Optimise" button shown again | Day plan gone, Optimise shown again | Pass | `test_adding_or_removing_a_stop_clears_the_plan` |
| TC-30 | Trip planner | Delete the trip | — | Confirmation, then the trip is gone from the list | "Delete this trip?", then "No trips yet" | Pass | `test_rename_and_delete` |
| TC-31 | Offline | Turn off Wi-Fi/data, pull to refresh | — | Friendly "no internet" message; lists already loaded stay; **Try again** where nothing is loaded yet | First run: the error replaced loaded lists, showed the server address and Try again skipped Recommended (BUG-13). Re-test after the fix: loaded recommendations and treks stay with "No internet connection. Check Wi-Fi or mobile data and try again." above them; a category not loaded yet shows the message + Try again; back online, one tap loads it. The address shows only in development builds | Pass | |
| TC-32 | Admin login | Admin panel → log in with a traveller account | traveller email | "This account is not an admin" | "This account is not an admin." | Pass | `test_admin_routes_need_admin` |
| TC-33 | Admin dashboard | Log in as admin | — | Counts + bar chart of predictions per level (matches TC-21/22) | Counts (Users 6, Places 69, Treks 8, Trips 4, Reviews 1, Predictions 11); bars Easy 2 / Moderate 2 / Hard 6 / Risky 1 | Pass | `test_stats` |
| TC-34 | Admin places | Places → New place, fill English + नेपाली, click the map, save, upload a photo | "Test Viewpoint", JPEG < 5 MB | Saved; photo shows; the place appears in the app (pull to refresh) and in search | Saved in English and Nepali, map click set the position, photo uploaded; the app shows the place with its photo and search finds it | Pass | `test_place_crud_appears_in_app_and_search`, `test_photo_upload_and_delete` |
| TC-35 | Admin places | Upload a wrong file type | a PDF | "Upload a JPEG, PNG or WebP image" | "Upload a JPEG, PNG or WebP image" | Pass | `test_photo_upload_and_delete` |
| TC-36 | Admin places | Delete a place that a trek uses | Namche Bazaar | Refused with a message; nothing deleted | "This place is used in a trek itinerary: edit the trek first"; nothing deleted | Pass | `test_place_used_by_a_trek_cannot_be_deleted` |
| TC-37 | Admin treks | EBC → remove the two rest days → save | — | Days = 9; in the app the itinerary now shows **Add rest** warnings | "Days: 9 · 114 km"; app: Rest days 0 and "Add rest days: Tengboche before day 4, Dingboche before day 5". EBC restored afterwards | Pass | `test_edit_trek_stages_updates_itinerary_and_acclimatisation` |
| TC-38 | Admin users | Users → Block the traveller | traveller account | In the app: the next request logs the traveller out; logging in again shows "This account has been blocked. Contact the Bato team." | App logged out on the next request; login shows "This account has been blocked. Contact the Bato team." | Pass | `test_block_user` |
| TC-39 | Admin users | Unblock the traveller | — | The traveller can log in again | Logged in again | Pass | `test_block_user` |
| TC-40 | Admin language | Switch the panel to नेपाली | — | Menus, labels and buttons are in Nepali | Menus, headings and buttons in Nepali. First run: role, sign-in type and dates stayed English (BUG-09); re-test: "यात्री · इमेल · १९ नोभेम्बर २०२६" | Pass | |

### Version 2 Phase 2 (personalisation & community)

| ID | Feature | Steps | Input | Expected result | Actual result | Pass/Fail | Auto |
|---|---|---|---|---|---|---|---|
| TC-41 | Recommended | Profile → interests Culture + Religious → Explore | — | "Recommended for you": temples / heritage first, each card says why ("Because you like…") | Lumbini, Janaki Temple, World Peace Pagoda, Manakamana, Boudhanath … "Because you like religious places" | Pass | `test_culture_user_gets_temples_before_lakes` |
| TC-42 | Recommended | Change interests to Nature + Adventure → pull Explore down | — | Lakes, viewpoints and treks come first | Treks first (ABC, Annapurna Circuit, Gosaikunda …) "Because you like adventure" | Pass | `test_nature_user_gets_the_opposite`, `test_changing_interests_changes_the_list` |
| TC-43 | Recommended | New account with no interests → Explore | — | "Popular now" instead | "Popular now" with "Often added to trips" | Pass | `test_new_user_gets_popular_now` |
| TC-44 | Reviews | Poon Hill → Write a review → post; then post again with other stars | 4★ "Great sunrise", then 5★ | Shows at once as "Your review"; the second post updates it (still one review) | 4★ shown at once as "Your review"; 5★ updated it, still one review (text "Lovely sunset view": typing r twice reloads a dev build) | Pass | `test_post_review_appears_with_your_name`, `test_posting_twice_updates_instead_of_duplicating` |
| TC-45 | Reviews | Admin panel → Reviews → Hide the review | — | Gone from the app's list and the count; the author sees it marked hidden | Hidden at once in the API; the author sees "An admin has hidden this review". First run: the app showed the old count until restarted (BUG-12); re-test: pull down on the place screen reloads it | Pass | `test_hidden_review_is_not_counted_and_not_listed` |
| TC-46 | Reviews | Delete your own review (bin icon) | — | Removed; count goes down | "Delete your review?" → removed, count 1 → "No reviews yet" | Pass | `test_you_cannot_delete_someone_elses_review` |
| TC-47 | Near me | Explore → Near me → allow location (Thamel) | 27.7154, 85.3123 | Closest first with "x km away"; Kathmandu Durbar Square ≈ 1.3 km | Emulator GPS mock never reached the app ("Could not get your location" + Try again). Same API request from Thamel: Kathmandu Durbar Square 1.3 km first. Phone 2 with real GPS (2026-11-23): closest places first with km away | Pass (Phone 2) | `test_near_me_from_thamel` |
| TC-48 | Near me | Deny the location permission | Deny | "Turn on location to see places near you" + Try again / Open settings | "Turn on location to see places near you." + Try again; after "don't ask again" + Open settings | Pass | |
| TC-49 | Budget | Valley trip → Optimise → Estimate budget; change budget level → estimate again | Medium → High | Food, stay, transport and entry-fee lines, total in NPR, "Estimate only"; the total goes up | Medium: food, stay, transport, 5 entry fees, total NPR 20,678, "Estimate only"; High: NPR 41,530 | Pass | `test_valley_trip_budget_by_hand`, `test_budget_level_changes_the_total` |
| TC-50 | Budget | EBC → Budget card with nationality Foreign / SAARC / Nepali | profile nationality | Permits: foreign > SAARC > Nepali | Permits Foreign 6,000 (KPLRM + SNP), SAARC 1,500, Nepali 100; totals 190,000 / 185,500 / 184,100 | Pass | `test_ebc_permits_by_nationality` |
| TC-51 | Share | Valley → Share trip → open the link in a private browser window; then Stop sharing and reload | — | Read-only page with the stops and day plan, no name or email; after stopping → "does not work any more" (404) | Read-only page (6 places · 2 days · 31.3 km), no name or email; after stopping: 404. First run: the 404 was raw JSON (BUG-10); re-test: a page "This link does not work any more" / "यो लिङ्क अब चल्दैन", still 404 | Pass | `test_share_link_works_without_login`, `test_stop_sharing_and_bad_tokens_give_404` |
| TC-52 | Teahouses | EBC → itinerary → day 4 → Teahouses (4) | — | 4 lodges in Tengboche; Nepali names in नेपाली | 4 lodges (Tashi Delek Lodge, Tengboche Guest House, The Happy House, Trekkers Lodge); Nepali names in नेपाली. Stage notes stay English: no Nepali notes in the data yet (task V1-P3-19) | Pass | `test_itinerary_day_4_shows_teahouse_count`, `test_teahouses_in_tengboche` |

### Version 2 Phase 1 (smart trek features)

Run on 2026-11-19 on the same emulator (Phone 1), mostly in नेपाली. Screenshots `docs/screenshots/V2P1-*.png`.

| TC | Feature | Steps | Test data | Expected result | Actual result | Pass/Fail | Automated test |
|---|---|---|---|---|---|---|---|
| TC-53 | Altitude chart | EBC → Day-by-day itinerary → chart above the days; tap day 4 | — | Line from Lukla (2,860 m) up to Kala Patthar (5,644 m); rest days flat; big-climb days orange; tap shows the day, place and altitude | Highest point 5,644 m on day 9 (selected by default); days 3 and 6 flat; days 2, 5 and 7 orange; tap day 4 → "दिन ४ · तेङबोचे · ३,८६० मि. · २८ कि.मि." | Pass | `test_ebc_profile_tops_out_at_kala_patthar`, `test_rest_day_adds_no_km_and_stays_flat`, `test_profile_colours_match_the_acclimatisation_check` |
| TC-54 | Safer alternatives | Profile medium fitness, no multi-day experience → EBC → Check my risk → January | January | Risky; below the reasons, 1–3 similar treks the model rates lower, each with why; tap one opens it | Risky. Annapurna Circuit (Hard, fewer days 11 → 8) and Annapurna Base Camp (Hard, lower altitude 5,644 → 4,130 m); tap opens the trek | Pass | `test_beginner_ebc_january_gets_only_lower_rated_treks` |
| TC-55 | Safer alternatives | Expert profile → Poon Hill → Check my risk → October | October | No "Safer alternatives" box (nothing is rated lower) | Easy, no box | Pass | `test_expert_poon_hill_october_gets_nothing` |
| TC-56 | Weather | EBC page and Boudhanath page → 7-day forecast; tap a day; open again within the hour | — | 7 days with icon, max/min °C; EBC uses its highest sleeping place; tapping a day reads it in words; second request `X-Cache: HIT` | EBC: "Weather at Gorak Shep", 7 days (−4°/−17° today); Sun → "Sun: Fog, high -5°, low -19°"; Boudhanath: Kathmandu 22°/10°. Live API: MISS then HIT, TTL 3,600 s, stale copy 86,400 s. Nepali weekdays and digits OK | Pass | `test_second_call_within_the_ttl_is_a_cache_hit`, `test_stale_copy_when_open_meteo_fails`, `test_weather_still_works_when_redis_is_down` |
| TC-57 | Packing list | EBC → Packing list → January; then Poon Hill → October | January / October | EBC: down jacket, microspikes, −10 °C sleeping bag, each with why; permits KPLRM + SNP. Poon Hill: a much shorter list without them | EBC January: 32 items in 4 groups ("४,००० मि. भन्दा माथि जाने भएकाले" next to the down jacket; KPLRM and SNP under documents). Poon Hill October: 20 items, no down jacket or microspikes (checked through the API). Same screen in English also checked: reasons "You go above 4,000 m", "Winter, above 3,500 m", "Trek of 5 days or more", "Required for this trek" (`V2P1-packing-ebc-en.png`) | Pass | `test_ebc_in_january_has_cold_weather_gear`, `test_poon_hill_in_october_is_a_much_shorter_list`, `test_permit_items_match_the_trek_permits` |
| TC-58 | Packing list | Tick items → close the app fully → reopen the same trek and month; tap Clear ticks | — | Ticks are still there (saved on the phone, per trek and month); Clear ticks empties them | After a force-stop: January still "३२ मध्ये ४ तयार", November kept its own tick; Clear ticks → 0. First run: the Clear ticks label showed only "चिनो" (BUG-15); re-test: full label | Pass | (phone only: AsyncStorage) |

### Login and register forms (V2-UI-02)

Run on 2026-11-23 on the emulator (Phone 1, also resized to Phone 2's 720 × 1600 at 320 dpi), in नेपाली,
then checked by hand on Phone 2. Added after BUG-17: on Android the keyboard covered the login form.

| TC | Feature | Steps | Test data | Expected result | Actual result | Pass/Fail | Automated test |
|---|---|---|---|---|---|---|---|
| TC-59 | Login keyboard | Welcome → Log in → tap Email, type, press Next; type the password | test@example.com, any password | The login sheet moves above the keyboard: both fields and the Log in button stay visible; Next moves to Password | Sheet sits above the keyboard at both screen sizes; Next moves to Password; the sheet follows when the keyboard gets taller. Before the fix the keyboard covered the whole sheet (BUG-17). Phone 2: works | Pass | (phone only: keyboard) |
| TC-60 | Show password | On the login sheet and on Create account, type a password, tap the eye, then tap it again | `secret123` | First tap shows the password and the icon changes to a crossed eye; second tap hides it; the keyboard stays open | Shows "secret123" with a crossed eye, button label "पासवर्ड लुकाउनुहोस्"; second tap hides it; keyboard stays open. Phone 2: works | Pass | (phone only) |
| TC-61 | Register keyboard | Create account → tap Full name, type, Next, type the email, Next; scroll with the keyboard open | Test User, test@example.com | Every field shows a placeholder (EN and NE); Next moves Full name → Email → Password; with the keyboard open the page scrolls to the Create account button | Placeholders "जस्तै: पेम्बा शेर्पा", "you@example.com", "पासवर्ड बनाउनुहोस्"; Next moves through every field; at 720 × 1600 the page scrolls to the error text and the button above the keyboard. Phone 2: works | Pass | (phone only: keyboard) |

### Search and recommendations (V2-SR)

Run on 2026-11-23 on the emulator (Phone 1) in English, with a new account whose profile is complete
and whose interests are culture + religious. Plan: [search-recommendation.md](../product/search-recommendation.md).

| TC | Feature | Steps | Test data | Expected result | Actual result | Pass/Fail | Automated test |
|---|---|---|---|---|---|---|---|
| TC-62 | Search: Nepali in English letters | Search tab → Places → type the query | `pashupati mandir` | Pashupatinath Temple is found; the hint shows the Nepali name that matched | "1 place found", Pashupatinath Temple, "Temples & Stupas · Kathmandu"; hint "Closest spelling match: पशुपतिनाथ मन्दिर" | Pass | `test_benchmark_cases_pass` (Romanised Nepali and Devanagari groups) |
| TC-63 | Search: village and district | Treks tab → `namche`; Places tab → `bhaktapur` | `namche`, `bhaktapur` | EBC Trek with "Passes through Namche Bazaar"; the places in Bhaktapur district, Bhaktapur Durbar Square first | "Everest Base Camp Trek · Khumbu · 11 days · Passes through Namche Bazaar"; Bhaktapur Durbar Square, Changu Narayan, Nagarkot, then Kathmandu Durbar Square (alias "Basantapur" is two letters from "bhaktapur": a known fuzzy match) | Pass | `test_search_village_finds_trek_with_via`, `test_search_district_lists_its_places` |
| TC-64 | Not interested + Undo | Explore → × on the first "Recommended for you" card → Undo | first card | The card goes at once; a bar "… hidden. We will show fewer places like it." with Undo; Undo brings it back; the bar goes after 6 s | Pashupatinath went and did not come back after a reload; Bhaktapur Durbar Square: bar shown, Undo brought it back first in the row | Pass | `test_not_interested_and_undo`, `test_hiding_temples_pushes_them_down` |
| TC-65 | Variety and place tags | Explore → look at the first two cards → open Bhaktapur Durbar Square | culture + religious user | Not all temples at the top; the place page shows its tags with icons | Pashupatinath Temple (temple) then Bhaktapur Durbar Square (heritage); chips "UNESCO World Heritage", "Architecture", "Local culture", "Good for families" | Pass | `test_top_five_is_not_all_one_kind`, `test_place_tags_in_detail_and_admin` |
| TC-66 | Admin tags; Nepali labels | Admin → Places → edit a place → Tags; app in नेपाली: Explore reasons, place tags, search "via" line | Phewa Lake | Tags can be added and removed and show in the app; every new label is in Nepali | | Not run | `test_place_tags_in_detail_and_admin` |
| TC-67 | Search by city and trek region | Search → Places → `pokhara`, open Sarangkot; Places → `kathmandu valley`; Treks → `khumbu` | `pokhara`, `kathmandu valley`, `khumbu` | Pokhara: Phewa Lake, Sarangkot and World Peace Pagoda, each "… · Pokhara"; place page "Pokhara, Kaski, Gandaki"; Kathmandu Valley: all 8 valley sights, Patan and Bhaktapur included; Khumbu: Everest Base Camp Trek | "3 places found", "Lakes · Pokhara", "Viewpoints · Pokhara", "Temples & Stupas · Pokhara"; Sarangkot "Pokhara, Kaski, Gandaki"; "8 places found" from Bhaktapur Durbar Square to Swayambhunath Stupa, each "· Kathmandu Valley"; "1 trek found", Everest Base Camp Trek "Khumbu · 11 days" | Pass | `test_city_search_lists_every_place_in_it`, `test_trek_region_finds_its_treks`, `test_areas_lookup_filter_and_detail` |

### Safety: emergency contacts, SOS, symptom checker (V2 Phase 3 Core)

Added on 2026-11-24, **not run yet**. Run them on a real phone with a SIM card (the emulator has no SMS
app or real GPS). Plan: [phase3.md](../plans/version2/phase3.md).

**Use test mode.** Put two phones you own in `mobile/.env` as
`EXPO_PUBLIC_SAFETY_TEST_NUMBERS=98XXXXXXXX,98XXXXXXXX` and restart Metro (`npx expo start -c`). The
safety screens then show a yellow **TEST MODE** banner, and Police, Tourist Police, Ambulance, Fire and
the SOS fallback call those numbers instead of the real services. Save the same two phones as your
emergency contacts. Never test SOS with the real 100 / 1144 / 102 / 101. A development build made
before 2026-11-24 has no `expo-sms`: the SMS app still opens (through an `sms:` link), but rebuild with
`npx expo run:android` to test the real path.

| TC | Feature | Steps | Test data | Expected result | Actual result | Pass/Fail | Automated test |
|---|---|---|---|---|---|---|---|
| TC-68 | Emergency contacts: add, edit, delete | Settings → Safety → Emergency contacts → add a contact; tap it, change the relation, save; add a second one; delete it with the bin icon → Delete | "Test phone 1", test number 1 typed as `98XXXXXXXX`, relation "Friend" | The contact shows with `+97798XXXXXXXX`; the edit is saved; the second one goes after the confirm; the list is the same after closing and reopening the app | | Not run | `test_contact_crud_and_phone_normalised`, `test_a_user_only_sees_their_own_contacts` |
| TC-69 | Emergency contacts: wrong input | Save with an empty phone; save with phone `12ab`; add contacts until there are 5 | `12ab` | "Enter a name and a phone number."; "Enter a phone number like 98XXXXXXXX or +977…"; with 5 contacts the form is replaced by "You can save up to 5 contacts." | | Not run | `test_bad_phone_is_422_with_a_message`, `test_sixth_contact_is_refused` |
| TC-70 | Fixed emergency numbers (test mode) | Emergency contacts → scroll to Emergency numbers → tap Tourist Police | test mode on | Yellow TEST MODE banner; Police, Tourist Police, Ambulance, Fire listed with their names; the dialler opens on a **test number**, not 1144 | | Not run | `test_app_copy_of_emergency_numbers_matches_the_csv` |
| TC-71 | SOS: hold for 2 seconds | Settings → SOS & emergency numbers → tap SOS quickly; then hold it for 2 s | 1 contact, outdoors, location on | A quick tap does nothing; while holding, the ring fills and the phone vibrates; after 2 s the SMS app opens to the contact with "SOS from <name> (Bato app): I need help. My location: 27.7…, 85.3… (accuracy … m) https://maps.google.com/?q=… · <date time>"; press Send → the test phone gets it and the link opens the map | | Not run | `test_sos_is_saved_once_with_the_user` |
| TC-72 | SOS with mobile data off | Turn off mobile data and Wi-Fi → hold SOS → send the SMS; turn the internet back on and open the app; admin → Dashboard | 1 contact | The SMS app still opens with the location and the SMS is delivered (over the phone network); after going online the admin dashboard's **SOS events** count is 1 higher | | Not run | `test_sos_is_saved_once_with_the_user`, `test_admin_stats_count_sos_and_symptom_checks` |
| TC-73 | SOS with no contacts | Delete all contacts → SOS screen → hold SOS | no contacts, test mode on | The dialler opens on test number 1 (test mode gives Tourist Police and Ambulance the first number, Police and Fire the second); the screen says Bato opened a call to the Tourist Police with that number | | Not run | – |
| TC-74 | Symptom checker: the three demo results | Trek → EBC → Itinerary → How do you feel? → answer → See my result; Check again for each row; on the result "Descend now", tap SOS | (a) 2,1,1,0 at Namche; (b) 3,2,3,2; (c) all 0 + "Confusion or unsteady walking" | (a) **Rest: don't go higher today**, score 4, mild; (b) **Descend now and get help**, score 10, severe, with an SOS button; (c) Descend now, with the confusion reason. Leaving a question out shows "Answer all four questions first." | | Not run | `test_lake_louise_shared_cases`, `test_symptom_check_is_scored_by_the_server` |
| TC-75 | Symptom check offline + history | Mobile data and Wi-Fi off → do a check → Settings → My symptom checks; back online → pull down to refresh; admin → Dashboard | 2,1,1,0, altitude from a stop | Offline: the result shows at once, "Saved on this phone. It will be sent when you are online."; the history says "1 check is waiting to be sent."; online: the check is in the history with the trek, the altitude and its real time; the dashboard's **Symptom checks** count is 1 higher | | Not run | `test_symptom_history_is_own_and_newest_first`, `test_admin_stats_count_sos_and_symptom_checks` |
| TC-76 | Safety screens in Nepali | Settings → भाषा: नेपाली → open the safety screens; hold SOS | – | Every safety screen has the disclaimer in Nepali; the questions and results are in Nepali with no cut-off words; the SMS is in Nepali, but the coordinates, link and time use Latin digits so the link works | | Not run | – |
| TC-77 | Health questions (V2-PROF-01) | Settings → profile → Health: answer High blood pressure = Yes, the others No → Save → reopen the profile; then Check my risk on EBC; then switch to नेपाली and open the profile again | Yes / No / Prefer not to say on 5 questions | The Health section shows 5 questions (heart, asthma, high blood pressure, significant anemia, recent injury); the answers come back after reopening; the risk check lists "A health condition or recent injury you reported" under "Why this rating?"; in Nepali all 5 questions and the reason are in Nepali with no cut-off words | | Not run | `test_profile_save_and_load`, `test_new_health_questions_feed_the_model` |

## Bugs found and fixed

Write the bugs you find while running the table here (ID, what happened, fix). Examples from
development:

| Bug | Cause | Fix |
|---|---|---|
| Map showed "Unable to parse resourceUrl" | The map style had no fonts (glyphs) URL for the text labels | Added OpenFreeMap glyphs to `mobile/src/lib/mapStyle.ts` |
| Same training data gave a different model each run | Rows were read in random-UUID order | Stable row ids in the seed |
| Creating a trek from the admin panel failed (NOT NULL) | The trek was saved before its totals were worked out | Compute totals from the stages first, then save |
| 2-opt sometimes more than 15% worse than the exact answer | 2-opt is a heuristic: it finds a local, not global, best | Test the *average* gap instead (see `route_gap.md`) |

### Found in the manual test run (2026-11-19)

The same bugs are in the tracker's **Bugs** tab, with severity, status and the full fix. A bug is
*fixed* when the same test case was run again and passed.

| Bug | Case | What happened | Cause | Severity / status |
|---|---|---|---|---|
| BUG-06 | TC-01 | In नेपाली many labels lose their last word (buttons, chips, headings) | The text box is a fraction of a pixel narrower than the shaped Devanagari text, and Android's line breaker moves the last word to a hidden second line (Latin text is never broken this way). React Native measures the text, Yoga rounds the box to whole pixels, and Android draws it again; for Devanagari the drawing can need a few pixels more, most of all after a language switch or when a label mounts later. **First fix** (2026-11-19): a tiny no-break space (U+202F) after Devanagari text; it gave no slack, because a no-break space sticks to the last word. On Phone 2 the welcome screen's Google and Create account buttons were still cut. **Second fix** (2026-11-23): `AppText` ends Devanagari text on Android with a plain 12 sp space, which counts in the measured width but may hang past the edge (about 8 px of slack) | High / fixed again; passes on the emulator after a language switch, re-test on Phone 2 |
| BUG-07 | TC-03 | Short password shows the server's raw English 422 text, also in Nepali | No length check in the app; `errorMessage()` shows FastAPI's message as it is. **Fix:** the register screen checks 8+ characters first; `errorMessage()` turns 422 lists into "invalid input" and maps known server messages to EN/NE text | Low / fixed |
| BUG-08 | TC-02 | After registering, "Skip for now" opens the profile form again | The tabs layout mounts fresh and pushes `/profile` again while `has_profile` is false. **Fix:** the "asked once" flag lives in `lib/profilePrompt.ts` per user for the app session | Medium / fixed |
| BUG-09 | TC-01, 11, 40, 52 | Region, district, stage notes and admin user values stay English in Nepali | Plain text columns with no Nepali translation; no Nepali stage notes in the data. **Fix:** Nepali names for regions, provinces and districts in `ne.json`; admin translates role and sign-in type and writes Nepali dates. Stage notes stay English until Nepali notes are added to the seed data (per-field fallback) | Low / fixed (Nepali stage notes: task V1-P3-19) |
| BUG-10 | TC-51 | Stopped share link shows raw JSON instead of a page | The HTML route raises the same JSON 404 as the API. **Fix:** `/s/<token>` returns a "This link does not work any more" page (EN/NE), still status 404 | Low / fixed |
| BUG-11 | TC-25 | First tap on a bottom-sheet button only closes the keyboard | The sheets are Modals inside the place / trek screen's `ScrollView`, which had the default `keyboardShouldPersistTaps`. **Fix:** `"handled"` on both screens | Low / fixed |
| BUG-12 | TC-45 | A hidden review still counts in the app until restart | 5-minute query cache and no pull-to-refresh on the place screen. **Fix:** pull-to-refresh on place and trek screens reloads the item, its reviews and the trek budget | Low / fixed |
| BUG-13 | TC-31 | Offline message shows the server address; loaded lists are hidden; Try again misses Recommended | Error text appends the API URL; error state replaces cached data. **Fix:** address shown only in development builds; loaded data stays with a short note above it; Try again refreshes all of Explore | Low / fixed |
| BUG-14 | TC-01 (found while fixing BUG-06) | After switching language in Settings, trek cards keep "8 days" / "4,130 m" in the old language until restart | The React Compiler caches `days()`, `km()` etc. by their arguments; `lib/format` reads the language from i18n, which the compiler cannot see. **Fix:** files that import `lib/format` opt out with `'use no memo'` | Medium / fixed |
| BUG-15 | TC-58 | The Packing list's "चिनो हटाउनुहोस्" (Clear ticks) button showed only "चिनो" | The button appeared only after the first tick. On Android a Nepali button label that mounts after the screen has loaded loses its last word (the BUG-06 line-break issue), even at full width. **Fix:** the button is always there and only disabled while nothing is ticked | Low / fixed; passes on Phone 2 |

### Found on the real phone and after the redesign (2026-11-23)

| Bug | Case | What happened | Cause | Severity / status |
|---|---|---|---|---|
| BUG-16 | — (after the redesign) | The app opened on a red Render Error: "You are passing an array of styles to a child of `<Slot>`" | The redesign gave the `Pressable` inside `<Link asChild>` an array style or a `({ pressed })` style. Link's Slot throws on arrays in development and drops function styles. **Fix:** a new `PressableLink` (Pressable + `router.push`) replaces every `Link asChild` the redesign touched | High / fixed; passes on Phone 2 |
| BUG-17 | TC-59, TC-61 | Reported by the user: tapping a field on the login sheet opened the keyboard over the whole form; on Create account the password field and button could end up under the keyboard | Android apps on Expo SDK 58 are edge-to-edge, so the window no longer shrinks for the keyboard. The login sheet's `KeyboardAvoidingView` had no `behavior` on Android, and the register screen had no keyboard handling. **Fix:** `behavior="padding"` on both platforms (Expo's keyboard-handling guide); new `Screen` prop `avoidKeyboard` used on Create account | High / fixed; passes on Phone 2 |
| BUG-18 | TC-67 | Reported by the user: searching "Kathmandu" showed "0 treks found" and "Nothing found", although 8 places match | The Search screen opens on the Treks tab and showed only that tab; nothing said the Places tab had results. **Fix:** when new results come in and the open tab is empty but the other is not, switch to the other tab (once per result, so tapping the empty tab still works); while searching the tabs show counts ("Places · 8", "Treks · 0") | Medium / fixed; passes on the emulator |
