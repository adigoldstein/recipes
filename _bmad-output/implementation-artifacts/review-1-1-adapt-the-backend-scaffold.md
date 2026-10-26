# Review: Story 1.1 — Adapt the backend scaffold

**Status:** ready for Adi's review. Nothing is committed (baseline `c0523778cb8536d0410167f9aecdeeee66454908`).
**Spec:** [spec-1-1-adapt-the-backend-scaffold.md](spec-1-1-adapt-the-backend-scaffold.md) · **Deferred:** [deferred-work.md](deferred-work.md)

## Verification

- `npx nx run-many -t test lint -p recipe-service` → 34 passed, ruff clean.
- `npx nx run recipe-service:serve` → `GET /api/health` 200 `{"status":"ok"}`, `GET /health` 404.
- Starting without `JWT_SECRET` → exits non-zero with a message naming `JWT_SECRET` and `.env.example` (subprocess test).
- 3 parallel reviews (blind, edge-case, verification-gap): 19 findings → 6 patched, 5 deferred, 8 rejected (see the spec's Review Triage Log).

## Acceptance criteria

| AC | Result |
|----|--------|
| `app/core` (config, db, security placeholder, errors, health) + 6 feature packages × 5 files | ✅ `test_feature_module_has_every_layer` |
| `app/core/metadata.py` imports every module's models | ✅ `test_metadata_imports_every_module_models` |
| `GET /api/health` 200, `/health` gone | ✅ `test_health.py` + manual serve |
| Python 3.13, `pydantic-settings` + runtime `httpx` | ✅ `.python-version`, `pyproject.toml`, `uv.lock` |
| Config read once via pydantic-settings; refuses to start without `JWT_SECRET` | ✅ `test_config.py` |
| `.env.example` lists every AD-29 setting; `.env` gitignored | ✅ (local `.env` created, not committed) |
| `recipe-service:serve`, `:test`, `:lint` pass | ✅ |

## Changed files

     .gitignore                                    |   1 +
     apps/recipe-service/.env.example              |  36 ++++
     apps/recipe-service/.python-version           |   2 +-
     apps/recipe-service/README.md                 |  35 +++-
     apps/recipe-service/app/api/__init__.py       |   1 -
     apps/recipe-service/app/api/health.py         |   8 -
     apps/recipe-service/app/auth/__init__.py      |   0
     apps/recipe-service/app/auth/models.py        |   1 +
     apps/recipe-service/app/auth/repository.py    |   1 +
     apps/recipe-service/app/auth/router.py        |   3 +
     apps/recipe-service/app/auth/schemas.py       |   1 +
     apps/recipe-service/app/auth/service.py       |   1 +
     apps/recipe-service/app/core/config.py        |  92 ++++++++++
     apps/recipe-service/app/core/db.py            |  31 ++++
     apps/recipe-service/app/core/errors.py        |  43 +++++
     apps/recipe-service/app/core/health.py        |  15 ++
     apps/recipe-service/app/core/metadata.py      |  21 +++
     apps/recipe-service/app/core/security.py      |   1 +
     apps/recipe-service/app/db/__init__.py        |   1 -
     apps/recipe-service/app/imports/__init__.py   |   0
     apps/recipe-service/app/imports/models.py     |   1 +
     apps/recipe-service/app/imports/repository.py |   1 +
     apps/recipe-service/app/imports/router.py     |   3 +
     apps/recipe-service/app/imports/schemas.py    |   1 +
     apps/recipe-service/app/imports/service.py    |   1 +
     apps/recipe-service/app/main.py               |  53 +++++-
     apps/recipe-service/app/models/__init__.py    |   1 -
     apps/recipe-service/app/photos/__init__.py    |   0
     apps/recipe-service/app/photos/models.py      |   1 +
     apps/recipe-service/app/photos/repository.py  |   1 +
     apps/recipe-service/app/photos/router.py      |   3 +
     apps/recipe-service/app/photos/schemas.py     |   1 +
     apps/recipe-service/app/photos/service.py     |   1 +
     apps/recipe-service/app/recipes/__init__.py   |   0
     apps/recipe-service/app/recipes/models.py     |   1 +
     apps/recipe-service/app/recipes/repository.py |   1 +
     apps/recipe-service/app/recipes/router.py     |   3 +
     apps/recipe-service/app/recipes/schemas.py    |   1 +
     apps/recipe-service/app/recipes/service.py    |   1 +
     apps/recipe-service/app/tags/__init__.py      |   0
     apps/recipe-service/app/tags/models.py        |   1 +
     apps/recipe-service/app/tags/repository.py    |   1 +
     apps/recipe-service/app/tags/router.py        |   3 +
     apps/recipe-service/app/tags/schemas.py       |   1 +
     apps/recipe-service/app/tags/service.py       |   1 +
     apps/recipe-service/app/users/__init__.py     |   0
     apps/recipe-service/app/users/models.py       |   1 +
     apps/recipe-service/app/users/repository.py   |   1 +
     apps/recipe-service/app/users/router.py       |   3 +
     apps/recipe-service/app/users/schemas.py      |   1 +
     apps/recipe-service/app/users/service.py      |   1 +
     apps/recipe-service/pyproject.toml            |   5 +-
     apps/recipe-service/tests/conftest.py         |  49 ++++-
     apps/recipe-service/tests/test_config.py      | 106 +++++++++++
     apps/recipe-service/tests/test_health.py      |  12 +-
     apps/recipe-service/tests/test_structure.py   | 114 ++++++++++++
     apps/recipe-service/uv.lock                   | 251 ++++++++++++++------------
     57 files changed, 776 insertions(+), 144 deletions(-)

`uv.lock` diff omitted below (regenerated for Python 3.13 + new deps).

## Diff

```diff
diff --git a/.gitignore b/.gitignore
index 6cf1ce7..fb92451 100644
--- a/.gitignore
+++ b/.gitignore
@@ -64,6 +64,7 @@ __pycache__/
 # Local data / env
 *.db
 *.sqlite3
+apps/recipe-service/data/
 .env
 .env.*
 !.env.example
diff --git a/apps/recipe-service/.env.example b/apps/recipe-service/.env.example
new file mode 100644
index 0000000..39810c8
--- /dev/null
+++ b/apps/recipe-service/.env.example
@@ -0,0 +1,36 @@
+# Copy to .env (gitignored) for local development. In production, set these as
+# real environment variables on the container instead of using a file.
+
+# dev | production. Defaults to production when unset (the safe choice).
+ENV=dev
+
+# Folder for the SQLite database and uploaded photos (a mounted volume in production).
+DATA_DIR=./data
+
+# Required. Signs session cookies; the app refuses to start without it.
+# Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"
+JWT_SECRET=
+
+# Send the session cookie only over HTTPS. false is allowed only when ENV=dev
+# (for testing from a phone over the LAN).
+COOKIE_SECURE=true
+
+# Comma-separated import engines to enable: ollama, gemini, fake (tests/CI only).
+LLM_PROVIDERS=ollama
+
+# Local Ollama app. Under docker compose use http://host.docker.internal:11434
+OLLAMA_URL=http://localhost:11434
+
+# Gemini (optional backup engine). Leave the key empty to keep it disabled.
+GEMINI_API_KEY=
+GEMINI_MODEL=gemini-3.8-flash
+
+# Imports allowed per day across all users, and the token cap per LLM call.
+IMPORT_DAILY_CAP=50
+LLM_MAX_TOKENS=4096
+
+# The daily import cap resets at midnight in this timezone.
+APP_TIMEZONE=Asia/Jerusalem
+
+# DEBUG | INFO | WARNING | ERROR | CRITICAL
+LOG_LEVEL=INFO
diff --git a/apps/recipe-service/.python-version b/apps/recipe-service/.python-version
index e4fba21..24ee5b1 100644
--- a/apps/recipe-service/.python-version
+++ b/apps/recipe-service/.python-version
@@ -1 +1 @@
-3.12
+3.13
diff --git a/apps/recipe-service/README.md b/apps/recipe-service/README.md
index fac2b6e..d680b75 100644
--- a/apps/recipe-service/README.md
+++ b/apps/recipe-service/README.md
@@ -1,3 +1,36 @@
 # recipe-service
 
-Project description here.
+FastAPI backend for Bite & Board. Python 3.13, managed with `uv`, run through Nx.
+
+## Layout
+
+```text
+app/
+  main.py        # create_app(): config check, error handlers, routers under /api
+  core/          # config, db, security, errors, health, metadata (all models for Alembic)
+  recipes/ tags/ auth/ users/ imports/ photos/
+                 # each: router.py → service.py → repository.py → models.py / schemas.py
+```
+
+Dependencies only point down (router → service → repository → models). A module
+uses another module only through its `service`.
+
+## Configuration
+
+Settings are environment variables, read once by `app/core/config.py`
+(pydantic-settings) and injected with `Depends(get_settings)`.
+
+```bash
+cp .env.example .env   # then set JWT_SECRET
+```
+
+`.env` is gitignored. `.env.example` documents every setting. The app refuses to
+start without `JWT_SECRET`, and `ENV` defaults to `production` when unset.
+
+## Commands
+
+```bash
+npx nx run recipe-service:serve   # http://localhost:8000/api/health
+npx nx run recipe-service:test
+npx nx run recipe-service:lint
+```
diff --git a/apps/recipe-service/app/api/__init__.py b/apps/recipe-service/app/api/__init__.py
deleted file mode 100644
index 33bdeed..0000000
--- a/apps/recipe-service/app/api/__init__.py
+++ /dev/null
@@ -1 +0,0 @@
-"""HTTP API routers."""
diff --git a/apps/recipe-service/app/api/health.py b/apps/recipe-service/app/api/health.py
deleted file mode 100644
index bc7b77f..0000000
--- a/apps/recipe-service/app/api/health.py
+++ /dev/null
@@ -1,8 +0,0 @@
-from fastapi import APIRouter
-
-router = APIRouter(tags=["health"])
-
-
-@router.get("/health")
-def health() -> dict[str, str]:
-    return {"status": "ok"}
diff --git a/apps/recipe-service/app/auth/__init__.py b/apps/recipe-service/app/auth/__init__.py
new file mode 100644
index 0000000..e69de29
diff --git a/apps/recipe-service/app/auth/models.py b/apps/recipe-service/app/auth/models.py
new file mode 100644
index 0000000..797448c
--- /dev/null
+++ b/apps/recipe-service/app/auth/models.py
@@ -0,0 +1 @@
+"""SQLModel tables owned by auth."""
diff --git a/apps/recipe-service/app/auth/repository.py b/apps/recipe-service/app/auth/repository.py
new file mode 100644
index 0000000..e44175f
--- /dev/null
+++ b/apps/recipe-service/app/auth/repository.py
@@ -0,0 +1 @@
+"""Database access for auth; used only by this module's service."""
diff --git a/apps/recipe-service/app/auth/router.py b/apps/recipe-service/app/auth/router.py
new file mode 100644
index 0000000..dcd1996
--- /dev/null
+++ b/apps/recipe-service/app/auth/router.py
@@ -0,0 +1,3 @@
+from fastapi import APIRouter
+
+router = APIRouter(prefix="/auth", tags=["auth"])
diff --git a/apps/recipe-service/app/auth/schemas.py b/apps/recipe-service/app/auth/schemas.py
new file mode 100644
index 0000000..798ac70
--- /dev/null
+++ b/apps/recipe-service/app/auth/schemas.py
@@ -0,0 +1 @@
+"""Pydantic request and response schemas for auth."""
diff --git a/apps/recipe-service/app/auth/service.py b/apps/recipe-service/app/auth/service.py
new file mode 100644
index 0000000..a174801
--- /dev/null
+++ b/apps/recipe-service/app/auth/service.py
@@ -0,0 +1 @@
+"""Business rules for auth; other modules call this layer, never the repository."""
diff --git a/apps/recipe-service/app/core/config.py b/apps/recipe-service/app/core/config.py
new file mode 100644
index 0000000..51996c0
--- /dev/null
+++ b/apps/recipe-service/app/core/config.py
@@ -0,0 +1,92 @@
+from enum import StrEnum
+from functools import lru_cache
+from pathlib import Path
+from typing import Annotated, Literal, Self
+
+from pydantic import (
+    Field,
+    PositiveInt,
+    SecretStr,
+    ValidationError,
+    field_validator,
+    model_validator,
+)
+from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
+
+
+class Environment(StrEnum):
+    DEV = "dev"
+    PRODUCTION = "production"
+
+
+class Settings(BaseSettings):
+    """Every runtime setting, read once from env vars (and `.env` in the cwd)."""
+
+    model_config = SettingsConfigDict(
+        env_file=".env", env_file_encoding="utf-8", extra="ignore"
+    )
+
+    # Defaults to production so a forgotten ENV fails safe (e.g. secure cookies).
+    env: Environment = Environment.PRODUCTION
+    data_dir: Path = Path("./data")
+    jwt_secret: SecretStr
+    cookie_secure: bool = True
+    llm_providers: Annotated[list[str], NoDecode] = Field(
+        default_factory=lambda: ["ollama"]
+    )
+    ollama_url: str = "http://localhost:11434"
+    gemini_api_key: SecretStr | None = None
+    gemini_model: str = "gemini-3.8-flash"
+    import_daily_cap: PositiveInt = 50
+    llm_max_tokens: PositiveInt = 4096
+    app_timezone: str = "Asia/Jerusalem"
+    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
+
+    @field_validator("jwt_secret")
+    @classmethod
+    def _secret_not_blank(cls, value: SecretStr) -> SecretStr:
+        if not value.get_secret_value().strip():
+            raise ValueError("must not be empty")
+        return value
+
+    @field_validator("llm_providers", mode="before")
+    @classmethod
+    def _split_providers(cls, value: object) -> object:
+        if isinstance(value, str):
+            return [name.strip() for name in value.split(",") if name.strip()]
+        return value
+
+    @field_validator("gemini_api_key", mode="before")
+    @classmethod
+    def _blank_key_is_none(cls, value: object) -> object:
+        return None if isinstance(value, str) and not value.strip() else value
+
+    @model_validator(mode="after")
+    def _insecure_cookie_only_in_dev(self) -> Self:
+        if not self.cookie_secure and self.env is not Environment.DEV:
+            raise ValueError("COOKIE_SECURE=false is only allowed when ENV=dev")
+        return self
+
+
+def _describe(error: ValidationError) -> str:
+    lines = []
+    for item in error.errors(include_input=False, include_url=False):
+        field = ".".join(str(part) for part in item["loc"]).upper() or "config"
+        lines.append(f"  - {field}: {item['msg']}")
+    return "\n".join(
+        ["Invalid configuration:", *lines, "See .env.example for every setting."]
+    )
+
+
+def load_settings() -> Settings:
+    """Build Settings, turning validation errors into a readable startup failure."""
+    try:
+        return Settings()  # type: ignore[call-arg]  # values come from env
+    except ValidationError as error:
+        raise SystemExit(_describe(error)) from None
+
+
+@lru_cache
+def get_settings() -> Settings:
+    """Cached settings, injectable with `Depends(get_settings)`."""
+    return load_settings()
diff --git a/apps/recipe-service/app/core/db.py b/apps/recipe-service/app/core/db.py
new file mode 100644
index 0000000..2795536
--- /dev/null
+++ b/apps/recipe-service/app/core/db.py
@@ -0,0 +1,31 @@
+from collections.abc import Iterator
+from functools import lru_cache
+from pathlib import Path
+from typing import Annotated
+
+from fastapi import Depends
+from sqlalchemy import Engine
+from sqlmodel import Session, create_engine
+
+from app.core.config import Settings, get_settings
+
+DB_FILENAME = "app.db"
+
+
+@lru_cache
+def get_engine(data_dir: Path) -> Engine:
+    """One engine per data dir, so overridden settings get their own database."""
+    data_dir.mkdir(parents=True, exist_ok=True)
+    # FastAPI runs sync endpoints in a thread pool, so one connection may hop threads.
+    return create_engine(
+        f"sqlite:///{data_dir / DB_FILENAME}",
+        connect_args={"check_same_thread": False},
+    )
+
+
+def get_session(
+    settings: Annotated[Settings, Depends(get_settings)],
+) -> Iterator[Session]:
+    """One session per request, injectable with `Depends(get_session)`."""
+    with Session(get_engine(settings.data_dir)) as session:
+        yield session
diff --git a/apps/recipe-service/app/core/errors.py b/apps/recipe-service/app/core/errors.py
new file mode 100644
index 0000000..49aabe8
--- /dev/null
+++ b/apps/recipe-service/app/core/errors.py
@@ -0,0 +1,43 @@
+from enum import StrEnum
+
+from fastapi import FastAPI, Request
+from fastapi.responses import JSONResponse
+from pydantic import BaseModel
+
+
+class ErrorCode(StrEnum):
+    """Stable error codes; the client shows `errors.<code>` from he.json."""
+
+
+class ErrorResponse(BaseModel):
+    detail: str
+    code: ErrorCode
+    params: dict[str, str | int] | None = None
+
+
+class AppError(Exception):
+    """Raise from a service to return a non-422 error with a stable code."""
+
+    def __init__(
+        self,
+        status_code: int,
+        code: ErrorCode,
+        detail: str,
+        params: dict[str, str | int] | None = None,
+    ) -> None:
+        super().__init__(detail)
+        self.status_code = status_code
+        self.body = ErrorResponse(detail=detail, code=code, params=params)
+
+
+async def _app_error_handler(_request: Request, exc: Exception) -> JSONResponse:
+    if not isinstance(exc, AppError):
+        raise exc
+    return JSONResponse(
+        status_code=exc.status_code,
+        content=exc.body.model_dump(mode="json", exclude_none=True),
+    )
+
+
+def register_error_handlers(app: FastAPI) -> None:
+    app.add_exception_handler(AppError, _app_error_handler)
diff --git a/apps/recipe-service/app/core/health.py b/apps/recipe-service/app/core/health.py
new file mode 100644
index 0000000..69d466d
--- /dev/null
+++ b/apps/recipe-service/app/core/health.py
@@ -0,0 +1,15 @@
+from typing import Literal
+
+from fastapi import APIRouter
+from pydantic import BaseModel
+
+router = APIRouter(prefix="/health", tags=["health"])
+
+
+class HealthRead(BaseModel):
+    status: Literal["ok"]
+
+
+@router.get("")
+def get_health() -> HealthRead:
+    return HealthRead(status="ok")
diff --git a/apps/recipe-service/app/core/metadata.py b/apps/recipe-service/app/core/metadata.py
new file mode 100644
index 0000000..a005298
--- /dev/null
+++ b/apps/recipe-service/app/core/metadata.py
@@ -0,0 +1,21 @@
+"""Single metadata object for Alembic; importing it registers every module's tables."""
+
+from sqlmodel import SQLModel
+
+from app.auth import models as auth_models
+from app.imports import models as imports_models
+from app.photos import models as photos_models
+from app.recipes import models as recipes_models
+from app.tags import models as tags_models
+from app.users import models as users_models
+
+MODEL_MODULES = (
+    auth_models,
+    imports_models,
+    photos_models,
+    recipes_models,
+    tags_models,
+    users_models,
+)
+
+metadata = SQLModel.metadata
diff --git a/apps/recipe-service/app/core/security.py b/apps/recipe-service/app/core/security.py
new file mode 100644
index 0000000..8790beb
--- /dev/null
+++ b/apps/recipe-service/app/core/security.py
@@ -0,0 +1 @@
+"""Session and role guards (`require_role`) shared by every protected route."""
diff --git a/apps/recipe-service/app/db/__init__.py b/apps/recipe-service/app/db/__init__.py
deleted file mode 100644
index b098414..0000000
--- a/apps/recipe-service/app/db/__init__.py
+++ /dev/null
@@ -1 +0,0 @@
-"""Database engine, sessions and migrations support."""
diff --git a/apps/recipe-service/app/imports/__init__.py b/apps/recipe-service/app/imports/__init__.py
new file mode 100644
index 0000000..e69de29
diff --git a/apps/recipe-service/app/imports/models.py b/apps/recipe-service/app/imports/models.py
new file mode 100644
index 0000000..0d231e5
--- /dev/null
+++ b/apps/recipe-service/app/imports/models.py
@@ -0,0 +1 @@
+"""SQLModel tables owned by imports."""
diff --git a/apps/recipe-service/app/imports/repository.py b/apps/recipe-service/app/imports/repository.py
new file mode 100644
index 0000000..d67235d
--- /dev/null
+++ b/apps/recipe-service/app/imports/repository.py
@@ -0,0 +1 @@
+"""Database access for imports; used only by this module's service."""
diff --git a/apps/recipe-service/app/imports/router.py b/apps/recipe-service/app/imports/router.py
new file mode 100644
index 0000000..7814531
--- /dev/null
+++ b/apps/recipe-service/app/imports/router.py
@@ -0,0 +1,3 @@
+from fastapi import APIRouter
+
+router = APIRouter(prefix="/imports", tags=["imports"])
diff --git a/apps/recipe-service/app/imports/schemas.py b/apps/recipe-service/app/imports/schemas.py
new file mode 100644
index 0000000..63f7a61
--- /dev/null
+++ b/apps/recipe-service/app/imports/schemas.py
@@ -0,0 +1 @@
+"""Pydantic request and response schemas for imports."""
diff --git a/apps/recipe-service/app/imports/service.py b/apps/recipe-service/app/imports/service.py
new file mode 100644
index 0000000..ff26845
--- /dev/null
+++ b/apps/recipe-service/app/imports/service.py
@@ -0,0 +1 @@
+"""Business rules for imports; other modules call this layer, never the repository."""
diff --git a/apps/recipe-service/app/main.py b/apps/recipe-service/app/main.py
index e79465b..3d078f5 100644
--- a/apps/recipe-service/app/main.py
+++ b/apps/recipe-service/app/main.py
@@ -1,6 +1,51 @@
-from fastapi import FastAPI
+from fastapi import APIRouter, FastAPI
+from fastapi.routing import APIRoute
 
-from app.api.health import router as health_router
+from app.auth.router import router as auth_router
+from app.core.config import get_settings
+from app.core.errors import register_error_handlers
+from app.core.health import router as health_router
+from app.imports.router import router as imports_router
+from app.photos.router import router as photos_router
+from app.recipes.router import router as recipes_router
+from app.tags.router import router as tags_router
+from app.users.router import router as users_router
 
-app = FastAPI(title="Bite & Board Recipe Service")
-app.include_router(health_router)
+API_PREFIX = "/api"
+
+ROUTERS = (
+    health_router,
+    auth_router,
+    imports_router,
+    photos_router,
+    recipes_router,
+    tags_router,
+    users_router,
+)
+
+
+def generate_operation_id(route: APIRoute) -> str:
+    """`{tag}_{function}` keeps the generated client's hook names stable."""
+    if not route.tags:
+        raise RuntimeError(f"Route {route.path} has no tag; every router needs tags")
+    return f"{route.tags[0]}_{route.name}"
+
+
+def create_app() -> FastAPI:
+    # Validate config before anything is served, so a bad env fails at startup.
+    get_settings()
+
+    app = FastAPI(
+        title="Bite & Board Recipe Service",
+        generate_unique_id_function=generate_operation_id,
+    )
+    register_error_handlers(app)
+
+    api = APIRouter(prefix=API_PREFIX)
+    for router in ROUTERS:
+        api.include_router(router)
+    app.include_router(api)
+    return app
+
+
+app = create_app()
diff --git a/apps/recipe-service/app/models/__init__.py b/apps/recipe-service/app/models/__init__.py
deleted file mode 100644
index cc78148..0000000
--- a/apps/recipe-service/app/models/__init__.py
+++ /dev/null
@@ -1 +0,0 @@
-"""SQLModel entities and Pydantic schemas."""
diff --git a/apps/recipe-service/app/photos/__init__.py b/apps/recipe-service/app/photos/__init__.py
new file mode 100644
index 0000000..e69de29
diff --git a/apps/recipe-service/app/photos/models.py b/apps/recipe-service/app/photos/models.py
new file mode 100644
index 0000000..d2f5147
--- /dev/null
+++ b/apps/recipe-service/app/photos/models.py
@@ -0,0 +1 @@
+"""SQLModel tables owned by photos."""
diff --git a/apps/recipe-service/app/photos/repository.py b/apps/recipe-service/app/photos/repository.py
new file mode 100644
index 0000000..b5439ef
--- /dev/null
+++ b/apps/recipe-service/app/photos/repository.py
@@ -0,0 +1 @@
+"""Database access for photos; used only by this module's service."""
diff --git a/apps/recipe-service/app/photos/router.py b/apps/recipe-service/app/photos/router.py
new file mode 100644
index 0000000..3b3f42e
--- /dev/null
+++ b/apps/recipe-service/app/photos/router.py
@@ -0,0 +1,3 @@
+from fastapi import APIRouter
+
+router = APIRouter(prefix="/photos", tags=["photos"])
diff --git a/apps/recipe-service/app/photos/schemas.py b/apps/recipe-service/app/photos/schemas.py
new file mode 100644
index 0000000..f5d541e
--- /dev/null
+++ b/apps/recipe-service/app/photos/schemas.py
@@ -0,0 +1 @@
+"""Pydantic request and response schemas for photos."""
diff --git a/apps/recipe-service/app/photos/service.py b/apps/recipe-service/app/photos/service.py
new file mode 100644
index 0000000..ba4962b
--- /dev/null
+++ b/apps/recipe-service/app/photos/service.py
@@ -0,0 +1 @@
+"""Business rules for photos; other modules call this layer, never the repository."""
diff --git a/apps/recipe-service/app/recipes/__init__.py b/apps/recipe-service/app/recipes/__init__.py
new file mode 100644
index 0000000..e69de29
diff --git a/apps/recipe-service/app/recipes/models.py b/apps/recipe-service/app/recipes/models.py
new file mode 100644
index 0000000..da5bbd2
--- /dev/null
+++ b/apps/recipe-service/app/recipes/models.py
@@ -0,0 +1 @@
+"""SQLModel tables owned by recipes."""
diff --git a/apps/recipe-service/app/recipes/repository.py b/apps/recipe-service/app/recipes/repository.py
new file mode 100644
index 0000000..84ea348
--- /dev/null
+++ b/apps/recipe-service/app/recipes/repository.py
@@ -0,0 +1 @@
+"""Database access for recipes; used only by this module's service."""
diff --git a/apps/recipe-service/app/recipes/router.py b/apps/recipe-service/app/recipes/router.py
new file mode 100644
index 0000000..bf7f30a
--- /dev/null
+++ b/apps/recipe-service/app/recipes/router.py
@@ -0,0 +1,3 @@
+from fastapi import APIRouter
+
+router = APIRouter(prefix="/recipes", tags=["recipes"])
diff --git a/apps/recipe-service/app/recipes/schemas.py b/apps/recipe-service/app/recipes/schemas.py
new file mode 100644
index 0000000..2c55b72
--- /dev/null
+++ b/apps/recipe-service/app/recipes/schemas.py
@@ -0,0 +1 @@
+"""Pydantic request and response schemas for recipes."""
diff --git a/apps/recipe-service/app/recipes/service.py b/apps/recipe-service/app/recipes/service.py
new file mode 100644
index 0000000..c509497
--- /dev/null
+++ b/apps/recipe-service/app/recipes/service.py
@@ -0,0 +1 @@
+"""Business rules for recipes; other modules call this layer, never the repository."""
diff --git a/apps/recipe-service/app/tags/__init__.py b/apps/recipe-service/app/tags/__init__.py
new file mode 100644
index 0000000..e69de29
diff --git a/apps/recipe-service/app/tags/models.py b/apps/recipe-service/app/tags/models.py
new file mode 100644
index 0000000..304e6e0
--- /dev/null
+++ b/apps/recipe-service/app/tags/models.py
@@ -0,0 +1 @@
+"""SQLModel tables owned by tags."""
diff --git a/apps/recipe-service/app/tags/repository.py b/apps/recipe-service/app/tags/repository.py
new file mode 100644
index 0000000..e993749
--- /dev/null
+++ b/apps/recipe-service/app/tags/repository.py
@@ -0,0 +1 @@
+"""Database access for tags; used only by this module's service."""
diff --git a/apps/recipe-service/app/tags/router.py b/apps/recipe-service/app/tags/router.py
new file mode 100644
index 0000000..7cea114
--- /dev/null
+++ b/apps/recipe-service/app/tags/router.py
@@ -0,0 +1,3 @@
+from fastapi import APIRouter
+
+router = APIRouter(prefix="/tags", tags=["tags"])
diff --git a/apps/recipe-service/app/tags/schemas.py b/apps/recipe-service/app/tags/schemas.py
new file mode 100644
index 0000000..07ac2cc
--- /dev/null
+++ b/apps/recipe-service/app/tags/schemas.py
@@ -0,0 +1 @@
+"""Pydantic request and response schemas for tags."""
diff --git a/apps/recipe-service/app/tags/service.py b/apps/recipe-service/app/tags/service.py
new file mode 100644
index 0000000..cc4e852
--- /dev/null
+++ b/apps/recipe-service/app/tags/service.py
@@ -0,0 +1 @@
+"""Business rules for tags; other modules call this layer, never the repository."""
diff --git a/apps/recipe-service/app/users/__init__.py b/apps/recipe-service/app/users/__init__.py
new file mode 100644
index 0000000..e69de29
diff --git a/apps/recipe-service/app/users/models.py b/apps/recipe-service/app/users/models.py
new file mode 100644
index 0000000..abcffbd
--- /dev/null
+++ b/apps/recipe-service/app/users/models.py
@@ -0,0 +1 @@
+"""SQLModel tables owned by users."""
diff --git a/apps/recipe-service/app/users/repository.py b/apps/recipe-service/app/users/repository.py
new file mode 100644
index 0000000..bd60c00
--- /dev/null
+++ b/apps/recipe-service/app/users/repository.py
@@ -0,0 +1 @@
+"""Database access for users; used only by this module's service."""
diff --git a/apps/recipe-service/app/users/router.py b/apps/recipe-service/app/users/router.py
new file mode 100644
index 0000000..21d3b00
--- /dev/null
+++ b/apps/recipe-service/app/users/router.py
@@ -0,0 +1,3 @@
+from fastapi import APIRouter
+
+router = APIRouter(prefix="/users", tags=["users"])
diff --git a/apps/recipe-service/app/users/schemas.py b/apps/recipe-service/app/users/schemas.py
new file mode 100644
index 0000000..949d4a7
--- /dev/null
+++ b/apps/recipe-service/app/users/schemas.py
@@ -0,0 +1 @@
+"""Pydantic request and response schemas for users."""
diff --git a/apps/recipe-service/app/users/service.py b/apps/recipe-service/app/users/service.py
new file mode 100644
index 0000000..f778336
--- /dev/null
+++ b/apps/recipe-service/app/users/service.py
@@ -0,0 +1 @@
+"""Business rules for users; other modules call this layer, never the repository."""
diff --git a/apps/recipe-service/pyproject.toml b/apps/recipe-service/pyproject.toml
index c1e1b9e..17165a2 100644
--- a/apps/recipe-service/pyproject.toml
+++ b/apps/recipe-service/pyproject.toml
@@ -19,12 +19,14 @@ addopts = """
 name = "recipe-service"
 version = "1.0.0"
 description = "Bite & Board core FastAPI backend"
-requires-python = ">=3.12,<3.13"
+requires-python = ">=3.13,<3.14"
 readme = 'README.md'
 dependencies = [
     "alembic>=1.20.1",
     "fastapi>=0.162.0",
+    "httpx>=0.28.1",
     "pydantic>=2",
+    "pydantic-settings>=2.16.1",
     "sqlmodel>=0.0.48",
     "uvicorn[standard]>=0.54.0",
 ]
@@ -43,7 +45,6 @@ dev = [
   "pytest-sugar>=1.0.0",
   "pytest-cov>=6.0.0",
   "pytest-html>=4.1.1",
-  "httpx>=0.28.1",
 ]
 
 [build-system]
diff --git a/apps/recipe-service/tests/conftest.py b/apps/recipe-service/tests/conftest.py
index 214dd76..3009571 100644
--- a/apps/recipe-service/tests/conftest.py
+++ b/apps/recipe-service/tests/conftest.py
@@ -1 +1,48 @@
-"""Unit tests configuration module."""
+import os
+from collections.abc import Iterator
+from pathlib import Path
+
+import pytest
+from fastapi import FastAPI
+from fastapi.testclient import TestClient
+
+# Set before any `app` import: importing app.main validates config immediately.
+os.environ["JWT_SECRET"] = "test-secret"
+os.environ["ENV"] = "dev"
+
+from app.core.config import Settings, get_settings  # noqa: E402
+from app.core.db import get_engine  # noqa: E402
+from app.main import create_app  # noqa: E402
+
+
+@pytest.fixture(autouse=True)
+def isolated_settings(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> Iterator[None]:
+    """Run each test away from any developer `.env`, with fresh cached settings.
+
+    Nx loads the project's `.env` into the task environment, so clearing the cwd
+    alone is not enough: every setting's env var is removed too.
+    """
+    monkeypatch.chdir(tmp_path)
+    for name in Settings.model_fields:
+        monkeypatch.delenv(name.upper(), raising=False)
+    monkeypatch.setenv("JWT_SECRET", "test-secret")
+    monkeypatch.setenv("ENV", "dev")
+    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
+    get_settings.cache_clear()
+    yield
+    get_settings.cache_clear()
+    # Close pooled SQLite handles so Windows can delete tmp_path afterwards.
+    get_engine(tmp_path / "data").dispose()
+    get_engine.cache_clear()
+
+
+@pytest.fixture
+def app() -> FastAPI:
+    return create_app()
+
+
+@pytest.fixture
+def client(app: FastAPI) -> TestClient:
+    return TestClient(app)
diff --git a/apps/recipe-service/tests/test_config.py b/apps/recipe-service/tests/test_config.py
new file mode 100644
index 0000000..6f45c17
--- /dev/null
+++ b/apps/recipe-service/tests/test_config.py
@@ -0,0 +1,106 @@
+import os
+import subprocess
+import sys
+from pathlib import Path
+
+import pytest
+
+from app.core.config import Environment, Settings, get_settings, load_settings
+
+SERVICE_ROOT = Path(__file__).resolve().parents[1]
+
+
+def test_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
+    monkeypatch.delenv("ENV")
+    monkeypatch.delenv("DATA_DIR")
+    settings = load_settings()
+    assert settings.env is Environment.PRODUCTION
+    assert settings.data_dir == Path("./data")
+    assert settings.cookie_secure is True
+    assert settings.llm_providers == ["ollama"]
+    assert settings.ollama_url == "http://localhost:11434"
+    assert settings.gemini_api_key is None
+    assert settings.gemini_model == "gemini-3.8-flash"
+    assert settings.import_daily_cap == 50
+    assert settings.llm_max_tokens == 4096
+    assert settings.app_timezone == "Asia/Jerusalem"
+    assert settings.log_level == "INFO"
+
+
+def test_reads_env_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
+    monkeypatch.delenv("JWT_SECRET")
+    (tmp_path / ".env").write_text(
+        "JWT_SECRET=from-file\nLLM_PROVIDERS=ollama, gemini\nGEMINI_API_KEY=\n",
+        encoding="utf-8",
+    )
+    settings = load_settings()
+    assert settings.jwt_secret.get_secret_value() == "from-file"
+    assert settings.llm_providers == ["ollama", "gemini"]
+    assert settings.gemini_api_key is None
+
+
+def test_env_vars_override_env_file(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    (tmp_path / ".env").write_text("JWT_SECRET=from-file\n", encoding="utf-8")
+    assert load_settings().jwt_secret.get_secret_value() == "test-secret"
+
+
+@pytest.mark.parametrize("value", [None, "", "   "])
+def test_missing_or_blank_jwt_secret_fails_fast(
+    value: str | None, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    if value is None:
+        monkeypatch.delenv("JWT_SECRET")
+    else:
+        monkeypatch.setenv("JWT_SECRET", value)
+    with pytest.raises(SystemExit) as exc_info:
+        load_settings()
+    message = str(exc_info.value)
+    assert "JWT_SECRET" in message
+    assert ".env.example" in message
+
+
+def test_secret_never_appears_in_error(monkeypatch: pytest.MonkeyPatch) -> None:
+    monkeypatch.setenv("JWT_SECRET", "super-secret-value")
+    monkeypatch.setenv("IMPORT_DAILY_CAP", "0")
+    with pytest.raises(SystemExit) as exc_info:
+        load_settings()
+    assert "IMPORT_DAILY_CAP" in str(exc_info.value)
+    assert "super-secret-value" not in str(exc_info.value)
+
+
+def test_insecure_cookie_refused_outside_dev(monkeypatch: pytest.MonkeyPatch) -> None:
+    monkeypatch.setenv("ENV", "production")
+    monkeypatch.setenv("COOKIE_SECURE", "false")
+    with pytest.raises(SystemExit) as exc_info:
+        load_settings()
+    message = str(exc_info.value)
+    assert "COOKIE_SECURE" in message
+    assert "ENV" in message
+
+
+def test_insecure_cookie_allowed_in_dev(monkeypatch: pytest.MonkeyPatch) -> None:
+    monkeypatch.setenv("COOKIE_SECURE", "false")
+    assert load_settings().cookie_secure is False
+
+
+def test_get_settings_is_cached() -> None:
+    assert get_settings() is get_settings()
+    assert isinstance(get_settings(), Settings)
+
+
+def test_app_refuses_to_start_without_jwt_secret(tmp_path: Path) -> None:
+    env = {k: v for k, v in os.environ.items() if k != "JWT_SECRET"}
+    env["PYTHONPATH"] = str(SERVICE_ROOT)
+    result = subprocess.run(
+        [sys.executable, "-c", "import app.main"],
+        cwd=tmp_path,
+        env=env,
+        capture_output=True,
+        text=True,
+        timeout=60,
+    )
+    assert result.returncode != 0
+    assert "JWT_SECRET" in result.stderr
+    assert ".env.example" in result.stderr
diff --git a/apps/recipe-service/tests/test_health.py b/apps/recipe-service/tests/test_health.py
index 010f2bf..74a3fe9 100644
--- a/apps/recipe-service/tests/test_health.py
+++ b/apps/recipe-service/tests/test_health.py
@@ -1,11 +1,11 @@
 from fastapi.testclient import TestClient
 
-from app.main import app
 
-client = TestClient(app)
-
-
-def test_health() -> None:
-    response = client.get("/health")
+def test_health_returns_ok(client: TestClient) -> None:
+    response = client.get("/api/health")
     assert response.status_code == 200
     assert response.json() == {"status": "ok"}
+
+
+def test_old_health_route_is_gone(client: TestClient) -> None:
+    assert client.get("/health").status_code == 404
diff --git a/apps/recipe-service/tests/test_structure.py b/apps/recipe-service/tests/test_structure.py
new file mode 100644
index 0000000..dedf1bb
--- /dev/null
+++ b/apps/recipe-service/tests/test_structure.py
@@ -0,0 +1,114 @@
+import importlib
+import re
+from pathlib import Path
+
+import pytest
+from fastapi import APIRouter, FastAPI
+from fastapi.testclient import TestClient
+from sqlmodel import Session
+
+from app.core import metadata
+from app.core.config import get_settings
+from app.core.db import DB_FILENAME, get_engine, get_session
+from app.core.errors import AppError, ErrorCode
+from app.main import API_PREFIX, ROUTERS, create_app
+
+APP_DIR = Path(__file__).resolve().parents[1] / "app"
+FEATURE_MODULES = ("recipes", "tags", "auth", "users", "imports", "photos")
+LAYER_FILES = ("router.py", "service.py", "repository.py", "models.py", "schemas.py")
+OPERATION_ID = re.compile(r"^[a-z]+_[a-z]+(_[a-z]+)*$")
+
+
+@pytest.mark.parametrize("module", FEATURE_MODULES)
+def test_feature_module_has_every_layer(module: str) -> None:
+    for filename in LAYER_FILES:
+        assert (APP_DIR / module / filename).is_file(), f"{module}/{filename}"
+
+
+@pytest.mark.parametrize("module", FEATURE_MODULES)
+def test_feature_router_is_tagged_and_mounted(module: str) -> None:
+    router = importlib.import_module(f"app.{module}.router").router
+    assert isinstance(router, APIRouter)
+    assert router.tags == [module]
+    assert router.prefix == f"/{module}"
+    assert router in ROUTERS
+
+
+def test_layer_first_packages_are_gone() -> None:
+    for old in ("api", "db", "models"):
+        assert not (APP_DIR / old).exists()
+
+
+def test_metadata_imports_every_module_models() -> None:
+    imported = {module.__name__ for module in metadata.MODEL_MODULES}
+    assert imported == {f"app.{name}.models" for name in FEATURE_MODULES}
+
+
+def test_operation_ids_follow_tag_function(app: FastAPI) -> None:
+    operation_ids = [
+        operation["operationId"]
+        for path in app.openapi()["paths"].values()
+        for operation in path.values()
+    ]
+    assert "health_get_health" in operation_ids
+    assert len(operation_ids) == len(set(operation_ids))
+    assert all(OPERATION_ID.match(op) for op in operation_ids), operation_ids
+
+
+def test_every_route_is_under_api(app: FastAPI) -> None:
+    paths = app.openapi()["paths"]
+    assert paths
+    assert all(path.startswith(f"{API_PREFIX}/") for path in paths)
+
+
+class SampleCode(ErrorCode):
+    SAMPLE = "sample"
+
+
+@pytest.mark.parametrize(
+    ("params", "expected"),
+    [
+        (
+            {"count": 2},
+            {"detail": "Conflict", "code": "sample", "params": {"count": 2}},
+        ),
+        (None, {"detail": "Conflict", "code": "sample"}),
+    ],
+)
+def test_app_error_returns_code_shape(
+    app: FastAPI, params: dict[str, str | int] | None, expected: dict[str, object]
+) -> None:
+    @app.get("/boom", tags=["test"])
+    def get_boom() -> None:
+        raise AppError(409, SampleCode.SAMPLE, "Conflict", params=params)
+
+    response = TestClient(app).get("/boom")
+    assert response.status_code == 409
+    assert response.json() == expected
+
+
+def test_untagged_route_is_rejected_with_clear_message() -> None:
+    app = create_app()
+    with pytest.raises(RuntimeError, match="/untagged has no tag"):
+
+        @app.get("/untagged")
+        def get_untagged() -> None:
+            return None
+
+
+def test_session_uses_sqlite_in_data_dir(tmp_path: Path) -> None:
+    sessions = get_session(get_settings())
+    session = next(sessions)
+    assert isinstance(session, Session)
+    assert session.get_bind().url.database == str(tmp_path / "data" / DB_FILENAME)
+    assert (tmp_path / "data").is_dir()
+    sessions.close()
+
+
+def test_session_follows_overridden_settings(tmp_path: Path) -> None:
+    other = get_settings().model_copy(update={"data_dir": tmp_path / "other"})
+    sessions = get_session(other)
+    session = next(sessions)
+    assert session.get_bind().url.database == str(tmp_path / "other" / DB_FILENAME)
+    sessions.close()
+    get_engine(tmp_path / "other").dispose()
```
