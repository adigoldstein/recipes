"""Pydantic request and response schemas for users."""

import unicodedata
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator

from app.core.security import Role
from app.users.models import NAME_MAX_LENGTH


def normalize_name(name: str) -> str:
    """NFC, trimmed, inner whitespace collapsed to single spaces (AD-24)."""
    return " ".join(unicodedata.normalize("NFC", name).split())


class UserCreate(BaseModel):
    """What it takes to make an account. The password travels separately."""

    email: EmailStr
    name: str
    role: Role

    @field_validator("email", mode="before")
    @classmethod
    def _strip_email(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        value = normalize_name(value)
        if not 1 <= len(value) <= NAME_MAX_LENGTH:
            raise ValueError(f"name must be 1-{NAME_MAX_LENGTH} characters")
        return value


class UserCreateRequest(UserCreate):
    """The body of `POST /api/users`: an account plus its starting password.

    The confirmation field of the form is checked in the browser only; the server
    just enforces the password policy (FR-13).
    """

    password: str


class UserUpdate(BaseModel):
    """The body of `PATCH /api/users/{id}`: any of these, at least one.

    A field that is left out stays as it is. `password` is a reset: it replaces the
    current one and ends every session the user has.
    """

    model_config = ConfigDict(extra="forbid")

    role: Role | None = None
    is_blocked: bool | None = None
    password: str | None = None

    @model_validator(mode="after")
    def _something_to_change(self) -> "UserUpdate":
        if not self.model_fields_set:
            raise ValueError("send at least one of role, is_blocked or password")
        if any(getattr(self, name) is None for name in self.model_fields_set):
            raise ValueError("role, is_blocked and password cannot be null")
        return self


class UserRead(BaseModel):
    """A user as returned to callers. There is deliberately no password field."""

    id: uuid.UUID
    email: str
    name: str
    role: Role
    is_blocked: bool
    created_at: datetime
