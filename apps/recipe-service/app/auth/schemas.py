"""The request and response shapes (Pydantic) of auth."""

import uuid

from pydantic import BaseModel, Field

from app.core.security import Role

# The maximum length of an email address (RFC 5321).
EMAIL_MAX_LENGTH = 254
# The same maximum as the password policy. It stops someone from sending a huge
# password just to waste CPU on Argon2. A longer password can never be valid anyway.
PASSWORD_MAX_LENGTH = 128


class LoginRequest(BaseModel):
    """Login details. The email is a plain string on purpose: an invalid email is
    treated like any wrong email and password."""

    email: str = Field(min_length=1, max_length=EMAIL_MAX_LENGTH)
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class ChangePasswordRequest(BaseModel):
    """The body for changing your own password (Story 2.6).

    The length of the new password is checked in the service, by the password
    policy. That way the client gets the same `password_too_short` error as when an
    admin resets a password.
    """

    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class SessionUser(BaseModel):
    """The details of the logged-in user that the client may see (AD-21)."""

    id: uuid.UUID
    email: str
    name: str
    role: Role


class SessionResponse(BaseModel):
    """The current session. `user` is null for a visitor."""

    user: SessionUser | None
