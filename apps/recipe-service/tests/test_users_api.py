"""`GET /api/users` and `POST /api/users`: admin only (FR-25, AD-30)."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.security import Role, verify_password
from app.users.models import User
from tests.factories import add_user

USERS = "/api/users"
LOGIN = "/api/auth/login"
PASSWORD = "correct horse"
NEW_USER = {
    "email": "dana@example.com",
    "name": "Dana",
    "role": "editor",
    "password": "starting pass",
}


def _sign_in(client: TestClient, email: str, password: str = PASSWORD) -> None:
    response = client.post(LOGIN, json={"email": email, "password": password})
    assert response.status_code == 200


@pytest.fixture
def admin(client: TestClient, session: Session) -> User:
    user = add_user(session, email="adi@example.com", name="Adi", role=Role.ADMIN)
    _sign_in(client, user.email)
    return user


# --- Access ------------------------------------------------------------------


def test_a_visitor_gets_401_and_nothing_is_created(
    client: TestClient, session: Session
) -> None:
    assert client.get(USERS).status_code == 401
    assert client.post(USERS, json=NEW_USER).status_code == 401
    assert session.exec(select(User)).all() == []


def test_an_editor_gets_403_and_nothing_is_created(
    client: TestClient, session: Session
) -> None:
    add_user(session, email="editor@example.com", role=Role.EDITOR)
    _sign_in(client, "editor@example.com")

    assert client.get(USERS).status_code == 403
    assert client.post(USERS, json=NEW_USER).status_code == 403
    assert len(session.exec(select(User)).all()) == 1


def test_a_blocked_admin_is_treated_as_a_visitor(
    client: TestClient, session: Session, admin: User
) -> None:
    admin.is_blocked = True
    session.add(admin)
    session.commit()

    assert client.get(USERS).status_code == 401


def test_creating_without_the_csrf_header_is_403(
    bare_client: TestClient, client: TestClient, admin: User
) -> None:
    bare_client.cookies.update(client.cookies)

    response = bare_client.post(USERS, json=NEW_USER)

    assert response.status_code == 403
    assert response.json()["code"] == "csrf_header_missing"


# --- List --------------------------------------------------------------------


def test_lists_every_user_oldest_first_without_password_data(
    client: TestClient, session: Session, admin: User
) -> None:
    later = datetime.now(UTC) + timedelta(days=1)
    add_user(
        session,
        email="dana@example.com",
        name="Dana",
        is_blocked=True,
        created_at=later,
    )

    response = client.get(USERS)

    assert response.status_code == 200
    users = response.json()
    assert [u["email"] for u in users] == ["adi@example.com", "dana@example.com"]
    assert set(users[0]) == {"id", "email", "name", "role", "is_blocked", "created_at"}
    assert users[0]["role"] == "admin"
    assert users[0]["is_blocked"] is False
    assert users[1]["is_blocked"] is True


# --- Create ------------------------------------------------------------------


def test_creates_a_user_who_can_log_in_straight_away(
    client: TestClient, session: Session, admin: User
) -> None:
    response = client.post(USERS, json=NEW_USER)

    assert response.status_code == 201
    created = response.json()
    assert created["email"] == "dana@example.com"
    assert created["role"] == "editor"
    assert created["is_blocked"] is False
    assert "password" not in created
    assert "password_hash" not in created

    stored = session.exec(select(User).where(User.name == "Dana")).one()
    assert stored.password_hash != NEW_USER["password"]
    assert verify_password(NEW_USER["password"], stored.password_hash)

    client.post("/api/auth/logout")
    _sign_in(client, "dana@example.com", NEW_USER["password"])
    session_user = client.get("/api/auth/session").json()["user"]
    assert session_user["email"] == "dana@example.com"


def test_the_admin_can_create_another_admin(client: TestClient, admin: User) -> None:
    response = client.post(USERS, json={**NEW_USER, "role": "admin"})

    assert response.status_code == 201
    assert response.json()["role"] == "admin"


@pytest.mark.parametrize("email", ["dana@example.com", "DANA@Example.COM"])
def test_a_duplicate_email_is_409_without_regard_to_case(
    client: TestClient, session: Session, admin: User, email: str
) -> None:
    add_user(session, email="dana@example.com", name="Existing")

    response = client.post(USERS, json={**NEW_USER, "email": email})

    assert response.status_code == 409
    assert response.json()["code"] == "email_taken"
    assert len(session.exec(select(User)).all()) == 2


def test_a_starting_password_under_8_characters_is_rejected(
    client: TestClient, session: Session, admin: User
) -> None:
    response = client.post(USERS, json={**NEW_USER, "password": "short"})

    assert response.status_code == 422
    assert response.json()["code"] == "password_too_short"
    assert response.json()["params"] == {"min": 8}
    assert len(session.exec(select(User)).all()) == 1


@pytest.mark.parametrize(
    "change",
    [
        {"email": "not-an-email"},
        {"name": "   "},
        {"role": "viewer"},
        {"password": None},
    ],
)
def test_an_invalid_body_is_422(
    client: TestClient, session: Session, admin: User, change: dict[str, object]
) -> None:
    response = client.post(USERS, json={**NEW_USER, **change})

    assert response.status_code == 422
    assert len(session.exec(select(User)).all()) == 1
