"""The business logic of users. Other modules call this layer, not the repository."""

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
# Argon2 has no length limit of its own, so we set one. A huge password would only
# waste CPU.
MAX_PASSWORD_LENGTH = 128


def check_password_policy(password: str) -> None:
    """Raises `AppError` if the password is not 8 to 128 characters long (FR-13)."""
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
    """A real hash of a random password that nobody knows.

    We check passwords against it when the email does not exist, so that login takes
    the same time either way.
    """
    return hash_password(uuid.uuid4().hex)


def _email_taken() -> AppError:
    return AppError(409, ErrorCode.EMAIL_TAKEN, "A user with this email already exists")


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    def create_user(self, data: UserCreate, password: str) -> UserRead:
        """Saves a new user with a hashed password. The email must not be in use."""
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
            # Someone else used this email between our check and the insert.
            self._repository.rollback()
            raise _email_taken() from None
        except Exception:
            self._repository.rollback()
            raise
        return _read(user)

    def list_users(self) -> list[UserRead]:
        """Returns all users, oldest account first. There are only a few (FR-25)."""
        return [_read(user) for user in self._repository.list_all()]

    def authenticate(self, email: str, password: str) -> tuple[UserRead, int] | None:
        """Checks the email and password. Returns the user and their session version
        if they match, otherwise None.

        An unknown email and a wrong password both return None, so the caller cannot
        tell them apart.
        """
        user = self._repository.get_by_email(email)
        if user is None:
            # Check against a fake hash anyway, so the response time does not reveal
            # which emails have an account.
            verify_password(password, _decoy_hash())
            return None
        if not verify_password(password, user.password_hash):
            return None
        # Only someone who knows the password learns that the account is blocked.
        # The login page can then explain why they cannot log in (Story 2.5).
        if user.is_blocked:
            raise AppError(403, ErrorCode.ACCOUNT_BLOCKED, "This account is blocked")
        return _read(user), user.session_version

    def get_active_user(
        self, user_id: uuid.UUID, session_version: int
    ) -> UserRead | None:
        """Returns the user as they are in the database right now.

        Returns None if the user was deleted or blocked, or if the token's session
        version is old (the password was reset after the token was created).
        """
        user = self._repository.get_by_id(user_id)
        if user is None or user.is_blocked or user.session_version != session_version:
            return None
        return _read(user)

    def update_user(self, user_id: uuid.UUID, changes: UserUpdate) -> UserRead:
        """Changes a user's role, blocked status, and/or password (FR-26).

        The last active admin cannot be demoted or blocked (AD-30).
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
            # Blocking also logs the user out everywhere, so unblocking them later
            # does not make an old cookie work again.
            if changes.is_blocked and not user.is_blocked:
                user.session_version += 1
            user.is_blocked = changes.is_blocked
        if changes.password is not None:
            user.password_hash = hash_password(changes.password)
            user.session_version += 1

        try:
            # Save first, and check that an active admin is left only after that,
            # before the commit. The save takes SQLite's write lock, so if another
            # admin changes a user at the same time, they wait for us and then count
            # the admins that are really left.
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
        """Replaces the user's own password, after checking the current one (FR-27).

        Returns the user and the new session version. The caller uses it to create a
        new token, so this device stays logged in and all the others are logged out.
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
        """Replaces one user's password. Nothing else about the user changes."""
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
    """Creates the user service for a route, like a Nest provider:
    `Depends(get_user_service)`."""
    return UserService(UserRepository(session))
