from collections.abc import Generator
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Engine
from sqlmodel import Session, create_engine

from app.core.config import Settings, get_settings

DB_FILENAME = "app.db"


@lru_cache
def get_engine(data_dir: Path) -> Engine:
    """One engine per data dir, so overridden settings get their own database."""
    data_dir.mkdir(parents=True, exist_ok=True)
    # FastAPI runs sync endpoints in a thread pool, so one connection may hop threads.
    return create_engine(
        f"sqlite:///{data_dir / DB_FILENAME}",
        connect_args={"check_same_thread": False},
    )


def get_session(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Generator[Session]:
    """One session per request, injectable with `Depends(get_session)`."""
    with Session(get_engine(settings.data_dir)) as session:
        yield session
