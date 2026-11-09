"""The request and response shapes (Pydantic) of users."""

import unicodedata
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator

from app.core.security import Role
from app.users.models import NAME_MAX_LENGTH


def normalize_name(name: str) -> str:
    """Cleans up a name: Unicode NFC form, no spaces at the ends, and single spaces
    between words (AD-24)."""
    return " ".join(unicodedata.normalize("NFC", name).split())


class UserCreate(BaseModel):
    """The details needed to create an account. The password is passed separately."""

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
    """The body of `POST /api/users`: the new account and its first password.

    The form's "confirm password" field is checked only in the browser. The server
    only checks the password policy (FR-13).
    """

    password: str


class UserUpdate(BaseModel):
    """The body of `PATCH /api/users/{id}`. Send at least one field.

    A field that is not sent does not change. Sending `password` resets it: the new
    password replaces the old one and the user is logged out on all devices.
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
    """A user as the API returns it. On purpose, it has no password field."""

    id: uuid.UUID
    email: str
    name: str
    role: Role
    is_blocked: bool
    created_at: datetime
