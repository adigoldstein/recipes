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
    """Runs the migrations in one transaction, with foreign keys turned off.

    To change a table, SQLite copies it to a new table and drops the old one (Alembic
    batch mode). If foreign keys are on, dropping a parent table such as `recipe`
    also deletes all its child rows. SQLite's docs say to turn foreign keys off,
    check them before committing, and turn them back on at the end.
    """
    # Turn foreign keys off before the transaction starts. Inside a transaction
    # SQLite ignores this setting.
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
    """Applies all the pending migrations to the app database (`alembic upgrade head`).

    Errors are not caught, so a failed migration stops the app from starting (AD-29).
    """
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    with (
        get_engine(data_dir).connect() as connection,
        migration_transaction(connection),
    ):
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
