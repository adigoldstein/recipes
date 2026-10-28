"""`PATCH /api/users/{id}`: role, block and password reset (FR-26, AD-30)."""

import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session

from app.core.security import CSRF_HEADER, CSRF_VALUE, Role, verify_password
from app.users.models import User
from tests.factories import add_user

USERS = "/api/users"
LOGIN = "/api/auth/login"
SESSION = "/api/auth/session"
PASSWORD = "correct horse"
NEW_PASSWORD = "a brand new one"


def _sign_in(client: TestClient, email: str, password: str = PASSWORD) -> Response:
    response: Response = client.post(LOGIN, json={"email": email, "password": password})
    return response


def _patch(client: TestClient, user: User, **changes: object) -> Response:
    response: Response = client.patch(f"{USERS}/{user.id}", json=changes)
    return response


def _reload(session: Session, user: User) -> User:
    session.expire_all()
    stored = session.get(User, user.id)
    assert stored is not None
    return stored


@pytest.fixture
def admin(client: TestClient, session: Session) -> User:
    user = add_user(session, email="adi@example.com", name="Adi", role=Role.ADMIN)
    assert _sign_in(client, user.email).status_code == 200
    return user


@pytest.fixture
def dana(session: Session) -> User:
    return add_user(session, email="dana@example.com", name="Dana", role=Role.EDITOR)


@pytest.fixture
def other_client(app: FastAPI) -> TestClient:
    """A second browser, so one test can have two people signed in at once."""
    return TestClient(app, headers={CSRF_HEADER: CSRF_VALUE})


# --- Access ------------------------------------------------------------------


def test_a_visitor_gets_401(client: TestClient, session: Session, dana: User) -> None:
    assert _patch(client, dana, role="admin").status_code == 401
    assert _reload(session, dana).role == Role.EDITOR


def test_an_editor_gets_403(client: TestClient, session: Session, dana: User) -> None:
    assert _sign_in(client, dana.email).status_code == 200

    assert _patch(client, dana, role="admin").status_code == 403
    assert _reload(session, dana).role == Role.EDITOR


def test_without_the_csrf_header_it_is_403(
    bare_client: TestClient, client: TestClient, admin: User, dana: User
) -> None:
    bare_client.cookies.update(client.cookies)

    response = bare_client.patch(f"{USERS}/{dana.id}", json={"role": "admin"})

    assert response.status_code == 403
    assert response.json()["code"] == "csrf_header_missing"


# --- Role --------------------------------------------------------------------


def test_an_admin_can_promote_and_demote_an_editor(
    client: TestClient, session: Session, admin: User, dana: User
) -> None:
    promoted = _patch(client, dana, role="admin")
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "admin"
    assert set(promoted.json()) == {
        "id",
        "email",
        "name",
        "role",
        "is_blocked",
        "created_at",
    }
    assert _reload(session, dana).role == Role.ADMIN

    assert _patch(client, dana, role="editor").status_code == 200
    assert _reload(session, dana).role == Role.EDITOR


def test_a_demotion_takes_effect_on_that_users_next_request(
    client: TestClient, other_client: TestClient, session: Session, admin: User
) -> None:
    other = add_user(session, email="o@example.com", name="Other", role=Role.ADMIN)
    assert _sign_in(other_client, other.email).status_code == 200
    assert other_client.get(USERS).status_code == 200

    assert _patch(client, other, role="editor").status_code == 200

    assert other_client.get(USERS).status_code == 403


def test_a_role_change_does_not_end_the_users_session(
    client: TestClient, other_client: TestClient, session: Session, admin: User
) -> None:
    other = add_user(session, email="o@example.com", name="Other", role=Role.ADMIN)
    _sign_in(other_client, other.email)

    _patch(client, other, role="editor")

    assert other_client.get(SESSION).json()["user"]["role"] == "editor"


# --- Block and unblock -------------------------------------------------------


def test_blocking_ends_the_users_session(
    client: TestClient, other_client: TestClient, admin: User, dana: User
) -> None:
    _sign_in(other_client, dana.email)
    assert other_client.get(SESSION).json()["user"] is not None

    response = _patch(client, dana, is_blocked=True)

    assert response.status_code == 200
    assert response.json()["is_blocked"] is True
    assert other_client.get(SESSION).json() == {"user": None}


