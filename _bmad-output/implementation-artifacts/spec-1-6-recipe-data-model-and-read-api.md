---
title: 'Story 1.6: Recipe data model and read API'
type: 'feature'
created: '2026-10-26'
status: 'review'
route: 'dispatch'
baseline_commit: '3ada053'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/deferred-work.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The backend has empty `recipes` and `tags` modules and no database setup. There is no schema, no migration, no way to read a recipe, and nothing for Story 1.7 to generate a client from.

**Approach:** Add the SQLite engine settings, Alembic (batch mode, run at startup), the tables `recipe`, `ingredient`, `step`, `tag`, `recipe_tag`, a data migration for the 13 default pinned Hebrew tags, and two read endpoints (`GET /api/recipes`, `GET /api/recipes/{id}`) with separate Pydantic DTOs, layered router → service → repository.

## Boundaries & Constraints

**Always:**

- ACs of Story 1.6 in `epics.md` are the contract; AD-1, AD-4, AD-5, AD-18, AD-19, AD-20, AD-24, AD-26, AD-28, AD-31 and AD-33 govern the shape.
- Layering: router → service → repository → models. Routers import no repository or models. `recipes` reaches `tags` only through `tags.service`. `tags` never imports `recipes`. import-linter and mypy strict stay green.
- UUID v4 ids generated server-side. Timestamps UTC, serialized with `Z`.
- API schemas are plain Pydantic, never table classes. Read DTOs: `RecipeSummary`, `RecipeRead`, `IngredientRead`, `StepRead`, `TagRef`, `OriginalValue`, `SourceValue`.
- `amount` is `NUMERIC`, quantized to 3 decimals, serialized as a JSON number (AD-31).
- Every connection: `PRAGMA foreign_keys=ON` and `journal_mode=WAL`. Alembic `render_as_batch=True`. Migration failure at startup exits the app non-zero.
- Recipe text fields: `description` ≤ 500, `notes` ≤ 5,000, both nullable.
- Ingredient `source_amount` / `source_unit` (`SourceUnit`: `oz`, `lb`, `fl_oz`) stay separate from the FR-7 `original_*` fields. Step `source_text` is nullable.
- Errors: unknown id → 404 `{detail, code: "recipe_not_found"}` through `AppError`; `ErrorResponse` is declared on the route so `ErrorCode` is published in OpenAPI.
- Operation IDs `{tag}_{function}`, still enforced by `test_structure.py`.
- Tests run on a temporary SQLite database migrated with `alembic upgrade head`.
- The data migration is self-contained (no app imports), with the 13 pinned tags and fixed UUID v4 literals.

**Never:**

- No commit or push before Adi approves the review file.
- No write endpoints, no tag endpoints, no seed command, no auth (Stories 3.x, 4.x, 1.8, Epic 2).
- No FK from `created_by`/`updated_by` to `user` (Story 2.1).
- No hand-edited generated client; no change to `libs/*` or `apps/web`.
- Never run prettier on `_bmad-output/planning-artifacts`.

</frozen-after-approval>

## Plan (done)

1. **DB core** (`app/core/db.py`): connect-event listener for `foreign_keys=ON` and WAL; `UtcDateTime` and `Quantity` column types; engine disposal in a FastAPI lifespan (closes the 1.1 deferred item).
2. **Alembic**: config + `env.py` (batch mode, metadata from `app/core/metadata.py`), a `run_migrations()` called from the lifespan (failure raises, so uvicorn exits non-zero), revision 1 with the five tables and the pinned-tag data migration.
3. **Models**: `recipes/models.py` (`Recipe`, `Ingredient`, `Step`), `tags/models.py` (`Tag`, `RecipeTag`); `Unit`, `SourceUnit` enums.
4. **Tags module (read only)**: `tags.service` returns the tags (`TagRef` list) for a set of recipes in one query, ordered by `sort_order` (pinned first) and then name.
5. **Recipes module**: schemas, repository (list + get, children eagerly loaded, ordered), service (maps to DTOs, computes `total_minutes`, raises `recipe_not_found`), router (`list_recipes`, `get_recipe`).
6. **Errors**: add `ErrorCode.RECIPE_NOT_FOUND`; adapt `test_structure.py`'s sample code (an `Enum` with members cannot be subclassed).
7. **Tests**: migration (tables, pragmas, default pinned tags, cascade deletes, failure path), repository/service (total minutes, ordering, sort), API (both endpoints, 404 shape, `description`/`notes`/`source`/`original`/`source_text`, to-taste original, amount as number, `Z` timestamps), OpenAPI (operation IDs, enums, `ErrorCode`).
8. **Docs**: README (commands, migrations), `.env.example` if needed, spine/memlog, deferred-work.
9. **Verify**: `nx run-many -t lint typecheck test build` for `recipe-service`, then `nx affected -t lint typecheck test build`.

## Defaults I will take unless Adi objects

