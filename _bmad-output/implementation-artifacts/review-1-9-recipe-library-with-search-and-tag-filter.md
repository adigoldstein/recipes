# Review: Story 1.9 Recipe library with search and tag filter

Status: implemented, NOT committed. Spec: `spec-1-9-recipe-library-with-search-and-tag-filter.md`. Branch on approval: `claude/story-1-9-library`, PR to main (by the coordinator; Adi merges).

Decisions D1-D8 (approved): hand-written `libs/feature-recipes`; URL state in `useLibraryFilters` with `replace`, only nonexistent tag ids ignored; `filterRecipes` in `recipe-domain`; presentational pieces in `ui-components` with one `EmptyState`; tag chips wired last; msw as an exact-pinned devDependency; error and loading behaviour as proposed; bundle measured by hand; `/` focuses the search field.

## Verification

- `nx run-many -t lint typecheck test build build-storybook` (8 projects): all pass.
- Frontend tests: feature-recipes 39 (Vitest + Testing Library + MSW), recipe-domain 13 (100% coverage, includes the 200-recipe under-100 ms test), web 22, lint-checks 76.
- Backend: ruff check and format, mypy strict, lint-imports (13 contracts kept), pytest 105 passed (8 new in `tests/test_tags_api.py`).
- `nx format:check`: clean. `nx run data-access:generate` regenerated after the endpoint; the generated diff is real (openapi.json, types, zod, sdk, react-query hooks), including `tagsListTagsOptions`.
- Bundle (gzip, measured from `nx build web`; `web:size` does not exist until Story 6.4): initial JS 147.34 kB before, 158.00 kB after (budget 200 KB). The library page is its own lazy chunk, 35.39 kB.
- Visual check against a seeded scratch database: desktop dark and phone light render correctly; typing in the search field updates `?q=`.

## Notes for the reviewer

- `GET /api/tags`: `list_all` (repository) and `TagRead` (schemas) are Adi's code (formatted by ruff); the service `list_tags` and router `list_tags` were finished by Claude. The explanation is in `explain-1-9-tags-endpoint.md`; the optional guide is `guide-1-9-tags-endpoint.md`.
- The page waits for both the recipes and the tags before showing the list, so a `?tags=` in the URL never flashes the full list. If the tags request fails, the library still works as a plain list with no tag chips.
- An existing but unpinned tag id in `?tags=` still filters (only nonexistent ids are ignored); Story 4.2 adds its removable chip.
- "הכל" looks pressed whenever no tag is selected, including while only the quick chip is on.
- Added `msw@3.0.3` (package.json, lockfile). `nx sync` added the new lib to `tsconfig.json` and `apps/web/tsconfig.app.json`.
- `libs/data-access/src/index.ts` now exports the configured `client`, only so tests can point it at MSW.
- `apps/web/src/test-setup.ts` sets a 5 s `asyncUtilTimeout`: the first render loads the lazy page chunk and was flaky on a cold run.
- Bug found in review and fixed: typing in the search field lost focus after each letter. Cause: `AppLayout` moves focus to the page `h1` on every navigation (it compared `location.key`), and each search update is a `replace` navigation with a new key, so the shell treated every keystroke as a new page. Fix: `apps/web/src/app/app-layout.tsx` now compares `location.pathname`, so only a change of page moves focus. Regression test: `apps/web/src/app/library-focus.spec.tsx` (full app shell, real library page, MSW; it failed before the fix with only the first letter kept, and also checks that focus still moves to the heading on a page change). The library's own tests render the page without the shell, which is why they missed it.
- `tools/lint-checks/src/react-compiler.spec.ts` pointed at the deleted `placeholder-home.tsx`; it now checks `app-layout.tsx`.
- `useErrorMessage` in `feature-recipes` duplicates `useApiErrorMessage` in `apps/web` (a feature lib cannot import the app). Move it to a shared place when a second feature lib needs it.
- Not in this story: "עוד תגיות" (Story 4.2), the editor-only empty state, and the detail page (the card links to `/recipes/:id`, which is not found until Story 1.10).

## Changed files

```
?? _bmad-output/implementation-artifacts/explain-1-9-tags-endpoint.md
?? _bmad-output/implementation-artifacts/guide-1-9-tags-endpoint.md
?? _bmad-output/implementation-artifacts/spec-1-9-recipe-library-with-search-and-tag-filter.md
 M apps/recipe-service/app/tags/repository.py
 M apps/recipe-service/app/tags/router.py
 M apps/recipe-service/app/tags/schemas.py
 M apps/recipe-service/app/tags/service.py
?? apps/recipe-service/tests/test_tags_api.py
 M apps/web/src/app/app-layout.tsx
?? apps/web/src/app/library-focus.spec.tsx
 D apps/web/src/app/placeholder-home.tsx
 M apps/web/src/app/router.tsx
 M apps/web/src/test-setup.ts
 M apps/web/tsconfig.app.json
 M libs/data-access/openapi.json
 M libs/data-access/src/generated/@tanstack/react-query.gen.ts
 M libs/data-access/src/generated/index.ts
 M libs/data-access/src/generated/sdk.gen.ts
 M libs/data-access/src/generated/types.gen.ts
 M libs/data-access/src/generated/zod.gen.ts
 M libs/data-access/src/index.ts
?? libs/feature-recipes/eslint.config.mjs
?? libs/feature-recipes/package.json
?? libs/feature-recipes/src/library/library-filters.spec.ts
?? libs/feature-recipes/src/library/library-filters.ts
?? libs/feature-recipes/src/library/use-error-message.ts
?? libs/feature-recipes/src/library/use-library-filters.ts
?? libs/feature-recipes/src/routes/library.spec.tsx
?? libs/feature-recipes/src/routes/library.tsx
?? libs/feature-recipes/src/testing/render-library.tsx
?? libs/feature-recipes/src/testing/server.ts
?? libs/feature-recipes/src/testing/setup.ts
?? libs/feature-recipes/tsconfig.json
?? libs/feature-recipes/tsconfig.lib.json
?? libs/feature-recipes/tsconfig.spec.json
?? libs/feature-recipes/vite.config.mts
 M libs/i18n/src/he.json
?? libs/recipe-domain/src/filter-recipes.spec.ts
?? libs/recipe-domain/src/filter-recipes.ts
 M libs/recipe-domain/src/index.ts
?? libs/ui-components/src/components/empty-state.tsx
?? libs/ui-components/src/components/library-parts.spec.tsx
?? libs/ui-components/src/components/library-parts.stories.tsx
?? libs/ui-components/src/components/recipe-card.tsx
?? libs/ui-components/src/components/search-field.tsx
?? libs/ui-components/src/components/tag-filter.tsx
 M libs/ui-components/src/components/ui/forms.stories.tsx
 M libs/ui-components/src/index.ts
 M package-lock.json
 M package.json
 M tools/lint-checks/src/react-compiler.spec.ts
 M tsconfig.json
```

## Full diffs

New files are shown as additions against `/dev/null`. `package-lock.json` is summarised, not shown.

