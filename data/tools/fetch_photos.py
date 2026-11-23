"""Fill data/photos.csv with openly licensed photos from Wikimedia Commons.

For every place in WIKI_TITLES it takes the lead image of the English Wikipedia
article, checks on Commons that the licence is free (CC BY / CC BY-SA / CC0 /
public domain) and records the URL, author, licence and source page — the
attribution the report needs.

    python3 data/tools/fetch_photos.py          # rewrites data/photos.csv

Rows you add by hand (your own photos) should use source=own.
Review every row before using it in the report.
"""

import csv
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent
UA = "Bato-seed/0.1 (student project; data/tools/fetch_photos.py)"
FREE = re.compile(r"^(CC0|CC BY(-SA)? \d|Public domain|PD)", re.I)

# place slug -> English Wikipedia article title
WIKI_TITLES = {
    "pashupatinath": "Pashupatinath Temple",
    "swayambhunath": "Swayambhunath",
    "boudhanath": "Boudhanath",
    "kathmandu_durbar": "Kathmandu Durbar Square",
    "patan_durbar": "Patan Durbar Square",
    "bhaktapur_durbar": "Bhaktapur Durbar Square",
    "changu_narayan": "Changu Narayan Temple",
    "nagarkot": "Nagarkot",
    "phewa_lake": "Phewa Lake",
    "sarangkot": "Sarangkot",
    "world_peace_pagoda": "World Peace Pagoda, Pokhara",
    "manakamana": "Manakamana Temple",
    "rara_lake": "Rara Lake",
    "chitwan_np": "Chitwan National Park",
    "bardiya_np": "Bardiya National Park",
    "lumbini": "Maya Devi Temple, Lumbini",
    "janaki_mandir": "Janaki Mandir",
    "ghorepani": "Ghorepani",
    "poon_hill": "Poon Hill",
    "ghandruk": "Ghandruk",
    "chhomrong": "Chhomrong",
    "annapurna_base_camp": "Annapurna Sanctuary",
    "lukla": "Lukla",
    "phakding": "Phakding",
    "namche_bazaar": "Namche Bazaar",
    "tengboche": "Tengboche Monastery",
    "dingboche": "Dingboche",
    "pheriche": "Pheriche",
    "lobuche": "Lobuche",
    "gorak_shep": "Gorak Shep",
    "everest_base_camp": "Everest base camps",
    "kala_patthar": "Kala Patthar",
    "syabrubesi": "Syabrubesi",
    "langtang_village": "Langtang (village)",
    "kyanjin_gompa": "Kyanjin Gompa",
    "chame": "Chame",
    "manang": "Manang, Nepal",
    "thorong_la": "Thorong La",
    "muktinath": "Muktinath",
    "jomsom": "Jomsom",
    "dhunche": "Dhunche",
    "gosaikunda": "Gosaikunda",
    "samagaun": "Samagaun",
}

# place slug -> Commons file, picked by hand (2026-11-23) for places whose Wikipedia article
# has no free lead image or no article at all. These win over WIKI_TITLES.
# Bamboo, Siding, Machha Khola, Deng, Namrung and Tilije have no free photo on Commons yet;
# the app shows its drawn mountain picture for them. Add your own as rows with source=own.
COMMONS_FILES = {
    "world_peace_pagoda": "World Peace Pagoda in Pokhara - 2026.jpg",
    "nayapul": "Nayapul-10-Daecher-2013-gje.jpg",
    "tikhedhunga": "Suspension bridge in Hile Tikhedhunga-3459.jpg",
    # trail between Ghorepani and Tadapani; Commons has no good photo of the village itself
    "tadapani": "Ghorepani-Tadapani-10-Rastplatz-2013-gje.jpg",
    "chhomrong": "Intl guest house chhomrong.jpg",
    "deurali_abc": "ABC - Deurali on the Annapurna Base Camp trek, Nepal, 2016.jpg",
    "jhinu_danda": "Jhinu Danda Bridge (Kadoorie Bridge)-1.jpg",
    "lama_hotel": "Lamahotel.jpg",
    "langtang_village": "View of village from langtang (2).JPG",
    "kyanjin_gompa": "Kyanjin Gompa Village Rasuwa.jpg",
    "kande": "Pokhara Baglung Highway from Kande kaski1.jpg",
    "forest_camp": "Forest Camp .. The way to Maardi Himal.jpg",
    "low_camp": "Mardi Low Camp (1) 03.jpg",
    "high_camp_mardi": "High Camp of Mardi Himal Trek 07.jpg",
    "dharapani": "Dharapani village.jpg",
    "chame": "Chame village Nepal.jpg",
    "upper_pisang": "Upper Pisang - Annapurna Circuit, Nepal - panoramio.jpg",
    "manang": "Manang village.jpg",
    "yak_kharka": "Yak Kharka (4020 m) - Annapurna Circuit, Nepal - panoramio.jpg",
    "thorong_phedi": "Way to Thorong Phedi - Annapurna Circuit, Nepal - panoramio.jpg",
    "chandanbari": "Chandanbari view.jpg",
    "laurebina": "First look of Laurebina,Gosaikunda at 3900m.jpg",
    # trail from Yaru Bagar to Jagat, just before the village
    "jagat": "Yaru Bagar to Jagat, Gorkha District, Manaslu Trek, Nepal (39995998083).jpg",
    "samagaun": "Samagaun Village Manaslu Circuit 17.jpg",
    "samdo": "Samdo Village 33.jpg",
    "dharamsala_larkya": (
        "Dharmasala (Larke Phedi) before Larke Pass (Larkya La), Manaslu Circuit, Nepal.jpg"
    ),
    "bimthang": "Bimthang, Nepal.jpg",
}


