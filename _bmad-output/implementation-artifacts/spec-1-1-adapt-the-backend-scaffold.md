---
title: 'Story 1.1: Adapt the backend scaffold'
type: 'refactor'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'c0523778cb8536d0410167f9aecdeeee66454908'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent â€” do not modify unless human renegotiates">

## Intent

**Problem:** `apps/recipe-service` is a layer-first scaffold (`app/{api,db,models}`, `/health`, Python 3.12, no config) that does not match the architecture spine, so every later backend story would land in the wrong place.

**Approach:** Reshape it into the AD-1 feature-module layout (`app/core` + six empty feature packages wired under `/api`), move health to `/api/health`, upgrade to Python 3.13, and add pydantic-settings config that fails fast without `JWT_SECRET` (AD-29), with `.env.example` documenting every setting.

## Boundaries & Constraints

**Always:**
- Layers point down only: router â†’ service â†’ repository â†’ models/schemas. Routers hold no logic.
- Every router declares `tags=[<module>]`; route functions are `verb_noun`; operation IDs are `{tag}_{function}` via `generate_unique_id_function`.
- Config is read only through `app/core/config`; no `os.environ` reads elsewhere.
- `COOKIE_SECURE=false` is accepted only when `ENV=dev` (AD-21).
- Code comments explain why, never story/epic references.

