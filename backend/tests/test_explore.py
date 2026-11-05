from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models import Category, Place, PlaceTranslation
from app.models.enums import Lang


def _first_id(client, path, **params):
    return client.get(path, params=params).json()["items"][0]["id"]


def test_categories_localised(client):
    en = {c["code"]: c["name"] for c in client.get("/categories").json()}
    ne = {
        c["code"]: c["name"]
        for c in client.get("/categories", headers={"Accept-Language": "ne"}).json()
    }
    assert en["temple"] == "Temples & Stupas"
    assert ne["temple"] == "मन्दिर र स्तूप"


def test_list_places_by_category_paginated(client):
    r = client.get("/places", params={"category": "temple", "page_size": 2}).json()
    assert r["total"] >= 5
    assert len(r["items"]) == 2
    assert all(p["category"]["code"] == "temple" for p in r["items"])
    page2 = client.get("/places", params={"category": "temple", "page_size": 2, "page": 2}).json()
    assert {p["id"] for p in page2["items"]}.isdisjoint({p["id"] for p in r["items"]})


def test_list_places_bbox_for_map(client):
    # Kathmandu valley
    r = client.get(
        "/places",
        params={
            "min_lat": 27.6,
            "min_lng": 85.2,
            "max_lat": 27.8,
            "max_lng": 85.6,
            "page_size": 100,
        },
    ).json()
    names = {p["name"] for p in r["items"]}
    assert "Pashupatinath Temple" in names
    assert "Phewa Lake" not in names


def test_bbox_must_be_complete(client):
    assert client.get("/places", params={"min_lat": 27}).status_code == 422


def test_place_detail(client):
    pid = _first_id(client, "/places", q="Pashupati")
    d = client.get(f"/places/{pid}").json()
    assert d["name"] == "Pashupatinath Temple"
    assert d["entry_fee_npr"] == 1000
    assert len(d["best_months"]) == 3
    assert len(d["nearby"]) == 5
    distances = [n["distance_km"] for n in d["nearby"]]
    assert distances == sorted(distances)
    assert d["nearby"][0]["name"] == "Boudhanath Stupa"  # ~1.8 km away


def test_place_detail_in_nepali(client):
    pid = _first_id(client, "/places", q="Pashupati")
    d = client.get(f"/places/{pid}", headers={"Accept-Language": "ne"}).json()
    assert d["name"] == "पशुपतिनाथ मन्दिर"
    assert "बागमती" in d["description"]


def test_unknown_place_404(client):
    assert client.get("/places/00000000-0000-0000-0000-000000000000").status_code == 404


def test_translation_fallback_to_english(client, db):
    """A place with no Nepali row returns English when Nepali is requested."""
    category = db.scalar(select(Category).where(Category.code == "viewpoint"))
    place = Place(
        category_id=category.id,
        latitude=Decimal("27.7"),
        longitude=Decimal("85.3"),
        altitude_m=1400,
        district="Kathmandu",
        province="Bagmati",
    )
    place.translations.append(
        PlaceTranslation(lang=Lang.en, name="Test English Only Hill", description="English text")
    )
    db.add(place)
    db.commit()
    try:
        d = client.get(f"/places/{place.id}", headers={"Accept-Language": "ne"}).json()
        assert d["name"] == "Test English Only Hill"
        assert d["description"] == "English text"
        assert d["category"]["name"] == "दृश्यस्थल"  # category does have Nepali
    finally:
        db.delete(place)
        db.commit()


def test_partial_nepali_row_falls_back_per_field(client):
    # Ghorepani has a Nepali name but no Nepali description yet.
    pid = _first_id(client, "/places", q="Ghorepani")
    d = client.get(f"/places/{pid}", headers={"Accept-Language": "ne"}).json()
    assert d["name"] == "घोरेपानी"
    assert d["description"].startswith("A busy ridge-top village")


def test_list_treks_filters(client):
    all_treks = client.get("/treks").json()
    assert all_treks["total"] == 8
    short = client.get("/treks", params={"max_days": 5}).json()["items"]
    assert short and all(t["total_days"] <= 5 for t in short)
    khumbu = client.get("/treks", params={"region": "khumbu"}).json()["items"]
    assert [t["name"] for t in khumbu] == ["Everest Base Camp Trek"]
    easy = client.get("/treks", params={"difficulty": "easy"}).json()["items"]
    assert [t["name"] for t in easy] == ["Ghorepani Poon Hill Trek"]
    assert client.get("/treks", params={"difficulty": "extreme"}).status_code == 422


def test_trek_detail_derives_start_and_end(client):
    tid = client.get("/treks", params={"difficulty": "easy"}).json()["items"][0]["id"]
    d = client.get(f"/treks/{tid}").json()
    assert d["start_place"]["name"] == "Nayapul"
    assert d["end_place"]["name"] == "Ghandruk"
    assert d["max_altitude_m"] == 3210
    assert d["stage_count"] == d["total_days"] == 4
    assert {p["code"] for p in d["permits"]} == {"TIMS", "ACAP"}


@pytest.mark.parametrize(
    ("query", "expected_place", "expected_trek"),
    [
        ("punhill", "Poon Hill", "Ghorepani Poon Hill Trek"),
        ("anapurna", "Annapurna Base Camp", "Annapurna Base Camp Trek"),
        ("अन्नपूर्ण", "Annapurna Base Camp", "Annapurna Circuit Trek"),
    ],
)
def test_search_fuzzy(client, query, expected_place, expected_trek):
    r = client.get("/search", params={"q": query}).json()
    assert expected_place in [h["name"] for h in r["places"]]
    assert expected_trek in [h["name"] for h in r["treks"]]
    assert r["places"][0]["name"] == expected_place  # best match first


def test_search_returns_requested_language(client):
    r = client.get("/search", params={"q": "punhill"}, headers={"Accept-Language": "ne"}).json()
    assert r["places"][0]["name"] == "पुन हिल"


def test_search_nonsense_returns_nothing(client):
    r = client.get("/search", params={"q": "zzqxw"}).json()
    assert r["places"] == [] and r["treks"] == []
