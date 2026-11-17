# Seed data

Loaded by `cd backend && uv run python -m app.seed` (safe to re-run; IDs are stable UUIDv5 values
derived from the slugs/codes, so updates happen in place).

| File | Rows | Contents |
|---|---|---|
| `categories.csv` | 6 | code, MaterialCommunityIcons icon name, English + Nepali name |
| `interests.csv` | 4 | nature, culture, adventure, religious |
| `places.csv` | 69 | 17 sights + 52 trek villages/viewpoints: coordinates, altitude, district, province, entry fees for foreigners / SAARC / Nepalis (`entry_fee_npr`, `entry_fee_saarc_npr`, `entry_fee_nepali_npr`; empty or 0 = free), English text; Nepali names for all, Nepali description for the 10 key places |
| `aliases.csv` | 70 | other spellings and Devanagari names used by search ("Poonhill", "Gosainkund", "अन्नपूर्ण"…) |
| `treks.json` | 8 | Poon Hill, ABC, EBC, Langtang, Mardi Himal, Annapurna Circuit, Gosaikunda, Manaslu: day-by-day stages (from → to place, km, walking hours, highest point on the way), permits, EN/NE name and overview |
| `permits.csv` | 7 | TIMS, ACAP, SNP, KPLRM, LNP, MCAP, MRAP with Nepali/SAARC/foreign fees |
| `budget_rates.csv` | 18 | **V2 Phase 2.** Per-person daily food and stay cost per budget level (low/medium/high) for `city` trips and each trek region (+ `other`), city transport per km, and the Kathmandu ↔ trailhead return trip for treks. See "Budget rates" below |
| `teahouses.csv` | 4 | **V2 Phase 2.** Real lodges in Tengboche, each with its **source**. No phone numbers (none found in a source we can name) |
| `photos.csv` | 36 | Wikimedia Commons photos with **author, licence and source page** (for the report) |
| `climate_baseline.csv`, `climate_regions.csv` | | inputs to the approximate climate model below |
| `training_samples.csv` | 592 | risk-model training rows (Phase 2): 32 `agency` + 560 `rule` (+ `survey` rows when added). **Generated** by `cd backend && uv run python -m app.ml.dataset [--survey form.csv]`, don't edit by hand; the labelling rules are in `backend/app/ml/dataset.py` |

Trek totals (days, distance, max altitude) are computed from the stages, not typed in.
A rest/acclimatisation day is a stage whose `from` and `to` are the same place.

## ⚠️ Check before the report / demo
The text, coordinates, altitudes, walking times and fees were drafted from general knowledge of
standard published itineraries. They are realistic, but **verify them** against current sources
(Nepal Tourism Board, ACAP/NTNC, DNPWC, park offices, recent trekking-agency itineraries) — fees in
particular change often, and MRAP is charged in USD. Record your sources in the report.

All Nepali text is marked `is_machine_translated = true, is_reviewed = false` in the database: read it
and correct it (especially anything about safety) before marking it reviewed.

## Data check (2026-11-17)
Done with Claude; tracker task V1-P3-17.

**Coordinates:** every place was compared with OpenStreetMap (Nominatim search, 2026-11-17).
All 17 sights matched within 0.6 km. 18 trek villages were off by 1.5-14 km and were moved to their
OpenStreetMap village point: Nayapul (10.6 km off), Machha Khola (11.0), Forest Camp, Low Camp,
High Camp and Siding (the whole Mardi Himal route was ~7 km too far south), Tikhedhunga (5.8),
Deurali, Namrung, Thorong Phedi, Bimthang, Chandanbari, Dharamsala (Larke Phedi), Jagat, Kande,
Yak Kharka, Samdo and Laurebina. A check now confirms every stage's trail length is longer than the straight
line between its two villages.

**Stage distances changed** (`treks.json`):
| Stage | Was | Now | Source |
|---|---|---|---|
| Kande → Forest Camp (Mardi) | 10 km, 6 h | 14 km, 7 h | himalayatrip.com, epictreknepal.com, excellenttrek.com (14–15 km) |
| Bamboo → Deurali (ABC) | 7 km | 9 km | nepalhikingteam.com, himalayanvista.com, excellenttrek.com (7–12 km, most 8–10) |
| Jhinu Danda → Nayapul (ABC) | 12 km, 5 h | 16 km, 6 h | **Estimate**: no source gives this leg; straight line is 11.4 km |
Samagaun → Samdo (8 km) was confirmed by several Manaslu guides and kept.

