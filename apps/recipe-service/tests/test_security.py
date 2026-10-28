import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.security import (
    Role,
    create_session_token,
    hash_password,
    read_session_token,
    verify_password,
)


def test_roles_are_editor_and_admin_only() -> None:
    assert {role.value for role in Role} == {"editor", "admin"}


def test_hash_is_argon2id_and_never_contains_the_password() -> None:
    password = "correct horse battery"
    hashed = hash_password(password)
    assert hashed.startswith("$argon2id$")
    assert password not in hashed


def test_same_password_gets_a_different_salted_hash_each_time() -> None:
    assert hash_password("correct horse") != hash_password("correct horse")


def test_verify_accepts_the_right_password_only() -> None:
    hashed = hash_password("correct horse")
    assert verify_password("correct horse", hashed) is True
    assert verify_password("Correct horse", hashed) is False
    assert verify_password("correct horse ", hashed) is False
    assert verify_password("", hashed) is False


def test_verify_handles_non_ascii_passwords() -> None:
    hashed = hash_password("סיסמה-חזקה-123")
    assert verify_password("סיסמה-חזקה-123", hashed) is True
    assert verify_password("סיסמה-חזקה-124", hashed) is False


@pytest.mark.parametrize("stored", ["", "plain-text-password", "$2b$12$notargon"])
def test_verify_never_matches_a_value_that_is_not_an_argon2_hash(stored: str) -> None:
    assert verify_password("plain-text-password", stored) is False


# --- session tokens ---------------------------------------------------------

SECRET = "test-secret-test-secret-test-secret"


def test_a_session_token_round_trips_the_user_id() -> None:
    user_id = uuid.uuid4()
    token = create_session_token(user_id, SECRET)
    assert read_session_token(token, SECRET) == user_id


def test_a_session_token_carries_no_role_or_blocked_flag() -> None:
    token = create_session_token(uuid.uuid4(), SECRET)
    claims = jwt.decode(token, SECRET, algorithms=["HS256"])
    assert set(claims) == {"sub", "iat", "exp"}


def test_a_session_token_lasts_seven_days() -> None:
    now = datetime(2026, 10, 28, 9, 0, tzinfo=UTC)
    token = create_session_token(uuid.uuid4(), SECRET, now=now)
    claims = jwt.decode(
        token, SECRET, algorithms=["HS256"], options={"verify_exp": False}
    )
    assert claims["exp"] - claims["iat"] == 7 * 24 * 60 * 60


def test_an_expired_token_is_rejected() -> None:
    long_ago = datetime.now(UTC) - timedelta(days=8)
    token = create_session_token(uuid.uuid4(), SECRET, now=long_ago)
    assert read_session_token(token, SECRET) is None


def test_a_token_signed_with_another_secret_is_rejected() -> None:
    token = create_session_token(uuid.uuid4(), "another-secret-another-secret-xx")
    assert read_session_token(token, SECRET) is None


def test_an_unsigned_token_is_rejected() -> None:
    claims = {"sub": str(uuid.uuid4()), "exp": datetime.now(UTC) + timedelta(days=1)}
    forged = jwt.encode(claims, key=None, algorithm="none")
    assert read_session_token(forged, SECRET) is None


def test_a_token_missing_its_expiry_or_subject_is_rejected() -> None:
    no_exp = jwt.encode({"sub": str(uuid.uuid4())}, SECRET, algorithm="HS256")
    no_sub = jwt.encode(
        {"exp": datetime.now(UTC) + timedelta(days=1)}, SECRET, algorithm="HS256"
    )
    assert read_session_token(no_exp, SECRET) is None
    assert read_session_token(no_sub, SECRET) is None


def test_a_token_whose_subject_is_not_a_uuid_is_rejected() -> None:
    claims = {"sub": "not-a-uuid", "exp": datetime.now(UTC) + timedelta(days=1)}
    token = jwt.encode(claims, SECRET, algorithm="HS256")
    assert read_session_token(token, SECRET) is None


@pytest.mark.parametrize("token", ["", "garbage", "a.b.c"])
def test_a_malformed_token_is_rejected(token: str) -> None:
    assert read_session_token(token, SECRET) is None
