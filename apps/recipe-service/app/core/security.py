"""Roles, password hashing, session tokens, and the request guards (AD-6, AD-30)."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Annotated

import jwt
from fastapi import Depends, Request
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.errors import AppError, ErrorCode


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


# --- Request guards ----------------------------------------------------------

# The CSRF guard: a cross-site form post cannot add a custom header, and a
# cross-site fetch that does would need a CORS preflight this app never allows (AD-6).
CSRF_HEADER = "X-Requested-With"
CSRF_VALUE = "bite-and-board"
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def require_csrf_header(request: Request) -> None:
    """Reject any request that changes something without the CSRF header.

    Registered once on the whole app, so no route can forget it. It runs before the
    role check, which makes a missing header a 403 and never a 401 (AD-21).
    """
    if request.method not in _SAFE_METHODS and (
        request.headers.get(CSRF_HEADER) != CSRF_VALUE
    ):
        raise AppError(
            403, ErrorCode.CSRF_HEADER_MISSING, f"Missing {CSRF_HEADER} header"
        )


@dataclass(frozen=True)
class CurrentUser:
    """Who is making this request, as the database says right now."""

    id: uuid.UUID
    email: str
    name: str
    role: Role


def get_session_user() -> CurrentUser | None:
    """The seam that answers "who does this request's cookie belong to?".

    `core` may not import the feature modules, so it only declares the question.
    `main.py` answers it with `dependency_overrides`, like a Nest custom provider
    (`useFactory`). The answer must be looked up fresh: that is what makes a demotion
    or a block take effect on the next request (AD-30).
    """
    raise RuntimeError("get_session_user is not wired; see create_app()")


# Admin satisfies every editor-level check.
_RANK = {Role.EDITOR: 1, Role.ADMIN: 2}


def has_role(user_role: Role, required: Role) -> bool:
    return _RANK[user_role] >= _RANK[required]


def require_role(role: Role | str) -> Callable[..., CurrentUser]:
    """A route dependency, like a Nest `@Roles()` guard: 401 without a session,
    403 when the role is too low, otherwise the current user.

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
