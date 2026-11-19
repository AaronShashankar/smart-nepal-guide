"""Version 2 Phase 1: packing checklist (rule-based expert system)."""

import pytest

from app.algorithms.packing import (
    MONSOON_MONTHS,
    WINTER_MONTHS,
    Facts,
    Reason,
    Rule,
    fires,
    packing_list,
    reason,
)
from app.seed import DEFAULT_DATA_DIR, read_csv, sid

EBC = str(sid("trek", "everest-base-camp"))
POON_HILL = str(sid("trek", "poon-hill"))

HIGH_WINTER = Facts(max_altitude_m=5644, total_days=11, month=1)
LOW_AUTUMN = Facts(max_altitude_m=3210, total_days=4, month=10)


# --------------------------------------------------------------- the rules
def test_always_fires_for_any_trip():
    assert fires(Rule("first_aid", "health", always=True), LOW_AUTUMN)


def test_every_set_condition_must_hold():
    microspikes = Rule("microspikes", "gear", min_altitude_m=3500, months=(12, 1, 2))
    assert fires(microspikes, HIGH_WINTER)
    assert not fires(microspikes, Facts(5644, 11, 10))  # high, but October
    assert not fires(microspikes, Facts(3210, 4, 1))  # January, but low


def test_thresholds_are_inclusive():
    rule = Rule("down_jacket", "clothing", min_altitude_m=4000)
    assert fires(rule, Facts(4000, 5, 10))
    assert not fires(rule, Facts(3999, 5, 10))
    assert fires(Rule("power_bank", "gear", min_days=10), Facts(3000, 10, 10))


def test_rule_without_conditions_never_fires():
    assert not fires(Rule("nothing", "gear"), HIGH_WINTER)


def test_reason_names_the_condition():
    assert reason(Rule("a", "gear", always=True)) == (Reason.ALWAYS, None)
    assert reason(Rule("b", "gear", min_altitude_m=4000)) == (Reason.ALTITUDE, 4000)
    assert reason(Rule("c", "gear", min_altitude_m=3500, months=(12, 1, 2))) == (
        Reason.WINTER,
        3500,
    )
    assert reason(Rule("d", "gear", months=(6, 7, 8, 9))) == (Reason.MONSOON, None)
    assert reason(Rule("e", "gear", min_days=10)) == (Reason.LONG_TREK, 10)


def test_permits_become_documents_after_the_fixed_ones():
    rules = [Rule("passport_copy", "documents", 10, always=True)]
    picks = packing_list(rules, LOW_AUTUMN, ["TIMS", "ACAP"])
    assert [p.code for p in picks] == ["passport_copy", "permit:ACAP", "permit:TIMS"]
    assert all(p.reason == Reason.PERMIT for p in picks[1:])


def test_month_must_be_valid():
    with pytest.raises(ValueError):
        packing_list([], Facts(3000, 5, 13), [])


def test_seed_month_rules_are_winter_or_monsoon():
    """reason() calls any month rule that is not all monsoon months WINTER: keep the data honest."""
    for row in read_csv(DEFAULT_DATA_DIR / "packing_items.csv"):
        months = {int(m) for m in row["months"].split(";") if m}
        if months:
            assert months <= WINTER_MONTHS or months <= MONSOON_MONTHS, row["code"]


# --------------------------------------------------------------------- API
def codes(body: dict) -> set[str]:
    return {i["code"] for g in body["groups"] for i in g["items"]}


def test_ebc_in_january_has_cold_weather_gear(client):
    r = client.get(f"/treks/{EBC}/packing", params={"month": 1})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["max_altitude_m"] == 5644 and body["total_days"] == 11
    got = codes(body)
    assert {"down_jacket", "microspikes", "sleeping_bag", "diamox", "power_bank"} <= got
    assert "leech_socks" not in got  # not monsoon
    assert body["total_items"] == len(got)
    assert [g["group"] for g in body["groups"]] == ["clothing", "gear", "health", "documents"]
    items = {i["code"]: i for g in body["groups"] for i in g["items"]}
    assert (items["down_jacket"]["reason"], items["down_jacket"]["value"]) == ("ALTITUDE", 4000)
    assert items["microspikes"]["reason"] == "WINTER"
    assert items["diamox"]["note"].startswith("Ask a doctor")


def test_poon_hill_in_october_is_a_much_shorter_list(client):
    ebc = client.get(f"/treks/{EBC}/packing", params={"month": 1}).json()
    body = client.get(f"/treks/{POON_HILL}/packing", params={"month": 10}).json()
    got = codes(body)
    assert not got & {"down_jacket", "microspikes", "sleeping_bag", "diamox", "gaiters"}
    assert body["total_items"] < ebc["total_items"] - 8


def test_monsoon_adds_rain_items(client):
    got = codes(client.get(f"/treks/{POON_HILL}/packing", params={"month": 7}).json())
    assert {"leech_socks", "pack_rain_cover", "insect_repellent"} <= got


def test_permit_items_match_the_trek_permits(client):
    for trek in (EBC, POON_HILL):
        permits = {p["code"] for p in client.get(f"/treks/{trek}").json()["permits"]}
        body = client.get(f"/treks/{trek}/packing", params={"month": 4}).json()
        listed = {c.removeprefix("permit:") for c in codes(body) if c.startswith("permit:")}
        assert listed == permits and permits


def test_packing_list_in_nepali(client):
    r = client.get(f"/treks/{EBC}/packing", params={"month": 1}, headers={"Accept-Language": "ne"})
    items = {i["code"]: i for g in r.json()["groups"] for i in g["items"]}
    assert items["down_jacket"]["name"] == "डाउन ज्याकेट"
    assert items["permit:SNP"]["name"].startswith("सगरमाथा राष्ट्रिय निकुञ्ज")


def test_packing_errors(client):
    assert client.get(f"/treks/{EBC}/packing").status_code == 422  # month is required
    assert client.get(f"/treks/{EBC}/packing", params={"month": 13}).status_code == 422
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"/treks/{missing}/packing", params={"month": 1}).status_code == 404
