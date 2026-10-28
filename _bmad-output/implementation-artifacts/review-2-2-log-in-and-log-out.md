# Review: Story 2.2 Log in and log out

Branch `claude/story-2-2-login-logout` (from main at 3fd2dbd). Not committed; for Adi's review.

## What it does

- **Server:** `POST /api/auth/login` (400 `invalid_credentials`, 429 `rate_limited`), `POST /api/auth/logout` (204),
  `GET /api/auth/session` (always 200, `{user: {id,email,name,role} | null}`). The session is an HS256 JWT in an
  `httpOnly; SameSite=Lax` cookie named `session`, `Secure` from `COOKIE_SECURE`, 7 days, Path `/`. The token holds
  only `sub`, `iat`, `exp`: role and blocked state are read from the DB on every `/session` call (AD-30).
- **Client:** new `libs/feature-auth` (`type:feature`) with lazy subpaths `./login` and `./account-menu`;
  `useSession()` in `libs/data-access` (the TanStack Query cache is the auth state); top bar shows "כניסה" or the
  user's name with an account menu ("יציאה").

## Decisions applied (all as approved: D1-D7 recommendations)

D1 account menu is its own lazy chunk with a same-size placeholder. D2 query cache + `useSession()`. D3 no CSRF
enforcement in 2.2 (the client already sends `X-Requested-With`). D4 a blocked user gets the same generic 400.
D5 `app.auth` added to the `users` protected contract's `allowed_importers` (it imports `users.service` and `UserRead` only).
D6 slowapi keyed by client IP, README note about `--proxy-headers` / `--forwarded-allow-ips`.
D7 `react-hook-form` 7.91.0 + `@hookform/resolvers` 6.0.2 (exact pins, like the rest of `package.json`).
Backend deps: `PyJWT` 2.15.1, `slowapi` 0.1.10 (`uv add`).

Small choices: a bad/expired/blocked cookie on `/session` returns `user: null` and clears the cookie; `?next=` accepts
only same-site paths (`safeNext`); login returns the `/session` shape so the client fills the cache directly; "כניסה"
is hidden on `/login`; a signed-in user opening `/login` is sent on to `?next=`/`/`; unknown email still verifies a
decoy Argon2 hash so timing does not reveal accounts.

## Things to know

1. **Initial JS (gzip), measured from `apps/web/dist/index.html` (entry + modulepreloads):**
   before **159,755 B** (156.0 KiB), after **149,736 B** (146.2 KiB). Budget 200 KB. Lazy chunks added:
   login 15.3 KB, account-menu 23.4 KB (Radix dropdown), small shared ones. The first build *without* the fix below was
   183.7 KB: once the lazy chunks used `Input`/`Label`/`DropdownMenu`, rolldown pulled the whole `ui-components` barrel
   into the entry chunk.
2. **One change outside the story's files:** `libs/ui-components/package.json` gets `"sideEffects": ["*.css"]`, so the
   bundler can tree-shake the barrel and keep unused components in lazy chunks. It is what brought the entry
   chunk down (183.7 -> 149.7 KB). Please confirm you are fine with it.
3. `tests/conftest.py` now sets `COOKIE_SECURE=false` for tests (TestClient is plain http and would never send a
   `Secure` cookie back) and a 35-char `TEST_SECRET` (PyJWT warns about HMAC keys under 32 bytes). `test_config.py`
   `test_defaults` unsets `COOKIE_SECURE` so it still checks the production default.
