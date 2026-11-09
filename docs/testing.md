# Testing (for the report's testing chapter)

Two kinds of testing. **Step-by-step order, test counts and how to check each case:** [testing-guide.md](testing-guide.md).

1. **Automated tests**: 129 backend pytest tests (`cd backend && uv run pytest`), plus the TypeScript
   typecheck and lint for the mobile app and the admin panel. All of them run with
   `./scripts/verify.sh`.
2. **Manual test cases**: the table below. Run each case on a real phone (and the admin panel in a
   browser), then fill in **Actual result** and **Pass/Fail**. Test on at least two Android phones
   with different screen sizes, and write the phone models here:

   - Phone 1: ______________________ (screen size ____)
   - Phone 2: ______________________ (screen size ____)

The **Auto** column names the pytest test that checks the same behaviour through the API, where
there is one. The manual case still checks the screen.

Test data: the seed data (`uv run python -m app.seed`), an admin made with
`uv run python -m app.create_admin`, and a traveller account registered in the app.

## Manual test cases

| ID | Feature | Steps | Input | Expected result | Actual result | Pass/Fail | Auto |
|---|---|---|---|---|---|---|---|
| TC-01 | Language | First launch → choose a language | नेपाली | Every screen is in Nepali, with numbers in Devanagari digits | | | |
| TC-02 | Register | Register with email | new email, 8+ char password | Account created; the profile form opens | | | `test_register_login_me` |
| TC-03 | Register | Register with a short password | `abc` | Error message; no account created | | | `test_short_password_rejected` |
| TC-04 | Register | Register an email that is already used | existing email | "Email is already registered" message | | | `test_duplicate_email_rejected` |
| TC-05 | Login | Log out, then log in | correct email + password | Explore tab opens | | | `test_register_login_me` |
| TC-06 | Login | Log in with a wrong password | wrong password | "Incorrect email or password" message | | | `test_wrong_password_fails` |
| TC-07 | Login | Leave the app open > 30 min, then use it | — | Still logged in (token refreshed silently) | | | `test_refresh_token_flow` |
| TC-08 | Profile | Fill in and save the profile, reopen it | DOB, fitness *Medium*, experience *None* | Saved values are shown again | | | `test_profile_save_and_load` |
| TC-09 | Explore | Explore → a category chip | *Temples & Stupas* | Only temples and stupas are listed | | | `test_list_places_by_category_paginated` |
| TC-10 | Place detail | Open a place | Pashupatinath | Photos, best months, entry fee, how to reach, 5 nearby places | | | `test_place_detail` |
| TC-11 | Language fallback | Switch to Nepali → open a place with no Nepali description | Ghorepani | Nepali name, English description | | | `test_partial_nepali_row_falls_back_per_field` |
| TC-12 | Search | Search with a spelling mistake | `punhill` | Poon Hill is found | | | `test_search_fuzzy` |
| TC-13 | Search | Search in Devanagari | `अन्नपूर्ण` | Annapurna treks / places are found | | | `test_search_fuzzy` |
| TC-14 | Search | Search for nonsense | `xqzv` | "No results" message, no crash | | | `test_search_nonsense_returns_nothing` |
| TC-15 | Trek filters | Search → trek filters | Region *Annapurna*, difficulty *Moderate* | ABC and Mardi Himal | | | `test_list_treks_filters` |
| TC-16 | Map | Map tab → tap a marker | any marker | Its detail page opens | | | `test_list_places_bbox_for_map` |
| TC-17 | Map | Map tab → category chip | *Viewpoints* | Only viewpoint markers stay | | | |
| TC-18 | Itinerary | EBC → Day-by-day itinerary | — | 11 day cards; days 3 and 6 are rest days | | | `test_stages_and_summary` |
| TC-19 | Acclimatisation | EBC itinerary | — | Days 2, 5, 7 show **Caution**; summary says it passes | | | `test_standard_ebc_passes_with_cautions` |
| TC-20 | Acclimatisation | ABC itinerary | — | Day 5 shows **Add rest**; suggests a rest day at Deurali | | | `test_acclimatisation_endpoint` |
| TC-21 | Risk | EBC → Check my risk | January; fitness *Medium*, experience *None* | **Risky**, confidence, up to 3 reasons | | | `test_beginner_ebc_january_riskier_than_expert_poon_hill_october` |
| TC-22 | Risk | Change profile → EBC → Check my risk | October; fitness *High*, *Experienced* | **Hard**, with different reasons | | | same as above |
| TC-23 | Risk | New account, skip the profile → Check my risk | — | Asked to complete the profile first | | | `test_predict_needs_complete_profile` |
| TC-24 | Risk history | Settings → My risk checks | — | Both checks, newest first | | | |
| TC-25 | Trip planner | Place detail → Add to My Trip → new trip | Pashupatinath Temple, title "Valley" | "Pashupatinath Temple added to “Valley”."; trip appears in Trips tab | | | `test_create_list_and_get` |
| TC-26 | Trip planner | Add 5 more places to the same trip | Boudhanath, Swayambhunath, Patan Durbar Sq., Bhaktapur, Nagarkot | Trip shows 6 stops and numbered markers on the map | | | |
| TC-27 | Trip planner | Add the same place twice | Pashupatinath again | "This place is already in the trip" | | | `test_create_list_and_get` |
| TC-28 | Route optimisation | Tap **Optimise** | the 6 valley places | 2 days, 31.3 km in total; "Nearest neighbour gave 38.8 km; 2-opt shortened it to 31.3 km."; markers renumbered, line in visiting order | | | `test_demo_trip_two_days` |
| TC-29 | Trip planner | Remove a stop after optimising | — | Plan disappears; "Optimise" button shown again | | | `test_adding_or_removing_a_stop_clears_the_plan` |
| TC-30 | Trip planner | Delete the trip | — | Confirmation, then the trip is gone from the list | | | `test_rename_and_delete` |
| TC-31 | Offline | Turn off Wi-Fi/data, pull to refresh | — | Friendly "no internet" message with **Try again** | | | |
| TC-32 | Admin login | Admin panel → log in with a traveller account | traveller email | "This account is not an admin" | | | `test_admin_routes_need_admin` |
| TC-33 | Admin dashboard | Log in as admin | — | Counts + bar chart of predictions per level (matches TC-21/22) | | | `test_stats` |
| TC-34 | Admin places | Places → New place, fill English + नेपाली, click the map, save, upload a photo | "Test Viewpoint", JPEG < 5 MB | Saved; photo shows; the place appears in the app (pull to refresh) and in search | | | `test_place_crud_appears_in_app_and_search`, `test_photo_upload_and_delete` |
| TC-35 | Admin places | Upload a wrong file type | a PDF | "Upload a JPEG, PNG or WebP image" | | | `test_photo_upload_and_delete` |
| TC-36 | Admin places | Delete a place that a trek uses | Namche Bazaar | Refused with a message; nothing deleted | | | `test_place_used_by_a_trek_cannot_be_deleted` |
| TC-37 | Admin treks | EBC → remove the two rest days → save | — | Days = 9; in the app the itinerary now shows **Add rest** warnings | | | `test_edit_trek_stages_updates_itinerary_and_acclimatisation` |
| TC-38 | Admin users | Users → Block the traveller | traveller account | In the app: the next request logs the traveller out; logging in again shows "This account has been blocked. Contact the Bato team." | | | `test_block_user` |
| TC-39 | Admin users | Unblock the traveller | — | The traveller can log in again | | | `test_block_user` |
| TC-40 | Admin language | Switch the panel to नेपाली | — | Menus, labels and buttons are in Nepali | | | |

## Bugs found and fixed

Write the bugs you find while running the table here (ID, what happened, fix). Examples from
development:

| Bug | Cause | Fix |
|---|---|---|
| Map showed "Unable to parse resourceUrl" | The map style had no fonts (glyphs) URL for the text labels | Added OpenFreeMap glyphs to `mobile/src/lib/mapStyle.ts` |
| Same training data gave a different model each run | Rows were read in random-UUID order | Stable row ids in the seed |
| Creating a trek from the admin panel failed (NOT NULL) | The trek was saved before its totals were worked out | Compute totals from the stages first, then save |
| 2-opt sometimes more than 15% worse than the exact answer | 2-opt is a heuristic: it finds a local, not global, best | Test the *average* gap instead (see `route_gap.md`) |
