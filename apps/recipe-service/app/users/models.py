"""SQLModel tables owned by users."""

import uuid
from datetime import datetime

from sqlalchemy import Index, false, func
from sqlmodel import Field, SQLModel

from app.core.db import UtcDateTime, enum_column, utcnow
from app.core.security import Role

EMAIL_MAX_LENGTH = 254
NAME_MAX_LENGTH = 80


class User(SQLModel, table=True):
    """An account that can sign in. A visitor has no row (AD-30)."""

    __tablename__ = "user"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(max_length=EMAIL_MAX_LENGTH)
    name: str = Field(max_length=NAME_MAX_LENGTH)
    role: Role = Field(sa_column=enum_column(Role, "role"))
    # Argon2id hash only; the plain password is never stored.
    password_hash: str
    is_blocked: bool = Field(
        default=False, sa_column_kwargs={"server_default": false()}
    )
    created_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)


# lower(email) makes emails unique case-insensitively (AD-30).
Index(
    "uq_user_lower_email",
    func.lower(User.__table__.c.email),  # type: ignore[attr-defined]
    unique=True,
)
