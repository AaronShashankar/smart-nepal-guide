"""Version 2 Phase 1: altitude profile, KNN safer alternatives, weather, packing list."""

from dataclasses import dataclass
from math import sqrt

import pytest
import redis
import requests

from app.algorithms.altitude_profile import Kind, Point, interpolate, lerp, profile_points
from app.algorithms.knn import euclidean, k_nearest, normalise
from app.core import cache
from app.seed import sid
from app.services import weather
from app.services.alternatives import main_reason
from tests.test_risk_api import set_profile, trained_model  # noqa: F401 (fixture)

EBC = str(sid("trek", "everest-base-camp"))
POON_HILL = str(sid("trek", "poon-hill"))
GHOREPANI = str(sid("place", "ghorepani"))


@dataclass
class S:
    """A stage with only what the profile needs."""

    day: int
    from_name: str
    to_name: str
    from_altitude_m: int
    to_altitude_m: int
    distance_km: float
    highest_point_m: int | None = None

    @property
    def is_rest_day(self) -> bool:
        return self.from_name == self.to_name


# ------------------------------------------------------------- interpolation
def test_midpoint_is_halfway_up():
    assert lerp(0, 2000, 10, 3000, 5) == 2500
    points = [Point(0, 2000, 0, "A", Kind.start), Point(10, 3000, 1, "B", Kind.sleep)]
    assert interpolate(points, 5) == 2500
    assert interpolate(points, 2.5) == 2250


def test_outside_the_trek_gives_the_end_altitudes():
    points = [Point(0, 2000, 0, "A", Kind.start), Point(10, 3000, 1, "B", Kind.sleep)]
    assert interpolate(points, -1) == 2000
    assert interpolate(points, 99) == 3000


def test_rest_day_adds_no_km_and_stays_flat():
    stages = [
        S(1, "A", "B", 2000, 3000, 10),
        S(2, "B", "B", 3000, 3000, 4, highest_point_m=3500),  # acclimatisation hike
        S(3, "B", "C", 3000, 3400, 8),
    ]
    points = profile_points(stages)
    assert [(p.km, p.altitude_m, p.day, p.kind) for p in points] == [
        (0, 2000, 0, Kind.start),
        (10, 3000, 1, Kind.sleep),
        (10, 3000, 2, Kind.sleep),  # rest day: same km, same altitude, no spike
        (18, 3400, 3, Kind.sleep),
    ]
    assert interpolate(points, 14) == 3200  # between the rest day and day 3


def test_high_point_only_when_above_both_ends():
    over_a_pass = S(1, "A", "B", 3500, 3700, 12, highest_point_m=5400)
    below_the_end = S(1, "A", "B", 3500, 3700, 12, highest_point_m=3600)
    points = profile_points([over_a_pass])
    assert [(p.km, p.altitude_m, p.kind) for p in points] == [
        (0, 3500, Kind.start),
        (6, 5400, Kind.high),  # placed halfway through the day
        (12, 3700, Kind.sleep),
    ]
    assert len(profile_points([below_the_end])) == 2


def test_no_stages_no_points():
    assert profile_points([]) == []
    with pytest.raises(ValueError):
        interpolate([], 1)


# ---------------------------------------------------------------------- API
def test_ebc_profile_tops_out_at_kala_patthar(client):
    r = client.get(f"/treks/{EBC}/altitude-profile")
    assert r.status_code == 200, r.text
    body = r.json()
    points = body["points"]
    top = max(points, key=lambda p: p["altitude_m"])
    assert body["max_altitude_m"] == 5644 == top["altitude_m"]
    assert top["day"] == 9 and top["kind"] == "high"
    assert points[0] == {**points[0], "km": 0, "day": 0, "kind": "start", "place": "Lukla"}
    assert points[-1]["place"] == "Lukla" and body["total_days"] == 11
    # The two rest days (3 at Namche, 6 at Dingboche) add no distance: 123 km - 5 - 4
    assert body["total_km"] == 114
    rest = [p for p in points if p["day"] in (3, 6)]
    assert len(rest) == 2 and all(p["kind"] == "sleep" for p in rest)


def test_profile_colours_match_the_acclimatisation_check(client):
    profile = client.get(f"/treks/{EBC}/altitude-profile").json()["points"]
    checks = client.get(f"/treks/{EBC}/acclimatisation").json()["days"]
    status_of = {d["day"]: d["status"] for d in checks}
    for p in profile[1:]:
        assert p["status"] == status_of[p["day"]]
    assert {p["status"] for p in profile if p["day"] in (2, 5, 7)} == {"caution"}


