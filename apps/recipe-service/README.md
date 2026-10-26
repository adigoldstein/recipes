# recipe-service

FastAPI backend for Bite & Board. Python 3.13, managed with `uv`, run through Nx.

## Layout

```text
app/
  main.py        # create_app(): config check, error handlers, routers under /api
  core/          # config, db, security, errors, health, metadata (all models for Alembic)
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

## Commands

```bash
npx nx run recipe-service:serve   # http://localhost:8000/api/health
npx nx run recipe-service:test
npx nx run recipe-service:lint
```
