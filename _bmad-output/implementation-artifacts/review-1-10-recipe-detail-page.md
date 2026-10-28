# Review: Story 1.10 Recipe detail page

Spec: `spec-1-10-recipe-detail-page.md`. D1-D6, the Back button and the equal-height library cards are approved by Adi.

## Checks

- `nx run-many -t lint typecheck test build build-storybook`: all pass, no lint warnings. `nx format:check`: pass. (A transient vitest coverage-report ENOENT for recipe-domain appears when many projects run in parallel; a rerun passes.)
- Initial JS: **158.3 KB gzip** (index chunk; budget 200 KB; 1.9 baseline 156.2 KB measured by me with the same method). Lazy chunks: library 2.9 KB, recipe-detail 3.8 KB, shared API/zod chunk 32.4 KB gzip (loaded only with a page).
- Real `AppLayout` tests: `apps/web/src/app/recipe-detail-shell.spec.tsx`.

## Bundle investigation

My first version imported `getErrorCode` from `@bite-and-board/data-access` in `AppProviders` (to skip retries for coded API errors). Nothing in the app entry imported data-access before, so this pulled the whole generated client and zod (about 31 KB gzip) from the lazy library chunk into the initial chunk: 187.4 KB. Fix: `AppProviders` reads the error `code` by hand (one comment explains why). Entry is back to 158.3 KB (+2 KB for he.json and the new ui-components exports).

## Notable decisions made while building

