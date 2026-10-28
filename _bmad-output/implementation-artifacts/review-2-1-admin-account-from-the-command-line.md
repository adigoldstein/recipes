# Review: Story 2.1 Admin account from the command line

Spec: `spec-2-1-admin-account-from-the-command-line.md`. Not committed; for Adi's review.

## Checks run

- `nx run-many -t lint typecheck test -p recipe-service data-access i18n` and
  `nx affected -t lint typecheck test build`: all green. Backend: ruff, ruff format, mypy strict,
  lint-imports (13 contracts kept), 171+ pytest tests; new code at 100% line and branch coverage.
- `nx format:check` passes. `nx run data-access:generate` rerun: only the `ErrorCode` enum changed.
- Real on-disk run of `python -m app.cli create-admin` (create, duplicate in another case, reset)
  against a throwaway database: works, the hash is `$argon2id$…`.
- Not verified by me: `nx run recipe-service:create-admin` in a real terminal. The Windows
  `getpass` reads the console, so it hangs in my console-less shell. Please try it once.

## Decision for Adi to be aware of

While testing the migration against a database that had a recipe with ingredients, steps and a
tag, the upgrade silently deleted the children (`recipe` is rebuilt for its new FKs and SQLite
cascades the drop). This is fixed in `app/core/migrate.py` (`migration_transaction`), which
touches the existing migration mechanics; see the spec. A regression test covers it.

## Files

New: `app/migrations/versions/20261028_0002_users_and_recipe_authors.py`,
`tests/test_security.py`, `tests/test_users.py`, the spec and this file.
Changed: see the diffs below (`uv.lock` and generated client are summarised).

## apps/recipe-service/README.md

```diff
diff --git a/apps/recipe-service/README.md b/apps/recipe-service/README.md
index 75f3d01..0f3dc6e 100644
--- a/apps/recipe-service/README.md
+++ b/apps/recipe-service/README.md
@@ -45,6 +45,27 @@ Revisions must not import app code: they have to run the same way forever. Alemb
 cannot see SQLite expression indexes, so write those by hand (see revision `0001`).
 Do not edit a revision that has shipped; add a new one.
 
+SQLite changes a table by copying it and dropping the old one. With foreign keys on,
+dropping a parent such as `recipe` would delete its ingredients, steps and tag links, so
+migrations run through `migration_transaction` (`app/core/migrate.py`): enforcement is
+off while they run, `PRAGMA foreign_key_check` must come back empty before the commit, and
+enforcement is always switched back on. Both the app and `alembic upgrade` use it.
+
+## Accounts
+
+There is no sign-up. The first admin comes from the command line (AD-30), in an
+interactive terminal:
+
+```bash
+npx nx run recipe-service:create-admin -- --email you@example.com --name "Your Name"
+```
+
+It migrates the database if needed, asks for the password twice (hidden, 8 to 128
+characters) and stores only its Argon2id hash. The password is never an argument, never
+printed and never logged. If the email already exists it fails; with `--reset-password`
+(no `--name` needed) it instead changes only that user's password. Emails are unique
+ignoring case. It needs a real console: without one the password prompt cannot read input.
+
 ## Demo data
 
 `npx nx run recipe-service:seed` (`python -m app.cli seed`) migrates the database, then
@@ -57,6 +78,7 @@ and never creates the default tags. Needs a `.env` (see Configuration).
 npx nx run recipe-service:serve   # http://localhost:8000/api/health
 npx nx run recipe-service:test
 npx nx run recipe-service:seed    # demo recipes
+npx nx run recipe-service:create-admin -- --email … --name …   # first admin
 npx nx run recipe-service:lint
 npx nx run recipe-service:openapi   # writes libs/data-access/openapi.json (use data-access:generate for the client)
 ```
```

## apps/recipe-service/app/cli.py

```diff
diff --git a/apps/recipe-service/app/cli.py b/apps/recipe-service/app/cli.py
index 0884a7a..79c942e 100644
--- a/apps/recipe-service/app/cli.py
+++ b/apps/recipe-service/app/cli.py
@@ -1,17 +1,23 @@
-"""Command line entry point: `python -m app.cli seed` (AD-24)."""
+"""Command line entry point: `python -m app.cli seed|create-admin` (AD-24, AD-30)."""
 
 import argparse
 import sys
 from collections.abc import Sequence
+from getpass import getpass
 
+from pydantic import ValidationError
 from sqlmodel import Session
 
 from app.core.config import get_settings
 from app.core.db import get_engine
+from app.core.errors import AppError
 from app.core.migrate import run_migrations
+from app.core.security import Role
 from app.recipes.service import get_recipe_service
 from app.seed import run_seed
 from app.tags.service import get_tag_service
+from app.users.schemas import UserCreate
+from app.users.service import get_user_service
 
 
 def _seed() -> int:
@@ -24,10 +30,74 @@ def _seed() -> int:
     return 0
 
 
+def _fail(message: str) -> int:
+    print(f"Error: {message}", file=sys.stderr)
+    return 1
+
+
+def _ask_password() -> str | None:
+    """Read the password twice without echo. It never touches argv, env or output."""
+    password = getpass("Password: ")
+    if getpass("Repeat password: ") != password:
+        return None
+    return password
+
+
+def _create_admin(email: str, name: str | None, *, reset_password: bool) -> int:
+    new_user: UserCreate | None = None
+    if not reset_password:
+        if name is None:
+            return _fail("--name is required to create an admin")
+        try:
+            new_user = UserCreate(email=email, name=name, role=Role.ADMIN)
+        except ValidationError as error:
+            # Messages only: the raw input is never echoed back.
+            problems = "; ".join(
+                f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}"
+                for item in error.errors(include_input=False, include_url=False)
+            )
+            return _fail(problems)
+
+    try:
+        password = _ask_password()
+    except (EOFError, KeyboardInterrupt):
+        return _fail("cancelled")
+    if password is None:
+        return _fail("the passwords do not match")
+
+    data_dir = get_settings().data_dir
+    run_migrations(data_dir)
+    try:
+        with Session(get_engine(data_dir)) as session:
+            service = get_user_service(session)
+            if new_user is None:
+                user = service.reset_password(email, password)
+                print(f"Password changed for {user.email}.")
+            else:
+                user = service.create_user(new_user, password)
+                print(f"Admin {user.email} created.")
+    except AppError as error:
+        return _fail(error.body.detail)
+    return 0
+
+
 def build_parser() -> argparse.ArgumentParser:
     parser = argparse.ArgumentParser(prog="python -m app.cli")
     commands = parser.add_subparsers(dest="command", required=True)
     commands.add_parser("seed", help="Fill the database with demo recipes")
