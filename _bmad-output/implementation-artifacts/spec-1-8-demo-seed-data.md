# Spec: Story 1.8 Demo seed data

Source: `planning-artifacts/epics.md` (Story 1.8), ARCHITECTURE-SPINE AD-24, AD-25.
Decisions approved by Adi (via coordinator): create path A, CLI structure A.

## Goal

`nx run recipe-service:seed` (`python -m app.cli seed`) fills a migrated database with
10 Hebrew recipes, created through `recipes.service`, idempotent by title.

## Design

### Create path (reusable by Epic 3's `POST /api/recipes`)

- `recipes/schemas.py`: `RecipeCreate`, `IngredientCreate`, `StepCreate`; the tag input
  `TagInput` (exactly one of `{id}` or `{name}`) lives in `tags/schemas.py` (public, like `TagRef`).
- `RecipeService.create_recipe(data) -> RecipeRead`: adds recipe, ingredients (position = list
  order), steps; resolves tags through `TagService.assign_to_recipe`; commits once (AD-25: one
  transaction). Returns `get_recipe` output.
- `RecipeRepository.add(recipe)` (flush only).
- `TagService.assign_to_recipe(recipe_id, refs)`: names are normalized (NFC, trim, collapse
  spaces, max 40; AD-24), matched case-insensitively against existing tags, created if missing
  (unpinned, no sort order). Unknown `{id}` raises `AppError(404, TAG_NOT_FOUND)`. Flushes, never
  commits. Duplicate refs in one request collapse to one link.
- New `ErrorCode.TAG_NOT_FOUND`; `errors.tag_not_found` added to `he.json`; `openapi.json` and the
  generated client regenerated.

### CLI and seed

- `app/cli.py`: stdlib argparse, subcommand `seed` only. `main(argv)` returns an exit code.
- `app/seed.py`: `SEED_RECIPES` data + `run_seed(service) -> SeedResult(created, skipped)`.
  Existing titles are read through `RecipeService.list_recipes()` and skipped.
- The CLI runs `run_migrations(data_dir)` first, opens a `Session`, builds the service with
  `get_recipe_service(session, get_tag_service(session))`.
- Import-linter: `app.seed` added to `allowed_importers` of the `recipes` schemas protection only.
- Nx target `seed` (`uv run python -m app.cli seed`, cwd project root, not cached).

### Seed content

10 Hebrew recipes. Every default pinned tag is used (by name, never created by the seed), plus free
tags (על האש, פינגר פוד, מסיבות, ...). At least one to-taste ingredient (amount and unit null), and
amounts 0.5 (½) and 0.333 (⅓) (stored as Decimal; the glyphs are display only). No original values
(Epic 3).

## Acceptance checks (tests)

- Seed creates 10 recipes; all 13 default tags used; free tags created; default tags unchanged.
- Second run creates nothing.
- To-taste and fraction amounts present.
- `create_recipe`: positions, tag reuse (case-insensitive), name normalization, `{id}` refs,
  unknown id -> 404 `tag_not_found`, duplicate refs.
- CLI `main(["seed"])` exit code 0; unknown command is rejected.
- ruff, mypy strict, lint-imports, pytest, `nx format:check`, openapi/client regen clean.
