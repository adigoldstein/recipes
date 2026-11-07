"""`POST /api/imports/url`: a recipe page becomes a Hebrew draft (Story 5.4).

The fake provider goes with the fake page fetcher, so `fake://<fixture>` serves the
saved pages in `app/imports/fetchers/fake_pages` and nothing touches the network.
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import Environment, get_settings
from app.imports.fetchers.fake import FakePageFetcher
from app.imports.fetchers.http import HttpPageFetcher
from app.imports.fetchers.registry import FakeFetcherInProductionError, page_fetcher
from app.imports.models import ImportRun
from app.users.models import User
from tests.factories import add_user

LOGIN = "/api/auth/login"
PASSWORD = "correct horse"
URL = "/api/imports/url"


@pytest.fixture(autouse=True)
def fake_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDERS", "fake")


@pytest.fixture
def editor(client: TestClient, session: Session) -> User:
    user = add_user(session, email="editor@example.com", name="Dana")
    response = client.post(LOGIN, json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 200
    return user


def run_import(client: TestClient, url: str) -> Any:
    return client.post(URL, json={"url": url})


def runs(session: Session) -> list[ImportRun]:
    session.expire_all()
    return list(session.exec(select(ImportRun)).all())


def test_a_visitor_cannot_import(client: TestClient) -> None:
    assert run_import(client, "fake://json-ld-recipe").status_code == 401


def test_an_empty_url_is_a_validation_error(client: TestClient, editor: User) -> None:
    assert run_import(client, "").status_code == 422


def test_a_json_ld_page_gives_a_draft_with_its_source_and_photo(
    client: TestClient, editor: User, session: Session
) -> None:
    response = run_import(client, "fake://json-ld-recipe")
    assert response.status_code == 200
    draft = response.json()
    assert draft["title"]
    assert draft["source_url"] == "fake://json-ld-recipe"
    assert draft["photo_source_url"] == "https://example.com/cookies.jpg"
    [run] = runs(session)
    assert (run.source_kind, run.path, run.outcome) == ("url", "json_ld", "ok")
    # Nothing is saved.
    assert client.get("/api/recipes").json() == []


def test_a_page_without_json_ld_goes_through_the_text_path(
    client: TestClient, editor: User, session: Session
) -> None:
    draft = run_import(client, "fake://no-json-ld").json()
    # The fixture's og:image is relative, and a fake:// base cannot resolve it.
    assert draft["photo_source_url"] is None
    [run] = runs(session)
    assert (run.source_kind, run.path) == ("url", "llm")


def test_a_page_that_is_not_a_recipe_is_no_recipe_found(
    client: TestClient, editor: User, session: Session
) -> None:
    response = run_import(client, "fake://not-a-recipe")
    assert response.status_code == 400
    assert response.json()["code"] == "no_recipe_found"
    [run] = runs(session)
    assert run.outcome == "no_recipe_found"


def test_a_page_with_no_text_is_no_recipe_found_without_a_model_call(
    client: TestClient, editor: User, session: Session
) -> None:
    response = run_import(client, "fake://empty")
    assert response.json()["code"] == "no_recipe_found"
    assert runs(session) == []


@pytest.mark.parametrize(
    ("url", "status", "code"),
    [
        ("fake://cloudflare-challenge", 502, "fetch_challenged"),
        ("fake://forbidden", 400, "fetch_blocked"),
        ("fake://server-error", 502, "fetch_failed"),
        ("fake://no-such-page", 502, "fetch_failed"),
        ("fake://too-large", 413, "fetch_too_large"),
        ("http://localhost/recipe", 400, "fetch_blocked"),
        ("http://127.0.0.1:8000/api/users", 400, "fetch_blocked"),
        ("http://169.254.169.254/latest/meta-data/", 400, "fetch_blocked"),
        ("http://10.1.2.3/", 400, "fetch_blocked"),
        ("file:///etc/passwd", 400, "fetch_blocked"),
    ],
)
def test_fetch_failures_have_stable_codes_and_are_not_logged(
    url: str,
    status: int,
    code: str,
    client: TestClient,
    editor: User,
    session: Session,
) -> None:
    response = run_import(client, url)
    assert response.status_code == status
    assert response.json()["code"] == code
    assert runs(session) == []


def test_the_daily_cap_applies_to_url_imports(
    client: TestClient,
    editor: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("IMPORT_DAILY_CAP", "1")
    get_settings.cache_clear()
    assert run_import(client, "fake://json-ld-recipe").status_code == 200
    response = run_import(client, "fake://json-ld-recipe")
    assert response.status_code == 429
    assert response.json()["code"] == "import_cap_reached"


def test_the_fake_fetcher_goes_with_the_fake_provider_only() -> None:
    settings = get_settings()
    assert isinstance(page_fetcher(settings), FakePageFetcher)
    real = settings.model_copy(update={"llm_providers": ["gemini"]})
    assert isinstance(page_fetcher(real), HttpPageFetcher)


def test_the_fake_fetcher_refuses_production() -> None:
    settings = get_settings().model_copy(update={"env": Environment.PRODUCTION})
    with pytest.raises(FakeFetcherInProductionError):
        page_fetcher(settings)
