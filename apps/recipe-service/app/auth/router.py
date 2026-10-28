from typing import Annotated, Literal

from fastapi import APIRouter, Cookie, Depends, Request, Response

from app.auth.schemas import ChangePasswordRequest, LoginRequest, SessionResponse
from app.auth.service import AuthService, get_auth_service
from app.core.config import Settings, get_settings
from app.core.rate_limit import LOGIN_LIMIT, limiter
from app.core.security import (
    SESSION_COOKIE,
    SESSION_LIFETIME,
    CurrentUser,
    require_role,
)

router = APIRouter(prefix="/auth", tags=["auth"])

ServiceDep = Annotated[AuthService, Depends(get_auth_service)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionCookie = Annotated[str | None, Cookie(alias=SESSION_COOKIE)]

# Same attributes on set and delete, or the browser keeps the old cookie (AD-21).
_SAMESITE: Literal["lax"] = "lax"


def _set_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite=_SAMESITE,
    )


def _clear_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        SESSION_COOKIE,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite=_SAMESITE,
    )


@router.post("/login")
@limiter.limit(LOGIN_LIMIT)
def login(
    request: Request,  # slowapi reads the client address from it
    body: LoginRequest,
    response: Response,
    service: ServiceDep,
    settings: SettingsDep,
) -> SessionResponse:
    user, token = service.login(body.email, body.password)
    _set_cookie(response, token, settings)
    return SessionResponse(user=user)


@router.post("/password")
@limiter.limit(LOGIN_LIMIT)
def change_password(
    request: Request,  # slowapi reads the client address from it
    body: ChangePasswordRequest,
    response: Response,
    service: ServiceDep,
    settings: SettingsDep,
    current: Annotated[CurrentUser, Depends(require_role("editor"))],
) -> SessionResponse:
    """Change my own password (FR-27); any signed-in user, editor or admin.

    The old cookie dies with the version bump, so the answer sets a new one: this
    device stays signed in and every other device is signed out.
    """
    user, token = service.change_password(
        current.id, body.current_password, body.new_password
    )
    _set_cookie(response, token, settings)
    return SessionResponse(user=user)


@router.post("/logout", status_code=204)
def logout(response: Response, settings: SettingsDep) -> None:
    """Always succeeds, signed in or not."""
    _clear_cookie(response, settings)


@router.get("/session")
def session(
    response: Response,
    service: ServiceDep,
    settings: SettingsDep,
    token: SessionCookie = None,
) -> SessionResponse:
    """Public: 200 with the user, or `user: null` for a visitor (AD-21)."""
    user = service.current_user(token)
    if user is None and token is not None:
        # A stale or invalid cookie is dropped, so it is not sent again.
        _clear_cookie(response, settings)
    return SessionResponse(user=user)
