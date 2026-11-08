"""`POST /api/imports/text`: pasted text becomes a Hebrew draft (Story 5.2)."""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import get_settings
from app.imports.models import ImportAttempt, ImportRun
from app.imports.schemas import DraftRecipe
from app.imports.service import _split_tags
from app.users.models import User
from tests.factories import add_tag, add_user
from tests.sse import ImportResult

LOGIN = "/api/auth/login"
PASSWORD = "correct horse"
URL = "/api/imports/text"


@pytest.fixture(autouse=True)
def fake_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    """CI never calls a real model: the `fake` provider answers by scenario."""
    monkeypatch.setenv("LLM_PROVIDERS", "fake")


@pytest.fixture
def editor(client: TestClient, session: Session) -> User:
    user = add_user(session, email="editor@example.com", name="Dana")
    response = client.post(LOGIN, json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 200
    return user


def run_import(client: TestClient, text: str) -> ImportResult:
    return ImportResult(client.post(URL, json={"text": text}))


def runs(session: Session) -> list[ImportRun]:
    session.expire_all()
    return list(session.exec(select(ImportRun)).all())


# --- Access ------------------------------------------------------------------


def test_a_visitor_cannot_import(client: TestClient) -> None:
    assert run_import(client, "FAKE:ok").status_code == 401


def test_writes_without_the_csrf_header_are_403(
    bare_client: TestClient, client: TestClient, editor: User
) -> None:
    bare_client.cookies.update(client.cookies)
    response = bare_client.post(URL, json={"text": "FAKE:ok"})
    assert response.status_code == 403
    assert response.json()["code"] == "csrf_header_missing"


def test_empty_text_is_a_validation_error(client: TestClient, editor: User) -> None:
    assert run_import(client, "").status_code == 422


def test_text_over_the_limit_is_refused_and_not_logged(
    client: TestClient,
    editor: User,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("IMPORT_MAX_CHARS", "10")
    get_settings.cache_clear()
    response = run_import(client, "x" * 11)
    assert response.status_code == 413
    assert response.json()["code"] == "import_text_too_long"
    assert response.json()["params"] == {"max": 10}
    assert runs(session) == []


# --- A good draft ---------------------------------------------------------------


def test_a_draft_is_returned_validated_and_nothing_is_saved(
    client: TestClient, editor: User, session: Session
) -> None:
    response = run_import(client, "FAKE:ok")
    assert response.status_code == 200
    draft = DraftRecipe.model_validate(response.json())
    assert draft.title == "עוגיות שוקולד צ'יפס"
    assert [item.name for item in draft.ingredients][-1] == "מלח"
    to_taste = draft.ingredients[-1]
    assert to_taste.amount is None
    assert to_taste.unit is None
    assert client.get("/api/recipes").json() == []


def test_tags_come_from_the_existing_list_and_new_ones_are_proposals(
    client: TestClient, editor: User
) -> None:
    draft = run_import(client, "FAKE:ok").json()
    # "קינוח" is one of the seeded tags; "עוגיות" is not in the list yet.
    assert draft["tags"] == ["קינוח"]
    assert draft["new_tags"] == ["עוגיות"]
    tag_names = [tag["name"] for tag in client.get("/api/tags").json()]
    assert "עוגיות" not in tag_names


def test_fields_the_source_did_not_give_are_flagged(
    client: TestClient, editor: User
) -> None:
    assert run_import(client, "FAKE:ok").json()["missing_fields"] == []
    draft = run_import(client, "FAKE:imperial").json()
    assert draft["missing_fields"] == [
        "base_servings",
        "prep_time_minutes",
        "cook_time_minutes",
    ]


def test_a_translated_draft_is_marked_and_a_text_import_has_no_source_url(
    client: TestClient, editor: User
) -> None:
    english = run_import(client, "FAKE:english").json()
    assert english["translated"] is True
    assert english["missing_fields"] == ["base_servings"]
    ok = run_import(client, "FAKE:ok").json()
    assert ok["translated"] is False
    assert ok["source_url"] is None


def test_imperial_units_and_fahrenheit_are_converted_by_the_code(
    client: TestClient, editor: User
) -> None:
    draft = run_import(client, "FAKE:imperial").json()
    flour, milk, cheese, sugar = draft["ingredients"]
    assert (flour["amount"], flour["unit"]) == (455, "g")
    assert flour["source"] == {"amount": 1, "unit": "lb"}
    assert (milk["amount"], milk["unit"]) == (235, "ml")
    assert (cheese["amount"], cheese["unit"]) == (115, "g")
    # Cups and spoons are left alone.
    assert (sugar["amount"], sugar["unit"], sugar["source"]) == (1, "cup", None)
    oven, bake = draft["steps"]
    assert oven["description"] == "מחממים תנור ל-175°C."
    assert oven["source_text"] == "מחממים תנור ל-350°F."
    assert bake["source_text"] is None


# --- The log (AD-38) --------------------------------------------------------------


def test_a_good_import_writes_one_run_and_one_attempt(
    client: TestClient, editor: User, session: Session
) -> None:
    run_import(client, "FAKE:ok")
    [run] = runs(session)
    assert (run.provider, run.model, run.source_kind, run.path) == (
        "fake",
        "fake-1",
        "text",
        "llm",
    )
    assert run.user_id == editor.id
    assert run.outcome == "ok"
    assert run.first_try_valid is True
    assert run.retried is False
    assert (run.input_tokens, run.output_tokens) == (100, 50)
    assert run.prompt_version
    [attempt] = session.exec(select(ImportAttempt)).all()
    assert (attempt.run_id, attempt.attempt_no, attempt.outcome) == (run.id, 1, "ok")


def test_an_invalid_reply_is_retried_once_with_the_error(
    client: TestClient, editor: User, session: Session
) -> None:
    response = run_import(client, "FAKE:invalid-then-valid")
    assert response.status_code == 200
    [run] = runs(session)
    assert run.first_try_valid is False
    assert run.retried is True
    assert run.outcome == "ok"
    # Both calls are counted.
    assert (run.input_tokens, run.output_tokens) == (200, 100)


@pytest.mark.parametrize("scenario", ["invalid", "not-json"])
def test_a_second_invalid_reply_is_llm_invalid_output(
    scenario: str, client: TestClient, editor: User, session: Session
) -> None:
    response = run_import(client, f"FAKE:{scenario}")
    assert response.failed
    assert response.json()["code"] == "llm_invalid_output"
    [run] = runs(session)
    assert run.outcome == "llm_invalid_output"


@pytest.mark.parametrize(
    ("scenario", "code"),
    [
        ("timeout", "llm_timeout"),
        ("quota", "llm_quota"),
        ("unavailable", "llm_unavailable"),
    ],
)
def test_provider_failures_have_stable_codes_and_are_logged(
    scenario: str,
    code: str,
    client: TestClient,
    editor: User,
    session: Session,
) -> None:
    response = run_import(client, f"FAKE:{scenario}")
    assert response.failed
    assert response.json()["code"] == code
    [run] = runs(session)
    assert run.outcome == code
    assert (run.input_tokens, run.output_tokens) == (None, None)


def test_text_without_a_recipe_is_no_recipe_found(
    client: TestClient, editor: User, session: Session
) -> None:
    response = run_import(client, "FAKE:empty")
    assert response.failed
    assert response.json()["code"] == "no_recipe_found"
    [run] = runs(session)
    assert run.outcome == "no_recipe_found"


# --- The daily cap and the provider -------------------------------------------------


def test_the_daily_cap_is_global_and_returns_429(
    client: TestClient,
    editor: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("IMPORT_DAILY_CAP", "2")
    get_settings.cache_clear()
    assert run_import(client, "FAKE:ok").status_code == 200
    assert run_import(client, "FAKE:empty").failed  # failures count too
    response = run_import(client, "FAKE:ok")
    assert response.status_code == 429
    assert response.json()["code"] == "import_cap_reached"
    assert response.json()["params"] == {"cap": 2}


def test_a_provider_without_a_key_is_provider_unavailable(
    client: TestClient,
    editor: User,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_PROVIDERS", "gemini")
    get_settings.cache_clear()
    response = run_import(client, "a recipe")
    assert response.status_code == 400
    assert response.json()["code"] == "provider_unavailable"
    assert runs(session) == []


def test_an_unknown_provider_is_provider_unavailable(
    client: TestClient, editor: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LLM_PROVIDERS", "ollama")
    get_settings.cache_clear()
    response = run_import(client, "a recipe")
    assert response.status_code == 400
    assert response.json()["code"] == "provider_unavailable"


# --- Tag matching ---------------------------------------------------------------------


def test_tags_match_ignoring_case_and_dedupe(session: Session) -> None:
    add_tag(session, "Vegan")
    draft = DraftRecipe(
        title="x",
        tags=["vegan", "VEGAN", " קינוח ", ""],
        new_tags=["Vegan", "חדש", "חדש", "x" * 41],
    )
    tags, new_tags = _split_tags(draft, ["Vegan", "קינוח"])
    assert tags == ["Vegan", "קינוח"]
    assert new_tags == ["חדש"]
