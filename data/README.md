# Seed data

Loaded by `cd backend && uv run python -m app.seed` (safe to re-run; IDs are stable UUIDv5 values
derived from the slugs/codes, so updates happen in place).

| File | Rows | Contents |
|---|---|---|
| `categories.csv` | 6 | code, MaterialCommunityIcons icon name, English + Nepali name |
| `interests.csv` | 4 | nature, culture, adventure, religious |
| `places.csv` | 69 | 17 sights + 52 trek villages/viewpoints: coordinates, altitude, district, province, foreign entry fee (empty = free), English text; Nepali names for all, Nepali description for the 10 key places |
| `aliases.csv` | 70 | other spellings and Devanagari names used by search ("Poonhill", "Gosainkund", "अन्नपूर्ण"…) |
| `treks.json` | 8 | Poon Hill, ABC, EBC, Langtang, Mardi Himal, Annapurna Circuit, Gosaikunda, Manaslu: day-by-day stages (from → to place, km, walking hours, highest point on the way), permits, EN/NE name and overview |
| `permits.csv` | 7 | TIMS, ACAP, SNP, KPLRM, LNP, MCAP, MRAP with Nepali/SAARC/foreign fees |
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