4. The login limiter is process-wide, so `conftest` calls `limiter.reset()` before each test.
5. Windows note: files I generated got CRLF line endings at first; all changed files were normalised back to LF
   (the repo's convention) and `nx format:check` passes.
6. 2.3 hand-off: `require_role` lives in `app/core/security` but `core` may not import feature modules
   (import-linter). 2.3 will need a small seam for "load the current user" (e.g. a dependency provided by `auth`).
   Nothing in 2.2 blocks either approach.

## Checks run

- `nx run-many -t lint typecheck test build` for all 9 projects: green. Backend: ruff, ruff format, import-linter
  (13 contracts kept), mypy strict, 217 pytest tests. New server code at 100% line and branch coverage.
  Frontend: all suites pass; new: feature-auth 29 tests, web `account-slot.spec` 3.
- `nx format:check` passes. `nx run data-access:generate` rerun: auth hooks, `SessionResponse`, `LoginRequest`,
  and the two new `ErrorCode` values appear.
- Real browser run against a throwaway database (not your dev DB, throwaway user and password): "כניסה" -> login
  page -> wrong password shows "אימייל או סיסמה שגויים" -> correct login lands on `/` with the name menu ->
  `document.cookie` is empty (httpOnly) -> reload keeps the session -> "יציאה" returns the bar to "כניסה" without
  a reload -> 429 with `rate_limited` on the 6th attempt. Login page checked at 375 px.
- Not verified: `Secure` cookie over real HTTPS, and `--proxy-headers` behaviour behind a real proxy (Story 6.1).

## Files

New: `apps/recipe-service/app/core/rate_limit.py`, `apps/recipe-service/tests/test_auth_api.py`,
`apps/web/src/app/account-slot.spec.tsx`, `libs/data-access/src/session.ts`, the whole `libs/feature-auth/` library.
Changed: see the diffs below (`uv.lock`, `package-lock.json`, `openapi.json` and `libs/data-access/src/generated/*`
are summarised, not shown). `sprint-status.yaml` marks 2.2 done in the same commit.

## Diffs of changed files

### apps/recipe-service/README.md

```diff
diff --git a/apps/recipe-service/README.md b/apps/recipe-service/README.md
index 0f3dc6e..88167da 100644
--- a/apps/recipe-service/README.md
+++ b/apps/recipe-service/README.md
@@ -28,6 +28,20 @@ cp .env.example .env   # then set JWT_SECRET
 `.env` is gitignored. `.env.example` documents every setting. The app refuses to
 start without `JWT_SECRET`, and `ENV` defaults to `production` when unset.
 
+## Sessions and login
+
+`POST /api/auth/login` sets a signed JWT (`HS256`, 7 days) in an `httpOnly; SameSite=Lax`
+cookie named `session`; `Secure` follows `COOKIE_SECURE`. The token only holds the user
+id, so the role and the blocked flag are read from the database on every request.
+`GET /api/auth/session` is public and always returns 200 (`user: null` for a visitor).
+`POST /api/auth/logout` clears the cookie.
+
+Login is limited to 5 attempts a minute per client IP (slowapi, in memory, so a restart
+clears it). Behind a reverse proxy the app sees the proxy's address, so every user would
+share one bucket. In production start uvicorn with `--proxy-headers` and
+`--forwarded-allow-ips` set to the proxy's address only (not `*`, or the header can be
+spoofed to dodge the limit). That is set up with the container in Story 6.1.
+
 ## Database and migrations
 
 SQLite lives in `DATA_DIR/app.db`. Every connection turns on `foreign_keys` and WAL.
```

### apps/recipe-service/app/auth/router.py

```diff
diff --git a/apps/recipe-service/app/auth/router.py b/apps/recipe-service/app/auth/router.py
index dcd1996..c8739a0 100644
--- a/apps/recipe-service/app/auth/router.py
+++ b/apps/recipe-service/app/auth/router.py
@@ -1,3 +1,71 @@
-from fastapi import APIRouter
+from typing import Annotated, Literal
+
+from fastapi import APIRouter, Cookie, Depends, Request, Response
+
+from app.auth.schemas import LoginRequest, SessionResponse
+from app.auth.service import AuthService, get_auth_service
+from app.core.config import Settings, get_settings
+from app.core.rate_limit import LOGIN_LIMIT, limiter
+from app.core.security import SESSION_COOKIE, SESSION_LIFETIME
 
 router = APIRouter(prefix="/auth", tags=["auth"])
+
+ServiceDep = Annotated[AuthService, Depends(get_auth_service)]
+SettingsDep = Annotated[Settings, Depends(get_settings)]
+SessionCookie = Annotated[str | None, Cookie(alias=SESSION_COOKIE)]
+
+# Same attributes on set and delete, or the browser keeps the old cookie (AD-21).
+_SAMESITE: Literal["lax"] = "lax"
+
+
+def _clear_cookie(response: Response, settings: Settings) -> None:
+    response.delete_cookie(
+        SESSION_COOKIE,
+        path="/",
+        secure=settings.cookie_secure,
+        httponly=True,
+        samesite=_SAMESITE,
+    )
+
+
+@router.post("/login")
+@limiter.limit(LOGIN_LIMIT)
+def login(
+    request: Request,  # slowapi reads the client address from it
+    body: LoginRequest,
+    response: Response,
+    service: ServiceDep,
+    settings: SettingsDep,
+) -> SessionResponse:
+    user, token = service.login(body.email, body.password)
+    response.set_cookie(
+        SESSION_COOKIE,
+        token,
+        max_age=int(SESSION_LIFETIME.total_seconds()),
+        path="/",
+        secure=settings.cookie_secure,
+        httponly=True,
+        samesite=_SAMESITE,
+    )
+    return SessionResponse(user=user)
+
+
+@router.post("/logout", status_code=204)
+def logout(response: Response, settings: SettingsDep) -> None:
+    """Always succeeds, signed in or not."""
+    _clear_cookie(response, settings)
+
+
+@router.get("/session")
+def session(
+    response: Response,
+    service: ServiceDep,
+    settings: SettingsDep,
+    token: SessionCookie = None,
+) -> SessionResponse:
+    """Public: 200 with the user, or `user: null` for a visitor (AD-21)."""
+    user = service.current_user(token)
+    if user is None and token is not None:
+        # A stale or invalid cookie is dropped, so it is not sent again.
+        _clear_cookie(response, settings)
+    return SessionResponse(user=user)
```

### apps/recipe-service/app/auth/schemas.py

```diff
diff --git a/apps/recipe-service/app/auth/schemas.py b/apps/recipe-service/app/auth/schemas.py
index 798ac70..2381431 100644
--- a/apps/recipe-service/app/auth/schemas.py
+++ b/apps/recipe-service/app/auth/schemas.py
@@ -1 +1,35 @@
 """Pydantic request and response schemas for auth."""
+
+import uuid
+
+from pydantic import BaseModel, Field
+
+from app.core.security import Role
+
+# The longest email an account can have (RFC 5321).
+EMAIL_MAX_LENGTH = 254
+# Matches the password policy's ceiling, so a huge body can't be used to burn CPU on
+# Argon2. Anything the policy would reject can never be a valid password anyway.
+PASSWORD_MAX_LENGTH = 128
+
+
+class LoginRequest(BaseModel):
+    """Plain strings on purpose: a malformed email is just wrong credentials."""
+
+    email: str = Field(min_length=1, max_length=EMAIL_MAX_LENGTH)
+    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
+
+
+class SessionUser(BaseModel):
+    """What the client may know about the signed-in user (AD-21)."""
+
+    id: uuid.UUID
+    email: str
+    name: str
+    role: Role
+
+
+class SessionResponse(BaseModel):
+    """`user` is null for a visitor."""
+
+    user: SessionUser | None
```

### apps/recipe-service/app/auth/service.py

```diff
diff --git a/apps/recipe-service/app/auth/service.py b/apps/recipe-service/app/auth/service.py
index a174801..d25ae6b 100644
--- a/apps/recipe-service/app/auth/service.py
+++ b/apps/recipe-service/app/auth/service.py
@@ -1 +1,55 @@
 """Business rules for auth; other modules call this layer, never the repository."""
+
+from typing import Annotated
+
+from fastapi import Depends
+
+from app.auth.schemas import SessionUser
+from app.core.config import Settings, get_settings
+from app.core.errors import AppError, ErrorCode
+from app.core.security import create_session_token, read_session_token
+from app.users.schemas import UserRead
+from app.users.service import UserService, get_user_service
+
+
+def _session_user(user: UserRead) -> SessionUser:
+    return SessionUser(id=user.id, email=user.email, name=user.name, role=user.role)
+
+
+class AuthService:
+    def __init__(self, users: UserService, secret: str) -> None:
+        self._users = users
+        self._secret = secret
+
+    def login(self, email: str, password: str) -> tuple[SessionUser, str]:
+        """The user and a fresh session token, or a generic 400 (AD-21).
+
+        The error never says which part was wrong.
+        """
+        user = self._users.authenticate(email, password)
+        if user is None:
+            raise AppError(
+                400, ErrorCode.INVALID_CREDENTIALS, "Invalid email or password"
+            )
+        return _session_user(user), create_session_token(user.id, self._secret)
+
+    def current_user(self, token: str | None) -> SessionUser | None:
+        """Who the cookie belongs to, looked up fresh; None for a visitor.
+
+        A bad, expired, forged or orphaned token, and a blocked user, all give None.
+        """
+        if token is None:
+            return None
+        user_id = read_session_token(token, self._secret)
+        if user_id is None:
+            return None
+        user = self._users.get_active_user(user_id)
+        return None if user is None else _session_user(user)
+
+
+def get_auth_service(
+    users: Annotated[UserService, Depends(get_user_service)],
+    settings: Annotated[Settings, Depends(get_settings)],
+) -> AuthService:
+    """Provider, like a Nest injectable: `Depends(get_auth_service)`."""
+    return AuthService(users, settings.jwt_secret.get_secret_value())
```

### apps/recipe-service/app/core/errors.py

```diff
diff --git a/apps/recipe-service/app/core/errors.py b/apps/recipe-service/app/core/errors.py
index e4cb15c..9d6b493 100644
--- a/apps/recipe-service/app/core/errors.py
+++ b/apps/recipe-service/app/core/errors.py
@@ -3,6 +3,7 @@ from enum import StrEnum
 from fastapi import FastAPI, Request
 from fastapi.responses import JSONResponse
 from pydantic import BaseModel
+from slowapi.errors import RateLimitExceeded
 
 
 class ErrorCode(StrEnum):
@@ -14,6 +15,8 @@ class ErrorCode(StrEnum):
     USER_NOT_FOUND = "user_not_found"
     PASSWORD_TOO_SHORT = "password_too_short"
     PASSWORD_TOO_LONG = "password_too_long"
+    INVALID_CREDENTIALS = "invalid_credentials"
+    RATE_LIMITED = "rate_limited"
 
 
 class ErrorResponse(BaseModel):
@@ -46,5 +49,17 @@ async def _app_error_handler(_request: Request, exc: Exception) -> JSONResponse:
     )
 
 
+async def _rate_limit_handler(_request: Request, exc: Exception) -> JSONResponse:
+    if not isinstance(exc, RateLimitExceeded):
+        raise exc
+    body = ErrorResponse(detail="Too many attempts", code=ErrorCode.RATE_LIMITED)
+    return JSONResponse(
+        status_code=429,
+        content=body.model_dump(mode="json", exclude_none=True),
+        headers={"Retry-After": "60"},
+    )
+
+
 def register_error_handlers(app: FastAPI) -> None:
     app.add_exception_handler(AppError, _app_error_handler)
+    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
```

### apps/recipe-service/app/core/security.py

```diff
diff --git a/apps/recipe-service/app/core/security.py b/apps/recipe-service/app/core/security.py
index 070925c..dac2ae1 100644
--- a/apps/recipe-service/app/core/security.py
+++ b/apps/recipe-service/app/core/security.py
@@ -1,7 +1,10 @@
-"""Roles, password hashing, and (from Story 2.3) the `require_role` guards."""
+"""Roles, password hashing, session tokens, and (from Story 2.3) `require_role`."""
 
+import uuid
+from datetime import UTC, datetime, timedelta
 from enum import StrEnum
 
+import jwt
 from pwdlib import PasswordHash
 from pwdlib.exceptions import UnknownHashError
 from pwdlib.hashers.argon2 import Argon2Hasher
@@ -32,3 +35,41 @@ def verify_password(password: str, password_hash: str) -> bool:
         return _hasher.verify(password, password_hash)
     except UnknownHashError:
         return False
+
+
+# The cookie that carries the session JWT (AD-6).
+SESSION_COOKIE = "session"
+SESSION_LIFETIME = timedelta(days=7)
+_JWT_ALGORITHM = "HS256"
+
+
+def create_session_token(
+    user_id: uuid.UUID, secret: str, *, now: datetime | None = None
+) -> str:
+    """A signed JWT that only says who the user is and when it expires.
+
+    The role and the blocked flag are deliberately not in it: they are read from the
+    database on every request, so a demotion or a block takes effect at once (AD-30).
+    """
+    issued_at = now or datetime.now(UTC)
+    claims = {
+        "sub": str(user_id),
+        "iat": issued_at,
+        "exp": issued_at + SESSION_LIFETIME,
+    }
+    return jwt.encode(claims, secret, algorithm=_JWT_ALGORITHM)
+
+
+def read_session_token(token: str, secret: str) -> uuid.UUID | None:
+    """The user id inside a valid, unexpired token; None for anything else."""
+    try:
+        claims = jwt.decode(
+            token,
+            secret,
+            # Pinning the algorithm list is what rejects `alg: none` forgeries.
+            algorithms=[_JWT_ALGORITHM],
+            options={"require": ["sub", "exp"]},
+        )
+        return uuid.UUID(claims["sub"])
+    except (jwt.InvalidTokenError, ValueError):
+        return None
```

### apps/recipe-service/app/main.py

```diff
diff --git a/apps/recipe-service/app/main.py b/apps/recipe-service/app/main.py
index 0bb800e..408f756 100644
--- a/apps/recipe-service/app/main.py
+++ b/apps/recipe-service/app/main.py
@@ -10,6 +10,7 @@ from app.core.db import get_engine
 from app.core.errors import register_error_handlers
 from app.core.health import router as health_router
 from app.core.migrate import run_migrations
+from app.core.rate_limit import limiter
 from app.imports.router import router as imports_router
 from app.photos.router import router as photos_router
 from app.recipes.router import router as recipes_router
@@ -56,6 +57,7 @@ def create_app() -> FastAPI:
         generate_unique_id_function=generate_operation_id,
         lifespan=lifespan,
     )
+    app.state.limiter = limiter
     register_error_handlers(app)
 
     api = APIRouter(prefix=API_PREFIX)
```

### apps/recipe-service/app/users/repository.py

```diff
diff --git a/apps/recipe-service/app/users/repository.py b/apps/recipe-service/app/users/repository.py
index 034823f..fc89383 100644
--- a/apps/recipe-service/app/users/repository.py
+++ b/apps/recipe-service/app/users/repository.py
@@ -1,5 +1,7 @@
 """Database access for users; used only by this module's service."""
 
+import uuid
+
 from sqlalchemy import func
 from sqlmodel import Session, col, select
 
@@ -10,6 +12,9 @@ class UserRepository:
     def __init__(self, session: Session) -> None:
         self._session = session
 
+    def get_by_id(self, user_id: uuid.UUID) -> User | None:
+        return self._session.get(User, user_id)
+
     def get_by_email(self, email: str) -> User | None:
         """The user with this email, compared case-insensitively (AD-30).
```

### apps/recipe-service/app/users/service.py

```diff
diff --git a/apps/recipe-service/app/users/service.py b/apps/recipe-service/app/users/service.py
index 7f3178c..3f9f0ae 100644
--- a/apps/recipe-service/app/users/service.py
+++ b/apps/recipe-service/app/users/service.py
@@ -1,5 +1,7 @@
 """Business rules for users; other modules call this layer, never the repository."""
 
+import uuid
+from functools import lru_cache
 from typing import Annotated
 
 from fastapi import Depends
@@ -8,7 +10,7 @@ from sqlmodel import Session
 
 from app.core.db import get_session
 from app.core.errors import AppError, ErrorCode
-from app.core.security import hash_password
+from app.core.security import hash_password, verify_password
 from app.users.models import User
 from app.users.repository import UserRepository
 from app.users.schemas import UserCreate, UserRead
@@ -48,6 +50,12 @@ def _read(user: User) -> UserRead:
     )
 
 
+@lru_cache
+def _decoy_hash() -> str:
+    """A real hash nobody has the password to, so an unknown email costs as much."""
+    return hash_password(uuid.uuid4().hex)
+
+
 def _email_taken() -> AppError:
     return AppError(409, ErrorCode.EMAIL_TAKEN, "A user with this email already exists")
 
@@ -79,6 +87,28 @@ class UserService:
             raise
         return _read(user)
 
+    def authenticate(self, email: str, password: str) -> UserRead | None:
+        """The active user whose email and password match, else None.
+
+        Unknown email, wrong password and a blocked account all look the same to the
+        caller. A decoy hash is verified for an unknown email, so the response time
+        does not reveal which emails have an account.
+        """
+        user = self._repository.get_by_email(email)
+        if user is None:
+            verify_password(password, _decoy_hash())
+            return None
+        if not verify_password(password, user.password_hash) or user.is_blocked:
+            return None
+        return _read(user)
+
+    def get_active_user(self, user_id: uuid.UUID) -> UserRead | None:
+        """The user as they are in the database now; None if gone or blocked."""
+        user = self._repository.get_by_id(user_id)
+        if user is None or user.is_blocked:
+            return None
+        return _read(user)
+
     def reset_password(self, email: str, password: str) -> UserRead:
         """Replace one user's password. Nothing else about them changes."""
         check_password_policy(password)
```

### apps/recipe-service/pyproject.toml

```diff
diff --git a/apps/recipe-service/pyproject.toml b/apps/recipe-service/pyproject.toml
index ee314c0..5a5f48f 100644
--- a/apps/recipe-service/pyproject.toml
+++ b/apps/recipe-service/pyproject.toml
@@ -29,6 +29,8 @@ dependencies = [
     "pwdlib[argon2]>=0.3.1",
     "pydantic>=2",
     "pydantic-settings>=2.16.1",
+    "pyjwt>=2.13",
+    "slowapi>=0.1.10",
     "sqlmodel>=0.0.48",
     "uvicorn[standard]>=0.54.0",
 ]
@@ -199,7 +201,9 @@ protected_modules = [
   "app.users.models",
   "app.users.schemas",
 ]
-allowed_importers = ["app.users", "app.cli"]
+# app.auth signs users in through users.service and UserRead only; the contract can't
+# narrow it to those names, so the repository and models stay out of reach by review.
+allowed_importers = ["app.users", "app.cli", "app.auth"]
 ignore_imports = [
   "app.main -> app.users.router",
   "app.core.metadata -> app.users.models",
```

### apps/recipe-service/tests/conftest.py

```diff
diff --git a/apps/recipe-service/tests/conftest.py b/apps/recipe-service/tests/conftest.py
index 8af9db5..bc81b9e 100644
--- a/apps/recipe-service/tests/conftest.py
+++ b/apps/recipe-service/tests/conftest.py
@@ -7,12 +7,16 @@ from fastapi import FastAPI
 from fastapi.testclient import TestClient
 from sqlmodel import Session
 
+# Long enough that PyJWT does not warn about a weak HMAC key.
+TEST_SECRET = "test-secret-test-secret-test-secret"
+
 # Set before any `app` import: importing app.main validates config immediately.
-os.environ["JWT_SECRET"] = "test-secret"
+os.environ["JWT_SECRET"] = TEST_SECRET
 os.environ["ENV"] = "dev"
 
 from app.core.config import Settings, get_settings  # noqa: E402
 from app.core.db import get_engine  # noqa: E402
+from app.core.rate_limit import limiter  # noqa: E402
 from app.main import create_app  # noqa: E402
 
 
@@ -28,10 +32,14 @@ def isolated_settings(
     monkeypatch.chdir(tmp_path)
     for name in Settings.model_fields:
         monkeypatch.delenv(name.upper(), raising=False)
-    monkeypatch.setenv("JWT_SECRET", "test-secret")
+    monkeypatch.setenv("JWT_SECRET", TEST_SECRET)
     monkeypatch.setenv("ENV", "dev")
+    # TestClient talks plain http, and a Secure cookie would never be sent back.
+    monkeypatch.setenv("COOKIE_SECURE", "false")
     monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
     get_settings.cache_clear()
+    # The login limiter is process-wide, so one test's attempts must not leak.
+    limiter.reset()
     yield
     get_settings.cache_clear()
     # Close pooled SQLite handles so Windows can delete tmp_path afterwards.
```

### apps/recipe-service/tests/test_config.py

```diff
diff --git a/apps/recipe-service/tests/test_config.py b/apps/recipe-service/tests/test_config.py
index 6f45c17..84ae334 100644
--- a/apps/recipe-service/tests/test_config.py
+++ b/apps/recipe-service/tests/test_config.py
@@ -6,6 +6,7 @@ from pathlib import Path
 import pytest
 
 from app.core.config import Environment, Settings, get_settings, load_settings
+from tests.conftest import TEST_SECRET
 
 SERVICE_ROOT = Path(__file__).resolve().parents[1]
 
@@ -13,6 +14,7 @@ SERVICE_ROOT = Path(__file__).resolve().parents[1]
 def test_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
     monkeypatch.delenv("ENV")
     monkeypatch.delenv("DATA_DIR")
+    monkeypatch.delenv("COOKIE_SECURE")
     settings = load_settings()
     assert settings.env is Environment.PRODUCTION
     assert settings.data_dir == Path("./data")
@@ -43,7 +45,7 @@ def test_env_vars_override_env_file(
     tmp_path: Path, monkeypatch: pytest.MonkeyPatch
 ) -> None:
     (tmp_path / ".env").write_text("JWT_SECRET=from-file\n", encoding="utf-8")
-    assert load_settings().jwt_secret.get_secret_value() == "test-secret"
+    assert load_settings().jwt_secret.get_secret_value() == TEST_SECRET
 
 
 @pytest.mark.parametrize("value", [None, "", "   "])
```

### apps/recipe-service/tests/test_openapi_export.py

```diff
diff --git a/apps/recipe-service/tests/test_openapi_export.py b/apps/recipe-service/tests/test_openapi_export.py
index a971b17..f8cc1ce 100644
--- a/apps/recipe-service/tests/test_openapi_export.py
+++ b/apps/recipe-service/tests/test_openapi_export.py
@@ -25,6 +25,8 @@ def test_export_writes_stable_sorted_json(tmp_path: Path) -> None:
         "user_not_found",
         "password_too_short",
         "password_too_long",
+        "invalid_credentials",
+        "rate_limited",
     ]
```

### apps/recipe-service/tests/test_security.py

```diff
diff --git a/apps/recipe-service/tests/test_security.py b/apps/recipe-service/tests/test_security.py
index a3d9bff..b5b28fc 100644
--- a/apps/recipe-service/tests/test_security.py
+++ b/apps/recipe-service/tests/test_security.py
@@ -1,6 +1,16 @@
+import uuid
+from datetime import UTC, datetime, timedelta
+
+import jwt
 import pytest
 
-from app.core.security import Role, hash_password, verify_password
+from app.core.security import (
+    Role,
+    create_session_token,
+    hash_password,
+    read_session_token,
+    verify_password,
+)
 
 
 def test_roles_are_editor_and_admin_only() -> None:
@@ -35,3 +45,66 @@ def test_verify_handles_non_ascii_passwords() -> None:
 @pytest.mark.parametrize("stored", ["", "plain-text-password", "$2b$12$notargon"])
 def test_verify_never_matches_a_value_that_is_not_an_argon2_hash(stored: str) -> None:
     assert verify_password("plain-text-password", stored) is False
+
+
+# --- session tokens ---------------------------------------------------------
+
+SECRET = "test-secret-test-secret-test-secret"
+
+
+def test_a_session_token_round_trips_the_user_id() -> None:
+    user_id = uuid.uuid4()
+    token = create_session_token(user_id, SECRET)
+    assert read_session_token(token, SECRET) == user_id
+
+
+def test_a_session_token_carries_no_role_or_blocked_flag() -> None:
+    token = create_session_token(uuid.uuid4(), SECRET)
+    claims = jwt.decode(token, SECRET, algorithms=["HS256"])
+    assert set(claims) == {"sub", "iat", "exp"}
+
+
+def test_a_session_token_lasts_seven_days() -> None:
+    now = datetime(2026, 10, 28, 9, 0, tzinfo=UTC)
+    token = create_session_token(uuid.uuid4(), SECRET, now=now)
+    claims = jwt.decode(
+        token, SECRET, algorithms=["HS256"], options={"verify_exp": False}
+    )
+    assert claims["exp"] - claims["iat"] == 7 * 24 * 60 * 60
+
+
+def test_an_expired_token_is_rejected() -> None:
+    long_ago = datetime.now(UTC) - timedelta(days=8)
+    token = create_session_token(uuid.uuid4(), SECRET, now=long_ago)
+    assert read_session_token(token, SECRET) is None
+
+
+def test_a_token_signed_with_another_secret_is_rejected() -> None:
+    token = create_session_token(uuid.uuid4(), "another-secret-another-secret-xx")
+    assert read_session_token(token, SECRET) is None
+
+
+def test_an_unsigned_token_is_rejected() -> None:
+    claims = {"sub": str(uuid.uuid4()), "exp": datetime.now(UTC) + timedelta(days=1)}
+    forged = jwt.encode(claims, key=None, algorithm="none")
+    assert read_session_token(forged, SECRET) is None
+
+
+def test_a_token_missing_its_expiry_or_subject_is_rejected() -> None:
+    no_exp = jwt.encode({"sub": str(uuid.uuid4())}, SECRET, algorithm="HS256")
+    no_sub = jwt.encode(
+        {"exp": datetime.now(UTC) + timedelta(days=1)}, SECRET, algorithm="HS256"
+    )
+    assert read_session_token(no_exp, SECRET) is None
+    assert read_session_token(no_sub, SECRET) is None
+
+
+def test_a_token_whose_subject_is_not_a_uuid_is_rejected() -> None:
+    claims = {"sub": "not-a-uuid", "exp": datetime.now(UTC) + timedelta(days=1)}
+    token = jwt.encode(claims, SECRET, algorithm="HS256")
+    assert read_session_token(token, SECRET) is None
+
+
+@pytest.mark.parametrize("token", ["", "garbage", "a.b.c"])
+def test_a_malformed_token_is_rejected(token: str) -> None:
+    assert read_session_token(token, SECRET) is None
```

### apps/recipe-service/tests/test_users.py

```diff
diff --git a/apps/recipe-service/tests/test_users.py b/apps/recipe-service/tests/test_users.py
index f6a2543..ba8a7f7 100644
--- a/apps/recipe-service/tests/test_users.py
+++ b/apps/recipe-service/tests/test_users.py
@@ -459,3 +459,19 @@ def test_cli_stops_cleanly_when_the_prompt_is_cancelled(
     assert main(CREATE) == 1
     assert "cancelled" in capsys.readouterr().err
     assert _users(session) == []
+
+
+def test_authenticate_still_verifies_a_hash_for_an_unknown_email(
+    service: UserService, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    """Same work for an unknown email, so timing does not reveal who has an account."""
+    verified: list[str] = []
+
+    def spy(password: str, password_hash: str) -> bool:
+        verified.append(password_hash)
+        return False
+
+    monkeypatch.setattr("app.users.service.verify_password", spy)
+    assert service.authenticate("nobody@example.com", PASSWORD) is None
+    assert len(verified) == 1
+    assert verified[0].startswith("$argon2id$")
```

### apps/recipe-service/uv.lock

Summarised (generated or lock file): 1 file changed, 71 insertions(+)

### apps/web/src/app/app-layout.tsx

```diff
diff --git a/apps/web/src/app/app-layout.tsx b/apps/web/src/app/app-layout.tsx
index 1119254..7604eea 100644
--- a/apps/web/src/app/app-layout.tsx
+++ b/apps/web/src/app/app-layout.tsx
@@ -1,9 +1,16 @@
-import { useEffect, useRef } from 'react';
+import { lazy, Suspense, useEffect, useRef } from 'react';
 import { useTranslation } from 'react-i18next';
 import { Link, Outlet, useLocation } from 'react-router';
 import { ThemeToggle, TopBar, Wordmark } from '@bite-and-board/ui-components';
 import { useTheme } from './theme';
 
+// Its own chunk: the account menu reads the session through the API client, which
+// the first load of a visitor browsing recipes should not wait for (AD-11).
+const AccountMenu = lazy(async () => ({
+  default: (await import('@bite-and-board/feature-auth/account-menu'))
+    .AccountMenu,
+}));
+
 /** The shell around every page: top bar, then the page in `<main>`. */
 export function AppLayout() {
   const { t } = useTranslation();
@@ -31,11 +38,19 @@ export function AppLayout() {
           </Wordmark>
         }
         actions={
-          <ThemeToggle
-            value={mode}
-            onValueChange={setMode}
-            label={t(`theme.toggle.${mode}`)}
-          />
+          <>
+            <ThemeToggle
+              value={mode}
+              onValueChange={setMode}
+              label={t(`theme.toggle.${mode}`)}
+            />
+            {/* Same size as the "כניסה" button, so the bar does not jump. */}
+            <Suspense
+              fallback={<div aria-hidden="true" className="h-11 w-20" />}
+            >
+              <AccountMenu />
+            </Suspense>
+          </>
         }
       />
       <main ref={main} className="mx-auto max-w-library px-4 pb-12 lg:px-8">
```

### apps/web/src/app/library-focus.spec.tsx

```diff
diff --git a/apps/web/src/app/library-focus.spec.tsx b/apps/web/src/app/library-focus.spec.tsx
index a06ed42..27d557b 100644
--- a/apps/web/src/app/library-focus.spec.tsx
+++ b/apps/web/src/app/library-focus.spec.tsx
@@ -21,6 +21,7 @@ const server = setupServer(
     ]),
   ),
   http.get('*/api/tags', () => HttpResponse.json([])),
+  http.get('*/api/auth/session', () => HttpResponse.json({ user: null })),
 );
 
 beforeAll(() => {
```

### apps/web/src/app/recipe-detail-shell.spec.tsx

```diff
diff --git a/apps/web/src/app/recipe-detail-shell.spec.tsx b/apps/web/src/app/recipe-detail-shell.spec.tsx
index 1ef2db2..40f7fe6 100644
--- a/apps/web/src/app/recipe-detail-shell.spec.tsx
+++ b/apps/web/src/app/recipe-detail-shell.spec.tsx
@@ -48,6 +48,7 @@ const server = setupServer(
     ]),
   ),
   http.get('*/api/tags', () => HttpResponse.json([])),
+  http.get('*/api/auth/session', () => HttpResponse.json({ user: null })),
   http.get('*/api/recipes/:id', ({ params }) =>
     params.id === 'r1'
       ? HttpResponse.json(RECIPE)
```

### apps/web/src/app/router.tsx

```diff
diff --git a/apps/web/src/app/router.tsx b/apps/web/src/app/router.tsx
index b39e427..f12e373 100644
--- a/apps/web/src/app/router.tsx
+++ b/apps/web/src/app/router.tsx
@@ -21,6 +21,10 @@ export const routes: RouteObject[] = [
         lazy: () => import('@bite-and-board/feature-recipes/recipe-detail'),
       },
       // Inside the layout, so the top bar stays on unknown paths.
+      {
+        path: 'login',
+        lazy: () => import('@bite-and-board/feature-auth/login'),
+      },
       { path: '*', Component: NotFound },
     ],
   },
```

### apps/web/tsconfig.app.json

```diff
diff --git a/apps/web/tsconfig.app.json b/apps/web/tsconfig.app.json
index 938d459..80e4738 100644
--- a/apps/web/tsconfig.app.json
+++ b/apps/web/tsconfig.app.json
@@ -40,6 +40,9 @@
     {
       "path": "../../libs/data-access/tsconfig.lib.json"
     },
+    {
+      "path": "../../libs/feature-auth/tsconfig.lib.json"
+    },
     {
       "path": "../../libs/feature-recipes/tsconfig.lib.json"
     },
```

### libs/data-access/openapi.json

Summarised (generated or lock file): 1 file changed, 190 insertions(+), 1 deletion(-)

### libs/data-access/src/generated/@tanstack/react-query.gen.ts

Summarised (generated or lock file): 1 file changed, 59 insertions(+), 3 deletions(-)

### libs/data-access/src/generated/index.ts

Summarised (generated or lock file): 1 file changed, 2 insertions(+), 2 deletions(-)

### libs/data-access/src/generated/sdk.gen.ts

Summarised (generated or lock file): 1 file changed, 27 insertions(+), 1 deletion(-)

### libs/data-access/src/generated/types.gen.ts

Summarised (generated or lock file): 1 file changed, 120 insertions(+), 1 deletion(-)

### libs/data-access/src/generated/zod.gen.ts

Summarised (generated or lock file): 1 file changed, 58 insertions(+), 1 deletion(-)

### libs/data-access/src/index.ts

```diff
diff --git a/libs/data-access/src/index.ts b/libs/data-access/src/index.ts
index 1fa637f..6792e4e 100644
--- a/libs/data-access/src/index.ts
+++ b/libs/data-access/src/index.ts
@@ -9,4 +9,5 @@ export * as schemas from './generated/zod.gen';
 export { client } from './generated/client.gen';
 export { CSRF_HEADER, CSRF_VALUE, configureClient } from './client';
 export { getErrorCode } from './errors';
+export { useSession } from './session';
 export { invalidationMap, type Invalidator } from './invalidation';
```

### libs/i18n/src/he.json

```diff
diff --git a/libs/i18n/src/he.json b/libs/i18n/src/he.json
index 07aa6e9..66affd4 100644
--- a/libs/i18n/src/he.json
+++ b/libs/i18n/src/he.json
@@ -47,6 +47,21 @@
       "moreTags_other": "{{count}} תגיות נוספות"
     }
   },
+  "auth": {
+    "login": {
+      "title": "כניסה",
+      "email": "אימייל",
+      "password": "סיסמה",
+      "submit": "כניסה",
+      "submitting": "נכנסים",
+      "emailRequired": "יש להזין אימייל",
+      "passwordRequired": "יש להזין סיסמה"
+    },
+    "menu": {
+      "login": "כניסה",
+      "logout": "יציאה"
+    }
+  },
   "notFound": {
     "title": "הדף לא נמצא",
     "body": "אופס...העמוד לא נמצא",
@@ -63,6 +78,8 @@
     "user_not_found": "המשתמש לא נמצא",
     "password_too_short": "הסיסמה חייבת להכיל לפחות {{min}} תווים",
     "password_too_long": "הסיסמה יכולה להכיל עד {{max}} תווים",
+    "invalid_credentials": "אימייל או סיסמה שגויים",
+    "rate_limited": "יותר מדי ניסיונות. אפשר לנסות שוב בעוד דקה.",
     "unknown": "משהו השתבש, אפשר לנסות שוב"
   },
   "units": {
```

### libs/ui-components/package.json

```diff
diff --git a/libs/ui-components/package.json b/libs/ui-components/package.json
index 7c53c52..ae9bd80 100644
--- a/libs/ui-components/package.json
+++ b/libs/ui-components/package.json
@@ -3,6 +3,9 @@
   "version": "0.0.1",
   "private": true,
   "type": "module",
+  "sideEffects": [
+    "*.css"
+  ],
   "main": "./src/index.ts",
   "types": "./src/index.ts",
   "exports": {
```

### package-lock.json

Summarised (generated or lock file): 1 file changed, 224 insertions(+), 128 deletions(-)

### package.json

```diff
diff --git a/package.json b/package.json
index 9d0fda7..5918505 100644
--- a/package.json
+++ b/package.json
@@ -69,6 +69,7 @@
   "packageManager": "npm@12.1.0",
   "dependencies": {
     "@fontsource/rubik": "5.3.0",
+    "@hookform/resolvers": "6.0.2",
     "@tanstack/react-query": "5.105.0",
     "class-variance-authority": "0.7.1",
     "clsx": "2.1.1",
@@ -77,6 +78,7 @@
     "radix-ui": "1.8.1",
     "react": "^19.2.7",
     "react-dom": "^19.2.7",
+    "react-hook-form": "7.91.0",
     "react-i18next": "17.1.9",
     "react-router": "8.5.0",
     "sonner": "2.0.8",
```

### tsconfig.json

```diff
diff --git a/tsconfig.json b/tsconfig.json
index 9cb9e7a..00479eb 100644
--- a/tsconfig.json
+++ b/tsconfig.json
@@ -23,6 +23,9 @@
     },
     {
       "path": "./libs/feature-recipes"
+    },
+    {
+      "path": "./libs/feature-auth"
     }
   ],
   "compilerOptions": {}
```

## New files

### apps/recipe-service/app/core/rate_limit.py

```python
"""Login rate limiting with slowapi (NFR-10, AD-33)."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Failed and successful attempts both count. The counters live in memory, which is
# fine for the single container (AD-15) and means a restart clears them.
LOGIN_LIMIT = "5/minute"

# Keyed by the client IP. Behind a reverse proxy uvicorn must be told to trust its
# forwarded headers, or every user shares one bucket (see the service README).
limiter = Limiter(key_func=get_remote_address)
```

### apps/recipe-service/tests/test_auth_api.py

```python
import asyncio
import uuid
from collections.abc import Callable, Coroutine
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session
from starlette.requests import Request

from app.core.config import get_settings
from app.core.errors import _app_error_handler, _rate_limit_handler
from app.core.rate_limit import limiter
from app.core.security import SESSION_COOKIE, Role, create_session_token
from tests.conftest import TEST_SECRET
from tests.factories import add_user

EMAIL = "adi@example.com"
PASSWORD = "correct horse"
LOGIN = "/api/auth/login"
SESSION = "/api/auth/session"
LOGOUT = "/api/auth/logout"
SECRET = TEST_SECRET


def _login(
    client: TestClient, email: str = EMAIL, password: str = PASSWORD
) -> Response:
    response: Response = client.post(LOGIN, json={"email": email, "password": password})
    return response


def _set_cookie(response: Response) -> str:
    return response.headers["set-cookie"].lower()


def _with_cookie(client: TestClient, token: str) -> Response:
    client.cookies.set(SESSION_COOKIE, token)
    response: Response = client.get(SESSION)
    return response


# --- login -------------------------------------------------------------------


def test_login_returns_the_user_and_sets_the_session_cookie(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, name="עדי", role=Role.ADMIN)
    response = _login(client)
    assert response.status_code == 200
    assert response.json() == {
        "user": {"id": str(user.id), "email": EMAIL, "name": "עדי", "role": "admin"}
    }
    assert SESSION_COOKIE in client.cookies


def test_the_cookie_is_httponly_lax_and_lasts_seven_days(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    cookie = _set_cookie(_login(client))
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "max-age=604800" in cookie
    assert "path=/" in cookie


def test_the_cookie_is_secure_only_when_configured(
    monkeypatch: pytest.MonkeyPatch, client: TestClient, session: Session
) -> None:
    add_user(session)
    monkeypatch.setenv("COOKIE_SECURE", "false")
    get_settings.cache_clear()
    assert "; secure" not in _set_cookie(_login(client))
    client.cookies.clear()
    monkeypatch.setenv("COOKIE_SECURE", "true")
    get_settings.cache_clear()
    assert "; secure" in _set_cookie(_login(client))


def test_the_cookie_holds_a_jwt_for_the_user(
    client: TestClient, session: Session
) -> None:
    user = add_user(session)
    _login(client)
    claims = jwt.decode(client.cookies[SESSION_COOKIE], SECRET, algorithms=["HS256"])
    assert claims["sub"] == str(user.id)


def test_the_email_is_matched_without_case(
    client: TestClient, session: Session
) -> None:
    add_user(session, email="Adi@Example.com")
    assert _login(client, "ADI@example.COM").status_code == 200


def test_wrong_password_and_unknown_email_get_the_same_400(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    wrong_password = _login(client, password="not the password")
    unknown_email = _login(client, email="nobody@example.com")
    assert wrong_password.status_code == unknown_email.status_code == 400
    assert wrong_password.json() == unknown_email.json()
    assert wrong_password.json()["code"] == "invalid_credentials"
    assert "set-cookie" not in wrong_password.headers


def test_a_blocked_user_cannot_log_in_and_is_not_told_why(
    client: TestClient, session: Session
) -> None:
    add_user(session, is_blocked=True)
    response = _login(client)
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_credentials"
    assert "set-cookie" not in response.headers


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"email": EMAIL},
        {"password": PASSWORD},
        {"email": "", "password": PASSWORD},
        {"email": EMAIL, "password": ""},
        {"email": EMAIL, "password": "x" * 129},
    ],
)
def test_a_malformed_login_body_is_a_422(
    client: TestClient, session: Session, body: dict[str, str]
) -> None:
    add_user(session)
    assert client.post(LOGIN, json=body).status_code == 422


def test_a_malformed_email_is_just_wrong_credentials(client: TestClient) -> None:
    assert _login(client, email="not-an-email").status_code == 400


# --- rate limit --------------------------------------------------------------


def test_the_sixth_attempt_in_a_minute_is_a_429(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    for _ in range(5):
        assert _login(client, password="wrong password").status_code == 400
    blocked = _login(client)
    assert blocked.status_code == 429
    assert blocked.json() == {"detail": "Too many attempts", "code": "rate_limited"}
    assert blocked.headers["retry-after"] == "60"
    assert SESSION_COOKIE not in client.cookies


def test_successful_logins_count_too(client: TestClient, session: Session) -> None:
    add_user(session)
    for _ in range(5):
        assert _login(client).status_code == 200
    assert _login(client).status_code == 429


def test_the_limit_applies_to_login_only(client: TestClient, session: Session) -> None:
    add_user(session)
    for _ in range(6):
        _login(client, password="wrong password")
    assert client.get(SESSION).status_code == 200
    assert client.post(LOGOUT).status_code == 204


def test_the_limiter_can_be_reset(client: TestClient, session: Session) -> None:
    add_user(session)
    for _ in range(6):
        _login(client, password="wrong password")
    limiter.reset()
    assert _login(client).status_code == 200


# --- session -----------------------------------------------------------------


def test_a_visitor_gets_a_200_with_no_user(client: TestClient) -> None:
    response = client.get(SESSION)
    assert response.status_code == 200
    assert response.json() == {"user": None}
    assert "set-cookie" not in response.headers


def test_a_signed_in_user_is_returned_by_the_session_endpoint(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, role=Role.EDITOR)
    _login(client)
    assert client.get(SESSION).json()["user"] == {
        "id": str(user.id),
        "email": EMAIL,
        "name": "Adi",
        "role": "editor",
    }


def test_the_session_endpoint_never_exposes_the_password_hash(
    client: TestClient, session: Session
) -> None:
    user = add_user(session)
    _login(client)
    response = client.get(SESSION)
    assert user.password_hash not in response.text
    assert set(response.json()["user"]) == {"id", "email", "name", "role"}


def test_a_role_change_shows_on_the_next_request(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, role=Role.EDITOR)
    _login(client)
    user.role = Role.ADMIN
    session.add(user)
    session.commit()
    assert client.get(SESSION).json()["user"]["role"] == "admin"


def test_a_blocked_user_is_a_visitor_and_the_cookie_is_cleared(
    client: TestClient, session: Session
) -> None:
    user = add_user(session)
    _login(client)
    user.is_blocked = True
    session.add(user)
    session.commit()
    response = client.get(SESSION)
    assert response.json() == {"user": None}
    assert "max-age=0" in _set_cookie(response)


def test_a_deleted_user_is_a_visitor(client: TestClient, session: Session) -> None:
    user = add_user(session)
    _login(client)
    session.delete(user)
    session.commit()
    assert client.get(SESSION).json() == {"user": None}


@pytest.mark.parametrize(
    "token",
    [
        "garbage",
        create_session_token(uuid.uuid4(), "another-secret-another-secret-xx"),
        create_session_token(
            uuid.uuid4(), SECRET, now=datetime.now(UTC) - timedelta(days=8)
        ),
    ],
    ids=["garbage", "wrong-signature", "expired"],
)
def test_a_bad_cookie_is_a_visitor_and_is_cleared(
    client: TestClient, token: str
) -> None:
    response = _with_cookie(client, token)
    assert response.status_code == 200
    assert response.json() == {"user": None}
    assert "max-age=0" in _set_cookie(response)


def test_a_valid_token_for_an_unknown_user_is_a_visitor(client: TestClient) -> None:
    token = create_session_token(uuid.uuid4(), SECRET)
    assert _with_cookie(client, token).json() == {"user": None}


# --- logout ------------------------------------------------------------------


def test_logout_clears_the_cookie_and_ends_the_session(
    client: TestClient, session: Session
) -> None:
    add_user(session)
    _login(client)
    response = client.post(LOGOUT)
    assert response.status_code == 204
    cookie = _set_cookie(response)
    assert "max-age=0" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert client.get(SESSION).json() == {"user": None}


def test_logout_without_a_session_still_succeeds(client: TestClient) -> None:
    assert client.post(LOGOUT).status_code == 204


# --- contract ----------------------------------------------------------------


def test_the_auth_routes_are_in_the_openapi_schema(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert paths["/api/auth/login"]["post"]["operationId"] == "auth_login"
    assert paths["/api/auth/logout"]["post"]["operationId"] == "auth_logout"
    assert paths["/api/auth/session"]["get"]["operationId"] == "auth_session"


@pytest.mark.parametrize("handler", [_app_error_handler, _rate_limit_handler])
def test_the_error_handlers_re_raise_exceptions_that_are_not_theirs(
    handler: Callable[[Request, Exception], Coroutine[object, object, object]],
) -> None:
    boom = RuntimeError("boom")
    with pytest.raises(RuntimeError) as raised:
        asyncio.run(handler(Request({"type": "http"}), boom))
    assert raised.value is boom
```

### apps/web/src/app/account-slot.spec.tsx

```tsx
import { render, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { client } from '@bite-and-board/data-access';
import { AppProviders } from './app-providers';
import { routes } from './router';

const server = setupServer(
  http.get('*/api/recipes', () => HttpResponse.json([])),
  http.get('*/api/tags', () => HttpResponse.json([])),
);

beforeAll(() => {
  // Node's fetch rejects the client's relative `/api` URLs.
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('the top bar account slot', () => {
  it('offers "כניסה" to a visitor', async () => {
    server.use(
      http.get('*/api/auth/session', () => HttpResponse.json({ user: null })),
    );
    renderApp('/');
    const banner = await screen.findByRole('banner');
    expect(
      await within(banner).findByRole('link', { name: 'כניסה' }),
    ).toBeTruthy();
  });

  it('shows the name of a signed-in user', async () => {
    server.use(
      http.get('*/api/auth/session', () =>
        HttpResponse.json({
          user: { id: 'u1', email: 'a@b.co', name: 'Adi', role: 'editor' },
        }),
      ),
    );
    renderApp('/');
    const banner = await screen.findByRole('banner');
    expect(
      await within(banner).findByRole('button', { name: 'Adi' }),
    ).toBeTruthy();
  });

  it('renders the lazy login page at /login', async () => {
    server.use(
      http.get('*/api/auth/session', () => HttpResponse.json({ user: null })),
    );
    renderApp('/login');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'כניסה' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('אימייל')).toBeTruthy();
    // The page has its own sign-in form, so the bar does not offer a second way in.
    expect(
      within(await screen.findByRole('banner')).queryByRole('link', {
        name: 'כניסה',
      }),
    ).toBeNull();
  });
});
```

### libs/data-access/src/session.ts

```ts
import { useQuery } from '@tanstack/react-query';
import { authSessionOptions } from './generated/@tanstack/react-query.gen';

/**
 * Who is signed in (AD-21). The query cache is the auth state: login sets it,
 * logout clears it, and every component reads it here. `data.user` is null for
 * a visitor, and `data` is undefined only while the first answer is loading.
 *
 * It never goes stale by itself: the cookie is `httpOnly`, so the client cannot
 * see it expire. An expired or revoked session shows up as a 401 on the next
 * protected request (Story 2.3).
 */
export function useSession() {
  return useQuery({ ...authSessionOptions(), staleTime: Infinity });
}
```

### libs/feature-auth/eslint.config.mjs

```js
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    ignores: ['**/out-tsc'],
  },
];
```

### libs/feature-auth/package.json

```json
{
  "name": "@bite-and-board/feature-auth",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    "./login": {
      "types": "./src/routes/login.tsx",
      "import": "./src/routes/login.tsx",
      "default": "./src/routes/login.tsx"
    },
    "./account-menu": {
      "types": "./src/routes/account-menu.tsx",
      "import": "./src/routes/account-menu.tsx",
      "default": "./src/routes/account-menu.tsx"
    },
    "./package.json": "./package.json"
  },
  "nx": {
    "name": "feature-auth",
    "tags": [
      "type:feature"
    ]
  }
}
```

### libs/feature-auth/src/routes/account-menu.spec.tsx

```tsx
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../testing/server';
import { ADI, renderAt, serveSession } from '../testing/render-auth';
import { AccountMenu } from './account-menu';

function renderMenu(path = '/') {
  return renderAt(path, [{ path: '*', element: <AccountMenu /> }]);
}

describe('AccountMenu', () => {
  it('shows nothing until the session is known', () => {
    serveSession(null);
    renderMenu();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers "כניסה" to a visitor', async () => {
    serveSession(null);
    renderMenu();
    const link = await screen.findByRole('link', { name: 'כניסה' });
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('brings the visitor back to the page they were on', async () => {
    serveSession(null);
    renderMenu('/recipes/r1?servings=6');
    const link = await screen.findByRole('link', { name: 'כניסה' });
    expect(link.getAttribute('href')).toBe(
      '/login?next=%2Frecipes%2Fr1%3Fservings%3D6',
    );
  });

  it('hides "כניסה" on the login page', async () => {
    serveSession(null);
    renderMenu('/login');
    // Give the session answer time to arrive; there is still nothing to show.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the signed-in name as the menu button', async () => {
    serveSession(ADI);
    renderMenu();
    expect(await screen.findByRole('button', { name: 'Adi' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'כניסה' })).toBeNull();
  });

  it('logs out and turns back into "כניסה" without a reload', async () => {
    const user = userEvent.setup();
    let signedIn = true;
    let csrf: string | null = null;
    server.use(
      http.get('*/api/auth/session', () =>
        HttpResponse.json({ user: signedIn ? ADI : null }),
      ),
      http.post('*/api/auth/logout', ({ request }) => {
        csrf = request.headers.get('X-Requested-With');
        signedIn = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Adi' }));
    await user.click(await screen.findByRole('menuitem', { name: 'יציאה' }));
    expect(await screen.findByRole('link', { name: 'כניסה' })).toBeTruthy();
    expect(csrf).toBe('bite-and-board');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Adi' })).toBeNull(),
    );
  });
});
```

### libs/feature-auth/src/routes/account-menu.tsx

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import {
  authLogoutMutation,
  authSessionQueryKey,
  useSession,
} from '@bite-and-board/data-access';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@bite-and-board/ui-components';

/**
 * The top bar's account slot (UX-DR4): "כניסה" for a visitor, the user's name with
 * an account menu once signed in. It is its own chunk, so the app shell does not
 * pull the API client into the first load.
 */
export function AccountMenu() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const session = useSession();
  const logout = useMutation({
    ...authLogoutMutation(),
    onSuccess: async () => {
      // Visitor right away, then confirm with the server.
      queryClient.setQueryData(authSessionQueryKey(), { user: null });
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey() });
    },
  });

  const user = session.data?.user;
  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            {user.name}
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => logout.mutate({})}>
            {t('auth.menu.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Nothing while the first answer is loading, and none on the login page itself.
  if (!session.data || location.pathname === '/login') return null;
  const next = `${location.pathname}${location.search}`;
  return (
    <Button asChild variant="ghost">
      <Link
        to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`}
      >
        {t('auth.menu.login')}
      </Link>
    </Button>
  );
}
```

### libs/feature-auth/src/routes/login.spec.tsx

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { server } from '../testing/server';
import { ADI, renderAt, serveSession } from '../testing/render-auth';
import { Component as LoginPage } from './login';

function renderLogin(path = '/login') {
  serveSession(null);
  return renderAt(path, [
    { path: '/login', element: <LoginPage /> },
    { path: '/', element: <p>home stub</p> },
    { path: '/recipes/:id', element: <p>recipe stub</p> },
  ]);
}

const email = () => screen.getByLabelText('אימייל');
const password = () => screen.getByLabelText('סיסמה');
const submit = () => screen.getByRole('button', { name: 'כניסה' });

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(email(), 'adi@example.com');
  await user.type(password(), 'correct horse');
}

describe('LoginPage', () => {
  it('has labelled, left-to-right email and password fields', async () => {
    renderLogin();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'כניסה' }),
    ).toBeTruthy();
    expect(email().getAttribute('dir')).toBe('ltr');
    expect(email().getAttribute('autocomplete')).toBe('username');
    expect(password().getAttribute('dir')).toBe('ltr');
    expect(password().getAttribute('type')).toBe('password');
    expect(password().getAttribute('autocomplete')).toBe('current-password');
    expect(document.title).toBe('כניסה · ביס & סיר');
  });

  it('logs in, sends the CSRF header and goes to ?next=', async () => {
    const user = userEvent.setup();
    let body: unknown;
    let csrf: string | null = null;
    server.use(
      http.post('*/api/auth/login', async ({ request }) => {
        body = await request.json();
        csrf = request.headers.get('X-Requested-With');
        return HttpResponse.json({ user: ADI });
      }),
    );
    const { router } = renderLogin('/login?next=%2Frecipes%2Fr1');
    await fill(user);
    await user.click(submit());
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/recipes/r1'),
    );
    expect(body).toEqual({
      email: 'adi@example.com',
      password: 'correct horse',
    });
    expect(csrf).toBe('bite-and-board');
    expect(screen.getByText('recipe stub')).toBeTruthy();
  });

  it('goes to / without ?next=', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json({ user: ADI })),
    );
    const { router } = renderLogin();
    await fill(user);
    await user.click(submit());
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it.each(['https://evil.example', '//evil.example'])(
    'ignores an off-site ?next=%s',
    async (next) => {
      const user = userEvent.setup();
      server.use(
        http.post('*/api/auth/login', () => HttpResponse.json({ user: ADI })),
      );
      const { router } = renderLogin(`/login?next=${encodeURIComponent(next)}`);
      await fill(user);
      await user.click(submit());
      await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    },
  );

  it('shows one generic message for wrong credentials', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { detail: 'Invalid email or password', code: 'invalid_credentials' },
          { status: 400 },
        ),
      ),
    );
    renderLogin();
    await fill(user);
    await user.click(submit());
    const alert = await screen.findByText('אימייל או סיסמה שגויים');
    expect(alert.getAttribute('role')).toBe('alert');
    // It names no field, and the visitor stays on the page with the email kept.
    expect(email().getAttribute('aria-invalid')).toBeNull();
    expect(password().getAttribute('aria-invalid')).toBeNull();
    expect((email() as HTMLInputElement).value).toBe('adi@example.com');
  });

  it('says to wait when rate limited', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { detail: 'Too many attempts', code: 'rate_limited' },
          { status: 429 },
        ),
      ),
    );
    renderLogin();
    await fill(user);
    await user.click(submit());
    expect(
      await screen.findByText('יותר מדי ניסיונות. אפשר לנסות שוב בעוד דקה.'),
    ).toBeTruthy();
  });

  it('falls back to the generic message for a network failure', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/auth/login', () => HttpResponse.error()));
    renderLogin();
    await fill(user);
    await user.click(submit());
    expect(await screen.findByText('משהו השתבש, אפשר לנסות שוב')).toBeTruthy();
  });

  it('asks for both fields without calling the server', async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.post('*/api/auth/login', () => {
        called = true;
        return HttpResponse.json({ user: ADI });
      }),
    );
    renderLogin();
    await user.click(submit());
    expect(await screen.findByText('יש להזין אימייל')).toBeTruthy();
    expect(screen.getByText('יש להזין סיסמה')).toBeTruthy();
    expect(email().getAttribute('aria-invalid')).toBe('true');
    expect(email().getAttribute('aria-describedby')).toBe('login-email-error');
    expect(called).toBe(false);
  });

  it('disables the button while the request is in flight', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/login', async () => {
        await delay(50);
        return HttpResponse.json({ user: ADI });
      }),
    );
    renderLogin();
    await fill(user);
    await user.click(submit());
    const busy = await screen.findByRole('button', { name: 'נכנסים' });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
  });

  it('sends a user who is already signed in on to ?next=', async () => {
    serveSession(ADI);
    const { router } = renderAt('/login?next=%2Frecipes%2Fr1', [
      { path: '/login', element: <LoginPage /> },
      { path: '/recipes/:id', element: <p>recipe stub</p> },
    ]);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/recipes/r1'),
    );
  });
});
```

### libs/feature-auth/src/routes/login.tsx

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import {
  authLoginMutation,
  authSessionQueryKey,
  useSession,
} from '@bite-and-board/data-access';
import { Button, Input, Label } from '@bite-and-board/ui-components';
import { safeNext } from '../shared/safe-next';
import { useErrorMessage } from '../shared/use-error-message';

/** The login page at `/login` (FR-14). Wrong credentials never say which field. */
export function LoginPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const session = useSession();
  const login = useMutation(authLoginMutation());

  const schema = z.object({
    email: z.string().trim().min(1, t('auth.login.emailRequired')),
    password: z.string().min(1, t('auth.login.passwordRequired')),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  // Signed in, whether just now or already before: go where the visitor was headed.
  if (session.data?.user) {
    return <Navigate to={safeNext(params.get('next'))} replace />;
  }

  const onSubmit = handleSubmit((values) =>
    login.mutate(
      { body: values },
      {
        // The login answer has the session's shape, so it fills the cache directly
        // and the editing controls appear without another request.
        onSuccess: (response) =>
          queryClient.setQueryData(authSessionQueryKey(), response),
      },
    ),
  );

  return (
    <>
      <title>{t('app.pageTitle', { page: t('auth.login.title') })}</title>
      <div className="mx-auto flex max-w-sm flex-col pt-8">
        <h1 tabIndex={-1} className="pb-6 text-title outline-none">
          {t('auth.login.title')}
        </h1>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-email">{t('auth.login.email')}</Label>
            <Input
              id="login-email"
              type="email"
              dir="ltr"
              autoComplete="username"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              {...register('email')}
            />
            {errors.email ? (
              <p id="login-email-error" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">{t('auth.login.password')}</Label>
            <Input
              id="login-password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={
                errors.password ? 'login-password-error' : undefined
              }
              {...register('password')}
            />
            {errors.password ? (
              <p id="login-password-error" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>
          {/* Always rendered, so a screen reader announces the text when it appears. */}
          <p role="alert" className="text-sm text-destructive">
            {login.isError ? errorMessage(login.error) : null}
          </p>
          <Button type="submit" disabled={login.isPending}>
            {login.isPending
              ? t('auth.login.submitting')
              : t('auth.login.submit')}
          </Button>
        </form>
      </div>
    </>
  );
}

export { LoginPage as Component };
```

