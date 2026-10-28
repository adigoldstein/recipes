"""Pydantic request and response schemas for auth."""

import uuid

from pydantic import BaseModel, Field

from app.core.security import Role

# The longest email an account can have (RFC 5321).
EMAIL_MAX_LENGTH = 254
# Matches the password policy's ceiling, so a huge body can't be used to burn CPU on
# Argon2. Anything the policy would reject can never be a valid password anyway.
PASSWORD_MAX_LENGTH = 128


class LoginRequest(BaseModel):
    """Plain strings on purpose: a malformed email is just wrong credentials."""

    email: str = Field(min_length=1, max_length=EMAIL_MAX_LENGTH)
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class ChangePasswordRequest(BaseModel):
    """The signed-in user's own password change (Story 2.6).

    The new password's length is checked by the password policy in the service, so
    the client gets the same `password_too_short` error as an admin reset.
    """

    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class SessionUser(BaseModel):
    """What the client may know about the signed-in user (AD-21)."""

    id: uuid.UUID
    email: str
    name: str
    role: Role


class SessionResponse(BaseModel):
    """`user` is null for a visitor."""

    user: SessionUser | None