+    create_admin = commands.add_parser(
+        "create-admin",
+        help="Create the admin account (asks for the password twice)",
+    )
+    create_admin.add_argument("--email", required=True)
+    create_admin.add_argument(
+        "--name", help="Display name (required unless --reset-password)"
+    )
+    create_admin.add_argument(
+        "--reset-password",
+        action="store_true",
+        help="The user already exists: change only their password",
+    )
     return parser
 
 
@@ -35,6 +105,8 @@ def main(argv: Sequence[str] | None = None) -> int:
     args = build_parser().parse_args(argv)
     if args.command == "seed":
         return _seed()
+    if args.command == "create-admin":
+        return _create_admin(args.email, args.name, reset_password=args.reset_password)
     raise AssertionError(args.command)  # pragma: no cover
 
 
```

## apps/recipe-service/app/core/errors.py

```diff
diff --git a/apps/recipe-service/app/core/errors.py b/apps/recipe-service/app/core/errors.py
index 6de5423..e4cb15c 100644
--- a/apps/recipe-service/app/core/errors.py
+++ b/apps/recipe-service/app/core/errors.py
@@ -10,6 +10,10 @@ class ErrorCode(StrEnum):
 
     RECIPE_NOT_FOUND = "recipe_not_found"
     TAG_NOT_FOUND = "tag_not_found"
+    EMAIL_TAKEN = "email_taken"
+    USER_NOT_FOUND = "user_not_found"
+    PASSWORD_TOO_SHORT = "password_too_short"
+    PASSWORD_TOO_LONG = "password_too_long"
 
 
 class ErrorResponse(BaseModel):
```

## apps/recipe-service/app/core/migrate.py

```diff
diff --git a/apps/recipe-service/app/core/migrate.py b/apps/recipe-service/app/core/migrate.py
index 81c5000..bed0b89 100644
--- a/apps/recipe-service/app/core/migrate.py
+++ b/apps/recipe-service/app/core/migrate.py
@@ -1,13 +1,42 @@
+from collections.abc import Iterator
+from contextlib import contextmanager
 from pathlib import Path
 
 from alembic import command
 from alembic.config import Config
+from sqlalchemy import Connection
 
 from app.core.db import get_engine
 
 MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"
 
 
+@contextmanager
+def migration_transaction(connection: Connection) -> Iterator[None]:
+    """One transaction for a migration run, with foreign keys switched off.
+
+    SQLite changes a table by copying it and dropping the old one (Alembic batch
+    mode). While foreign keys are enforced, dropping a parent table such as `recipe`
+    cascade-deletes its children. SQLite's documented procedure is to turn
+    enforcement off first (a no-op inside a transaction, hence before it), then run
+    `foreign_key_check` before committing, and always turn enforcement back on: the
+    connection returns to the pool.
+    """
+    connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
+    connection.commit()
+    try:
+        with connection.begin():
+            yield
+            violations = connection.exec_driver_sql("PRAGMA foreign_key_check").all()
+            if violations:
+                raise RuntimeError(
+                    f"Migration left {len(violations)} broken foreign key(s)"
+                )
+    finally:
+        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
+        connection.commit()
+
+
 def run_migrations(data_dir: Path) -> None:
     """Apply every pending migration (`alembic upgrade head`) to the app database.
 
@@ -15,6 +44,9 @@ def run_migrations(data_dir: Path) -> None:
     """
     config = Config()
     config.set_main_option("script_location", str(MIGRATIONS_DIR))
-    with get_engine(data_dir).begin() as connection:
+    with (
+        get_engine(data_dir).connect() as connection,
+        migration_transaction(connection),
+    ):
         config.attributes["connection"] = connection
         command.upgrade(config, "head")
```

## apps/recipe-service/app/core/security.py

```diff
diff --git a/apps/recipe-service/app/core/security.py b/apps/recipe-service/app/core/security.py
index 8790beb..070925c 100644
--- a/apps/recipe-service/app/core/security.py
+++ b/apps/recipe-service/app/core/security.py
@@ -1 +1,34 @@
-"""Session and role guards (`require_role`) shared by every protected route."""
+"""Roles, password hashing, and (from Story 2.3) the `require_role` guards."""
+
+from enum import StrEnum
+
+from pwdlib import PasswordHash
+from pwdlib.exceptions import UnknownHashError
+from pwdlib.hashers.argon2 import Argon2Hasher
+
+
+class Role(StrEnum):
+    """A visitor has no session, so there is no viewer role (AD-30)."""
+
+    EDITOR = "editor"
+    ADMIN = "admin"
+
+
+# Argon2id only, with the library's recommended cost settings (AD-6).
+_hasher = PasswordHash((Argon2Hasher(),))
+
+
+def hash_password(password: str) -> str:
+    """A salted Argon2id hash; the plain password is never stored or logged."""
+    return _hasher.hash(password)
+
+
+def verify_password(password: str, password_hash: str) -> bool:
+    """Whether the password matches the hash. The comparison is constant-time.
+
+    A stored value that is not a known hash format simply never matches.
+    """
+    try:
+        return _hasher.verify(password, password_hash)
+    except UnknownHashError:
+        return False
```

## apps/recipe-service/app/migrations/env.py

```diff
diff --git a/apps/recipe-service/app/migrations/env.py b/apps/recipe-service/app/migrations/env.py
index f214e0f..9e0c091 100644
--- a/apps/recipe-service/app/migrations/env.py
+++ b/apps/recipe-service/app/migrations/env.py
@@ -8,6 +8,7 @@ from sqlmodel.sql.sqltypes import AutoString
 from app.core.config import get_settings
 from app.core.db import Quantity, UtcDateTime, get_engine
 from app.core.metadata import metadata
+from app.core.migrate import migration_transaction
 
 
 def _render_item(
@@ -46,7 +47,10 @@ def run_migrations_online() -> None:
     if connection is not None:
         _run(connection)
         return
-    with get_engine(get_settings().data_dir).begin() as new_connection:
+    with (
+        get_engine(get_settings().data_dir).connect() as new_connection,
+        migration_transaction(new_connection),
+    ):
         _run(new_connection)
 
 
```

## apps/recipe-service/app/recipes/models.py

```diff
diff --git a/apps/recipe-service/app/recipes/models.py b/apps/recipe-service/app/recipes/models.py
index 9e6e4e3..e30b41e 100644
--- a/apps/recipe-service/app/recipes/models.py
+++ b/apps/recipe-service/app/recipes/models.py
@@ -22,9 +22,14 @@ class Recipe(SQLModel, table=True):
     prep_time_minutes: int | None = None
     cook_time_minutes: int | None = None
     source_url: str | None = Field(default=None, max_length=2048)
-    # Their foreign key to `user` arrives in Story 2.1.
-    created_by: uuid.UUID | None = None
-    updated_by: uuid.UUID | None = None
+    # String reference: recipes must not import the users module. A removed user
+    # leaves their recipes behind with no author.
+    created_by: uuid.UUID | None = Field(
+        default=None, foreign_key="user.id", ondelete="SET NULL"
+    )
+    updated_by: uuid.UUID | None = Field(
+        default=None, foreign_key="user.id", ondelete="SET NULL"
+    )
     created_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)
     updated_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)
 
