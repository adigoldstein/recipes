"""`require_role` and the CSRF guard, via a test-only protected router (AD-6, AD-30)."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session

from app.core.security import (
    CSRF_HEADER,
    SESSION_COOKIE,
    CurrentUser,
    Role,
    create_session_token,
    get_session_user,
    has_role,
    require_role,
)
from tests.conftest import TEST_SECRET
from tests.factories import add_user

PASSWORD = "correct horse"
LOGIN = "/api/auth/login"
EDITOR_AREA = "/api/guarded/editor"
ADMIN_AREA = "/api/guarded/admin"

# Counts how many times a protected mutation actually ran.
_writes: list[str] = []


def _guarded_router() -> APIRouter:
    router = APIRouter(prefix="/guarded", tags=["guarded"])

    @router.get("/editor")
    def get_editor_area(
        user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
    ) -> dict[str, str]:
        return {"email": user.email, "role": user.role}

    @router.post("/editor")
    def post_editor_area(
        user: Annotated[CurrentUser, Depends(require_role("editor"))],
    ) -> dict[str, str]:
        _writes.append(user.email)
        return {"ok": "yes"}

    @router.get("/admin")
    def get_admin_area(
        user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
    ) -> dict[str, str]:
        return {"email": user.email}

    return router


@pytest.fixture
def app(app: FastAPI) -> FastAPI:
    """The real app plus the test-only protected routes."""
    _writes.clear()
    app.include_router(_guarded_router(), prefix="/api")
    return app


def _sign_in(client: TestClient, email: str) -> None:
    response = client.post(LOGIN, json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def _body(response: Response) -> dict[str, object]:
    body: dict[str, object] = response.json()
    return body


# --- 401 / 403 ---------------------------------------------------------------


def test_a_visitor_gets_401_and_nothing_changes(client: TestClient) -> None:
    response = client.post(EDITOR_AREA)
    assert response.status_code == 401
    assert _body(response)["code"] == "unauthorized"
    assert _writes == []
    assert client.get(ADMIN_AREA).status_code == 401


def test_an_editor_may_use_editor_routes_but_not_admin_routes(
    client: TestClient, session: Session
) -> None:
    add_user(session, email="ed@example.com", role=Role.EDITOR)
    _sign_in(client, "ed@example.com")

    assert client.get(EDITOR_AREA).json() == {
        "email": "ed@example.com",
        "role": "editor",
    }
    assert client.post(EDITOR_AREA).status_code == 200
    assert _writes == ["ed@example.com"]

    forbidden = client.get(ADMIN_AREA)
    assert forbidden.status_code == 403
    assert _body(forbidden)["code"] == "forbidden"


def test_an_admin_satisfies_editor_and_admin_routes(
    client: TestClient, session: Session
) -> None:
    add_user(session, email="boss@example.com", role=Role.ADMIN)
    _sign_in(client, "boss@example.com")
    assert client.get(EDITOR_AREA).status_code == 200
    assert client.post(EDITOR_AREA).status_code == 200
    assert client.get(ADMIN_AREA).status_code == 200


def test_a_forged_expired_or_orphaned_cookie_is_401(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, role=Role.ADMIN)
    expired = create_session_token(
        user.id, TEST_SECRET, now=datetime.now(UTC) - timedelta(days=8)
    )
    forged = jwt.encode(
        {"sub": str(user.id), "exp": datetime.now(UTC) + timedelta(days=1)},
        "another-secret-another-secret-another",
        algorithm="HS256",
    )
    for token in (expired, forged, "garbage"):
        client.cookies.set(SESSION_COOKIE, token)
        assert client.get(ADMIN_AREA).status_code == 401


# --- the database decides on every request (AD-30) ---------------------------


def test_a_demotion_takes_effect_on_the_next_request(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, role=Role.ADMIN)
    _sign_in(client, user.email)
    assert client.get(ADMIN_AREA).status_code == 200

    user.role = Role.EDITOR
    session.add(user)
    session.commit()

    assert client.get(ADMIN_AREA).status_code == 403
    assert client.get(EDITOR_AREA).status_code == 200


def test_a_block_takes_effect_on_the_next_request(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, role=Role.EDITOR)
    _sign_in(client, user.email)
    assert client.post(EDITOR_AREA).status_code == 200

    user.is_blocked = True
    session.add(user)
    session.commit()

    blocked = client.post(EDITOR_AREA)
    assert blocked.status_code == 401
    assert _writes == [user.email]


def test_a_deleted_user_is_401(client: TestClient, session: Session) -> None:
    user = add_user(session, role=Role.EDITOR)
    _sign_in(client, user.email)
    session.delete(user)
    session.commit()
    assert client.get(EDITOR_AREA).status_code == 401


# --- CSRF (AD-6, AD-21) ------------------------------------------------------


def test_a_mutation_without_the_header_is_403_even_for_a_visitor(
    bare_client: TestClient,
) -> None:
    response = bare_client.post(EDITOR_AREA)
    assert response.status_code == 403
    assert _body(response)["code"] == "csrf_header_missing"
    assert _writes == []


def test_a_wrong_header_value_is_403(bare_client: TestClient) -> None:
    response = bare_client.post(EDITOR_AREA, headers={CSRF_HEADER: "fetch"})
    assert response.status_code == 403
    assert _body(response)["code"] == "csrf_header_missing"


def test_a_signed_in_editor_without_the_header_changes_nothing(
    client: TestClient, bare_client: TestClient, session: Session
) -> None:
    add_user(session, role=Role.EDITOR)
    _sign_in(client, "adi@example.com")
    bare_client.cookies.set(SESSION_COOKIE, client.cookies[SESSION_COOKIE])
    assert bare_client.post(EDITOR_AREA).status_code == 403
    assert _writes == []


@pytest.mark.parametrize("path", ["/api/auth/login", "/api/auth/logout"])
def test_login_and_logout_need_the_header_too(
    bare_client: TestClient, path: str
) -> None:
    response = bare_client.post(path, json={"email": "a@b.co", "password": "x"})
    assert response.status_code == 403
    assert _body(response)["code"] == "csrf_header_missing"


def test_reads_never_need_the_header(bare_client: TestClient) -> None:
    assert bare_client.get("/api/auth/session").status_code == 200
    assert bare_client.get("/api/tags").status_code == 200
    assert bare_client.get(ADMIN_AREA).status_code == 401  # not 403


# --- the seam ----------------------------------------------------------------


def test_main_wires_the_current_user_provider(app: FastAPI) -> None:
    assert get_session_user in app.dependency_overrides


def test_the_unwired_seam_fails_loudly() -> None:
    with pytest.raises(RuntimeError, match="not wired"):
        get_session_user()


def test_has_role_ranks_admin_above_editor() -> None:
    assert has_role(Role.ADMIN, Role.EDITOR)
    assert has_role(Role.ADMIN, Role.ADMIN)
    assert has_role(Role.EDITOR, Role.EDITOR)
    assert not has_role(Role.EDITOR, Role.ADMIN)
