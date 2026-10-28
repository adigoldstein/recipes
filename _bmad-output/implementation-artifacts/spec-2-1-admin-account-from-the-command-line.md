# Spec: Story 2.1 Admin account from the command line

Source: `planning-artifacts/epics.md` (Story 2.1), ARCHITECTURE-SPINE AD-6, AD-30.
Decisions approved by Adi (via coordinator): email validation with `email-validator`
(1A), hashing and `Role` in `app/core/security.py` (2A), recipe author FKs
`ON DELETE SET NULL` (3A), `AppError` + new `ErrorCode`s (4A). Defaults approved: `getpass` twice,
8-128 characters, `--reset-password` changes only the hash.

## Goal

`nx run recipe-service:create-admin -- --email … --name …` (`python -m app.cli create-admin`)
creates the first admin with an Argon2id-hashed password, on a `user` table made by a migration.
No endpoints, no UI: the OpenAPI spec changes only by four new `ErrorCode` values.

## Design

### Data (migration `0002`)

- `user(id uuid pk, email varchar(254), name varchar(80), role ∈ {editor, admin} (named CHECK),
  password_hash, is_blocked default false, created_at)`; unique index `uq_user_lower_email` on
  `lower(email)` (written by hand: Alembic cannot see SQLite expression indexes).
- `recipe.created_by` / `updated_by` get foreign keys to `user.id`, `ON DELETE SET NULL`.
  `Recipe` declares them with `foreign_key="user.id"` (string, no import of `users`).
- **Data-loss guard.** Adding the FKs makes Alembic rebuild `recipe` (copy, drop, rename). With
  `PRAGMA foreign_keys=ON` the drop cascade-deletes `ingredient`, `step` and `recipe_tag` rows
  (seen in a manual run). `app/core/migrate.py` now exposes `migration_transaction(connection)`:
  foreign keys off (before the transaction, where the pragma works), run, `PRAGMA
  foreign_key_check` must be empty or the migration fails and rolls back, and foreign keys are
  always switched back on. `run_migrations` and `migrations/env.py` (the `alembic` CLI) use it.

### Code

- `core/security.py`: `Role` StrEnum (editor, admin); `hash_password` / `verify_password`
  (pwdlib, Argon2id only; verify is constant-time and treats a non-Argon2 stored value as a
  mismatch instead of raising).
- `users/models.py` `User`; `users/schemas.py` `UserCreate` (`EmailStr`, trimmed; name NFC and
  whitespace-collapsed, 1-80) and `UserRead` (no password field); `users/repository.py`
  `get_by_email` compares `lower(column) = lower(param)` in SQLite so it matches the unique index
  exactly; `users/service.py` `create_user(data, password)`, `reset_password(email, password)`,
  `check_password_policy` (8-128 characters).
- Errors: `email_taken` 409, `user_not_found` 404, `password_too_short` 422 `{min}`,
  `password_too_long` 422 `{max}`; Hebrew strings in `he.json`; client regenerated.
- `cli.py`: `create-admin --email E [--name N] [--reset-password]`. Email and name are validated
  before any prompt. The password is read twice with `getpass` (no argv, no env var), a mismatch
  or cancel exits 1, `AppError`s print `Error: <detail>` and exit 1. Messages never include the
  password. `app.cli` joins the allowed importers of the `users` module protection (as `app.seed`
  does for recipes).
- Nx target `create-admin` (not cached, `PYTHONUTF8=1`).

## Acceptance checks (tests)

- Hashing: Argon2id prefix, plain text absent, different salt each time, verify right/wrong,
  non-ASCII, non-hash values never match.
- Service: hash stored, `UserRead` has no password, case-insensitive duplicate (service and DB
  index), lost insert race becomes `email_taken`, rollback on errors, length limits inclusive,
  `reset_password` changes only the hash, unknown email, same length rules.
- CLI: create, fresh database, no `--password` flag, mismatch, short, long, duplicate (any case,
  nothing changed), reset, reset with unknown email, reset with a short password, missing
  `--name`, bad email/name before any prompt, cancel; plain text never in stdout, stderr or logs.
- Migration: tables, `user` columns, role CHECK, default not blocked, FK declared with
  `SET NULL`, deleting a user clears recipe authors, unknown author rejected, **upgrade from
  `0001` keeps recipes and all children**, FKs back on afterwards (also after failure), a
  migration that breaks an FK is rolled back, models and migrations agree, downgrade works.
- ruff, mypy strict, lint-imports, pytest, `nx format:check`, openapi/client regenerated.

## Not in this story

Login, cookies, JWT, CSRF header, rate limiting (2.2); `require_role` (2.3); `/api/users` (2.4).
`Role` lives in core so 2.3's `require_role` can use it without core importing a feature module.