```

## apps/recipe-service/app/users/models.py

```diff
diff --git a/apps/recipe-service/app/users/models.py b/apps/recipe-service/app/users/models.py
index abcffbd..f2a8259 100644
--- a/apps/recipe-service/app/users/models.py
+++ b/apps/recipe-service/app/users/models.py
@@ -1 +1,38 @@
 """SQLModel tables owned by users."""
+
+import uuid
+from datetime import datetime
+
+from sqlalchemy import Index, false, func
+from sqlmodel import Field, SQLModel
+
+from app.core.db import UtcDateTime, enum_column, utcnow
+from app.core.security import Role
+
+EMAIL_MAX_LENGTH = 254
+NAME_MAX_LENGTH = 80
+
+
+class User(SQLModel, table=True):
+    """An account that can sign in. A visitor has no row (AD-30)."""
+
+    __tablename__ = "user"
+
+    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
+    email: str = Field(max_length=EMAIL_MAX_LENGTH)
+    name: str = Field(max_length=NAME_MAX_LENGTH)
+    role: Role = Field(sa_column=enum_column(Role, "role"))
+    # Argon2id hash only; the plain password is never stored.
+    password_hash: str
+    is_blocked: bool = Field(
+        default=False, sa_column_kwargs={"server_default": false()}
+    )
+    created_at: datetime = Field(default_factory=utcnow, sa_type=UtcDateTime)
+
+
+# lower(email) makes emails unique case-insensitively (AD-30).
+Index(
+    "uq_user_lower_email",
+    func.lower(User.__table__.c.email),  # type: ignore[attr-defined]
+    unique=True,
+)
```

## apps/recipe-service/app/users/repository.py

```diff
diff --git a/apps/recipe-service/app/users/repository.py b/apps/recipe-service/app/users/repository.py
index bd60c00..034823f 100644
--- a/apps/recipe-service/app/users/repository.py
+++ b/apps/recipe-service/app/users/repository.py
@@ -1 +1,32 @@
 """Database access for users; used only by this module's service."""
+
+from sqlalchemy import func
+from sqlmodel import Session, col, select
+
+from app.users.models import User
+
+
+class UserRepository:
+    def __init__(self, session: Session) -> None:
+        self._session = session
+
+    def get_by_email(self, email: str) -> User | None:
+        """The user with this email, compared case-insensitively (AD-30).
+
+        Both sides go through SQLite's `lower()`, exactly like the unique index, so a
+        lookup and the uniqueness rule can never disagree about what "same" means.
+        """
+        statement = select(User).where(func.lower(col(User.email)) == func.lower(email))
+        return self._session.exec(statement).first()
+
+    def add(self, user: User) -> User:
+        """Stage the user; the caller commits."""
+        self._session.add(user)
+        self._session.flush()
+        return user
+
+    def commit(self) -> None:
+        self._session.commit()
+
+    def rollback(self) -> None:
+        self._session.rollback()
```

## apps/recipe-service/app/users/schemas.py

```diff
diff --git a/apps/recipe-service/app/users/schemas.py b/apps/recipe-service/app/users/schemas.py
index 949d4a7..b1cfd76 100644
--- a/apps/recipe-service/app/users/schemas.py
+++ b/apps/recipe-service/app/users/schemas.py
@@ -1 +1,47 @@
 """Pydantic request and response schemas for users."""
+
+import unicodedata
+import uuid
+from datetime import datetime
+
+from pydantic import BaseModel, EmailStr, field_validator
+
+from app.core.security import Role
+from app.users.models import NAME_MAX_LENGTH
+
+
+def normalize_name(name: str) -> str:
+    """NFC, trimmed, inner whitespace collapsed to single spaces (AD-24)."""
+    return " ".join(unicodedata.normalize("NFC", name).split())
+
+
+class UserCreate(BaseModel):
+    """What it takes to make an account. The password travels separately."""
+
+    email: EmailStr
+    name: str
+    role: Role
+
+    @field_validator("email", mode="before")
+    @classmethod
+    def _strip_email(cls, value: object) -> object:
+        return value.strip() if isinstance(value, str) else value
+
+    @field_validator("name")
+    @classmethod
+    def _clean_name(cls, value: str) -> str:
+        value = normalize_name(value)
+        if not 1 <= len(value) <= NAME_MAX_LENGTH:
+            raise ValueError(f"name must be 1-{NAME_MAX_LENGTH} characters")
+        return value
+
+
+class UserRead(BaseModel):
+    """A user as returned to callers. There is deliberately no password field."""
+
+    id: uuid.UUID
+    email: str
+    name: str
+    role: Role
+    is_blocked: bool
+    created_at: datetime
```

## apps/recipe-service/app/users/service.py

```diff
diff --git a/apps/recipe-service/app/users/service.py b/apps/recipe-service/app/users/service.py
index f778336..7f3178c 100644
--- a/apps/recipe-service/app/users/service.py
+++ b/apps/recipe-service/app/users/service.py
@@ -1 +1,100 @@
 """Business rules for users; other modules call this layer, never the repository."""