def test_a_blocked_users_protected_request_is_401(
    client: TestClient, other_client: TestClient, session: Session, admin: User
) -> None:
    other = add_user(session, email="o@example.com", name="Other", role=Role.ADMIN)
    _sign_in(other_client, other.email)

    _patch(client, other, is_blocked=True)

    assert other_client.get(USERS).status_code == 401


def test_an_old_cookie_stays_dead_after_unblocking(
    client: TestClient, other_client: TestClient, admin: User, dana: User
) -> None:
    _sign_in(other_client, dana.email)
    old_cookie = other_client.cookies.get("session")
    assert old_cookie

    _patch(client, dana, is_blocked=True)
    assert _patch(client, dana, is_blocked=False).status_code == 200

    other_client.cookies.set("session", old_cookie)
    assert other_client.get(SESSION).json() == {"user": None}


def test_blocking_an_already_blocked_user_changes_no_session_version(
    client: TestClient, session: Session, admin: User, dana: User
) -> None:
    _patch(client, dana, is_blocked=True)
    version = _reload(session, dana).session_version

    assert _patch(client, dana, is_blocked=True).status_code == 200

    assert _reload(session, dana).session_version == version


def test_a_blocked_user_with_the_right_password_cannot_log_in(
    client: TestClient, other_client: TestClient, admin: User, dana: User
) -> None:
    _patch(client, dana, is_blocked=True)

    response = _sign_in(other_client, dana.email)

    assert response.status_code == 403
    assert response.json()["code"] == "account_blocked"


def test_unblocking_lets_the_user_log_in_again(
    client: TestClient, other_client: TestClient, admin: User, dana: User
) -> None:
    _patch(client, dana, is_blocked=True)
    _patch(client, dana, is_blocked=False)

    assert _sign_in(other_client, dana.email).status_code == 200


# --- Password reset ----------------------------------------------------------


def test_a_reset_replaces_the_password_and_ends_every_session(
    client: TestClient,
    other_client: TestClient,
    session: Session,
    admin: User,
    dana: User,
) -> None:
    _sign_in(other_client, dana.email)
    assert other_client.get(SESSION).json()["user"] is not None

    response = _patch(client, dana, password=NEW_PASSWORD)

    assert response.status_code == 200
    assert "password" not in response.json()
    assert verify_password(NEW_PASSWORD, _reload(session, dana).password_hash)
    assert other_client.get(SESSION).json() == {"user": None}


def test_after_a_reset_only_the_new_password_logs_in(
    client: TestClient, other_client: TestClient, admin: User, dana: User
) -> None:
    _patch(client, dana, password=NEW_PASSWORD)

    assert _sign_in(other_client, dana.email).status_code == 400
    assert _sign_in(other_client, dana.email, NEW_PASSWORD).status_code == 200
    assert other_client.get(SESSION).json()["user"]["email"] == dana.email


def test_a_reset_does_not_end_other_users_sessions(
    client: TestClient, admin: User, dana: User
) -> None:
    _patch(client, dana, password=NEW_PASSWORD)

    assert client.get(USERS).status_code == 200


@pytest.mark.parametrize(
    ("password", "code"),
    [
        ("short", "password_too_short"),
        ("", "password_too_short"),
        ("x" * 129, "password_too_long"),
    ],
)
def test_a_reset_password_must_be_8_to_128_characters(
    client: TestClient,
    session: Session,
    admin: User,
    dana: User,
    password: str,
    code: str,
) -> None:
    old_hash = dana.password_hash

    response = _patch(client, dana, password=password)

    assert response.status_code == 422
    assert response.json()["code"] == code
    stored = _reload(session, dana)
    assert stored.password_hash == old_hash
    assert stored.session_version == 0


def test_a_blocked_users_password_can_be_reset(
    client: TestClient, session: Session, admin: User, dana: User
) -> None:
    _patch(client, dana, is_blocked=True)

    assert _patch(client, dana, password=NEW_PASSWORD).status_code == 200

    assert verify_password(NEW_PASSWORD, _reload(session, dana).password_hash)


# --- Bodies and ids ----------------------------------------------------------


