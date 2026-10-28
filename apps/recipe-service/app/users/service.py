"""Business rules for users; other modules call this layer, never the repository."""

import uuid
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.core.db import get_session
from app.core.errors import AppError, ErrorCode
from app.core.security import Role, hash_password, verify_password
from app.users.models import User
from app.users.repository import UserRepository
from app.users.schemas import UserCreate, UserRead, UserUpdate

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

    def list_users(self) -> list[UserRead]:
        """All users, oldest account first. There are only a handful (FR-25)."""
        return [_read(user) for user in self._repository.list_all()]

    def authenticate(self, email: str, password: str) -> tuple[UserRead, int] | None:
        """The user and their session version when the email and password match.

        An unknown email and a wrong password look the same to the caller (None), and
        a decoy hash is verified for an unknown email, so the response time does not
        reveal which emails have an account. A blocked account is only revealed to
        someone who knows its password: that raises 403 `account_blocked`, so the
        login page can say why (Story 2.5).
        """
        user = self._repository.get_by_email(email)
        if user is None:
            verify_password(password, _decoy_hash())
            return None
        if not verify_password(password, user.password_hash):
            return None
        if user.is_blocked:
            raise AppError(403, ErrorCode.ACCOUNT_BLOCKED, "This account is blocked")
        return _read(user), user.session_version

    def get_active_user(
        self, user_id: uuid.UUID, session_version: int
    ) -> UserRead | None:
        """The user as they are in the database now.

        None if the user is gone or blocked, or if the token is from an older session
        generation (their password was reset since it was issued).
        """
        user = self._repository.get_by_id(user_id)
        if user is None or user.is_blocked or user.session_version != session_version:
            return None
        return _read(user)

    def update_user(self, user_id: uuid.UUID, changes: UserUpdate) -> UserRead:
        """Change a user's role, blocked flag and/or password (FR-26).

        The last active admin cannot be demoted or blocked (AD-30). The check happens
        after the write but before the commit: the write takes SQLite's single write
        lock, so a second admin changing someone at the same moment waits for this
        transaction, and then counts the admins that are really left.
        """
        if changes.password is not None:
            check_password_policy(changes.password)
        user = self._repository.get_by_id(user_id)
        if user is None:
            raise AppError(404, ErrorCode.USER_NOT_FOUND, "User not found")

        was_active_admin = user.role == Role.ADMIN and not user.is_blocked
        if changes.role is not None:
            user.role = changes.role
        if changes.is_blocked is not None:
            # Blocking also ends the user's sessions, so unblocking later cannot
            # bring an old cookie back to life.
            if changes.is_blocked and not user.is_blocked:
                user.session_version += 1
            user.is_blocked = changes.is_blocked
        if changes.password is not None:
            user.password_hash = hash_password(changes.password)
            user.session_version += 1

        try:
            self._repository.add(user)
            still_active_admin = user.role == Role.ADMIN and not user.is_blocked
            if (
                was_active_admin
                and not still_active_admin
                and self._repository.count_active_admins() == 0
            ):
                raise AppError(
                    409,
                    ErrorCode.LAST_ADMIN,
                    "At least one active admin must remain",
                )
            self._repository.commit()
        except Exception:
            self._repository.rollback()
            raise
        return _read(user)

    def change_own_password(
        self, user_id: uuid.UUID, current_password: str, new_password: str
    ) -> tuple[UserRead, int]:
        """Replace the user's own password after checking the current one (FR-27).

        Returns the user and the new session version, so the caller can issue a
        fresh token: the bump ends every other device's session, not this one.
        """
        user = self._repository.get_by_id(user_id)
        if user is None or user.is_blocked:
            raise AppError(404, ErrorCode.USER_NOT_FOUND, "User not found")
        if not verify_password(current_password, user.password_hash):
            raise AppError(
                400, ErrorCode.INVALID_CREDENTIALS, "Current password is wrong"
            )
        check_password_policy(new_password)
        user.password_hash = hash_password(new_password)
        user.session_version += 1
        try:
            self._repository.add(user)
            self._repository.commit()
        except Exception:
            self._repository.rollback()
            raise
        return _read(user), user.session_version

    def reset_password(self, email: str, password: str) -> UserRead:
        """Replace one user's password. Nothing else about them changes."""
        check_password_policy(password)
        user = self._repository.get_by_email(email)
        if user is None:
            raise AppError(404, ErrorCode.USER_NOT_FOUND, "User not found")
        user.password_hash = hash_password(password)
        user.session_version += 1
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
