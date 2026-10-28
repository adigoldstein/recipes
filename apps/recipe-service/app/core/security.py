"""Roles, password hashing, session tokens, and (from Story 2.3) `require_role`."""

import uuid
from datetime import UTC, datetime, timedelta
from enum import StrEnum

import jwt
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


# The cookie that carries the session JWT (AD-6).
SESSION_COOKIE = "session"
SESSION_LIFETIME = timedelta(days=7)
_JWT_ALGORITHM = "HS256"


def create_session_token(
    user_id: uuid.UUID, secret: str, *, now: datetime | None = None
) -> str:
    """A signed JWT that only says who the user is and when it expires.

    The role and the blocked flag are deliberately not in it: they are read from the
    database on every request, so a demotion or a block takes effect at once (AD-30).
    """
    issued_at = now or datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "iat": issued_at,
        "exp": issued_at + SESSION_LIFETIME,
    }
    return jwt.encode(claims, secret, algorithm=_JWT_ALGORITHM)


def read_session_token(token: str, secret: str) -> uuid.UUID | None:
    """The user id inside a valid, unexpired token; None for anything else."""
    try:
        claims = jwt.decode(
            token,
            secret,
            # Pinning the algorithm list is what rejects `alg: none` forgeries.
            algorithms=[_JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
        return uuid.UUID(claims["sub"])
    except (jwt.InvalidTokenError, ValueError):
        return None
