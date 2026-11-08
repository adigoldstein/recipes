"""`GET /api/imports/providers`: the active engine and its timeout (Story 5.5)."""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import get_settings
from app.users.models import User
from tests.factories import add_user

LOGIN = "/api/auth/login"
URL = "/api/imports/providers"


@pytest.fixture
def editor(client: TestClient, session: Session) -> User:
    user = add_user(session, email="editor@example.com", name="Dana")
    response = client.post(
        LOGIN, json={"email": user.email, "password": "correct horse"}
    )
    assert response.status_code == 200
    return user


def use(monkeypatch: pytest.MonkeyPatch, **env: str) -> None:
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    get_settings.cache_clear()


def test_a_visitor_cannot_list_the_engines(client: TestClient) -> None:
    assert client.get(URL).status_code == 401


def test_the_active_engine_is_returned_with_its_timeout(
    client: TestClient, editor: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(
        monkeypatch,
        LLM_PROVIDERS="anthropic",
        ANTHROPIC_API_KEY="test-key",
        ANTHROPIC_TIMEOUT_SECONDS="45",
    )
    response = client.get(URL)
    assert response.status_code == 200
    assert response.json() == [{"name": "anthropic", "timeout_s": 45}]


def test_only_the_first_engine_is_active(
    client: TestClient, editor: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, LLM_PROVIDERS="fake,gemini")
    assert client.get(URL).json() == [{"name": "fake", "timeout_s": 30}]


def test_the_default_engine_is_haiku(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.llm_providers == ["anthropic"]
    assert settings.anthropic_model.startswith("claude-haiku")


@pytest.mark.parametrize("providers", ["gemini", "anthropic", "ollama", ""])
def test_an_engine_that_is_unknown_or_has_no_key_is_provider_unavailable(
    providers: str, client: TestClient, editor: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, LLM_PROVIDERS=providers)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    response = client.get(URL)
    assert response.status_code == 400
    assert response.json()["code"] == "provider_unavailable"