- `AppProviders` query default: no retry for API errors that carry a code (otherwise an unknown recipe took ~7 s to show "not found").
- The title focuses itself on an in-app visit (the recipe loads after the shell's focus attempt).
- Unit plural: label chosen with `count: amount === 1 ? 1 : 0` (no `_two`/`_many` forms).
- Source link only for http(s) URLs.
- `useErrorMessage` moved to `shared/`; new shared `useFormatTime`.
- Library cards: link now `h-full` so the board fills its grid cell (equal height per row, meta pinned with `mt-auto`, no `auto-rows-fr`); story and spec added.
- Deferred (in deferred-work.md): detail photo, Hebrew fractions.

## Changed files

```
 .../implementation-artifacts/deferred-work.md      |  6 +++
 apps/web/src/app/app-providers.tsx                 | 17 +++++++-
 apps/web/src/app/router.tsx                        |  4 ++
 libs/feature-recipes/package.json                  |  5 +++
 .../src/library/use-error-message.ts               | 16 -------
 libs/feature-recipes/src/routes/library.tsx        | 15 ++-----
 libs/i18n/src/he.json                              | 49 ++++++++++++++++++++++
 libs/recipe-domain/src/index.ts                    |  1 +
 .../src/components/library-parts.spec.tsx          | 18 ++++++++
 .../src/components/library-parts.stories.tsx       | 21 ++++++++++
 libs/ui-components/src/components/recipe-card.tsx  |  2 +-
 libs/ui-components/src/index.ts                    | 12 ++++++
 libs/ui-components/src/styles/theme.css            |  2 +
 13 files changed, 138 insertions(+), 30 deletions(-)
new: _bmad-output/implementation-artifacts/review-1-10-recipe-detail-page.md
new: _bmad-output/implementation-artifacts/spec-1-10-recipe-detail-page.md
new: apps/web/src/app/recipe-detail-shell.spec.tsx
new: libs/feature-recipes/src/detail/use-cooking-checks.spec.ts
new: libs/feature-recipes/src/detail/use-cooking-checks.ts
new: libs/feature-recipes/src/routes/recipe-detail.spec.tsx
new: libs/feature-recipes/src/routes/recipe-detail.tsx
new: libs/feature-recipes/src/shared/use-error-message.ts
new: libs/feature-recipes/src/shared/use-format-time.ts
new: libs/feature-recipes/src/testing/render-detail.tsx
new: libs/recipe-domain/src/format-amount.spec.ts
new: libs/recipe-domain/src/format-amount.ts
new: libs/ui-components/src/components/ingredient-board.tsx
new: libs/ui-components/src/components/ingredient-line.tsx
new: libs/ui-components/src/components/recipe-detail-parts.spec.tsx
new: libs/ui-components/src/components/recipe-detail-parts.stories.tsx
new: libs/ui-components/src/components/step-item.tsx
```

## Full diffs (tracked files)

```diff
diff --git a/_bmad-output/implementation-artifacts/deferred-work.md b/_bmad-output/implementation-artifacts/deferred-work.md
index 6ae5ae4..1198acd 100644
--- a/_bmad-output/implementation-artifacts/deferred-work.md
+++ b/_bmad-output/implementation-artifacts/deferred-work.md
@@ -52,3 +52,9 @@
 - source_spec: `_bmad-output/implementation-artifacts/spec-1-6-recipe-data-model-and-read-api.md`
   summary: Move `Unit` and `SourceUnit` (and the countable set) from `app/recipes/units.py` to a shared core module before the Epic 5 import work, or relax the import-linter contract.
   evidence: AD-20 has `DraftRecipe` use the same `Unit` enum, but import-linter forbids `app.imports` from depending on `app.recipes`; Story 1.6 left the enums in `recipes` and did not decide this.
+- source_spec: `_bmad-output/implementation-artifacts/spec-1-10-recipe-detail-page.md`
+  summary: Board-shaped recipe photo with the handle slot and "מקור: {domain}" credit on the detail page (UX-DR8).
+  evidence: Story 1.10's acceptance criteria do not list the photo, so Adi approved leaving it out (D6); no story in Epic 1 builds it yet, so it needs a home (Epic 2 or a 1.x follow-up).
+- source_spec: `_bmad-output/implementation-artifacts/spec-1-10-recipe-detail-page.md`
+  summary: Hebrew fractions in amounts ("חצי כוס" instead of "0.5 כוסות") and unit forms for 2 ("שתי כפות").
+  evidence: Unit labels only have `_one`/`_other` (singular for exactly 1), as AD-20 describes; richer Hebrew grammar is a polish decision for Story 1.11's rounding rules.
diff --git a/apps/web/src/app/app-providers.tsx b/apps/web/src/app/app-providers.tsx
index 20f705d..46998a4 100644
--- a/apps/web/src/app/app-providers.tsx
+++ b/apps/web/src/app/app-providers.tsx
@@ -21,7 +21,22 @@ function AppToaster() {
  */
 export function AppProviders({ children }: { children: ReactNode }) {
   // One cache per mounted app; state keeps it stable across renders.
-  const [queryClient] = useState(() => new QueryClient());
+  const [queryClient] = useState(
+    () =>
+      new QueryClient({
+        defaultOptions: {
+          queries: {
+            // An API error body with a `code` is a final answer ("recipe not
+            // found"); only network and server failures are worth retrying. This
+            // reads the code by hand: importing data-access here would pull the
+            // whole API client into the initial chunk.
+            retry: (failures, error) =>
+              (error as { code?: unknown } | null)?.code === undefined &&
+              failures < 3,
+          },
+        },
+      }),
+  );
   return (
     <QueryClientProvider client={queryClient}>
       <DirectionProvider dir="rtl">
diff --git a/apps/web/src/app/router.tsx b/apps/web/src/app/router.tsx
index 976dd7f..b39e427 100644
--- a/apps/web/src/app/router.tsx
+++ b/apps/web/src/app/router.tsx
@@ -16,6 +16,10 @@ export const routes: RouteObject[] = [
         // The page is its own chunk, loaded when the route first matches (AD-11).
         lazy: () => import('@bite-and-board/feature-recipes/library'),
       },
+      {
+        path: 'recipes/:id',
+        lazy: () => import('@bite-and-board/feature-recipes/recipe-detail'),
+      },
       // Inside the layout, so the top bar stays on unknown paths.
       { path: '*', Component: NotFound },
     ],
diff --git a/libs/feature-recipes/package.json b/libs/feature-recipes/package.json
index 60a185b..aaa8a0f 100644
--- a/libs/feature-recipes/package.json
+++ b/libs/feature-recipes/package.json
@@ -9,6 +9,11 @@
       "import": "./src/routes/library.tsx",
       "default": "./src/routes/library.tsx"
     },
+    "./recipe-detail": {
+      "types": "./src/routes/recipe-detail.tsx",
+      "import": "./src/routes/recipe-detail.tsx",
+      "default": "./src/routes/recipe-detail.tsx"
+    },
     "./package.json": "./package.json"
   },
   "nx": {
diff --git a/libs/feature-recipes/src/library/use-error-message.ts b/libs/feature-recipes/src/library/use-error-message.ts
deleted file mode 100644
index 906f2a2..0000000
--- a/libs/feature-recipes/src/library/use-error-message.ts
+++ /dev/null
@@ -1,16 +0,0 @@
-import type { ParseKeys } from 'i18next';
-import { useTranslation } from 'react-i18next';
-import { getErrorCode } from '@bite-and-board/data-access';
-
-/** An API error as Hebrew copy (AD-28): `errors.<code>`, or the generic message. */
-export function useErrorMessage() {
-  const { t, i18n } = useTranslation();
-  return (error: unknown) => {
-    const code = getErrorCode(error);
-    // The code comes from the server, so the key is checked at runtime.
-    const key = code ? (`errors.${code}` as ParseKeys) : undefined;
-    const message: string =
-      key && i18n.exists(key) ? t(key) : t('errors.unknown');
-    return message;
-  };
-}
diff --git a/libs/feature-recipes/src/routes/library.tsx b/libs/feature-recipes/src/routes/library.tsx
index bda8d6a..3cfa33a 100644
--- a/libs/feature-recipes/src/routes/library.tsx
+++ b/libs/feature-recipes/src/routes/library.tsx
@@ -16,11 +16,11 @@ import {
   SearchField,
   TagFilter,
 } from '@bite-and-board/ui-components';
-import { useErrorMessage } from '../library/use-error-message';
+import { useErrorMessage } from '../shared/use-error-message';
+import { useFormatTime } from '../shared/use-format-time';
 import { useLibraryFilters } from '../library/use-library-filters';
 
 const SKELETON_COUNT = 6;
-const MINUTES_PER_HOUR = 60;
 
 const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';
 
@@ -36,6 +36,7 @@ function isTypingTarget(target: EventTarget | null) {
 export function LibraryPage() {
   const { t } = useTranslation();
   const errorMessage = useErrorMessage();
+  const formatTime = useFormatTime();
   const search = useRef<HTMLInputElement>(null);
 
   const recipes = useQuery(recipesListRecipesOptions());
@@ -65,16 +66,6 @@ export function LibraryPage() {
     return () => document.removeEventListener('keydown', onKeyDown);
   }, []);
 
-  const formatTime = (minutes: number | null) => {
-    if (minutes === null) return undefined;
-    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
-    const rest = minutes % MINUTES_PER_HOUR;
-    if (hours === 0) return t('library.card.minutes', { minutes: rest });
-    return rest === 0
-      ? t('library.card.hours', { hours })
-      : t('library.card.hoursMinutes', { hours, minutes: rest });
-  };
-
   const renderBody = () => {
     // Waiting for the tags too, so a tag filter in the URL never flashes the full list.
     if (recipes.isPending || tags.isPending) {
diff --git a/libs/i18n/src/he.json b/libs/i18n/src/he.json
index 96e2929..3df7bcf 100644
--- a/libs/i18n/src/he.json
+++ b/libs/i18n/src/he.json
@@ -60,5 +60,54 @@
     "recipe_not_found": "המתכון לא נמצא",
     "tag_not_found": "התגית לא נמצאה",
     "unknown": "משהו השתבש, אפשר לנסות שוב"
+  },
+  "units": {
+    "g_one": "גרם",
+    "g_other": "גרם",
+    "kg_one": "ק״ג",
+    "kg_other": "ק״ג",
+    "ml_one": "מ״ל",
+    "ml_other": "מ״ל",
+    "l_one": "ליטר",
+    "l_other": "ליטרים",
+    "tsp_one": "כפית",
+    "tsp_other": "כפיות",
+    "tbsp_one": "כף",
+    "tbsp_other": "כפות",
+    "cup_one": "כוס",
+    "cup_other": "כוסות",
+    "unit_one": "יחידה",
+    "unit_other": "יחידות",
+    "pinch_one": "קמצוץ",
+    "pinch_other": "קמצוצים",
+    "clove_one": "שן",
+    "clove_other": "שיניים",
+    "slice_one": "פרוסה",
+    "slice_other": "פרוסות",
+    "can_one": "קופסה",
+    "can_other": "קופסאות",
+    "package_one": "חבילה",
+    "package_other": "חבילות"
+  },
+  "sourceUnits": {
+    "oz": "oz",
+    "lb": "lb",
+    "fl_oz": "fl oz"
+  },
+  "detail": {
+    "loading": "טוען מתכון",
+    "prep": "הכנה: {{time}}",
+    "cook": "בישול: {{time}}",
+    "ingredients": "מצרכים",
+    "steps": "אופן הכנה",
+    "notes": "הערות וטיפים",
+    "source": "למתכון המקורי",
+    "showOriginal": "הצג מתכון מקורי",
+    "clearChecks": "ניקוי סימונים",
+    "toTaste": "לפי הטעם",
+    "originalHint": "במקור {{value}}",
+    "originalToTaste": "במקור: לפי הטעם",
+    "stepOriginal": "במקור: {{text}}",
+    "back": "חזרה למתכונים"
   }
 }
diff --git a/libs/recipe-domain/src/index.ts b/libs/recipe-domain/src/index.ts
index 46e78af..2578ec7 100644
--- a/libs/recipe-domain/src/index.ts
+++ b/libs/recipe-domain/src/index.ts
@@ -4,3 +4,4 @@ export {
   type FilterableRecipe,
   type RecipeFilter,
 } from './filter-recipes.js';
+export { formatAmount } from './format-amount.js';
diff --git a/libs/ui-components/src/components/library-parts.spec.tsx b/libs/ui-components/src/components/library-parts.spec.tsx
index 02aff44..b8d3cd3 100644
--- a/libs/ui-components/src/components/library-parts.spec.tsx
+++ b/libs/ui-components/src/components/library-parts.spec.tsx
@@ -40,6 +40,24 @@ describe('RecipeCard', () => {
     expect(screen.getByText('30 דק׳')).toBeTruthy();
   });
 
+  it('fills its grid cell, with the tags and time pinned to the bottom', () => {
+    const { container } = render(
+      <RecipeCard
+        title="לזניה"
+        tags={['ערב']}
+        time="30 דק׳"
+        renderLink={link}
+      />,
+    );
+    expect(screen.getByRole('link').className).toContain('h-full');
+    expect(
+      container.querySelector('[data-slot="recipe-card"]')?.className,
+    ).toContain('h-full');
+    expect(container.querySelector('.text-label')?.className).toContain(
+      'mt-auto',
+    );
+  });
+
   it('shows a lazy photo and the regular title size when it has one', () => {
     const { container } = render(
       <RecipeCard
diff --git a/libs/ui-components/src/components/library-parts.stories.tsx b/libs/ui-components/src/components/library-parts.stories.tsx
index 8907485..27a06b0 100644
--- a/libs/ui-components/src/components/library-parts.stories.tsx
+++ b/libs/ui-components/src/components/library-parts.stories.tsx
@@ -52,6 +52,27 @@ export const RecipeCards: Story = {
   ),
 };
 
+export const RecipeCardsEqualHeight: Story = {
+  name: 'RecipeCard (equal height per row)',
+  render: () => (
+    <ul className="grid max-w-library gap-4 sm:grid-cols-2 lg:grid-cols-3">
+      {[
+        { title: 'עוף', tags: ['ערב'], time: '40 דק׳' },
+        {
+          title: 'פשטידת תרד וגבינות עם בצל מקורמל וקרוסטה פריכה של פירורי לחם',
+          tags: ['ערב', 'צמחוני'],
+          time: '1 שע׳ 10 דק׳',
+        },
+        { title: 'סלט', tags: [], time: undefined },
+      ].map((recipe) => (
+        <li key={recipe.title}>
+          <RecipeCard {...recipe} renderLink={link} />
+        </li>
+      ))}
+    </ul>
+  ),
+};
+
 export const RecipeCardSkeletons: Story = {
   name: 'RecipeCardSkeleton',
   render: () => (
diff --git a/libs/ui-components/src/components/recipe-card.tsx b/libs/ui-components/src/components/recipe-card.tsx
index de64c6d..44639d4 100644
--- a/libs/ui-components/src/components/recipe-card.tsx
+++ b/libs/ui-components/src/components/recipe-card.tsx
@@ -42,7 +42,7 @@ export function RecipeCard({
   const hidden = tags.length - shown.length;
   return renderLink({
     className: cn(
-      'block rounded-board outline-none transition-transform hover:scale-102 focus-visible:ring-3 focus-visible:ring-ring active:scale-98',
+      'block h-full rounded-board outline-none transition-transform hover:scale-102 focus-visible:ring-3 focus-visible:ring-ring active:scale-98',
       className,
     ),
     children: (
diff --git a/libs/ui-components/src/index.ts b/libs/ui-components/src/index.ts
index 94e2eb6..fc1b3fe 100644
--- a/libs/ui-components/src/index.ts
+++ b/libs/ui-components/src/index.ts
@@ -32,3 +32,15 @@ export {
   type TagFilterProps,
 } from './components/tag-filter';
 export { EmptyState, type EmptyStateProps } from './components/empty-state';
+export { Toggle, toggleVariants } from './components/ui/toggle';
+export {
+  IngredientLine,
+  type IngredientLineProps,
+  type IngredientQuantity,
+} from './components/ingredient-line';
+export { StepItem, type StepItemProps } from './components/step-item';
+export {
+  IngredientBoard,
+  RecipeDetailSkeleton,
+  type IngredientBoardProps,
+} from './components/ingredient-board';
diff --git a/libs/ui-components/src/styles/theme.css b/libs/ui-components/src/styles/theme.css
index 0805728..3a53d5a 100644
--- a/libs/ui-components/src/styles/theme.css
+++ b/libs/ui-components/src/styles/theme.css
@@ -110,6 +110,8 @@
   /* Content widths (DESIGN.md Layout): library 1200px, detail ~1040px. */
   --container-library: 75rem;
   --container-detail: 65rem;
+  /* The sticky ingredient column on the detail page (UX-DR20): 400px. */
+  --container-board: 25rem;
 
   /* Typography roles; `-lg` sizes are applied with the `lg:` variant. */
   --text-display: 2.5rem;
```

## New files

### apps/web/src/app/recipe-detail-shell.spec.tsx

```
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { client } from '@bite-and-board/data-access';
import { AppProviders } from './app-providers';
import { routes } from './router';

const RECIPE = {
  id: 'r1',
  title: 'שקשוקה',
  description: null,
  base_servings: 4,
  prep_time_minutes: 5,
  cook_time_minutes: 20,
  source_url: null,
  notes: null,
  photo: null,
  tags: [],
  ingredients: [
    {
      id: 'i1',
      name: 'עגבניות',
      amount: 4,
      unit: null,
      note: null,
      original: null,
      source: null,
    },
  ],
  steps: [{ id: 's1', description: 'מבשלים', source_text: null }],
  created_at: '2026-10-27T12:00:00Z',
  updated_at: '2026-10-27T12:00:00Z',
};

const server = setupServer(
  http.get('*/api/recipes', () =>
    HttpResponse.json([
      {
        id: 'r1',
        title: 'שקשוקה',
        tags: [],
        total_minutes: 25,
        photo: null,
        created_at: '2026-10-27T12:00:00Z',
      },
    ]),
  ),
  http.get('*/api/tags', () => HttpResponse.json([])),
  http.get('*/api/recipes/:id', ({ params }) =>
    params.id === 'r1'
      ? HttpResponse.json(RECIPE)
      : HttpResponse.json(
          { detail: 'nope', code: 'recipe_not_found' },
          { status: 404 },
        ),
  ),
);

beforeAll(() => {
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('the recipe detail page inside the app shell', () => {
  it('opens from a library card and moves focus to the recipe title', async () => {
    const router = renderApp('/');
    await userEvent.click(await screen.findByRole('link', { name: /שקשוקה/ }));

    const title = await screen.findByRole('heading', {
      level: 1,
      name: 'שקשוקה',
    });
    expect(router.state.location.pathname).toBe('/recipes/r1');
    expect(screen.getAllByRole('banner')[0]).toBeTruthy();
    await vi.waitFor(() => expect(document.activeElement).toBe(title));
    expect(document.title).toBe('שקשוקה · ביס & סיר');
  });

  it('goes back to the filtered library from the back button', async () => {
    const router = renderApp('/?q=%D7%A9%D7%A7');
    await userEvent.click(await screen.findByRole('link', { name: /שקשוקה/ }));
    await userEvent.click(
      await screen.findByRole('link', { name: 'חזרה למתכונים' }),
    );
    expect(await screen.findByRole('searchbox')).toHaveProperty('value', 'שק');
    expect(router.state.location.pathname).toBe('/');
  });

  it('keeps focus on a checkbox while ticking it off', async () => {
    renderApp('/recipes/r1');
    const box = await screen.findByRole('checkbox', { name: '4 עגבניות' });
    await userEvent.click(box);
    expect((box as HTMLInputElement).checked).toBe(true);
    expect(document.activeElement).toBe(box);
  });

  it('shows "not found" inside the shell for an unknown id', async () => {
    renderApp('/recipes/nope');
    expect(await screen.findByText('המתכון לא נמצא')).toBeTruthy();
    expect(screen.getAllByRole('banner')[0]).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'חזרה לרשימה' }).getAttribute('href'),
    ).toBe('/');
  });
});
```

### libs/feature-recipes/src/detail/use-cooking-checks.spec.ts

```
import { act, renderHook } from '@testing-library/react';
import { useCookingChecks } from './use-cooking-checks';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('useCookingChecks', () => {
  it('ticks, unticks and clears, keeping the ticks per recipe', () => {
    const { result } = renderHook(() => useCookingChecks('r1'));
    expect(result.current.any).toBe(false);

    act(() => result.current.set('a', true));
    act(() => result.current.set('b', true));
    act(() => result.current.set('a', false));
    expect(result.current.isChecked('a')).toBe(false);
    expect(result.current.isChecked('b')).toBe(true);
    expect(JSON.parse(localStorage.getItem('bb:checks:r1') ?? '')).toEqual([
      'b',
    ]);

    expect(renderHook(() => useCookingChecks('r2')).result.current.any).toBe(
      false,
    );
    expect(
      renderHook(() => useCookingChecks('r1')).result.current.isChecked('b'),
    ).toBe(true);

    act(() => result.current.clear());
    expect(result.current.any).toBe(false);
    expect(localStorage.getItem('bb:checks:r1')).toBeNull();
  });

  it('restores earlier ticks on load', () => {
    localStorage.setItem('bb:checks:r1', JSON.stringify(['x', 5]));
    const { result } = renderHook(() => useCookingChecks('r1'));
    expect(result.current.isChecked('x')).toBe(true);
    expect(result.current.isChecked('5')).toBe(false);
  });

  it('ignores stored junk', () => {
    localStorage.setItem('bb:checks:r1', '{"not":"a list"}');
    expect(renderHook(() => useCookingChecks('r1')).result.current.any).toBe(
      false,
    );
    localStorage.setItem('bb:checks:r1', 'not json');
    expect(renderHook(() => useCookingChecks('r1')).result.current.any).toBe(
      false,
    );
  });

  it('keeps working when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useCookingChecks('r1'));
    act(() => result.current.set('a', true));
    expect(result.current.isChecked('a')).toBe(true);
  });
});
```

### libs/feature-recipes/src/detail/use-cooking-checks.ts

```
import { useState } from 'react';

const storageKey = (recipeId: string) => `bb:checks:${recipeId}`;

function load(recipeId: string): ReadonlySet<string> {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(storageKey(recipeId)) ?? '[]',
    );
    return new Set(
      Array.isArray(stored)
        ? stored.filter((id): id is string => typeof id === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

function save(recipeId: string, checked: ReadonlySet<string>) {
  try {
    if (checked.size === 0) localStorage.removeItem(storageKey(recipeId));
    else
      localStorage.setItem(storageKey(recipeId), JSON.stringify([...checked]));
  } catch {
    // Private mode or a full disk: ticks just last for this visit.
  }
}

/**
 * Which ingredients and steps are ticked off while cooking, kept in this
 * browser per recipe. Storage failures are ignored. Mount it with
 * `key={recipeId}` so a new recipe reads its own ticks.
 */
export function useCookingChecks(recipeId: string) {
  const [checked, setChecked] = useState(() => load(recipeId));

  const update = (next: ReadonlySet<string>) => {
    setChecked(next);
    save(recipeId, next);
  };

  return {
    isChecked: (id: string) => checked.has(id),
    set: (id: string, on: boolean) => {
      const next = new Set(checked);
      if (on) next.add(id);
      else next.delete(id);
      update(next);
    },
    clear: () => update(new Set()),
    any: checked.size > 0,
  };
}
```

### libs/feature-recipes/src/routes/recipe-detail.spec.tsx

```
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { schemas, type RecipeRead } from '@bite-and-board/data-access';
import { initI18n } from '@bite-and-board/i18n';
import { server } from '../testing/server';
import { renderDetail } from '../testing/render-detail';

function recipe(overrides: Partial<RecipeRead> = {}): RecipeRead {
  return {
    id: 'r1',
    title: 'פנקייק',
    description: null,
    base_servings: 4,
    prep_time_minutes: 10,
    cook_time_minutes: 75,
    source_url: null,
    notes: null,
    photo: null,
    tags: [{ id: 't1', name: 'בוקר' }],
    ingredients: [
      {
        id: 'i1',
        name: 'קמח',
        amount: 2,
        unit: 'cup',
        note: 'מנופה',
        original: null,
        source: null,
      },
      {
        id: 'i2',
        name: 'מלח',
        amount: null,
        unit: null,
        note: null,
        original: null,
        source: null,
      },
    ],
    steps: [
      { id: 's1', description: 'מערבבים', source_text: null },
      { id: 's2', description: 'אופים', source_text: null },
    ],
    created_at: '2026-10-27T12:00:00Z',
    updated_at: '2026-10-27T12:00:00Z',
    ...overrides,
  };
}

function serve(r: RecipeRead) {
  server.use(http.get('*/api/recipes/:id', () => HttpResponse.json(r)));
}

afterEach(() => localStorage.clear());

describe('RecipeDetailPage', () => {
  it('shows tags, times, title, ingredients, numbered steps', async () => {
    serve(recipe({ description: 'ארוחת בוקר קלאסית' }));
    renderDetail('r1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'פנקייק' }),
    ).toBeTruthy();
    expect(screen.getByText('בוקר')).toBeTruthy();
    expect(screen.getByText('הכנה: 10 דק׳')).toBeTruthy();
    expect(screen.getByText('בישול: 1 שע׳ 15 דק׳')).toBeTruthy();
    expect(screen.getByText('ארוחת בוקר קלאסית')).toBeTruthy();
    expect(document.title).toBe('פנקייק · ביס & סיר');

    const board = screen.getByRole('heading', { name: 'מצרכים' }).parentElement;
    expect(
      within(board as HTMLElement).getByRole('checkbox', {
        name: '2 כוסות קמח מנופה',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'מלח — לפי הטעם' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'אופן הכנה' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'מערבבים' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'אופים' })).toBeTruthy();
  });

  describe('the back button', () => {
    it('goes back to the library with its filters after an in-app visit', async () => {
      serve(recipe());
      renderDetail('r1', '/?q=%D7%A9&tags=t1');
      const back = await screen.findByRole('link', { name: 'חזרה למתכונים' });
      expect(back.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
      await userEvent.click(back);
      expect(
        await screen.findByText(/library stub \?q=.*&tags=t1/),
      ).toBeTruthy();
    });

    it('links to the library on a direct visit', async () => {
      serve(recipe());
      renderDetail('r1');
      const back = await screen.findByRole('link', { name: 'חזרה למתכונים' });
      expect(back.getAttribute('href')).toBe('/');
      await userEvent.click(back);
      expect(await screen.findByText('library stub')).toBeTruthy();
    });
  });

  it('uses singular and plural unit labels and trims decimals', async () => {
    serve(
      recipe({
        ingredients: [
          { ...recipe().ingredients[0], amount: 1, unit: 'cup', note: null },
          {
            ...recipe().ingredients[0],
            id: 'i3',
            amount: 1.5,
            unit: 'tbsp',
            name: 'סוכר',
            note: null,
          },
          {
            ...recipe().ingredients[0],
            id: 'i4',
            amount: 3,
            unit: null,
            name: 'ביצים',
            note: null,
          },
        ],
      }),
    );
    renderDetail('r1');
    expect(
      await screen.findByRole('checkbox', { name: '1 כוס קמח' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: '1.5 כפות סוכר' }),
    ).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '3 ביצים' })).toBeTruthy();
  });

  it('has a Hebrew label for every unit the API can send', () => {
    const { exists } = initI18n();
    for (const unit of schemas.zUnit.options) {
      expect(exists(`units.${unit}_one` as never)).toBe(true);
      expect(exists(`units.${unit}_other` as never)).toBe(true);
    }
  });

  it('shows notes as text with line breaks kept, never as HTML', async () => {
    serve(recipe({ notes: 'שורה ראשונה\nשורה <b>שנייה</b>' }));
    renderDetail('r1');
    const heading = await screen.findByRole('heading', {
      name: 'הערות וטיפים',
    });
    const notes = heading.nextElementSibling as HTMLElement;
    expect(notes.textContent).toBe('שורה ראשונה\nשורה <b>שנייה</b>');
    expect(notes.querySelector('b')).toBeNull();
    expect(notes.className).toContain('whitespace-pre-line');
  });

  it('has no notes section, description or source link when there are none', async () => {
    serve(recipe());
    renderDetail('r1');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('heading', { name: 'הערות וטיפים' })).toBeNull();
    expect(screen.queryByRole('link', { name: /למתכון המקורי/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'הצג מתכון מקורי' }),
    ).toBeNull();
  });

  it('links to the source for web URLs only', async () => {
    serve(recipe({ source_url: 'https://example.com/pancakes' }));
    const { unmount } = renderDetail('r1');
    const link = await screen.findByRole('link', { name: /למתכון המקורי/ });
    expect(link.getAttribute('href')).toBe('https://example.com/pancakes');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('example.com');
    unmount();

    // eslint-disable-next-line no-script-url -- the test is that it is not linked
    serve(recipe({ source_url: 'javascript:alert(1)' }));
    renderDetail('r1');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /למתכון המקורי/ })).toBeNull();
  });

  it('skips the source link for a URL that does not parse', async () => {
    serve(recipe({ source_url: 'not a url' }));
    renderDetail('r1');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /למתכון המקורי/ })).toBeNull();
  });

  it('shows the FR-7 original hint, linked to its line', async () => {
    serve(
      recipe({
        ingredients: [
          {
            ...recipe().ingredients[0],
            note: null,
            original: { amount: 1.5, unit: 'cup' },
          },
          {
            ...recipe().ingredients[0],
            id: 'i5',
            name: 'שמרים',
            note: null,
            original: { amount: null, unit: null },
          },
          {
            ...recipe().ingredients[0],
            id: 'i6',
            name: 'ביצים',
            note: null,
            original: { amount: 2, unit: null },
          },
        ],
      }),
    );
    renderDetail('r1');
    const box = await screen.findByRole('checkbox', { name: '2 כוסות קמח' });
    expect(box.getAttribute('aria-describedby')).toBe(
      screen.getByText('במקור 1.5 כוסות').id,
    );
    expect(screen.getByText('במקור: לפי הטעם')).toBeTruthy();
    expect(screen.getByText('במקור 2')).toBeTruthy();
    // The hint is separate from the converted-values toggle.
    expect(
      screen.queryByRole('button', { name: 'הצג מתכון מקורי' }),
    ).toBeNull();
  });

  describe('the original-recipe toggle', () => {
    const converted = recipe({
      ingredients: [
        {
          ...recipe().ingredients[0],
          name: 'גבינה',
          note: null,
          amount: 227,
          unit: 'g',
          source: { amount: 8, unit: 'oz' },
        },
      ],
      steps: [
        { id: 's1', description: 'אופים ב־180', source_text: 'Bake at 350F' },
        { id: 's2', description: 'מגישים', source_text: null },
      ],
    });

    it('is off by default and shows source values and original steps when on', async () => {
      serve(converted);
      renderDetail('r1');
      const toggle = await screen.findByRole('button', {
        name: 'הצג מתכון מקורי',
      });
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(
        screen.getByRole('checkbox', { name: '227 גרם גבינה' }),
      ).toBeTruthy();
      expect(screen.queryByText('במקור: Bake at 350F')).toBeNull();

      await userEvent.click(toggle);
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(
        screen.getByRole('checkbox', { name: '8 oz (227 גרם) גבינה' }),
      ).toBeTruthy();
      expect(screen.getByText('במקור: Bake at 350F')).toBeTruthy();

      await userEvent.click(toggle);
      expect(screen.queryByText('במקור: Bake at 350F')).toBeNull();
    });

    it('also appears when only a step was converted', async () => {
      serve(recipe({ steps: converted.steps }));
      renderDetail('r1');
      expect(
        await screen.findByRole('button', { name: 'הצג מתכון מקורי' }),
      ).toBeTruthy();
    });

    it('formats source units that have no unit label', async () => {
      serve(
        recipe({
          ingredients: [
            {
              ...converted.ingredients[0],
              source: { amount: 1, unit: 'fl_oz' },
            },
          ],
        }),
      );
      renderDetail('r1');
      await userEvent.click(
        await screen.findByRole('button', { name: 'הצג מתכון מקורי' }),
      );
      expect(screen.getByRole('checkbox', { name: /^1 fl oz/ })).toBeTruthy();
    });
  });

  describe('ticking off', () => {
    it('keeps ticks per recipe in this browser and clears them', async () => {
      serve(recipe());
      const { unmount } = renderDetail('r1');
      const flour = await screen.findByRole('checkbox', {
        name: '2 כוסות קמח מנופה',
      });
      expect(
        screen.queryByRole('button', { name: 'ניקוי סימונים' }),
      ).toBeNull();

      await userEvent.click(flour);
      await userEvent.click(screen.getByRole('checkbox', { name: 'מערבבים' }));
      expect((flour as HTMLInputElement).checked).toBe(true);
      expect(JSON.parse(localStorage.getItem('bb:checks:r1') ?? '')).toEqual([
        'i1',
        's1',
      ]);

      unmount();
      renderDetail('r1');
      const again = await screen.findByRole('checkbox', {
        name: '2 כוסות קמח מנופה',
      });
      expect((again as HTMLInputElement).checked).toBe(true);

      await userEvent.click(again);
      expect((again as HTMLInputElement).checked).toBe(false);

      await userEvent.click(
        screen.getByRole('button', { name: 'ניקוי סימונים' }),
      );
      expect(
        screen
          .getAllByRole('checkbox')
          .every((box) => !(box as HTMLInputElement).checked),
      ).toBe(true);
      expect(localStorage.getItem('bb:checks:r1')).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'ניקוי סימונים' }),
      ).toBeNull();
    });

    it('keeps working when storage fails', async () => {
      serve(recipe());
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      renderDetail('r1');
      const flour = await screen.findByRole('checkbox', {
        name: '2 כוסות קמח מנופה',
      });
      await userEvent.click(flour);
      expect((flour as HTMLInputElement).checked).toBe(true);
      vi.restoreAllMocks();
    });
  });

  it('shows a skeleton while loading', async () => {
    server.use(
      http.get('*/api/recipes/:id', async () => {
        await delay(50);
        return HttpResponse.json(recipe());
      }),
    );
    renderDetail('r1');
    expect(screen.getByRole('status', { name: 'טוען מתכון' })).toBeTruthy();
    await screen.findByRole('heading', { level: 1, name: 'פנקייק' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says the recipe was not found and links back to the list', async () => {
    server.use(
      http.get('*/api/recipes/:id', () =>
        HttpResponse.json(
          { detail: 'nope', code: 'recipe_not_found' },
          { status: 404 },
        ),
      ),
    );
    renderDetail('missing');
    expect(await screen.findByText('המתכון לא נמצא')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'חזרה לרשימה' }).getAttribute('href'),
    ).toBe('/');
    expect(screen.queryByRole('button', { name: 'לנסות שוב' })).toBeNull();
  });

  it('offers a retry for other errors', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/recipes/:id', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ detail: 'boom' }, { status: 500 })
          : HttpResponse.json(recipe());
      }),
    );
    renderDetail('r1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'לנסות שוב' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'פנקייק' }),
      ).toBeTruthy(),
    );
  });
});
```

### libs/feature-recipes/src/routes/recipe-detail.tsx

```
import { useEffect, useRef, useState } from 'react';
import type { ParseKeys } from 'i18next';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  getErrorCode,
  recipesGetRecipeOptions,
  type IngredientRead,
  type RecipeRead,
  type SourceUnit,
  type Unit,
} from '@bite-and-board/data-access';
import { formatAmount } from '@bite-and-board/recipe-domain';
import {
  Button,
  EmptyState,
  IngredientBoard,
  IngredientLine,
  RecipeDetailSkeleton,
  StepItem,
  Toggle,
  type IngredientQuantity,
} from '@bite-and-board/ui-components';
import { useCookingChecks } from '../detail/use-cooking-checks';
import { useErrorMessage } from '../shared/use-error-message';
import { useFormatTime } from '../shared/use-format-time';

const TAG = 'rounded-full bg-secondary px-3 py-1 text-label';

/** The hostname of a recipe's source link, or undefined if it is not a web URL. */
function webHost(url: string) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol)
      ? parsed.hostname
      : undefined;
  } catch {
    return undefined;
  }
}

/** The recipe at `/recipes/:id`: ingredient board, steps and cooking aids (FR-5). */
export function RecipeDetailPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { id = '' } = useParams();
  const recipe = useQuery(recipesGetRecipeOptions({ path: { recipe_id: id } }));

  if (recipe.isPending) {
    return (
      <div
        role="status"
        aria-label={t('detail.loading')}
        className="mx-auto max-w-detail pt-8"
      >
        <RecipeDetailSkeleton />
      </div>
    );
  }
  if (recipe.isError) {
    const notFound = getErrorCode(recipe.error) === 'recipe_not_found';
    return (
      <EmptyState
        title={errorMessage(recipe.error)}
        actions={
          <>
            {notFound ? null : (
              <Button variant="secondary" onClick={() => void recipe.refetch()}>
                {t('library.error.retry')}
              </Button>
            )}
            <Button asChild>
              <Link to="/">{t('notFound.back')}</Link>
            </Button>
          </>
        }
      />
    );
  }
  // Keyed by id so a different recipe starts with its own ticks and toggle.
  return <RecipeDetail key={recipe.data.id} recipe={recipe.data} />;
}

function RecipeDetail({ recipe }: { recipe: RecipeRead }) {
  const { t } = useTranslation();
  const formatTime = useFormatTime();
  const navigate = useNavigate();
  // A router location key other than "default" means we arrived by navigating
  // inside the app, so going back lands on the library with its filters.
  const cameFromApp = useLocation().key !== 'default';
  const title = useRef<HTMLHeadingElement>(null);
  const checks = useCookingChecks(recipe.id);
  const [showOriginal, setShowOriginal] = useState(false);

  // The app shell moves focus to the h1 on navigation, but the recipe loads after
  // that, so the title takes focus itself once it exists (not on a first load).
  useEffect(() => {
    if (cameFromApp) title.current?.focus();
  }, [cameFromApp]);

  // Hebrew has a singular only for exactly 1 ("1 כוס", "2 כוסות", "0.5 כוסות");
  // i18next would also look for `_two` and `_many` forms, which we do not write.
  const unitLabel = (unit: Unit | null, amount: number) =>
    unit
      ? t(`units.${unit}` as ParseKeys, { count: amount === 1 ? 1 : 0 })
      : undefined;
  const sourceUnitLabel = (unit: SourceUnit) =>
    t(`sourceUnits.${unit}` as ParseKeys);

  const quantityOf = (
    amount: number,
    unit: Unit | null,
  ): IngredientQuantity => ({
    amount: formatAmount(amount),
    unit: unitLabel(unit, amount),
  });

  const originalHint = ({ original }: IngredientRead) => {
    if (!original) return undefined;
    if (original.amount === null) return t('detail.originalToTaste');
    const { amount, unit } = quantityOf(original.amount, original.unit);
    return t('detail.originalHint', {
      value: unit ? `${amount} ${unit}` : amount,
    });
  };

  const hasConverted =
    recipe.ingredients.some((ingredient) => ingredient.source) ||
    recipe.steps.some((step) => step.source_text);
  const prep = formatTime(recipe.prep_time_minutes);
  const cook = formatTime(recipe.cook_time_minutes);
  const sourceHost = recipe.source_url ? webHost(recipe.source_url) : undefined;

  return (
    <article className="mx-auto max-w-detail pb-8">
      <title>{t('app.pageTitle', { page: recipe.title })}</title>
      <div className="flex flex-col gap-3 pt-4 pb-6">
        <Button asChild variant="ghost" className="w-fit">
          <Link
            to="/"
            onClick={(event) => {
              if (!cameFromApp) return;
              event.preventDefault();
              void navigate(-1);
            }}
          >
            <ArrowRight aria-hidden="true" className="ltr:rotate-180" />
            {t('detail.back')}
          </Link>
        </Button>
        {recipe.tags.length > 0 || prep || cook ? (
          <div className="flex flex-wrap items-center gap-2">
            {recipe.tags.map((tag) => (
              <span key={tag.id} dir="auto" className={TAG}>
                {tag.name}
              </span>
            ))}
            {prep ? (
              <span className="text-label text-muted-foreground">
                {t('detail.prep', { time: prep })}
              </span>
            ) : null}
            {cook ? (
              <span className="text-label text-muted-foreground">
                {t('detail.cook', { time: cook })}
              </span>
            ) : null}
          </div>
        ) : null}
        <h1
          ref={title}
          tabIndex={-1}
          dir="auto"
          className="text-display break-words outline-none lg:text-display-lg"
        >
          {recipe.title}
        </h1>
        {recipe.description ? (
          <p dir="auto" className="max-w-prose text-muted-foreground">
            {recipe.description}
          </p>
        ) : null}
        {hasConverted || checks.any ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {hasConverted ? (
              <Toggle
                variant="outline"
                pressed={showOriginal}
                onPressedChange={setShowOriginal}
              >
                {t('detail.showOriginal')}
              </Toggle>
            ) : null}
            {checks.any ? (
              <Button variant="secondary" onClick={checks.clear}>
                {t('detail.clearChecks')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="lg:sticky lg:top-6 lg:w-board lg:shrink-0">
          <IngredientBoard title={t('detail.ingredients')}>
            {recipe.ingredients.map((ingredient) => (
              <IngredientLine
                key={ingredient.id}
                name={ingredient.name}
                note={ingredient.note ?? undefined}
                quantity={
                  ingredient.amount === null
                    ? undefined
                    : quantityOf(ingredient.amount, ingredient.unit)
                }
                source={
                  showOriginal && ingredient.source
                    ? {
                        amount: formatAmount(ingredient.source.amount),
                        unit: sourceUnitLabel(ingredient.source.unit),
                      }
                    : undefined
                }
                toTasteLabel={t('detail.toTaste')}
                originalHint={originalHint(ingredient)}
                checked={checks.isChecked(ingredient.id)}
                onCheckedChange={(on) => checks.set(ingredient.id, on)}
              />
            ))}
          </IngredientBoard>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section aria-labelledby="steps-heading">
            <h2 id="steps-heading" className="pb-2 text-title">
              {t('detail.steps')}
            </h2>
            <ol>
              {recipe.steps.map((step, index) => (
                <StepItem
                  key={step.id}
                  number={index + 1}
                  text={step.description}
                  originalText={
                    showOriginal && step.source_text
                      ? t('detail.stepOriginal', { text: step.source_text })
                      : undefined
                  }
                  checked={checks.isChecked(step.id)}
                  onCheckedChange={(on) => checks.set(step.id, on)}
                />
              ))}
            </ol>
          </section>

          {recipe.notes ? (
            <section aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="pb-2 text-title">
                {t('detail.notes')}
              </h2>
              <p dir="auto" className="break-words whitespace-pre-line">
                {recipe.notes}
              </p>
            </section>
          ) : null}

          {recipe.source_url && sourceHost ? (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-label text-muted-foreground underline underline-offset-4"
            >
              {t('detail.source')} <bdi>{sourceHost}</bdi>
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export { RecipeDetailPage as Component };
```

### libs/feature-recipes/src/shared/use-error-message.ts

```
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { getErrorCode } from '@bite-and-board/data-access';

/** An API error as Hebrew copy (AD-28): `errors.<code>`, or the generic message. */
export function useErrorMessage() {
  const { t, i18n } = useTranslation();
  return (error: unknown) => {
    const code = getErrorCode(error);
    // The code comes from the server, so the key is checked at runtime.
    const key = code ? (`errors.${code}` as ParseKeys) : undefined;
    const message: string =
      key && i18n.exists(key) ? t(key) : t('errors.unknown');
    return message;
  };
}
```

### libs/feature-recipes/src/shared/use-format-time.ts

```
import { useTranslation } from 'react-i18next';

const MINUTES_PER_HOUR = 60;

/** Minutes as Hebrew copy ("1 שע׳ 15 דק׳"); undefined when the time is unknown. */
export function useFormatTime() {
  const { t } = useTranslation();
  return (minutes: number | null) => {
    if (minutes === null) return undefined;
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const rest = minutes % MINUTES_PER_HOUR;
    if (hours === 0) return t('library.card.minutes', { minutes: rest });
    return rest === 0
      ? t('library.card.hours', { hours })
      : t('library.card.hoursMinutes', { hours, minutes: rest });
  };
}
```

### libs/feature-recipes/src/testing/render-detail.tsx

```
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider } from '@bite-and-board/ui-components';
import { Component as RecipeDetailPage } from '../routes/recipe-detail';

initI18n();

function LibraryStub() {
  return <p>library stub {useLocation().search}</p>;
}

/**
 * Renders the detail page at `/recipes/:id`, with a stub list route to go back
 * to. With `from`, that library URL is the page before it (in-app history).
 */
export function renderDetail(id: string, from?: string) {
  const router = createMemoryRouter(
    [
      { path: '/', Component: LibraryStub },
      { path: '/recipes/:id', Component: RecipeDetailPage },
    ],
    from
      ? { initialEntries: [from, `/recipes/${id}`], initialIndex: 1 }
      : { initialEntries: [`/recipes/${id}`] },
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DirectionProvider dir="rtl">
        <RouterProvider router={router} />
      </DirectionProvider>
    </QueryClientProvider>,
  );
}
```

### libs/recipe-domain/src/format-amount.spec.ts

```
import { formatAmount } from './format-amount.js';

describe('formatAmount', () => {
  it('shows whole numbers without decimals', () => {
    expect(formatAmount(5)).toBe('5');
    expect(formatAmount(5.0)).toBe('5');
  });

  it('keeps at most two decimals', () => {
    expect(formatAmount(0.5)).toBe('0.5');
    expect(formatAmount(1.256)).toBe('1.26');
    expect(formatAmount(227.0001)).toBe('227');
  });
});
```

### libs/recipe-domain/src/format-amount.ts

```
/** An amount for display (FR-11): whole numbers have no decimals, others at most two. */
export function formatAmount(amount: number): string {
  return Number.isInteger(amount)
    ? String(amount)
    : String(Math.round(amount * 100) / 100);
}
```

### libs/ui-components/src/components/ingredient-board.tsx

```
import type * as React from 'react';
import { cn } from '../lib/utils';
import { Board } from './board';
import { Skeleton } from './ui/skeleton';

export interface IngredientBoardProps {
  title: string;
  /** `IngredientLine`s. */
  children: React.ReactNode;
  className?: string;
}

/** The oak board holding a recipe's ingredient lines (UX-DR6). */
export function IngredientBoard({
  title,
  children,
  className,
}: IngredientBoardProps) {
  return (
    <Board
      data-slot="ingredient-board"
      className={cn('flex flex-col gap-2', className)}
    >
      <h2 className="text-title">{title}</h2>
      <ul>{children}</ul>
    </Board>
  );
}

/** Placeholder with the detail page's footprint while the recipe loads. */
export function RecipeDetailSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex flex-col gap-8 lg:flex-row lg:items-start',
        className,
      )}
    >
      <Board className="flex flex-col gap-3 lg:w-board lg:shrink-0">
        <Skeleton className="h-7 w-1/2 bg-board-foreground/10" />
        {Array.from({ length: 5 }, (_, n) => (
          <Skeleton key={n} className="h-6 w-full bg-board-foreground/10" />
        ))}
      </Board>
      <div className="flex flex-1 flex-col gap-3">
        <Skeleton className="h-7 w-1/3" />
        {Array.from({ length: 3 }, (_, n) => (
          <Skeleton key={n} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
```

### libs/ui-components/src/components/ingredient-line.tsx

```
import { useId } from 'react';
import { cn } from '../lib/utils';

export interface IngredientQuantity {
  /** The amount, already formatted. */
  amount: string;
  /** The unit label, already singular or plural; leave out for a bare count. */
  unit?: string;
}

export interface IngredientLineProps {
  name: string;
  note?: string;
  /** The amount; leave out (with `toTasteLabel`) for a to-taste line. */
  quantity?: IngredientQuantity;
  /** The imperial value an import converted from; shown with `quantity` in parentheses. */
  source?: IngredientQuantity;
  /** "לפי הטעם": makes the line read "name — to taste". */
  toTasteLabel?: string;
  /** The FR-7 hint, e.g. "במקור 2 כוסות", shown under the line. */
  originalHint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

function Quantity({ amount, unit }: IngredientQuantity) {
  return (
    <>
      <bdi className="text-quantity tabular-nums">{amount}</bdi>
      {unit ? ` ${unit}` : null}
    </>
  );
}

/** One ingredient on the board, with a tick-off checkbox (UX-DR10). */
export function IngredientLine({
  name,
  note,
  quantity,
  source,
  toTasteLabel,
  originalHint,
  checked,
  onCheckedChange,
  className,
}: IngredientLineProps) {
  const hintId = useId();
  return (
    <li className={className}>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-describedby={originalHint ? hintId : undefined}
          className="mt-0.5 size-6 shrink-0 accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring"
        />
        <span
          className={cn(
            'min-w-0 break-words',
            checked && 'line-through opacity-60',
          )}
        >
          {quantity && source ? (
            <>
              <Quantity {...source} />
              {' ('}
              <Quantity {...quantity} />
              {') '}
            </>
          ) : null}
          {quantity && !source ? (
            <>
              <Quantity {...quantity} />{' '}
            </>
          ) : null}
          <span dir="auto">{name}</span>
          {quantity === undefined && toTasteLabel ? ` — ${toTasteLabel}` : null}
          {note ? (
            <>
              {' '}
              <span dir="auto" className="text-label opacity-80">
                {note}
              </span>
            </>
          ) : null}
        </span>
      </label>
      {originalHint ? (
        <p id={hintId} className="ps-9 text-label text-hint">
          {originalHint}
        </p>
      ) : null}
    </li>
  );
}
```

### libs/ui-components/src/components/recipe-detail-parts.spec.tsx

```
import { fireEvent, render, screen } from '@testing-library/react';
import { IngredientBoard, RecipeDetailSkeleton } from './ingredient-board';
import { IngredientLine } from './ingredient-line';
import { StepItem } from './step-item';

const noop = () => undefined;

describe('IngredientLine', () => {
  it('wraps the amount in <bdi> and reads amount, unit, name and note', () => {
    const { container } = render(
      <ul>
        <IngredientLine
          quantity={{ amount: '2', unit: 'כוסות' }}
          name="קמח"
          note="מנופה"
          checked={false}
          onCheckedChange={noop}
        />
      </ul>,
    );
    expect(container.querySelector('bdi')?.textContent).toBe('2');
    expect(
      screen.getByRole('checkbox', { name: '2 כוסות קמח מנופה' }),
    ).toBeTruthy();
  });

  it('reads "name — to taste" without a quantity', () => {
    render(
      <ul>
        <IngredientLine
          name="מלח"
          toTasteLabel="לפי הטעם"
          checked={false}
          onCheckedChange={noop}
        />
      </ul>,
    );
    expect(
      screen.getByRole('checkbox', { name: 'מלח — לפי הטעם' }),
    ).toBeTruthy();
  });

  it('shows a bare count without a unit', () => {
    render(
      <ul>
        <IngredientLine
          quantity={{ amount: '3' }}
          name="ביצים"
          checked={false}
          onCheckedChange={noop}
        />
      </ul>,
    );
    expect(screen.getByRole('checkbox', { name: '3 ביצים' })).toBeTruthy();
  });

  it('shows the source value with the converted one in parentheses', () => {
    render(
      <ul>
        <IngredientLine
          quantity={{ amount: '227', unit: 'גרם' }}
          source={{ amount: '8', unit: 'oz' }}
          name="גבינה"
          checked={false}
          onCheckedChange={noop}
        />
      </ul>,
    );
    expect(
      screen.getByRole('checkbox', { name: '8 oz (227 גרם) גבינה' }),
    ).toBeTruthy();
  });

  it('links the hint to the checkbox', () => {
    render(
      <ul>
        <IngredientLine
          quantity={{ amount: '3' }}
          name="ביצים"
          originalHint="במקור 2 יחידות"
          checked={false}
          onCheckedChange={noop}
        />
      </ul>,
    );
    expect(screen.getByRole('checkbox').getAttribute('aria-describedby')).toBe(
      screen.getByText('במקור 2 יחידות').id,
    );
  });

  it('has no description without a hint, and reports ticks', () => {
    const onCheckedChange = vi.fn();
    render(
      <ul>
        <IngredientLine
          name="מלח"
          checked={false}
          onCheckedChange={onCheckedChange}
        />
      </ul>,
    );
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-describedby')).toBeNull();
    fireEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('strikes a ticked line through', () => {
    render(
      <ul>
        <IngredientLine name="מלח" checked onCheckedChange={noop} />
      </ul>,
    );
    expect(screen.getByText('מלח').parentElement?.className).toContain(
      'line-through',
    );
  });
});

describe('StepItem', () => {
  it('shows its number, text and original text, and reports ticks', () => {
    const onCheckedChange = vi.fn();
    render(
      <ol>
        <StepItem
          number={2}
          text="אופים"
          originalText="במקור: Bake"
          checked={false}
          onCheckedChange={onCheckedChange}
        />
      </ol>,
    );
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('במקור: Bake')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('has no original line without one, and strikes a ticked step', () => {
    render(
      <ol>
        <StepItem number={1} text="אופים" checked onCheckedChange={noop} />
      </ol>,
    );
    expect(screen.getByText('אופים').parentElement?.className).toContain(
      'line-through',
    );
  });
});

describe('IngredientBoard', () => {
  it('holds a heading and a list of lines', () => {
    render(
      <IngredientBoard title="מצרכים">
        <IngredientLine name="מלח" checked={false} onCheckedChange={noop} />
      </IngredientBoard>,
    );
    expect(screen.getByRole('heading', { name: 'מצרכים' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('has a skeleton hidden from assistive tech', () => {
    const { container } = render(<RecipeDetailSkeleton />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});
```

### libs/ui-components/src/components/recipe-detail-parts.stories.tsx

```
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IngredientBoard, RecipeDetailSkeleton } from './ingredient-board';
import { IngredientLine } from './ingredient-line';
import { StepItem } from './step-item';

const meta = { title: 'Detail/Pieces' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;

export const IngredientLines: Story = {
  name: 'IngredientLine',
  render: () => (
    <IngredientBoard title="מצרכים">
      <IngredientLine
        quantity={{ amount: '2', unit: 'כוסות' }}
        name="קמח"
        note="מנופה"
        checked={false}
        onCheckedChange={noop}
      />
      <IngredientLine
        quantity={{ amount: '227', unit: 'גרם' }}
        source={{ amount: '8', unit: 'oz' }}
        name="גבינת שמנת"
        checked={false}
        onCheckedChange={noop}
      />
      <IngredientLine
        quantity={{ amount: '3' }}
        name="ביצים"
        originalHint="במקור 2 יחידות"
        checked
        onCheckedChange={noop}
      />
      <IngredientLine
        name="מלח"
        toTasteLabel="לפי הטעם"
        checked={false}
        onCheckedChange={noop}
      />
    </IngredientBoard>
  ),
};

export const StepItems: Story = {
  name: 'StepItem',
  render: function Render() {
    const [done, setDone] = useState(false);
    return (
      <ol className="max-w-detail">
        <StepItem
          number={1}
          text="מחממים תנור ל־180 מעלות."
          originalText="במקור: Preheat oven to 350°F."
          checked={done}
          onCheckedChange={setDone}
        />
        <StepItem
          number={2}
          text="מערבבים את כל החומרים."
          checked={false}
          onCheckedChange={noop}
        />
      </ol>
    );
  },
};

export const DetailSkeleton: Story = {
  name: 'RecipeDetailSkeleton',
  render: () => <RecipeDetailSkeleton />,
};
```

### libs/ui-components/src/components/step-item.tsx

```
import { cn } from '../lib/utils';

export interface StepItemProps {
  /** The step's position, starting at 1. */
  number: number;
  text: string;
  /** The step's text before an import converted it, shown under the text. */
  originalText?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

/** One numbered method step with a tick-off checkbox. */
export function StepItem({
  number,
  text,
  originalText,
  checked,
  onCheckedChange,
  className,
}: StepItemProps) {
  return (
    <li className={className}>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-0.5 size-6 shrink-0 accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring"
        />
        <span
          aria-hidden="true"
          className="mt-0.5 w-6 shrink-0 text-center text-quantity tabular-nums text-muted-foreground"
        >
          {number}
        </span>
        <span className={cn('min-w-0', checked && 'line-through opacity-60')}>
          <span dir="auto" className="block break-words">
            {text}
          </span>
          {originalText ? (
            <span dir="auto" className="block text-label text-hint-muted">
              {originalText}
            </span>
          ) : null}
        </span>
      </label>
    </li>
  );
}
```

