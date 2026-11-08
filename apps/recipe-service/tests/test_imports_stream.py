"""The import progress stream (Story 5.6, AD-40): event order, errors, cancel."""

import asyncio
import time

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import get_settings
from app.imports.models import ImportRun
from app.imports.providers.fake import FakeProvider
from app.imports.repository import ImportRepository
from app.imports.service import ImportJob, ImportService
from app.tags.repository import TagRepository
from app.tags.service import TagService
from app.users.models import User
from tests.factories import add_user
from tests.sse import ImportResult, parse_events

LOGIN = "/api/auth/login"


@pytest.fixture(autouse=True)
def fake_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDERS", "fake")


@pytest.fixture
def editor(client: TestClient, session: Session) -> User:
    user = add_user(session, email="editor@example.com", name="Dana")
    response = client.post(
        LOGIN, json={"email": user.email, "password": "correct horse"}
    )
    assert response.status_code == 200
    return user


def post(client: TestClient, kind: str, value: str) -> ImportResult:
    return ImportResult(client.post(f"/api/imports/{kind}", json={kind: value}))


def runs(session: Session) -> list[ImportRun]:
    session.expire_all()
    return list(session.exec(select(ImportRun)).all())


# --- Event order ------------------------------------------------------------------


def test_a_text_import_streams_its_stages_and_then_the_draft(
    client: TestClient, editor: User
) -> None:
    response = post(client, "text", "FAKE:ok")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-cache"
    assert response.stages == [
        ("fetch", "skipped"),
        ("extract", "started"),
        ("extract", "done"),
        ("translate", "skipped"),
        ("validate", "started"),
        ("validate", "done"),
        ("convert_units", "started"),
        ("convert_units", "done"),
    ]
    assert response.kinds[-1] == "draft"
    assert response.kinds.count("draft") == 1
    assert response.json()["title"]


def test_a_translated_draft_reports_the_translate_stage_as_done(
    client: TestClient, editor: User
) -> None:
    response = post(client, "text", "FAKE:english")
    assert ("translate", "done") in response.stages
    assert ("translate", "skipped") not in response.stages


def test_a_url_import_starts_with_a_real_fetch_stage(
    client: TestClient, editor: User
) -> None:
    response = post(client, "url", "fake://json-ld-recipe")
    assert response.stages[:3] == [
        ("fetch", "started"),
        ("fetch", "done"),
        ("extract", "started"),
    ]
    assert response.kinds[-1] == "draft"
    assert response.json()["source_url"] == "fake://json-ld-recipe"


# --- Errors before and after the stream starts ---------------------------------------


def test_an_engine_failure_is_an_error_event_after_the_stages_so_far(
    client: TestClient, editor: User, session: Session
) -> None:
    response = post(client, "text", "FAKE:unavailable")
    assert response.status_code == 200  # the stream had already started
    assert response.stages == [("fetch", "skipped"), ("extract", "started")]
    assert response.kinds[-1] == "error"
    assert response.json()["code"] == "llm_unavailable"
    assert "draft" not in response.kinds
    [run] = runs(session)
    assert run.outcome == "llm_unavailable"


def test_a_fetch_failure_is_an_error_event_and_a_fetch_stage_never_finishes(
    client: TestClient, editor: User
) -> None:
    response = post(client, "url", "fake://cloudflare-challenge")
    assert response.stages == [("fetch", "started")]
    assert response.json()["code"] == "fetch_challenged"


def test_checks_before_the_stream_keep_their_http_status(
    client: TestClient, editor: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("IMPORT_DAILY_CAP", "1")
    get_settings.cache_clear()
    assert post(client, "text", "FAKE:ok").status_code == 200
    capped = post(client, "text", "FAKE:ok")
    assert capped.status_code == 429
    assert capped.json()["code"] == "import_cap_reached"
    assert capped.events == []

    monkeypatch.setenv("IMPORT_DAILY_CAP", "50")
    monkeypatch.setenv("LLM_PROVIDERS", "ollama")
    get_settings.cache_clear()
    unknown = post(client, "text", "a recipe")
    assert unknown.status_code == 400
    assert unknown.json()["code"] == "provider_unavailable"


# --- Cancel ------------------------------------------------------------------------


def make_job(
    session: Session, text: str, editor: User
) -> tuple[ImportService, ImportJob]:
    service = ImportService(
        ImportRepository(session), TagService(TagRepository(session)), get_settings()
    )
    job = ImportJob(FakeProvider(), editor.id, "text", text=text)
    return service, job


def test_a_disconnect_cancels_the_engine_call_and_logs_it(
    client: TestClient, editor: User, session: Session
) -> None:
    service, job = make_job(session, "FAKE:slow", editor)
    gone = False

    async def is_disconnected() -> bool:
        return gone

    async def consume() -> list[str]:
        names: list[str] = []
        async for event, payload in service.stream(job, is_disconnected):
            names.append(event)
            if event == "stage" and getattr(payload, "name", "") == "extract":
                nonlocal gone
                gone = True  # the client closes the connection while the engine works
        return names

    started = time.perf_counter()
    names = asyncio.run(consume())
    assert time.perf_counter() - started < 5  # the 20 s engine call was dropped
    assert "draft" not in names
    [run] = runs(session)
    assert run.outcome == "cancelled"
    assert client.get("/api/recipes").json() == []  # nothing saved


def test_closing_the_stream_early_cancels_the_work_too(
    client: TestClient, editor: User, session: Session
) -> None:
    service, job = make_job(session, "FAKE:slow", editor)

    async def never() -> bool:
        return False

    async def consume() -> None:
        stream = service.stream(job, never)
        async for _ in stream:
            pass  # not reached for the slow engine until it answers
            break
        await stream.aclose()
        await asyncio.sleep(0)

    started = time.perf_counter()
    asyncio.run(consume())
    assert time.perf_counter() - started < 5
    outcomes = [run.outcome for run in runs(session)]
    # Stopped before the engine call began: nothing to log; after: `cancelled`.
    assert outcomes in ([], ["cancelled"])


def test_sse_blocks_parse_back() -> None:
    body = 'event: stage\ndata: {"name":"fetch","status":"skipped"}\n\n'
    assert parse_events(body) == [("stage", {"name": "fetch", "status": "skipped"})]
