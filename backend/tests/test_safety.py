"""V2 Phase 3 Core: Lake Louise score, emergency contacts, SOS events, symptom checks (V2-P3-07)."""

import csv
import json
import uuid
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.algorithms.lake_louise import Answers, RedFlag, score
from app.models import SosEvent, SymptomCheck
from app.services.safety import normalise_phone
from tests.conftest import register

ROOT = Path(__file__).resolve().parents[2]
CASES = json.loads((Path(__file__).parent / "data" / "lake_louise_cases.json").read_text())["cases"]


# ------------------------------------------------------------- Lake Louise
@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_lake_louise_shared_cases(case):
    a = case["answers"]
    got = score(Answers(a["headache"], a["gi"], a["fatigue"], a["dizziness"], list(a["red_flags"])))
    assert got.total == case["expect"]["total"]
    assert got.severity == case["expect"]["severity"]
    assert got.result == case["expect"]["result"]
    assert got.reasons == case["expect"]["reasons"]


@pytest.mark.parametrize(
    "answers",
    [
        Answers(4, 0, 0, 0),
        Answers(-1, 0, 0, 0),
        Answers(1, 0, 0, True),  # a bool is not a score
        Answers(1, 0, 0, 0, ["dizzy"]),  # unknown red flag
    ],
)
def test_lake_louise_rejects_bad_answers(answers):
    with pytest.raises(ValueError):
        score(answers)


def test_red_flag_codes_match_the_shared_table():
    used = {f for c in CASES for f in c["answers"]["red_flags"]}
    assert used == {f.value for f in RedFlag}


# ------------------------------------------------------------------ phones
@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("9812345678", "+9779812345678"),
        ("981-234-5678", "+9779812345678"),
        ("9741234567", "+9779741234567"),
        ("+977 981 2345678", "+9779812345678"),
        ("009779812345678", "+9779812345678"),
        ("01-4440292", "+97714440292"),
        ("+44 20 7946 0958", "+442079460958"),
    ],
)
def test_normalise_phone(raw, expected):
    assert normalise_phone(raw) == expected


@pytest.mark.parametrize("raw", ["100", "12345", "98123", "+0123456789", "abc", "981234567890123"])
def test_normalise_phone_rejects(raw):
    with pytest.raises(ValueError):
        normalise_phone(raw)


# -------------------------------------------------------- emergency contacts
def test_contacts_need_login(client):
    assert client.get("/me/emergency-contacts").status_code == 401