def test_profile_place_names_are_localised(client):
    r = client.get(f"/treks/{POON_HILL}/altitude-profile", headers={"Accept-Language": "ne"})
    names = [p["place"] for p in r.json()["points"] if p["place"]]
    assert "घोरेपानी" in names


# ----------------------------------------------------------------------- KNN
def test_euclidean_on_known_vectors():
    assert euclidean([0, 0], [3, 4]) == 5
    assert euclidean([1, 2, 3], [1, 2, 3]) == 0
    assert euclidean([0, 0, 0, 0], [1, 1, 1, 1]) == 2
    with pytest.raises(ValueError):
        euclidean([1], [1, 2])


def test_min_max_scaling_gives_0_and_1_at_the_ends():
    scaled = normalise([[2860, 3], [5644, 11], [4252, 7]])
    assert scaled[0] == [0, 0] and scaled[1] == [1, 1]
    assert scaled[2] == [pytest.approx(0.5), pytest.approx(0.5)]
    assert normalise([[5, 1], [5, 2]]) == [[0, 0], [0, 1]]  # a constant column becomes 0
    assert normalise([]) == []


def test_k_nearest_sorted_and_limited():
    others = [[1.0, 1.0], [0.1, 0.0], [0.5, 0.5], [0.1, 0.0]]
    nearest = k_nearest([0.0, 0.0], others, 3)
    assert [i for i, _ in nearest] == [1, 3, 2]  # a tie keeps the original order
    assert nearest[2][1] == pytest.approx(sqrt(0.5))
    assert k_nearest([0.0, 0.0], others, 0) == []


def test_main_reason_is_the_biggest_improvement():
    # features: altitude, daily gain, days, km per day (normalised)
    assert main_reason([1.0, 0.9, 1.0, 0.5], [0.2, 0.8, 0.9, 0.6]) == "max_altitude_m"
    assert main_reason([0.5, 0.5, 0.5, 0.5], [0.6, 0.5, 0.7, 0.5]) is None


