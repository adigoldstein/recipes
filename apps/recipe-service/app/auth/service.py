"""The business logic of auth. Other modules call this layer, not the repository."""

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
        """Logs a user in. Returns the user and a new session token (AD-21).

        On failure it raises a general 400 that does not say whether the email or the
        password was wrong. The one exception: a blocked account with the right
        password raises 403 `account_blocked`.
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
        """Changes the user's own password and returns a token for a new session.

        The old token is no longer valid, so the caller must set the new cookie.
        Otherwise this device would be logged out too.
        """
        user, session_version = self._users.change_own_password(
            user_id, current_password, new_password
        )
        token = create_session_token(
            user.id, self._secret, session_version=session_version
        )
        return _session_user(user), token

    def current_user(self, token: str | None) -> SessionUser | None:
        """Returns the user that the cookie belongs to, read fresh from the database.

        Returns None for a visitor, for a blocked user, and for a token that is
        invalid, expired, fake, belongs to a deleted user, or is older than the last
        password reset.
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
    """Creates the auth service for a route, like a Nest provider:
    `Depends(get_auth_service)`."""
    return AuthService(users, settings.jwt_secret.get_secret_value())


def get_current_user(
    service: Annotated[AuthService, Depends(get_auth_service)],
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> CurrentUser | None:
    """The real implementation of `core.security.get_session_user`. `main.py` plugs
    it in."""
    user = service.current_user(token)
    if user is None:
        return None
    return CurrentUser(id=user.id, email=user.email, name=user.name, role=user.role)
