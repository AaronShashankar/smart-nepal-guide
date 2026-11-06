from app.seed import sid

VALLEY = ["pashupatinath", "boudhanath", "swayambhunath", "patan_durbar", "bhaktapur_durbar",
          "nagarkot"]  # fmt: skip
IDS = {slug: str(sid("place", slug)) for slug in VALLEY}


def new_trip(client, headers, slugs=VALLEY, title="Valley tour"):
    r = client.post(
        "/trips", json={"title": title, "place_ids": [IDS[s] for s in slugs]}, headers=headers
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_trips_need_login(client):
    assert client.get("/trips").status_code == 401


def test_create_list_and_get(client, user):
    _, _, headers = user
    trip = new_trip(client, headers)
    assert trip["stop_count"] == 6 and not trip["is_optimised"] and trip["days"] == []
    assert [s["place"]["name"] for s in trip["stops"]][0] == "Pashupatinath Temple"
    listed = client.get("/trips", headers=headers).json()
    assert [t["id"] for t in listed] == [trip["id"]]
    assert client.get(f"/trips/{trip['id']}", headers=headers).json()["title"] == "Valley tour"


def test_optimise_orders_and_splits_into_two_days(client, user):
    _, _, headers = user
    trip = new_trip(client, headers)
    r = client.post(f"/trips/{trip['id']}/optimise", headers=headers)
    assert r.status_code == 200, r.text
    plan = r.json()
    assert plan["is_optimised"] and plan["total_days"] == 2 == len(plan["days"])
    assert [s["visit_order"] for s in plan["stops"]] == [1, 2, 3, 4, 5, 6]
    assert plan["total_km"] <= plan["nearest_neighbour_km"]
    day_of = {s["id"]: s["day_no"] for s in plan["stops"]}
    for day in plan["days"]:
        assert all(day_of[i] == day["day_no"] for i in day["stop_ids"])
        assert day["travel_hours"] + day["visit_hours"] <= 8
    # Saved: a fresh GET returns the same order
    again = client.get(f"/trips/{trip['id']}", headers=headers).json()
    assert [s["id"] for s in again["stops"]] == [s["id"] for s in plan["stops"]]


def test_optimise_from_a_start_location(client, user):
    _, _, headers = user
    trip = new_trip(client, headers)
    thamel = {"start_lat": 27.7154, "start_lng": 85.3123}
    plan = client.post(f"/trips/{trip['id']}/optimise", json=thamel, headers=headers).json()
    assert plan["stops"][0]["place"]["name"] == "Swayambhunath Stupa"


def test_adding_or_removing_a_stop_clears_the_plan(client, user):
    _, _, headers = user
    trip = new_trip(client, headers, VALLEY[:3])
    client.post(f"/trips/{trip['id']}/optimise", headers=headers)
    r = client.post(
        f"/trips/{trip['id']}/stops", json={"place_id": IDS["nagarkot"]}, headers=headers
    )
    assert r.status_code == 201
    assert not r.json()["is_optimised"] and r.json()["stop_count"] == 4
    dup = client.post(
        f"/trips/{trip['id']}/stops", json={"place_id": IDS["nagarkot"]}, headers=headers
    )
    assert dup.status_code == 409
    stop_id = r.json()["stops"][0]["id"]
    after = client.delete(f"/trips/{trip['id']}/stops/{stop_id}", headers=headers).json()
    assert after["stop_count"] == 3


def test_other_users_cannot_see_a_trip(client, user):
    _, _, headers = user
    trip = new_trip(client, headers)
    other = client.post(
        "/auth/register", json={"email": "other-trip@example.com", "password": "trekking-2026"}
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    assert client.get(f"/trips/{trip['id']}", headers=other_headers).status_code == 404


def test_rename_and_delete(client, user):
    _, _, headers = user
    trip = new_trip(client, headers, VALLEY[:2])
    r = client.patch(
        f"/trips/{trip['id']}",
        json={"title": "Day out", "start_date": "2026-12-01"},
        headers=headers,
    )
    assert r.json()["title"] == "Day out" and r.json()["start_date"] == "2026-12-01"
    assert client.delete(f"/trips/{trip['id']}", headers=headers).status_code == 204
    assert client.get(f"/trips/{trip['id']}", headers=headers).status_code == 404
    assert client.get("/trips", headers=headers).json() == []
