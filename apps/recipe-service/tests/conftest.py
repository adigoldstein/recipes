import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session

# A long secret, so PyJWT does not warn that the key is weak.
TEST_SECRET = "test-secret-test-secret-test-secret"

# Set these before importing anything from `app`, because importing app.main
# checks the settings right away.
os.environ["JWT_SECRET"] = TEST_SECRET
os.environ["ENV"] = "dev"

from app.core.config import Settings, get_settings  # noqa: E402
from app.core.db import get_engine  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402
from app.core.security import CSRF_HEADER, CSRF_VALUE  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_settings(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    """Runs each test with clean settings, without the developer's `.env`."""
    monkeypatch.chdir(tmp_path)
    # Nx loads the project's `.env` into the environment, so changing the folder is
    # not enough. Remove the env var of every setting too.
    for name in Settings.model_fields:
        monkeypatch.delenv(name.upper(), raising=False)
    monkeypatch.setenv("JWT_SECRET", TEST_SECRET)
    monkeypatch.setenv("ENV", "dev")
    # TestClient uses plain http, and the browser never sends back a Secure cookie
    # over http.
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    # Every test starts with an empty database. test_demo_seed turns this back on.
    monkeypatch.setenv("SEED_DEMO", "false")
    get_settings.cache_clear()
    # The login limiter is shared by all tests, so reset it. Otherwise one test's
    # login attempts would count in the next test.
    limiter.reset()
    yield
    get_settings.cache_clear()
    # Close the open SQLite connections, so Windows can delete tmp_path afterwards.
    get_engine(tmp_path / "data").dispose()
    get_engine.cache_clear()


@pytest.fixture
def app() -> FastAPI:
    return create_app()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    """A test client that acts like the web app: it sends the CSRF header on every
    request (AD-19).

    Opening the client runs the app startup, which creates the temporary database.
    """
    with TestClient(app, headers={CSRF_HEADER: CSRF_VALUE}) as test_client:
        yield test_client


@pytest.fixture
def bare_client(app: FastAPI) -> Iterator[TestClient]:
    """A test client that sends no CSRF header, like a form on another site."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def session(client: TestClient) -> Iterator[Session]:
    """A database session on the same database that the client uses."""
    with Session(get_engine(get_settings().data_dir)) as db_session:
        yield db_session
