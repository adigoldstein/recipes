import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session

# Long enough that PyJWT does not warn about a weak HMAC key.
TEST_SECRET = "test-secret-test-secret-test-secret"

# Set before any `app` import: importing app.main validates config immediately.
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
    """Run each test away from any developer `.env`, with fresh cached settings.

    Nx loads the project's `.env` into the task environment, so clearing the cwd
    alone is not enough: every setting's env var is removed too.
    """
    monkeypatch.chdir(tmp_path)
    for name in Settings.model_fields:
        monkeypatch.delenv(name.upper(), raising=False)
    monkeypatch.setenv("JWT_SECRET", TEST_SECRET)
    monkeypatch.setenv("ENV", "dev")
    # TestClient talks plain http, and a Secure cookie would never be sent back.
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    get_settings.cache_clear()
    # The login limiter is process-wide, so one test's attempts must not leak.
    limiter.reset()
    yield
    get_settings.cache_clear()
    # Close pooled SQLite handles so Windows can delete tmp_path afterwards.
    get_engine(tmp_path / "data").dispose()
    get_engine.cache_clear()


@pytest.fixture
def app() -> FastAPI:
    return create_app()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    """Acts like the SPA, which sends the CSRF header on every non-GET call (AD-19).

    Entering the client runs the lifespan, which migrates the temp database.
    """
    with TestClient(app, headers={CSRF_HEADER: CSRF_VALUE}) as test_client:
        yield test_client


@pytest.fixture
def bare_client(app: FastAPI) -> Iterator[TestClient]:
    """A caller that sends no CSRF header, like a cross-site form post."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def session(client: TestClient) -> Iterator[Session]:
    """A session on the same migrated database the client talks to."""
    with Session(get_engine(get_settings().data_dir)) as db_session:
        yield db_session