### libs/feature-auth/src/shared/safe-next.spec.ts

```ts
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it.each([
    ['/recipes/abc', '/recipes/abc'],
    ['/?q=pasta&tag=1', '/?q=pasta&tag=1'],
    ['/', '/'],
  ])('keeps the same-site path %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });

  it.each([
    null,
    '',
    'recipes/abc',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '/\nfoo',
    // eslint-disable-next-line no-script-url
    'javascript:alert(1)',
  ])('falls back to / for %j', (next) => {
    expect(safeNext(next)).toBe('/');
  });
});
```

### libs/feature-auth/src/shared/safe-next.ts

```ts
const BACKSLASH = '\\';

/**
 * Where to go after login: the `?next=` path, but only if it stays on this site.
 * Anything else (another host, `//host`, `/\host`, a script URL) becomes `/`, so a
 * crafted login link cannot send someone elsewhere after they type their password.
 */
export function safeNext(next: string | null): string {
  if (
    next === null ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    // Browsers strip tabs and newlines and treat a backslash like a slash, so
    // "/\t/host" and "/\host" both mean "//host".
    [...next].some((char) => char.charCodeAt(0) < 0x20 || char === BACKSLASH)
  ) {
    return '/';
  }
  return next;
}
```

### libs/feature-auth/src/shared/use-error-message.ts

```ts
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { getErrorCode } from '@bite-and-board/data-access';

