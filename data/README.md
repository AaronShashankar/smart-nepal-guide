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

## Budget rates (V2 Phase 2) — estimates, not measured
`budget_rates.csv` holds **round-number estimates** made on 2026-11-09 from typical published
trekking-agency cost guides and teahouse menus. They are **not** from one official source, so the
app says "Estimate only". Replace them with your survey answers or current agency quotes, and write
the source and date here and in the report. The numbers were chosen to keep this order:
low < medium < high, and Khumbu (flights to Lukla, ≈ USD 220 each way) > Manaslu > Annapurna > Langtang.
Admins can edit them in the admin panel (Budget rates).

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
