from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.db import get_engine

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"


def run_migrations(data_dir: Path) -> None:
    """Apply every pending migration (`alembic upgrade head`) to the app database.

    Errors propagate, so a failed migration stops the app from starting (AD-29).
    """
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    with get_engine(data_dir).begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
