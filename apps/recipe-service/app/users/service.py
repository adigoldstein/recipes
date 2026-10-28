"""Business rules for users; other modules call this layer, never the repository."""

import uuid
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.core.db import get_session
from app.core.errors import AppError, ErrorCode
from app.core.security import hash_password, verify_password
from app.users.models import User
from app.users.repository import UserRepository
from app.users.schemas import UserCreate, UserRead

MIN_PASSWORD_LENGTH = 8
# Argon2 has no built-in length limit, so cap it: a huge password is only a way to
# burn CPU.
MAX_PASSWORD_LENGTH = 128


def check_password_policy(password: str) -> None:
    """Raise `AppError` unless the password is 8-128 characters (FR-13)."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise AppError(
            422,
            ErrorCode.PASSWORD_TOO_SHORT,
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters",
            params={"min": MIN_PASSWORD_LENGTH},
        )
    if len(password) > MAX_PASSWORD_LENGTH:
        raise AppError(
            422,
            ErrorCode.PASSWORD_TOO_LONG,
            f"Password must be at most {MAX_PASSWORD_LENGTH} characters",
            params={"max": MAX_PASSWORD_LENGTH},
        )


def _read(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_blocked=user.is_blocked,
        created_at=user.created_at,
    )


@lru_cache
def _decoy_hash() -> str:
    """A real hash nobody has the password to, so an unknown email costs as much."""
    return hash_password(uuid.uuid4().hex)


def _email_taken() -> AppError:
    return AppError(409, ErrorCode.EMAIL_TAKEN, "A user with this email already exists")


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    def create_user(self, data: UserCreate, password: str) -> UserRead:
        """Store a new user with a hashed password; the email must be unused."""
        check_password_policy(password)
        if self._repository.get_by_email(data.email) is not None:
            raise _email_taken()
        user = User(
            email=data.email,
            name=data.name,
            role=data.role,
            password_hash=hash_password(password),
        )
        try:
            self._repository.add(user)
            self._repository.commit()
        except IntegrityError:
            # Someone took the email between our check and the insert.
            self._repository.rollback()
            raise _email_taken() from None
        except Exception:
            self._repository.rollback()
            raise
        return _read(user)

    def authenticate(self, email: str, password: str) -> UserRead | None:
        """The active user whose email and password match, else None.

        Unknown email, wrong password and a blocked account all look the same to the
        caller. A decoy hash is verified for an unknown email, so the response time
        does not reveal which emails have an account.
        """
        user = self._repository.get_by_email(email)
        if user is None:
            verify_password(password, _decoy_hash())
            return None
        if not verify_password(password, user.password_hash) or user.is_blocked:
            return None
        return _read(user)

    def get_active_user(self, user_id: uuid.UUID) -> UserRead | None:
        """The user as they are in the database now; None if gone or blocked."""
        user = self._repository.get_by_id(user_id)
        if user is None or user.is_blocked:
            return None
        return _read(user)

    def reset_password(self, email: str, password: str) -> UserRead:
        """Replace one user's password. Nothing else about them changes."""
        check_password_policy(password)
        user = self._repository.get_by_email(email)
        if user is None:
            raise AppError(404, ErrorCode.USER_NOT_FOUND, "User not found")
        user.password_hash = hash_password(password)
        try:
            self._repository.add(user)
            self._repository.commit()
        except Exception:
            self._repository.rollback()
            raise
        return _read(user)


def get_user_service(session: Annotated[Session, Depends(get_session)]) -> UserService:
    """Provider, like a Nest injectable: `Depends(get_user_service)`."""
    return UserService(UserRepository(session))
