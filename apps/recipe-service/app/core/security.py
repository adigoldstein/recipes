"""Roles, password hashing, session tokens, and the request guards (AD-6, AD-30)."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Annotated, NamedTuple

import jwt
from fastapi import Depends, Request
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.errors import AppError, ErrorCode


class Role(StrEnum):
    """The user roles. A visitor is simply not logged in, so there is no visitor
    role (AD-30)."""

    EDITOR = "editor"
    ADMIN = "admin"


# Hash passwords with Argon2id only, using the library's recommended settings (AD-6).
_hasher = PasswordHash((Argon2Hasher(),))


def hash_password(password: str) -> str:
    """Returns a salted Argon2id hash of the password. The plain password is never
    stored or logged."""
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Checks whether the password matches the hash, in constant time.

    If the stored value is not a known hash format, the password does not match.
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
    user_id: uuid.UUID,
    secret: str,
    *,
    session_version: int = 0,
    now: datetime | None = None,
) -> str:
    """Creates a signed JWT with the user id, the session version, and the expiry time.

    The role and the "blocked" flag are not in the token on purpose. They are read
    from the database on every request, so a role change or a block works right
    away (AD-30). The session version lets the server log a user out everywhere:
    increasing `user.session_version` makes all older tokens invalid (Story 2.5).
    """
    issued_at = now or datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "sv": session_version,
        "iat": issued_at,
        "exp": issued_at + SESSION_LIFETIME,
    }
    return jwt.encode(claims, secret, algorithm=_JWT_ALGORITHM)


class SessionClaims(NamedTuple):
    """The data inside a valid session token."""

    user_id: uuid.UUID
    session_version: int


def read_session_token(token: str, secret: str) -> SessionClaims | None:
    """Returns the user id and session version from a valid, unexpired token.
    Returns None if the token is not valid.

    Old tokens, created before session versions existed, have no `sv`. We treat them
    as version 0, which is the version every existing user starts with, so the
    upgrade did not log anybody out.
    """
    try:
        claims = jwt.decode(
            token,
            secret,
            # Accept only our algorithm. This blocks fake tokens with `alg: none`.
            algorithms=[_JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
        version = claims.get("sv", 0)
        if not isinstance(version, int) or isinstance(version, bool):
            return None
        return SessionClaims(uuid.UUID(claims["sub"]), version)
    except (jwt.InvalidTokenError, ValueError):
        return None


# --- Request guards ----------------------------------------------------------

# CSRF protection: every request that changes data must send this header. A form
# on another site cannot add a custom header, and a fetch from another site that adds
# one needs CORS approval, which this app never gives (AD-6).
CSRF_HEADER = "X-Requested-With"
CSRF_VALUE = "bite-and-board"
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def require_csrf_header(request: Request) -> None:
    """Rejects any request that changes data and has no CSRF header.

    It is registered once for the whole app, so no route can forget it. It runs
    before the role check, so a missing header returns 403 and never 401 (AD-21).
    """
    if request.method not in _SAFE_METHODS and (
        request.headers.get(CSRF_HEADER) != CSRF_VALUE
    ):
        raise AppError(
            403, ErrorCode.CSRF_HEADER_MISSING, f"Missing {CSRF_HEADER} header"
        )


@dataclass(frozen=True)
class CurrentUser:
    """The user who sent this request, as currently stored in the database."""

    id: uuid.UUID
    email: str
    name: str
    role: Role


def get_session_user() -> CurrentUser | None:
    """Returns the user that this request's session cookie belongs to.

    `core` is not allowed to import the feature modules, so here it only declares
    the function. `main.py` replaces it with the real one using
    `dependency_overrides`, like a Nest custom provider (`useFactory`). The user must
    be read from the database on every request, so a role change or a block works
    on the next request (AD-30).
    """
    raise RuntimeError("get_session_user is not wired; see create_app()")


# Role ranks. A higher rank passes every check of a lower one, so an admin can do
# everything an editor can.
_RANK = {Role.EDITOR: 1, Role.ADMIN: 2}


def has_role(user_role: Role, required: Role) -> bool:
    return _RANK[user_role] >= _RANK[required]


def require_role(role: Role | str) -> Callable[..., CurrentUser]:
    """A route dependency that checks the user's role, like a Nest `@Roles()` guard.

    Returns 401 if the user is not logged in, 403 if the role is too low, and
    otherwise returns the current user.
    Use it as `Depends(require_role(Role.EDITOR))` or `Depends(require_role("admin"))`.
    """
    required = Role(role)

    def dependency(
        user: Annotated[CurrentUser | None, Depends(get_session_user)],
    ) -> CurrentUser:
        if user is None:
            raise AppError(401, ErrorCode.UNAUTHORIZED, "Sign in required")
        if not has_role(user.role, required):
            raise AppError(403, ErrorCode.FORBIDDEN, "Not allowed")
        return user

    return dependency
