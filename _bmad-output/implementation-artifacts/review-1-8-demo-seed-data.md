# Review: Story 1.8 Demo seed data

Status: implemented, NOT committed. Spec: `spec-1-8-demo-seed-data.md`. Branch on approval: `claude/story-1-8-seed`, PR to main.

## Verification

- pytest: 98 passed (new: test_seed.py, test_recipes_create.py; seed.py 100% coverage)
- ruff check/format, mypy strict, lint-imports (13 contracts kept): clean
- `nx format:check`: clean; `nx run data-access:generate` regenerated (real diff: openapi.json, types.gen.ts, zod.gen.ts; the other generated files show as modified only from line endings)
- `nx run recipe-service:seed` run twice on a fresh DB: 10 created, then 0 created / 10 already there

## Notes for the reviewer

- Fractions are stored as 0.5 and 0.333 (Decimal, 3 places); the glyphs are display only.
- `TagInput` and name normalization live in `tags/schemas.py` so bad names return 422; `app.seed` is the only extra importer of `recipes.schemas`.
- `create_recipe` rolls back on any failure (e.g. unknown tag id leaves no recipe or new tags).
- The seed needs a `.env` with JWT_SECRET (documented in README).

## Changed files

```
 M apps/recipe-service/README.md
 M apps/recipe-service/app/core/errors.py
 M apps/recipe-service/app/recipes/repository.py
 M apps/recipe-service/app/recipes/schemas.py
 M apps/recipe-service/app/recipes/service.py
 M apps/recipe-service/app/tags/repository.py
 M apps/recipe-service/app/tags/schemas.py
 M apps/recipe-service/app/tags/service.py
 M apps/recipe-service/project.json
 M apps/recipe-service/pyproject.toml
 M apps/recipe-service/tests/test_openapi_export.py
 M libs/data-access/openapi.json
 M libs/data-access/src/generated/types.gen.ts
 M libs/data-access/src/generated/zod.gen.ts
 M libs/i18n/src/he.json
?? _bmad-output/implementation-artifacts/spec-1-8-demo-seed-data.md
?? apps/recipe-service/app/cli.py
?? apps/recipe-service/app/seed.py
?? apps/recipe-service/tests/test_recipes_create.py
?? apps/recipe-service/tests/test_seed.py
```

## Full diffs

```diff
diff --git a/apps/recipe-service/README.md b/apps/recipe-service/README.md
index 4f8064d..75f3d01 100644
--- a/apps/recipe-service/README.md
+++ b/apps/recipe-service/README.md
@@ -45,11 +45,18 @@ Revisions must not import app code: they have to run the same way forever. Alemb
 cannot see SQLite expression indexes, so write those by hand (see revision `0001`).
 Do not edit a revision that has shipped; add a new one.
 
+## Demo data
+
+`npx nx run recipe-service:seed` (`python -m app.cli seed`) migrates the database, then
+creates about 10 Hebrew demo recipes through `recipes.service`. It is idempotent by title
+and never creates the default tags. Needs a `.env` (see Configuration).
+
 ## Commands
 
 ```bash
 npx nx run recipe-service:serve   # http://localhost:8000/api/health
 npx nx run recipe-service:test
