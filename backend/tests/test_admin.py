import uuid

import pytest
from sqlalchemy import update

from app.models import Review, User
from app.models.enums import UserRole
from app.seed import sid

EBC = str(sid("trek", "everest-base-camp"))
PHOTO = b"\xff\xd8\xff\xe0" + b"0" * 200  # enough of a JPEG for the content-type check


@pytest.fixture
def admin(client, db):
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", json={"email": email, "password": "admin-pass-2026"})
    db.execute(update(User).where(User.email == email).values(role=UserRole.admin))
    db.commit()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def place_body(**kw):
    body = {
        "category_code": "viewpoint",
        "latitude": 27.75,
        "longitude": 85.40,
        "altitude_m": 2175,
        "district": "Kathmandu",
        "province": "Bagmati",
        "en": {"name": "Chandragiri Hill", "description": "Cable car viewpoint."},
        "ne": {"name": "चन्द्रागिरि डाँडा"},
        "aliases": ["Chandragiri", "चन्द्रागिरि"],
    }
    return {**body, **kw}


def test_admin_routes_need_admin(client, user):
    _, _, headers = user
    assert client.get("/admin/stats").status_code == 401
    assert client.get("/admin/stats", headers=headers).status_code == 403


def test_stats(client, admin):
    s = client.get("/admin/stats", headers=admin).json()
    assert s["places"] >= 69 and s["treks"] >= 8
    assert set(s["predictions_by_level"]) == {"easy", "moderate", "hard", "risky"}


def test_place_crud_appears_in_app_and_search(client, admin):
    r = client.post("/admin/places", json=place_body(), headers=admin)
    assert r.status_code == 201, r.text
    place = r.json()
    assert place["aliases"] == ["Chandragiri", "चन्द्रागिरि"]

    # It shows up in the public app at once, in both languages.
    public = client.get(f"/places/{place['id']}").json()
    assert public["name"] == "Chandragiri Hill"
    ne = client.get(f"/places/{place['id']}", headers={"Accept-Language": "ne"}).json()
    assert ne["name"] == "चन्द्रागिरि डाँडा"
    assert ne["description"] == "Cable car viewpoint."  # English fallback
    hits = client.get("/search", params={"q": "chandragiri"}).json()["places"]
    assert hits and hits[0]["name"] == "Chandragiri Hill"

    # Edit, unpublish, delete
    edited = client.put(
        f"/admin/places/{place['id']}",
        json=place_body(en={"name": "Chandragiri Hills"}, is_published=False),
        headers=admin,
    )
    assert edited.json()["en"]["name"] == "Chandragiri Hills"
    assert client.get(f"/places/{place['id']}").status_code == 404  # unpublished
    assert client.delete(f"/admin/places/{place['id']}", headers=admin).status_code == 204
    assert client.get(f"/admin/places/{place['id']}", headers=admin).status_code == 404


def test_place_validation(client, admin):
    outside_nepal = place_body(latitude=40.0)
    assert client.post("/admin/places", json=outside_nepal, headers=admin).status_code == 422
    no_name = place_body(en={"name": " "})
    assert client.post("/admin/places", json=no_name, headers=admin).status_code == 422
    bad_climate = place_body(climate=[{"month": 1, "rainfall_mm": 10}])
    assert client.post("/admin/places", json=bad_climate, headers=admin).status_code == 422


def test_place_used_by_a_trek_cannot_be_deleted(client, admin):
    namche = str(sid("place", "namche_bazaar"))
    assert client.delete(f"/admin/places/{namche}", headers=admin).status_code == 409


def test_photo_upload_and_delete(client, admin):
    place = client.post("/admin/places", json=place_body(), headers=admin).json()
    r = client.post(
        f"/admin/places/{place['id']}/photos",
        files={"file": ("view.jpg", PHOTO, "image/jpeg")},
        headers=admin,
    )
    assert r.status_code == 201, r.text
    photo = r.json()
    assert photo["url"].startswith("/uploads/places/") and photo["url"].endswith(".jpg")
    assert client.get(photo["url"]).content == PHOTO  # served as a static file
    detail = client.get(f"/places/{place['id']}").json()
    assert detail["photos"][0]["url"] == photo["url"]

    not_image = client.post(
        f"/admin/places/{place['id']}/photos",
        files={"file": ("x.txt", b"hello", "text/plain")},
        headers=admin,
    )
    assert not_image.status_code == 415
    gone = client.delete(f"/admin/places/{place['id']}/photos/{photo['id']}", headers=admin)
    assert gone.status_code == 204
    assert client.get(photo["url"]).status_code == 404