- `position` (0-based, `INTEGER NOT NULL`) on ingredient and step, indexed on `(recipe_id, position)`, **no unique constraint** (so a later PUT can reorder in one pass). The API exposes array order only (AD-20).
- `Unit` / `SourceUnit` are `StrEnum`s stored as `VARCHAR` with a `CHECK` (non-native enum), values are the lowercase codes.
- `total_minutes` = prep + cook, a missing one counts as 0, `null` only when both are null.
- Recipe columns: `title` (1–120), `description`, `notes`, `base_servings` (1–100), `prep_time_minutes`, `cook_time_minutes`, `source_url`, `created_by`, `updated_by`, `created_at`, `updated_at`. `RecipeRead` exposes all of them except `created_by`/`updated_by`.
- `recipe_tag`: composite PK `(recipe_id, tag_id)`, both `ON DELETE CASCADE`.
- `tag(id, name, pinned, sort_order)` is unique on `lower(name)` through an expression index. There are no groups and no meal types; a recipe has 0..n tags.
- `RecipeSummary` and `RecipeRead` return `tags: list[TagRef]`, ordered by `sort_order` (pinned first, NULLs last) and then name.
- The 500 / 5,000 limits are constants plus `Field(max_length=…)` on the read DTO now, and are reused by the write DTOs in Story 3.1.

## Decisions (Adi, 2026-10-27: "All a")

1. **`original` vs "originally to taste" (AD-20).** `{amount: null, unit: null}` means "originally to taste", but two nullable `original_*` columns cannot tell that apart from "no original".
   - A (recommended): add `has_original BOOLEAN NOT NULL DEFAULT 0`; `original` is `null` unless it is true.
   - B: one JSON column `original` holding `{amount, unit}`, SQL NULL = none. Breaks the `original_amount/original_unit` names in the PRD data model.
2. **Service and repository style.**
   - A (recommended): classes, Nest-like. `RecipeRepository(session)`, `RecipeService(repo, tags_service)`, wired by `Depends(get_recipe_service)` providers.
   - B: plain module functions that take `session` as the first argument.
3. **How `recipes` gets tag data from `tags`.**
   - A (recommended): `tags.service` returns `TagRef` (from `tags/schemas.py`); the `tags` protected contract allows `app.recipes` to import `app.tags.schemas` only. One `TagRef` type in OpenAPI.
   - B: keep `tags.schemas` private; `tags.service` returns plain tuples and `recipes.schemas` defines its own `TagRef`.
4. **Migrations folder.**
   - A (recommended): `app/migrations/` inside the package (ships with the wheel and the Docker image, found by the lifespan via the package path) plus `alembic.ini` at the project root for the CLI.
   - B: `apps/recipe-service/migrations/` (Alembic's default layout), which the Docker image must copy separately.
5. **Pinned-tag order.** The chip row in Story 1.9 needs a fixed order, and a `tag` row has no order (SQLite `rowid` is not stable across `VACUUM`).
   - A (recommended): nullable `tag.sort_order INTEGER`, set 0–12 by the data migration; read APIs order by `(sort_order, name)`.
   - B: no column; Story 1.9 sorts with a client constant.
   - Related gap: Story 1.9 also needs a source for all tags, even ones with no recipes. Planned as `GET /api/tags` in Story 1.9, not here, to keep 1.6 tight (coordinator note; Adi can still ask for it in 1.6).
6. **Photo columns.**
   - A (recommended): leave `photo_key` / `photo_credit_domain` and URL building to Story 3.7. `photo` is typed `PhotoRead | None` (the AD-27 shape, defined now) and is always `null` in 1.6.
   - B: add both columns now, plus a provisional `photos.service.build_photo()` using `/media/{key}.webp` and `/media/{key}.thumb.webp`.

## Spec Change Log

- **Rework 2026-10-27 (Adi):** meal types are gone and everything is plain tags. The first migration was changed in place (it is not pushed): the `group` column became `pinned BOOLEAN`, the unique index is on `lower(name)` (`uq_tag_lower_name`), and 13 pinned tags are seeded in order (בוקר, בראנץ', צהריים, ערב, נשנוש, עיקרית, תוספת, מנה ראשונה/סלט, מרק, מאפה, קינוח, משקה, רוטב/ממרח). `TagGroup`, `TagAssignment`, the "exactly one meal type" rule and the 500-on-missing-meal-type error were removed; `meal_type` left both read schemas. Epics, PRD, spine (AD-7, AD-24, AD-25) and memlog follow. This supersedes the "eight meal types" wording and decision 5 above (0–7 became 0–12).
- Implementation notes: `Unit`, `SourceUnit` and the countable set sit in `app/recipes/units.py`. `tools/lint-checks/src/python-contracts.spec.ts` follows the renamed tags contract and gets a test for the public schemas. Both are flagged in the review file.

## Verification

- `npx nx run-many -t lint typecheck test build -p recipe-service --skip-nx-cache` -- all green
- `npx nx affected -t lint typecheck test build --skip-nx-cache` -- all green
- `npx nx format:check` -- clean (only for files changed here)
- `cd apps/recipe-service && uv run alembic upgrade head` on an empty `DATA_DIR`, then `GET /api/recipes` returns `[]`