+
+from typing import Annotated
+
+from fastapi import Depends
+from sqlalchemy.exc import IntegrityError
+from sqlmodel import Session
+
+from app.core.db import get_session
+from app.core.errors import AppError, ErrorCode
+from app.core.security import hash_password
+from app.users.models import User
+from app.users.repository import UserRepository
+from app.users.schemas import UserCreate, UserRead
+
+MIN_PASSWORD_LENGTH = 8
+# Argon2 has no built-in length limit, so cap it: a huge password is only a way to
+# burn CPU.
+MAX_PASSWORD_LENGTH = 128
+
+
+def check_password_policy(password: str) -> None:
+    """Raise `AppError` unless the password is 8-128 characters (FR-13)."""
+    if len(password) < MIN_PASSWORD_LENGTH:
+        raise AppError(
+            422,
+            ErrorCode.PASSWORD_TOO_SHORT,
+            f"Password must be at least {MIN_PASSWORD_LENGTH} characters",
+            params={"min": MIN_PASSWORD_LENGTH},
+        )
+    if len(password) > MAX_PASSWORD_LENGTH:
+        raise AppError(
+            422,
+            ErrorCode.PASSWORD_TOO_LONG,
+            f"Password must be at most {MAX_PASSWORD_LENGTH} characters",
+            params={"max": MAX_PASSWORD_LENGTH},
+        )
+
+
+def _read(user: User) -> UserRead:
+    return UserRead(
+        id=user.id,
+        email=user.email,
+        name=user.name,
+        role=user.role,
+        is_blocked=user.is_blocked,
+        created_at=user.created_at,
+    )
+
+
+def _email_taken() -> AppError:
+    return AppError(409, ErrorCode.EMAIL_TAKEN, "A user with this email already exists")
+
+
+class UserService:
+    def __init__(self, repository: UserRepository) -> None:
+        self._repository = repository
+
+    def create_user(self, data: UserCreate, password: str) -> UserRead:
+        """Store a new user with a hashed password; the email must be unused."""
+        check_password_policy(password)
+        if self._repository.get_by_email(data.email) is not None:
+            raise _email_taken()
+        user = User(
+            email=data.email,
+            name=data.name,
+            role=data.role,
+            password_hash=hash_password(password),
+        )
+        try:
+            self._repository.add(user)
+            self._repository.commit()
+        except IntegrityError:
+            # Someone took the email between our check and the insert.
+            self._repository.rollback()
+            raise _email_taken() from None
+        except Exception:
+            self._repository.rollback()
+            raise
+        return _read(user)
+
+    def reset_password(self, email: str, password: str) -> UserRead:
+        """Replace one user's password. Nothing else about them changes."""
+        check_password_policy(password)
+        user = self._repository.get_by_email(email)
+        if user is None:
+            raise AppError(404, ErrorCode.USER_NOT_FOUND, "User not found")
+        user.password_hash = hash_password(password)
+        try:
+            self._repository.add(user)
+            self._repository.commit()
+        except Exception:
+            self._repository.rollback()
+            raise
+        return _read(user)
+
+
+def get_user_service(session: Annotated[Session, Depends(get_session)]) -> UserService:
+    """Provider, like a Nest injectable: `Depends(get_user_service)`."""
+    return UserService(UserRepository(session))
```

## apps/recipe-service/project.json

```diff
diff --git a/apps/recipe-service/project.json b/apps/recipe-service/project.json
index c5a343a..8925cdd 100644
--- a/apps/recipe-service/project.json
+++ b/apps/recipe-service/project.json
@@ -102,6 +102,16 @@
         }
       }
     },