def test_edit_trek_stages_updates_itinerary_and_acclimatisation(client, admin):
    trek = client.get(f"/admin/treks/{EBC}", headers=admin).json()
    assert len(trek["stages"]) == 11 and trek["total_days"] == 11
    before = client.get(f"/treks/{EBC}/acclimatisation").json()
    assert before["passes"]

    # Remove both rest days (days 3 and 6).
    body = {k: trek[k] for k in ("region", "base_difficulty", "is_published", "en", "ne",
                                 "permit_codes")}  # fmt: skip
    body["stages"] = [s for i, s in enumerate(trek["stages"], start=1) if i not in (3, 6)]
    r = client.put(f"/admin/treks/{EBC}", json=body, headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["total_days"] == 9

    stages = client.get(f"/treks/{EBC}/stages").json()
    assert stages["summary"]["total_days"] == 9 and stages["summary"]["rest_days"] == 0
    assert client.get("/treks", params={"region": "Khumbu"}).json()["items"][0]["total_days"] == 9
    after = client.get(f"/treks/{EBC}/acclimatisation").json()
    assert not after["passes"]

    # Put it back (other tests use the standard itinerary).
    body["stages"] = trek["stages"]
    assert client.put(f"/admin/treks/{EBC}", json=body, headers=admin).json()["total_days"] == 11


def test_create_trek_with_new_permit(client, admin):
    permit = client.post(
        "/admin/permits",
        json={"code": "TEST_PERMIT", "fee_foreign_npr": 1000, "name_en": "Test permit"},
        headers=admin,
    )
    assert permit.status_code == 201
    ghorepani, tadapani = str(sid("place", "ghorepani")), str(sid("place", "tadapani"))
    body = {
        "region": "Annapurna",
        "base_difficulty": "easy",
        "en": {"name": "Short ridge walk"},
        "permit_codes": ["TEST_PERMIT"],
        "stages": [{"from_place_id": ghorepani, "to_place_id": tadapani, "distance_km": 10,
                    "walk_hours": 6, "notes_en": "Ridge walk", "notes_ne": "डाँडाको बाटो"}],
    }  # fmt: skip
    r = client.post("/admin/treks", json=body, headers=admin)
    assert r.status_code == 201, r.text
    trek = r.json()
    public = client.get(f"/treks/{trek['id']}").json()
    assert public["name"] == "Short ridge walk" and public["permits"][0]["code"] == "TEST_PERMIT"
    in_use = client.delete(f"/admin/permits/{permit.json()['id']}", headers=admin)
    assert in_use.status_code == 409
    assert client.delete(f"/admin/treks/{trek['id']}", headers=admin).status_code == 204
    assert client.get(f"/treks/{trek['id']}").status_code == 404


def test_categories(client, admin):
    r = client.post(
        "/admin/categories",
        json={"code": "museum", "icon": "bank", "name_en": "Museums", "name_ne": "सङ्ग्रहालय"},
        headers=admin,
    )
    assert r.status_code == 201
    dup = client.post("/admin/categories", json={"code": "museum", "name_en": "x"}, headers=admin)
    assert dup.status_code == 409
    temple = next(
        c for c in client.get("/admin/categories", headers=admin).json() if c["code"] == "temple"
    )
    assert client.delete(f"/admin/categories/{temple['id']}", headers=admin).status_code == 409
    assert client.delete(f"/admin/categories/{r.json()['id']}", headers=admin).status_code == 204


def test_block_user(client, admin, user):
    email, password, headers = user
    users = client.get("/admin/users", params={"q": email}, headers=admin).json()
    target = users["items"][0]
    r = client.put(f"/admin/users/{target['id']}/block", json={"is_blocked": True}, headers=admin)
    assert r.json()["is_blocked"] is True

    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 403
    assert client.get("/me", headers=headers).status_code == 403  # old token stops working

    client.put(f"/admin/users/{target['id']}/block", json={"is_blocked": False}, headers=admin)
    assert (
        client.post("/auth/login", json={"email": email, "password": password}).status_code == 200
    )


def test_admin_cannot_block_self(client, admin):
    me = client.get("/me", headers=admin).json()
    r = client.put(f"/admin/users/{me['id']}/block", json={"is_blocked": True}, headers=admin)
    assert r.status_code == 400


def test_review_moderation(client, admin, user, db):
    email, _, _ = user
    author = db.query(User).filter(User.email == email).one()
    review = Review(user_id=author.id, trek_id=uuid.UUID(EBC), rating=4, comment="Great views")
    db.add(review)
    db.commit()
    rows = client.get("/admin/reviews", headers=admin).json()
    row = next(r for r in rows if r["id"] == str(review.id))
    assert row["target_type"] == "trek" and row["target_name"] == "Everest Base Camp Trek"
    hidden = client.put(
        f"/admin/reviews/{review.id}/status", json={"status": "hidden"}, headers=admin
    )
    assert hidden.json()["status"] == "hidden"
    assert [r["id"] for r in client.get("/admin/reviews?status=hidden", headers=admin).json()]