def test_contact_crud_and_phone_normalised(client, user):
    _, _, headers = user
    r = client.post(
        "/me/emergency-contacts",
        json={
            "name": "Dad",
            "phone": "98 1234 5678",
            "email": "dad@example.com",
            "relation": "Father",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    contact = r.json()
    assert contact["phone"] == "+9779812345678"
    assert contact["sort_order"] == 0

    r = client.patch(
        f"/me/emergency-contacts/{contact['id']}",
        json={"phone": "9851234567", "email": None},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["phone"] == "+9779851234567"
    assert r.json()["email"] is None
    assert r.json()["name"] == "Dad"  # untouched

    second = client.post(
        "/me/emergency-contacts", json={"name": "Sister", "phone": "9801234567"}, headers=headers
    ).json()
    assert second["sort_order"] == 1
    names = [c["name"] for c in client.get("/me/emergency-contacts", headers=headers).json()]
    assert names == ["Dad", "Sister"]

    url = f"/me/emergency-contacts/{contact['id']}"
    assert client.delete(url, headers=headers).status_code == 204
    names = [c["name"] for c in client.get("/me/emergency-contacts", headers=headers).json()]
    assert names == ["Sister"]
    # Deleting twice is a 404, not a second delete.
    assert client.delete(url, headers=headers).status_code == 404


def test_a_user_only_sees_their_own_contacts(client, user):
    _, _, headers = user
    other = register(client)
    mine = client.post(
        "/me/emergency-contacts", json={"name": "Mum", "phone": "9812345678"}, headers=headers
    ).json()
    assert client.get("/me/emergency-contacts", headers=other).json() == []
    r = client.patch(f"/me/emergency-contacts/{mine['id']}", json={"name": "X"}, headers=other)
    assert r.status_code == 404
    assert r.json()["detail"] == "Contact not found"
    assert client.delete(f"/me/emergency-contacts/{mine['id']}", headers=other).status_code == 404


def test_sixth_contact_is_refused(client):
    headers = register(client)
    for i in range(5):
        r = client.post(
            "/me/emergency-contacts",
            json={"name": f"Friend {i}", "phone": f"980000000{i}"},
            headers=headers,
        )
        assert r.status_code == 201, r.text
    r = client.post(
        "/me/emergency-contacts", json={"name": "Friend 6", "phone": "9800000006"}, headers=headers
    )
    assert r.status_code == 422
    assert "at most 5" in r.json()["detail"]


def test_bad_phone_is_422_with_a_message(client, user):
    _, _, headers = user
    r = client.post("/me/emergency-contacts", json={"name": "X", "phone": "12345"}, headers=headers)
    assert r.status_code == 422
    assert r.json()["detail"] == "Invalid phone number"


# ------------------------------------------------------------------------ SOS
def _sos(**extra) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "latitude": 27.98,
        "longitude": 86.83,
        "accuracy_m": 12,
        "message": "SOS from Bato: I need help. My location: 27.98, 86.83",
        "sent_at": "2026-11-24T14:05:00+05:45",
        **extra,
    }


def test_sos_needs_login(client):
    assert client.post("/sos-events", json=_sos()).status_code == 401


def test_sos_is_saved_once_with_the_user(client, db):
    headers = register(client)
    body = _sos()
    for _ in range(2):  # the offline queue may send it again after a lost response
        r = client.post("/sos-events", json=body, headers=headers)
        assert r.status_code == 201, r.text
    rows = db.scalars(select(SosEvent).where(SosEvent.id == uuid.UUID(body["id"]))).all()
    assert len(rows) == 1
    assert rows[0].accuracy_m == 12
    assert float(rows[0].latitude) == pytest.approx(27.98)
    me = client.get("/me", headers=headers).json()
    assert str(rows[0].user_id) == me["id"]


def test_sos_without_a_position_is_fine_but_half_a_position_is_not(client, user):
    _, _, headers = user
    r = client.post(
        "/sos-events", json=_sos(latitude=None, longitude=None, accuracy_m=None), headers=headers
    )
    assert r.status_code == 201
    r = client.post("/sos-events", json=_sos(longitude=None), headers=headers)
    assert r.status_code == 422


def test_sos_id_of_another_user_is_a_conflict(client, user):
    _, _, headers = user
    body = _sos()
    assert client.post("/sos-events", json=body, headers=headers).status_code == 201
    assert client.post("/sos-events", json=body, headers=register(client)).status_code == 409


def test_admin_stats_count_sos_and_symptom_checks(client, admin, user):
    _, _, headers = user
    before = client.get("/admin/stats", headers=admin).json()
    client.post("/sos-events", json=_sos(), headers=headers)
    after = client.get("/admin/stats", headers=admin).json()
    assert after["sos_events"] == before["sos_events"] + 1
    assert "symptom_checks" in after


# ------------------------------------------------------------- symptom checks
def _check(**extra) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "altitude_m": 4400,
        "headache": 2,
        "gi": 1,
        "fatigue": 1,
        "dizziness": 0,
        "red_flags": [],
        "checked_at": "2026-11-24T08:00:00+05:45",
        **extra,
    }


def _first_trek(client) -> dict:
    return client.get("/treks").json()["items"][0]


def test_symptom_check_is_scored_by_the_server(client, user):
    _, _, headers = user
    trek = _first_trek(client)
    r = client.post("/symptom-checks", json=_check(trek_id=trek["id"]), headers=headers)
    assert r.status_code == 201, r.text
    out = r.json()
    assert (out["total"], out["severity"], out["result"]) == (4, "mild", "rest")
    assert out["trek_name"] == trek["name"]

    r = client.post(
        "/symptom-checks",
        json=_check(headache=0, gi=0, fatigue=0, red_flags=["breathless"]),
        headers=headers,
    )
    assert r.json()["result"] == "descend"
    assert r.json()["reasons"] == ["RED_FLAG_BREATHLESS", "LOW_SCORE"]


def test_symptom_history_is_own_and_newest_first(client, db):
    headers = register(client)
    older = _check(checked_at="2026-11-20T08:00:00+05:45")
    newer = _check(checked_at="2026-11-22T08:00:00+05:45", headache=3, gi=2, fatigue=3, dizziness=2)
    for body in (older, newer, older):  # the older one twice: saved once
        assert client.post("/symptom-checks", json=body, headers=headers).status_code == 201
    history = client.get("/me/symptom-checks", headers=headers).json()
    assert [h["id"] for h in history] == [newer["id"], older["id"]]
    assert history[0]["result"] == "descend"
    assert client.get("/me/symptom-checks", headers=register(client)).json() == []
    count = db.scalar(
        select(func.count())
        .select_from(SymptomCheck)
        .where(SymptomCheck.id == uuid.UUID(older["id"]))
    )
    assert count == 1


@pytest.mark.parametrize(
    "extra", [{"headache": 4}, {"gi": -1}, {"red_flags": ["dizzy"]}, {"altitude_m": 12000}]
)
def test_symptom_check_validation(client, user, extra):
    _, _, headers = user
    assert client.post("/symptom-checks", json=_check(**extra), headers=headers).status_code == 422


def test_symptom_check_unknown_trek_is_404(client, user):
    _, _, headers = user
    r = client.post("/symptom-checks", json=_check(trek_id=str(uuid.uuid4())), headers=headers)
    assert r.status_code == 404


# ------------------------------------------------------ fixed emergency numbers
def test_app_copy_of_emergency_numbers_matches_the_csv():
    with (ROOT / "data" / "emergency_numbers.csv").open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    app_copy = json.loads((ROOT / "mobile" / "src" / "data" / "emergencyNumbers.json").read_text())
    fields = ("code", "phone", "name_en", "name_ne", "note_en", "note_ne")
    assert app_copy == [{k: r[k] for k in fields} for r in rows]
    assert all(r["source"] for r in rows)  # every number says where it was checked
    assert {r["phone"] for r in rows} >= {"100", "1144", "102"}
