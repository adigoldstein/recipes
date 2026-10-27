# recipe-service

FastAPI backend for Bite & Board. Python 3.13, managed with `uv`, run through Nx.

## Layout

```text
app/
  main.py        # create_app(): config check, error handlers, routers under /api
  core/          # config, db, migrate, security, errors, health, metadata (all models for Alembic)
  migrations/    # Alembic revisions, applied on startup (batch mode for SQLite)
  recipes/ tags/ auth/ users/ imports/ photos/
                 # each: router.py → service.py → repository.py → models.py / schemas.py
```

Dependencies only point down (router → service → repository → models). A module
uses another module only through its `service`.

## Configuration

Settings are environment variables, read once by `app/core/config.py`
(pydantic-settings) and injected with `Depends(get_settings)`.

```bash
cp .env.example .env   # then set JWT_SECRET
```

`.env` is gitignored. `.env.example` documents every setting. The app refuses to
start without `JWT_SECRET`, and `ENV` defaults to `production` when unset.

## Database and migrations

SQLite lives in `DATA_DIR/app.db`. Every connection turns on `foreign_keys` and WAL.
The app applies pending migrations when it starts (`app/core/migrate.py`, run from the
FastAPI lifespan); if one fails, startup fails and the process exits non-zero.

Change a model, then generate and **review by hand** a revision (run in `apps/recipe-service`):

```bash
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
```

Revisions must not import app code: they have to run the same way forever. Alembic
cannot see SQLite expression indexes, so write those by hand (see revision `0001`).
Do not edit a revision that has shipped; add a new one.

## Commands

```bash
npx nx run recipe-service:serve   # http://localhost:8000/api/health
npx nx run recipe-service:test
npx nx run recipe-service:lint
npx nx run recipe-service:openapi   # writes libs/data-access/openapi.json (use data-access:generate for the client)
```