**Permit fees** (`permits.csv`): all 7 match current sources; none changed.
- ACAP 3,000 / SAARC 1,000 / Nepali 100: official NTNC e-permit site (epermit.ntnc.org.np) + Kathmandu Post (2018) for the Nepali fee.
- TIMS 2,000 / SAARC 1,000; Sagarmatha NP 3,000 (excl. 13% VAT); KPLRM 3,000 (raised from 2,000 in 2024); LNP, MCAP 3,000: followalice.com and other 2026 agency guides.
- MRAP: USD 100 for the first 7 days in Sep–Nov, then USD 15/day; USD 75 + 10/day in Dec–Aug (nepalhikingteam.com 2026). The two-trekker minimum is reported dropped on 2026-03-22 (not confirmed officially); the description now says to confirm with the agency.
- No official government page was found for TIMS, KPLRM, LNP, MCAP or MRAP: agency guides only.

**Still to confirm by a person** (ticket counter, phone call or official notice):
- Lumbini (Maya Devi Temple): Ekantipur (2026-05-17) reports a fee increase of up to 75% for foreigners and 43% for SAARC; new amounts not published. Ours (500 / 200) is probably out of date.
- Changu Narayan: most guides say 300 / 100; Nepal News (July 2025) says 400 / 300.
- Altitudes and walking hours were not checked one by one; they agree with the usual itineraries.

## Entry fees by nationality (V2 Phase 2, checked 2026-11-09)
Foreign fees were already in `places.csv`; the SAARC and Nepali columns were added from these
sources. Several sources disagree, so **check them at the ticket counter or with NTB before the report**:

| Place | Foreign | SAARC | Nepali | Source |
|---|---|---|---|---|
| Kathmandu Durbar Square | 1,000 | 150 | free | NTB "Heritage site entry fees" (ntb.gov.np/plan-your-trip/before-you-come/heritage-site-entry-fees); nepaltraveller.com Basantapur guide (2025). One account lists SAARC/BIMSTEC at 500 |
| Patan Durbar Square | 1,000 | 250 | free | NTB page above; onlinekhabar.com "fees kathmandu heritage sites" |
| Bhaktapur Durbar Square | 1,800 | 500 | free | bhaktapur.com "Entry fees of the heritage sites in Nepal"; Bhaktapur municipality notice (SAARC 500 from Shrawan 1, 2080). Some sources give 1,500 for foreigners |
| Boudhanath | 400 | 100 | free | NTB page above |
| Swayambhunath | 200 | 50 | free | NTB page above |
| Pashupatinath | 1,000 | free | free | NTB page above (Indian and Nepali visitors free); **SAARC: unclear**, one blog says free |
| Changu Narayan | 300 | 100 | free | ghalegroup.com "Nepal attractions fees & timings" — **not confirmed by a second source** |
| Lumbini (Maya Devi Temple) | 500 | 200 | free | **Not confirmed by a source**: check with the Lumbini Development Trust |
| Chitwan National Park | 2,000 | 1,000 | 150 | chitwannationalpark.gov.np/index.php/regulation; Onlinekhabar (2026) |
| Bardiya National Park | 1,500 | 750 | 100 | thelongestwayhome.com "List of National Park Entry fees" (an older NTB PDF gives 1,000 / 500 / 50) |
| Rara National Park | 3,000 | 1,500 | 100 | thelongestwayhome.com (above). One 2025 guide says Nepali free and adds 13% VAT for foreigners |

Some aggregator sites quote foreign fees including 13% VAT; ours do not.

## Budget rates (V2 Phase 2): sourced 2026-11-17
`budget_rates.csv` was rebuilt on 2026-11-17 from 2025–2026 published prices (tracker V2-P2-11).
Most sources are trekking-agency cost guides, not official price lists, so the app still says
"Estimate only". Assumptions:
- Per person, in NPR. USD prices converted at **1 USD ≈ 140 NPR**.
- **low** = local bus, basic room, dal bhat; **medium** = tourist bus / shared jeep, standard
  teahouse, 3 meals + tea; **high** = private car or jeep **shared by 2 people**, better room,
  extras (hot shower, Wi-Fi, charging, snacks).
- Transport prices are for foreigners. Nepali citizens pay much less for Lukla flights; the
  budget formula does not model that yet.