# -------------------------------------------------------- safer alternatives
def alternatives(client, headers, trek, month):
    r = client.get(f"/treks/{trek}/safer-alternatives?month={month}", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_beginner_ebc_january_gets_only_lower_rated_treks(client, user, trained_model):  # noqa: F811
    _, _, headers = user
    set_profile(client, headers, fitness_level="medium", trek_experience="none")
    body = alternatives(client, headers, EBC, 1)
    levels = ["easy", "moderate", "hard", "risky"]
    assert body["level"] in ("hard", "risky") and body["k"] == 4
    assert 1 <= len(body["items"]) <= 3
    for item in body["items"]:
        assert levels.index(item["level"]) < levels.index(body["level"])
        assert item["trek"]["id"] != EBC
        assert item["why"] in ("LOWER_ALTITUDE", "SMALLER_GAIN", "FEWER_DAYS", "SHORTER_DAYS")
        assert item["why_to"] < item["why_from"]
    assert [i["distance"] for i in body["items"]] == sorted(i["distance"] for i in body["items"])
    # Nothing is saved to the risk history
    assert client.get("/me/predictions", headers=headers).json() == []


def test_expert_poon_hill_october_gets_nothing(client, user, trained_model):  # noqa: F811
    _, _, headers = user
    set_profile(client, headers, fitness_level="high", trek_experience="experienced")
    body = alternatives(client, headers, POON_HILL, 10)
    assert body["level"] == "easy" and body["items"] == []


def test_alternatives_need_login_profile_and_a_trek(client, user, trained_model):  # noqa: F811
    assert client.get(f"/treks/{EBC}/safer-alternatives?month=1").status_code == 401
    _, _, headers = user
    r = client.get(f"/treks/{EBC}/safer-alternatives?month=1", headers=headers)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "PROFILE_INCOMPLETE"
    set_profile(client, headers, fitness_level="medium", trek_experience="none")
    missing = "00000000-0000-0000-0000-000000000000"
    r = client.get(f"/treks/{missing}/safer-alternatives?month=1", headers=headers)
    assert r.status_code == 404
    assert (
        client.get(f"/treks/{EBC}/safer-alternatives?month=13", headers=headers).status_code == 422
    )


# ------------------------------------------------------------------- weather
OPEN_METEO = {
    "daily": {
        "time": [f"2026-11-{d}" for d in range(19, 26)],
        "weather_code": [0, 1, 2, 3, 61, 71, 0],
        "temperature_2m_max": [-4.1, -3.0, -5.2, -6.0, -2.0, -8.5, -4.0],
        "temperature_2m_min": [-16.7, -15.0, -17.1, -18.0, -12.0, -20.4, -16.0],
        "precipitation_sum": [0, 0, 0, 0, 1.2, 3.4, 0],
    }
}


class FakeRedis:
    """Enough of redis.Redis for app.core.cache (no expiry: the tests don't wait)."""

    def __init__(self, down: bool = False):
        self.data: dict[str, str] = {}
        self.ttl: dict[str, int] = {}
        self.down = down

    def get(self, key):
        if self.down:
            raise redis.ConnectionError("Redis is down")
        return self.data.get(key)

    def set(self, key, value, ex=None):
        if self.down:
            raise redis.ConnectionError("Redis is down")
        self.data[key], self.ttl[key] = value, ex


@pytest.fixture
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(cache, "_client", fake)
    return fake


@pytest.fixture
def open_meteo(monkeypatch):
    """Counts calls to Open-Meteo; set `.fail = True` to make it fail."""

    class Fake:
        calls = 0
        fail = False

        def __call__(self, lat, lng):
            self.calls += 1
            if self.fail:
                raise requests.ConnectionError("Open-Meteo is down")
            return OPEN_METEO

    fake = Fake()
    monkeypatch.setattr(weather, "fetch_open_meteo", fake)
    return fake


def test_second_call_within_the_ttl_is_a_cache_hit(client, fake_redis, open_meteo):
    first = client.get(f"/treks/{EBC}/weather")
    assert first.status_code == 200, first.text
    assert first.headers["X-Cache"] == "MISS" and open_meteo.calls == 1
    body = first.json()
    assert body["place"]["name"] == "Gorak Shep"  # EBC's highest sleeping place (5,164 m)
    assert len(body["days"]) == 7 and body["stale"] is False
    assert body["days"][0] == {
        "date": "2026-11-19", "code": 0, "max_c": -4.1, "min_c": -16.7, "rain_mm": 0
    }  # fmt: skip
    second = client.get(f"/treks/{EBC}/weather")
    assert second.headers["X-Cache"] == "HIT" and open_meteo.calls == 1
    assert second.json() == body
    key = weather.cache_key(body["place"]["latitude"], body["place"]["longitude"])
    assert fake_redis.ttl[key] == 3600
    assert fake_redis.ttl[key.replace("weather:", "weather:stale:")] == 24 * 3600


def test_nearby_places_share_one_cache_entry():
    assert weather.cache_key(27.9813, 86.8291) == weather.cache_key(27.9849, 86.8251)
    assert weather.cache_key(27.98, 86.83) != weather.cache_key(28.21, 83.95)


def test_stale_copy_when_open_meteo_fails(client, fake_redis, open_meteo):
    fresh = client.get(f"/places/{GHOREPANI}/weather").json()
    fake_redis.data = {k: v for k, v in fake_redis.data.items() if "stale" in k}  # 1 h is over
    open_meteo.fail = True
    r = client.get(f"/places/{GHOREPANI}/weather")
    assert r.status_code == 200 and r.headers["X-Cache"] == "STALE"
    assert r.json()["stale"] is True and r.json()["days"] == fresh["days"]
    fake_redis.data.clear()  # no copy at all
    assert client.get(f"/places/{GHOREPANI}/weather").status_code == 503


def test_weather_still_works_when_redis_is_down(client, monkeypatch, open_meteo):
    monkeypatch.setattr(cache, "_client", FakeRedis(down=True))
    for _ in range(2):
        r = client.get(f"/places/{GHOREPANI}/weather")
        assert r.status_code == 200 and r.headers["X-Cache"] == "MISS"
    assert open_meteo.calls == 2  # no cache, so Open-Meteo is asked every time


def test_weather_for_an_unknown_place_or_trek(client, fake_redis, open_meteo):
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"/places/{missing}/weather").status_code == 404
    assert client.get(f"/treks/{missing}/weather").status_code == 404
    assert open_meteo.calls == 0
