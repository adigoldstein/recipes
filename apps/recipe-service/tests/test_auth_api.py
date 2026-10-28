import asyncio
import uuid
from collections.abc import Callable, Coroutine
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session
from starlette.requests import Request

from app.core.config import get_settings
from app.core.errors import _app_error_handler, _rate_limit_handler
from app.core.rate_limit import limiter
from app.core.security import SESSION_COOKIE, Role, create_session_token
from tests.conftest import TEST_SECRET
from tests.factories import add_user

EMAIL = "adi@example.com"
PASSWORD = "correct horse"
LOGIN = "/api/auth/login"
SESSION = "/api/auth/session"
LOGOUT = "/api/auth/logout"
SECRET = TEST_SECRET


def _login(
    client: TestClient, email: str = EMAIL, password: str = PASSWORD
) -> Response:
    response: Response = client.post(LOGIN, json={"email": email, "password": password})
    return response


def _set_cookie(response: Response) -> str:
    return response.headers["set-cookie"].lower()


def _with_cookie(client: TestClient, token: str) -> Response:
    client.cookies.set(SESSION_COOKIE, token)
    response: Response = client.get(SESSION)
    return response


# --- login -------------------------------------------------------------------


def test_login_returns_the_user_and_sets_the_session_cookie(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, name="עדי", role=Role.ADMIN)
    response = _login(client)
    assert response.status_code == 200
    assert response.json() == {
        "user": {"id": str(user.id), "email": EMAIL, "name": "עדי", "role": "admin"}
    }
    assert SESSION_COOKIE in client.cookies


def test_the_cookie_is_httponly_lax_and_lasts_seven_days(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    cookie = _set_cookie(_login(client))
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "max-age=604800" in cookie
    assert "path=/" in cookie


def test_the_cookie_is_secure_only_when_configured(
    monkeypatch: pytest.MonkeyPatch, client: TestClient, session: Session
) -> None:
    add_user(session)
    monkeypatch.setenv("COOKIE_SECURE", "false")
    get_settings.cache_clear()
    assert "; secure" not in _set_cookie(_login(client))
    client.cookies.clear()
    monkeypatch.setenv("COOKIE_SECURE", "true")
    get_settings.cache_clear()
    assert "; secure" in _set_cookie(_login(client))


def test_the_cookie_holds_a_jwt_for_the_user(
    client: TestClient, session: Session
) -> None:
    user = add_user(session)
    _login(client)
    claims = jwt.decode(client.cookies[SESSION_COOKIE], SECRET, algorithms=["HS256"])
    assert claims["sub"] == str(user.id)


def test_the_email_is_matched_without_case(
    client: TestClient, session: Session
) -> None:
    add_user(session, email="Adi@Example.com")
    assert _login(client, "ADI@example.COM").status_code == 200


def test_wrong_password_and_unknown_email_get_the_same_400(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    wrong_password = _login(client, password="not the password")
    unknown_email = _login(client, email="nobody@example.com")
    assert wrong_password.status_code == unknown_email.status_code == 400
    assert wrong_password.json() == unknown_email.json()
    assert wrong_password.json()["code"] == "invalid_credentials"
    assert "set-cookie" not in wrong_password.headers


def test_a_blocked_user_cannot_log_in_and_is_not_told_why(
    client: TestClient, session: Session
) -> None:
    add_user(session, is_blocked=True)
    response = _login(client)
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_credentials"
    assert "set-cookie" not in response.headers


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"email": EMAIL},
        {"password": PASSWORD},
        {"email": "", "password": PASSWORD},
        {"email": EMAIL, "password": ""},
        {"email": EMAIL, "password": "x" * 129},
    ],
)
def test_a_malformed_login_body_is_a_422(
    client: TestClient, session: Session, body: dict[str, str]
) -> None:
    add_user(session)
    assert client.post(LOGIN, json=body).status_code == 422


def test_a_malformed_email_is_just_wrong_credentials(client: TestClient) -> None:
    assert _login(client, email="not-an-email").status_code == 400


# --- rate limit --------------------------------------------------------------


