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

## Sessions and login

`POST /api/auth/login` sets a signed JWT (`HS256`, 7 days) in an `httpOnly; SameSite=Lax`
cookie named `session`; `Secure` follows `COOKIE_SECURE`. The token only holds the user
id, so the role and the blocked flag are read from the database on every request.
`GET /api/auth/session` is public and always returns 200 (`user: null` for a visitor).
`POST /api/auth/logout` clears the cookie.

Login is limited to 5 attempts a minute per client IP (slowapi, in memory, so a restart
clears it). Behind a reverse proxy the app sees the proxy's address, so every user would
share one bucket. In production start uvicorn with `--proxy-headers` and
`--forwarded-allow-ips` set to the proxy's address only (not `*`, or the header can be
spoofed to dodge the limit). That is set up with the container in Story 6.1.

## Guarding routes (AD-6, AD-30)

Protect a route with a dependency, like a Nest `@Roles()` guard:

```python
user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))]  # or "admin"
```

No session gives 401 `unauthorized`; a lower role gives 403 `forbidden`; an admin passes
every editor check. The user comes from the database on each request, so a demotion or a
block works at once (a blocked or deleted user is a 401).

`app.core` may not import `auth`, so `get_session_user` in `app/core/security.py` is a stub
that `create_app()` answers with `auth.service.get_current_user` through
`dependency_overrides`. The CSRF check is a dependency on the whole app: any request that
is not GET, HEAD or OPTIONS needs `X-Requested-With: bite-and-board`, or it gets 403
`csrf_header_missing` before any role check. Tests use the `client` fixture (sends the
header, like the SPA) and `bare_client` (does not).

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

SQLite changes a table by copying it and dropping the old one. With foreign keys on,
dropping a parent such as `recipe` would delete its ingredients, steps and tag links, so
migrations run through `migration_transaction` (`app/core/migrate.py`): enforcement is
off while they run, `PRAGMA foreign_key_check` must come back empty before the commit, and
enforcement is always switched back on. Both the app and `alembic upgrade` use it.

## Accounts

There is no sign-up. The first admin comes from the command line (AD-30), in an
interactive terminal:

```bash
npx nx run recipe-service:create-admin -- --email you@example.com --name "Your Name"
```

It migrates the database if needed, asks for the password twice (hidden, 8 to 128
characters) and stores only its Argon2id hash. The password is never an argument, never
printed and never logged. If the email already exists it fails; with `--reset-password`
(no `--name` needed) it instead changes only that user's password. Emails are unique
ignoring case. It needs a real console: without one the password prompt cannot read input.

## Demo data

`npx nx run recipe-service:seed` (`python -m app.cli seed`) migrates the database, then
creates about 10 Hebrew demo recipes through `recipes.service`. It is idempotent by title
and never creates the default tags. Needs a `.env` (see Configuration).

## Commands

```bash
npx nx run recipe-service:serve   # http://localhost:8000/api/health
npx nx run recipe-service:test
npx nx run recipe-service:seed    # demo recipes
npx nx run recipe-service:create-admin -- --email … --name …   # first admin
npx nx run recipe-service:lint
npx nx run recipe-service:openapi   # writes libs/data-access/openapi.json (use data-access:generate for the client)
```