**Daily food and room on treks**
| Region | Food low/med/high | Room low/med/high | Source (range found) |
|---|---|---|---|
| Annapurna | 2,000 / 3,000 / 4,500 | 600 / 1,000 / 2,500 | Dal bhat NPR 400–900 rising with altitude, 3 meals ≈ 1,500–2,000, NPR 3,000–5,000/day with extras (5ktreks.com, nepaldatabase.com 2026); rooms 500–1,500 (mountainhawktrek.com 2026) |
| Khumbu | 3,500 / 4,500 / 6,500 | 700 / 1,500 / 3,500 | Food USD 25–45/day, 40–60 with extras (mountainkick.com, mountainhawktrek.com 2026); rooms NPR 500–1,000, Gorak Shep up to 2,500 (everesttrekkingguide.com 2026) |
| Langtang | 1,800 / 2,800 / 4,000 | 500 / 1,000 / 1,700 | Meals USD 18–35/day; rooms USD 3–12 (nepalhikingteam.com, himalayanhero.com 2026) |
| Manaslu | 2,800 / 3,800 / 5,500 | 600 / 1,200 / 2,500 | Food + room USD 25–45/day; rooms USD 3–5 low villages, 10–25 at Samdo/Dharamsala (shikharadventure.com, himalayanhero.com 2026) |
| other | 2,400 / 3,400 / 5,000 | 600 / 1,200 / 2,500 | Average of the four regions (no source) |

**Kathmandu ↔ trailhead, return trip**
| Region | low / medium / high | How it was worked out |
|---|---|---|
| Annapurna | 2,000 / 8,500 / 26,000 | Kathmandu–Pokhara local bus USD 4–7, tourist bus NPR 1,300–2,500, private car USD 120–180 per car (thn travel guide 2026, bussewa.com.np 2026); Pokhara–Nayapul local bus ≈ USD 2, taxi/jeep USD 35 per car (12go.com, asiatravel.com.np) |
| Khumbu | 53,000 / 66,000 / 74,000 | Flights to Lukla. low: via Ramechhap, USD 158 each way + shared transfer USD 30 each way; medium: direct from Kathmandu, USD 237 each way (fare from 2026-03-01); high: USD 260 each way + private transfer (nepalcheapflights.com, nepalhiking.com 2026) |
| Langtang | 2,000 / 6,000 / 24,000 | Kathmandu–Syabrubesi local bus NPR 600–1,200, shared jeep NPR 2,000–4,000, private jeep USD 150–200 per jeep, each way (nepalhikingteam.com, himalayanhero.com 2026) |
| Manaslu | 4,000 / 11,000 / 30,000 | Kathmandu–Machha Khola local bus USD 10–25, shared jeep USD 30–50, private jeep USD 175–250 per jeep, each way (shikharadventure.com, himalayanhero.com 2026) |
| other | 5,000 / 10,000 / 30,000 | Unchanged estimate (no single route) |

**City trips**
| Rate | low / medium / high | Source |
|---|---|---|
| Transport per km | 10 / 60 / 100 | low: Valley bus minimum Rs 24 for up to 5 km (Kathmandu Post 2026-04-12), rounded up for changes between buses; medium: official taxi meter Rs 58 flag-down + Rs 12 per 200 m = **Rs 60/km** (Nepal Gazette via Ratopati, April 2026); high: private car Rs 100/km (gobytaxi.com 2026) |
| Room per night | 1,800 / 4,700 / 12,000 | Thamel hostel private room ≈ NPR 1,771; mid-range hotel ≈ NPR 9,389 per room, halved for 2 people (gotripzi.com 2026); high is an **estimate** |
| Food per day | 1,200 / 2,500 / 5,000 | **Estimate** (unchanged). gotripzi.com gives a whole-day budget of NPR 3,726 at the low end |

Admins can still change any rate in the admin panel (Budget rates); a re-seed overwrites it.

## Teahouses (V2 Phase 2) — real lodges only
Only lodges named in a source we can cite are listed; the `source` column says where each one is from.
Wi-Fi, hot shower, price and phone are left **empty (= not known)** because no source gave them.
Add more from agency itineraries, ACAP lists or your own survey, always with the source. Never invent
a lodge or a phone number. Dropped: "Hotel Himalaya" (listed in a Tengboche-area guide, but it was not
clear that it is in Tengboche itself).

## Climate model (approximate)
`place_climate` (used for "best time to visit") is **estimated**, not measured:
- start from Kathmandu monthly normals (`climate_baseline.csv`, ~1,400 m),
- temperature drops 6.5 °C per 1,000 m of extra altitude,
- rainfall is multiplied by a per-district factor (`climate_regions.csv`, e.g. Kaski ×2.6 for the wet
  Pokhara side, Mustang ×0.15 for the rain shadow).

Replace it with real station data (Department of Hydrology and Meteorology) or Open-Meteo's
historical API when available, and say in the report which you used.

## Photos
`tools/fetch_photos.py` takes the lead image of each place's English Wikipedia article, keeps it only if
its Commons licence is free (CC0 / CC BY / CC BY-SA / public domain) and writes the attribution to
`photos.csv`. Re-run with `../backend/.venv/bin/python -I tools/fetch_photos.py`. Add your own photos as
extra rows with `licence=own`. CC BY / BY-SA photos must be credited (author + licence) wherever shown,
e.g. in the report's figure captions and an app "credits" screen (Phase 3).
