"""The database tables of the imports module (AD-38)."""

import uuid
from datetime import datetime

from sqlalchemy import Index, false
from sqlmodel import Field, SQLModel

from app.core.db import UtcDateTime, utcnow


class ImportRun(SQLModel, table=True):
    """One row per import: what ran, how long it took, and how it ended.

    The daily import limit is counted from these rows.
    """

    __tablename__ = "import_runs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # The foreign key is a string because imports may not import the users module.
    user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    provider: str = Field(max_length=40)
    model: str = Field(max_length=100)
    # "text" or "url".
    source_kind: str = Field(max_length=10)
    # "llm" or "json_ld".
    path: str = Field(max_length=10)
    prompt_version: str = Field(max_length=40)
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None
    first_try_valid: bool = Field(
        default=False, sa_column_kwargs={"server_default": false()}
    )
    retried: bool = Field(default=False, sa_column_kwargs={"server_default": false()})
    # "ok", or an error code.
    outcome: str = Field(max_length=40)
    created_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)


Index("ix_import_runs_created_at", ImportRun.__table__.c.created_at)  # type: ignore[attr-defined]


class ImportAttempt(SQLModel, table=True):
    """One row for each AI engine tried during an import, so every attempt is
    recorded."""

    __tablename__ = "import_attempts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    run_id: uuid.UUID = Field(foreign_key="import_runs.id", ondelete="CASCADE")
    provider: str = Field(max_length=40)
    model: str = Field(max_length=100)
    attempt_no: int
    outcome: str = Field(max_length=40)
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None
    # The HTTP status the AI provider returned when the call failed. None on success.
    upstream_status: int | None = None
    created_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)


Index(
    "ix_import_attempts_run_id",
    ImportAttempt.__table__.c.run_id,  # type: ignore[attr-defined]
)
