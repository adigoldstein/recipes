"""Database queries for imports. Only this module's service uses them."""

from datetime import datetime

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.imports.models import ImportAttempt, ImportRun


class ImportRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def count_runs_since(self, since: datetime) -> int:
        statement = select(func.count()).where(col(ImportRun.created_at) >= since)
        return self._session.exec(statement).one()

    def add_run(self, run: ImportRun, attempts: list[ImportAttempt]) -> None:
        self._session.add(run)
        self._session.flush()
        for attempt in attempts:
            self._session.add(attempt)
        self._session.flush()

    def commit(self) -> None:
        self._session.commit()
