from typing import Literal

from alembic import context
from alembic.autogenerate.api import AutogenContext
from sqlalchemy import Connection
from sqlmodel.sql.sqltypes import AutoString

from app.core.config import get_settings
from app.core.db import Quantity, UtcDateTime, get_engine
from app.core.metadata import metadata
from app.core.migrate import migration_transaction


def _render_item(
    type_: str, obj: object, _autogen_context: AutogenContext
) -> str | Literal[False]:
    """Writes column types in new migrations without importing app code, so the
    migration files keep working the same way forever."""
    if type_ != "type":
        return False
    if isinstance(obj, AutoString):
        return (
            "sa.String()" if obj.length is None else f"sa.String(length={obj.length})"
        )
    if isinstance(obj, UtcDateTime):
        return "sa.DateTime()"
    if isinstance(obj, Quantity):
        return "sa.Numeric(precision=12, scale=3)"
    return False


def _run(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=metadata,
        # SQLite cannot change most things in a table directly, so batch mode copies
        # the table instead.
        render_as_batch=True,
        compare_type=True,
        render_item=_render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # `app.core.migrate` passes its own connection. When run from the CLI, we create
    # one from the settings.
    connection = context.config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return
    with (
        get_engine(get_settings().data_dir).connect() as new_connection,
        migration_transaction(new_connection),
    ):
        _run(new_connection)


if context.is_offline_mode():
    raise RuntimeError("Offline migrations are not supported; run against a database")
run_migrations_online()
