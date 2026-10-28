"""Roles, password hashing, and (from Story 2.3) the `require_role` guards."""

from enum import StrEnum

from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError
from pwdlib.hashers.argon2 import Argon2Hasher


class Role(StrEnum):
    """A visitor has no session, so there is no viewer role (AD-30)."""

    EDITOR = "editor"
    ADMIN = "admin"


# Argon2id only, with the library's recommended cost settings (AD-6).
_hasher = PasswordHash((Argon2Hasher(),))


def hash_password(password: str) -> str:
    """A salted Argon2id hash; the plain password is never stored or logged."""
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Whether the password matches the hash. The comparison is constant-time.

    A stored value that is not a known hash format simply never matches.
    """
    try:
        return _hasher.verify(password, password_hash)
    except UnknownHashError:
        return False
