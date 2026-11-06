"""Test setup: a separate database, rebuilt from the migrations and seed files on every run."""

import os
import tempfile
import uuid

import pytest
from dotenv import dotenv_values

# Point the app at the test database *before* any app module is imported.
_env = {**dotenv_values(".env"), **os.environ}
TEST_DB = _env.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://snguide:snguide@localhost:5432/snguide_test"
)
os.environ["DATABASE_URL"] = TEST_DB
os.environ.setdefault("JWT_SECRET", "test-secret-" + "x" * 32)
os.environ["UPLOADS_DIR"] = tempfile.mkdtemp(prefix="bato-test-uploads-")  # not backend/uploads

from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from alembic import command  # noqa: E402
from app import seed  # noqa: E402
from app.core.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def database():
    cfg = Config(str(seed.BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", TEST_DB)
    command.downgrade(cfg, "base")  # proves the migration also downgrades cleanly
    command.upgrade(cfg, "head")
    seed.run(seed.DEFAULT_DATA_DIR, migrate=False)
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def user(client):
    """A freshly registered user: (email, password, auth headers)."""
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    password = "trekking-2026"
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    return email, password, headers
