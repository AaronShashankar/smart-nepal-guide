import pytest

from app.ml.train import activate, load_dataset, register, train
from app.models.enums import MlAlgorithm
from app.seed import sid

EBC = str(sid("trek", "everest-base-camp"))
ABC = str(sid("trek", "annapurna-base-camp"))
POON_HILL = str(sid("trek", "poon-hill"))
LEVELS = ["easy", "moderate", "hard", "risky"]


@pytest.fixture(scope="module")
def trained_model(tmp_path_factory):
    """Train a small forest on the seeded training_sample rows and make it active."""
    from app.core.db import SessionLocal

    with SessionLocal() as db, db.begin():
        result = train(load_dataset(db), n_trees=25)
        row = register(
            db, result.forest, MlAlgorithm.random_forest, result.forest_report, "test",
            models_dir=tmp_path_factory.mktemp("models"),
        )  # fmt: skip
        activate(db, row)
    return result


def set_profile(client, headers, **profile):
    body = {"date_of_birth": "1995-05-01", "interests": [], **profile}
    assert client.put("/me/profile", json=body, headers=headers).status_code == 200


# --------------------------------------------------------------------- itinerary
def test_stages_and_summary(client):
    r = client.get(f"/treks/{EBC}/stages")
    assert r.status_code == 200
    body = r.json()
    stages, summary = body["stages"], body["summary"]
    assert len(stages) == summary["total_days"] == 11
    day2 = stages[1]
    assert (day2["from_place"]["name"], day2["to_place"]["name"]) == ("Phakding", "Namche Bazaar")
    assert (day2["sleep_altitude_m"], day2["gain_m"]) == (3440, 830)
    assert stages[2]["is_rest_day"] and stages[5]["is_rest_day"]
    assert (summary["max_daily_gain_m"], summary["max_daily_gain_day"]) == (830, 2)
    assert summary["max_sleep_altitude_m"] == 5164
    assert summary["max_altitude_m"] == 5644  # Kala Patthar viewpoint
    assert summary["start_place"]["name"] == "Lukla"


def test_stage_place_names_are_localised(client):
    r = client.get(f"/treks/{EBC}/stages", headers={"Accept-Language": "ne"}).json()
    assert r["stages"][1]["to_place"]["name"] != "Namche Bazaar"


def test_acclimatisation_endpoint(client):
    ebc = client.get(f"/treks/{EBC}/acclimatisation").json()
    assert ebc["passes"] and ebc["status"] == "caution"
    assert [d["day"] for d in ebc["days"] if d["status"] == "caution"] == [2, 5, 7]
    abc = client.get(f"/treks/{ABC}/acclimatisation").json()
    assert not abc["passes"]
    assert abc["suggested_rest_days"][0]["before_day"] == 5


def test_unknown_trek_404(client):
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"/treks/{missing}/stages").status_code == 404


# -------------------------------------------------------------------------- risk
def test_predict_requires_login(client):
    assert client.post("/predict-risk", json={"trek_id": EBC, "month": 1}).status_code == 401


def test_predict_needs_complete_profile(client, user, trained_model):
    _, _, headers = user
    r = client.post("/predict-risk", json={"trek_id": EBC, "month": 1}, headers=headers)
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "PROFILE_INCOMPLETE"
    assert set(r.json()["detail"]["missing"]) == {
        "date_of_birth", "fitness_level", "trek_experience"
    }  # fmt: skip


def test_month_is_validated(client, user, trained_model):
    _, _, headers = user
    r = client.post("/predict-risk", json={"trek_id": EBC, "month": 13}, headers=headers)
    assert r.status_code == 422


def test_beginner_ebc_january_riskier_than_expert_poon_hill_october(client, user, trained_model):
    _, _, headers = user
    set_profile(client, headers, fitness_level="medium", trek_experience="none")
    risky = client.post("/predict-risk", json={"trek_id": EBC, "month": 1}, headers=headers)
    assert risky.status_code == 200, risky.text
    risky = risky.json()

    set_profile(client, headers, fitness_level="high", trek_experience="experienced")
    safe = client.post(
        "/predict-risk", json={"trek_id": POON_HILL, "month": 10}, headers=headers
    ).json()

    assert LEVELS.index(risky["level"]) > LEVELS.index(safe["level"])
    assert risky["level"] in ("hard", "risky")
    assert 0 < risky["confidence"] <= 1
    codes = {r["code"] for r in risky["reasons"]}
    assert codes and codes <= {"NO_EXPERIENCE", "WINTER_MONTH", "HIGH_ALTITUDE", "HIGH_DAILY_GAIN"}
    assert len(risky["reasons"]) <= 3
    assert risky["acclimatisation"]["passes"]
    assert risky["input"]["has_health_issue"] is False
    assert risky["model"]["algorithm"] == "random_forest"

    history = client.get("/me/predictions", headers=headers).json()
    assert [h["id"] for h in history] == [safe["id"], risky["id"]]  # newest first
    assert history[1]["trek_name"] == "Everest Base Camp Trek"


def test_health_answers_feed_the_model(client, user, trained_model):
    _, _, headers = user
    set_profile(
        client, headers, fitness_level="medium", trek_experience="beginner", has_asthma=True
    )
    r = client.post("/predict-risk", json={"trek_id": EBC, "month": 4}, headers=headers).json()
    assert r["input"]["has_health_issue"] is True