def test_the_sixth_attempt_in_a_minute_is_a_429(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    for _ in range(5):
        assert _login(client, password="wrong password").status_code == 400
    blocked = _login(client)
    assert blocked.status_code == 429
    assert blocked.json() == {"detail": "Too many attempts", "code": "rate_limited"}
    assert blocked.headers["retry-after"] == "60"
    assert SESSION_COOKIE not in client.cookies


def test_successful_logins_count_too(client: TestClient, session: Session) -> None:
    add_user(session)
    for _ in range(5):
        assert _login(client).status_code == 200
    assert _login(client).status_code == 429


def test_the_limit_applies_to_login_only(client: TestClient, session: Session) -> None:
    add_user(session)
    for _ in range(6):
        _login(client, password="wrong password")
    assert client.get(SESSION).status_code == 200
    assert client.post(LOGOUT).status_code == 204


def test_the_limiter_can_be_reset(client: TestClient, session: Session) -> None:
    add_user(session)
    for _ in range(6):
        _login(client, password="wrong password")
    limiter.reset()
    assert _login(client).status_code == 200


# --- session -----------------------------------------------------------------


def test_a_visitor_gets_a_200_with_no_user(client: TestClient) -> None:
    response = client.get(SESSION)
    assert response.status_code == 200
    assert response.json() == {"user": None}
    assert "set-cookie" not in response.headers


def test_a_signed_in_user_is_returned_by_the_session_endpoint(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, role=Role.EDITOR)
    _login(client)
    assert client.get(SESSION).json()["user"] == {
        "id": str(user.id),
        "email": EMAIL,
        "name": "Adi",
        "role": "editor",
    }


def test_the_session_endpoint_never_exposes_the_password_hash(
    client: TestClient, session: Session
) -> None:
    user = add_user(session)
    _login(client)
    response = client.get(SESSION)
    assert user.password_hash not in response.text
    assert set(response.json()["user"]) == {"id", "email", "name", "role"}


def test_a_role_change_shows_on_the_next_request(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, role=Role.EDITOR)
    _login(client)
    user.role = Role.ADMIN
    session.add(user)
    session.commit()
    assert client.get(SESSION).json()["user"]["role"] == "admin"


def test_a_blocked_user_is_a_visitor_and_the_cookie_is_cleared(
    client: TestClient, session: Session
) -> None:
    user = add_user(session)
    _login(client)
    user.is_blocked = True
    session.add(user)
    session.commit()
    response = client.get(SESSION)
    assert response.json() == {"user": None}
    assert "max-age=0" in _set_cookie(response)


def test_a_deleted_user_is_a_visitor(client: TestClient, session: Session) -> None:
    user = add_user(session)
    _login(client)
    session.delete(user)
    session.commit()
    assert client.get(SESSION).json() == {"user": None}


@pytest.mark.parametrize(
    "token",
    [
        "garbage",
        create_session_token(uuid.uuid4(), "another-secret-another-secret-xx"),
        create_session_token(
            uuid.uuid4(), SECRET, now=datetime.now(UTC) - timedelta(days=8)
        ),
    ],
    ids=["garbage", "wrong-signature", "expired"],
)
def test_a_bad_cookie_is_a_visitor_and_is_cleared(
    client: TestClient, token: str
) -> None:
    response = _with_cookie(client, token)
    assert response.status_code == 200
    assert response.json() == {"user": None}
    assert "max-age=0" in _set_cookie(response)


def test_a_valid_token_for_an_unknown_user_is_a_visitor(client: TestClient) -> None:
    token = create_session_token(uuid.uuid4(), SECRET)
    assert _with_cookie(client, token).json() == {"user": None}


# --- logout ------------------------------------------------------------------


def test_logout_clears_the_cookie_and_ends_the_session(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    _login(client)
    response = client.post(LOGOUT)
    assert response.status_code == 204
    cookie = _set_cookie(response)
    assert "max-age=0" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert client.get(SESSION).json() == {"user": None}


def test_logout_without_a_session_still_succeeds(client: TestClient) -> None:
    assert client.post(LOGOUT).status_code == 204


# --- contract ----------------------------------------------------------------


def test_the_auth_routes_are_in_the_openapi_schema(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert paths["/api/auth/login"]["post"]["operationId"] == "auth_login"
    assert paths["/api/auth/logout"]["post"]["operationId"] == "auth_logout"
    assert paths["/api/auth/session"]["get"]["operationId"] == "auth_session"


@pytest.mark.parametrize("handler", [_app_error_handler, _rate_limit_handler])
def test_the_error_handlers_re_raise_exceptions_that_are_not_theirs(
    handler: Callable[[Request, Exception], Coroutine[object, object, object]],
) -> None:
    boom = RuntimeError("boom")
    with pytest.raises(RuntimeError) as raised:
        asyncio.run(handler(Request({"type": "http"}), boom))
    assert raised.value is boom
