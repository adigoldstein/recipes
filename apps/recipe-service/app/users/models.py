"""The database tables of the users module."""

import uuid
from datetime import datetime

from sqlalchemy import Index, false, func, text
from sqlmodel import Field, SQLModel

from app.core.db import UtcDateTime, enum_column, utcnow
from app.core.security import Role

EMAIL_MAX_LENGTH = 254
NAME_MAX_LENGTH = 80


class User(SQLModel, table=True):
    """A user account that can log in. Visitors are not stored (AD-30)."""

    __tablename__ = "user"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(max_length=EMAIL_MAX_LENGTH)
    name: str = Field(max_length=NAME_MAX_LENGTH)
    role: Role = Field(sa_column=enum_column(Role, "role"))
    # The Argon2id hash of the password. The plain password is never stored.
    password_hash: str
    is_blocked: bool = Field(
        default=False, sa_column_kwargs={"server_default": false()}
    )
    # Each session token holds the version it was created with. Increasing this
    # number logs the user out on all devices (used on password reset and block).
    session_version: int = Field(
        default=0, sa_column_kwargs={"server_default": text("0")}
    )
    created_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)


# Emails must be unique, ignoring upper and lower case (AD-30).
Index(
    "uq_user_lower_email",
    func.lower(User.__table__.c.email),  # type: ignore[attr-defined]
    unique=True,
)
