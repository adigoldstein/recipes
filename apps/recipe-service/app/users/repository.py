"""Database access for users; used only by this module's service."""

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.users.models import User


class UserRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_email(self, email: str) -> User | None:
        """The user with this email, compared case-insensitively (AD-30).

        Both sides go through SQLite's `lower()`, exactly like the unique index, so a
        lookup and the uniqueness rule can never disagree about what "same" means.
        """
        statement = select(User).where(func.lower(col(User.email)) == func.lower(email))
        return self._session.exec(statement).first()

    def add(self, user: User) -> User:
        """Stage the user; the caller commits."""
        self._session.add(user)
        self._session.flush()
        return user

    def commit(self) -> None:
        self._session.commit()

    def rollback(self) -> None:
        self._session.rollback()
