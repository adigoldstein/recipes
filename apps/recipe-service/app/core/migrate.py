from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Connection

from app.core.db import get_engine

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"


@contextmanager
def migration_transaction(connection: Connection) -> Iterator[None]:
    """One transaction for a migration run, with foreign keys switched off.

    SQLite changes a table by copying it and dropping the old one (Alembic batch
    mode). While foreign keys are enforced, dropping a parent table such as `recipe`
    cascade-deletes its children. SQLite's documented procedure is to turn
    enforcement off first (a no-op inside a transaction, hence before it), then run
    `foreign_key_check` before committing, and always turn enforcement back on: the
    connection returns to the pool.
    """
    connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
    connection.commit()
    try:
        with connection.begin():
            yield
            violations = connection.exec_driver_sql("PRAGMA foreign_key_check").all()
            if violations:
                raise RuntimeError(
                    f"Migration left {len(violations)} broken foreign key(s)"
                )
    finally:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.commit()


def run_migrations(data_dir: Path) -> None:
    """Apply every pending migration (`alembic upgrade head`) to the app database.

    Errors propagate, so a failed migration stops the app from starting (AD-29).
    """
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    with (
        get_engine(data_dir).connect() as connection,
        migration_transaction(connection),
    ):
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