def get_json(url: str, params: dict) -> dict:
    full = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(full, headers={"User-Agent": UA})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == 4:
                raise
            time.sleep(2 ** (attempt + 2))  # back off: 4, 8, 16, 32 s
    raise RuntimeError("unreachable")


def lead_image_names(titles: list[str]) -> dict[str, str]:
    data = get_json(
        "https://en.wikipedia.org/w/api.php",
        {"action": "query", "prop": "pageimages", "piprop": "name", "format": "json",
         "redirects": 1, "titles": "|".join(titles)},
    )
    q = data.get("query", {})
    back = {}
    for item in q.get("normalized", []) + q.get("redirects", []):
        back[item["to"]] = back.get(item["from"], item["from"])
    out = {}
    for page in q.get("pages", {}).values():
        if "pageimage" in page:
            out[back.get(page["title"], page["title"])] = page["pageimage"]
    return out


def commons_info(file_names: list[str]) -> dict[str, dict]:
    """Licence + URL for up to 50 Commons files in one request."""
    data = get_json(
        "https://commons.wikimedia.org/w/api.php",
        {"action": "query", "prop": "imageinfo", "iiprop": "url|extmetadata",
         "iiurlwidth": 1280, "format": "json",
         "titles": "|".join(f"File:{n}" for n in file_names)},
    )
    q = data.get("query", {})
    back = {item["to"]: item["from"] for item in q.get("normalized", [])}
    out = {}
    for page in q.get("pages", {}).values():
        if "imageinfo" not in page:
            continue  # not on Commons (e.g. a non-free local file)
        info = page["imageinfo"][0]
        meta = info.get("extmetadata", {})
        artist = re.sub(r"<[^>]+>", "", html.unescape(meta.get("Artist", {}).get("value", "")))
        name = back.get(page["title"], page["title"]).removeprefix("File:")
        out[name.replace(" ", "_")] = {
            "url": (info.get("thumburl") or info["url"]).split("?")[0],
            "licence": meta.get("LicenseShortName", {}).get("value", ""),
            "author": " ".join(artist.split()),
            "source": info["descriptionurl"],
        }
    return out


def main() -> int:
    titles = [t for s, t in WIKI_TITLES.items() if s not in COMMONS_FILES]
    names: dict[str, str] = {}
    for i in range(0, len(titles), 40):
        names.update(lead_image_names(titles[i : i + 40]))
    files = sorted(set(names.values()) | set(COMMONS_FILES.values()))
    infos: dict[str, dict] = {}
    for i in range(0, len(files), 40):
        infos.update(commons_info(files[i : i + 40]))
    # slug -> Commons file: Wikipedia lead images first, then the hand-picked files
    chosen = {s: names.get(t) for s, t in WIKI_TITLES.items() if s not in COMMONS_FILES}
    chosen.update(COMMONS_FILES)
    rows, skipped = [], []
    for slug, name in chosen.items():
        info = infos.get(name.replace(" ", "_")) if name else None
        if not info or not FREE.match(info["licence"]):
            skipped.append(f"{slug} ({'no image' if not info else info['licence']})")
            continue
        rows.append({"place_slug": slug, "url": info["url"], "sort_order": 0,
                     "licence": info["licence"], "author": info["author"],
                     "source": info["source"]})
    with open(DATA / "photos.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["place_slug", "url", "sort_order", "licence", "author", "source"]
        )
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {len(rows)} photos; skipped {len(skipped)}: {', '.join(skipped)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
