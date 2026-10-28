import pytest

from app.core.security import Role, hash_password, verify_password


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
