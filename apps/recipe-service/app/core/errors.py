from enum import StrEnum

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorCode(StrEnum):
    """Stable error codes; the client shows `errors.<code>` from he.json."""

    RECIPE_NOT_FOUND = "recipe_not_found"
    TAG_NOT_FOUND = "tag_not_found"
    EMAIL_TAKEN = "email_taken"
    USER_NOT_FOUND = "user_not_found"
    PASSWORD_TOO_SHORT = "password_too_short"
    PASSWORD_TOO_LONG = "password_too_long"


class ErrorResponse(BaseModel):
    detail: str
    code: ErrorCode
    params: dict[str, str | int] | None = None


class AppError(Exception):
    """Raise from a service to return a non-422 error with a stable code."""

    def __init__(
        self,
        status_code: int,
        code: ErrorCode,
        detail: str,
        params: dict[str, str | int] | None = None,
    ) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.body = ErrorResponse(detail=detail, code=code, params=params)


async def _app_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):
        raise exc
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.body.model_dump(mode="json", exclude_none=True),
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)
