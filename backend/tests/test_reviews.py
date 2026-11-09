"""V2 Phase 2: reviews and the Bayesian average rating."""

import uuid

import pytest
from sqlalchemy import select

from app.algorithms.rating import bayesian_average
from app.models import Review, User
from app.seed import sid
from app.services.rating import global_mean
from tests.conftest import register

POON_HILL = str(sid("place", "poon_hill"))
MARDI = str(sid("trek", "mardi-himal"))


# ------------------------------------------------------------- the algorithm
def test_bayesian_worked_example_from_the_report():
    one_five_star = bayesian_average(5, 1, global_mean=4.0)
    twenty_at_4_6 = bayesian_average(20 * 4.6, 20, global_mean=4.0)
    assert round(one_five_star, 2) == 4.17
    assert round(twenty_at_4_6, 2) == 4.48
    assert twenty_at_4_6 > one_five_star


def test_bayesian_with_no_reviews_is_the_global_mean():
    assert bayesian_average(0, 0, global_mean=3.7) == pytest.approx(3.7)


def test_bayesian_rejects_nonsense():
    with pytest.raises(ValueError):
        bayesian_average(0, 0, global_mean=4.0, c=0)


# --------------------------------------------------------------------- API
def test_post_review_appears_with_your_name(client):
    headers = register(client, "Asha Gurung")
    r = client.post(
        f"/places/{POON_HILL}/reviews",
        json={"rating": 4, "comment": "  Great sunrise view  "},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    review = r.json()
    assert review["author_name"] == "Asha Gurung" and review["comment"] == "Great sunrise view"
    assert review["is_mine"] and review["lang"] == "en"

    page = client.get(f"/places/{POON_HILL}/reviews", headers=headers).json()
    assert page["mine"]["id"] == review["id"]
    assert review["id"] in [x["id"] for x in page["items"]]
    assert page["rating"]["count"] >= 1
    # The public list never shows an email
    assert "@example.com" not in client.get(f"/places/{POON_HILL}/reviews").text


def test_posting_twice_updates_instead_of_duplicating(client, db):
    headers = register(client)
    first = client.post(f"/treks/{MARDI}/reviews", json={"rating": 3}, headers=headers)
    second = client.post(
        f"/treks/{MARDI}/reviews", json={"rating": 5, "comment": "Better on day 2"}, headers=headers
    )
    assert first.status_code == 201 and second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert second.json()["rating"] == 5
    me = client.get("/me", headers=headers).json()
    rows = db.scalars(select(Review).where(Review.user_id == uuid.UUID(me["id"]))).all()
    assert len(rows) == 1


@pytest.mark.parametrize("body", [{"rating": 0}, {"rating": 6}, {"rating": 4.5},
                                  {"rating": 4, "comment": "x" * 1001}])  # fmt: skip
def test_invalid_reviews_are_rejected(client, user, body):
    _, _, headers = user
    r = client.post(f"/places/{POON_HILL}/reviews", json=body, headers=headers)
    assert r.status_code == 422


def test_review_needs_login_and_a_real_item(client, user):
    _, _, headers = user
    assert client.post(f"/places/{POON_HILL}/reviews", json={"rating": 4}).status_code == 401
    missing = f"/places/{uuid.uuid4()}/reviews"
    assert client.post(missing, json={"rating": 4}, headers=headers).status_code == 404
    assert client.get(missing).status_code == 404


def test_language_comes_from_accept_language(client, user):
    _, _, headers = user
    r = client.post(
        f"/places/{POON_HILL}/reviews",
        json={"rating": 5, "comment": "राम्रो दृश्य"},
        headers={**headers, "Accept-Language": "ne"},
    )
    assert r.json()["lang"] == "ne"


def test_you_cannot_delete_someone_elses_review(client):
    owner, other = register(client), register(client)
    review = client.post(f"/places/{POON_HILL}/reviews", json={"rating": 2}, headers=owner).json()
    assert client.delete(f"/reviews/{review['id']}", headers=other).status_code == 404
    assert client.delete(f"/reviews/{review['id']}", headers=owner).status_code == 204
    assert client.delete(f"/reviews/{review['id']}", headers=owner).status_code == 404


def test_blocked_user_cannot_post(client, admin):
    headers = register(client)
    me = client.get("/me", headers=headers).json()
    client.put(f"/admin/users/{me['id']}/block", json={"is_blocked": True}, headers=admin)
    r = client.post(f"/places/{POON_HILL}/reviews", json={"rating": 5}, headers=headers)
    assert r.status_code == 403


def test_hidden_review_is_not_counted_and_not_listed(client, admin):
    place = str(sid("place", "world_peace_pagoda"))
    headers = register(client)
    review = client.post(f"/places/{place}/reviews", json={"rating": 1}, headers=headers).json()
    before = client.get(f"/places/{place}").json()["rating"]["count"]

    r = client.put(f"/admin/reviews/{review['id']}/status", json={"status": "hidden"},
                   headers=admin)  # fmt: skip
    assert r.status_code == 200 and r.json()["lang"] == "en"

    assert client.get(f"/places/{place}").json()["rating"]["count"] == before - 1
    page = client.get(f"/places/{place}/reviews", headers=headers).json()
    assert review["id"] not in [x["id"] for x in page["items"]]
    assert page["mine"]["status"] == "hidden"  # the author still sees it, marked hidden
    # Editing does not undo the moderation
    client.post(f"/places/{place}/reviews", json={"rating": 2}, headers=headers)
    assert client.get(f"/places/{place}/reviews").json()["total"] == page["total"]


def test_sort_by_rating_follows_the_bayesian_score(client, db):
    """The report's example: one 5★ review vs 20 reviews averaging 4.6★ (inserted directly).

    Fifteen 3★ reviews elsewhere keep the app mean m near 4.0, as in the report. (With a mean
    above 4.49 the single 5★ would correctly win: the prior pulls both towards m.)"""
    single, many, other = (sid("place", s) for s in ("janaki_mandir", "manakamana", "lumbini"))
    users = [User(email=f"rater-{uuid.uuid4().hex[:10]}@example.com") for _ in range(36)]
    db.add_all(users)
    db.flush()
    db.add(Review(user_id=users[0].id, place_id=single, rating=5))
    ratings = [5] * 12 + [4] * 8  # 92 / 20 = 4.6
    db.add_all(Review(user_id=u.id, place_id=many, rating=r)
               for u, r in zip(users[1:21], ratings, strict=True))  # fmt: skip
    db.add_all(Review(user_id=u.id, place_id=other, rating=3) for u in users[21:])
    db.commit()

    m = global_mean(db)
    items = client.get("/places", params={"sort": "rating", "page_size": 500}).json()["items"]
    by_id = {p["id"]: p for p in items}
    assert by_id[str(single)]["rating"] == {
        "score": round(bayesian_average(5, 1, m), 2), "count": 1}  # fmt: skip
    assert by_id[str(many)]["rating"] == {
        "score": round(bayesian_average(92, 20, m), 2), "count": 20}  # fmt: skip
    scores = [p["rating"]["score"] for p in items]
    assert scores == sorted(scores, reverse=True)  # SQL order == Python formula
    assert m < 4.49
    ids = [p["id"] for p in items]
    assert ids.index(str(many)) < ids.index(str(single))

    db.query(Review).filter(Review.user_id.in_([u.id for u in users])).delete()
    db.query(User).filter(User.id.in_([u.id for u in users])).delete()
    db.commit()


def test_treks_carry_a_rating_and_sort(client):
    data = client.get("/treks", params={"sort": "rating"}).json()["items"]
    assert all({"score", "count"} <= set(t["rating"]) for t in data)
    detail = client.get(f"/treks/{MARDI}").json()
    assert detail["rating"]["count"] >= 0
