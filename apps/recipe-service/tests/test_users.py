import logging
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.cli import main
from app.core.config import get_settings
from app.core.db import get_engine
from app.core.errors import AppError, ErrorCode
from app.core.security import Role, hash_password, verify_password
from app.users.models import User
from app.users.repository import UserRepository
from app.users.schemas import UserCreate, UserRead
from app.users.service import (
    MAX_PASSWORD_LENGTH,
    MIN_PASSWORD_LENGTH,
    UserService,
    get_user_service,
)
from tests.factories import add_user

PASSWORD = "correct horse"
CREATE = ["create-admin", "--email", "adi@example.com", "--name", "Adi"]
RESET = ["create-admin", "--email", "adi@example.com", "--reset-password"]

Typed = Callable[..., None]


@pytest.fixture
def service(session: Session) -> UserService:
    return get_user_service(session)


@pytest.fixture
def type_passwords(monkeypatch: pytest.MonkeyPatch) -> Typed:
    """Feed the CLI's password prompts; a prompt beyond the answers fails the test."""

    def feed(*answers: str) -> None:
        remaining: Iterator[str] = iter(answers)

        def fake_getpass(prompt: str = "") -> str:
            return next(remaining)

        monkeypatch.setattr("app.cli.getpass", fake_getpass)

    return feed


def _users(session: Session) -> list[User]:
    session.expire_all()
    return list(session.exec(select(User)).all())


def _new_admin(email: str = "adi@example.com") -> UserCreate:
    return UserCreate(email=email, name="Adi", role=Role.ADMIN)


# --- service ---------------------------------------------------------------


def test_create_user_stores_a_hash_never_the_password(
    service: UserService, session: Session
) -> None:
    result = service.create_user(_new_admin(), PASSWORD)
    (stored,) = _users(session)
    assert stored.id == result.id
    assert stored.role is Role.ADMIN
    assert stored.is_blocked is False
    assert stored.password_hash.startswith("$argon2id$")
    assert PASSWORD not in stored.password_hash
    assert verify_password(PASSWORD, stored.password_hash)


def test_the_returned_user_has_no_password_field(service: UserService) -> None:
    result = service.create_user(_new_admin(), PASSWORD)
    assert set(UserRead.model_fields) == {
        "id",
        "email",
        "name",
        "role",
        "is_blocked",
        "created_at",
    }
    assert PASSWORD not in result.model_dump_json()


def test_email_and_name_are_cleaned() -> None:
    data = UserCreate(
        email="  Adi@Example.com ", name="  עדי   גולדשטיין ", role=Role.EDITOR
    )
    assert data.email == "Adi@example.com"
    assert data.name == "עדי גולדשטיין"


@pytest.mark.parametrize(
    "email", ["", "adi", "adi@", "@example.com", "a b@example.com"]
)
def test_invalid_emails_are_rejected(email: str) -> None:
    with pytest.raises(ValidationError):
        UserCreate(email=email, name="Adi", role=Role.EDITOR)


@pytest.mark.parametrize("name", ["", "   ", "x" * 81])
def test_invalid_names_are_rejected(name: str) -> None:
    with pytest.raises(ValidationError):
        UserCreate(email="adi@example.com", name=name, role=Role.EDITOR)


def test_role_must_be_editor_or_admin() -> None:
    with pytest.raises(ValidationError):
        UserCreate(email="adi@example.com", name="Adi", role="owner")  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "other", ["adi@example.com", "ADI@EXAMPLE.COM", "Adi@Example.com"]
)
def test_a_taken_email_is_rejected_whatever_its_case(
    service: UserService, session: Session, other: str
) -> None:
    add_user(session)
    with pytest.raises(AppError) as error:
        service.create_user(_new_admin(other), PASSWORD)
    assert error.value.status_code == 409
    assert error.value.body.code is ErrorCode.EMAIL_TAKEN
    assert len(_users(session)) == 1