```diff
diff --git a/apps/recipe-service/app/tags/repository.py b/apps/recipe-service/app/tags/repository.py
index 34106cb..2e016af 100644
--- a/apps/recipe-service/app/tags/repository.py
+++ b/apps/recipe-service/app/tags/repository.py
@@ -45,3 +45,12 @@ class TagRepository:
             )
         )
         return [(recipe_id, tag) for recipe_id, tag in self._session.exec(statement)]
+
+    def list_all(self) -> Sequence[Tag]:
+        """Every tag, pinned first, then by name."""
+        statement = select(Tag).order_by(
+            col(Tag.sort_order).asc().nulls_last(),
+            func.lower(col(Tag.name)),
+            col(Tag.id),
+        )
+        return self._session.exec(statement).all()
diff --git a/apps/recipe-service/app/tags/router.py b/apps/recipe-service/app/tags/router.py
index 7cea114..1a8a374 100644
--- a/apps/recipe-service/app/tags/router.py
+++ b/apps/recipe-service/app/tags/router.py
@@ -1,3 +1,15 @@
-from fastapi import APIRouter
+from typing import Annotated
+
+from fastapi import APIRouter, Depends
+
+from app.tags.schemas import TagRead
+from app.tags.service import TagService, get_tag_service
 
 router = APIRouter(prefix="/tags", tags=["tags"])
+
+ServiceDep = Annotated[TagService, Depends(get_tag_service)]
+
+
+@router.get("")
+def list_tags(service: ServiceDep) -> list[TagRead]:
+    return service.list_tags()
diff --git a/apps/recipe-service/app/tags/schemas.py b/apps/recipe-service/app/tags/schemas.py
index 742df0c..2d5c7b9 100644
--- a/apps/recipe-service/app/tags/schemas.py
+++ b/apps/recipe-service/app/tags/schemas.py
@@ -21,6 +21,12 @@ class TagRef(BaseModel):
     name: str
 
 
+class TagRead(BaseModel):
+    id: uuid.UUID
+    name: str
+    pinned: bool
+
+
 class TagInput(BaseModel):
     """A tag in a recipe write: an existing tag by id, or a name to find or create."""
 
diff --git a/apps/recipe-service/app/tags/service.py b/apps/recipe-service/app/tags/service.py
index 73003f0..e06ab48 100644
--- a/apps/recipe-service/app/tags/service.py
+++ b/apps/recipe-service/app/tags/service.py
@@ -11,7 +11,7 @@ from app.core.db import get_session
 from app.core.errors import AppError, ErrorCode
 from app.tags.models import Tag
 from app.tags.repository import TagRepository
-from app.tags.schemas import TagInput, TagRef
+from app.tags.schemas import TagInput, TagRead, TagRef
 
 
 class TagService:
@@ -29,6 +29,13 @@ class TagService:
             tags[recipe_id].append(TagRef(id=tag.id, name=tag.name))
         return tags
 
+    def list_tags(self) -> list[TagRead]:
+        """Every tag, pinned first, then by name."""
+        return [
+            TagRead(id=tag.id, name=tag.name, pinned=tag.pinned)
+            for tag in self._repository.list_all()
+        ]
+
     def assign_to_recipe(self, recipe_id: uuid.UUID, refs: Sequence[TagInput]) -> None:
         """Link the recipe to each tag, creating tags given by a new name (AD-25).
 
diff --git a/apps/web/src/app/app-layout.tsx b/apps/web/src/app/app-layout.tsx
index e3c9424..1119254 100644
--- a/apps/web/src/app/app-layout.tsx
+++ b/apps/web/src/app/app-layout.tsx
@@ -10,15 +10,17 @@ export function AppLayout() {
   const { mode, setMode } = useTheme();
   const location = useLocation();
   const main = useRef<HTMLElement>(null);
-  const shownKey = useRef(location.key);
+  const shownPath = useRef(location.pathname);
 
-  // After a navigation (not the first load), move focus to the new page's h1
-  // so screen readers announce it and keyboard users start at the content.
+  // After a navigation to another page (not the first load), move focus to the
+  // new page's h1 so screen readers announce it and keyboard users start at the
+  // content. Only the path counts: a page that keeps its state in the query
+  // string (the library's search) navigates on every keystroke and must keep focus.
   useEffect(() => {
-    if (shownKey.current === location.key) return;
-    shownKey.current = location.key;
+    if (shownPath.current === location.pathname) return;
+    shownPath.current = location.pathname;
     main.current?.querySelector('h1')?.focus();
-  }, [location.key]);
+  }, [location.pathname]);
 
   return (
     <div className="min-h-dvh bg-background text-foreground">
diff --git a/apps/web/src/app/placeholder-home.tsx b/apps/web/src/app/placeholder-home.tsx
deleted file mode 100644
index 6256fbd..0000000
--- a/apps/web/src/app/placeholder-home.tsx
+++ /dev/null
@@ -1,13 +0,0 @@
-import { useTranslation } from 'react-i18next';
-import { PageHeading } from './page-heading';
-
-// Stands in for the recipe library page until it lands in its feature lib (1.9).
-export function PlaceholderHome() {
-  const { t } = useTranslation();
-  return (
-    <>
-      <title>{t('app.name')}</title>
-      <PageHeading>{t('home.title')}</PageHeading>
-    </>
-  );
-}
diff --git a/apps/web/src/app/router.tsx b/apps/web/src/app/router.tsx
index 7b73986..976dd7f 100644
--- a/apps/web/src/app/router.tsx
+++ b/apps/web/src/app/router.tsx
@@ -13,9 +13,8 @@ export const routes: RouteObject[] = [
     children: [
       {
         index: true,
-        lazy: async () => ({
-          Component: (await import('./placeholder-home')).PlaceholderHome,
-        }),
+        // The page is its own chunk, loaded when the route first matches (AD-11).
+        lazy: () => import('@bite-and-board/feature-recipes/library'),
       },
       // Inside the layout, so the top bar stays on unknown paths.
       { path: '*', Component: NotFound },
diff --git a/apps/web/src/test-setup.ts b/apps/web/src/test-setup.ts
index 32c4a1b..c17eab0 100644
--- a/apps/web/src/test-setup.ts
+++ b/apps/web/src/test-setup.ts
@@ -1,3 +1,8 @@
+import { configure } from '@testing-library/react';
+
+// The first render loads the lazy page chunk, which is slow on a cold test run.
+configure({ asyncUtilTimeout: 5000 });
+
 type Listener = (event: MediaQueryListEvent) => void;
 
 const listeners = new Set<Listener>();
diff --git a/apps/web/tsconfig.app.json b/apps/web/tsconfig.app.json
index 0a7865d..938d459 100644
--- a/apps/web/tsconfig.app.json
+++ b/apps/web/tsconfig.app.json
@@ -40,6 +40,9 @@
     {
       "path": "../../libs/data-access/tsconfig.lib.json"
     },
+    {
+      "path": "../../libs/feature-recipes/tsconfig.lib.json"
+    },
     {
       "path": "../../libs/i18n/tsconfig.lib.json"
     },
diff --git a/libs/data-access/openapi.json b/libs/data-access/openapi.json
index 74db80e..faa96a2 100644
--- a/libs/data-access/openapi.json
+++ b/libs/data-access/openapi.json
@@ -462,6 +462,30 @@
         "title": "StepRead",
         "type": "object"
       },
+      "TagRead": {
+        "properties": {
+          "id": {
+            "format": "uuid",
+            "title": "Id",
+            "type": "string"
+          },
+          "name": {
+            "title": "Name",
+            "type": "string"
+          },
+          "pinned": {
+            "title": "Pinned",
+            "type": "boolean"
+          }
+        },
+        "required": [
+          "id",
+          "name",
+          "pinned"
+        ],
+        "title": "TagRead",
+        "type": "object"
+      },
       "TagRef": {
         "description": "A tag as embedded in recipe read schemas (AD-20).",
         "properties": {
@@ -647,6 +671,31 @@
           "recipes"
         ]
       }
+    },
+    "/api/tags": {
+      "get": {
+        "operationId": "tags_list_tags",
+        "responses": {
+          "200": {
+            "content": {
+              "application/json": {
+                "schema": {
+                  "items": {
+                    "$ref": "#/components/schemas/TagRead"
+                  },
+                  "title": "Response Tags List Tags",
+                  "type": "array"
+                }
+              }
+            },
+            "description": "Successful Response"
+          }
+        },
+        "summary": "List Tags",
+        "tags": [
+          "tags"
+        ]
+      }
     }
   }
 }
diff --git a/libs/data-access/src/generated/@tanstack/react-query.gen.ts b/libs/data-access/src/generated/@tanstack/react-query.gen.ts
index 3710534..7f4b296 100644
--- a/libs/data-access/src/generated/@tanstack/react-query.gen.ts
+++ b/libs/data-access/src/generated/@tanstack/react-query.gen.ts
@@ -3,8 +3,8 @@
 import { type DefaultError, queryOptions } from '@tanstack/react-query';
 
 import { client } from '../client.gen.js';
-import { healthGetHealth, type Options, recipesGetRecipe, recipesListRecipes } from '../sdk.gen.js';
-import type { HealthGetHealthData, HealthGetHealthResponse, RecipesGetRecipeData, RecipesGetRecipeError, RecipesGetRecipeResponse, RecipesListRecipesData, RecipesListRecipesResponse } from '../types.gen.js';
+import { healthGetHealth, type Options, recipesGetRecipe, recipesListRecipes, tagsListTags } from '../sdk.gen.js';
+import type { HealthGetHealthData, HealthGetHealthResponse, RecipesGetRecipeData, RecipesGetRecipeError, RecipesGetRecipeResponse, RecipesListRecipesData, RecipesListRecipesResponse, TagsListTagsData, TagsListTagsResponse } from '../types.gen.js';
 
 export type QueryKey<TOptions extends Options> = [
     Pick<TOptions, 'baseUrl' | 'body' | 'headers' | 'path' | 'query'> & {
@@ -92,3 +92,21 @@ export const recipesGetRecipeOptions = (options: Options<RecipesGetRecipeData>)
     },
     queryKey: recipesGetRecipeQueryKey(options)
 });
+
+export const tagsListTagsQueryKey = (options?: Options<TagsListTagsData>) => createQueryKey('tagsListTags', options);
+
+/**
+ * List Tags
+ */
+export const tagsListTagsOptions = (options?: Options<TagsListTagsData>) => queryOptions<TagsListTagsResponse, DefaultError, TagsListTagsResponse, ReturnType<typeof tagsListTagsQueryKey>>({
+    queryFn: async ({ queryKey, signal }) => {
+        const { data } = await tagsListTags({
+            ...options,
+            ...queryKey[0],
+            signal,
+            throwOnError: true
+        });
+        return data;
+    },
+    queryKey: tagsListTagsQueryKey(options)
+});
diff --git a/libs/data-access/src/generated/index.ts b/libs/data-access/src/generated/index.ts
index 3c92275..3a9cf64 100644
--- a/libs/data-access/src/generated/index.ts
+++ b/libs/data-access/src/generated/index.ts
@@ -1,4 +1,4 @@
 // This file is auto-generated by @hey-api/openapi-ts
 
-export { healthGetHealth, type Options, recipesGetRecipe, recipesListRecipes } from './sdk.gen.js';
-export type { ClientOptions, ErrorCode, ErrorResponse, HealthGetHealthData, HealthGetHealthResponse, HealthGetHealthResponses, HealthRead, HttpValidationError, IngredientRead, OriginalValue, PhotoRead, RecipeRead, RecipesGetRecipeData, RecipesGetRecipeError, RecipesGetRecipeErrors, RecipesGetRecipeResponse, RecipesGetRecipeResponses, RecipesListRecipesData, RecipesListRecipesResponse, RecipesListRecipesResponses, RecipeSummary, SourceUnit, SourceValue, StepRead, TagRef, Unit, ValidationError } from './types.gen.js';
+export { healthGetHealth, type Options, recipesGetRecipe, recipesListRecipes, tagsListTags } from './sdk.gen.js';
+export type { ClientOptions, ErrorCode, ErrorResponse, HealthGetHealthData, HealthGetHealthResponse, HealthGetHealthResponses, HealthRead, HttpValidationError, IngredientRead, OriginalValue, PhotoRead, RecipeRead, RecipesGetRecipeData, RecipesGetRecipeError, RecipesGetRecipeErrors, RecipesGetRecipeResponse, RecipesGetRecipeResponses, RecipesListRecipesData, RecipesListRecipesResponse, RecipesListRecipesResponses, RecipeSummary, SourceUnit, SourceValue, StepRead, TagRead, TagRef, TagsListTagsData, TagsListTagsResponse, TagsListTagsResponses, Unit, ValidationError } from './types.gen.js';
diff --git a/libs/data-access/src/generated/sdk.gen.ts b/libs/data-access/src/generated/sdk.gen.ts
index cbff2e2..d55f038 100644
--- a/libs/data-access/src/generated/sdk.gen.ts
+++ b/libs/data-access/src/generated/sdk.gen.ts
@@ -2,7 +2,7 @@
 
 import { client } from './client.gen.js';
 import type { Client, ClientMeta, Options as Options2, RequestResult, TDataShape } from './client/index.js';
-import type { HealthGetHealthData, HealthGetHealthResponses, RecipesGetRecipeData, RecipesGetRecipeErrors, RecipesGetRecipeResponses, RecipesListRecipesData, RecipesListRecipesResponses } from './types.gen.js';
+import type { HealthGetHealthData, HealthGetHealthResponses, RecipesGetRecipeData, RecipesGetRecipeErrors, RecipesGetRecipeResponses, RecipesListRecipesData, RecipesListRecipesResponses, TagsListTagsData, TagsListTagsResponses } from './types.gen.js';
 
 export type Options<TData extends TDataShape = TDataShape, ThrowOnError extends boolean = boolean, TResponse = unknown> = Options2<TData, ThrowOnError, TResponse> & {
     /**
@@ -32,3 +32,8 @@ export const recipesListRecipes = <ThrowOnError extends boolean = false>(options
  * Get Recipe
  */
 export const recipesGetRecipe = <ThrowOnError extends boolean = false>(options: Options<RecipesGetRecipeData, ThrowOnError>): RequestResult<RecipesGetRecipeResponses, RecipesGetRecipeErrors, ThrowOnError> => (options.client ?? client).get<RecipesGetRecipeResponses, RecipesGetRecipeErrors, ThrowOnError>({ url: '/api/recipes/{recipe_id}', ...options });
+
+/**
+ * List Tags
+ */
+export const tagsListTags = <ThrowOnError extends boolean = false>(options?: Options<TagsListTagsData, ThrowOnError>): RequestResult<TagsListTagsResponses, unknown, ThrowOnError> => (options?.client ?? client).get<TagsListTagsResponses, unknown, ThrowOnError>({ url: '/api/tags', ...options });
diff --git a/libs/data-access/src/generated/types.gen.ts b/libs/data-access/src/generated/types.gen.ts
index 9722e99..77c6561 100644
--- a/libs/data-access/src/generated/types.gen.ts
+++ b/libs/data-access/src/generated/types.gen.ts
@@ -232,6 +232,24 @@ export type StepRead = {
     source_text: string | null;
 };
 
+/**
+ * TagRead
+ */
+export type TagRead = {
+    /**
+     * Id
+     */
+    id: string;
+    /**
+     * Name
+     */
+    name: string;
+    /**
+     * Pinned
+     */
+    pinned: boolean;
+};
+
 /**
  * TagRef
  *
@@ -348,3 +366,21 @@ export type RecipesGetRecipeResponses = {
 };
 
 export type RecipesGetRecipeResponse = RecipesGetRecipeResponses[keyof RecipesGetRecipeResponses];
+
+export type TagsListTagsData = {
+    body?: never;
+    path?: never;
+    query?: never;
+    url: '/api/tags';
+};
+
+export type TagsListTagsResponses = {
+    /**
+     * Response Tags List Tags
+     *
+     * Successful Response
+     */
+    200: Array<TagRead>;
+};
+
+export type TagsListTagsResponse = TagsListTagsResponses[keyof TagsListTagsResponses];
diff --git a/libs/data-access/src/generated/zod.gen.ts b/libs/data-access/src/generated/zod.gen.ts
index 313fe67..ab1ad6f 100644
--- a/libs/data-access/src/generated/zod.gen.ts
+++ b/libs/data-access/src/generated/zod.gen.ts
@@ -69,6 +69,15 @@ export const zStepRead = z.object({
     source_text: z.string().nullable()
 });
 
+/**
+ * TagRead
+ */
+export const zTagRead = z.object({
+    id: z.uuid(),
+    name: z.string(),
+    pinned: z.boolean()
+});
+
 /**
  * TagRef
  *
@@ -193,3 +202,10 @@ export const zRecipesGetRecipePath = z.object({
  * Successful Response
  */
 export const zRecipesGetRecipeResponse = zRecipeRead;
+
+/**
+ * Response Tags List Tags
+ *
+ * Successful Response
+ */
+export const zTagsListTagsResponse = z.array(zTagRead);
diff --git a/libs/data-access/src/index.ts b/libs/data-access/src/index.ts
index 00222fa..1fa637f 100644
--- a/libs/data-access/src/index.ts
+++ b/libs/data-access/src/index.ts
@@ -5,6 +5,8 @@ configureClient();
 export * from './generated';
 export * from './generated/@tanstack/react-query.gen';
 export * as schemas from './generated/zod.gen';
+// The configured client instance, for tests that point it at a mock server.
+export { client } from './generated/client.gen';
 export { CSRF_HEADER, CSRF_VALUE, configureClient } from './client';
 export { getErrorCode } from './errors';
 export { invalidationMap, type Invalidator } from './invalidation';
diff --git a/libs/i18n/src/he.json b/libs/i18n/src/he.json
index e85d70f..96e2929 100644
--- a/libs/i18n/src/he.json
+++ b/libs/i18n/src/he.json
@@ -13,8 +13,39 @@
   "toast": {
     "region": "התראות"
   },
-  "home": {
-    "title": "מתכונים"
+  "library": {
+    "title": "מתכונים",
+    "search": {
+      "label": "חיפוש מתכונים",
+      "placeholder": "חיפוש מתכונים",
+      "clear": "ניקוי שדה החיפוש"
+    },
+    "filter": {
+      "label": "סינון לפי תגיות",
+      "all": "הכל",
+      "fast": "עד 30 דקות"
+    },
+    "loading": "טוען מתכונים",
+    "empty": {
+      "title": "עוד אין כאן מתכונים"
+    },
+    "noResults": {
+      "title": "לא נמצאו מתכונים ל־'{{q}}'",
+      "titleFilter": "לא נמצאו מתכונים מתאימים",
+      "clearSearch": "ניקוי החיפוש",
+      "clearFilter": "ניקוי הסינון"
+    },
+    "error": {
+      "retry": "לנסות שוב"
+    },
+    "card": {
+      "minutes": "{{minutes}} דק׳",
+      "hours": "{{hours}} שע׳",
+      "hoursMinutes": "{{hours}} שע׳ {{minutes}} דק׳",
+      "moreTags_one": "תגית נוספת אחת",
+      "moreTags_two": "שתי תגיות נוספות",
+      "moreTags_other": "{{count}} תגיות נוספות"
+    }
   },
   "notFound": {
     "title": "הדף לא נמצא",
diff --git a/libs/recipe-domain/src/index.ts b/libs/recipe-domain/src/index.ts
index cb0ff5c..46e78af 100644
--- a/libs/recipe-domain/src/index.ts
+++ b/libs/recipe-domain/src/index.ts
@@ -1 +1,6 @@
-export {};
+export {
+  FAST_MINUTES,
+  filterRecipes,
+  type FilterableRecipe,
+  type RecipeFilter,
+} from './filter-recipes.js';
diff --git a/libs/ui-components/src/components/ui/forms.stories.tsx b/libs/ui-components/src/components/ui/forms.stories.tsx
index 2f998fb..5a679f1 100644
--- a/libs/ui-components/src/components/ui/forms.stories.tsx
+++ b/libs/ui-components/src/components/ui/forms.stories.tsx
@@ -49,14 +49,17 @@ export const SkeletonCards: Story = {
   ),
 };
 
-export const MealTypeChips: Story = {
+export const TagChips: Story = {
   name: 'ToggleGroup',
   render: () => (
-    <ToggleGroup type="single" defaultValue="all" aria-label="סוג ארוחה">
-      <ToggleGroupItem value="all">הכל</ToggleGroupItem>
-      <ToggleGroupItem value="breakfast">בוקר</ToggleGroupItem>
-      <ToggleGroupItem value="lunch">צהריים</ToggleGroupItem>
-      <ToggleGroupItem value="dinner">ערב</ToggleGroupItem>
+    <ToggleGroup
+      type="multiple"
+      defaultValue={['quick']}
+      aria-label="סינון לפי תגיות"
+    >
+      <ToggleGroupItem value="quick">מהיר</ToggleGroupItem>
+      <ToggleGroupItem value="grill">על האש</ToggleGroupItem>
+      <ToggleGroupItem value="party">מסיבות</ToggleGroupItem>
       <ToggleGroupItem value="dessert">קינוח</ToggleGroupItem>
     </ToggleGroup>
   ),
diff --git a/libs/ui-components/src/index.ts b/libs/ui-components/src/index.ts
index 874074d..94e2eb6 100644
--- a/libs/ui-components/src/index.ts
+++ b/libs/ui-components/src/index.ts
@@ -19,3 +19,16 @@ export * from './components/ui/skeleton';
 export * from './components/ui/sonner';
 export * from './components/ui/table';
 export * from './components/ui/toggle-group';
+export {
+  CARD_TAG_LIMIT,
+  RecipeCard,
+  RecipeCardSkeleton,
+  type RecipeCardProps,
+} from './components/recipe-card';
+export { SearchField, type SearchFieldProps } from './components/search-field';
+export {
+  TagFilter,
+  type TagFilterOption,
+  type TagFilterProps,
+} from './components/tag-filter';
+export { EmptyState, type EmptyStateProps } from './components/empty-state';
(package-lock.json: msw 3.0.3 and its dependencies added; 492 lines, not shown)
diff --git a/package.json b/package.json
index 06f2d9c..9d0fda7 100644
--- a/package.json
+++ b/package.json
@@ -48,6 +48,7 @@
     "eslint-plugin-react-hooks": "7.1.1",
     "jiti": "2.4.2",
     "jsdom": "^27.1.0",
+    "msw": "3.0.3",
     "nx": "24.0.0",
     "prettier": "^3.8.1",
     "shadcn": "4.22.1",
diff --git a/tools/lint-checks/src/react-compiler.spec.ts b/tools/lint-checks/src/react-compiler.spec.ts
index 010aa60..46a12f2 100644
--- a/tools/lint-checks/src/react-compiler.spec.ts
+++ b/tools/lint-checks/src/react-compiler.spec.ts
@@ -15,9 +15,7 @@ it('compiles app components with the React Compiler', async () => {
     server: { middlewareMode: true, hmr: false },
   });
   try {
-    const result = await server.transformRequest(
-      '/src/app/placeholder-home.tsx',
-    );
+    const result = await server.transformRequest('/src/app/app-layout.tsx');
     expect(result?.code).toMatch(COMPILED);
   } finally {
     await server.close();
diff --git a/tsconfig.json b/tsconfig.json
index d74ef07..9cb9e7a 100644
--- a/tsconfig.json
+++ b/tsconfig.json
@@ -20,6 +20,9 @@
     },
     {
       "path": "./libs/i18n"
+    },
+    {
+      "path": "./libs/feature-recipes"
     }
   ],
   "compilerOptions": {}
diff --git a/_bmad-output/implementation-artifacts/explain-1-9-tags-endpoint.md b/_bmad-output/implementation-artifacts/explain-1-9-tags-endpoint.md
new file mode 100644
index 0000000..031ed46
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/explain-1-9-tags-endpoint.md
@@ -0,0 +1,167 @@
+# הסבר: נקודת הקצה `GET /api/tags`, שורה אחרי שורה
+
+המטרה של הנקודה: להחזיר ל־frontend את כל התגיות כ־`[{id, name, pinned}]`, לפי סדר התצוגה (המוצמדות קודם), ואז לפי שם.
+
+ההשוואות כאן הן ל־NestJS, TypeORM ו־Angular, כי זה העולם שמוכר. הן קירוב, לא זהות מדויקת.
+
+## מבט על: מי עושה מה
+
+```text
+בקשה  GET /api/tags
+  │
+  ▼
+router.py       ← מקבל את הבקשה, מחזיר תשובה        (Controller ב־Nest)
+  │  קורא ל־
+  ▼
+service.py      ← ממיר מהטבלה אל צורת ה־API          (Service / Provider)
+  │  קורא ל־
+  ▼
+repository.py   ← היחיד שמדבר עם ה־DB                (Repository ב־TypeORM)
+  │  קורא ל־
+  ▼
+models.py       ← הטבלה `tag` ב־SQLite               (Entity)
+```
+
+הכיוון חד־כיווני: router מכיר רק את ה־service, ו־service מכיר רק את ה־repository. ה־router לא נוגע ב־DB בעצמו (כלל AD-1 בארכיטקטורה).
+
+כל השכבות בתיקייה `apps/recipe-service/app/tags/`. את `recipes/` אפשר לקרוא כדוגמה: אותו מבנה בדיוק.
+
+## 1. טבלה לעומת סכמה (`models.py` מול `schemas.py`)
+
+**הטבלה: `Tag` ב־`models.py`** (Entity)
+
+```python
+class Tag(SQLModel, table=True):
+    __tablename__ = "tag"
+    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
+    name: str = Field(max_length=40)
+    pinned: bool = Field(default=False, ...)
+    sort_order: int | None = None
+```
+
+- `table=True` אומר: המחלקה הזאת מייצגת טבלה אמיתית ב־DB.
+- כל שדה הוא עמודה. `Tag` אחד הוא שורה אחת בטבלה.
+- `sort_order: int | None` אומר שמותר שיהיה ריק (NULL). לתגיות המוצמדות יש מספר (0 עד 12), ולשאר אין.
+- בצד ה־Entity ב־TypeORM זה `@Entity() class Tag { @PrimaryGeneratedColumn() id; @Column() name; ... }`.
+
+**הסכמה: `TagRead` ב־`schemas.py`** (DTO)
+
+```python
+class TagRead(BaseModel):
+    id: uuid.UUID
+    name: str
+    pinned: bool
+```
+
+- זו מחלקת Pydantic רגילה, בלי DB. היא מתארת את ה־**JSON שיוצא מה־API**.
+- שימו לב: אין בה `sort_order`. ה־frontend לא צריך אותו, ולכן לא חושפים אותו.
+- ב־Nest/Angular זה ה־DTO או ה־interface שה־frontend מקבל.
+
+**למה שתי מחלקות?** כדי ששינוי בטבלה (למשל עמודה חדשה) לא ישנה בטעות את ה־API, ולהפך. ה־service הוא זה שמתרגם ביניהן.
+
+דוגמה לשימוש: אילו `TagRead` היה שולח את `sort_order`, ה־frontend היה מקבל שדה שלא ביקש, והיה תלוי בו בטעות.
+
+## 2. ה־repository: `list_all()`
+
+```python
+def list_all(self) -> Sequence[Tag]:
+    """Every tag, pinned first, then by name."""
+    statement = select(Tag).order_by(
+        col(Tag.sort_order).asc().nulls_last(),
+        func.lower(col(Tag.name)),
+        col(Tag.id),
+    )
+    return self._session.exec(statement).all()
+```
+
+- `def list_all(self) -> Sequence[Tag]:` מתודה במחלקה `TagRepository`. `self` הוא ה־`this`. `-> Sequence[Tag]` אומר שהיא מחזירה רצף של `Tag`, וזה מה ש־mypy בודק.
+- `select(Tag)` הוא `SELECT * FROM tag`: כל התגיות, בלי `WHERE`.
+- `.order_by(a, b, c)` הוא `ORDER BY a, b, c`. ממיינים לפי a. אם שתי שורות שוות ב־a, מכריעים לפי b. אם גם b שווה, לפי c. הפסיקים הם מפרידים בין מפתחות המיון.
+
+שלושת המפתחות:
+
+1. `col(Tag.sort_order).asc().nulls_last()`
+   - `asc()` הוא עולה: 0, 1, 2...
+   - `nulls_last()` שם את הריקים (NULL) בסוף. רק למוצמדות יש `sort_order`, לכן הן יוצאות קודם, בסדר התצוגה שהוגדר להן. האחרות באות אחריהן.
+2. `func.lower(col(Tag.name))`
+   - `lower` הופך את השם לאותיות קטנות רק לצורך ההשוואה. הערך עצמו לא משתנה.
+   - בלעדיו, אות גדולה באנגלית ("Cherry") הייתה ממוינת לפני אות קטנה ("banana"). בעברית אין אותיות גדולות, ואין הבדל.
+   - זה אותו מיון שכבר מופיע ב־`list_for_recipes` ובתגיות שמוטמעות בכל מתכון (AD-20).
+3. `col(Tag.id)`
+   - ה־`id` ייחודי. הוא שובר שוויון: אם שתי תגיות זהות בשני המפתחות הראשונים, ה־`id` קובע ביניהן סדר קבוע. בלעדיו הסדר ביניהן עלול להשתנות בין הרצות, והבדיקות היו הופכות ללא יציבות.
+
+**מה זה `col(...)`?** `Tag.sort_order` מוגדר בקוד כ־`int | None`, כלומר mypy רואה מספר ולא עמודה. `col()` אומר: "תתייחס לזה כאל עמודה ב־DB", וכך אפשר לקרוא עליה `.asc()` ולהעביר אותה ל־`lower`. אין צורך להעמיק בזה.
+
+- `self._session.exec(statement)` מריץ את השאילתה על ה־DB. `self._session` הוא החיבור, כמו ה־`EntityManager` ב־TypeORM.
+- `.all()` מחזיר רשימה של כל השורות כאובייקטי `Tag`.
+
+## 3. ה־service: `list_tags()`
+
+```python
+def list_tags(self) -> list[TagRead]:
+    """Every tag, pinned first, then by name."""
+    return [
+        TagRead(id=tag.id, name=tag.name, pinned=tag.pinned)
+        for tag in self._repository.list_all()
+    ]
+```
+
+- ה־service מקבל `TagRepository` בבנאי (`self._repository`), בדיוק כמו Provider שמקבל תלות ב־Nest.
+- `self._repository.list_all()` מחזיר רשימת `Tag` (טבלאות).
+- ה־list comprehension בונה מכל `Tag` אובייקט `TagRead` חדש, בשלושת השדות. זה המעבר מ־Entity ל־DTO.
+- השורה `[... for tag in ...]` שקולה ל־`.map(tag => new TagRead(...))` ב־TypeScript.
+
+באותו קובץ `get_tags` עושה את אותו דבר עבור תגיות של מתכונים, עם `TagRef`.
+
+## 4. ה־router: `list_tags` ו־`Depends`
+
+```python
+ServiceDep = Annotated[TagService, Depends(get_tag_service)]
+
+@router.get("")
+def list_tags(service: ServiceDep) -> list[TagRead]:
+    return service.list_tags()
+```
+
+- `router = APIRouter(prefix="/tags", tags=["tags"])` (כבר קיים בקובץ): כל נתיב בקובץ מתחיל ב־`/tags`, ו־`main.py` מוסיף לפניו `/api`. לכן `@router.get("")` נהיה `GET /api/tags`. הסימן `""` הוא "בלי המשך".
+- `@router.get(...)` הוא Decorator, כמו `@Get()` ב־Nest.
+- **`Depends`** הוא ה־Dependency Injection של FastAPI. `Depends(get_tag_service)` אומר: "לפני שתקרא לפונקציה, תריץ את `get_tag_service` (שבונה `TagService` עם `TagRepository` ועם session של DB), ותעביר לי את התוצאה". כמו שה־constructor injection ב־Nest מזריק Provider.
+- `Annotated[TagService, Depends(get_tag_service)]` הוא סוג מוצהר בשורה אחת: "פרמטר מסוג `TagService` שמגיע מ־`Depends`". נותנים לו שם, `ServiceDep`, כדי לא לחזור עליו בכל נקודה. זה בדיוק מה ש־`recipes/router.py` עושה.
+- `-> list[TagRead]` הוא טיפוס ההחזרה, והוא גם ה־**response model**: FastAPI משתמש בו כדי לתעד את התשובה ב־OpenAPI ולהמיר את התוצאה ל־JSON. אין צורך בפרמטר `response_model` נפרד.
+- ה־router לא מכיל לוגיקה. הוא רק קורא ל־`service.list_tags()` ומחזיר.
+
+### שם הפונקציה קובע את שם ה־hook
+
+ב־`main.py` יש `generate_operation_id` שמחבר `{tag}_{function}`. כאן ה־tag הוא `tags` והפונקציה היא `list_tags`, ולכן ה־`operationId` של הנקודה הוא **`tags_list_tags`**. הבדיקה `test_operation_id_and_response_schema_are_published` מוודאת את זה.
+
+השם הזה לא סתם: מכאן נוצר שם ה־hook בצד ה־frontend (ראו הסעיף הבא). לכן מקפידים על שמות `verb_noun` לפונקציות הנתיב.
+
+## 5. איך ה־frontend מקבל את `tagsListTagsOptions`
+
+אף שורה בצד ה־frontend לא נכתבת ביד. הכול נוצר מהנקודה:
+
+1. **`nx run recipe-service:openapi`** מייצר את `libs/data-access/openapi.json`: תיאור מלא של ה־API (נתיבים, סוגים, שמות פעולות) ישירות מקוד ה־FastAPI, בלי להריץ שרת ובלי DB.
+2. **`openapi-ts`** (hey-api) קורא את הקובץ הזה ומייצר ב־`libs/data-access/src/generated`:
+   - את הטיפוס `TagRead` (מ־`TagRead` ב־Pydantic): `{ id: string; name: string; pinned: boolean }`.
+   - פונקציית קריאה `tagsListTags()` ל־`GET /api/tags`.
+   - את ה־hook helpers של TanStack Query: **`tagsListTagsOptions()`** ו־`tagsListTagsQueryKey()`, בשם שנגזר מ־`operationId` (`tags_list_tags` ← `tagsListTags` + `Options`).
+3. הפקודה `npx nx run data-access:generate` עושה את שני השלבים יחד. ב־CI מריצים אותה שוב ובודקים ש־`git diff` נקי, כך שה־frontend והשרת לעולם לא יסטו זה מזה.
+
+ובדף הספרייה (`libs/feature-recipes`), השימוש הוא:
+
+```ts
+const tags = useQuery(tagsListTagsOptions());
+```
+
+`tags.data` הוא `TagRead[]`, כבר ממוין. הדף מציג ממנו את צ'יפים של התגיות המוצמדות (`pinned`), ובודק ש־id שמופיע ב־URL (`?tags=`) קיים באמת.
+
+## סיכום: מסלול של בקשה אחת
+
+1. הדפדפן שולח `GET /api/tags`.
+2. FastAPI מוצא את `list_tags` ב־`tags/router.py`, ומריץ קודם את `Depends` שבונה `TagService`.
+3. ה־router קורא ל־`service.list_tags()`.
+4. ה־service קורא ל־`repository.list_all()`.
+5. ה־repository מריץ `SELECT * FROM tag ORDER BY ...` ומחזיר רשימת `Tag`.
+6. ה־service ממיר כל `Tag` ל־`TagRead`, והרשימה חוזרת ל־router.
+7. FastAPI ממיר את הרשימה ל־JSON, לפי `list[TagRead]`.
+8. ה־frontend מקבל `[{id, name, pinned}, ...]` דרך `tagsListTagsOptions`.
diff --git a/_bmad-output/implementation-artifacts/guide-1-9-tags-endpoint.md b/_bmad-output/implementation-artifacts/guide-1-9-tags-endpoint.md
new file mode 100644
index 0000000..f6d3575
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/guide-1-9-tags-endpoint.md
@@ -0,0 +1,71 @@
+# מדריך: כתיבת `GET /api/tags` (סטורי 1.9)
+
+המטרה: נקודת קצה ציבורית שמחזירה את כל התגיות כ־`[{id, name, pinned}]`, ממוינות לפי `sort_order` (המוצמדות קודם), ואחר כך לפי שם.
+
+הבדיקות כבר כתובות ב־`apps/recipe-service/tests/test_tags_api.py` והן נכשלות עד שהנקודה קיימת. זו כל המשימה: להפוך אותן לירוקות.
+
+הרעיון המרכזי (כמו ב־NestJS): **router ← service ← repository**, והחיבור ביניהם דרך `Depends`. הדוגמה לחיקוי היא מודול `recipes` (`list_recipes`), ולצדה `tags/repository.py` שכבר מכיל שאילתת מיון דומה (`list_for_recipes`).
+
+## השלבים (סדר מומלץ: מלמטה למעלה)
+
+### 1. הסכמה: `app/tags/schemas.py`
+
+להוסיף מחלקת `TagRead(BaseModel)` עם שלושה שדות: `id: uuid.UUID`, `name: str`, `pinned: bool`.
+זה כמו `TagRef` שכבר קיימת בקובץ, בתוספת `pinned`. השם `TagRead` חשוב: הבדיקה בודקת אותו ב־OpenAPI, ומכאן ייווצר הטיפוס בצד ה־frontend.
+
+### 2. ה־repository: `app/tags/repository.py`
+
+להוסיף למחלקה `TagRepository` מתודה, למשל `list_all(self) -> Sequence[Tag]`, שמחזירה את כל התגיות.
+את ה־`order_by` אפשר להעתיק מ־`list_for_recipes`: `sort_order` עולה עם `nulls_last()`, אחר כך `func.lower(col(Tag.name))`, ובסוף `col(Tag.id)` כמפתח שובר־שוויון.
+ה־repository מדבר עם ה־DB בלבד: בלי לוגיקה עסקית ובלי schemas של API.
+
+### 3. ה־service: `app/tags/service.py`
+
+להוסיף ל־`TagService` מתודה `list_tags(self) -> list[TagRead]` שקוראת ל־`self._repository.list_all()` וממירה כל `Tag` ל־`TagRead(id=..., name=..., pinned=...)`.
+כך ה־service מחזיר schemas ולא טבלאות (מודלים של DB). הוא כבר מקבל את ה־repository בבנאי, ו־`get_tag_service` כבר קיים בתחתית הקובץ.
+
+### 4. ה־router: `app/tags/router.py`
+
+כרגע יש שם רק `router = APIRouter(prefix="/tags", tags=["tags"])`. להוסיף, בדומה ל־`app/recipes/router.py`:
+
+- הגדרת תלות: `ServiceDep = Annotated[TagService, Depends(get_tag_service)]`
+- פונקציה `list_tags(service: ServiceDep) -> list[TagRead]` עם הדקורטור `@router.get("")`
+
+שני דברים שכדאי להבין:
+
+- **שם הפונקציה קובע את שם ה־hook.** ה־`operationId` נבנה כ־`{tag}_{function}`, כלומר `tags_list_tags`, ומכאן ה־hook שנוצר בצד ה־frontend. לכן השם `list_tags` הוא לא סתם העדפה.
+- **טיפוס ההחזרה (`-> list[TagRead]`) הוא ה־response model.** FastAPI לוקח אותו לתיעוד ה־OpenAPI ולסינון התשובה, בלי `response_model=` נפרד.
+
+### 5. רישום ב־`main.py`: אין מה לעשות
+
+`tags_router` כבר רשום ב־`ROUTERS` ב־`app/main.py`. כל מה שנוסף ל־`router` ב־`tags/router.py` נכנס לאפליקציה אוטומטית. כדאי להיכנס לקובץ ולראות איך זה עובד.
+
+## בדיקה
+
+מתוך `apps/recipe-service`:
+
+```bash
+uv run pytest tests/test_tags_api.py
+```
+
+כשהכול ירוק, להריץ את כל הבדיקות והכלים:
+
+```bash
+npx nx run-many -t lint typecheck test -p recipe-service
+```
+
+טיפים לתקלות:
+
+- `404` בבדיקות: הנתיב לא נרשם. לבדוק שהדקורטור הוא `@router.get("")` ולא `"/"`.
+- `KeyError: '/api/tags'` בבדיקת ה־OpenAPI: אותה סיבה.
+- `mypy`: לוודא שיש טיפוס החזרה מפורש לכל פונקציה.
+
+## אחרי שהנקודה עובדת
+
+לעדכן את ה־frontend (מייצר מחדש את `openapi.json` ואת ה־hooks, כולל `tagsListTagsOptions`):
+
+```bash
+npx nx run data-access:generate
+```
+
+ואז לעדכן אותי, ואני ממשיך לחבר את שורת הצ'יפים של התגיות בספרייה.
diff --git a/_bmad-output/implementation-artifacts/spec-1-9-recipe-library-with-search-and-tag-filter.md b/_bmad-output/implementation-artifacts/spec-1-9-recipe-library-with-search-and-tag-filter.md
new file mode 100644
index 0000000..53a004d
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-1-9-recipe-library-with-search-and-tag-filter.md
@@ -0,0 +1,59 @@
+# Spec: Story 1.9 Recipe library with search and tag filter
+
+Source: `planning-artifacts/epics.md` (Story 1.9), ARCHITECTURE-SPINE AD-2, AD-8, AD-11, AD-19, AD-26, AD-32, AD-33; EXPERIENCE.md (Component Patterns, States); UX-DR6, 7, 11, 17, 20.
+Status: DRAFT. Open decisions D1-D8 below are with Adi (via coordinator); nothing is implemented yet except the backend tests.
+
+## Goal
+
+`/` shows the recipe library: cards newest first, search by title, pinned-tag chips (AND), a "עד 30 דקות" chip, all kept in the URL. The page lives in a new `libs/feature-recipes` and replaces the placeholder home route.
+
+## Split of work
+
+- **Adi writes** `GET /api/tags` (learning exercise): `TagRead` schema, repository `list_all`, service `list_tags`, router `list_tags`. Guide: `guide-1-9-tags-endpoint.md`.
+- **Claude writes** (done): `apps/recipe-service/tests/test_tags_api.py` (8 tests, red until Adi's endpoint exists; verified green against a throwaway reference implementation that was reverted).
+- **Claude writes** (after D1-D8 are answered): everything on the frontend.
+- **Regenerate** after Adi's endpoint: `nx run data-access:generate` (creates `tagsListTagsOptions`, `TagRead` type and Zod schema).
+
+## Design (proposed, see decisions)
+
+### `libs/recipe-domain` (type:domain, 100% coverage)
+
+`filterRecipes(recipes, { query, tagIds, fastOnly })`, pure, generic over a structural type `{ title: string; tags: { id: string }[]; total_minutes: number | null }` (the domain lib cannot import the generated API types).
+
+- query: trimmed, case-insensitive substring on the title (`toLocaleLowerCase('he')`); empty query matches all.
+- tagIds: a recipe must have every id (AND); empty list matches all.
+- fastOnly: `total_minutes !== null && total_minutes <= 30`; `FAST_MINUTES = 30` exported.
+- Order of the input is kept (the API already sorts newest first).
+- Performance test: 200 recipes filter in under 100 ms (NFR-3).
+
+### `libs/ui-components` (type:ui, props in, callbacks out, no i18n)
+
+Per the approved inventory, each with a Storybook story (RTL, light/dark) and a spec:
+
+- `RecipeCard`: a `Board` with the slot, a 4:3 lazy photo when there is one, title (larger without a photo), up to 2 tags plus "+N", total time; the whole card is one link (render as the given link element); hover scale 1.02, press 0.98, no shadow; reduced motion keeps opacity only.
+- `RecipeCardSkeleton`: board-shaped skeleton.
+- `SearchField`: pill `Input` with a clear (x) button and a label.
+- `TagFilter`: `ToggleGroup type="multiple"` chip row, horizontal scroll, "הכל" + pinned tags + the fast chip; "הכל" pressed when nothing is selected.
+- `EmptyState`: heading, body, optional action; used for both "no recipes" and "no results".
+- Rename the `MealTypeChips` story in `forms.stories.tsx` to a flat-tag demo (`TagChips`, tag names, no "סוג ארוחה").
+
+### `libs/feature-recipes` (type:feature)
+
+- Subpath export `@bite-and-board/feature-recipes/library` -> `src/routes/library.tsx` (exports `Component`).
+- `LibraryPage` (container): `useQuery(recipesListRecipesOptions())` and `useQuery(tagsListTagsOptions())`; URL state via `useSearchParams`; `useDeferredValue` on `q`; renders skeleton x6 / empty state / no-results / grid.
+- `apps/web` router: the index route lazy-imports `@bite-and-board/feature-recipes/library` and `placeholder-home.tsx` is deleted; `home.title` is kept as the h1.
+- Copy keys added to `he.json` under `library.*`.
+
+### Tests
+
+- Vitest + Testing Library + MSW for the container (search, chips, fast chip, AND, URL kept after navigating to a recipe and back, skeleton, empty, no-results, "ניקוי החיפוש" clears both).
+- Unit tests for the domain filter and the URL parse/serialize helpers.
+- Backend: `tests/test_tags_api.py`.
+
+## Decisions (D1-D8)
+
+See the plan message to the coordinator; answers are recorded here once received.
+
+## Checks
+
+`nx run-many -t lint typecheck test build build-storybook`, recipe-service lint/typecheck/test, `nx format:check`, `nx run data-access:generate` + `git diff --exit-code`, initial JS gzip size against the 200 KB budget (the `web:size` target does not exist yet; it is Story 6.4, so the size is measured by hand from the build output).
diff --git a/apps/recipe-service/tests/test_tags_api.py b/apps/recipe-service/tests/test_tags_api.py
new file mode 100644
index 0000000..dc73cb8
--- /dev/null
+++ b/apps/recipe-service/tests/test_tags_api.py
@@ -0,0 +1,101 @@
+"""`GET /api/tags` (Story 1.9). Written first: they fail until the endpoint exists."""
+
+from typing import Any
+
+from fastapi import FastAPI
+from fastapi.testclient import TestClient
+from sqlmodel import Session
+
+from app.tags.models import Tag
+from tests.factories import add_recipe, add_tag
+
+DEFAULT_PINNED_NAMES = [
+    "בוקר",
+    "בראנץ'",
+    "צהריים",
+    "ערב",
+    "נשנוש",
+    "עיקרית",
+    "תוספת",
+    "מנה ראשונה/סלט",
+    "מרק",
+    "מאפה",
+    "קינוח",
+    "משקה",
+    "רוטב/ממרח",
+]
+
+
+def list_tags(client: TestClient) -> list[dict[str, Any]]:
+    response = client.get("/api/tags")
+    assert response.status_code == 200
+    tags: list[dict[str, Any]] = response.json()
+    return tags
+
+
+def test_lists_the_default_pinned_tags_in_display_order(client: TestClient) -> None:
+    tags = list_tags(client)
+    assert [tag["name"] for tag in tags] == DEFAULT_PINNED_NAMES
+    assert all(tag["pinned"] is True for tag in tags)
+
+
+def test_each_tag_has_exactly_id_name_and_pinned(
+    client: TestClient, session: Session
+) -> None:
+    free = add_tag(session, "על האש")
+    tags = list_tags(client)
+    assert all(set(tag) == {"id", "name", "pinned"} for tag in tags)
+    assert {"id": str(free.id), "name": "על האש", "pinned": False} in tags
+
+
+def test_unpinned_tags_follow_the_pinned_ones_ordered_by_name(
+    client: TestClient, session: Session
+) -> None:
+    add_tag(session, "תפוח")
+    add_tag(session, "banana")
+    add_tag(session, "Cherry")
+    add_tag(session, "אפרסק")
+    names = [tag["name"] for tag in list_tags(client)]
+    # Case-insensitive, like the tags embedded in recipes (AD-20).
+    assert names[len(DEFAULT_PINNED_NAMES) :] == ["banana", "Cherry", "אפרסק", "תפוח"]
+    assert names[: len(DEFAULT_PINNED_NAMES)] == DEFAULT_PINNED_NAMES
+
+
+def test_pinned_tags_are_ordered_by_sort_order_not_by_name(
+    client: TestClient, session: Session
+) -> None:
+    session.add(Tag(name="אבטיח", pinned=True, sort_order=99))
+    session.commit()
+    names = [tag["name"] for tag in list_tags(client)]
+    assert names[-1] == "אבטיח"
+    assert names[:-1] == DEFAULT_PINNED_NAMES
+
+
+def test_includes_tags_that_no_recipe_uses(
+    client: TestClient, session: Session
+) -> None:
+    used = add_tag(session, "מסיבות")
+    unused = add_tag(session, "פינגר פוד")
+    add_recipe(session, tags=[used])
+    names = {tag["name"] for tag in list_tags(client)}
+    assert {used.name, unused.name} <= names
+
+
+def test_is_public(client: TestClient) -> None:
+    # No session cookie and no CSRF header: a visitor can read the tags.
+    assert not client.cookies
+    list_tags(client)
+
+
+def test_operation_id_and_response_schema_are_published(app: FastAPI) -> None:
+    spec: dict[str, Any] = app.openapi()
+    operation = spec["paths"]["/api/tags"]["get"]
+    assert operation["operationId"] == "tags_list_tags"
+
+    schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
+    assert schema["type"] == "array"
+    assert schema["items"]["$ref"].endswith("/TagRead")
+
+    tag_read = spec["components"]["schemas"]["TagRead"]
+    assert set(tag_read["properties"]) == {"id", "name", "pinned"}
+    assert set(tag_read["required"]) == {"id", "name", "pinned"}
diff --git a/apps/web/src/app/library-focus.spec.tsx b/apps/web/src/app/library-focus.spec.tsx
new file mode 100644
index 0000000..a06ed42
--- /dev/null
+++ b/apps/web/src/app/library-focus.spec.tsx
@@ -0,0 +1,69 @@
+import { render, screen } from '@testing-library/react';
+import userEvent from '@testing-library/user-event';
+import { HttpResponse, http } from 'msw';
+import { setupServer } from 'msw/node';
+import { createMemoryRouter, RouterProvider } from 'react-router';
+import { client } from '@bite-and-board/data-access';
+import { AppProviders } from './app-providers';
+import { routes } from './router';
+
+const server = setupServer(
+  http.get('*/api/recipes', () =>
+    HttpResponse.json([
+      {
+        id: 'r1',
+        title: 'שקשוקה',
+        tags: [],
+        total_minutes: 25,
+        photo: null,
+        created_at: '2026-10-27T12:00:00Z',
+      },
+    ]),
+  ),
+  http.get('*/api/tags', () => HttpResponse.json([])),
+);
+
+beforeAll(() => {
+  // Node's fetch rejects the client's relative `/api` URLs.
+  client.setConfig({ baseUrl: window.location.origin });
+  server.listen({ onUnhandledFrame: 'error' });
+});
+afterEach(() => server.resetHandlers());
+afterAll(() => server.close());
+
+// The library keeps its filters in the URL, so each keystroke is a navigation.
+// The shell must not treat that as a new page and pull focus away.
+describe('the library inside the app shell', () => {
+  it('keeps focus in the search field while typing', async () => {
+    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
+    render(
+      <AppProviders>
+        <RouterProvider router={router} />
+      </AppProviders>,
+    );
+    const search = await screen.findByRole('searchbox');
+    await screen.findByRole('list');
+
+    await userEvent.type(search, 'שקש');
+
+    expect(search).toHaveProperty('value', 'שקש');
+    expect(document.activeElement).toBe(search);
+    expect(router.state.location.search).toBe(
+      `?q=${encodeURIComponent('שקש')}`,
+    );
+  });
+
+  it('still moves focus to the heading when the page changes', async () => {
+    const router = createMemoryRouter(routes, { initialEntries: ['/nope'] });
+    render(
+      <AppProviders>
+        <RouterProvider router={router} />
+      </AppProviders>,
+    );
+    await userEvent.click(
+      await screen.findByRole('link', { name: 'חזרה לרשימה' }),
+    );
+    const heading = await screen.findByRole('heading', { name: 'מתכונים' });
+    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
+  });
+});
diff --git a/libs/feature-recipes/eslint.config.mjs b/libs/feature-recipes/eslint.config.mjs
new file mode 100644
index 0000000..2cde510
--- /dev/null
+++ b/libs/feature-recipes/eslint.config.mjs
@@ -0,0 +1,15 @@
+import nx from '@nx/eslint-plugin';
+import baseConfig from '../../eslint.config.mjs';
+
+export default [
+  ...nx.configs['flat/react'],
+  ...baseConfig,
+  {
+    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
+    // Override or add rules here
+    rules: {},
+  },
+  {
+    ignores: ['**/out-tsc'],
+  },
+];
diff --git a/libs/feature-recipes/package.json b/libs/feature-recipes/package.json
new file mode 100644
index 0000000..60a185b
--- /dev/null
+++ b/libs/feature-recipes/package.json
@@ -0,0 +1,20 @@
+{
+  "name": "@bite-and-board/feature-recipes",
+  "version": "0.0.1",
+  "private": true,
+  "type": "module",
+  "exports": {
+    "./library": {
+      "types": "./src/routes/library.tsx",
+      "import": "./src/routes/library.tsx",
+      "default": "./src/routes/library.tsx"
+    },
+    "./package.json": "./package.json"
+  },
+  "nx": {
+    "name": "feature-recipes",
+    "tags": [
+      "type:feature"
+    ]
+  }
+}
diff --git a/libs/feature-recipes/src/library/library-filters.spec.ts b/libs/feature-recipes/src/library/library-filters.spec.ts
new file mode 100644
index 0000000..09f63d2
--- /dev/null
+++ b/libs/feature-recipes/src/library/library-filters.spec.ts
@@ -0,0 +1,65 @@
+import { parseLibraryFilters, withLibraryFilters } from './library-filters';
+
+describe('parseLibraryFilters', () => {
+  it('defaults to no filter', () => {
+    expect(parseLibraryFilters(new URLSearchParams())).toEqual({
+      query: '',
+      tagIds: [],
+      fastOnly: false,
+    });
+  });
+
+  it('reads the search text, tag ids and the quick flag', () => {
+    const params = new URLSearchParams('q=עוף&tags=a,b&fast=1');
+    expect(parseLibraryFilters(params)).toEqual({
+      query: 'עוף',
+      tagIds: ['a', 'b'],
+      fastOnly: true,
+    });
+  });
+
+  it('drops empty and repeated tag ids', () => {
+    const params = new URLSearchParams('tags=a,,b,a,');
+    expect(parseLibraryFilters(params).tagIds).toEqual(['a', 'b']);
+  });
+
+  it('only treats fast=1 as on', () => {
+    expect(parseLibraryFilters(new URLSearchParams('fast=0')).fastOnly).toBe(
+      false,
+    );
+    expect(parseLibraryFilters(new URLSearchParams('fast=true')).fastOnly).toBe(
+      false,
+    );
+  });
+});
+
+describe('withLibraryFilters', () => {
+  it('sets each filter and leaves the original params alone', () => {
+    const original = new URLSearchParams('x=1');
+    const next = withLibraryFilters(original, {
+      query: 'עוף',
+      tagIds: ['a', 'b'],
+      fastOnly: true,
+    });
+    expect(next.get('q')).toBe('עוף');
+    expect(next.get('tags')).toBe('a,b');
+    expect(next.get('fast')).toBe('1');
+    expect(next.get('x')).toBe('1');
+    expect(original.toString()).toBe('x=1');
+  });
+
+  it('removes empty values so a cleared library has a clean URL', () => {
+    const next = withLibraryFilters(
+      new URLSearchParams('q=a&tags=b&fast=1&x=1'),
+      { query: '', tagIds: [], fastOnly: false },
+    );
+    expect(next.toString()).toBe('x=1');
+  });
+
+  it('keeps the filters it was not asked to change', () => {
+    const next = withLibraryFilters(new URLSearchParams('q=a&tags=b&fast=1'), {
+      query: 'c',
+    });
+    expect(next.toString()).toBe('q=c&tags=b&fast=1');
+  });
+});
diff --git a/libs/feature-recipes/src/library/library-filters.ts b/libs/feature-recipes/src/library/library-filters.ts
new file mode 100644
index 0000000..5253b88
--- /dev/null
+++ b/libs/feature-recipes/src/library/library-filters.ts
@@ -0,0 +1,44 @@
+/** The library's filter state, as it lives in the URL (AD-8, AD-26). */
+export interface LibraryFilters {
+  /** `?q=`: the title search text. */
+  query: string;
+  /** `?tags=<uuid>,<uuid>`: tag ids in URL order, without duplicates. */
+  tagIds: string[];
+  /** `?fast=1`: only recipes of at most 30 minutes. */
+  fastOnly: boolean;
+}
+
+export const QUERY_PARAM = 'q';
+export const TAGS_PARAM = 'tags';
+export const FAST_PARAM = 'fast';
+
+/** Reads the filters from the URL; tag ids are not checked against real tags here. */
+export function parseLibraryFilters(params: URLSearchParams): LibraryFilters {
+  const tagIds = (params.get(TAGS_PARAM) ?? '').split(',').filter(Boolean);
+  return {
+    query: params.get(QUERY_PARAM) ?? '',
+    tagIds: [...new Set(tagIds)],
+    fastOnly: params.get(FAST_PARAM) === '1',
+  };
+}
+
+/**
+ * Returns a copy of `params` with the given filters changed. Empty values are
+ * removed, so a cleared library has a clean URL, and other params are kept.
+ */
+export function withLibraryFilters(
+  params: URLSearchParams,
+  change: Partial<LibraryFilters>,
+): URLSearchParams {
+  const next = new URLSearchParams(params);
+  const set = (name: string, value: string | undefined) => {
+    if (value) next.set(name, value);
+    else next.delete(name);
+  };
+  if (change.query !== undefined) set(QUERY_PARAM, change.query);
+  if (change.tagIds !== undefined) set(TAGS_PARAM, change.tagIds.join(','));
+  if (change.fastOnly !== undefined) {
+    set(FAST_PARAM, change.fastOnly ? '1' : undefined);
+  }
+  return next;
+}
diff --git a/libs/feature-recipes/src/library/use-error-message.ts b/libs/feature-recipes/src/library/use-error-message.ts
new file mode 100644
index 0000000..906f2a2
--- /dev/null
+++ b/libs/feature-recipes/src/library/use-error-message.ts
@@ -0,0 +1,16 @@
+import type { ParseKeys } from 'i18next';
+import { useTranslation } from 'react-i18next';
+import { getErrorCode } from '@bite-and-board/data-access';
+
+/** An API error as Hebrew copy (AD-28): `errors.<code>`, or the generic message. */
+export function useErrorMessage() {
+  const { t, i18n } = useTranslation();
+  return (error: unknown) => {
+    const code = getErrorCode(error);
+    // The code comes from the server, so the key is checked at runtime.
+    const key = code ? (`errors.${code}` as ParseKeys) : undefined;
+    const message: string =
+      key && i18n.exists(key) ? t(key) : t('errors.unknown');
+    return message;
+  };
+}
diff --git a/libs/feature-recipes/src/library/use-library-filters.ts b/libs/feature-recipes/src/library/use-library-filters.ts
new file mode 100644
index 0000000..a2e02aa
--- /dev/null
+++ b/libs/feature-recipes/src/library/use-library-filters.ts
@@ -0,0 +1,45 @@
+import { useState } from 'react';
+import { useSearchParams } from 'react-router';
+import {
+  parseLibraryFilters,
+  withLibraryFilters,
+  type LibraryFilters,
+} from './library-filters';
+
+/**
+ * The library filters, kept in the URL so Back from a recipe finds them again
+ * (AD-8). Every change replaces the history entry, so typing and chip taps do
+ * not pile up Back steps.
+ *
+ * `knownTagIds` are the ids that really exist; any other id in the URL is
+ * ignored. The search text also has a local copy, so a fast typist is never
+ * fighting the router for the input's value.
+ */
+export function useLibraryFilters(knownTagIds: ReadonlySet<string>) {
+  const [params, setParams] = useSearchParams();
+  const parsed = parseLibraryFilters(params);
+
+  const [draft, setDraft] = useState(parsed.query);
+  const [seenQuery, setSeenQuery] = useState(parsed.query);
+  // The URL changed by itself (Back, a link, "clear"): follow it.
+  if (parsed.query !== seenQuery) {
+    setSeenQuery(parsed.query);
+    setDraft(parsed.query);
+  }
+
+  const filters: LibraryFilters = {
+    query: draft,
+    tagIds: parsed.tagIds.filter((id) => knownTagIds.has(id)),
+    fastOnly: parsed.fastOnly,
+  };
+
+  const update = (change: Partial<LibraryFilters>) => {
+    if (change.query !== undefined) setDraft(change.query);
+    setParams((current) => withLibraryFilters(current, change), {
+      replace: true,
+    });
+  };
+  const clear = () => update({ query: '', tagIds: [], fastOnly: false });
+
+  return { filters, update, clear };
+}
diff --git a/libs/feature-recipes/src/routes/library.spec.tsx b/libs/feature-recipes/src/routes/library.spec.tsx
new file mode 100644
index 0000000..2ca38cf
--- /dev/null
+++ b/libs/feature-recipes/src/routes/library.spec.tsx
@@ -0,0 +1,439 @@
+import { act, screen, waitFor } from '@testing-library/react';
+import userEvent from '@testing-library/user-event';
+import { delay, http, HttpResponse } from 'msw';
+import { server } from '../testing/server';
+import { recipe, renderLibrary, serveRecipes } from '../testing/render-library';
+
+const SHAKSHUKA = recipe('r1', 'שקשוקה', {
+  tags: [
+    { id: 't1', name: 'בוקר' },
+    { id: 't2', name: 'על האש' },
+    { id: 't3', name: 'מסיבות' },
+  ],
+  total_minutes: 25,
+});
+const LASAGNA = recipe('r2', 'לזניה', { total_minutes: 90 });
+const CAKE = recipe('r3', 'עוגת שוקולד', { total_minutes: 75 });
+const SALAD = recipe('r4', 'Greek Salad');
+const ALL = [SHAKSHUKA, LASAGNA, CAKE, SALAD];
+
+const TAGS = [
+  { id: 't1', name: 'בוקר', pinned: true },
+  { id: 't4', name: 'ערב', pinned: true },
+  { id: 't2', name: 'על האש', pinned: false },
+  { id: 't3', name: 'מסיבות', pinned: false },
+];
+const BREAKFAST_AND_DINNER = recipe('r5', 'פשטידה', {
+  tags: [
+    { id: 't1', name: 'בוקר' },
+    { id: 't4', name: 'ערב' },
+  ],
+  total_minutes: 20,
+});
+const DINNER = recipe('r6', 'מרק', {
+  tags: [{ id: 't4', name: 'ערב' }],
+  total_minutes: 60,
+});
+const WITH_TAGS = [SHAKSHUKA, BREAKFAST_AND_DINNER, DINNER, SALAD];
+
+const chip = (name: string) => screen.getByRole('button', { name });
+
+const titles = () =>
+  screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);
+const search = () => screen.getByRole('searchbox', { name: 'חיפוש מתכונים' });
+const fastChip = () => screen.getByRole('button', { name: 'עד 30 דקות' });
+
+async function loaded(path = '/', tags = TAGS) {
+  const router = renderLibrary(path, tags);
+  await screen.findByRole('list');
+  return router;
+}
+
+describe('LibraryPage', () => {
+  describe('the list', () => {
+    it('shows a heading, then the cards in the order the API sends them', async () => {
+      serveRecipes(ALL);
+      await loaded();
+      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
+        'מתכונים',
+      );
+      expect(titles()).toEqual([
+        'שקשוקה',
+        'לזניה',
+        'עוגת שוקולד',
+        'Greek Salad',
+      ]);
+      const link = screen.getByRole('link', { name: /שקשוקה/ });
+      expect(link.getAttribute('href')).toBe('/recipes/r1');
+    });
+
+    it('shows up to 2 tags, a "+N" for the rest, and the total time', async () => {
+      serveRecipes(ALL);
+      await loaded();
+      const card = screen.getByRole('link', { name: /שקשוקה/ });
+      expect(card.textContent).toContain('בוקר');
+      expect(card.textContent).toContain('על האש');
+      expect(card.textContent).not.toContain('מסיבות');
+      expect(card.textContent).toContain('+1');
+      expect(card.textContent).toContain('25 דק׳');
+    });
+
+    it('formats hours, leaves out an unknown time, and uses the thumbnail', async () => {
+      serveRecipes([
+        recipe('r1', 'שעה אחת', { total_minutes: 60 }),
+        recipe('r2', 'שעה ורבע', { total_minutes: 75 }),
+        recipe('r3', 'בלי זמן'),
+        recipe('r4', 'עם תמונה', {
+          photo: {
+            url: '/m/a.webp',
+            thumb_url: '/m/a-t.webp',
+            credit_domain: null,
+          },
+        }),
+      ]);
+      await loaded();
+      const text = (name: RegExp) =>
+        screen.getByRole('link', { name }).textContent;
+      expect(text(/^שעה אחת/)).toContain('1 שע׳');
+      expect(text(/שעה ורבע/)).toContain('1 שע׳ 15 דק׳');
+      expect(text(/בלי זמן/)).not.toMatch(/דק׳|שע׳/);
+      const img = screen
+        .getByRole('link', { name: /עם תמונה/ })
+        .querySelector('img');
+      expect(img?.getAttribute('src')).toBe('/m/a-t.webp');
+    });
+
+    it('shows 6 skeleton cards while loading', async () => {
+      server.use(
+        http.get('*/api/recipes', async () => {
+          await delay('infinite');
+          return HttpResponse.json([]);
+        }),
+      );
+      renderLibrary();
+      const status = await screen.findByRole('status', {
+        name: 'טוען מתכונים',
+      });
+      expect(
+        status.querySelectorAll('[data-slot="recipe-card-skeleton"]'),
+      ).toHaveLength(6);
+    });
+
+    it('shows the visitor empty state with no recipes', async () => {
+      serveRecipes([]);
+      renderLibrary();
+      expect(
+        await screen.findByRole('heading', { name: 'עוד אין כאן מתכונים' }),
+      ).toBeTruthy();
+      expect(screen.queryByRole('list')).toBeNull();
+      expect(screen.queryByRole('button', { name: /ניקוי/ })).toBeNull();
+    });
+
+    it('shows the API error in Hebrew and retries', async () => {
+      server.use(
+        http.get('*/api/recipes', () =>
+          HttpResponse.json(
+            { detail: 'x', code: 'recipe_not_found' },
+            { status: 404 },
+          ),
+        ),
+      );
+      renderLibrary();
+      expect(
+        await screen.findByRole('heading', { name: 'המתכון לא נמצא' }),
+      ).toBeTruthy();
+
+      serveRecipes(ALL);
+      await userEvent.click(screen.getByRole('button', { name: 'לנסות שוב' }));
+      expect(await screen.findByRole('list')).toBeTruthy();
+    });
+
+    it('shows the generic message for an error without a code', async () => {
+      server.use(http.get('*/api/recipes', () => HttpResponse.error()));
+      renderLibrary();
+      expect(
+        await screen.findByRole('heading', {
+          name: 'משהו השתבש, אפשר לנסות שוב',
+        }),
+      ).toBeTruthy();
+    });
+  });
+
+  describe('search', () => {
+    it('keeps only titles that contain the text, ignoring case, as you type', async () => {
+      serveRecipes(ALL);
+      await loaded();
+      await userEvent.type(search(), 'greek');
+      await waitFor(() => expect(titles()).toEqual(['Greek Salad']));
+      await userEvent.clear(search());
+      await waitFor(() => expect(titles()).toHaveLength(4));
+    });
+
+    it('keeps the text in ?q= without piling up history entries', async () => {
+      serveRecipes(ALL);
+      const router = await loaded();
+      const entries = window.history.length;
+      await userEvent.type(search(), 'עוג');
+      expect(router.state.location.search).toBe(
+        `?q=${encodeURIComponent('עוג')}`,
+      );
+      expect(window.history.length).toBe(entries);
+      expect(search()).toHaveProperty('value', 'עוג');
+    });
+
+    it('starts from ?q= in the URL', async () => {
+      serveRecipes(ALL);
+      await loaded(`/?q=${encodeURIComponent('לזניה')}`);
+      expect(search()).toHaveProperty('value', 'לזניה');
+      expect(titles()).toEqual(['לזניה']);
+    });
+
+    it('clears the text with the x button', async () => {
+      serveRecipes(ALL);
+      const router = await loaded('/?q=greek');
+      await userEvent.click(
+        screen.getByRole('button', { name: 'ניקוי שדה החיפוש' }),
+      );
+      expect(search()).toHaveProperty('value', '');
+      expect(router.state.location.search).toBe('');
+      await waitFor(() => expect(titles()).toHaveLength(4));
+    });
+
+    it('says nothing matched, and "ניקוי החיפוש" clears search and filter', async () => {
+      serveRecipes(ALL);
+      const router = await loaded('/?fast=1');
+      await userEvent.type(search(), 'פיצה');
+      expect(
+        await screen.findByRole('heading', {
+          name: "לא נמצאו מתכונים ל־'פיצה'",
+        }),
+      ).toBeTruthy();
+
+      await userEvent.click(
+        screen.getByRole('button', { name: 'ניקוי החיפוש' }),
+      );
+      expect(router.state.location.search).toBe('');
+      expect(search()).toHaveProperty('value', '');
+      expect(fastChip().getAttribute('aria-pressed')).toBe('false');
+      await waitFor(() => expect(titles()).toHaveLength(4));
+    });
+
+    it('focuses the field on "/" unless already typing', async () => {
+      serveRecipes(ALL);
+      await loaded();
+      await userEvent.keyboard('/');
+      expect(document.activeElement).toBe(search());
+      expect(search()).toHaveProperty('value', '');
+
+      // Typing a slash in the field itself is just text.
+      await userEvent.keyboard('a/b');
+      expect(search()).toHaveProperty('value', 'a/b');
+    });
+
+    it('ignores "/" with a modifier key', async () => {
+      serveRecipes(ALL);
+      await loaded();
+      await userEvent.keyboard('{Control>}/{/Control}');
+      expect(document.activeElement).not.toBe(search());
+    });
+  });
+
+  describe('the quick chip', () => {
+    it('keeps recipes of a known time of at most 30 minutes, kept in ?fast=1', async () => {
+      serveRecipes(ALL);
+      const router = await loaded();
+      expect(fastChip().getAttribute('aria-pressed')).toBe('false');
+      await userEvent.click(fastChip());
+      expect(titles()).toEqual(['שקשוקה']);
+      expect(router.state.location.search).toBe('?fast=1');
+      await userEvent.click(fastChip());
+      expect(titles()).toHaveLength(4);
+      expect(router.state.location.search).toBe('');
+    });
+
+    it('combines with the search', async () => {
+      serveRecipes(ALL);
+      await loaded('/?fast=1');
+      expect(fastChip().getAttribute('aria-pressed')).toBe('true');
+      expect(titles()).toEqual(['שקשוקה']);
+      await userEvent.type(search(), 'לזניה');
+      expect(
+        await screen.findByRole('heading', {
+          name: "לא נמצאו מתכונים ל־'לזניה'",
+        }),
+      ).toBeTruthy();
+    });
+
+    it('says nothing matched without quoting an empty search', async () => {
+      serveRecipes([LASAGNA]);
+      await loaded();
+      await userEvent.click(fastChip());
+      expect(
+        await screen.findByRole('heading', {
+          name: 'לא נמצאו מתכונים מתאימים',
+        }),
+      ).toBeTruthy();
+      await userEvent.click(
+        screen.getByRole('button', { name: 'ניקוי הסינון' }),
+      );
+      expect(titles()).toEqual(['לזניה']);
+    });
+  });
+
+  describe('tag chips', () => {
+    it('shows "הכל", the quick chip and the pinned tags only, in the API order', async () => {
+      serveRecipes(WITH_TAGS);
+      await loaded();
+      const names = screen
+        .getAllByRole('button')
+        .map((button) => button.textContent);
+      expect(names).toEqual(['הכל', 'עד 30 דקות', 'בוקר', 'ערב']);
+      expect(chip('הכל').getAttribute('aria-pressed')).toBe('true');
+    });
+
+    it('filters by a tag, kept in ?tags=', async () => {
+      serveRecipes(WITH_TAGS);
+      const router = await loaded();
+      await userEvent.click(chip('ערב'));
+      expect(titles()).toEqual(['פשטידה', 'מרק']);
+      expect(chip('ערב').getAttribute('aria-pressed')).toBe('true');
+      expect(chip('הכל').getAttribute('aria-pressed')).toBe('false');
+      expect(router.state.location.search).toBe('?tags=t4');
+    });
+
+    it('needs every selected tag (AND)', async () => {
+      serveRecipes(WITH_TAGS);
+      const router = await loaded();
+      await userEvent.click(chip('ערב'));
+      await userEvent.click(chip('בוקר'));
+      expect(titles()).toEqual(['פשטידה']);
+      expect(router.state.location.search).toBe('?tags=t4%2Ct1');
+      await userEvent.click(chip('בוקר'));
+      expect(titles()).toEqual(['פשטידה', 'מרק']);
+    });
+
+    it('clears the tags with "הכל"', async () => {
+      serveRecipes(WITH_TAGS);
+      const router = await loaded('/?tags=t1,t4');
+      expect(titles()).toEqual(['פשטידה']);
+      await userEvent.click(chip('הכל'));
+      expect(titles()).toHaveLength(4);
+      expect(router.state.location.search).toBe('');
+    });
+
+    it('combines with the search and the quick chip', async () => {
+      serveRecipes(WITH_TAGS);
+      await loaded('/?tags=t4');
+      await userEvent.click(fastChip());
+      expect(titles()).toEqual(['פשטידה']);
+      await userEvent.type(search(), 'מרק');
+      expect(
+        await screen.findByRole('heading', {
+          name: "לא נמצאו מתכונים ל־'מרק'",
+        }),
+      ).toBeTruthy();
+    });
+
+    it('starts from ?tags= in the URL', async () => {
+      serveRecipes(WITH_TAGS);
+      await loaded('/?tags=t1');
+      expect(chip('בוקר').getAttribute('aria-pressed')).toBe('true');
+      expect(titles()).toEqual(['שקשוקה', 'פשטידה']);
+    });
+
+    it('ignores ids that are not tags', async () => {
+      serveRecipes(WITH_TAGS);
+      await loaded('/?tags=nope');
+      expect(titles()).toHaveLength(4);
+      expect(chip('הכל').getAttribute('aria-pressed')).toBe('true');
+    });
+
+    it('still applies the known ids next to an unknown one', async () => {
+      serveRecipes(WITH_TAGS);
+      await loaded('/?tags=nope,t4');
+      expect(titles()).toEqual(['פשטידה', 'מרק']);
+    });
+
+    it('filters by an existing tag that is not pinned, without a chip for it', async () => {
+      serveRecipes(WITH_TAGS);
+      await loaded('/?tags=t2');
+      expect(titles()).toEqual(['שקשוקה']);
+      expect(screen.queryByRole('button', { name: 'על האש' })).toBeNull();
+    });
+
+    it('says nothing matched when no recipe has all the tags, and clears them', async () => {
+      serveRecipes(WITH_TAGS);
+      const router = renderLibrary('/?tags=t1,t4,t3', TAGS);
+      expect(
+        await screen.findByRole('heading', {
+          name: 'לא נמצאו מתכונים מתאימים',
+        }),
+      ).toBeTruthy();
+      await userEvent.click(chip('ניקוי הסינון'));
+      expect(router.state.location.search).toBe('');
+      expect(titles()).toHaveLength(4);
+    });
+
+    it('waits for the tags before showing the list', async () => {
+      server.use(
+        http.get('*/api/tags', async () => {
+          await delay('infinite');
+          return HttpResponse.json([]);
+        }),
+      );
+      serveRecipes(WITH_TAGS);
+      renderLibrary('/?tags=t4', null);
+      expect(
+        await screen.findByRole('status', { name: 'טוען מתכונים' }),
+      ).toBeTruthy();
+      expect(screen.queryByRole('list')).toBeNull();
+    });
+
+    it('still lists the recipes when the tags fail, with no tag chips', async () => {
+      server.use(http.get('*/api/tags', () => HttpResponse.error()));
+      serveRecipes(WITH_TAGS);
+      renderLibrary('/?tags=t4', null);
+      await screen.findByRole('list');
+      expect(titles()).toHaveLength(4);
+      expect(screen.queryByRole('button', { name: 'ערב' })).toBeNull();
+      expect(chip('הכל')).toBeTruthy();
+    });
+
+    it('keeps the chosen tags after Back from a recipe', async () => {
+      serveRecipes(WITH_TAGS);
+      const router = await loaded('/?tags=t4');
+      await userEvent.click(screen.getByRole('link', { name: /מרק/ }));
+      expect(await screen.findByText('recipe detail stub')).toBeTruthy();
+      await act(() => router.navigate(-1));
+      await screen.findByRole('list');
+      expect(chip('ערב').getAttribute('aria-pressed')).toBe('true');
+      expect(titles()).toEqual(['פשטידה', 'מרק']);
+    });
+  });
+
+  describe('coming back from a recipe', () => {
+    it('still has the search and filter applied after Back', async () => {
+      serveRecipes(ALL);
+      const router = await loaded('/?q=%D7%A9&fast=1');
+      expect(titles()).toEqual(['שקשוקה']);
+
+      await userEvent.click(screen.getByRole('link', { name: /שקשוקה/ }));
+      expect(await screen.findByText('recipe detail stub')).toBeTruthy();
+
+      await act(() => router.navigate(-1));
+      await screen.findByRole('list');
+      expect(search()).toHaveProperty('value', 'ש');
+      expect(fastChip().getAttribute('aria-pressed')).toBe('true');
+      expect(titles()).toEqual(['שקשוקה']);
+    });
+
+    it('follows the URL when it changes by itself', async () => {
+      serveRecipes(ALL);
+      const router = await loaded('/?q=greek');
+      expect(titles()).toEqual(['Greek Salad']);
+      await act(() => router.navigate('/?q=%D7%9C%D7%96%D7%A0%D7%99%D7%94'));
+      expect(search()).toHaveProperty('value', 'לזניה');
+      await waitFor(() => expect(titles()).toEqual(['לזניה']));
+    });
+  });
+});
diff --git a/libs/feature-recipes/src/routes/library.tsx b/libs/feature-recipes/src/routes/library.tsx
new file mode 100644
index 0000000..bda8d6a
--- /dev/null
+++ b/libs/feature-recipes/src/routes/library.tsx
@@ -0,0 +1,196 @@
+import { useDeferredValue, useEffect, useRef } from 'react';
+import { useQuery } from '@tanstack/react-query';
+import { useTranslation } from 'react-i18next';
+import { Link } from 'react-router';
+import {
+  recipesListRecipesOptions,
+  tagsListTagsOptions,
+  type RecipeSummary,
+} from '@bite-and-board/data-access';
+import { filterRecipes } from '@bite-and-board/recipe-domain';
+import {
+  Button,
+  EmptyState,
+  RecipeCard,
+  RecipeCardSkeleton,
+  SearchField,
+  TagFilter,
+} from '@bite-and-board/ui-components';
+import { useErrorMessage } from '../library/use-error-message';
+import { useLibraryFilters } from '../library/use-library-filters';
+
+const SKELETON_COUNT = 6;
+const MINUTES_PER_HOUR = 60;
+
+const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';
+
+function isTypingTarget(target: EventTarget | null) {
+  return (
+    target instanceof HTMLElement &&
+    (target.isContentEditable ||
+      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
+  );
+}
+
+/** The recipe library at `/`: cards, search and tag filters (FR-1 to FR-3). */
+export function LibraryPage() {
+  const { t } = useTranslation();
+  const errorMessage = useErrorMessage();
+  const search = useRef<HTMLInputElement>(null);
+
+  const recipes = useQuery(recipesListRecipesOptions());
+  const tags = useQuery(tagsListTagsOptions());
+  // Without tags (still loading, or failed) the library works as a plain list.
+  const knownTagIds = new Set(tags.data?.map((tag) => tag.id));
+  const pinnedTags = (tags.data ?? []).filter((tag) => tag.pinned);
+  const { filters, update, clear } = useLibraryFilters(knownTagIds);
+  const query = useDeferredValue(filters.query);
+
+  // "/" jumps to the search field, unless the user is already typing somewhere.
+  useEffect(() => {
+    const onKeyDown = (event: KeyboardEvent) => {
+      if (
+        event.key !== '/' ||
+        event.ctrlKey ||
+        event.metaKey ||
+        event.altKey ||
+        isTypingTarget(event.target)
+      ) {
+        return;
+      }
+      event.preventDefault();
+      search.current?.focus();
+    };
+    document.addEventListener('keydown', onKeyDown);
+    return () => document.removeEventListener('keydown', onKeyDown);
+  }, []);
+
+  const formatTime = (minutes: number | null) => {
+    if (minutes === null) return undefined;
+    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
+    const rest = minutes % MINUTES_PER_HOUR;
+    if (hours === 0) return t('library.card.minutes', { minutes: rest });
+    return rest === 0
+      ? t('library.card.hours', { hours })
+      : t('library.card.hoursMinutes', { hours, minutes: rest });
+  };
+
+  const renderBody = () => {
+    // Waiting for the tags too, so a tag filter in the URL never flashes the full list.
+    if (recipes.isPending || tags.isPending) {
+      return (
+        <div role="status" aria-label={t('library.loading')} className={GRID}>
+          {Array.from({ length: SKELETON_COUNT }, (_, n) => (
+            <RecipeCardSkeleton key={n} />
+          ))}
+        </div>
+      );
+    }
+    if (recipes.isError) {
+      return (
+        <EmptyState
+          title={errorMessage(recipes.error)}
+          actions={
+            <Button variant="secondary" onClick={() => void recipes.refetch()}>
+              {t('library.error.retry')}
+            </Button>
+          }
+        />
+      );
+    }
+    if (recipes.data.length === 0) {
+      return <EmptyState title={t('library.empty.title')} />;
+    }
+    const visible = filterRecipes(recipes.data, { ...filters, query });
+    if (visible.length === 0) {
+      const searching = query.trim() !== '';
+      return (
+        <EmptyState
+          title={
+            searching
+              ? t('library.noResults.title', { q: query.trim() })
+              : t('library.noResults.titleFilter')
+          }
+          actions={
+            <Button variant="secondary" onClick={clear}>
+              {searching
+                ? t('library.noResults.clearSearch')
+                : t('library.noResults.clearFilter')}
+            </Button>
+          }
+        />
+      );
+    }
+    return (
+      <ul className={GRID}>
+        {visible.map((recipe) => (
+          <li key={recipe.id}>
+            <RecipeCardItem
+              recipe={recipe}
+              time={formatTime(recipe.total_minutes)}
+            />
+          </li>
+        ))}
+      </ul>
+    );
+  };
+
+  return (
+    <>
+      <title>{t('app.name')}</title>
+      <h1 tabIndex={-1} className="pt-8 pb-3 text-title outline-none">
+        {t('library.title')}
+      </h1>
+      <div className="flex flex-col gap-3 pb-6">
+        <SearchField
+          ref={search}
+          className="max-w-xl"
+          value={filters.query}
+          onValueChange={(value) => update({ query: value })}
+          label={t('library.search.label')}
+          placeholder={t('library.search.placeholder')}
+          clearLabel={t('library.search.clear')}
+        />
+        <TagFilter
+          label={t('library.filter.label')}
+          allLabel={t('library.filter.all')}
+          options={pinnedTags.map((tag) => ({ id: tag.id, label: tag.name }))}
+          selectedIds={filters.tagIds}
+          onSelectedIdsChange={(tagIds) => update({ tagIds })}
+          fast={{
+            label: t('library.filter.fast'),
+            pressed: filters.fastOnly,
+            onPressedChange: (fastOnly) => update({ fastOnly }),
+          }}
+        />
+      </div>
+      {renderBody()}
+    </>
+  );
+}
+
+function RecipeCardItem({
+  recipe,
+  time,
+}: {
+  recipe: RecipeSummary;
+  time: string | undefined;
+}) {
+  const { t } = useTranslation();
+  return (
+    <RecipeCard
+      title={recipe.title}
+      tags={recipe.tags.map((tag) => tag.name)}
+      overflowLabel={(count) => t('library.card.moreTags', { count })}
+      time={time}
+      photoUrl={recipe.photo?.thumb_url}
+      renderLink={({ className, children }) => (
+        <Link to={`/recipes/${recipe.id}`} className={className}>
+          {children}
+        </Link>
+      )}
+    />
+  );
+}
+
+export { LibraryPage as Component };
diff --git a/libs/feature-recipes/src/testing/render-library.tsx b/libs/feature-recipes/src/testing/render-library.tsx
new file mode 100644
index 0000000..9f3e9f9
--- /dev/null
+++ b/libs/feature-recipes/src/testing/render-library.tsx
@@ -0,0 +1,63 @@
+import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
+import { render } from '@testing-library/react';
+import { HttpResponse, http } from 'msw';
+import { createMemoryRouter, RouterProvider } from 'react-router';
+import type { RecipeSummary, TagRead } from '@bite-and-board/data-access';
+import { initI18n } from '@bite-and-board/i18n';
+import { DirectionProvider } from '@bite-and-board/ui-components';
+import { Component as LibraryPage } from '../routes/library';
+import { server } from './server';
+
+initI18n();
+
+export function recipe(
+  id: string,
+  title: string,
+  overrides: Partial<RecipeSummary> = {},
+): RecipeSummary {
+  return {
+    id,
+    title,
+    tags: [],
+    total_minutes: null,
+    photo: null,
+    created_at: '2026-10-27T12:00:00Z',
+    ...overrides,
+  };
+}
+
+/** Serves these recipes (newest first, as the API does) at GET /api/recipes. */
+export function serveRecipes(recipes: RecipeSummary[]) {
+  server.use(http.get('*/api/recipes', () => HttpResponse.json(recipes)));
+}
+
+/** Serves these tags (pinned first, as the API does) at GET /api/tags. */
+export function serveTags(tags: TagRead[]) {
+  server.use(http.get('*/api/tags', () => HttpResponse.json(tags)));
+}
+
+/**
+ * Renders the library at `path`, with a stub detail route to navigate to.
+ * `tags` are served unless it is null (the test registers its own handler).
+ */
+export function renderLibrary(path = '/', tags: TagRead[] | null = []) {
+  if (tags) serveTags(tags);
+  const router = createMemoryRouter(
+    [
+      { path: '/', Component: LibraryPage },
+      { path: '/recipes/:id', element: <p>recipe detail stub</p> },
+    ],
+    { initialEntries: [path] },
+  );
+  const queryClient = new QueryClient({
+    defaultOptions: { queries: { retry: false } },
+  });
+  render(
+    <QueryClientProvider client={queryClient}>
+      <DirectionProvider dir="rtl">
+        <RouterProvider router={router} />
+      </DirectionProvider>
+    </QueryClientProvider>,
+  );
+  return router;
+}
diff --git a/libs/feature-recipes/src/testing/server.ts b/libs/feature-recipes/src/testing/server.ts
new file mode 100644
index 0000000..4601446
--- /dev/null
+++ b/libs/feature-recipes/src/testing/server.ts
@@ -0,0 +1,4 @@
+import { setupServer } from 'msw/node';
+
+/** The API stand-in for component tests; each spec adds its own handlers. */
+export const server = setupServer();
diff --git a/libs/feature-recipes/src/testing/setup.ts b/libs/feature-recipes/src/testing/setup.ts
new file mode 100644
index 0000000..984efce
--- /dev/null
+++ b/libs/feature-recipes/src/testing/setup.ts
@@ -0,0 +1,24 @@
+import { client } from '@bite-and-board/data-access';
+import { server } from './server';
+
+// The generated client uses relative `/api` URLs, which Node's fetch rejects;
+// the page origin gives MSW something to match.
+client.setConfig({ baseUrl: window.location.origin });
+
+// jsdom gaps that Radix (the chip row) relies on.
+class ResizeObserverStub {
+  observe() {
+    /* no layout in jsdom */
+  }
+  unobserve() {
+    /* no layout in jsdom */
+  }
+  disconnect() {
+    /* no layout in jsdom */
+  }
+}
+globalThis.ResizeObserver ??= ResizeObserverStub;
+
+beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
+afterEach(() => server.resetHandlers());
+afterAll(() => server.close());
diff --git a/libs/feature-recipes/tsconfig.json b/libs/feature-recipes/tsconfig.json
new file mode 100644
index 0000000..8c5fc02
--- /dev/null
+++ b/libs/feature-recipes/tsconfig.json
@@ -0,0 +1,13 @@
+{
+  "files": [],
+  "include": [],
+  "references": [
+    {
+      "path": "./tsconfig.lib.json"
+    },
+    {
+      "path": "./tsconfig.spec.json"
+    }
+  ],
+  "extends": "../../tsconfig.base.json"
+}
diff --git a/libs/feature-recipes/tsconfig.lib.json b/libs/feature-recipes/tsconfig.lib.json
new file mode 100644
index 0000000..4b37df1
--- /dev/null
+++ b/libs/feature-recipes/tsconfig.lib.json
@@ -0,0 +1,60 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": {
+    "outDir": "dist",
+    "types": [
+      "node",
+      "@nx/react/typings/cssmodule.d.ts",
+      "@nx/react/typings/image.d.ts"
+    ],
+    "rootDir": "src",
+    "lib": ["es2022", "dom", "dom.iterable"],
+    "jsx": "react-jsx",
+    "module": "esnext",
+    "moduleResolution": "bundler",
+    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo"
+  },
+  "exclude": [
+    "out-tsc",
+    "dist",
+    "**/*.spec.ts",
+    "**/*.test.ts",
+    "**/*.spec.tsx",
+    "**/*.test.tsx",
+    "**/*.spec.js",
+    "**/*.test.js",
+    "**/*.spec.jsx",
+    "**/*.test.jsx",
+    "vite.config.ts",
+    "vite.config.mts",
+    "vitest.config.ts",
+    "vitest.config.mts",
+    "src/**/*.test.ts",
+    "src/**/*.spec.ts",
+    "src/**/*.test.tsx",
+    "src/**/*.spec.tsx",
+    "src/**/*.test.js",
+    "src/**/*.spec.js",
+    "src/**/*.test.jsx",
+    "src/**/*.spec.jsx",
+    "eslint.config.js",
+    "eslint.config.cjs",
+    "eslint.config.mjs",
+    "src/testing"
+  ],
+  "include": ["src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"],
+  "references": [
+    {
+      "path": "../data-access/tsconfig.lib.json"
+    },
+    {
+      "path": "../i18n/tsconfig.lib.json"
+    },
+    {
+      "path": "../recipe-domain/tsconfig.lib.json"
+    },
+    {
+      "path": "../ui-components/tsconfig.lib.json"
+    }
+  ]
+}
diff --git a/libs/feature-recipes/tsconfig.spec.json b/libs/feature-recipes/tsconfig.spec.json
new file mode 100644
index 0000000..804f695
--- /dev/null
+++ b/libs/feature-recipes/tsconfig.spec.json
@@ -0,0 +1,39 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": {
+    "outDir": "./out-tsc/vitest",
+    "types": [
+      "vitest/globals",
+      "vitest/importMeta",
+      "vite/client",
+      "node",
+      "vitest"
+    ],
+    "jsx": "react-jsx",
+    "module": "esnext",
+    "moduleResolution": "bundler",
+    "lib": ["es2022", "dom", "dom.iterable"]
+  },
+  "include": [
+    "vite.config.ts",
+    "vite.config.mts",
+    "vitest.config.ts",
+    "vitest.config.mts",
+    "src/**/*.test.ts",
+    "src/**/*.spec.ts",
+    "src/**/*.test.tsx",
+    "src/**/*.spec.tsx",
+    "src/**/*.test.js",
+    "src/**/*.spec.js",
+    "src/**/*.test.jsx",
+    "src/**/*.spec.jsx",
+    "src/**/*.d.ts",
+    "src/testing/**/*.ts",
+    "src/testing/**/*.tsx"
+  ],
+  "references": [
+    {
+      "path": "./tsconfig.lib.json"
+    }
+  ]
+}
diff --git a/libs/feature-recipes/vite.config.mts b/libs/feature-recipes/vite.config.mts
new file mode 100644
index 0000000..2c86234
--- /dev/null
+++ b/libs/feature-recipes/vite.config.mts
@@ -0,0 +1,23 @@
+import { defineConfig } from 'vite';
+import babel from '@rolldown/plugin-babel';
+import react, { reactCompilerPreset } from '@vitejs/plugin-react';
+export default defineConfig(() => ({
+  root: import.meta.dirname,
+  cacheDir: '../../node_modules/.vite/libs/feature-recipes',
+  // Tests run the same compiled components the app ships.
+  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
+  test: {
+    name: '@bite-and-board/feature-recipes',
+    watch: false,
+    passWithNoTests: true,
+    globals: true,
+    environment: 'jsdom',
+    setupFiles: ['./src/testing/setup.ts'],
+    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
+    reporters: ['default'],
+    coverage: {
+      reportsDirectory: './test-output/vitest/coverage',
+      provider: 'v8' as const,
+    },
+  },
+}));
diff --git a/libs/recipe-domain/src/filter-recipes.spec.ts b/libs/recipe-domain/src/filter-recipes.spec.ts
new file mode 100644
index 0000000..b0ee19a
--- /dev/null
+++ b/libs/recipe-domain/src/filter-recipes.spec.ts
@@ -0,0 +1,117 @@
+import {
+  FAST_MINUTES,
+  filterRecipes,
+  type FilterableRecipe,
+  type RecipeFilter,
+} from './filter-recipes.js';
+
+const NONE: RecipeFilter = { query: '', tagIds: [], fastOnly: false };
+
+function recipe(
+  title: string,
+  tagIds: string[] = [],
+  totalMinutes: number | null = null,
+): FilterableRecipe {
+  return {
+    title,
+    tags: tagIds.map((id) => ({ id })),
+    total_minutes: totalMinutes,
+  };
+}
+
+const shakshuka = recipe('שקשוקה', ['breakfast'], 25);
+const lasagna = recipe('לזניה', ['dinner', 'party'], 90);
+const cake = recipe('עוגת שוקולד', ['dessert', 'party'], 30);
+const salad = recipe('Greek Salad', [], null);
+const ALL = [shakshuka, lasagna, cake, salad];
+
+describe('filterRecipes', () => {
+  it('returns everything, in order, for the empty filter', () => {
+    expect(filterRecipes(ALL, NONE)).toEqual(ALL);
+  });
+
+  it('matches a title substring', () => {
+    expect(filterRecipes(ALL, { ...NONE, query: 'עוגת' })).toEqual([cake]);
+    expect(filterRecipes(ALL, { ...NONE, query: 'זני' })).toEqual([lasagna]);
+  });
+
+  it('ignores case and surrounding spaces', () => {
+    expect(filterRecipes(ALL, { ...NONE, query: '  GREEK sal ' })).toEqual([
+      salad,
+    ]);
+  });
+
+  it('treats a blank query as no search', () => {
+    expect(filterRecipes(ALL, { ...NONE, query: '   ' })).toEqual(ALL);
+  });
+
+  it('returns nothing when no title matches', () => {
+    expect(filterRecipes(ALL, { ...NONE, query: 'פיצה' })).toEqual([]);
+  });
+
+  it('keeps recipes that have one selected tag', () => {
+    expect(filterRecipes(ALL, { ...NONE, tagIds: ['party'] })).toEqual([
+      lasagna,
+      cake,
+    ]);
+  });
+
+  it('requires every selected tag (AND)', () => {
+    expect(
+      filterRecipes(ALL, { ...NONE, tagIds: ['party', 'dessert'] }),
+    ).toEqual([cake]);
+    expect(
+      filterRecipes(ALL, { ...NONE, tagIds: ['breakfast', 'dinner'] }),
+    ).toEqual([]);
+  });
+
+  it('matches nothing for a tag no recipe has', () => {
+    expect(filterRecipes(ALL, { ...NONE, tagIds: ['unknown'] })).toEqual([]);
+  });
+
+  it('keeps only recipes with a known total time of at most 30 minutes', () => {
+    expect(FAST_MINUTES).toBe(30);
+    expect(filterRecipes(ALL, { ...NONE, fastOnly: true })).toEqual([
+      shakshuka,
+      cake,
+    ]);
+  });
+
+  it('excludes recipes whose time is unknown or just over the limit', () => {
+    const over = recipe('ארוך', [], 31);
+    const zero = recipe('מיידי', [], 0);
+    expect(
+      filterRecipes([salad, over, zero], { ...NONE, fastOnly: true }),
+    ).toEqual([zero]);
+  });
+
+  it('combines search, tags and the quick chip', () => {
+    const filter: RecipeFilter = {
+      query: 'שוק',
+      tagIds: ['party'],
+      fastOnly: true,
+    };
+    expect(filterRecipes(ALL, filter)).toEqual([cake]);
+    expect(filterRecipes(ALL, { ...filter, query: 'לזניה' })).toEqual([]);
+  });
+
+  it('does not change its input', () => {
+    const input = [...ALL];
+    filterRecipes(input, { query: 'ש', tagIds: ['party'], fastOnly: true });
+    expect(input).toEqual(ALL);
+  });
+
+  it('filters 200 recipes in under 100 ms (NFR-3)', () => {
+    const recipes = Array.from({ length: 200 }, (_, n) =>
+      recipe(`מתכון מספר ${n} עם שם ארוך יחסית`, [`tag-${n % 13}`], n % 90),
+    );
+    const filter: RecipeFilter = {
+      query: 'מספר 1',
+      tagIds: ['tag-1'],
+      fastOnly: true,
+    };
+    const start = performance.now();
+    filterRecipes(recipes, filter);
+    expect(performance.now() - start).toBeLessThan(100);
+  });
+});
diff --git a/libs/recipe-domain/src/filter-recipes.ts b/libs/recipe-domain/src/filter-recipes.ts
new file mode 100644
index 0000000..ff3447f
--- /dev/null
+++ b/libs/recipe-domain/src/filter-recipes.ts
@@ -0,0 +1,37 @@
+/** "עד 30 דקות": the quick-recipe cutoff in minutes (inclusive). */
+export const FAST_MINUTES = 30;
+
+/** The fields the library filter reads; the API summary satisfies it structurally. */
+export interface FilterableRecipe {
+  title: string;
+  tags: readonly { id: string }[];
+  total_minutes: number | null;
+}
+
+export interface RecipeFilter {
+  /** Case-insensitive substring of the title; blank matches everything. */
+  query: string;
+  /** A recipe must have every one of these tags (AND). */
+  tagIds: readonly string[];
+  /** Keep only recipes whose total time is known and at most FAST_MINUTES. */
+  fastOnly: boolean;
+}
+
+/**
+ * The library filter (AD-26): search, tags and the quick chip combine with AND.
+ * Pure, and keeps the input order.
+ */
+export function filterRecipes<T extends FilterableRecipe>(
+  recipes: readonly T[],
+  { query, tagIds, fastOnly }: RecipeFilter,
+): T[] {
+  const needle = query.trim().toLocaleLowerCase('he');
+  return recipes.filter(
+    (recipe) =>
+      recipe.title.toLocaleLowerCase('he').includes(needle) &&
+      tagIds.every((id) => recipe.tags.some((tag) => tag.id === id)) &&
+      (!fastOnly ||
+        (recipe.total_minutes !== null &&
+          recipe.total_minutes <= FAST_MINUTES)),
+  );
+}
diff --git a/libs/ui-components/src/components/empty-state.tsx b/libs/ui-components/src/components/empty-state.tsx
new file mode 100644
index 0000000..3cf17f1
--- /dev/null
+++ b/libs/ui-components/src/components/empty-state.tsx
@@ -0,0 +1,37 @@
+import type * as React from 'react';
+import { cn } from '../lib/utils';
+
+export interface EmptyStateProps {
+  title: string;
+  description?: string;
+  /** Buttons or links under the text. */
+  actions?: React.ReactNode;
+  className?: string;
+}
+
+/** A centred message for "nothing here yet" and "nothing matches" (UX-DR17). */
+export function EmptyState({
+  title,
+  description,
+  actions,
+  className,
+}: EmptyStateProps) {
+  return (
+    <div
+      className={cn(
+        'flex flex-col items-center gap-3 px-4 py-16 text-center',
+        className,
+      )}
+    >
+      <h2 className="text-title">{title}</h2>
+      {description ? (
+        <p className="max-w-detail text-muted-foreground">{description}</p>
+      ) : null}
+      {actions ? (
+        <div className="mt-2 flex flex-wrap justify-center gap-2">
+          {actions}
+        </div>
+      ) : null}
+    </div>
+  );
+}
diff --git a/libs/ui-components/src/components/library-parts.spec.tsx b/libs/ui-components/src/components/library-parts.spec.tsx
new file mode 100644
index 0000000..02aff44
--- /dev/null
+++ b/libs/ui-components/src/components/library-parts.spec.tsx
@@ -0,0 +1,235 @@
+import { fireEvent, render, screen } from '@testing-library/react';
+import { DirectionProvider } from './ui/direction';
+import { EmptyState } from './empty-state';
+import { RecipeCard, RecipeCardSkeleton } from './recipe-card';
+import { SearchField } from './search-field';
+import { TagFilter } from './tag-filter';
+
+const link = ({
+  className,
+  children,
+}: {
+  className: string;
+  children: React.ReactNode;
+}) => (
+  <a href="/recipes/1" className={className}>
+    {children}
+  </a>
+);
+
+describe('RecipeCard', () => {
+  it('is one link holding the title, up to two tags, +N and the time', () => {
+    render(
+      <RecipeCard
+        title="שקשוקה"
+        tags={['בוקר', 'על האש', 'מסיבות', 'מהיר']}
+        overflowLabel={(n) => `ועוד ${n} תגיות`}
+        time="30 דק׳"
+        renderLink={link}
+      />,
+    );
+    const card = screen.getByRole('link');
+    expect(card.getAttribute('href')).toBe('/recipes/1');
+    expect(card.className).toContain('hover:scale-102');
+    expect(card.className).toContain('active:scale-98');
+    expect(screen.getByRole('heading', { name: 'שקשוקה' })).toBeTruthy();
+    expect(screen.getByText('בוקר')).toBeTruthy();
+    expect(screen.getByText('על האש')).toBeTruthy();
+    expect(screen.queryByText('מסיבות')).toBeNull();
+    expect(screen.getByLabelText('ועוד 2 תגיות').textContent).toBe('+2');
+    expect(screen.getByText('30 דק׳')).toBeTruthy();
+  });
+
+  it('shows a lazy photo and the regular title size when it has one', () => {
+    const { container } = render(
+      <RecipeCard
+        title="לזניה"
+        tags={[]}
+        photoUrl="/media/lasagna.webp"
+        renderLink={link}
+      />,
+    );
+    const photo = container.querySelector('img');
+    expect(photo?.getAttribute('src')).toBe('/media/lasagna.webp');
+    expect(photo?.getAttribute('loading')).toBe('lazy');
+    expect(photo?.getAttribute('alt')).toBe('');
+    expect(screen.getByRole('heading').className).toContain('text-title');
+  });
+
+  it('has no placeholder art and a larger title without a photo', () => {
+    const { container } = render(
+      <RecipeCard title="לזניה" tags={[]} renderLink={link} />,
+    );
+    expect(container.querySelector('img')).toBeNull();
+    expect(screen.getByRole('heading').className).toContain('text-display');
+  });
+
+  it('leaves out the time and the +N pill when there is nothing to show', () => {
+    const { container } = render(
+      <RecipeCard title="לזניה" tags={['ערב']} renderLink={link} />,
+    );
+    expect(container.querySelector('svg')).toBeNull();
+    expect(screen.queryByText(/^\+/)).toBeNull();
+  });
+
+  it('shows just the title when it has neither tags nor time', () => {
+    const { container } = render(
+      <RecipeCard title="לזניה" tags={[]} renderLink={link} />,
+    );
+    expect(container.querySelector('.text-label')).toBeNull();
+  });
+
+  it('renders +N without a label when none is given', () => {
+    render(
+      <RecipeCard title="לזניה" tags={['א', 'ב', 'ג']} renderLink={link} />,
+    );
+    expect(screen.getByText('+1').getAttribute('aria-label')).toBeNull();
+  });
+});
+
+describe('RecipeCardSkeleton', () => {
+  it('is hidden from assistive technology', () => {
+    const { container } = render(<RecipeCardSkeleton />);
+    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
+      'true',
+    );
+  });
+});
+
+describe('SearchField', () => {
+  it('is a labelled search box that reports typing', () => {
+    const onValueChange = vi.fn();
+    render(
+      <SearchField
+        value=""
+        onValueChange={onValueChange}
+        label="חיפוש מתכונים"
+        clearLabel="ניקוי"
+      />,
+    );
+    fireEvent.change(screen.getByRole('searchbox', { name: 'חיפוש מתכונים' }), {
+      target: { value: 'עוף' },
+    });
+    expect(onValueChange).toHaveBeenCalledWith('עוף');
+    expect(screen.queryByRole('button', { name: 'ניקוי' })).toBeNull();
+  });
+
+  it('clears through the x button once it has text', () => {
+    const onValueChange = vi.fn();
+    render(
+      <SearchField
+        value="עוף"
+        onValueChange={onValueChange}
+        label="חיפוש מתכונים"
+        clearLabel="ניקוי"
+      />,
+    );
+    fireEvent.click(screen.getByRole('button', { name: 'ניקוי' }));
+    expect(onValueChange).toHaveBeenCalledWith('');
+  });
+});
+
+describe('TagFilter', () => {
+  const options = [
+    { id: 'a', label: 'בוקר' },
+    { id: 'b', label: 'ערב' },
+  ];
+
+  function setup(selectedIds: string[] = [], fastPressed = false) {
+    const onSelectedIdsChange = vi.fn();
+    const onPressedChange = vi.fn();
+    render(
+      <DirectionProvider dir="rtl">
+        <TagFilter
+          label="תגיות"
+          allLabel="הכל"
+          options={options}
+          selectedIds={selectedIds}
+          onSelectedIdsChange={onSelectedIdsChange}
+          fast={{
+            label: 'עד 30 דקות',
+            pressed: fastPressed,
+            onPressedChange,
+          }}
+        />
+      </DirectionProvider>,
+    );
+    return { onSelectedIdsChange, onPressedChange };
+  }
+
+  const pressed = (name: string) =>
+    screen.getByRole('button', { name }).getAttribute('aria-pressed');
+
+  it('starts with "הכל" pressed when nothing is selected', () => {
+    setup();
+    expect(pressed('הכל')).toBe('true');
+    expect(pressed('בוקר')).toBe('false');
+    expect(pressed('עד 30 דקות')).toBe('false');
+    expect(screen.getByRole('toolbar', { name: 'תגיות' })).toBeTruthy();
+  });
+
+  it('adds a tag to the selection', () => {
+    const { onSelectedIdsChange } = setup(['a']);
+    expect(pressed('הכל')).toBe('false');
+    expect(pressed('בוקר')).toBe('true');
+    fireEvent.click(screen.getByRole('button', { name: 'ערב' }));
+    expect(onSelectedIdsChange).toHaveBeenCalledWith(['a', 'b']);
+  });
+
+  it('removes a tag from the selection', () => {
+    const { onSelectedIdsChange } = setup(['a', 'b']);
+    fireEvent.click(screen.getByRole('button', { name: 'בוקר' }));
+    expect(onSelectedIdsChange).toHaveBeenCalledWith(['b']);
+  });
+
+  it('clears the tags with "הכל"', () => {
+    const { onSelectedIdsChange } = setup(['a', 'b']);
+    fireEvent.click(screen.getByRole('button', { name: 'הכל' }));
+    expect(onSelectedIdsChange).toHaveBeenCalledWith([]);
+  });
+
+  it('does nothing when "הכל" is pressed while already selected', () => {
+    const { onSelectedIdsChange, onPressedChange } = setup();
+    fireEvent.click(screen.getByRole('button', { name: 'הכל' }));
+    expect(onSelectedIdsChange).not.toHaveBeenCalled();
+    expect(onPressedChange).not.toHaveBeenCalled();
+  });
+
+  it('toggles the quick chip on its own', () => {
+    const { onSelectedIdsChange, onPressedChange } = setup(['a']);
+    fireEvent.click(screen.getByRole('button', { name: 'עד 30 דקות' }));
+    expect(onPressedChange).toHaveBeenCalledWith(true);
+    expect(onSelectedIdsChange).not.toHaveBeenCalled();
+  });
+
+  it('turns the quick chip off', () => {
+    const { onPressedChange } = setup([], true);
+    expect(pressed('עד 30 דקות')).toBe('true');
+    expect(pressed('הכל')).toBe('true');
+    fireEvent.click(screen.getByRole('button', { name: 'עד 30 דקות' }));
+    expect(onPressedChange).toHaveBeenCalledWith(false);
+  });
+});
+
+describe('EmptyState', () => {
+  it('shows a heading, text and actions', () => {
+    render(
+      <EmptyState
+        title="עוד אין כאן מתכונים"
+        description="אפשר לחזור מאוחר יותר"
+        actions={<button type="button">רענון</button>}
+      />,
+    );
+    expect(
+      screen.getByRole('heading', { name: 'עוד אין כאן מתכונים' }),
+    ).toBeTruthy();
+    expect(screen.getByText('אפשר לחזור מאוחר יותר')).toBeTruthy();
+    expect(screen.getByRole('button', { name: 'רענון' })).toBeTruthy();
+  });
+
+  it('can be just a heading', () => {
+    render(<EmptyState title="עוד אין כאן מתכונים" />);
+    expect(screen.queryByRole('button')).toBeNull();
+    expect(document.querySelector('p')).toBeNull();
+  });
+});
diff --git a/libs/ui-components/src/components/library-parts.stories.tsx b/libs/ui-components/src/components/library-parts.stories.tsx
new file mode 100644
index 0000000..8907485
--- /dev/null
+++ b/libs/ui-components/src/components/library-parts.stories.tsx
@@ -0,0 +1,124 @@
+import { useState } from 'react';
+import type { Meta, StoryObj } from '@storybook/react-vite';
+import { Button } from './ui/button';
+import { EmptyState } from './empty-state';
+import { RecipeCard, RecipeCardSkeleton } from './recipe-card';
+import { SearchField } from './search-field';
+import { TagFilter } from './tag-filter';
+
+const meta = { title: 'Library/Pieces' } satisfies Meta;
+
+export default meta;
+type Story = StoryObj<typeof meta>;
+
+const link = ({
+  className,
+  children,
+}: {
+  className: string;
+  children: React.ReactNode;
+}) => (
+  <a href="#recipe" className={className}>
+    {children}
+  </a>
+);
+
+// A flat grey 4:3 stand-in, so the story needs no network.
+const PHOTO =
+  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='450'%3E%3Crect width='600' height='450' fill='gray'/%3E%3C/svg%3E";
+
+const overflowLabel = (hidden: number) => `ועוד ${hidden} תגיות`;
+
+export const RecipeCards: Story = {
+  name: 'RecipeCard',
+  render: () => (
+    <div className="grid max-w-library gap-4 sm:grid-cols-2 lg:grid-cols-3">
+      <RecipeCard
+        title="שקשוקה"
+        tags={['בוקר', 'על האש', 'מסיבות', 'פינגר פוד']}
+        overflowLabel={overflowLabel}
+        time="30 דק׳"
+        photoUrl={PHOTO}
+        renderLink={link}
+      />
+      <RecipeCard
+        title="עוגת שוקולד מרירה"
+        tags={['קינוח']}
+        time="1 שע׳ 15 דק׳"
+        renderLink={link}
+      />
+      <RecipeCard title="מרק עדשים" tags={[]} renderLink={link} />
+    </div>
+  ),
+};
+
+export const RecipeCardSkeletons: Story = {
+  name: 'RecipeCardSkeleton',
+  render: () => (
+    <div className="grid max-w-library gap-4 sm:grid-cols-2 lg:grid-cols-3">
+      {Array.from({ length: 3 }, (_, n) => (
+        <RecipeCardSkeleton key={n} />
+      ))}
+    </div>
+  ),
+};
+
+export const SearchFields: Story = {
+  name: 'SearchField',
+  render: function Render() {
+    const [value, setValue] = useState('לזניה');
+    return (
+      <SearchField
+        className="max-w-md"
+        value={value}
+        onValueChange={setValue}
+        label="חיפוש מתכונים"
+        clearLabel="ניקוי החיפוש"
+        placeholder="חיפוש מתכונים"
+      />
+    );
+  },
+};
+
+const TAGS = [
+  'בוקר',
+  'בראנץ׳',
+  'צהריים',
+  'ערב',
+  'נשנוש',
+  'עיקרית',
+  'תוספת',
+  'מרק',
+  'קינוח',
+].map((label) => ({ id: label, label }));
+
+export const TagFilters: Story = {
+  name: 'TagFilter',
+  render: function Render() {
+    const [ids, setIds] = useState<string[]>(['ערב']);
+    const [fast, setFast] = useState(false);
+    return (
+      <TagFilter
+        label="סינון לפי תגיות"
+        allLabel="הכל"
+        options={TAGS}
+        selectedIds={ids}
+        onSelectedIdsChange={setIds}
+        fast={{ label: 'עד 30 דקות', pressed: fast, onPressedChange: setFast }}
+      />
+    );
+  },
+};
+
+export const EmptyStates: Story = {
+  name: 'EmptyState',
+  render: () => (
+    <div className="grid gap-8">
+      <EmptyState title="עוד אין כאן מתכונים" />
+      <EmptyState
+        title="לא נמצאו מתכונים ל־'פיצה'"
+        actions={<Button variant="secondary">ניקוי החיפוש</Button>}
+      />
+    </div>
+  ),
+};
diff --git a/libs/ui-components/src/components/recipe-card.tsx b/libs/ui-components/src/components/recipe-card.tsx
new file mode 100644
index 0000000..de64c6d
--- /dev/null
+++ b/libs/ui-components/src/components/recipe-card.tsx
@@ -0,0 +1,112 @@
+import type * as React from 'react';
+import { Clock } from 'lucide-react';
+import { cn } from '../lib/utils';
+import { Board } from './board';
+import { Skeleton } from './ui/skeleton';
+
+/** Tags shown on a card; the rest collapse into a "+N" pill. */
+export const CARD_TAG_LIMIT = 2;
+
+export interface RecipeCardProps {
+  title: string;
+  /** Tag names in display order. */
+  tags: readonly string[];
+  /** Accessible name for the "+N" pill, e.g. "ועוד 3 תגיות". */
+  overflowLabel?: (hidden: number) => string;
+  /** Total time, already formatted; leave out when unknown. */
+  time?: string;
+  /** Photo URL; without one there is no placeholder and the title is larger. */
+  photoUrl?: string;
+  /**
+   * Renders the card's one link around the content. The app passes a router
+   * link; this lib imports no router.
+   */
+  renderLink: (props: {
+    className: string;
+    children: React.ReactNode;
+  }) => React.ReactElement;
+  className?: string;
+}
+
+/** A library card: a small board whose whole surface is one link (UX-DR7). */
+export function RecipeCard({
+  title,
+  tags,
+  overflowLabel,
+  time,
+  photoUrl,
+  renderLink,
+  className,
+}: RecipeCardProps) {
+  const shown = tags.slice(0, CARD_TAG_LIMIT);
+  const hidden = tags.length - shown.length;
+  return renderLink({
+    className: cn(
+      'block rounded-board outline-none transition-transform hover:scale-102 focus-visible:ring-3 focus-visible:ring-ring active:scale-98',
+      className,
+    ),
+    children: (
+      <Board data-slot="recipe-card" className="flex h-full flex-col gap-3">
+        {photoUrl ? (
+          <img
+            src={photoUrl}
+            alt=""
+            loading="lazy"
+            className="aspect-4/3 w-full rounded-md object-cover"
+          />
+        ) : null}
+        <h2
+          dir="auto"
+          className={cn(
+            'break-words',
+            photoUrl ? 'text-title' : 'text-display',
+          )}
+        >
+          {title}
+        </h2>
+        {shown.length > 0 || time ? (
+          <div className="mt-auto flex flex-wrap items-center gap-2 text-label">
+            {shown.map((name) => (
+              <span
+                key={name}
+                dir="auto"
+                className="rounded-full bg-board-foreground/10 px-3 py-1"
+              >
+                {name}
+              </span>
+            ))}
+            {hidden > 0 ? (
+              <span
+                aria-label={overflowLabel?.(hidden)}
+                className="rounded-full bg-board-foreground/10 px-3 py-1"
+              >
+                +{hidden}
+              </span>
+            ) : null}
+            {time ? (
+              <span className="ms-auto flex items-center gap-1">
+                <Clock aria-hidden="true" className="size-4" />
+                <bdi>{time}</bdi>
+              </span>
+            ) : null}
+          </div>
+        ) : null}
+      </Board>
+    ),
+  });
+}
+
+/** Placeholder with the card's footprint while recipes load. */
+export function RecipeCardSkeleton({ className }: { className?: string }) {
+  return (
+    <Board
+      aria-hidden="true"
+      data-slot="recipe-card-skeleton"
+      className={cn('flex flex-col gap-3', className)}
+    >
+      <Skeleton className="aspect-4/3 w-full bg-board-foreground/10" />
+      <Skeleton className="h-7 w-3/4 bg-board-foreground/10" />
+      <Skeleton className="h-6 w-1/2 bg-board-foreground/10" />
+    </Board>
+  );
+}
diff --git a/libs/ui-components/src/components/search-field.tsx b/libs/ui-components/src/components/search-field.tsx
new file mode 100644
index 0000000..9cc35b9
--- /dev/null
+++ b/libs/ui-components/src/components/search-field.tsx
@@ -0,0 +1,56 @@
+import type * as React from 'react';
+import { Search, X } from 'lucide-react';
+import { cn } from '../lib/utils';
+import { Button } from './ui/button';
+import { Input } from './ui/input';
+
+export interface SearchFieldProps extends Omit<
+  React.ComponentProps<'input'>,
+  'value' | 'onChange' | 'type'
+> {
+  value: string;
+  onValueChange: (value: string) => void;
+  /** Accessible name of the field. */
+  label: string;
+  /** Accessible name of the clear (x) button. */
+  clearLabel: string;
+}
+
+/** A pill search field with a clear button that appears once there is text. */
+export function SearchField({
+  value,
+  onValueChange,
+  label,
+  clearLabel,
+  className,
+  ...props
+}: SearchFieldProps) {
+  return (
+    <div className={cn('relative', className)}>
+      <Search
+        aria-hidden="true"
+        className="pointer-events-none absolute inset-y-0 start-4 my-auto size-5 text-muted-foreground"
+      />
+      <Input
+        {...props}
+        type="search"
+        aria-label={label}
+        value={value}
+        onChange={(event) => onValueChange(event.target.value)}
+        className="rounded-full ps-12 pe-12 [&::-webkit-search-cancel-button]:appearance-none"
+      />
+      {value ? (
+        <Button
+          type="button"
+          variant="ghost"
+          size="icon"
+          aria-label={clearLabel}
+          onClick={() => onValueChange('')}
+          className="absolute inset-y-0 end-0"
+        >
+          <X aria-hidden="true" />
+        </Button>
+      ) : null}
+    </div>
+  );
+}
diff --git a/libs/ui-components/src/components/tag-filter.tsx b/libs/ui-components/src/components/tag-filter.tsx
new file mode 100644
index 0000000..5700dde
--- /dev/null
+++ b/libs/ui-components/src/components/tag-filter.tsx
@@ -0,0 +1,84 @@
+import { cn } from '../lib/utils';
+import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
+
+export interface TagFilterOption {
+  id: string;
+  label: string;
+}
+
+export interface TagFilterProps {
+  /** Accessible name of the chip group. */
+  label: string;
+  /** Label of the chip that clears the tag selection. */
+  allLabel: string;
+  options: readonly TagFilterOption[];
+  selectedIds: readonly string[];
+  onSelectedIdsChange: (ids: string[]) => void;
+  /** The independent "quick recipes" chip. */
+  fast: {
+    label: string;
+    pressed: boolean;
+    onPressedChange: (pressed: boolean) => void;
+  };
+  className?: string;
+}
+
+// Item values that are not tag ids; tag ids are UUIDs, so they cannot collide.
+const ALL = 'all';
+const FAST = 'fast';
+
+const CHIP =
+  'bg-secondary text-secondary-foreground hover:bg-secondary/80 data-[state=on]:hover:bg-primary/80';
+
+/**
+ * The library's chip row: "הכל" clears the tags, the other chips are
+ * multi-select (UX-DR11). It scrolls sideways inside its own row.
+ */
+export function TagFilter({
+  label,
+  allLabel,
+  options,
+  selectedIds,
+  onSelectedIdsChange,
+  fast,
+  className,
+}: TagFilterProps) {
+  const value = [
+    ...(selectedIds.length === 0 ? [ALL] : selectedIds),
+    ...(fast.pressed ? [FAST] : []),
+  ];
+  const handleChange = (next: string[]) => {
+    const wantsFast = next.includes(FAST);
+    if (wantsFast !== fast.pressed) fast.onPressedChange(wantsFast);
+    const pressedAll = next.includes(ALL) && !value.includes(ALL);
+    const tags = next.filter((item) => item !== ALL && item !== FAST);
+    const changed =
+      tags.length !== selectedIds.length ||
+      tags.some((id) => !selectedIds.includes(id));
+    if (pressedAll) onSelectedIdsChange([]);
+    else if (changed) onSelectedIdsChange(tags);
+  };
+  return (
+    <div className={cn('overflow-x-auto py-1', className)}>
+      <ToggleGroup
+        type="multiple"
+        aria-label={label}
+        value={value}
+        onValueChange={handleChange}
+        className="flex-nowrap"
+      >
+        <ToggleGroupItem value={ALL} className={CHIP}>
+          {allLabel}
+        </ToggleGroupItem>
+        <ToggleGroupItem value={FAST} className={CHIP}>
+          {fast.label}
+        </ToggleGroupItem>
+        {options.map((option) => (
+          <ToggleGroupItem key={option.id} value={option.id} className={CHIP}>
+            {option.label}
+          </ToggleGroupItem>
+        ))}
+      </ToggleGroup>
+    </div>
+  );
+}
```
