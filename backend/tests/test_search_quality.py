"""Search quality (V2-SR-08..10): the benchmark cases, transliteration and the new match kinds."""

import pytest

from app.algorithms.levenshtein import similarity, word_similarity
from app.algorithms.transliterate import is_devanagari, to_latin
from app.search_benchmark import CASES, metrics, run
from app.services.search import initials


@pytest.mark.parametrize(
    ("nepali", "latin"),
    [
        ("सगरमाथा", "sagarmatha"),
        ("फेवा ताल", "phewa tal"),
        ("दरबार क्षेत्र", "darbar kshetra"),
        ("नगरकोट", "nagarkot"),
        ("अन्नपूर्ण", "annapurna"),
        ("ज्ञान", "gyan"),
        ("ढुङ्गा", "dhunga"),
        ("राष्ट्रिय", "rashtriya"),
        ("Poon Hill", "poon hill"),  # Latin text is only lower-cased
    ],
)
def test_to_latin(nepali, latin):
    assert to_latin(nepali) == latin


def test_is_devanagari():
    assert is_devanagari("पोखरा") and is_devanagari("Lake फेवा")
    assert not is_devanagari("Pokhara")


def test_trek_initials():
    assert initials("Everest Base Camp Trek") == "EBC"
    assert initials("Annapurna Base Camp Trek") == "ABC"
    assert initials("Langtang Valley Trek") == "LV"
    assert initials("Pokhara") is None


def test_word_similarity_matches_words_in_any_place():
    # The Nepali name has an extra word in the middle; matching word by word still finds it
    assert word_similarity("chitwan nikunja", "chitwan rashtriya nikunja") == 1.0
    assert similarity("chitwan nikunja", "chitwan rashtriya nikunja") == pytest.approx(0.95)
    assert similarity("phewa tal", "Phewa Lake") < 0.7  # a different word is not a match


def test_benchmark_cases_pass(db):
    results = run(db)
    failed = [(r.case.query, r.case.expected, r.rank, r.top) for r in results if not r.passed]
    assert failed == []
    m = metrics(results)
    # hit@1 is below 1 on purpose: some area cases expect the 2nd or 3rd place in a list
    assert m["hit@1"] >= 0.8 and m["mrr"] >= 0.88 and m["no_result_ok"] == 1
    assert len(results) == len(CASES)


def test_search_village_finds_trek_with_via(client):
    r = client.get("/search", params={"q": "namche"}).json()
    ebc = next(h for h in r["treks"] if h["name"] == "Everest Base Camp Trek")
    assert ebc["match"] == "via" and ebc["via"] == "Namche Bazaar"
    assert ebc["region"] and ebc["total_days"] > 0


def test_search_initials_find_trek(client):
    r = client.get("/search", params={"q": "ebc"}).json()
    assert r["treks"][0]["name"] == "Everest Base Camp Trek"
    assert r["treks"][0]["match"] == "name"


def test_search_district_lists_its_places(client):
    r = client.get("/search", params={"q": "bhaktapur"}).json()
    kinds = {h["match"] for h in r["places"]}
    assert "district" in kinds
    assert all(h["district"] for h in r["places"])


def test_search_category(client):
    r = client.get("/search", params={"q": "temple"}).json()
    assert r["places"] and all(h["category"]["code"] for h in r["places"])
    assert any(h["match"] == "category" for h in r["places"])


def test_search_nepali_query_finds_english_only_name(client):
    r = client.get("/search", params={"q": "सगरमाथा"}).json()
    assert "Everest Base Camp" in [h["name"] for h in r["places"]]


def test_short_word_needs_near_exact_match(client):
    # "lake" is one letter from the village "Larke"; it must not match by accident
    r = client.get("/search", params={"q": "lake"}).json()
    assert "Larke Phedi" not in [h["name"] for h in r["places"]]


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("pokhara", {"Phewa Lake", "Sarangkot", "World Peace Pagoda"}),
        ("पोखरा", {"Phewa Lake", "Sarangkot", "World Peace Pagoda"}),
        ("kathmandu valley", {"Pashupatinath Temple", "Boudhanath Stupa", "Swayambhunath Stupa",
                              "Kathmandu Durbar Square", "Patan Durbar Square",
                              "Bhaktapur Durbar Square", "Changu Narayan Temple", "Nagarkot"}),
    ],
)  # fmt: skip
def test_city_search_lists_every_place_in_it(client, query, expected):
    """V2-SR-14: a city is not a district (Pokhara is in Kaski), so it needs its own area."""
    r = client.get("/search", params={"q": query, "limit": 20}).json()
    assert {h["name"] for h in r["places"]} == expected
    assert all(h["area"] for h in r["places"])


def test_kathmandu_lists_the_district_first_then_the_valley(client):
    names = [h["name"] for h in client.get("/search", params={"q": "kathmandu"}).json()["places"]]
    assert names[0] == "Kathmandu Durbar Square"
    assert names.index("Pashupatinath Temple") < names.index("Patan Durbar Square")
    assert {"Patan Durbar Square", "Bhaktapur Durbar Square", "Nagarkot"} <= set(names)


def test_trek_region_finds_its_treks(client):
    r = client.get("/search", params={"q": "khumbu"}).json()
    assert [h["name"] for h in r["treks"]] == ["Everest Base Camp Trek"]
    assert r["treks"][0]["match"] == "area" and r["treks"][0]["area"] == "Everest region"
    langtang = {h["name"] for h in client.get("/search", params={"q": "langtang"}).json()["treks"]}
    assert langtang == {"Langtang Valley Trek", "Gosaikunda Lake Trek"}


def test_areas_lookup_filter_and_detail(client, admin):
    areas = client.get("/areas", headers={"Accept-Language": "ne"}).json()
    assert {"code": "pokhara", "name": "पोखरा"} in areas
    places = client.get("/places", params={"area": "pokhara"}).json()["items"]
    assert {p["name"] for p in places} == {"Phewa Lake", "Sarangkot", "World Peace Pagoda"}
    detail = client.get(f"/places/{places[0]['id']}").json()
    assert detail["area"] == "Pokhara"
    # Admin: change the area, refuse an unknown one, put it back
    body = client.get(f"/admin/places/{places[0]['id']}", headers=admin).json()
    assert body["area_code"] == "pokhara"
    for key in ("id", "photos", "updated_at"):
        body.pop(key)
    url = f"/admin/places/{places[0]['id']}"
    r = client.put(url, json={**body, "area_code": "kathmandu_valley"}, headers=admin)
    assert r.status_code == 200 and r.json()["area_code"] == "kathmandu_valley"
    assert client.put(url, json={**body, "area_code": "mars"}, headers=admin).status_code == 422
    assert (
        client.put(url, json={**body, "area_code": None}, headers=admin).json()["area_code"] is None
    )
    client.put(url, json=body, headers=admin)