def test_losing_a_race_for_an_email_is_still_a_clear_conflict(
    service: UserService, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    add_user(session)
    # The pre-check sees nothing, as if the other insert had not committed yet.
    monkeypatch.setattr(UserRepository, "get_by_email", lambda _self, _email: None)
    with pytest.raises(AppError) as error:
        service.create_user(_new_admin(), PASSWORD)
    assert error.value.body.code is ErrorCode.EMAIL_TAKEN
    monkeypatch.undo()
    assert len(_users(session)) == 1


def test_the_database_itself_refuses_emails_differing_only_in_case(
    session: Session,
) -> None:
    add_user(session, email="adi@example.com")
    with pytest.raises(IntegrityError):
        add_user(session, email="ADI@example.com")


def test_unexpected_errors_roll_back_and_propagate(
    service: UserService, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def explode(_self: UserRepository) -> None:
        raise RuntimeError("disk full")

    monkeypatch.setattr(UserRepository, "commit", explode)
    with pytest.raises(RuntimeError, match="disk full"):
        service.create_user(_new_admin(), PASSWORD)
    monkeypatch.undo()
    assert _users(session) == []


@pytest.mark.parametrize(
    ("password", "code"),
    [
        ("", ErrorCode.PASSWORD_TOO_SHORT),
        ("a" * (MIN_PASSWORD_LENGTH - 1), ErrorCode.PASSWORD_TOO_SHORT),
        ("a" * (MAX_PASSWORD_LENGTH + 1), ErrorCode.PASSWORD_TOO_LONG),
    ],
)
def test_password_length_is_enforced(
    service: UserService, session: Session, password: str, code: ErrorCode
) -> None:
    with pytest.raises(AppError) as error:
        service.create_user(_new_admin(), password)
    assert error.value.status_code == 422
    assert error.value.body.code is code
    assert _users(session) == []


@pytest.mark.parametrize("length", [MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH])
def test_password_length_limits_are_inclusive(
    service: UserService, length: int
) -> None:
    service.create_user(_new_admin(), "a" * length)


def test_reset_password_changes_only_the_hash(
    service: UserService, session: Session
) -> None:
    original = add_user(
        session, role=Role.EDITOR, name="Adi", is_blocked=True, password=PASSWORD
    )
    old_hash = original.password_hash
    user_id = original.id
    service.reset_password("ADI@example.com", "a brand new one")
    (stored,) = _users(session)
    assert stored.password_hash != old_hash
    assert verify_password("a brand new one", stored.password_hash)
    assert not verify_password(PASSWORD, stored.password_hash)
    assert (stored.email, stored.name, stored.role, stored.is_blocked) == (
        "adi@example.com",
        "Adi",
        Role.EDITOR,
        True,
    )
    assert stored.id == user_id


def test_reset_password_ends_the_users_old_sessions(
    service: UserService, session: Session
) -> None:
    user = add_user(session, password=PASSWORD)
    user_id = user.id
    assert service.get_active_user(user_id, 0) is not None

    service.reset_password("adi@example.com", "a brand new one")

    assert service.get_active_user(user_id, 0) is None
    assert service.get_active_user(user_id, 1) is not None


def test_reset_password_for_an_unknown_email(service: UserService) -> None:
    with pytest.raises(AppError) as error:
        service.reset_password("nobody@example.com", PASSWORD)
    assert error.value.status_code == 404
    assert error.value.body.code is ErrorCode.USER_NOT_FOUND


def test_reset_password_enforces_the_same_length_rules(
    service: UserService, session: Session
) -> None:
    old_hash = add_user(session).password_hash
    with pytest.raises(AppError) as error:
        service.reset_password("adi@example.com", "short")
    assert error.value.body.code is ErrorCode.PASSWORD_TOO_SHORT
    assert _users(session)[0].password_hash == old_hash


def test_reset_password_rolls_back_on_unexpected_errors(
    service: UserService, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    old_hash = add_user(session).password_hash

    def explode(_self: UserRepository) -> None:
        raise RuntimeError("disk full")

    monkeypatch.setattr(UserRepository, "commit", explode)
    with pytest.raises(RuntimeError, match="disk full"):
        service.reset_password("adi@example.com", "a brand new one")
    monkeypatch.undo()
    assert _users(session)[0].password_hash == old_hash


def test_equal_passwords_are_stored_as_different_hashes(
    service: UserService, session: Session
) -> None:
    service.create_user(_new_admin("a@example.com"), PASSWORD)
    service.create_user(_new_admin("b@example.com"), PASSWORD)
    first, second = _users(session)
    assert first.password_hash != second.password_hash
    assert hash_password(PASSWORD) != hash_password(PASSWORD)


# --- CLI -------------------------------------------------------------------


def test_cli_creates_an_admin_with_a_hashed_password(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    type_passwords(PASSWORD, PASSWORD)
    with caplog.at_level(logging.DEBUG):
        assert main(CREATE) == 0
    (stored,) = _users(session)
    assert (stored.email, stored.name, stored.role) == (
        "adi@example.com",
        "Adi",
        Role.ADMIN,
    )
    assert stored.is_blocked is False
    assert stored.password_hash.startswith("$argon2id$")
    assert verify_password(PASSWORD, stored.password_hash)
    captured = capsys.readouterr()
    assert "adi@example.com" in captured.out
    for text in (captured.out, captured.err, caplog.text):
        assert PASSWORD not in text


def test_cli_migrates_a_fresh_database_by_itself(type_passwords: Typed) -> None:
    type_passwords(PASSWORD, PASSWORD)
    assert main(CREATE) == 0
    with Session(get_engine(get_settings().data_dir)) as session:
        assert [user.email for user in _users(session)] == ["adi@example.com"]


def test_cli_has_no_password_argument(
    client: TestClient, session: Session, type_passwords: Typed
) -> None:
    type_passwords(PASSWORD, PASSWORD)
    with pytest.raises(SystemExit) as exit_info:
        main([*CREATE, "--password", PASSWORD])
    assert exit_info.value.code == 2
    assert _users(session) == []


def test_cli_rejects_mismatched_passwords(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    type_passwords(PASSWORD, PASSWORD + "x")
    assert main(CREATE) == 1
    err = capsys.readouterr().err
    assert "do not match" in err
    assert PASSWORD not in err
    assert _users(session) == []


@pytest.mark.parametrize("password", ["", "short", "1234567"])
def test_cli_rejects_a_short_password_with_a_clear_message(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
    password: str,
) -> None:
    type_passwords(password, password)
    assert main(CREATE) == 1
    assert "at least 8 characters" in capsys.readouterr().err
    assert _users(session) == []


def test_cli_rejects_a_too_long_password(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    long_password = "a" * (MAX_PASSWORD_LENGTH + 1)
    type_passwords(long_password, long_password)
    assert main(CREATE) == 1
    assert "at most 128 characters" in capsys.readouterr().err
    assert _users(session) == []


@pytest.mark.parametrize("email", ["adi@example.com", "ADI@Example.COM"])
def test_cli_fails_clearly_when_the_email_exists(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
    email: str,
) -> None:
    old_hash = add_user(session, password="the old password").password_hash
    type_passwords(PASSWORD, PASSWORD)
    assert main(["create-admin", "--email", email, "--name", "New"]) == 1
    assert "already exists" in capsys.readouterr().err
    (stored,) = _users(session)
    assert stored.password_hash == old_hash
    assert stored.role is Role.EDITOR
    assert stored.name == "Adi"


def test_cli_reset_password_changes_only_the_password(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    add_user(session, role=Role.EDITOR, name="Adi", password="the old password")
    type_passwords(PASSWORD, PASSWORD)
    assert main(["create-admin", "--email", "ADI@example.com", "--reset-password"]) == 0
    (stored,) = _users(session)
    assert verify_password(PASSWORD, stored.password_hash)
    assert not verify_password("the old password", stored.password_hash)
    assert (stored.name, stored.role) == ("Adi", Role.EDITOR)
    captured = capsys.readouterr()
    assert "Password changed for adi@example.com" in captured.out
    assert PASSWORD not in captured.out + captured.err


def test_cli_reset_password_ignores_a_name_given_alongside(
    client: TestClient, session: Session, type_passwords: Typed
) -> None:
    add_user(session, name="Adi", role=Role.ADMIN)
    type_passwords(PASSWORD, PASSWORD)
    assert main([*RESET, "--name", "Someone Else"]) == 0
    assert _users(session)[0].name == "Adi"


def test_cli_reset_password_for_an_unknown_email_fails(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    type_passwords(PASSWORD, PASSWORD)
    assert main(RESET) == 1
    assert "not found" in capsys.readouterr().err
    assert _users(session) == []


def test_cli_reset_password_still_enforces_the_length(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    old_hash = add_user(session).password_hash
    type_passwords("short", "short")
    assert main(RESET) == 1
    assert "at least 8" in capsys.readouterr().err
    assert _users(session)[0].password_hash == old_hash


def test_cli_needs_a_name_to_create(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    type_passwords()  # Any prompt would raise StopIteration.
    assert main(["create-admin", "--email", "adi@example.com"]) == 1
    assert "--name is required" in capsys.readouterr().err
    assert _users(session) == []


@pytest.mark.parametrize(
    ("email", "name"),
    [("not-an-email", "Adi"), ("adi@example.com", "   ")],
)
def test_cli_rejects_a_bad_email_or_name_before_asking_for_a_password(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
    email: str,
    name: str,
) -> None:
    type_passwords()  # Any prompt would raise StopIteration.
    assert main(["create-admin", "--email", email, "--name", name]) == 1
    assert "Error:" in capsys.readouterr().err
    assert _users(session) == []


def test_cli_requires_an_email() -> None:
    with pytest.raises(SystemExit) as exit_info:
        main(["create-admin", "--name", "Adi"])
    assert exit_info.value.code == 2


@pytest.mark.parametrize("interrupt", [EOFError, KeyboardInterrupt])
def test_cli_stops_cleanly_when_the_prompt_is_cancelled(
    client: TestClient,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    interrupt: type[BaseException],
) -> None:
    def cancelled(_prompt: str = "") -> str:
        raise interrupt

    monkeypatch.setattr("app.cli.getpass", cancelled)
    assert main(CREATE) == 1
    assert "cancelled" in capsys.readouterr().err
    assert _users(session) == []


def test_authenticate_still_verifies_a_hash_for_an_unknown_email(
    service: UserService, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Same work for an unknown email, so timing does not reveal who has an account."""
    verified: list[str] = []

    def spy(password: str, password_hash: str) -> bool:
        verified.append(password_hash)
        return False

    monkeypatch.setattr("app.users.service.verify_password", spy)
    assert service.authenticate("nobody@example.com", PASSWORD) is None
    assert len(verified) == 1
    assert verified[0].startswith("$argon2id$")
