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

# Setting and deleting the cookie must use the same attributes. Otherwise the
# browser does not delete the old cookie (AD-21).
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
    # Not used here, but slowapi needs it to read the client's IP address.
    request: Request,
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
    # Not used here, but slowapi needs it to read the client's IP address.
    request: Request,
    body: ChangePasswordRequest,
    response: Response,
    service: ServiceDep,
    settings: SettingsDep,
    current: Annotated[CurrentUser, Depends(require_role("editor"))],
) -> SessionResponse:
    """Changes the logged-in user's own password (FR-27). Editors and admins can
    both use it.

    Changing the password makes the old cookie invalid, so the response sets a new
    cookie. This device stays logged in, and all other devices are logged out.
    """
    user, token = service.change_password(
        current.id, body.current_password, body.new_password
    )
    _set_cookie(response, token, settings)
    return SessionResponse(user=user)


@router.post("/logout", status_code=204)
def logout(response: Response, settings: SettingsDep) -> None:
    """Logs out by deleting the cookie. Always succeeds, even if not logged in."""
    _clear_cookie(response, settings)


@router.get("/session")
def session(
    response: Response,
    service: ServiceDep,
    settings: SettingsDep,
    token: SessionCookie = None,
) -> SessionResponse:
    """Returns the logged-in user, or `user: null` for a visitor. Always 200 (AD-21)."""
    user = service.current_user(token)
    if user is None and token is not None:
        # The cookie is old or invalid, so delete it and the browser stops sending it.
        _clear_cookie(response, settings)
    return SessionResponse(user=user)