/** An API error as Hebrew copy (AD-28): `errors.<code>`, or the generic message. */
export function useErrorMessage() {
  const { t, i18n } = useTranslation();
  return (error: unknown) => {
    const code = getErrorCode(error);
    // The code comes from the server, so the key is checked at runtime.
    const key = code ? (`errors.${code}` as ParseKeys) : undefined;
    const message: string =
      key && i18n.exists(key) ? t(key) : t('errors.unknown');
    return message;
  };
}
```

### libs/feature-auth/src/testing/render-auth.tsx

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { SessionUser } from '@bite-and-board/data-access';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider } from '@bite-and-board/ui-components';
import { server } from './server';

initI18n();

export const ADI: SessionUser = {
  id: 'u1',
  email: 'adi@example.com',
  name: 'Adi',
  role: 'admin',
};

/** Serves GET /api/auth/session: the user, or null for a visitor. */
export function serveSession(user: SessionUser | null) {
  server.use(http.get('*/api/auth/session', () => HttpResponse.json({ user })));
}

/** Renders these routes at `path`, with the providers the app gives them. */
export function renderAt(
  path: string,
  routes: { path: string; element: ReactNode }[],
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <DirectionProvider dir="rtl">
        <RouterProvider router={router} />
      </DirectionProvider>
    </QueryClientProvider>,
  );
  return { router, queryClient };
}
```

