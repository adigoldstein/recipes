"""Database queries for users. Only this module's service uses them."""

import uuid

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.core.security import Role
from app.users.models import User


class UserRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self._session.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        """Finds the user with this email, ignoring upper and lower case (AD-30).

        Both sides use SQLite's `lower()`, just like the unique index, so the search
        and the uniqueness rule always agree on which emails are the same.
        """
        statement = select(User).where(func.lower(col(User.email)) == func.lower(email))
        return self._session.exec(statement).first()

    def list_all(self) -> list[User]:
        """Returns all users, oldest account first."""
        statement = select(User).order_by(col(User.created_at), col(User.email))
        return list(self._session.exec(statement).all())

    def count_active_admins(self) -> int:
        """Counts the admins who can log in right now (admin role and not blocked)."""
        statement = (
            select(func.count())
            .select_from(User)
            .where(col(User.role) == Role.ADMIN, col(User.is_blocked).is_(False))
        )
        return self._session.exec(statement).one()

    def add(self, user: User) -> User:
        """Adds or updates the user in the session. The caller commits."""
        self._session.add(user)
        self._session.flush()
        return user

    def commit(self) -> None:
        self._session.commit()

    def rollback(self) -> None:
        self._session.rollback()
