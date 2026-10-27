from collections.abc import Generator
from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import Column, Dialect, Engine, Enum, Numeric, event
from sqlalchemy.types import DateTime, TypeDecorator
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import Settings, get_settings

DB_FILENAME = "app.db"

# Stable constraint names, so Alembic batch mode can recreate SQLite tables.
# Set before any model is defined: models import this module.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
SQLModel.metadata.naming_convention = NAMING_CONVENTION

# AD-31: amounts keep 3 decimal places.
AMOUNT_QUANTUM = Decimal("0.001")


def utcnow() -> datetime:
    return datetime.now(UTC)


class UtcDateTime(TypeDecorator[datetime]):
    """Stores naive UTC in SQLite and always hands back timezone-aware UTC (AD-24)."""

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
    """`NUMERIC(12, 3)`: quantized on the way in, so comparisons are exact (AD-31)."""

    impl = Numeric(12, 3, asdecimal=True)
    cache_ok = True

    def process_bind_param(
        self, value: Decimal | None, dialect: Dialect
    ) -> Decimal | None:
        return None if value is None else value.quantize(AMOUNT_QUANTUM)


def enum_column(
    enum: type[StrEnum], name: str, *, nullable: bool = False
) -> "Column[Any]":
    """A `VARCHAR` column with a named `CHECK` over the enum's values."""
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
    cursor.close()


@lru_cache
def get_engine(data_dir: Path) -> Engine:
    """One engine per data dir, so overridden settings get their own database."""
    data_dir.mkdir(parents=True, exist_ok=True)
    # FastAPI runs sync endpoints in a thread pool, so one connection may hop threads.
    engine = create_engine(
        f"sqlite:///{data_dir / DB_FILENAME}",
        connect_args={"check_same_thread": False},
    )
    event.listen(engine, "connect", _set_sqlite_pragmas)
    return engine


def get_session(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Generator[Session]:
    """One session per request, injectable with `Depends(get_session)`."""
    with Session(get_engine(settings.data_dir)) as session:
        yield session