### libs/feature-auth/src/testing/server.ts

```ts
import { setupServer } from 'msw/node';

/** The API stand-in for component tests; each spec adds its own handlers. */
export const server = setupServer();
```

### libs/feature-auth/src/testing/setup.ts

```ts
import { client } from '@bite-and-board/data-access';
import { server } from './server';

// The generated client uses relative `/api` URLs, which Node's fetch rejects;
// the page origin gives MSW something to match.
client.setConfig({ baseUrl: window.location.origin });

// jsdom gaps that Radix (the chip row) relies on.
class ResizeObserverStub {
  observe() {
    /* no layout in jsdom */
  }
  unobserve() {
    /* no layout in jsdom */
  }
  disconnect() {
    /* no layout in jsdom */
  }
}
globalThis.ResizeObserver ??= ResizeObserverStub;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### libs/feature-auth/tsconfig.json

```json
{
  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ],
  "extends": "../../tsconfig.base.json"
}
```

### libs/feature-auth/tsconfig.lib.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "types": [
      "node",
      "@nx/react/typings/cssmodule.d.ts",
      "@nx/react/typings/image.d.ts"
    ],
    "rootDir": "src",
    "lib": ["es2022", "dom", "dom.iterable"],
    "jsx": "react-jsx",
    "module": "esnext",
    "moduleResolution": "bundler",
    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo"
  },
  "exclude": [
    "out-tsc",
    "dist",
    "**/*.spec.ts",
    "**/*.test.ts",
    "**/*.spec.tsx",
    "**/*.test.tsx",
    "**/*.spec.js",
    "**/*.test.js",
    "**/*.spec.jsx",
    "**/*.test.jsx",
    "vite.config.ts",
    "vite.config.mts",
    "vitest.config.ts",
    "vitest.config.mts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.test.tsx",
    "src/**/*.spec.tsx",
    "src/**/*.test.js",
    "src/**/*.spec.js",
    "src/**/*.test.jsx",
    "src/**/*.spec.jsx",
    "eslint.config.js",
    "eslint.config.cjs",
    "eslint.config.mjs",
    "src/testing"
  ],
  "include": ["src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"],
  "references": [
    {
      "path": "../data-access/tsconfig.lib.json"
    },
    {
      "path": "../i18n/tsconfig.lib.json"
    },
    {
      "path": "../ui-components/tsconfig.lib.json"
    }
  ]
}
```

### libs/feature-auth/tsconfig.spec.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./out-tsc/vitest",
    "types": [
      "vitest/globals",
      "vitest/importMeta",
      "vite/client",
      "node",
      "vitest"
    ],
    "jsx": "react-jsx",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["es2022", "dom", "dom.iterable"]
  },
  "include": [
    "vite.config.ts",
    "vite.config.mts",
    "vitest.config.ts",
    "vitest.config.mts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.test.tsx",
    "src/**/*.spec.tsx",
    "src/**/*.test.js",
    "src/**/*.spec.js",
    "src/**/*.test.jsx",
    "src/**/*.spec.jsx",
    "src/**/*.d.ts",
    "src/testing/**/*.ts",
    "src/testing/**/*.tsx"
  ],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    }
  ]
}
```

### libs/feature-auth/vite.config.mts

```ts
import { defineConfig } from 'vite';
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/feature-auth',
  // Tests run the same compiled components the app ships.
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  test: {
    name: '@bite-and-board/feature-auth',
    watch: false,
    passWithNoTests: true,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
```
