"""SQLModel tables owned by imports (AD-38)."""

import uuid
from datetime import datetime

from sqlalchemy import Index, false
from sqlmodel import Field, SQLModel

from app.core.db import UtcDateTime, utcnow


class ImportRun(SQLModel, table=True):
    """One row per import: what ran, how long, how it ended. Counts the daily cap."""

    __tablename__ = "import_runs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # String reference: imports must not import the users module's models.
    user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    provider: str = Field(max_length=40)
    model: str = Field(max_length=100)
    source_kind: str = Field(max_length=10)  # "text" or "url"
    path: str = Field(max_length=10)  # "llm" or "json_ld"
    prompt_version: str = Field(max_length=40)
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None
    first_try_valid: bool = Field(
        default=False, sa_column_kwargs={"server_default": false()}
    )
    retried: bool = Field(default=False, sa_column_kwargs={"server_default": false()})
    # "ok" or an error code.
    outcome: str = Field(max_length=40)
    created_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)


Index("ix_import_runs_created_at", ImportRun.__table__.c.created_at)  # type: ignore[attr-defined]


class ImportAttempt(SQLModel, table=True):
    """One row per engine tried inside a run, so a fallback shows every step."""

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
    created_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)


Index(
    "ix_import_attempts_run_id",
    ImportAttempt.__table__.c.run_id,  # type: ignore[attr-defined]
)
