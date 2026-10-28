"""Business rules for auth; other modules call this layer, never the repository."""

import uuid
from typing import Annotated

from fastapi import Cookie, Depends

from app.auth.schemas import SessionUser
from app.core.config import Settings, get_settings
from app.core.errors import AppError, ErrorCode
from app.core.security import (
    SESSION_COOKIE,
    CurrentUser,
    create_session_token,
    read_session_token,
)
from app.users.schemas import UserRead
from app.users.service import UserService, get_user_service


def _session_user(user: UserRead) -> SessionUser:
    return SessionUser(id=user.id, email=user.email, name=user.name, role=user.role)


class AuthService:
    def __init__(self, users: UserService, secret: str) -> None:
        self._users = users
        self._secret = secret

    def login(self, email: str, password: str) -> tuple[SessionUser, str]:
        """The user and a fresh session token, or a generic 400 (AD-21).

        The error never says which part was wrong. A blocked account whose password
        was right is the one exception: it raises 403 `account_blocked`.
        """
        found = self._users.authenticate(email, password)
        if found is None:
            raise AppError(
                400, ErrorCode.INVALID_CREDENTIALS, "Invalid email or password"
            )
        user, session_version = found
        token = create_session_token(
            user.id, self._secret, session_version=session_version
        )
        return _session_user(user), token

    def change_password(
        self, user_id: uuid.UUID, current_password: str, new_password: str
    ) -> tuple[SessionUser, str]:
        """Change the user's own password; returns a token for the new session.

        The old token stops matching (the version moved on), so the caller must set
        the new cookie or the current device would be signed out too.
        """
        user, session_version = self._users.change_own_password(
            user_id, current_password, new_password
        )
        token = create_session_token(
            user.id, self._secret, session_version=session_version
        )
        return _session_user(user), token

    def current_user(self, token: str | None) -> SessionUser | None:
        """Who the cookie belongs to, looked up fresh; None for a visitor.

        A bad, expired, forged, orphaned or superseded token (the password was reset
        since), and a blocked user, all give None.
        """
        if token is None:
            return None
        claims = read_session_token(token, self._secret)
        if claims is None:
            return None
        user = self._users.get_active_user(claims.user_id, claims.session_version)
        return None if user is None else _session_user(user)


def get_auth_service(
    users: Annotated[UserService, Depends(get_user_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthService:
    """Provider, like a Nest injectable: `Depends(get_auth_service)`."""
    return AuthService(users, settings.jwt_secret.get_secret_value())


def get_current_user(
    service: Annotated[AuthService, Depends(get_auth_service)],
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> CurrentUser | None:
    """Answers `core.security.get_session_user`; `main.py` wires it in."""
    user = service.current_user(token)
    if user is None:
        return None
    return CurrentUser(id=user.id, email=user.email, name=user.name, role=user.role)