+npx nx run recipe-service:seed    # demo recipes
 npx nx run recipe-service:lint
 npx nx run recipe-service:openapi   # writes libs/data-access/openapi.json (use data-access:generate for the client)
 ```
diff --git a/apps/recipe-service/app/core/errors.py b/apps/recipe-service/app/core/errors.py
index 7815768..6de5423 100644
--- a/apps/recipe-service/app/core/errors.py
+++ b/apps/recipe-service/app/core/errors.py
@@ -9,6 +9,7 @@ class ErrorCode(StrEnum):
     """Stable error codes; the client shows `errors.<code>` from he.json."""
 
     RECIPE_NOT_FOUND = "recipe_not_found"
+    TAG_NOT_FOUND = "tag_not_found"
 
 
 class ErrorResponse(BaseModel):
diff --git a/apps/recipe-service/app/recipes/repository.py b/apps/recipe-service/app/recipes/repository.py
index 660c06d..6aefb4e 100644
--- a/apps/recipe-service/app/recipes/repository.py
+++ b/apps/recipe-service/app/recipes/repository.py
@@ -26,6 +26,18 @@ class RecipeRepository:
         )
         return self._session.exec(statement).all()
 
+    def add(self, recipe: Recipe) -> Recipe:
+        """Stage the recipe with its ingredients and steps; the caller commits."""
+        self._session.add(recipe)
+        self._session.flush()
+        return recipe
+
+    def commit(self) -> None:
+        self._session.commit()
+
+    def rollback(self) -> None:
+        self._session.rollback()
+
     def get(self, recipe_id: uuid.UUID) -> Recipe | None:
         """One recipe with its ingredients and steps, both ordered by position."""
         statement = (
diff --git a/apps/recipe-service/app/recipes/schemas.py b/apps/recipe-service/app/recipes/schemas.py
index 58a6d9b..1ea019d 100644
--- a/apps/recipe-service/app/recipes/schemas.py
+++ b/apps/recipe-service/app/recipes/schemas.py
@@ -9,7 +9,7 @@ from pydantic import BaseModel, Field, PlainSerializer
 
 from app.photos.schemas import PhotoRead
 from app.recipes.units import SourceUnit, Unit
-from app.tags.schemas import TagRef
+from app.tags.schemas import TagInput, TagRef
 
 DESCRIPTION_MAX_LENGTH = 500
 NOTES_MAX_LENGTH = 5000
@@ -18,6 +18,34 @@ NOTES_MAX_LENGTH = 5000
 Amount = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]
 
 
+class IngredientCreate(BaseModel):
+    """An ingredient in a recipe write; its position is its place in the list."""
+
+    name: str = Field(min_length=1)
+    amount: Amount | None = Field(default=None, ge=0)
+    unit: Unit | None = None
+    note: str | None = None
+
+
+class StepCreate(BaseModel):
+    description: str = Field(min_length=1)
+
+
+class RecipeCreate(BaseModel):
+    """Everything needed to create a recipe; tags are ids or names (AD-25)."""
+
+    title: str = Field(min_length=1, max_length=120)
+    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
+    notes: str | None = Field(default=None, max_length=NOTES_MAX_LENGTH)
+    base_servings: int = Field(ge=1)
+    prep_time_minutes: int | None = Field(default=None, ge=0)
+    cook_time_minutes: int | None = Field(default=None, ge=0)
+    source_url: str | None = Field(default=None, max_length=2048)
+    tags: list[TagInput] = Field(default_factory=list)
+    ingredients: list[IngredientCreate] = Field(default_factory=list)
+    steps: list[StepCreate] = Field(default_factory=list)
+
+
 class OriginalValue(BaseModel):
     """The ingredient's amount and unit before its first edit (FR-7).
 
diff --git a/apps/recipe-service/app/recipes/service.py b/apps/recipe-service/app/recipes/service.py
index 0503bed..2473088 100644
--- a/apps/recipe-service/app/recipes/service.py
+++ b/apps/recipe-service/app/recipes/service.py
@@ -8,11 +8,12 @@ from sqlmodel import Session
 
 from app.core.db import get_session
 from app.core.errors import AppError, ErrorCode
-from app.recipes.models import Ingredient
+from app.recipes.models import Ingredient, Recipe, Step
 from app.recipes.repository import RecipeRepository
 from app.recipes.schemas import (
     IngredientRead,
     OriginalValue,
+    RecipeCreate,
     RecipeRead,
     RecipeSummary,
     SourceValue,
@@ -72,6 +73,41 @@ class RecipeService:
             for recipe in recipes
         ]
 
+    def create_recipe(self, data: RecipeCreate) -> RecipeRead:
+        """Create a recipe, its ingredients, steps and tags in one transaction."""
+        recipe = Recipe(
+            title=data.title,
+            description=data.description,
+            notes=data.notes,
+            base_servings=data.base_servings,
+            prep_time_minutes=data.prep_time_minutes,
+            cook_time_minutes=data.cook_time_minutes,
+            source_url=data.source_url,
+        )
+        recipe.ingredients = [
+            Ingredient(
+                recipe_id=recipe.id,
+                position=position,
+                name=item.name,
+                amount=item.amount,
+                unit=item.unit,
+                note=item.note,
+            )
+            for position, item in enumerate(data.ingredients)
+        ]
+        recipe.steps = [
+            Step(recipe_id=recipe.id, position=position, description=item.description)
+            for position, item in enumerate(data.steps)
+        ]
+        try:
+            self._repository.add(recipe)
+            self._tags.assign_to_recipe(recipe.id, data.tags)
+            self._repository.commit()
+        except Exception:
+            self._repository.rollback()
+            raise
+        return self.get_recipe(recipe.id)
+
     def get_recipe(self, recipe_id: uuid.UUID) -> RecipeRead:
         recipe = self._repository.get(recipe_id)
         if recipe is None:
diff --git a/apps/recipe-service/app/tags/repository.py b/apps/recipe-service/app/tags/repository.py
index a21ac46..34106cb 100644
--- a/apps/recipe-service/app/tags/repository.py
+++ b/apps/recipe-service/app/tags/repository.py
@@ -13,6 +13,23 @@ class TagRepository:
     def __init__(self, session: Session) -> None:
         self._session = session
 
+    def get(self, tag_id: uuid.UUID) -> Tag | None:
+        return self._session.get(Tag, tag_id)
+
+    def get_by_name(self, name: str) -> Tag | None:
+        """The tag with this name, compared case-insensitively (AD-7)."""
+        statement = select(Tag).where(func.lower(col(Tag.name)) == name.lower())
+        return self._session.exec(statement).first()
+
+    def add(self, tag: Tag) -> Tag:
+        self._session.add(tag)
+        self._session.flush()
+        return tag
+
+    def link(self, recipe_id: uuid.UUID, tag_id: uuid.UUID) -> None:
+        self._session.add(RecipeTag(recipe_id=recipe_id, tag_id=tag_id))
+        self._session.flush()
+
     def list_for_recipes(
         self, recipe_ids: Sequence[uuid.UUID]
     ) -> Sequence[tuple[uuid.UUID, Tag]]:
diff --git a/apps/recipe-service/app/tags/schemas.py b/apps/recipe-service/app/tags/schemas.py
index a39183c..742df0c 100644
--- a/apps/recipe-service/app/tags/schemas.py
+++ b/apps/recipe-service/app/tags/schemas.py
@@ -1,8 +1,17 @@
 """Pydantic request and response schemas for tags."""
 
+import unicodedata
 import uuid
+from typing import Self
 
-from pydantic import BaseModel
+from pydantic import BaseModel, model_validator
+
+TAG_NAME_MAX_LENGTH = 40
+
+
+def normalize_tag_name(name: str) -> str:
+    """NFC, trimmed, inner whitespace collapsed to single spaces (AD-24)."""
+    return " ".join(unicodedata.normalize("NFC", name).split())
 
 
 class TagRef(BaseModel):
@@ -10,3 +19,20 @@ class TagRef(BaseModel):
 
     id: uuid.UUID
     name: str
+
+
+class TagInput(BaseModel):
+    """A tag in a recipe write: an existing tag by id, or a name to find or create."""
+
+    id: uuid.UUID | None = None
+    name: str | None = None
+
+    @model_validator(mode="after")
+    def _exactly_one(self) -> Self:
+        if (self.id is None) == (self.name is None):
+            raise ValueError("a tag needs exactly one of id or name")
+        if self.name is not None:
+            self.name = normalize_tag_name(self.name)
+            if not 1 <= len(self.name) <= TAG_NAME_MAX_LENGTH:
+                raise ValueError(f"tag name must be 1-{TAG_NAME_MAX_LENGTH} characters")
+        return self
diff --git a/apps/recipe-service/app/tags/service.py b/apps/recipe-service/app/tags/service.py
index 317f819..73003f0 100644
--- a/apps/recipe-service/app/tags/service.py
+++ b/apps/recipe-service/app/tags/service.py
@@ -8,8 +8,10 @@ from fastapi import Depends
 from sqlmodel import Session
 
 from app.core.db import get_session
+from app.core.errors import AppError, ErrorCode
+from app.tags.models import Tag
 from app.tags.repository import TagRepository
-from app.tags.schemas import TagRef
+from app.tags.schemas import TagInput, TagRef
 
 
 class TagService:
@@ -27,6 +29,29 @@ class TagService:
             tags[recipe_id].append(TagRef(id=tag.id, name=tag.name))
         return tags
 
+    def assign_to_recipe(self, recipe_id: uuid.UUID, refs: Sequence[TagInput]) -> None:
+        """Link the recipe to each tag, creating tags given by a new name (AD-25).
+
+        Flushes but never commits: the caller's transaction owns the commit.
+        """
+        linked: set[uuid.UUID] = set()
+        for ref in refs:
+            tag = self._resolve(ref)
+            if tag.id not in linked:
+                linked.add(tag.id)
+                self._repository.link(recipe_id, tag.id)
+
+    def _resolve(self, ref: TagInput) -> Tag:
+        if ref.id is not None:
+            tag = self._repository.get(ref.id)
+            if tag is None:
+                raise AppError(404, ErrorCode.TAG_NOT_FOUND, "Tag not found")
+            return tag
+        name = ref.name or ""  # TagInput guarantees a normalized name when no id.
+        return self._repository.get_by_name(name) or self._repository.add(
+            Tag(name=name)
+        )
+
 
 def get_tag_service(session: Annotated[Session, Depends(get_session)]) -> TagService:
     """Provider, like a Nest injectable: `Depends(get_tag_service)`."""
diff --git a/apps/recipe-service/project.json b/apps/recipe-service/project.json
index 30be1de..c5a343a 100644
--- a/apps/recipe-service/project.json
+++ b/apps/recipe-service/project.json
@@ -92,6 +92,16 @@
       },
       "cache": true
     },
+    "seed": {
+      "executor": "@nxlv/python:run-commands",
+      "options": {
+        "command": "uv run python -m app.cli seed",
+        "cwd": "{projectRoot}",
+        "env": {
+          "PYTHONUTF8": "1"
+        }
+      }
+    },
     "install": {
       "executor": "@nxlv/python:install",
       "options": {
diff --git a/apps/recipe-service/pyproject.toml b/apps/recipe-service/pyproject.toml
index 84c456f..b489c23 100644
--- a/apps/recipe-service/pyproject.toml
+++ b/apps/recipe-service/pyproject.toml
@@ -166,7 +166,7 @@ protected_modules = [
   "app.recipes.models",
   "app.recipes.schemas",
 ]
-allowed_importers = ["app.recipes"]
+allowed_importers = ["app.recipes", "app.seed"]
 ignore_imports = [
   "app.main -> app.recipes.router",
   "app.core.metadata -> app.recipes.models",
diff --git a/apps/recipe-service/tests/test_openapi_export.py b/apps/recipe-service/tests/test_openapi_export.py
index f948858..74f6acb 100644
--- a/apps/recipe-service/tests/test_openapi_export.py
+++ b/apps/recipe-service/tests/test_openapi_export.py
@@ -18,7 +18,10 @@ def test_export_writes_stable_sorted_json(tmp_path: Path) -> None:
     assert "\r" not in text
     spec = json.loads(text)
     assert spec["paths"]["/api/recipes"]["get"]["operationId"] == "recipes_list_recipes"
-    assert spec["components"]["schemas"]["ErrorCode"]["enum"] == ["recipe_not_found"]
+    assert spec["components"]["schemas"]["ErrorCode"]["enum"] == [
+        "recipe_not_found",
+        "tag_not_found",
+    ]
 
 
 def test_main_requires_exactly_one_path(capsys: pytest.CaptureFixture[str]) -> None:
diff --git a/libs/data-access/openapi.json b/libs/data-access/openapi.json
index 706d3ef..74db80e 100644
--- a/libs/data-access/openapi.json
+++ b/libs/data-access/openapi.json
@@ -4,7 +4,8 @@
       "ErrorCode": {
         "description": "Stable error codes; the client shows `errors.<code>` from he.json.",
         "enum": [
-          "recipe_not_found"
+          "recipe_not_found",
+          "tag_not_found"
         ],
         "title": "ErrorCode",
         "type": "string"
diff --git a/libs/data-access/src/generated/types.gen.ts b/libs/data-access/src/generated/types.gen.ts
index 7d04afa..9722e99 100644
--- a/libs/data-access/src/generated/types.gen.ts
+++ b/libs/data-access/src/generated/types.gen.ts
@@ -9,7 +9,7 @@ export type ClientOptions = {
  *
  * Stable error codes; the client shows `errors.<code>` from he.json.
  */
-export type ErrorCode = 'recipe_not_found';
+export type ErrorCode = 'recipe_not_found' | 'tag_not_found';
 
 /**
  * ErrorResponse
diff --git a/libs/data-access/src/generated/zod.gen.ts b/libs/data-access/src/generated/zod.gen.ts
index 96ba6cd..313fe67 100644
--- a/libs/data-access/src/generated/zod.gen.ts
+++ b/libs/data-access/src/generated/zod.gen.ts
@@ -7,7 +7,7 @@ import * as z from 'zod';
  *
  * Stable error codes; the client shows `errors.<code>` from he.json.
  */
-export const zErrorCode = z.enum(['recipe_not_found']);
+export const zErrorCode = z.enum(['recipe_not_found', 'tag_not_found']);
 
 /**
  * ErrorResponse
diff --git a/libs/i18n/src/he.json b/libs/i18n/src/he.json
index 600cd72..e85d70f 100644
--- a/libs/i18n/src/he.json
+++ b/libs/i18n/src/he.json
@@ -27,6 +27,7 @@
   },
   "errors": {
     "recipe_not_found": "המתכון לא נמצא",
+    "tag_not_found": "התגית לא נמצאה",
     "unknown": "משהו השתבש, אפשר לנסות שוב"
   }
 }
diff --git a/_bmad-output/implementation-artifacts/spec-1-8-demo-seed-data.md b/_bmad-output/implementation-artifacts/spec-1-8-demo-seed-data.md
new file mode 100644
index 0000000..58dbd8b
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-1-8-demo-seed-data.md
@@ -0,0 +1,53 @@
+# Spec: Story 1.8 Demo seed data
+
+Source: `planning-artifacts/epics.md` (Story 1.8), ARCHITECTURE-SPINE AD-24, AD-25.
+Decisions approved by Adi (via coordinator): create path A, CLI structure A.
+
+## Goal
+
+`nx run recipe-service:seed` (`python -m app.cli seed`) fills a migrated database with
+10 Hebrew recipes, created through `recipes.service`, idempotent by title.
+
+## Design
+
+### Create path (reusable by Epic 3's `POST /api/recipes`)
+
+- `recipes/schemas.py`: `RecipeCreate`, `IngredientCreate`, `StepCreate`; the tag input
+  `TagInput` (exactly one of `{id}` or `{name}`) lives in `tags/schemas.py` (public, like `TagRef`).
+- `RecipeService.create_recipe(data) -> RecipeRead`: adds recipe, ingredients (position = list
+  order), steps; resolves tags through `TagService.assign_to_recipe`; commits once (AD-25: one
+  transaction). Returns `get_recipe` output.
+- `RecipeRepository.add(recipe)` (flush only).
+- `TagService.assign_to_recipe(recipe_id, refs)`: names are normalized (NFC, trim, collapse
+  spaces, max 40; AD-24), matched case-insensitively against existing tags, created if missing
+  (unpinned, no sort order). Unknown `{id}` raises `AppError(404, TAG_NOT_FOUND)`. Flushes, never
+  commits. Duplicate refs in one request collapse to one link.
+- New `ErrorCode.TAG_NOT_FOUND`; `errors.tag_not_found` added to `he.json`; `openapi.json` and the
+  generated client regenerated.
+
+### CLI and seed
+
+- `app/cli.py`: stdlib argparse, subcommand `seed` only. `main(argv)` returns an exit code.
+- `app/seed.py`: `SEED_RECIPES` data + `run_seed(service) -> SeedResult(created, skipped)`.
+  Existing titles are read through `RecipeService.list_recipes()` and skipped.
+- The CLI runs `run_migrations(data_dir)` first, opens a `Session`, builds the service with
+  `get_recipe_service(session, get_tag_service(session))`.
+- Import-linter: `app.seed` added to `allowed_importers` of the `recipes` schemas protection only.
+- Nx target `seed` (`uv run python -m app.cli seed`, cwd project root, not cached).
+
+### Seed content
+
+10 Hebrew recipes. Every default pinned tag is used (by name, never created by the seed), plus free
+tags (על האש, פינגר פוד, מסיבות, ...). At least one to-taste ingredient (amount and unit null), and
+amounts 0.5 (½) and 0.333 (⅓) (stored as Decimal; the glyphs are display only). No original values
+(Epic 3).
+
+## Acceptance checks (tests)
+
+- Seed creates 10 recipes; all 13 default tags used; free tags created; default tags unchanged.
+- Second run creates nothing.
+- To-taste and fraction amounts present.
+- `create_recipe`: positions, tag reuse (case-insensitive), name normalization, `{id}` refs,
+  unknown id -> 404 `tag_not_found`, duplicate refs.
+- CLI `main(["seed"])` exit code 0; unknown command is rejected.
+- ruff, mypy strict, lint-imports, pytest, `nx format:check`, openapi/client regen clean.
diff --git a/apps/recipe-service/app/cli.py b/apps/recipe-service/app/cli.py
new file mode 100644
index 0000000..0884a7a
--- /dev/null
+++ b/apps/recipe-service/app/cli.py
@@ -0,0 +1,42 @@
+"""Command line entry point: `python -m app.cli seed` (AD-24)."""
+
+import argparse
+import sys
+from collections.abc import Sequence
+
+from sqlmodel import Session
+
+from app.core.config import get_settings
+from app.core.db import get_engine
+from app.core.migrate import run_migrations
+from app.recipes.service import get_recipe_service
+from app.seed import run_seed
+from app.tags.service import get_tag_service
+
+
+def _seed() -> int:
+    data_dir = get_settings().data_dir
+    run_migrations(data_dir)
+    with Session(get_engine(data_dir)) as session:
+        service = get_recipe_service(session, get_tag_service(session))
+        result = run_seed(service)
+    print(f"Seed done: {result.created} created, {result.skipped} already there.")
+    return 0
+
+
+def build_parser() -> argparse.ArgumentParser:
+    parser = argparse.ArgumentParser(prog="python -m app.cli")
+    commands = parser.add_subparsers(dest="command", required=True)
+    commands.add_parser("seed", help="Fill the database with demo recipes")
+    return parser
+
+
+def main(argv: Sequence[str] | None = None) -> int:
+    args = build_parser().parse_args(argv)
+    if args.command == "seed":
+        return _seed()
+    raise AssertionError(args.command)  # pragma: no cover
+
+
+if __name__ == "__main__":
+    sys.exit(main())
diff --git a/apps/recipe-service/app/seed.py b/apps/recipe-service/app/seed.py
new file mode 100644
index 0000000..66a652c
--- /dev/null
+++ b/apps/recipe-service/app/seed.py
@@ -0,0 +1,263 @@
+"""Demo recipes (FR-12), created through `recipes.service` and idempotent by title.
+
+The default pinned tags come from the migrations: the seed refers to them by name and
+never creates them. Free tags are created on first use by the tag resolver (AD-25).
+Amounts are exact decimals: ½ is 0.5 and ⅓ is 0.333 (AD-31).
+"""
+
+from dataclasses import dataclass
+from decimal import Decimal
+
+from app.recipes.schemas import IngredientCreate, RecipeCreate, StepCreate
+from app.recipes.service import RecipeService
+from app.recipes.units import Unit
+from app.tags.schemas import TagInput
+
+HALF = Decimal("0.5")  # ½
+THIRD = Decimal(1) / 3  # ⅓, stored as 0.333
+
+
+def _recipe(
+    title: str,
+    *,
+    tags: tuple[str, ...],
+    servings: int,
+    prep: int | None,
+    cook: int | None,
+    description: str,
+    ingredients: tuple[tuple[str, Decimal | int | None, Unit | None], ...],
+    steps: tuple[str, ...],
+    notes: str | None = None,
+) -> RecipeCreate:
+    return RecipeCreate(
+        title=title,
+        description=description,
+        notes=notes,
+        base_servings=servings,
+        prep_time_minutes=prep,
+        cook_time_minutes=cook,
+        tags=[TagInput(name=name) for name in tags],
+        ingredients=[
+            IngredientCreate(
+                name=name,
+                amount=None if amount is None else Decimal(amount),
+                unit=unit,
+            )
+            for name, amount, unit in ingredients
+        ],
+        steps=[StepCreate(description=text) for text in steps],
+    )
+
+
+SEED_RECIPES: tuple[RecipeCreate, ...] = (
+    _recipe(
+        "שקשוקה",
+        tags=("בוקר", "בראנץ'", "עיקרית"),
+        servings=4,
+        prep=10,
+        cook=25,
+        description="ביצים בעגבניות חריפות, כמו בבית.",
+        ingredients=(
+            ("שמן זית", 3, Unit.TBSP),
+            ("בצל", 1, Unit.UNIT),
+            ("שום", 3, Unit.CLOVE),
+            ("עגבניות מרוסקות", 1, Unit.CAN),
+            ("פפריקה", 1, Unit.TSP),
+            ("ביצים", 5, Unit.UNIT),
+            ("מלח", None, None),
+        ),
+        steps=(
+            "מטגנים בצל ושום בשמן זית עד שהבצל שקוף.",
+            "מוסיפים עגבניות ופפריקה ומבשלים 10 דקות.",
+            "יוצרים גומחות, שוברים לתוכן ביצים ומכסים עד שהחלבון מתייצב.",
+        ),
+    ),
+    _recipe(
+        "סלט ירקות קצוץ",
+        tags=("מנה ראשונה/סלט", "תוספת", "צהריים"),
+        servings=4,
+        prep=15,
+        cook=None,
+        description="סלט ישראלי טרי וקצוץ דק.",
+        ingredients=(
+            ("מלפפונים", 3, Unit.UNIT),
+            ("עגבניות", 3, Unit.UNIT),
+            ("מיץ לימון", HALF, Unit.CUP),
+            ("שמן זית", 3, Unit.TBSP),
+            ("מלח", None, None),
+        ),
+        steps=("קוצצים את הירקות לקוביות קטנות.", "מתבלים ומערבבים מיד לפני ההגשה."),
+    ),
+    _recipe(
+        "מרק עדשים כתומות",
+        tags=("מרק", "ערב", "צהריים"),
+        servings=6,
+        prep=10,
+        cook=30,
+        description="מרק חם ומחמם, מוכן בחצי שעה.",
+        ingredients=(
+            ("עדשים כתומות", 2, Unit.CUP),
+            ("גזר", 2, Unit.UNIT),
+            ("בצל", 1, Unit.UNIT),
+            ("כמון", 1, Unit.TSP),
+            ("מים", 2, Unit.L),
+            ("מלח", None, None),
+        ),
+        steps=(
+            "מטגנים בצל וגזר, מוסיפים כמון ועדשים.",
+            "מוסיפים מים ומבשלים 25 דקות.",
+            "טוחנים בבלנדר ומתבלים.",
+        ),
+    ),
+    _recipe(
+        "חזה עוף על האש",
+        tags=("עיקרית", "ערב", "על האש"),
+        servings=4,
+        prep=20,
+        cook=15,
+        description="חזה עוף עסיסי מהמנגל.",
+        ingredients=(
+            ("חזה עוף", 800, Unit.G),
+            ("שמן זית", 2, Unit.TBSP),
+            ("שום", 2, Unit.CLOVE),
+            ("פפריקה מעושנת", 1, Unit.TSP),
+            ("מלח ופלפל", None, None),
+        ),
+        steps=(
+            "מתבלים את העוף ומשרים לפחות שעה.",
+            "צולים על גחלים חמות 6 דקות מכל צד.",
+            "מנוחה של 5 דקות לפני החיתוך.",
+        ),
+        notes="אפשר להשרות בלילה במקרר.",
+    ),
+    _recipe(
+        "לחמניות חמאה",
+        tags=("מאפה", "בוקר"),
+        servings=12,
+        prep=30,
+        cook=20,
+        description="לחמניות רכות וריחניות.",
+        ingredients=(
+            ("קמח", 500, Unit.G),
+            ("חלב פושר", 250, Unit.ML),
+            ("חמאה מומסת", 80, Unit.G),
+            ("שמרים יבשים", 2, Unit.TSP),
+            ("סוכר", 1, Unit.TBSP),
+            ("מלח", 1, Unit.TSP),
+        ),
+        steps=(
+            "לשים את כל החומרים עד לקבלת בצק חלק.",
+            "מתפיחים שעה, מחלקים ל-12 כדורים ומתפיחים שוב.",
+            "אופים ב-190 מעלות כ-20 דקות.",
+        ),
+    ),
+    _recipe(
+        "עוגת שוקולד",
+        tags=("קינוח", "מסיבות"),
+        servings=10,
+        prep=20,
+        cook=40,
+        description="עוגה עשירה לימי הולדת וחגים.",
+        ingredients=(
+            ("שוקולד מריר", 200, Unit.G),
+            ("חמאה", 150, Unit.G),
+            ("סוכר", THIRD, Unit.CUP),
+            ("ביצים", 4, Unit.UNIT),
+            ("קמח", HALF, Unit.CUP),
+            ("קקאו", 2, Unit.TBSP),
+        ),
+        steps=(
+            "ממיסים שוקולד וחמאה יחד.",
+            "מקציפים ביצים עם סוכר ומערבבים פנימה את השוקולד והקמח.",
+            "אופים ב-170 מעלות 40 דקות.",
+        ),
+    ),
+    _recipe(
+        "לימונדה עם נענע",
+        tags=("משקה", "מסיבות"),
+        servings=6,
+        prep=10,
+        cook=None,
+        description="לימונדה קרה ומרעננת לקיץ.",
+        ingredients=(
+            ("לימונים", 6, Unit.UNIT),
+            ("סוכר", THIRD, Unit.CUP),
+            ("מים קרים", 1, Unit.L),
+            ("נענע", 1, Unit.PACKAGE),
+            ("קרח", None, None),
+        ),
+        steps=("סוחטים את הלימונים.", "מערבבים עם סוכר ומים, מוסיפים נענע וקרח."),
+    ),
+    _recipe(
+        "חומוס ביתי",
+        tags=("רוטב/ממרח", "נשנוש", "פינגר פוד"),
+        servings=6,
+        prep=15,
+        cook=None,
+        description="חומוס חלק עם טחינה ולימון.",
+        ingredients=(
+            ("חומוס מבושל", 2, Unit.CUP),
+            ("טחינה גולמית", HALF, Unit.CUP),
+            ("מיץ לימון", 3, Unit.TBSP),
+            ("שום", 1, Unit.CLOVE),
+            ("מים קרים", 4, Unit.TBSP),
+            ("מלח", None, None),
+        ),
+        steps=("טוחנים את כל החומרים עד לקבלת קרם חלק.", "מגישים עם שמן זית."),
+    ),
+    _recipe(
+        "כדורי בשר קטנים",
+        tags=("פינגר פוד", "מסיבות", "מנה ראשונה/סלט"),
+        servings=8,
+        prep=25,
+        cook=15,
+        description="כדורי בשר קטנים לנשנוש בעמידה.",
+        ingredients=(
+            ("בשר בקר טחון", 500, Unit.G),
+            ("פירורי לחם", HALF, Unit.CUP),
+            ("ביצה", 1, Unit.UNIT),
+            ("פטרוזיליה", 1, Unit.PACKAGE),
+            ("מלח ופלפל", None, None),
+        ),
+        steps=(
+            "מערבבים את כל החומרים ויוצרים כדורים קטנים.",
+            "אופים ב-200 מעלות 15 דקות.",
+        ),
+    ),
+    _recipe(
+        "אורז לבן",
+        tags=("תוספת", "ערב"),
+        servings=4,
+        prep=5,
+        cook=20,
+        description="אורז פריד לכל ארוחה.",
+        ingredients=(
+            ("אורז בסמטי", 2, Unit.CUP),
+            ("מים רותחים", 3, Unit.CUP),
+            ("שמן", 1, Unit.TBSP),
+            ("מלח", None, None),
+        ),
+        steps=(
+            "מטגנים את האורז בשמן דקה.",
+            "מוסיפים מים ומלח, מכסים ומבשלים 15 דקות על להבה נמוכה.",
+        ),
+    ),
+)
+
+
+@dataclass(frozen=True)
+class SeedResult:
+    created: int
+    skipped: int
+
+
+def run_seed(service: RecipeService) -> SeedResult:
+    """Create each demo recipe whose title does not exist yet."""
+    existing = {summary.title for summary in service.list_recipes()}
+    created = 0
+    for recipe in SEED_RECIPES:
+        if recipe.title in existing:
+            continue
+        service.create_recipe(recipe)
+        created += 1
+    return SeedResult(created=created, skipped=len(SEED_RECIPES) - created)
diff --git a/apps/recipe-service/tests/test_recipes_create.py b/apps/recipe-service/tests/test_recipes_create.py
new file mode 100644
index 0000000..0a1d467
--- /dev/null
+++ b/apps/recipe-service/tests/test_recipes_create.py
@@ -0,0 +1,86 @@
+import uuid
+from decimal import Decimal
+
+import pytest
+from fastapi.testclient import TestClient
+from pydantic import ValidationError
+from sqlmodel import Session, col, func, select
+
+from app.core.errors import AppError, ErrorCode
+from app.recipes.models import Recipe
+from app.recipes.schemas import IngredientCreate, RecipeCreate, StepCreate
+from app.recipes.service import RecipeService, get_recipe_service
+from app.recipes.units import Unit
+from app.tags.models import Tag
+from app.tags.schemas import TagInput
+from app.tags.service import get_tag_service
+from tests.factories import add_tag, seeded_tag
+
+
+def make_service(session: Session) -> RecipeService:
+    return get_recipe_service(session, get_tag_service(session))
+
+
+def new_recipe(**fields: object) -> RecipeCreate:
+    values: dict[str, object] = {"title": "פשטידה", "base_servings": 4, **fields}
+    return RecipeCreate.model_validate(values)
+
+
+def test_create_returns_full_recipe_with_positions(
+    client: TestClient, session: Session
+) -> None:
+    created = make_service(session).create_recipe(
+        new_recipe(
+            ingredients=[
+                IngredientCreate(name="קמח", amount=Decimal("0.5"), unit=Unit.CUP),
+                IngredientCreate(name="מלח"),
+            ],
+            steps=[StepCreate(description="א"), StepCreate(description="ב")],
+        )
+    )
+    assert [i.name for i in created.ingredients] == ["קמח", "מלח"]
+    assert created.ingredients[0].amount == Decimal("0.5")
+    assert created.ingredients[1].amount is None
+    assert all(i.original is None for i in created.ingredients)
+    assert [s.description for s in created.steps] == ["א", "ב"]
+
+
+def test_create_resolves_ids_and_names(client: TestClient, session: Session) -> None:
+    brunch = seeded_tag(session, "בראנץ'")
+    existing = add_tag(session, "Party")
+    created = make_service(session).create_recipe(
+        new_recipe(
+            tags=[
+                TagInput(id=brunch.id),
+                TagInput(name="  party "),  # reuses "Party", case-insensitive
+                TagInput(name="על   האש"),  # new, spaces collapsed
+                TagInput(id=brunch.id),  # duplicate collapses
+            ]
+        )
+    )
+    assert {t.name for t in created.tags} == {"בראנץ'", "Party", "על האש"}
+    assert len(created.tags) == 3
+    assert existing.id in {t.id for t in created.tags}
+    assert session.exec(select(func.count()).select_from(Tag)).one() == 13 + 2
+
+
+def test_unknown_tag_id_rolls_back_the_recipe(
+    client: TestClient, session: Session
+) -> None:
+    with pytest.raises(AppError) as exc:
+        make_service(session).create_recipe(
+            new_recipe(tags=[TagInput(name="חדשה"), TagInput(id=uuid.uuid4())])
+        )
+    assert exc.value.status_code == 404
+    assert exc.value.body.code == ErrorCode.TAG_NOT_FOUND
+    assert session.exec(select(func.count()).select_from(Recipe)).one() == 0
+    assert session.exec(select(Tag).where(col(Tag.name) == "חדשה")).first() is None
+
+
+@pytest.mark.parametrize(
+    "bad",
+    [{}, {"id": uuid.uuid4(), "name": "x"}, {"name": "   "}, {"name": "x" * 41}],
+)
+def test_tag_input_validation(bad: dict[str, object]) -> None:
+    with pytest.raises(ValidationError):
+        TagInput.model_validate(bad)
diff --git a/apps/recipe-service/tests/test_seed.py b/apps/recipe-service/tests/test_seed.py
new file mode 100644
index 0000000..5139a9c
--- /dev/null
+++ b/apps/recipe-service/tests/test_seed.py
@@ -0,0 +1,90 @@
+from decimal import Decimal
+
+import pytest
+from fastapi.testclient import TestClient
+from sqlmodel import Session, col, func, select
+
+from app.cli import main
+from app.recipes.models import Recipe
+from app.recipes.service import get_recipe_service
+from app.seed import SEED_RECIPES, run_seed
+from app.tags.models import RecipeTag, Tag
+from app.tags.service import get_tag_service
+from tests.test_migrations import DEFAULT_PINNED_TAGS
+
+FREE_TAGS = {"על האש", "פינגר פוד", "מסיבות"}
+
+
+def _tags(session: Session) -> list[tuple[str, str, bool, int | None]]:
+    rows = session.exec(select(Tag).order_by(col(Tag.name))).all()
+    return [(str(t.id), t.name, t.pinned, t.sort_order) for t in rows]
+
+
+def test_seed_creates_recipes_through_the_service(
+    client: TestClient, session: Session
+) -> None:
+    defaults_before = [row for row in _tags(session) if row[2]]
+    service = get_recipe_service(session, get_tag_service(session))
+
+    result = run_seed(service)
+
+    assert (result.created, result.skipped) == (len(SEED_RECIPES), 0)
+    assert len(SEED_RECIPES) == 10
+    titles = [item["title"] for item in client.get("/api/recipes").json()]
+    assert sorted(titles) == sorted(recipe.title for recipe in SEED_RECIPES)
+
+    # Default tags are untouched; every one is used; free tags were created unpinned.
+    assert [row for row in _tags(session) if row[2]] == defaults_before
+    used = set(
+        session.exec(
+            select(Tag.name).join(RecipeTag, col(RecipeTag.tag_id) == col(Tag.id))
+        )
+    )
+    assert {name for _, name in DEFAULT_PINNED_TAGS} <= used
+    free = {t.name for t in session.exec(select(Tag).where(col(Tag.pinned).is_(False)))}
+    assert free >= FREE_TAGS
+
+
+def test_seed_is_idempotent(client: TestClient, session: Session) -> None:
+    service = get_recipe_service(session, get_tag_service(session))
+    run_seed(service)
+    tags_before = _tags(session)
+
+    again = run_seed(service)
+
+    assert (again.created, again.skipped) == (0, len(SEED_RECIPES))
+    assert session.exec(select(func.count()).select_from(Recipe)).one() == 10
+    assert _tags(session) == tags_before
+
+
+def test_seed_has_to_taste_and_fractions(client: TestClient, session: Session) -> None:
+    run_seed(get_recipe_service(session, get_tag_service(session)))
+    amounts: list[Decimal] = []
+    to_taste = 0
+    for summary in client.get("/api/recipes").json():
+        detail = client.get(f"/api/recipes/{summary['id']}").json()
+        for item in detail["ingredients"]:
+            if item["amount"] is None:
+                to_taste += 1
+                assert item["unit"] is None
+            else:
+                amounts.append(Decimal(str(item["amount"])))
+            assert item["original"] is None
+    assert to_taste >= 1
+    assert Decimal("0.5") in amounts
+    assert Decimal("0.333") in amounts
+
+
+def test_cli_seed_runs_and_reruns(
+    client: TestClient, capsys: pytest.CaptureFixture[str]
+) -> None:
+    assert main(["seed"]) == 0
+    assert "10 created, 0 already there" in capsys.readouterr().out
+    assert main(["seed"]) == 0
+    assert "0 created, 10 already there" in capsys.readouterr().out
+
+
+def test_cli_rejects_unknown_command() -> None:
+    with pytest.raises(SystemExit) as exc:
+        main(["explode"])
+    assert exc.value.code == 2
```
