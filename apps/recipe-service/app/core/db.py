import json
from collections.abc import Generator
from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends
from pydantic import BaseModel, TypeAdapter
from sqlalchemy import JSON, Column, Dialect, Engine, Enum, Numeric, event
from sqlalchemy.types import DateTime, TypeDecorator
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import Settings, get_settings

DB_FILENAME = "app.db"
# How long a write waits for the database lock, in milliseconds. We set it
# ourselves instead of relying on the driver's default (AD-43).
BUSY_TIMEOUT_MS = 5000

# Fixed names for constraints, so Alembic can rebuild SQLite tables in migrations.
# This must be set before any model is defined, which is why it lives here: every
# model imports this module.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
SQLModel.metadata.naming_convention = NAMING_CONVENTION

# Ingredient amounts are stored with 3 decimal places (AD-31).
AMOUNT_QUANTUM = Decimal("0.001")


def utcnow() -> datetime:
    return datetime.now(UTC)


class UtcDateTime(TypeDecorator[datetime]):
    """A date-time column. SQLite stores it as UTC without a timezone, and reading
    it always returns a UTC date-time with the timezone set (AD-24)."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(
        self, value: datetime | None, dialect: Dialect
    ) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetimes are not allowed; use UTC-aware values")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(
        self, value: datetime | None, dialect: Dialect
    ) -> datetime | None:
        return None if value is None else value.replace(tzinfo=UTC)


class Quantity(TypeDecorator[Decimal]):
    """An amount column, `NUMERIC(12, 3)`. Values are rounded to 3 decimal places
    before saving, so comparing two amounts is exact (AD-31)."""

    impl = Numeric(12, 3, asdecimal=True)
    cache_ok = True

    def process_bind_param(
        self, value: Decimal | None, dialect: Dialect
    ) -> Decimal | None:
        return None if value is None else value.quantize(AMOUNT_QUANTUM)


class PydanticJson[Item: BaseModel](TypeDecorator[list[Item]]):
    """A `JSON` column that holds a list of Pydantic items (AD-41).

    Like TypeORM's `simple-json`, but typed. Each item is validated when saved and
    turned back into an `Item` object when read, so bad stored data raises an error
    when it is read. SQLAlchemy does not notice when you change an item inside the
    list, so to update the column, assign a new list.
    """

    impl = JSON
    cache_ok = True

    def __init__(self, item: type[Item]) -> None:
        super().__init__()
        self._item = item
        self._adapter: TypeAdapter[list[Item]] = TypeAdapter(list[item])  # type: ignore[valid-type]

    def process_bind_param(
        self, value: list[Item] | None, dialect: Dialect
    ) -> list[Any] | None:
        if value is None:
            return None
        dumped: list[Any] = self._adapter.dump_python(
            self._adapter.validate_python(value), mode="json"
        )
        return dumped

    def process_result_value(
        self, value: list[Any] | None, dialect: Dialect
    ) -> list[Item] | None:
        return None if value is None else self._adapter.validate_python(value)


def enum_column(
    enum: type[StrEnum], name: str, *, nullable: bool = False
) -> "Column[Any]":
    """A text column for an enum, with a named `CHECK` that allows only the enum's
    values."""
    return Column(
        Enum(
            enum,
            name=name,
            native_enum=False,
            create_constraint=True,
            length=max(len(member.value) for member in enum),
            values_callable=lambda members: [member.value for member in members],
        ),
        nullable=nullable,
    )


def _set_sqlite_pragmas(dbapi_connection: Any, _record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    # How long a write waits for the lock before it gives up and rolls back (AD-43).
    cursor.execute(f"PRAGMA busy_timeout={BUSY_TIMEOUT_MS}")
    cursor.close()


@lru_cache
def get_engine(data_dir: Path) -> Engine:
    """Returns the database engine for a data folder (one engine per folder).

    Tests that use a different data folder get their own database.
    """
    data_dir.mkdir(parents=True, exist_ok=True)
    # FastAPI runs sync endpoints on several threads, so the same connection may be
    # used from different threads. `check_same_thread=False` allows that.
    engine = create_engine(
        f"sqlite:///{data_dir / DB_FILENAME}",
        connect_args={"check_same_thread": False},
        # Save Hebrew as real letters in the JSON, not as `\u05e7` codes (AD-41).
        json_serializer=lambda value: json.dumps(value, ensure_ascii=False),
    )
    event.listen(engine, "connect", _set_sqlite_pragmas)
    return engine


def get_session(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Generator[Session]:
    """Opens one database session per request and closes it at the end.

    Routes get it with `Depends(get_session)`.
    """
    with Session(get_engine(settings.data_dir)) as session:
        yield session