+    "create-admin": {
+      "executor": "@nxlv/python:run-commands",
+      "options": {
+        "command": "uv run python -m app.cli create-admin",
+        "cwd": "{projectRoot}",
+        "env": {
+          "PYTHONUTF8": "1"
+        }
+      }
+    },
     "install": {
       "executor": "@nxlv/python:install",
       "options": {
```

## apps/recipe-service/pyproject.toml

```diff
diff --git a/apps/recipe-service/pyproject.toml b/apps/recipe-service/pyproject.toml
index b489c23..ee314c0 100644
--- a/apps/recipe-service/pyproject.toml
+++ b/apps/recipe-service/pyproject.toml
@@ -23,8 +23,10 @@ requires-python = ">=3.13,<3.14"
 readme = 'README.md'
 dependencies = [
     "alembic>=1.20.1",
+    "email-validator>=2.3.0",
     "fastapi>=0.162.0",
     "httpx>=0.28.1",
+    "pwdlib[argon2]>=0.3.1",
     "pydantic>=2",
     "pydantic-settings>=2.16.1",
     "sqlmodel>=0.0.48",
@@ -197,7 +199,7 @@ protected_modules = [
   "app.users.models",
   "app.users.schemas",
 ]
-allowed_importers = ["app.users"]
+allowed_importers = ["app.users", "app.cli"]
 ignore_imports = [
   "app.main -> app.users.router",
   "app.core.metadata -> app.users.models",
```

## apps/recipe-service/tests/factories.py

```diff
diff --git a/apps/recipe-service/tests/factories.py b/apps/recipe-service/tests/factories.py
index dbf91b2..3c85169 100644
--- a/apps/recipe-service/tests/factories.py
+++ b/apps/recipe-service/tests/factories.py
@@ -1,4 +1,4 @@
-"""Helpers that insert recipes straight into the migrated test database."""
+"""Helpers that insert recipes and users straight into the migrated test database."""
 
 import uuid
 from collections.abc import Sequence
@@ -7,8 +7,10 @@ from typing import Any
 
 from sqlmodel import Session, select
 
+from app.core.security import Role, hash_password
 from app.recipes.models import Ingredient, Recipe, Step
 from app.tags.models import RecipeTag, Tag
+from app.users.models import User
 
 
 def seeded_tag(session: Session, name: str) -> Tag:
@@ -57,3 +59,24 @@ def ingredient(position: int, name: str, **fields: Any) -> Ingredient:
 
 def step(position: int, description: str, **fields: Any) -> Step:
     return Step(recipe_id=_UNSET, position=position, description=description, **fields)
+
+
+def add_user(
+    session: Session,
+    *,
+    email: str = "adi@example.com",
+    name: str = "Adi",
+    role: Role = Role.EDITOR,
+    password: str = "correct horse",
+    **fields: Any,
+) -> User:
+    user = User(
+        email=email,
+        name=name,
+        role=role,
+        password_hash=hash_password(password),
+        **fields,
+    )
+    session.add(user)
+    session.commit()
+    return user
```

## apps/recipe-service/tests/test_migrations.py

```diff
diff --git a/apps/recipe-service/tests/test_migrations.py b/apps/recipe-service/tests/test_migrations.py
index d4ef800..c7e0e28 100644
--- a/apps/recipe-service/tests/test_migrations.py
+++ b/apps/recipe-service/tests/test_migrations.py
@@ -1,6 +1,7 @@
 import uuid
 import warnings
 from collections.abc import Iterator
+from typing import Any
 
 import pytest
 from alembic import command
@@ -15,11 +16,18 @@ from sqlmodel import Session, select
 from app.core import metadata
 from app.core.config import get_settings
 from app.core.db import get_engine
-from app.core.migrate import MIGRATIONS_DIR, run_migrations
+from app.core.migrate import MIGRATIONS_DIR, migration_transaction, run_migrations
 from app.main import create_app
-from app.recipes.models import Ingredient, Step
+from app.recipes.models import Ingredient, Recipe, Step
 from app.tags.models import RecipeTag, Tag
-from tests.factories import add_recipe, add_tag, ingredient, seeded_tag, step
+from tests.factories import (
+    add_recipe,
+    add_tag,
+    add_user,
+    ingredient,
+    seeded_tag,
+    step,
+)
 
 DEFAULT_PINNED_TAGS = [
     ("64e93de0-47ad-4b2a-b757-d0c2405d8126", "בוקר"),
@@ -59,6 +67,7 @@ def test_startup_creates_every_table(connection: Connection) -> None:
         "step",
         "tag",
         "recipe_tag",
+        "user",
     }
 
 
@@ -202,3 +211,152 @@ def test_a_failed_migration_stops_startup(monkeypatch: pytest.MonkeyPatch) -> No
         TestClient(create_app()),
     ):
         pass
+
+
+def test_user_columns(connection: Connection) -> None:
+    columns = {c["name"]: c for c in inspect(connection).get_columns("user")}
+    assert set(columns) == {
+        "id",
+        "email",
+        "name",
+        "role",
+        "password_hash",
+        "is_blocked",
+        "created_at",
+    }
+    assert all(not column["nullable"] for column in columns.values())
+
+
+def test_user_role_is_limited_to_editor_and_admin(connection: Connection) -> None:
+    insert = text(
+        "INSERT INTO user (id, email, name, role, password_hash, created_at) "
+        "VALUES (:id, :email, 'x', :role, 'h', '2026-01-01')"
+    )
+    for role in ("editor", "admin"):
+        connection.execute(
+            insert.bindparams(id=uuid.uuid4().hex, email=f"{role}@x.com", role=role)
+        )
+    with pytest.raises(IntegrityError):
+        connection.execute(
+            insert.bindparams(id=uuid.uuid4().hex, email="o@x.com", role="owner")
+        )
+
+
+def test_users_are_not_blocked_by_default(connection: Connection) -> None:
+    connection.execute(
+        text(
+            "INSERT INTO user (id, email, name, role, password_hash, created_at) "
+            "VALUES ('u1', 'a@x.com', 'x', 'admin', 'h', '2026-01-01')"
+        )
+    )
+    blocked = connection.execute(text("SELECT is_blocked FROM user")).scalar_one()
+    assert blocked == 0
+
+
+def test_recipe_authors_reference_users_and_are_cleared_with_them(
+    session: Session,
+) -> None:
+    author = add_user(session)
+    recipe = add_recipe(session, created_by=author.id, updated_by=author.id)
+    session.delete(author)
+    session.commit()
+    session.refresh(recipe)
+    assert recipe.created_by is None
+    assert recipe.updated_by is None
+    assert session.get(Recipe, recipe.id) is not None
+
+
+@pytest.mark.parametrize("column", ["created_by", "updated_by"])
+def test_a_recipe_cannot_name_an_author_that_does_not_exist(
+    session: Session, column: str
+) -> None:
+    with pytest.raises(IntegrityError):
+        ghost: dict[str, Any] = {column: uuid.uuid4()}
+        add_recipe(session, **ghost)
+
+
+def test_recipe_author_foreign_keys_are_declared(connection: Connection) -> None:
+    keys = {
+        key["constrained_columns"][0]: key
+        for key in inspect(connection).get_foreign_keys("recipe")
+    }
+    for column in ("created_by", "updated_by"):
+        assert keys[column]["referred_table"] == "user"
+        assert keys[column]["options"]["ondelete"] == "SET NULL"
+
+
+def _insert_recipe_with_children(connection: Connection) -> None:
+    recipe_id, tag_id = uuid.uuid4().hex, uuid.UUID(DEFAULT_PINNED_TAGS[0][0]).hex
+    connection.execute(
+        text(
+            "INSERT INTO recipe (id, title, base_servings, created_at, updated_at) "
+            "VALUES (:id, 'שקשוקה', 4, '2026-01-01', '2026-01-01')"
+        ).bindparams(id=recipe_id)
+    )
+    connection.execute(
+        text(
+            "INSERT INTO ingredient (id, recipe_id, position, name) "
+            "VALUES (:id, :recipe, 0, 'ביצים')"
+        ).bindparams(id=uuid.uuid4().hex, recipe=recipe_id)
+    )
+    connection.execute(
+        text(
+            "INSERT INTO step (id, recipe_id, position, description) "
+            "VALUES (:id, :recipe, 0, 'לערבב')"
+        ).bindparams(id=uuid.uuid4().hex, recipe=recipe_id)
+    )
+    connection.execute(
+        text("INSERT INTO recipe_tag VALUES (:recipe, :tag)").bindparams(
+            recipe=recipe_id, tag=tag_id
+        )
+    )
+    connection.commit()
+
+
+def test_upgrading_keeps_recipes_and_all_their_children(
+    connection: Connection,
+) -> None:
+    """Rebuilding `recipe` for its new foreign keys must not cascade-delete rows."""
+    config = _alembic_config(connection)
+    command.downgrade(config, "0001")
+    connection.commit()
+    _insert_recipe_with_children(connection)
+
+    with migration_transaction(connection):
+        command.upgrade(config, "head")
+
+    for table in ("recipe", "ingredient", "step", "recipe_tag"):
+        count = connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()
+        assert count == 1, table
+
+
+def test_foreign_keys_are_enforced_again_after_migrating(
+    connection: Connection,
+) -> None:
+    with migration_transaction(connection):
+        pass
+    assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1
+
+
+def test_a_migration_that_breaks_a_foreign_key_is_rolled_back(
+    connection: Connection,
+) -> None:
+    with pytest.raises(RuntimeError, match="broken foreign key"):  # noqa: SIM117
+        with migration_transaction(connection):
+            connection.execute(
+                text(
+                    "INSERT INTO recipe (id, title, base_servings, created_by, "
+                    "created_at, updated_at) "
+                    "VALUES (:id, 'x', 1, :ghost, '2026-01-01', '2026-01-01')"
+                ).bindparams(id=uuid.uuid4().hex, ghost=uuid.uuid4().hex)
+            )
+    assert connection.execute(text("SELECT count(*) FROM recipe")).scalar_one() == 0
+    assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1
+
+
+def test_a_failing_migration_still_turns_foreign_keys_back_on(
+    connection: Connection,
+) -> None:
+    with pytest.raises(ValueError, match="boom"), migration_transaction(connection):
+        raise ValueError("boom")
+    assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1
```

## apps/recipe-service/tests/test_openapi_export.py

```diff
diff --git a/apps/recipe-service/tests/test_openapi_export.py b/apps/recipe-service/tests/test_openapi_export.py
index 74f6acb..a971b17 100644
--- a/apps/recipe-service/tests/test_openapi_export.py
+++ b/apps/recipe-service/tests/test_openapi_export.py
@@ -21,6 +21,10 @@ def test_export_writes_stable_sorted_json(tmp_path: Path) -> None:
     assert spec["components"]["schemas"]["ErrorCode"]["enum"] == [
         "recipe_not_found",
         "tag_not_found",
+        "email_taken",
+        "user_not_found",
+        "password_too_short",
+        "password_too_long",
     ]
 
 
```

## libs/data-access/openapi.json

```diff
diff --git a/libs/data-access/openapi.json b/libs/data-access/openapi.json
index faa96a2..74312b0 100644
--- a/libs/data-access/openapi.json
+++ b/libs/data-access/openapi.json
@@ -5,7 +5,11 @@
         "description": "Stable error codes; the client shows `errors.<code>` from he.json.",
         "enum": [
           "recipe_not_found",
-          "tag_not_found"
+          "tag_not_found",
+          "email_taken",
+          "user_not_found",
+          "password_too_short",
+          "password_too_long"
         ],
         "title": "ErrorCode",
         "type": "string"
```

## libs/data-access/src/generated/types.gen.ts

```diff
diff --git a/libs/data-access/src/generated/types.gen.ts b/libs/data-access/src/generated/types.gen.ts
index 77c6561..9fad7bf 100644
--- a/libs/data-access/src/generated/types.gen.ts
+++ b/libs/data-access/src/generated/types.gen.ts
@@ -9,7 +9,7 @@ export type ClientOptions = {
  *
  * Stable error codes; the client shows `errors.<code>` from he.json.
  */
-export type ErrorCode = 'recipe_not_found' | 'tag_not_found';
+export type ErrorCode = 'recipe_not_found' | 'tag_not_found' | 'email_taken' | 'user_not_found' | 'password_too_short' | 'password_too_long';
 
 /**
  * ErrorResponse
```

## libs/data-access/src/generated/zod.gen.ts

```diff
diff --git a/libs/data-access/src/generated/zod.gen.ts b/libs/data-access/src/generated/zod.gen.ts
index ab1ad6f..ad0f9be 100644
--- a/libs/data-access/src/generated/zod.gen.ts
+++ b/libs/data-access/src/generated/zod.gen.ts
@@ -7,7 +7,14 @@ import * as z from 'zod';
  *
  * Stable error codes; the client shows `errors.<code>` from he.json.
  */
-export const zErrorCode = z.enum(['recipe_not_found', 'tag_not_found']);
+export const zErrorCode = z.enum([
+    'recipe_not_found',
+    'tag_not_found',
+    'email_taken',
+    'user_not_found',
+    'password_too_short',
+    'password_too_long'
+]);
 
 /**
  * ErrorResponse
```

## libs/i18n/src/he.json

```diff
diff --git a/libs/i18n/src/he.json b/libs/i18n/src/he.json
index 8041ae3..07aa6e9 100644
--- a/libs/i18n/src/he.json
+++ b/libs/i18n/src/he.json
@@ -59,6 +59,10 @@
   "errors": {
     "recipe_not_found": "המתכון לא נמצא",
     "tag_not_found": "התגית לא נמצאה",
+    "email_taken": "כבר קיים משתמש עם האימייל הזה",
+    "user_not_found": "המשתמש לא נמצא",
+    "password_too_short": "הסיסמה חייבת להכיל לפחות {{min}} תווים",
+    "password_too_long": "הסיסמה יכולה להכיל עד {{max}} תווים",
     "unknown": "משהו השתבש, אפשר לנסות שוב"
   },
   "units": {
```

## apps/recipe-service/uv.lock

Adds argon2-cffi, argon2-cffi-bindings, cffi, pycparser, dnspython, email-validator, pwdlib.

## apps/recipe-service/app/migrations/versions/20261028_0002_users_and_recipe_authors.py (new)

```python
"""users, and the foreign keys from recipe authors to them

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-28 10:21:23.882957
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "editor",
                "admin",
                name="role",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column(
            "is_blocked", sa.Boolean(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user")),
    )
    # lower(email) makes emails unique case-insensitively (AD-30).
    op.create_index(
        "uq_user_lower_email", "user", [sa.text("lower(email)")], unique=True
    )
    # Existing recipes have no author (NULL), so the new constraints hold already.
    with op.batch_alter_table("recipe", schema=None) as batch_op:
        batch_op.create_foreign_key(
            batch_op.f("fk_recipe_created_by_user"),
            "user",
            ["created_by"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            batch_op.f("fk_recipe_updated_by_user"),
            "user",
            ["updated_by"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("recipe", schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f("fk_recipe_updated_by_user"), type_="foreignkey"
        )
        batch_op.drop_constraint(
            batch_op.f("fk_recipe_created_by_user"), type_="foreignkey"
        )

    op.drop_index("uq_user_lower_email", table_name="user")
    op.drop_table("user")
```

## apps/recipe-service/tests/test_security.py (new)

```python
import pytest

from app.core.security import Role, hash_password, verify_password


def test_roles_are_editor_and_admin_only() -> None:
    assert {role.value for role in Role} == {"editor", "admin"}


def test_hash_is_argon2id_and_never_contains_the_password() -> None:
    password = "correct horse battery"
    hashed = hash_password(password)
    assert hashed.startswith("$argon2id$")
    assert password not in hashed


def test_same_password_gets_a_different_salted_hash_each_time() -> None:
    assert hash_password("correct horse") != hash_password("correct horse")


def test_verify_accepts_the_right_password_only() -> None:
    hashed = hash_password("correct horse")
    assert verify_password("correct horse", hashed) is True
    assert verify_password("Correct horse", hashed) is False
    assert verify_password("correct horse ", hashed) is False
    assert verify_password("", hashed) is False


def test_verify_handles_non_ascii_passwords() -> None:
    hashed = hash_password("סיסמה-חזקה-123")
    assert verify_password("סיסמה-חזקה-123", hashed) is True
    assert verify_password("סיסמה-חזקה-124", hashed) is False


@pytest.mark.parametrize("stored", ["", "plain-text-password", "$2b$12$notargon"])
def test_verify_never_matches_a_value_that_is_not_an_argon2_hash(stored: str) -> None:
    assert verify_password("plain-text-password", stored) is False
```

## apps/recipe-service/tests/test_users.py (new)

```python
import logging
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.cli import main
from app.core.config import get_settings
from app.core.db import get_engine
from app.core.errors import AppError, ErrorCode
from app.core.security import Role, hash_password, verify_password
from app.users.models import User
from app.users.repository import UserRepository
from app.users.schemas import UserCreate, UserRead
from app.users.service import (
    MAX_PASSWORD_LENGTH,
    MIN_PASSWORD_LENGTH,
    UserService,
    get_user_service,
)
from tests.factories import add_user

PASSWORD = "correct horse"
CREATE = ["create-admin", "--email", "adi@example.com", "--name", "Adi"]
RESET = ["create-admin", "--email", "adi@example.com", "--reset-password"]

Typed = Callable[..., None]


@pytest.fixture
def service(session: Session) -> UserService:
    return get_user_service(session)


@pytest.fixture
def type_passwords(monkeypatch: pytest.MonkeyPatch) -> Typed:
    """Feed the CLI's password prompts; a prompt beyond the answers fails the test."""

    def feed(*answers: str) -> None:
        remaining: Iterator[str] = iter(answers)

        def fake_getpass(prompt: str = "") -> str:
            return next(remaining)

        monkeypatch.setattr("app.cli.getpass", fake_getpass)

    return feed


def _users(session: Session) -> list[User]:
    session.expire_all()
    return list(session.exec(select(User)).all())


def _new_admin(email: str = "adi@example.com") -> UserCreate:
    return UserCreate(email=email, name="Adi", role=Role.ADMIN)


# --- service ---------------------------------------------------------------


def test_create_user_stores_a_hash_never_the_password(
    service: UserService, session: Session
) -> None:
    result = service.create_user(_new_admin(), PASSWORD)
    (stored,) = _users(session)
    assert stored.id == result.id
    assert stored.role is Role.ADMIN
    assert stored.is_blocked is False
    assert stored.password_hash.startswith("$argon2id$")
    assert PASSWORD not in stored.password_hash
    assert verify_password(PASSWORD, stored.password_hash)


def test_the_returned_user_has_no_password_field(service: UserService) -> None:
    result = service.create_user(_new_admin(), PASSWORD)
    assert set(UserRead.model_fields) == {
        "id",
        "email",
        "name",
        "role",
        "is_blocked",
        "created_at",
    }
    assert PASSWORD not in result.model_dump_json()


def test_email_and_name_are_cleaned() -> None:
    data = UserCreate(
        email="  Adi@Example.com ", name="  עדי   גולדשטיין ", role=Role.EDITOR
    )
    assert data.email == "Adi@example.com"
    assert data.name == "עדי גולדשטיין"


@pytest.mark.parametrize(
    "email", ["", "adi", "adi@", "@example.com", "a b@example.com"]
)
def test_invalid_emails_are_rejected(email: str) -> None:
    with pytest.raises(ValidationError):
        UserCreate(email=email, name="Adi", role=Role.EDITOR)


@pytest.mark.parametrize("name", ["", "   ", "x" * 81])
def test_invalid_names_are_rejected(name: str) -> None:
    with pytest.raises(ValidationError):
        UserCreate(email="adi@example.com", name=name, role=Role.EDITOR)


def test_role_must_be_editor_or_admin() -> None:
    with pytest.raises(ValidationError):
        UserCreate(email="adi@example.com", name="Adi", role="owner")  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "other", ["adi@example.com", "ADI@EXAMPLE.COM", "Adi@Example.com"]
)
def test_a_taken_email_is_rejected_whatever_its_case(
    service: UserService, session: Session, other: str
) -> None:
    add_user(session)
    with pytest.raises(AppError) as error:
        service.create_user(_new_admin(other), PASSWORD)
    assert error.value.status_code == 409
    assert error.value.body.code is ErrorCode.EMAIL_TAKEN
    assert len(_users(session)) == 1


def test_losing_a_race_for_an_email_is_still_a_clear_conflict(
    service: UserService, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    add_user(session)
    # The pre-check sees nothing, as if the other insert had not committed yet.
    monkeypatch.setattr(UserRepository, "get_by_email", lambda _self, _email: None)
    with pytest.raises(AppError) as error:
        service.create_user(_new_admin(), PASSWORD)
    assert error.value.body.code is ErrorCode.EMAIL_TAKEN
    monkeypatch.undo()
    assert len(_users(session)) == 1


def test_the_database_itself_refuses_emails_differing_only_in_case(
    session: Session,
) -> None:
    add_user(session, email="adi@example.com")
    with pytest.raises(IntegrityError):
        add_user(session, email="ADI@example.com")


def test_unexpected_errors_roll_back_and_propagate(
    service: UserService, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def explode(_self: UserRepository) -> None:
        raise RuntimeError("disk full")

    monkeypatch.setattr(UserRepository, "commit", explode)
    with pytest.raises(RuntimeError, match="disk full"):
        service.create_user(_new_admin(), PASSWORD)
    monkeypatch.undo()
    assert _users(session) == []


@pytest.mark.parametrize(
    ("password", "code"),
    [
        ("", ErrorCode.PASSWORD_TOO_SHORT),
        ("a" * (MIN_PASSWORD_LENGTH - 1), ErrorCode.PASSWORD_TOO_SHORT),
        ("a" * (MAX_PASSWORD_LENGTH + 1), ErrorCode.PASSWORD_TOO_LONG),
    ],
)
def test_password_length_is_enforced(
    service: UserService, session: Session, password: str, code: ErrorCode
) -> None:
    with pytest.raises(AppError) as error:
        service.create_user(_new_admin(), password)
    assert error.value.status_code == 422
    assert error.value.body.code is code
    assert _users(session) == []


@pytest.mark.parametrize("length", [MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH])
def test_password_length_limits_are_inclusive(
    service: UserService, length: int
) -> None:
    service.create_user(_new_admin(), "a" * length)


def test_reset_password_changes_only_the_hash(
    service: UserService, session: Session
) -> None:
    original = add_user(
        session, role=Role.EDITOR, name="Adi", is_blocked=True, password=PASSWORD
    )
    old_hash = original.password_hash
    user_id = original.id
    service.reset_password("ADI@example.com", "a brand new one")
    (stored,) = _users(session)
    assert stored.password_hash != old_hash
    assert verify_password("a brand new one", stored.password_hash)
    assert not verify_password(PASSWORD, stored.password_hash)
    assert (stored.email, stored.name, stored.role, stored.is_blocked) == (
        "adi@example.com",
        "Adi",
        Role.EDITOR,
        True,
    )
    assert stored.id == user_id


def test_reset_password_for_an_unknown_email(service: UserService) -> None:
    with pytest.raises(AppError) as error:
        service.reset_password("nobody@example.com", PASSWORD)
    assert error.value.status_code == 404
    assert error.value.body.code is ErrorCode.USER_NOT_FOUND


def test_reset_password_enforces_the_same_length_rules(
    service: UserService, session: Session
) -> None:
    old_hash = add_user(session).password_hash
    with pytest.raises(AppError) as error:
        service.reset_password("adi@example.com", "short")
    assert error.value.body.code is ErrorCode.PASSWORD_TOO_SHORT
    assert _users(session)[0].password_hash == old_hash


def test_reset_password_rolls_back_on_unexpected_errors(
    service: UserService, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    old_hash = add_user(session).password_hash

    def explode(_self: UserRepository) -> None:
        raise RuntimeError("disk full")

    monkeypatch.setattr(UserRepository, "commit", explode)
    with pytest.raises(RuntimeError, match="disk full"):
        service.reset_password("adi@example.com", "a brand new one")
    monkeypatch.undo()
    assert _users(session)[0].password_hash == old_hash


def test_equal_passwords_are_stored_as_different_hashes(
    service: UserService, session: Session
) -> None:
    service.create_user(_new_admin("a@example.com"), PASSWORD)
    service.create_user(_new_admin("b@example.com"), PASSWORD)
    first, second = _users(session)
    assert first.password_hash != second.password_hash
    assert hash_password(PASSWORD) != hash_password(PASSWORD)


# --- CLI -------------------------------------------------------------------


def test_cli_creates_an_admin_with_a_hashed_password(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    type_passwords(PASSWORD, PASSWORD)
    with caplog.at_level(logging.DEBUG):
        assert main(CREATE) == 0
    (stored,) = _users(session)
    assert (stored.email, stored.name, stored.role) == (
        "adi@example.com",
        "Adi",
        Role.ADMIN,
    )
    assert stored.is_blocked is False
    assert stored.password_hash.startswith("$argon2id$")
    assert verify_password(PASSWORD, stored.password_hash)
    captured = capsys.readouterr()
    assert "adi@example.com" in captured.out
    for text in (captured.out, captured.err, caplog.text):
        assert PASSWORD not in text


def test_cli_migrates_a_fresh_database_by_itself(type_passwords: Typed) -> None:
    type_passwords(PASSWORD, PASSWORD)
    assert main(CREATE) == 0
    with Session(get_engine(get_settings().data_dir)) as session:
        assert [user.email for user in _users(session)] == ["adi@example.com"]


def test_cli_has_no_password_argument(
    client: TestClient, session: Session, type_passwords: Typed
) -> None:
    type_passwords(PASSWORD, PASSWORD)
    with pytest.raises(SystemExit) as exit_info:
        main([*CREATE, "--password", PASSWORD])
    assert exit_info.value.code == 2
    assert _users(session) == []


def test_cli_rejects_mismatched_passwords(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    type_passwords(PASSWORD, PASSWORD + "x")
    assert main(CREATE) == 1
    err = capsys.readouterr().err
    assert "do not match" in err
    assert PASSWORD not in err
    assert _users(session) == []


@pytest.mark.parametrize("password", ["", "short", "1234567"])
def test_cli_rejects_a_short_password_with_a_clear_message(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
    password: str,
) -> None:
    type_passwords(password, password)
    assert main(CREATE) == 1
    assert "at least 8 characters" in capsys.readouterr().err
    assert _users(session) == []


def test_cli_rejects_a_too_long_password(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    long_password = "a" * (MAX_PASSWORD_LENGTH + 1)
    type_passwords(long_password, long_password)
    assert main(CREATE) == 1
    assert "at most 128 characters" in capsys.readouterr().err
    assert _users(session) == []


@pytest.mark.parametrize("email", ["adi@example.com", "ADI@Example.COM"])
def test_cli_fails_clearly_when_the_email_exists(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
    email: str,
) -> None:
    old_hash = add_user(session, password="the old password").password_hash
    type_passwords(PASSWORD, PASSWORD)
    assert main(["create-admin", "--email", email, "--name", "New"]) == 1
    assert "already exists" in capsys.readouterr().err
    (stored,) = _users(session)
    assert stored.password_hash == old_hash
    assert stored.role is Role.EDITOR
    assert stored.name == "Adi"


def test_cli_reset_password_changes_only_the_password(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    add_user(session, role=Role.EDITOR, name="Adi", password="the old password")
    type_passwords(PASSWORD, PASSWORD)
    assert main(["create-admin", "--email", "ADI@example.com", "--reset-password"]) == 0
    (stored,) = _users(session)
    assert verify_password(PASSWORD, stored.password_hash)
    assert not verify_password("the old password", stored.password_hash)
    assert (stored.name, stored.role) == ("Adi", Role.EDITOR)
    captured = capsys.readouterr()
    assert "Password changed for adi@example.com" in captured.out
    assert PASSWORD not in captured.out + captured.err


def test_cli_reset_password_ignores_a_name_given_alongside(
    client: TestClient, session: Session, type_passwords: Typed
) -> None:
    add_user(session, name="Adi", role=Role.ADMIN)
    type_passwords(PASSWORD, PASSWORD)
    assert main([*RESET, "--name", "Someone Else"]) == 0
    assert _users(session)[0].name == "Adi"


def test_cli_reset_password_for_an_unknown_email_fails(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    type_passwords(PASSWORD, PASSWORD)
    assert main(RESET) == 1
    assert "not found" in capsys.readouterr().err
    assert _users(session) == []


def test_cli_reset_password_still_enforces_the_length(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    old_hash = add_user(session).password_hash
    type_passwords("short", "short")
    assert main(RESET) == 1
    assert "at least 8" in capsys.readouterr().err
    assert _users(session)[0].password_hash == old_hash


def test_cli_needs_a_name_to_create(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
) -> None:
    type_passwords()  # Any prompt would raise StopIteration.
    assert main(["create-admin", "--email", "adi@example.com"]) == 1
    assert "--name is required" in capsys.readouterr().err
    assert _users(session) == []


@pytest.mark.parametrize(
    ("email", "name"),
    [("not-an-email", "Adi"), ("adi@example.com", "   ")],
)
def test_cli_rejects_a_bad_email_or_name_before_asking_for_a_password(
    client: TestClient,
    session: Session,
    type_passwords: Typed,
    capsys: pytest.CaptureFixture[str],
    email: str,
    name: str,
) -> None:
    type_passwords()  # Any prompt would raise StopIteration.
    assert main(["create-admin", "--email", email, "--name", name]) == 1
    assert "Error:" in capsys.readouterr().err
    assert _users(session) == []


def test_cli_requires_an_email() -> None:
    with pytest.raises(SystemExit) as exit_info:
        main(["create-admin", "--name", "Adi"])
    assert exit_info.value.code == 2


@pytest.mark.parametrize("interrupt", [EOFError, KeyboardInterrupt])
def test_cli_stops_cleanly_when_the_prompt_is_cancelled(
    client: TestClient,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    interrupt: type[BaseException],
) -> None:
    def cancelled(_prompt: str = "") -> str:
        raise interrupt

    monkeypatch.setattr("app.cli.getpass", cancelled)
    assert main(CREATE) == 1
    assert "cancelled" in capsys.readouterr().err
    assert _users(session) == []
```

