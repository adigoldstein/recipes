import uuid

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session

from app.core.errors import AppError
from app.core.security import SESSION_COOKIE, Role
from app.users.repository import UserRepository
from app.users.service import UserService
from tests.factories import add_user

EMAIL = "adi@example.com"
PASSWORD = "correct horse"
NEW_PASSWORD = "battery staple"
LOGIN = "/api/auth/login"
SESSION = "/api/auth/session"
PASSWORD_URL = "/api/auth/password"


def _login(client: TestClient, password: str = PASSWORD) -> None:
    assert (
        client.post(LOGIN, json={"email": EMAIL, "password": password}).status_code
        == 200
    )


def _change(
    client: TestClient, current: str = PASSWORD, new: str = NEW_PASSWORD
) -> Response:
    response: Response = client.post(
        PASSWORD_URL, json={"current_password": current, "new_password": new}
    )
    return response


def test_changing_the_password_keeps_this_device_signed_in(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, name="עדי")
    _login(client)
    response = _change(client)
    assert response.status_code == 200
    assert response.json() == {
        "user": {"id": str(user.id), "email": EMAIL, "name": "עדי", "role": "editor"}
    }
    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie and "samesite=lax" in set_cookie
    assert "max-age=604800" in set_cookie
    # The cookie the response set is the one the client now holds.
    assert client.get(SESSION).json()["user"]["email"] == EMAIL


def test_the_old_cookie_stops_working_but_the_new_one_works(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    _login(client)
    old_token = client.cookies.get(SESSION_COOKIE)
    assert _change(client).status_code == 200
    new_token = client.cookies.get(SESSION_COOKIE)
    assert new_token != old_token

    client.cookies.set(SESSION_COOKIE, old_token or "")
    assert client.get(SESSION).json() == {"user": None}
    client.cookies.set(SESSION_COOKIE, new_token or "")
    assert client.get(SESSION).json()["user"] is not None


def test_the_new_password_logs_in_and_the_old_one_does_not(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    _login(client)
    _change(client)
    client.cookies.clear()
    assert (
        client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD}).status_code
        == 400
    )
    _login(client, NEW_PASSWORD)


def test_a_wrong_current_password_is_a_400_and_changes_nothing(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    _login(client)
    response = _change(client, current="wrong password")
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_credentials"
    assert client.get(SESSION).json()["user"] is not None
    client.cookies.clear()
    _login(client)  # the old password still works


def test_a_new_password_that_is_too_short_is_rejected(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    _login(client)
    response = _change(client, new="short")
    assert response.status_code == 422
    assert response.json()["code"] == "password_too_short"
    client.cookies.clear()
    _login(client)


def test_a_new_password_that_is_too_long_is_rejected(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    _login(client)
    response = _change(client, new="x" * 129)
    assert response.status_code == 422


def test_an_admin_can_change_their_own_password_too(
    client: TestClient, session: Session
) -> None:
    add_user(session, role=Role.ADMIN)
    _login(client)
    assert _change(client).status_code == 200


def test_a_visitor_gets_401(client: TestClient) -> None:
    response = _change(client)
    assert response.status_code == 401


def test_a_request_without_the_csrf_header_is_a_403(
    bare_client: TestClient, session: Session
) -> None:
    add_user(session)
    bare_client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    response = bare_client.post(
        PASSWORD_URL,
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "csrf_header_missing"


def test_a_blocked_user_cannot_change_the_password(
    client: TestClient, session: Session
) -> None:
    user = add_user(session)
    _login(client)
    user.is_blocked = True
    session.add(user)
    session.commit()
    assert _change(client).status_code == 401


def test_the_sixth_attempt_in_a_minute_is_a_429(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    _login(client)
    for _ in range(5):
        assert _change(client, current="wrong password").status_code == 400
    assert _change(client).status_code == 429


def test_an_unknown_user_id_is_a_404(session: Session) -> None:
    service = UserService(UserRepository(session))
    with pytest.raises(AppError) as raised:
        service.change_own_password(uuid.uuid4(), PASSWORD, NEW_PASSWORD)
    assert raised.value.status_code == 404