**Never:**
- No DB tables, Alembic setup, PRAGMA/WAL, CLI, auth logic, logging setup or mypy/import-linter â€” later stories (1.3, 1.5, 2.x, 6.2).
- No secrets committed; `.env` stays gitignored.
- No frontend changes (`npm run dev` belongs to Story 1.2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Health | `GET /api/health` | 200 `{"status": "ok"}` | N/A |
| Old route | `GET /health` | 404 | N/A |
| Missing secret | `JWT_SECRET` unset, app imported/started | Process exits non-zero | stderr names `JWT_SECRET` and points to `.env.example` |
| Insecure cookie outside dev | `ENV=production`, `COOKIE_SECURE=false` | Startup refused | Clear message naming both settings |
| Insecure cookie in dev | `ENV=dev`, `COOKIE_SECURE=false` | Starts normally | N/A |

## Decisions (Adi, 2026-10-26)

1. Config access: `get_settings()` cached with `lru_cache`, injected via `Depends(get_settings)`; app built by a `create_app()` factory; tests override settings through `dependency_overrides`.
2. `ENV` defaults to `production`; the local `.env` and `.env.example` set `ENV=dev`.
3. `.env` / `.env.example` live in `apps/recipe-service/` (read from the serve cwd). Settings are backend-only. Defaults: `DATA_DIR=./data`, `COOKIE_SECURE=true`, `LLM_PROVIDERS=ollama` (comma list), `OLLAMA_URL=http://localhost:11434`, `GEMINI_API_KEY` empty, `GEMINI_MODEL=gemini-3.8-flash`, `IMPORT_DAILY_CAP=50`, `LLM_MAX_TOKENS=4096`, `APP_TIMEZONE=Asia/Jerusalem`, `LOG_LEVEL=INFO`.
4. `uv` may download CPython 3.13.

</frozen-after-approval>

## Code Map

- `apps/recipe-service/app/main.py` -- only includes `app.api.health.router`; becomes the app factory wiring all routers under `/api`.
- `apps/recipe-service/app/api/health.py` -- `/health` route; moves to `app/core/health.py` as `get_health` at `/api/health`.
- `apps/recipe-service/app/{api,db,models}/__init__.py` -- docstring-only packages; delete.
- `apps/recipe-service/app/core/__init__.py` -- keep.
- `apps/recipe-service/.python-version`, `pyproject.toml` (`requires-python = ">=3.12,<3.13"`, `httpx` in dev group), `uv.lock` -- bump to 3.13, add `pydantic-settings`, move `httpx` to runtime.
- `apps/recipe-service/project.json` -- `serve` runs `uvicorn app.main:app` with cwd = project root; `test` runs `uv run pytest tests/`; lint = ruff on `app`, `tests`. Keep targets as-is.
- `apps/recipe-service/tests/test_health.py`, `tests/conftest.py` -- update to the new route; conftest provides a test `JWT_SECRET`.
- `.gitignore` -- already ignores `.env`, `.env.*` and keeps `!.env.example`; no change.

## Tasks & Acceptance

**Execution:**
- [x] `apps/recipe-service/.python-version`, `pyproject.toml`, `uv.lock` -- 3.13, `requires-python = ">=3.13,<3.14"`, `uv add pydantic-settings httpx`, drop dev `httpx` -- AC Python/deps.
- [x] `apps/recipe-service/app/core/config.py` -- `Settings` (pydantic-settings, all AD-29 fields, `.env` file), `COOKIE_SECURE`/`ENV` validator, loader that turns a validation error into a clear `SystemExit` -- AD-29 fail fast.
- [x] `apps/recipe-service/app/core/{db,security,errors,health,metadata}.py` -- `db`: SQLModel engine from `DATA_DIR` + `get_session` dependency (no connection at import); `security`: placeholder module; `errors`: `ErrorCode` StrEnum (no members yet), `AppError`, handler returning `{detail, code, params}`; `health`: router `tags=["health"]`; `metadata`: imports every module's `models` and exposes `SQLModel.metadata`.
- [x] `apps/recipe-service/app/{recipes,tags,auth,users,imports,photos}/` -- `__init__.py`, `router.py` (`APIRouter(prefix="/<module>", tags=["<module>"])`), empty `service.py`, `repository.py`, `models.py`, `schemas.py` -- AD-1.
- [x] `apps/recipe-service/app/main.py` -- create app, register error handler, unique-id function, include all routers under `/api`; delete `app/api`, `app/db`, `app/models`.
- [x] `apps/recipe-service/.env.example` + local uncommitted `.env` (dev secret) -- every AD-29 setting with comments.
- [x] `apps/recipe-service/tests/` -- health 200, old `/health` 404, operation-id pattern, settings validation (missing secret, cookie rule), startup without `JWT_SECRET` exits non-zero (subprocess), every module has the five files, error handler shape.
- [x] `apps/recipe-service/README.md` -- layout, how to configure and run.

**Acceptance Criteria:**
- Given the new layout, when `app.core.metadata` is imported, then every feature module's `models` is imported.
- Given a configured `.env`, when `nx run recipe-service:serve` runs, then `/api/health` answers 200.
- Given the repo, when `nx run recipe-service:test` and `:lint` run, then both pass.

## Implementation Notes

- Implemented directly (no implementation subagent).
- CPython 3.13.16 installed via `uv python install 3.13`; `uv add pydantic-settings httpx` (pydantic-settings 2.16.1).
- Field names are lowercase (`jwt_secret`), mapped case-insensitively to env vars (`JWT_SECRET`).
- `llm_providers` uses `NoDecode` + a comma-split validator so `LLM_PROVIDERS=ollama,gemini` works (pydantic-settings would otherwise expect JSON).
- Validation errors are rendered without input values, so a bad config never prints secrets.
- Surprise: Nx loads `apps/recipe-service/.env` into the task environment, so the test fixture removes every setting's env var before each test (cwd isolation alone was not enough).
- `generate_operation_id` raises on an untagged route by design: every router must declare a tag.
- DB engine is created lazily (first `get_session`) and creates `DATA_DIR`; `apps/recipe-service/data/` added to `.gitignore`.
- Local `.env` created with a generated dev `JWT_SECRET` and `ENV=dev` (gitignored, not part of the diff).

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route | Evidence |
|---|--------|---------|---------|-------|----------|
| 1 | verification-gap | `ollama_url`/`gemini_model` defaults untested | low | patch | `test_defaults` skipped both; asserts added. |
| 2 | verification-gap, blind | `AppError` without `params` untested | low | patch | Only case passed params; test parametrized with `None` case. |
| 3 | verification-gap, blind, edge | Comment claims production default "never enables fakes" | low | patch | Nothing enforces it in Settings; comment corrected. The fake-in-production guard belongs to the provider story (AD-23). |
| 4 | verification-gap, edge | `get_engine` ignores `dependency_overrides` of `get_settings` | medium | patch | Engine read `get_settings()` directly; now `get_session` depends on `Depends(get_settings)` and the engine is cached per `data_dir`; test added. |
| 5 | blind, edge, verification-gap | Untagged route raises bare `IndexError` | low | patch | Unique id is computed at route registration; now raises `RuntimeError` naming the route; test added. |
| 6 | blind | Cached engine never disposed (Windows tmp cleanup) | low | patch | Fixture now disposes the engine before clearing the cache. Lifespan dispose deferred to Story 1.5. |
| 7 | blind, edge | `LLM_PROVIDERS` accepts empty/unknown/`fake` in prod; gemini without key | medium (unverified impact) | defer | No consumer exists yet; provider registry story owns validation. |
| 8 | blind, edge | `APP_TIMEZONE` unvalidated; Windows `zoneinfo` needs `tzdata` | medium | defer | No consumer yet; daily-cap story must add `tzdata` and validate. |
| 9 | blind | `JWT_SECRET` has no minimum length | medium | defer | Policy choice for Adi; Story 2.x (auth) is the natural home. |
| 10 | blind | Framework 404/405/`HTTPException` lack `code`; `ErrorResponse` not in OpenAPI | medium | defer | Pre-existing FastAPI behaviour; AD-28 client mapping lands in Story 1.6. |
| 11 | blind, edge | `.env`/`data/` resolve from cwd | false | reject | Decision 3 (Adi) sets cwd-relative `.env`; `uvicorn app.main:app` cannot import from the repo root anyway. |
| 12 | blind | Importing `app.main` builds the app | false | reject | Module-level `app` is the agreed shape (Decision 1); only `create_app()` is reused in tests. |
| 13 | blind | `httpx` moved to runtime without reason | false | reject | Story AC requires runtime `httpx`. |
| 14 | blind, edge | `ENV`/`LOG_LEVEL` case-sensitivity, other `ENV` values untested | low | reject | Invalid values fail fast with a readable message; `.env.example` shows exact values. |
| 15 | edge | Duplicate operation IDs only warn | false | reject | `test_operation_ids_follow_tag_function` asserts uniqueness. |
| 16 | edge | `AppError` accepts 2xx/422 status | low | reject | Unlikely misuse; guard adds complexity. |
| 17 | edge | `DATA_DIR` with `?`/`#`/`%`, or unwritable | low | reject | Unlikely in practice; fix adds complexity. |
| 18 | edge | Lowercase env vars leak into tests on POSIX | low | reject | Unlikely; dev and CI set uppercase names. |
| 19 | blind | Unreachable `isinstance` branch in handler | false | reject | Needed for the handler's `Exception` signature that Starlette types require. |

## Verification

**Commands:**
- `npx nx run recipe-service:test` -- expected: all tests pass
- `npx nx run recipe-service:lint` -- expected: no ruff findings
- `npx nx run recipe-service:serve` then `curl http://localhost:8000/api/health` -- expected: `{"status":"ok"}`