def test_several_changes_apply_together(
    client: TestClient, session: Session, admin: User, dana: User
) -> None:
    response = _patch(
        client, dana, role="admin", is_blocked=True, password=NEW_PASSWORD
    )

    assert response.status_code == 200
    stored = _reload(session, dana)
    assert (stored.role, stored.is_blocked) == (Role.ADMIN, True)
    assert verify_password(NEW_PASSWORD, stored.password_hash)


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"role": "viewer"},
        {"role": None},
        {"is_blocked": None},
        {"password": None},
        {"is_blocked": "maybe"},
        {"name": "Renamed"},
    ],
)
def test_an_invalid_body_is_422_and_changes_nothing(
    client: TestClient,
    session: Session,
    admin: User,
    dana: User,
    body: dict[str, object],
) -> None:
    response = client.patch(f"{USERS}/{dana.id}", json=body)

    assert response.status_code == 422
    stored = _reload(session, dana)
    assert (stored.role, stored.is_blocked, stored.name) == (Role.EDITOR, False, "Dana")


def test_an_unknown_user_is_404(client: TestClient, admin: User) -> None:
    response = client.patch(f"{USERS}/{uuid.uuid4()}", json={"role": "admin"})

    assert response.status_code == 404
    assert response.json()["code"] == "user_not_found"


def test_a_malformed_user_id_is_422(client: TestClient, admin: User) -> None:
    response = client.patch(f"{USERS}/not-a-uuid", json={"role": "admin"})

    assert response.status_code == 422


# --- The last active admin (AD-30) -------------------------------------------


def test_the_last_admin_cannot_be_demoted(
    client: TestClient, session: Session, admin: User
) -> None:
    response = _patch(client, admin, role="editor")

    assert response.status_code == 409
    assert response.json()["code"] == "last_admin"
    assert _reload(session, admin).role == Role.ADMIN


def test_the_last_admin_cannot_be_blocked_and_keeps_their_session(
    client: TestClient, session: Session, admin: User
) -> None:
    response = _patch(client, admin, is_blocked=True)

    assert response.status_code == 409
    assert response.json()["code"] == "last_admin"
    stored = _reload(session, admin)
    assert stored.is_blocked is False
    assert stored.session_version == 0
    assert client.get(USERS).status_code == 200


def test_demoting_and_blocking_together_is_still_refused(
    client: TestClient, session: Session, admin: User
) -> None:
    response = _patch(client, admin, role="editor", is_blocked=True)

    assert response.status_code == 409
    stored = _reload(session, admin)
    assert (stored.role, stored.is_blocked) == (Role.ADMIN, False)


def test_a_refused_change_leaves_a_password_in_the_same_request_unchanged(
    client: TestClient, session: Session, admin: User
) -> None:
    old_hash = admin.password_hash

    response = _patch(client, admin, role="editor", password=NEW_PASSWORD)

    assert response.status_code == 409
    assert _reload(session, admin).password_hash == old_hash


def test_a_blocked_admin_does_not_count_as_active(
    client: TestClient, session: Session, admin: User
) -> None:
    add_user(session, email="b@example.com", name="B", role=Role.ADMIN, is_blocked=True)

    assert _patch(client, admin, role="editor").status_code == 409
    assert _patch(client, admin, is_blocked=True).status_code == 409


def test_editors_do_not_count_as_admins(
    client: TestClient, admin: User, dana: User
) -> None:
    assert _patch(client, admin, role="editor").status_code == 409


def test_the_last_admin_may_keep_their_role_and_reset_their_own_password(
    client: TestClient, admin: User
) -> None:
    assert _patch(client, admin, role="admin", is_blocked=False).status_code == 200
    assert _patch(client, admin, password=NEW_PASSWORD).status_code == 200


def test_an_admin_may_demote_themselves_while_another_admin_is_active(
    client: TestClient, session: Session, admin: User
) -> None:
    add_user(session, email="b@example.com", name="B", role=Role.ADMIN)

    assert _patch(client, admin, role="editor").status_code == 200
    assert _reload(session, admin).role == Role.EDITOR


def test_an_admin_may_block_another_admin_while_two_are_active(
    client: TestClient, session: Session, admin: User
) -> None:
    other = add_user(session, email="b@example.com", name="B", role=Role.ADMIN)

    assert _patch(client, other, is_blocked=True).status_code == 200


def test_two_admins_cannot_remove_each_other(
    client: TestClient, session: Session, admin: User
) -> None:
    """Whoever acts second finds one active admin left, and is refused."""
    other = add_user(session, email="b@example.com", name="B", role=Role.ADMIN)

    assert _patch(client, other, is_blocked=True).status_code == 200
    assert _patch(client, admin, is_blocked=True).status_code == 409
    assert _reload(session, admin).is_blocked is False
