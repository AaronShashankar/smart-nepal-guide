import uuid
from datetime import timedelta

from app.core.security import ACCESS, REFRESH, create_token
from app.services import google


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_register_login_me(client, user):
    email, password, headers = user
    r = client.post("/auth/login", json={"email": email.upper(), "password": password})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["role"] == "traveller"
    assert me.json()["has_profile"] is False


def test_duplicate_email_rejected(client, user):
    email, password, _ = user
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 409


def test_wrong_password_fails(client, user):
    email, _, _ = user
    r = client.post("/auth/login", json={"email": email, "password": "not-the-password"})
    assert r.status_code == 401


def test_unknown_email_fails(client):
    r = client.post("/auth/login", json={"email": "nobody@example.com", "password": "whatever1"})
    assert r.status_code == 401


def test_short_password_rejected(client):
    r = client.post("/auth/register", json={"email": "short@example.com", "password": "123"})
    assert r.status_code == 422


def test_me_requires_token(client):
    assert client.get("/me").status_code == 401


def test_expired_token_rejected(client, user, db):
    email, _, headers = user
    me = client.get("/me", headers=headers).json()
    expired = create_token(uuid.UUID(me["id"]), ACCESS, expires_in=timedelta(seconds=-1))
    r = client.get("/me", headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401


def test_tampered_token_rejected(client, user):
    _, _, headers = user
    token = headers["Authorization"].removeprefix("Bearer ")
    r = client.get("/me", headers={"Authorization": f"Bearer {token[:-2]}xx"})
    assert r.status_code == 401


def test_refresh_token_flow(client, user):
    email, password, _ = user
    tokens = client.post("/auth/login", json={"email": email, "password": password}).json()
    r = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    new_access = r.json()["access_token"]
    assert client.get("/me", headers={"Authorization": f"Bearer {new_access}"}).status_code == 200


def test_access_token_cannot_be_used_to_refresh(client, user):
    _, _, headers = user
    access = headers["Authorization"].removeprefix("Bearer ")
    assert client.post("/auth/refresh", json={"refresh_token": access}).status_code == 401


def test_refresh_token_cannot_call_api(client, user):
    _, _, headers = user
    me = client.get("/me", headers=headers).json()
    refresh = create_token(uuid.UUID(me["id"]), REFRESH)
    assert client.get("/me", headers={"Authorization": f"Bearer {refresh}"}).status_code == 401


def test_google_login_creates_user_then_reuses_it(client, monkeypatch):
    email = f"g-{uuid.uuid4().hex[:6]}@gmail.com"
    monkeypatch.setattr(
        google,
        "verify_google_id_token",
        lambda token: {"email": email, "email_verified": True, "name": "Google User"},
    )
    first = client.post("/auth/google", json={"id_token": "fake", "preferred_lang": "ne"})
    assert first.status_code == 200
    headers = {"Authorization": f"Bearer {first.json()['access_token']}"}
    me = client.get("/me", headers=headers).json()
    assert me["auth_provider"] == "google"
    assert me["preferred_lang"] == "ne"
    second = client.post("/auth/google", json={"id_token": "fake"})
    assert second.status_code == 200
    me2 = client.get("/me", headers={"Authorization": f"Bearer {second.json()['access_token']}"})
    assert me2.json()["id"] == me["id"]


def test_google_login_rejects_bad_token(client, monkeypatch):
    def boom(token):
        raise google.GoogleAuthError("bad token")

    monkeypatch.setattr(google, "verify_google_id_token", boom)
    assert client.post("/auth/google", json={"id_token": "x"}).status_code == 401
