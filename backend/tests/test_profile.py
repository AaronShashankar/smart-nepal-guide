def test_update_me(client, user):
    _, _, headers = user
    r = client.patch(
        "/me",
        headers=headers,
        json={"full_name": "Pemba", "phone": "+977 9800000000", "preferred_lang": "ne"},
    )
    assert r.status_code == 200
    assert r.json()["full_name"] == "Pemba"
    assert r.json()["preferred_lang"] == "ne"


def test_profile_save_and_load(client, user):
    _, _, headers = user
    assert client.get("/me/profile", headers=headers).json()["fitness_level"] is None

    body = {
        "date_of_birth": "1998-04-14",
        "fitness_level": "medium",
        "trek_experience": "beginner",
        "has_heart_condition": False,
        "has_asthma": None,  # user skipped this question
        "budget_level": "low",
        "travel_style": "group",
        "interests": ["nature", "adventure"],
    }
    r = client.put("/me/profile", headers=headers, json=body)
    assert r.status_code == 200, r.text

    loaded = client.get("/me/profile", headers=headers).json()
    assert loaded["date_of_birth"] == "1998-04-14"
    assert loaded["fitness_level"] == "medium"
    assert loaded["has_asthma"] is None
    assert [i["code"] for i in loaded["interests"]] == ["adventure", "nature"]
    assert client.get("/me", headers=headers).json()["has_profile"] is True

    # Interest names follow Accept-Language
    ne = client.get("/me/profile", headers={**headers, "Accept-Language": "ne"}).json()
    assert {i["name"] for i in ne["interests"]} == {"प्रकृति", "साहसिक"}

    # PUT replaces: dropping interests clears them
    body["interests"] = []
    assert client.put("/me/profile", headers=headers, json=body).json()["interests"] == []


def test_profile_rejects_unknown_interest(client, user):
    _, _, headers = user
    r = client.put("/me/profile", headers=headers, json={"interests": ["shopping"]})
    assert r.status_code == 422


def test_profile_rejects_bad_enum(client, user):
    _, _, headers = user
    r = client.put("/me/profile", headers=headers, json={"fitness_level": "superhuman"})
    assert r.status_code == 422
