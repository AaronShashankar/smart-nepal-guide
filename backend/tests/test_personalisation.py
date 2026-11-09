"""V2 Phase 2: recommendations (cosine), Near me, budget, share links, teahouses."""

import pytest

from app.algorithms.geo_box import bounding_box
from app.algorithms.haversine import haversine_km
from app.algorithms.similarity import cosine
from app.models.enums import BudgetLevel
from app.seed import sid
from app.services.recommend import INTEREST_WEIGHTS, budget_fit, interest_part, user_vector
from tests.conftest import register
from tests.test_trips import IDS, new_trip

THAMEL = {"lat": 27.7154, "lng": 85.3123}
EBC = str(sid("trek", "everest-base-camp"))
TENGBOCHE = str(sid("place", "tengboche"))

PROFILE = {
    "date_of_birth": "1998-04-12",
    "fitness_level": "medium",
    "trek_experience": "beginner",
    "has_heart_condition": None,
    "has_asthma": None,
    "budget_level": None,
    "travel_style": "solo",
    "nationality": "foreign",
    "interests": [],
}


def set_profile(client, headers, **kw):
    r = client.put("/me/profile", json={**PROFILE, **kw}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


# ----------------------------------------------------------------- cosine
def test_cosine_identical_orthogonal_and_zero():
    assert cosine([1, 2, 3], [1, 2, 3]) == pytest.approx(1.0)
    assert cosine([2, 4, 6], [1, 2, 3]) == pytest.approx(1.0)  # length does not matter
    assert cosine([1, 0, 0], [0, 1, 0]) == 0.0
    assert cosine([0, 0, 0], [1, 2, 3]) == 0.0
    with pytest.raises(ValueError):
        cosine([1, 2], [1, 2, 3])


def test_cosine_worked_example_for_the_report():
    """User likes culture + religious; same season and budget fit for all three items."""
    u = user_vector({"culture", "religious"})  # [0, 1, 0, 1, 1, 1]
    temple = interest_part(INTEREST_WEIGHTS["temple"]) + [0.8, 1.0]
    heritage = interest_part(INTEREST_WEIGHTS["heritage"]) + [0.8, 1.0]
    lake = interest_part(INTEREST_WEIGHTS["lake"]) + [0.8, 1.0]
    assert u == [0, 1, 0, 1, 1, 1]
    # temple [0, .7, 0, 1, .8, 1]: dot 3.5, |u| 2, |t| √3.13 -> 0.989
    assert cosine(u, temple) == pytest.approx(3.5 / (2 * 3.13**0.5))
    assert cosine(u, temple) > cosine(u, heritage) > cosine(u, lake)


def test_budget_fit():
    assert budget_fit(BudgetLevel.low, BudgetLevel.high) == 1.0  # cheap suits everybody
    assert budget_fit(BudgetLevel.medium, BudgetLevel.low) == 0.5
    assert budget_fit(BudgetLevel.high, BudgetLevel.low) == 0.0
    assert budget_fit(BudgetLevel.high, None) == 1.0


# -------------------------------------------------------- recommendations
def _recs(client, headers, **params):
    r = client.get("/recommendations", params={"limit": 30, "month": 10, **params},
                   headers=headers)  # fmt: skip
    assert r.status_code == 200, r.text
    return r.json()


def _first(items, wanted_types):
    return next(i for i, x in enumerate(items) if _kind(x) in wanted_types)


def _kind(x):
    return "trek" if x["type"] == "trek" else x["item"]["category"]["code"]


def test_recommendations_need_login(client):
    assert client.get("/recommendations").status_code == 401


def test_new_user_gets_popular_now(client):
    data = _recs(client, register(client))
    assert data["mode"] == "popular" and len(data["items"]) == 30


def test_culture_user_gets_temples_before_lakes(client):
    headers = register(client)
    set_profile(client, headers, interests=["culture", "religious"])
    data = _recs(client, headers)
    items = data["items"]
    assert data["mode"] == "personal"
    assert _kind(items[0]) in {"temple", "heritage"}
    assert _first(items, {"temple"}) < _first(items, {"lake"})
    assert "INTEREST_RELIGIOUS" in items[0]["because"] or "INTEREST_CULTURE" in items[0]["because"]
    assert all(len(x["because"]) <= 2 for x in items)
    scores = [x["score"] for x in items]
    assert scores == sorted(scores, reverse=True)


def test_nature_user_gets_the_opposite(client):
    headers = register(client)
    set_profile(client, headers, interests=["nature", "adventure"])
    items = _recs(client, headers)["items"]
    assert _kind(items[0]) in {"lake", "viewpoint", "national_park", "trek"}
    assert _first(items, {"lake"}) < _first(items, {"temple"})
    assert {x["type"] for x in items} == {"place", "trek"}  # mixed


def test_changing_interests_changes_the_list(client):
    headers = register(client)
    set_profile(client, headers, interests=["culture"])
    culture = [x["item"]["id"] for x in _recs(client, headers, limit=5)["items"]]
    set_profile(client, headers, interests=["adventure"])
    adventure = [x["item"]["id"] for x in _recs(client, headers, limit=5)["items"]]
    assert culture != adventure


def test_reviewed_or_planned_items_are_not_recommended(client):
    headers = register(client)
    set_profile(client, headers, interests=["religious"])
    top = _recs(client, headers)["items"][0]["item"]["id"]
    client.post(f"/places/{top}/reviews", json={"rating": 5}, headers=headers)
    new_trip(client, headers, ["boudhanath"], title="Planned")
    ids = [x["item"]["id"] for x in _recs(client, headers)["items"]]
    assert top not in ids and IDS["boudhanath"] not in ids


def test_trek_villages_are_not_recommended(client):
    items = _recs(client, register(client))["items"]
    assert all(_kind(x) != "village" for x in items)


def test_monsoon_lowers_trek_season_fit(client):
    headers = register(client)
    set_profile(client, headers, interests=["adventure"])
    october = {x["item"]["id"]: x for x in _recs(client, headers, month=10)["items"]}
    july = {x["item"]["id"]: x for x in _recs(client, headers, month=7)["items"]}
    assert october[EBC]["score"] > july[EBC]["score"]
    assert "GOOD_SEASON" not in july[EBC]["because"]


# ----------------------------------------------------------------- near me
def test_bounding_box_contains_the_circle():
    min_lat, min_lng, max_lat, max_lng = bounding_box(27.7, 85.3, 10)
    assert haversine_km(27.7, 85.3, max_lat, 85.3) == pytest.approx(10, rel=0.01)
    assert haversine_km(27.7, 85.3, 27.7, max_lng) == pytest.approx(10, rel=0.01)
    assert min_lat < 27.7 < max_lat and min_lng < 85.3 < max_lng


def test_near_me_from_thamel(client):
    r = client.get("/places/near", params={**THAMEL, "radius_km": 200, "limit": 100})
    assert r.status_code == 200
    places = r.json()
    distances = [p["distance_km"] for p in places]
    assert distances == sorted(distances)
    districts = [p["district"] for p in places]
    assert districts.index("Kathmandu") < districts.index("Kaski")  # before Pokhara
    assert all(d <= 200 for d in distances)
    assert places[0]["name"] == "Kathmandu Durbar Square" and places[0]["distance_km"] < 2


def test_near_me_respects_radius_and_limit(client):
    small = client.get("/places/near", params={**THAMEL, "radius_km": 3}).json()
    assert small and all(p["distance_km"] <= 3 for p in small)
    assert len(client.get("/places/near", params={**THAMEL, "limit": 2}).json()) == 2
    assert client.get("/places/near", params={"lat": 27.7}).status_code == 422
    assert client.get("/places/near", params={**THAMEL, "radius_km": 500}).status_code == 422


# ------------------------------------------------------------------ budget
def test_trip_budget_needs_an_optimised_trip(client, user):
    _, _, headers = user
    trip = new_trip(client, headers)
    r = client.post(f"/trips/{trip['id']}/budget", headers=headers)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "NOT_OPTIMISED"


def test_valley_trip_budget_by_hand(client):
    """Medium budget, foreign: 2 × (2,500 + 4,000) + km × 60 + entry fees 4,400."""
    headers = register(client)
    set_profile(client, headers, budget_level="medium")
    trip = new_trip(client, headers)
    plan = client.post(f"/trips/{trip['id']}/optimise", headers=headers).json()
    r = client.post(f"/trips/{trip['id']}/budget", headers=headers)
    assert r.status_code == 200, r.text
    b = r.json()
    lines = {line["code"]: line for line in b["lines"] if line["code"] != "ENTRY_FEE"}
    fees = [line for line in b["lines"] if line["code"] == "ENTRY_FEE"]
    assert lines["FOOD"]["amount"] == 2 * 2500 and lines["STAY"]["amount"] == 2 * 4000
    assert lines["TRANSPORT"]["amount"] == round(plan["total_km"] * 60)
    # Pashupatinath 1,000 + Boudha 400 + Swayambhu 200 + Patan 1,000 + Bhaktapur 1,800;
    # Nagarkot is free
    assert sum(f["amount"] for f in fees) == 4400 and len(fees) == 5
    assert b["total_npr"] == 13000 + round(plan["total_km"] * 60) + 4400
    assert (b["budget_level"], b["nationality"], b["region"]) == ("medium", "foreign", "city")
    # Saved on the trip
    saved = client.get(f"/trips/{trip['id']}", headers=headers).json()
    assert saved["estimated_budget_npr"] == b["total_npr"]


def test_budget_level_changes_the_total(client):
    headers = register(client)
    trip = new_trip(client, headers)
    client.post(f"/trips/{trip['id']}/optimise", headers=headers)
    totals = {}
    for level in ("low", "medium", "high"):
        set_profile(client, headers, budget_level=level)
        totals[level] = client.post(f"/trips/{trip['id']}/budget", headers=headers).json()[
            "total_npr"
        ]
    assert totals["low"] < totals["medium"] < totals["high"]


def test_changing_stops_clears_the_saved_budget(client, user):
    _, _, headers = user
    trip = new_trip(client, headers, ["boudhanath", "pashupatinath"])
    client.post(f"/trips/{trip['id']}/optimise", headers=headers)
    client.post(f"/trips/{trip['id']}/budget", headers=headers)
    after = client.post(
        f"/trips/{trip['id']}/stops", json={"place_id": IDS["nagarkot"]}, headers=headers
    ).json()
    assert after["estimated_budget_npr"] is None


def test_ebc_permits_by_nationality(client):
    headers = register(client)
    permits = {}
    for nationality in ("foreign", "saarc", "nepali"):
        set_profile(client, headers, nationality=nationality)
        b = client.get(f"/treks/{EBC}/budget", headers=headers).json()
        assert b["nationality"] == nationality and b["region"] == "Khumbu"
        permits[nationality] = sum(x["amount"] for x in b["lines"] if x["code"] == "PERMIT")
    assert permits["foreign"] > permits["saarc"] > permits["nepali"]
    assert permits["foreign"] == 3000 + 3000  # SNP + Khumbu municipality permit


def test_trek_budget_without_login_uses_defaults(client):
    b = client.get(f"/treks/{EBC}/budget").json()
    assert (b["budget_level"], b["nationality"], b["days"]) == ("medium", "foreign", 11)
    codes = [x["code"] for x in b["lines"]]
    assert codes[:2] == ["FOOD", "STAY"] and "TRAILHEAD_TRANSPORT" in codes
    assert b["total_npr"] == sum(x["amount"] for x in b["lines"])


def test_trek_in_an_unknown_region_uses_other_rates(client, admin):
    stages = client.get(f"/admin/treks/{sid('trek', 'poon-hill')}", headers=admin).json()
    body = {**stages, "region": "Dolpo", "en": {"name": "Test Dolpo trek"}, "ne": {}}
    for key in ("id", "updated_at", "total_days", "total_distance_km", "max_altitude_m"):
        body.pop(key, None)
    r = client.post("/admin/treks", json=body, headers=admin)
    assert r.status_code == 201, r.text
    assert client.get(f"/treks/{r.json()['id']}/budget").json()["region"] == "other"
    client.delete(f"/admin/treks/{r.json()['id']}", headers=admin)


def test_profile_keeps_nationality(client, user):
    _, _, headers = user
    assert client.get("/me/profile", headers=headers).json()["nationality"] == "foreign"
    assert set_profile(client, headers, nationality="saarc")["nationality"] == "saarc"
    bad = client.put("/me/profile", json={**PROFILE, "nationality": "martian"}, headers=headers)
    assert bad.status_code == 422


# ------------------------------------------------------------------- share
def test_share_link_works_without_login(client):
    email_headers = register(client, "Private Person")
    me = client.get("/me", headers=email_headers).json()
    trip = new_trip(client, email_headers, title="Valley <b>weekend</b>")
    client.post(f"/trips/{trip['id']}/optimise", headers=email_headers)
    share = client.post(f"/trips/{trip['id']}/share", headers=email_headers).json()
    assert len(share["token"]) >= 22 and share["url"].endswith(f"/s/{share['token']}")
    assert share["app_url"] == f"smartnepalguide://shared/{share['token']}"
    again = client.post(f"/trips/{trip['id']}/share", headers=email_headers).json()
    assert again["token"] == share["token"]  # sharing twice keeps the same link

    public = client.get(f"/shared/trips/{share['token']}")
    assert public.status_code == 200
    data = public.json()
    assert data["title"] == "Valley <b>weekend</b>" and len(data["stops"]) == 6
    assert data["days"] and data["is_optimised"]
    for secret in (me["email"], me["id"], "Private Person", trip["id"]):
        assert secret not in public.text  # no user data, no trip id

    page = client.get(f"/s/{share['token']}")
    assert page.status_code == 200 and "text/html" in page.headers["content-type"]
    assert "Valley &lt;b&gt;weekend&lt;/b&gt;" in page.text and "<b>weekend" not in page.text
    assert "Pashupatinath Temple" in page.text and me["email"] not in page.text
    nepali = client.get(f"/s/{share['token']}", headers={"Accept-Language": "ne"})
    assert "दिन" in nepali.text


def test_stop_sharing_and_bad_tokens_give_404(client, user):
    _, _, headers = user
    trip = new_trip(client, headers, ["boudhanath"])
    token = client.post(f"/trips/{trip['id']}/share", headers=headers).json()["token"]
    assert client.get("/shared/trips/not-a-real-token").status_code == 404
    assert client.get(f"/trips/{trip['id']}", headers=headers).json()["is_shared"] is True
    assert client.delete(f"/trips/{trip['id']}/share", headers=headers).status_code == 204
    assert client.get(f"/shared/trips/{token}").status_code == 404
    assert client.get(f"/s/{token}").status_code == 404
    # A new share makes a new token; deleting the trip kills it too
    token2 = client.post(f"/trips/{trip['id']}/share", headers=headers).json()["token"]
    assert token2 != token
    client.delete(f"/trips/{trip['id']}", headers=headers)
    assert client.get(f"/shared/trips/{token2}").status_code == 404


def test_only_the_owner_can_share(client, user):
    _, _, headers = user
    trip = new_trip(client, headers, ["boudhanath"])
    other = register(client)
    assert client.post(f"/trips/{trip['id']}/share", headers=other).status_code == 404
    assert client.post(f"/trips/{trip['id']}/share").status_code == 401


# --------------------------------------------------------------- teahouses
def test_teahouses_in_tengboche(client):
    r = client.get(f"/places/{TENGBOCHE}/teahouses")
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "Tashi Delek Lodge" in names and names == sorted(names, key=str.casefold)
    ne = client.get(f"/places/{TENGBOCHE}/teahouses", headers={"Accept-Language": "ne"}).json()
    assert "ताशी डेलेक लज" in [t["name"] for t in ne]


def test_itinerary_day_4_shows_teahouse_count(client):
    stages = client.get(f"/treks/{EBC}/stages").json()["stages"]
    day4 = stages[3]
    assert day4["to_place"]["name"] == "Tengboche" and day4["teahouse_count"] >= 4
    assert stages[0]["teahouse_count"] == 0  # none listed in Phakding yet


def test_admin_teahouse_crud(client, admin, user):
    _, _, headers = user
    body = {"place_id": TENGBOCHE, "name_en": "Test Lodge", "source": "test fixture",
            "has_wifi": True}  # fmt: skip
    assert client.post("/admin/teahouses", json=body, headers=headers).status_code == 403
    r = client.post("/admin/teahouses", json=body, headers=admin)
    assert r.status_code == 201, r.text
    tid = r.json()["id"]
    assert r.json()["place_name"] == "Tengboche"
    no_source = {**body, "source": ""}
    assert client.post("/admin/teahouses", json=no_source, headers=admin).status_code == 422
    r = client.put(f"/admin/teahouses/{tid}", json={**body, "phone": "+977 38 000000"},
                   headers=admin)  # fmt: skip
    assert r.json()["phone"] == "+977 38 000000"
    assert "Test Lodge" in [t["name"] for t in client.get(f"/places/{TENGBOCHE}/teahouses").json()]
    assert client.delete(f"/admin/teahouses/{tid}", headers=admin).status_code == 204
    assert "Test Lodge" not in [
        t["name"] for t in client.get(f"/places/{TENGBOCHE}/teahouses").json()
    ]


def test_admin_budget_rates(client, admin):
    rows = client.get("/admin/budget-rates", headers=admin).json()
    assert len(rows) >= 18 and rows[0]["region"] == "city"
    medium_city = next(r for r in rows if (r["budget_level"], r["region"]) == ("medium", "city"))
    changed = {**medium_city, "food_per_day_npr": medium_city["food_per_day_npr"] + 1}
    r = client.put("/admin/budget-rates", json=changed, headers=admin)
    assert r.json()["food_per_day_npr"] == medium_city["food_per_day_npr"] + 1
    client.put("/admin/budget-rates", json=medium_city, headers=admin)  # put it back


def test_admin_place_has_three_fees(client, admin):
    p = client.get(f"/admin/places/{sid('place', 'bhaktapur_durbar')}", headers=admin).json()
    assert (p["entry_fee_npr"], p["entry_fee_saarc_npr"], p["entry_fee_nepali_npr"]) == (
        1800, 500, 0)  # fmt: skip
    detail = client.get(f"/places/{sid('place', 'bhaktapur_durbar')}").json()
    assert detail["entry_fee_saarc_npr"] == 500
