# Review: Story 1.11 Live serving scaling

Branch to create on approval: claude/story-1-11-scaling. Nothing committed yet.
Rounding: countable units snap to nearest of ¼ ⅓ ½ ⅔ ¾ plus whole part, min ¼; others 2 decimals. Servings remembered per recipe on this device (localStorage via useServings, a thin wrapper on generic useStoredState; useCookingChecks too). 'חזרה ל־N' resets and forgets.
Checks: lint, typecheck, test pass; domain branches 100%; nx format:check passes.

## Changed files
-  M _bmad-output/implementation-artifacts/epic-1-context.md
-  M _bmad-output/implementation-artifacts/sprint-status.yaml
-  M _bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
-  M _bmad-output/planning-artifacts/epics.md
-  M _bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/prd.md
-  M apps/web/src/app/app-providers.tsx
-  M apps/web/src/app/recipe-detail-shell.spec.tsx
-  M apps/web/src/app/router.tsx
-  M libs/feature-recipes/eslint.config.mjs
-  M libs/feature-recipes/package.json
-  M libs/feature-recipes/src/detail/use-cooking-checks.spec.ts
-  M libs/feature-recipes/src/detail/use-cooking-checks.ts
-  M libs/feature-recipes/src/routes/library.tsx
-  M libs/feature-recipes/src/routes/recipe-detail.spec.tsx
-  M libs/feature-recipes/src/routes/recipe-detail.tsx
-  M libs/feature-recipes/src/shared/use-error-message.ts
-  M libs/feature-recipes/src/shared/use-format-time.ts
-  M libs/feature-recipes/src/testing/render-detail.tsx
-  M libs/feature-recipes/tsconfig.json
-  M libs/feature-recipes/tsconfig.lib.json
-  M libs/feature-recipes/tsconfig.spec.json
-  M libs/feature-recipes/vite.config.mts
-  M libs/i18n/src/he.json
-  M libs/recipe-domain/src/format-amount.spec.ts
-  M libs/recipe-domain/src/format-amount.ts
-  M libs/recipe-domain/src/index.ts
-  M libs/ui-components/src/components/ingredient-board.tsx
-  M libs/ui-components/src/components/ingredient-line.tsx
-  M libs/ui-components/src/components/library-parts.spec.tsx
-  M libs/ui-components/src/components/library-parts.stories.tsx
-  M libs/ui-components/src/components/recipe-card.tsx
-  M libs/ui-components/src/components/recipe-detail-parts.spec.tsx
-  M libs/ui-components/src/components/recipe-detail-parts.stories.tsx
-  M libs/ui-components/src/components/step-item.tsx
-  M libs/ui-components/src/index.ts
-  M libs/ui-components/src/styles/theme.css
- ?? _bmad-output/implementation-artifacts/review-1-11-live-serving-scaling.md
- ?? _bmad-output/implementation-artifacts/spec-1-11-live-serving-scaling.md
- ?? libs/feature-recipes/src/detail/use-servings.spec.ts
- ?? libs/feature-recipes/src/detail/use-servings.ts
- ?? libs/feature-recipes/src/shared/use-stored-state.spec.ts
- ?? libs/feature-recipes/src/shared/use-stored-state.ts
- ?? libs/recipe-domain/src/scale-amount.spec.ts
- ?? libs/recipe-domain/src/scale-amount.ts
- ?? libs/ui-components/src/components/servings-stepper.spec.tsx
- ?? libs/ui-components/src/components/servings-stepper.tsx

## Diff (tracked files)
```diff
diff --git a/_bmad-output/implementation-artifacts/epic-1-context.md b/_bmad-output/implementation-artifacts/epic-1-context.md
index e312344..25e1624 100644
--- a/_bmad-output/implementation-artifacts/epic-1-context.md
+++ b/_bmad-output/implementation-artifacts/epic-1-context.md
@@ -18,13 +18,13 @@ Anyone can open Bite & Board (ביס & סיר) on a phone or desktop — Hebrew,
 - Story 1.8: Demo seed data
 - Story 1.9: Recipe library with search and tag filter
 - Story 1.10: Recipe detail page
-- Story 1.11: Live serving scaling and kitchen mode
+- Story 1.11: Live serving scaling (kitchen-mode extras moved to optional Story 7.1)
 
 ## Requirements & Constraints
 
 - Library: every recipe as a card (title, up to 2 tags plus +N, total time, photo), newest first; title search as you type (case-insensitive substring); multi-select pinned-tag chips (AND); filters live in the URL and survive navigation.
 - Detail page shows photo, ingredients (amount, unit, name, note; to-taste lines read "לפי הטעם") and numbered steps; unknown id → not-found page.
-- Servings scaling 1–100 runs on the client only; to-taste never scales; rounding: integers without decimals, else ≤ 2 decimals, countable units to nearest ½.
+- Servings scaling 1–100 runs on the client only; to-taste never scales; rounding: integers without decimals, else ≤ 2 decimals, countable units to the nearest of ¼ ⅓ ½ ⅔ ¾, minimum ¼.
 - One idempotent seed command creates ~10 Hebrew recipes covering every pinned tag.
 - Quality: TS strict, mypy strict, lint/format enforced, CI on every push. Backend API tests for every endpoint; scaling/rounding at 100% branch coverage.
 - Performance (200 recipes, local): library first render < 1 s, search < 100 ms per keystroke, detail < 500 ms.
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index 5cc1d47..00307a7 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -46,7 +46,7 @@ development_status:
   1-8-demo-seed-data: done
   1-9-recipe-library-with-search-and-tag-filter: done
   1-10-recipe-detail-page: done
-  1-11-live-serving-scaling-and-kitchen-mode: backlog
+  1-11-live-serving-scaling: review
   epic-1-retrospective: optional
 
   epic-2: backlog
@@ -89,3 +89,7 @@ development_status:
   6-4-performance-budgets: backlog
   6-5-readme-for-recruiters: backlog
   epic-6-retrospective: optional
+
+  epic-7: backlog # optional / nice to have: can be cut
+  7-1-kitchen-mode-extras: backlog # optional: wake lock, pretty fractions, share as text (split out of 1.11)
+  epic-7-retrospective: optional
diff --git a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
index d08cd77..819dfde 100644
--- a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
+++ b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
@@ -229,7 +229,7 @@ flowchart LR
   - **Originals:** `IngredientRead.original` is `{amount, unit} | null`, and `{null, null}` means "originally to taste". Going from null to a value, or back, counts as a change. Name-only or note-only edits never create an original. Storage: `original_amount`, `original_unit` and a `has_original` flag, because two NULLs alone could not tell "originally to taste" from "no original".
   - **Units:** `Unit` is one Python `StrEnum` of the PRD's English codes, used by every schema including `DraftRecipe` and published as an OpenAPI enum.
     - Hebrew labels live only in `he.json` (`units.<code>_one/_other`), and a test checks that every code has its labels.
-    - The countable set (`unit, clove, slice, can, package`, rounded to the nearest ½) is defined once beside the enum.
+    - The countable set (`unit, clove, slice, can, package`, rounded to the nearest of ¼ ⅓ ½ ⅔ ¾, minimum ¼) is defined once beside the enum.
     - **Import conversion:** a deterministic table in the imports service (`oz→g`, `lb→g`, `fl oz→ml`, friendly rounding; cups and spoons unchanged) plus a °F→°C pass over step text (rounded to 5; a converted step keeps its pre-conversion text in `source_text`). It runs after the LLM returns, so the model never does the arithmetic, and it has its own unit tests. Everything is stored metric. A converted ingredient keeps `source_amount` and `source_unit` (`SourceUnit`: `oz`, `lb`, `fl_oz`), kept apart from the FR-7 `original`. The detail page shows originals only through the "הצג מתכון מקורי" toggle, for recipes that have any. There is no metric/imperial display setting, so the table needs no TypeScript twin.
   - **Read shapes:** read schemas embed `tags: [{id, name}]`, ordered by `sort_order` (pinned first) and then name.
   - **Concurrency:** for the MVP, the last write wins [ASSUMPTION].
diff --git a/_bmad-output/planning-artifacts/epics.md b/_bmad-output/planning-artifacts/epics.md
index a1aae4f..7eea1fc 100644
--- a/_bmad-output/planning-artifacts/epics.md
+++ b/_bmad-output/planning-artifacts/epics.md
@@ -29,7 +29,7 @@ FR7: The first change to an existing ingredient's amount or unit stores its orig
 FR8: An ingredient that has an original shows the hint "originally {amount} {unit}" on the detail page and in the edit form. The hint is secondary, readable by screen readers, and scaled together with the amounts.
 FR9: "Reset to original" in the edit form restores the original amount and unit. After saving, the ingredient looks exactly as if it had never been edited.
 FR10: Delete a recipe after a confirmation dialog that names it. Cancelling changes nothing. Confirming permanently removes the recipe and its children. Deleting a recipe that is already gone returns 404 and shows a non-blocking message.
-FR11: Scale servings (1–100) on the detail page. Scaling happens instantly on the client, never scales to-taste ingredients, and uses the rounding rules (whole numbers as integers, otherwise up to 2 decimals, countable units to the nearest ½). It is view-only; a Reset control returns to the base servings.
+FR11: Scale servings (1–100) on the detail page. Scaling happens instantly on the client, never scales to-taste ingredients, and uses the rounding rules (whole numbers as integers, otherwise up to 2 decimals, countable units to the nearest of ¼ ⅓ ½ ⅔ ¾ (with a whole part, e.g. 1⅓), minimum ¼). It is view-only; a Reset control returns to the base servings.
 FR12: One idempotent command seeds about 10 recipes covering every pinned tag and several free tags. The set includes at least one to-taste ingredient and at least one ingredient with an original value.
 FR13: A CLI command creates the first admin (a duplicate fails, or with a flag it changes the password). Passwords are hashed, at least 8 characters, and never returned by any API.
 FR14: Log in with email and password. On success the controls for the user's role appear. A wrong email or password gives one generic error. The session expires after 7 days, and the user is then sent back to where they were after logging in again.
@@ -216,7 +216,7 @@ FR27: Epic 2 - Change your own password
 
 ### Epic 1: Browse and cook from the phone
 
-Anyone can open ביס & סיר on a phone or desktop (Hebrew, RTL, light or dark), browse the seeded recipes, search them, filter by tag, open a recipe and scale it live, with the screen staying awake in the kitchen. The groundwork comes first: adapting the scaffold, the shared libs, the OpenAPI pipeline, the database with its migrations and pinned Hebrew tags, the theme, the app shell, seed data and CI.
+Anyone can open ביס & סיר on a phone or desktop (Hebrew, RTL, light or dark), browse the seeded recipes, search them, filter by tag, open a recipe and scale it live. The groundwork comes first: adapting the scaffold, the shared libs, the OpenAPI pipeline, the database with its migrations and pinned Hebrew tags, the theme, the app shell, seed data and CI.
 **FRs covered:** FR1, FR2, FR3 (pinned tags), FR5, FR11, FR12
 
 ### Epic 2: Accounts, login and roles
@@ -244,6 +244,11 @@ Editors import a recipe from a link or from pasted text with Ollama (local) or G
 The app runs as one production container (`docker compose up`) with backups, structured logging and an env template. Performance budgets (bundle size, Lighthouse) and the Playwright e2e flows run in CI. A README explains the app and its architecture for recruiters.
 **NFRs completed:** NFR3, NFR6, NFR9, NFR11 (NFR1, 2, 4, 5, 7, 8, 10 and 12 are met inside every epic's stories)
 
+### Epic 7 (optional, nice to have): Kitchen mode extras
+
+Small comforts for cooking on the phone: the screen stays awake, amounts show as pretty fractions, and a recipe can be shared as text. Split out of Story 1.11 (2026-10-28); it can be cut without affecting any other story.
+**FRs covered:** none (UX-DR22)
+
 ## Epic 1: Browse and cook from the phone
 
 Anyone can open ביס & סיר on a phone or desktop (Hebrew, RTL, light or dark), browse the seeded recipes, search them, filter by tag, open a recipe and scale it live. The first stories adapt the existing scaffold to the architecture spine.
@@ -466,7 +471,7 @@ So that I can cook from it (FR5).
   **And** a skeleton shows while loading, and the page renders in under 500 ms locally (NFR-3)
   **And** the route is lazy-loaded in its own chunk (AD-11)
 
-### Story 1.11: Live serving scaling and kitchen mode
+### Story 1.11: Live serving scaling
 
 As a cook,
 I want to change the number of servings and see every amount update instantly,
@@ -481,13 +486,10 @@ So that I can cook for any group without doing the maths (FR11).
 
 - whole numbers have no decimals ("5", not "5.000")
 - other numbers have at most 2 decimals
-- countable units (unit, clove, slice, can, package) round to the nearest ½
+- countable units (unit, clove, slice, can, package) round to the nearest of ¼ ⅓ ½ ⅔ ¾ (with a whole part, e.g. 1⅓), minimum ¼; ⅓ and ⅔ show as 0.33 and 0.67 until Story 7.1 adds the fraction glyphs
   **And** the `ServingsStepper` has 44 px − and + buttons and a typeable value clamped to 1–100 with a range message. A polite live region announces the new servings count (UX-DR9)
-  **And** "חזרה ל־4" appears only when the value differs from the base, and it restores the base. A reload also returns to the base
+  **And** "חזרה ל־4" appears only when the value differs from the base, and it restores the base. The servings are remembered per recipe on this device (localStorage, failures ignored); "חזרה ל־4" resets them and forgets the saved value
   **And** `scaleAmount` and `formatAmount` live in `libs/recipe-domain` with 100% branch coverage. `IngredientLine` uses them for both the amount and any original hint (AD-32, NFR-2)
-  **And** while the detail page is open it requests a screen wake lock, and silently ignores a refusal (UX-DR22)
-  **And** `formatAmount` shows common fractions as ½, ⅓, ⅔, ¼ and ¾ (with a whole part, e.g. "1½") when the value is within 0.01 of one, inside `<bdi>`, and otherwise keeps the FR11 decimals; 100% branch coverage includes these cases
-  **And** a "שיתוף" button shares the recipe as plain text through the Web Share API, or copies it to the clipboard when sharing is unavailable, confirming with the toast "הועתק". The text is the title, the ingredients at the current servings, the steps and the page link, in Hebrew, built by one pure function in `libs/recipe-domain` with unit tests
 
 ## Epic 2: Accounts, login and roles
 
@@ -942,3 +944,21 @@ So that a reviewer can follow the project quickly (NFR9).
 **And** it lists the quality gates (CI, tests, budgets) and the tech stack with the reasons behind each choice
 **And** the built Storybook of `libs/ui-components` is published (e.g. GitHub Pages) and the README links to it
 **And** a reader new to the project can follow the architecture in under 10 minutes
+
+## Epic 7 (optional, nice to have): Kitchen mode extras
+
+> Optional. Split out of Story 1.11 on 2026-10-28 so live scaling could ship alone. Nothing else depends on this epic; it can be cut.
+
+### Story 7.1: Kitchen mode extras (optional)
+
+As a cook,
+I want the screen to stay awake, amounts shown as familiar fractions, and a way to share the recipe,
+So that cooking from my phone is more comfortable (UX-DR22).
+
+**Acceptance Criteria:**
+
+**Given** the detail page is open
+**When** I cook from it
+**Then** it requests a screen wake lock, and silently ignores a refusal (UX-DR22)
+**And** `formatAmount` shows common fractions as ½, ⅓, ⅔, ¼ and ¾ (with a whole part, e.g. "1½") when the value is within 0.01 of one, inside `<bdi>`, and otherwise keeps the FR11 decimals; 100% branch coverage includes these cases
+**And** a "שיתוף" button shares the recipe as plain text through the Web Share API, or copies it to the clipboard when sharing is unavailable, confirming with the toast "הועתק". The text is the title, the ingredients at the current servings, the steps and the page link, in Hebrew, built by one pure function in `libs/recipe-domain` with unit tests
diff --git a/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/prd.md b/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/prd.md
index e23fa97..4c41ccd 100644
--- a/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/prd.md
+++ b/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/prd.md
@@ -135,7 +135,7 @@ An ingredient has: name (required), an optional amount (positive number), an opt
 - **FR-11 — Scale servings.** On the detail page the user sets a target number of servings (1–100) and all ingredient amounts update immediately, without a page reload or server call.
   - AC: Scaled amount = base amount × target servings ÷ base servings.
   - AC: To-taste ingredients are never scaled.
-  - AC: Display rounding: whole numbers show without decimals ("5", not "5.000"); otherwise at most 2 significant decimals ("1.5", "0.33"); `unit`-type ingredients (eggs, cloves) are shown to the nearest ½.
+  - AC: Display rounding: whole numbers show without decimals ("5", not "5.000"); otherwise at most 2 significant decimals ("1.5", "0.33"); `unit`-type ingredients (eggs, cloves) are shown to the nearest of ¼ ⅓ ½ ⅔ ¾ (with a whole part, e.g. 1⅓), minimum ¼ (⅓ and ⅔ display as 0.33 and 0.67 until fraction glyphs ship).
   - AC: Scaling is view-only — it never changes the saved recipe. Reloading the page returns to base servings.
   - AC: A *Reset* control returns to base servings.
 
diff --git a/apps/web/src/app/recipe-detail-shell.spec.tsx b/apps/web/src/app/recipe-detail-shell.spec.tsx
index f777c65..1ef2db2 100644
--- a/apps/web/src/app/recipe-detail-shell.spec.tsx
+++ b/apps/web/src/app/recipe-detail-shell.spec.tsx
@@ -111,6 +111,15 @@ describe('the recipe detail page inside the app shell', () => {
     expect(document.activeElement).toBe(box);
   });
 
+  it('scales servings inside the real shell without leaving the page', async () => {
+    const router = renderApp('/recipes/r1');
+    await screen.findByRole('checkbox', { name: '4 עגבניות' });
+    await userEvent.click(screen.getByRole('button', { name: 'יותר מנות' }));
+    expect(screen.getByRole('checkbox', { name: '5 עגבניות' })).toBeTruthy();
+    expect(screen.getAllByRole('banner')[0]).toBeTruthy();
+    expect(router.state.location.pathname).toBe('/recipes/r1');
+  });
+
   it('shows "not found" inside the shell for an unknown id', async () => {
     renderApp('/recipes/nope');
     expect(await screen.findByText('המתכון לא נמצא')).toBeTruthy();
diff --git a/libs/feature-recipes/src/detail/use-cooking-checks.ts b/libs/feature-recipes/src/detail/use-cooking-checks.ts
index d740c5d..d1d2d2c 100644
--- a/libs/feature-recipes/src/detail/use-cooking-checks.ts
+++ b/libs/feature-recipes/src/detail/use-cooking-checks.ts
@@ -1,31 +1,6 @@
-import { useState } from 'react';
+import { useStoredState } from '../shared/use-stored-state';
 
-const storageKey = (recipeId: string) => `bb:checks:${recipeId}`;
-
-function load(recipeId: string): ReadonlySet<string> {
-  try {
-    const stored: unknown = JSON.parse(
-      localStorage.getItem(storageKey(recipeId)) ?? '[]',
-    );
-    return new Set(
-      Array.isArray(stored)
-        ? stored.filter((id): id is string => typeof id === 'string')
-        : [],
-    );
-  } catch {
-    return new Set();
-  }
-}
-
-function save(recipeId: string, checked: ReadonlySet<string>) {
-  try {
-    if (checked.size === 0) localStorage.removeItem(storageKey(recipeId));
-    else
-      localStorage.setItem(storageKey(recipeId), JSON.stringify([...checked]));
-  } catch {
-    // Private mode or a full disk: ticks just last for this visit.
-  }
-}
+const NONE: ReadonlySet<string> = new Set();
 
 /**
  * Which ingredients and steps are ticked off while cooking, kept in this
@@ -33,12 +8,18 @@ function save(recipeId: string, checked: ReadonlySet<string>) {
  * `key={recipeId}` so a new recipe reads its own ticks.
  */
 export function useCookingChecks(recipeId: string) {
-  const [checked, setChecked] = useState(() => load(recipeId));
-
-  const update = (next: ReadonlySet<string>) => {
-    setChecked(next);
-    save(recipeId, next);
-  };
+  const [checked, setChecked] = useStoredState<ReadonlySet<string>>(
+    `bb:checks:${recipeId}`,
+    NONE,
+    {
+      parse: (stored) =>
+        Array.isArray(stored)
+          ? new Set(stored.filter((id): id is string => typeof id === 'string'))
+          : undefined,
+      serialize: (ids) => [...ids],
+      isDefault: (ids) => ids.size === 0,
+    },
+  );
 
   return {
     isChecked: (id: string) => checked.has(id),
@@ -46,9 +27,9 @@ export function useCookingChecks(recipeId: string) {
       const next = new Set(checked);
       if (on) next.add(id);
       else next.delete(id);
-      update(next);
+      setChecked(next);
     },
-    clear: () => update(new Set()),
+    clear: () => setChecked(NONE),
     any: checked.size > 0,
   };
 }
diff --git a/libs/feature-recipes/src/routes/recipe-detail.spec.tsx b/libs/feature-recipes/src/routes/recipe-detail.spec.tsx
index 591a5db..cf9671d 100644
--- a/libs/feature-recipes/src/routes/recipe-detail.spec.tsx
+++ b/libs/feature-recipes/src/routes/recipe-detail.spec.tsx
@@ -52,7 +52,9 @@ function serve(r: RecipeRead) {
   server.use(http.get('*/api/recipes/:id', () => HttpResponse.json(r)));
 }
 
-afterEach(() => localStorage.clear());
+afterEach(() => {
+  localStorage.clear();
+});
 
 describe('RecipeDetailPage', () => {
   it('shows tags, times, title, ingredients, numbered steps', async () => {
@@ -301,6 +303,126 @@ describe('RecipeDetailPage', () => {
     });
   });
 
+  describe('scaling servings', () => {
+    const scalable = recipe({
+      ingredients: [
+        { ...recipe().ingredients[0], note: null, amount: 2, unit: 'cup' },
+        {
+          ...recipe().ingredients[0],
+          id: 'i2',
+          name: 'שום',
+          note: null,
+          amount: 1,
+          unit: 'clove',
+        },
+        {
+          ...recipe().ingredients[0],
+          id: 'i3',
+          name: 'גבינה',
+          note: null,
+          amount: 227,
+          unit: 'g',
+          source: { amount: 8, unit: 'oz' },
+          original: { amount: 1, unit: 'cup' },
+        },
+        {
+          ...recipe().ingredients[0],
+          id: 'i4',
+          name: 'מלח',
+          note: null,
+          amount: null,
+          unit: null,
+        },
+      ],
+    });
+
+    it('scales every amount without a server call and never touches to-taste', async () => {
+      serve(scalable);
+      renderDetail('r1');
+      const more = await screen.findByRole('button', { name: 'יותר מנות' });
+      const requests = vi.fn();
+      server.events.on('request:start', requests);
+      for (let n = 0; n < 6; n++) await userEvent.click(more);
+      server.events.removeListener('request:start', requests);
+
+      expect(requests).not.toHaveBeenCalled();
+      expect(
+        (screen.getByRole('textbox', { name: 'מספר מנות' }) as HTMLInputElement)
+          .value,
+      ).toBe('10');
+      expect(screen.getByRole('status').textContent).toBe('10 מנות');
+      expect(
+        screen.getByRole('checkbox', { name: '5 כוסות קמח' }),
+      ).toBeTruthy();
+      // 1 × 10/4 = 2.5, a countable unit in halves
+      expect(
+        screen.getByRole('checkbox', { name: '2.5 שיניים שום' }),
+      ).toBeTruthy();
+      expect(
+        screen.getByRole('checkbox', { name: '567.5 גרם גבינה' }),
+      ).toBeTruthy();
+      expect(screen.getByText('במקור 2.5 כוסות')).toBeTruthy();
+      expect(
+        screen.getByRole('checkbox', { name: 'מלח — לפי הטעם' }),
+      ).toBeTruthy();
+    });
+
+    it('scales the source value too', async () => {
+      serve(scalable);
+      renderDetail('r1');
+      await userEvent.click(
+        await screen.findByRole('button', { name: 'הצג מתכון מקורי' }),
+      );
+      await userEvent.click(screen.getByRole('button', { name: 'יותר מנות' }));
+      await userEvent.click(screen.getByRole('button', { name: 'יותר מנות' }));
+      expect(
+        screen.getByRole('checkbox', { name: '12 oz (340.5 גרם) גבינה' }),
+      ).toBeTruthy();
+    });
+
+    it('offers a way back to the base servings, only when changed', async () => {
+      serve(scalable);
+      renderDetail('r1');
+      await screen.findByRole('heading', { level: 1 });
+      expect(screen.queryByRole('button', { name: 'חזרה ל־4' })).toBeNull();
+      await userEvent.click(screen.getByRole('button', { name: 'יותר מנות' }));
+      expect(
+        screen.getByRole('checkbox', { name: '2.5 כוסות קמח' }),
+      ).toBeTruthy();
+      await userEvent.click(screen.getByRole('button', { name: 'חזרה ל־4' }));
+      expect(
+        screen.getByRole('checkbox', { name: '2 כוסות קמח' }),
+      ).toBeTruthy();
+    });
+
+    it('remembers the servings per recipe across a reload', async () => {
+      serve(scalable);
+      const { unmount } = renderDetail('r1');
+      await userEvent.click(
+        await screen.findByRole('button', { name: 'יותר מנות' }),
+      );
+      unmount();
+      renderDetail('r1');
+      expect(
+        await screen.findByRole('checkbox', { name: '2.5 כוסות קמח' }),
+      ).toBeTruthy();
+    });
+
+    it('accepts a typed value and explains the range', async () => {
+      serve(scalable);
+      renderDetail('r1');
+      const field = await screen.findByRole('textbox', { name: 'מספר מנות' });
+      await userEvent.clear(field);
+      await userEvent.type(field, '200');
+      expect(screen.getByText('אפשר להזין מספר בין 1 ל־100')).toBeTruthy();
+      await userEvent.clear(field);
+      await userEvent.type(field, '8');
+      expect(
+        screen.getByRole('checkbox', { name: '4 כוסות קמח' }),
+      ).toBeTruthy();
+    });
+  });
+
   describe('ticking off', () => {
     it('keeps ticks per recipe in this browser and clears them', async () => {
       serve(recipe());
@@ -372,7 +494,7 @@ describe('RecipeDetailPage', () => {
     renderDetail('r1');
     expect(screen.getByRole('status', { name: 'טוען מתכון' })).toBeTruthy();
     await screen.findByRole('heading', { level: 1, name: 'פנקייק' });
-    expect(screen.queryByRole('status')).toBeNull();
+    expect(screen.queryByRole('status', { name: 'טוען מתכון' })).toBeNull();
   });
 
   it('says the recipe was not found and links back to the list', async () => {
diff --git a/libs/feature-recipes/src/routes/recipe-detail.tsx b/libs/feature-recipes/src/routes/recipe-detail.tsx
index 134e69e..574e591 100644
--- a/libs/feature-recipes/src/routes/recipe-detail.tsx
+++ b/libs/feature-recipes/src/routes/recipe-detail.tsx
@@ -12,21 +12,26 @@ import {
   type SourceUnit,
   type Unit,
 } from '@bite-and-board/data-access';
-import { formatAmount } from '@bite-and-board/recipe-domain';
+import { formatAmount, scaleAmount } from '@bite-and-board/recipe-domain';
 import {
   Button,
   EmptyState,
   IngredientBoard,
   IngredientLine,
   RecipeDetailSkeleton,
+  ServingsStepper,
   StepItem,
   Toggle,
   type IngredientQuantity,
 } from '@bite-and-board/ui-components';
 import { useCookingChecks } from '../detail/use-cooking-checks';
+import { useServings } from '../detail/use-servings';
 import { useErrorMessage } from '../shared/use-error-message';
 import { useFormatTime } from '../shared/use-format-time';
 
+const MIN_SERVINGS = 1;
+const MAX_SERVINGS = 100;
+
 const TAG = 'rounded-full bg-secondary px-3 py-1 text-label';
 
 /** The hostname of a recipe's source link, or undefined if it is not a web URL. */
@@ -93,6 +98,13 @@ function RecipeDetail({ recipe }: { recipe: RecipeRead }) {
   const title = useRef<HTMLHeadingElement>(null);
   const checks = useCookingChecks(recipe.id);
   const [showOriginal, setShowOriginal] = useState(false);
+  // View-only: kept for this tab's session, never saved to the recipe.
+  const [servings, setServings] = useServings(
+    recipe.id,
+    recipe.base_servings,
+    MIN_SERVINGS,
+    MAX_SERVINGS,
+  );
 
   // The app shell moves focus to the h1 on navigation, but the recipe loads after
   // that, so the title takes focus itself once it exists (not on a first load).
@@ -109,13 +121,16 @@ function RecipeDetail({ recipe }: { recipe: RecipeRead }) {
   const sourceUnitLabel = (unit: SourceUnit) =>
     t(`sourceUnits.${unit}` as ParseKeys);
 
+  const scale = (amount: number, unit: Unit | SourceUnit | null) =>
+    scaleAmount(amount, unit, recipe.base_servings, servings);
+
   const quantityOf = (
     amount: number,
     unit: Unit | null,
-  ): IngredientQuantity => ({
-    amount: formatAmount(amount),
-    unit: unitLabel(unit, amount),
-  });
+  ): IngredientQuantity => {
+    const scaled = scale(amount, unit);
+    return { amount: formatAmount(scaled), unit: unitLabel(unit, scaled) };
+  };
 
   const originalHint = ({ original }: IngredientRead) => {
     if (!original) return undefined;
@@ -204,6 +219,25 @@ function RecipeDetail({ recipe }: { recipe: RecipeRead }) {
 
       <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
         <div className="lg:sticky lg:top-6 lg:w-board lg:shrink-0">
+          <ServingsStepper
+            className="pb-4"
+            value={servings}
+            base={recipe.base_servings}
+            min={MIN_SERVINGS}
+            max={MAX_SERVINGS}
+            onChange={setServings}
+            label={t('detail.servings.label')}
+            decreaseLabel={t('detail.servings.decrease')}
+            increaseLabel={t('detail.servings.increase')}
+            resetLabel={t('detail.servings.reset', {
+              value: recipe.base_servings,
+            })}
+            rangeMessage={t('detail.servings.range', {
+              min: MIN_SERVINGS,
+              max: MAX_SERVINGS,
+            })}
+            announcement={t('detail.servings.announce', { count: servings })}
+          />
           <IngredientBoard title={t('detail.ingredients')}>
             {recipe.ingredients.map((ingredient) => (
               <IngredientLine
@@ -218,7 +252,9 @@ function RecipeDetail({ recipe }: { recipe: RecipeRead }) {
                 source={
                   showOriginal && ingredient.source
                     ? {
-                        amount: formatAmount(ingredient.source.amount),
+                        amount: formatAmount(
+                          scale(ingredient.source.amount, null),
+                        ),
                         unit: sourceUnitLabel(ingredient.source.unit),
                       }
                     : undefined
diff --git a/libs/i18n/src/he.json b/libs/i18n/src/he.json
index 3df7bcf..8041ae3 100644
--- a/libs/i18n/src/he.json
+++ b/libs/i18n/src/he.json
@@ -108,6 +108,15 @@
     "originalHint": "במקור {{value}}",
     "originalToTaste": "במקור: לפי הטעם",
     "stepOriginal": "במקור: {{text}}",
-    "back": "חזרה למתכונים"
+    "back": "חזרה למתכונים",
+    "servings": {
+      "label": "מספר מנות",
+      "decrease": "פחות מנות",
+      "increase": "יותר מנות",
+      "reset": "חזרה ל־{{value}}",
+      "range": "אפשר להזין מספר בין {{min}} ל־{{max}}",
+      "announce_one": "מנה אחת",
+      "announce_other": "{{count}} מנות"
+    }
   }
 }
diff --git a/libs/recipe-domain/src/index.ts b/libs/recipe-domain/src/index.ts
index 2578ec7..da463f9 100644
--- a/libs/recipe-domain/src/index.ts
+++ b/libs/recipe-domain/src/index.ts
@@ -5,3 +5,4 @@ export {
   type RecipeFilter,
 } from './filter-recipes.js';
 export { formatAmount } from './format-amount.js';
+export { scaleAmount } from './scale-amount.js';
diff --git a/libs/ui-components/src/components/recipe-detail-parts.stories.tsx b/libs/ui-components/src/components/recipe-detail-parts.stories.tsx
index e288cda..1899a3d 100644
--- a/libs/ui-components/src/components/recipe-detail-parts.stories.tsx
+++ b/libs/ui-components/src/components/recipe-detail-parts.stories.tsx
@@ -2,6 +2,7 @@ import { useState } from 'react';
 import type { Meta, StoryObj } from '@storybook/react-vite';
 import { IngredientBoard, RecipeDetailSkeleton } from './ingredient-board';
 import { IngredientLine } from './ingredient-line';
+import { ServingsStepper } from './servings-stepper';
 import { StepItem } from './step-item';
 
 const meta = { title: 'Detail/Pieces' } satisfies Meta;
@@ -74,3 +75,25 @@ export const DetailSkeleton: Story = {
   name: 'RecipeDetailSkeleton',
   render: () => <RecipeDetailSkeleton />,
 };
+
+export const ServingsStepperStory: Story = {
+  name: 'ServingsStepper',
+  render: function Render() {
+    const [servings, setServings] = useState(4);
+    return (
+      <ServingsStepper
+        value={servings}
+        base={4}
+        min={1}
+        max={100}
+        onChange={setServings}
+        label="מספר מנות"
+        decreaseLabel="פחות מנות"
+        increaseLabel="יותר מנות"
+        resetLabel="חזרה ל־4"
+        rangeMessage="אפשר להזין מספר בין 1 ל־100"
+        announcement={`${servings} מנות`}
+      />
+    );
+  },
+};
diff --git a/libs/ui-components/src/index.ts b/libs/ui-components/src/index.ts
index fc1b3fe..e6e5d4b 100644
--- a/libs/ui-components/src/index.ts
+++ b/libs/ui-components/src/index.ts
@@ -44,3 +44,7 @@ export {
   RecipeDetailSkeleton,
   type IngredientBoardProps,
 } from './components/ingredient-board';
+export {
+  ServingsStepper,
+  type ServingsStepperProps,
+} from './components/servings-stepper';
```

## New: libs/recipe-domain/src/scale-amount.ts
```ts
/** Units counted in whole pieces (FR-11); mirrors the backend's countable set. */
const COUNTABLE_UNITS: ReadonlySet<string> = new Set([
  'unit',
  'clove',
  'slice',
  'can',
  'package',
]);

/** The fractions a cook can measure (Adi's kitchen fractions), with 1 closing the range. */
const KITCHEN_FRACTIONS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1] as const;

/** The nearest whole-plus-kitchen-fraction, e.g. 1.3 -> 1⅓, 0.7 -> ⅔. */
function toKitchenFraction(value: number): number {
  const whole = Math.floor(value);
  const part = value - whole;
  const nearest = KITCHEN_FRACTIONS.reduce((best, fraction) =>
    Math.abs(fraction - part) < Math.abs(best - part) ? fraction : best,
  );
  return whole + nearest;
}

/**
 * An ingredient amount scaled from `baseServings` to `servings` (FR-11).
 * Countable units round to the nearest kitchen fraction (¼ ⅓ ½ ⅔ ¾), others to
 * two decimals. A positive amount never rounds down to zero. At the base
 * servings the amount is as stored.
 */
export function scaleAmount(
  amount: number,
  unit: string | null,
  baseServings: number,
  servings: number,
): number {
  if (servings === baseServings) return amount;
  const scaled = (amount * servings) / baseServings;
  if (unit !== null && COUNTABLE_UNITS.has(unit)) {
    const snapped = toKitchenFraction(scaled);
    return scaled > 0 ? Math.max(snapped, 1 / 4) : snapped;
  }
  const rounded = Math.round(scaled * 100) / 100;
  return scaled > 0 ? Math.max(rounded, 0.01) : rounded;
}
```

## New: libs/recipe-domain/src/scale-amount.spec.ts
```ts
import { scaleAmount } from './scale-amount.js';

describe('scaleAmount', () => {
  it('returns the stored amount at the base servings', () => {
    expect(scaleAmount(1.256, 'cup', 4, 4)).toBe(1.256);
    expect(scaleAmount(1.3, 'clove', 4, 4)).toBe(1.3);
  });

  it('multiplies by servings / base', () => {
    expect(scaleAmount(2, 'cup', 4, 10)).toBe(5);
    expect(scaleAmount(100, 'g', 4, 6)).toBe(150);
  });

  it('rounds other units to two decimals', () => {
    expect(scaleAmount(1, 'cup', 3, 1)).toBe(0.33);
    expect(scaleAmount(1, null, 3, 2)).toBe(0.67);
  });

  it('rounds countable units to the nearest kitchen fraction', () => {
    expect(scaleAmount(1, 'clove', 4, 7)).toBe(1.75);
    expect(scaleAmount(1, 'unit', 4, 5)).toBe(1.25);
    expect(scaleAmount(3, 'slice', 4, 5)).toBe(3.75);
    expect(scaleAmount(1, 'can', 4, 6)).toBe(1.5);
    expect(scaleAmount(1, 'package', 4, 3)).toBe(0.75);
  });

  it('snaps to thirds and whole numbers', () => {
    expect(scaleAmount(1.3, 'unit', 1, 2)).toBeCloseTo(2 + 2 / 3);
    expect(scaleAmount(1, 'clove', 10, 7)).toBeCloseTo(2 / 3);
    expect(scaleAmount(1, 'clove', 5, 1)).toBe(0.25);
    expect(scaleAmount(1, 'can', 3, 4)).toBeCloseTo(1 + 1 / 3);
    expect(scaleAmount(1, 'unit', 4, 7.9)).toBe(2);
    expect(scaleAmount(1, 'unit', 100, 100.001)).toBe(1);
    expect(scaleAmount(2.5, 'slice', 4, 2)).toBe(1.25);
  });

  it('never rounds a positive amount down to zero', () => {
    expect(scaleAmount(1, 'clove', 100, 1)).toBe(0.25);
    expect(scaleAmount(1, 'g', 100, 1)).toBe(0.01);
    expect(scaleAmount(0.001, 'g', 4, 5)).toBe(0.01);
  });

  it('keeps zero as zero', () => {
    expect(scaleAmount(0, 'g', 4, 8)).toBe(0);
    expect(scaleAmount(0, 'clove', 4, 8)).toBe(0);
  });
});
```

## New: libs/feature-recipes/src/shared/use-stored-state.ts
```ts
import { useState } from 'react';

export interface StoredStateOptions<T> {
  /** Where to keep the value: this device (`local`, default) or this tab (`session`). */
  storage?: 'local' | 'session';
  /** Turns whatever JSON was stored into a `T`, or `undefined` if it is not valid. */
  parse?: (stored: unknown) => T | undefined;
  /** Turns the value into JSON-safe data; the value itself by default. */
  serialize?: (value: T) => unknown;
  /** A value that need not be stored; saving it removes the key. By default `=== fallback`. */
  isDefault?: (value: T) => boolean;
}

function area(kind: 'local' | 'session') {
  return kind === 'session' ? sessionStorage : localStorage;
}

/**
 * State kept in the browser under `key`. A missing, unreadable or invalid stored
 * value gives `fallback`, and every storage failure (private mode, full disk) is
 * ignored: the state then just lasts for this page view. Saving a default value
 * clears the key. Mount with `key={...}` when `key` can change.
 */
export function useStoredState<T>(
  key: string,
  fallback: T,
  {
    storage = 'local',
    parse = (stored) => stored as T,
    serialize = (value) => value,
    isDefault = (value) => value === fallback,
  }: StoredStateOptions<T> = {},
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = area(storage).getItem(key);
      return raw === null ? fallback : (parse(JSON.parse(raw)) ?? fallback);
    } catch {
      return fallback;
    }
  });

  const update = (next: T) => {
    setValue(next);
    try {
      if (isDefault(next)) area(storage).removeItem(key);
      else area(storage).setItem(key, JSON.stringify(serialize(next)));
    } catch {
      // Not saved; the value still holds for this page view.
    }
  };

  return [value, update] as const;
}
```

## New: libs/feature-recipes/src/shared/use-stored-state.spec.ts
```ts
import { act, renderHook } from '@testing-library/react';
import { useStoredState } from './use-stored-state';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

const setOptions = {
  parse: (stored: unknown) =>
    Array.isArray(stored) ? new Set(stored as string[]) : undefined,
  serialize: (value: Set<string>) => [...value],
  isDefault: (value: Set<string>) => value.size === 0,
};

describe('useStoredState', () => {
  it('starts at the fallback and saves to localStorage by default', () => {
    const { result } = renderHook(() => useStoredState('k', 4));
    expect(result.current[0]).toBe(4);
    act(() => result.current[1](10));
    expect(result.current[0]).toBe(10);
    expect(localStorage.getItem('k')).toBe('10');
    expect(sessionStorage.getItem('k')).toBeNull();
    expect(renderHook(() => useStoredState('k', 4)).result.current[0]).toBe(10);
  });

  it('can use sessionStorage instead', () => {
    const options = { storage: 'session' } as const;
    const { result } = renderHook(() => useStoredState('k', 4, options));
    act(() => result.current[1](7));
    expect(sessionStorage.getItem('k')).toBe('7');
    expect(localStorage.getItem('k')).toBeNull();
    expect(
      renderHook(() => useStoredState('k', 4, options)).result.current[0],
    ).toBe(7);
  });

  it('removes the key when the default is saved', () => {
    const { result } = renderHook(() => useStoredState('k', 4));
    act(() => result.current[1](10));
    act(() => result.current[1](4));
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('uses parse, serialize and isDefault when given', () => {
    const { result } = renderHook(() =>
      useStoredState('k', new Set<string>(), setOptions),
    );
    act(() => result.current[1](new Set(['a'])));
    expect(localStorage.getItem('k')).toBe('["a"]');
    const again = renderHook(() =>
      useStoredState('k', new Set<string>(), setOptions),
    );
    expect([...again.result.current[0]]).toEqual(['a']);
    act(() => result.current[1](new Set()));
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('falls back when the stored value is invalid or not JSON', () => {
    const options = {
      parse: (stored: unknown) =>
        typeof stored === 'number' ? stored : undefined,
    };
    localStorage.setItem('k', '"text"');
    expect(
      renderHook(() => useStoredState('k', 4, options)).result.current[0],
    ).toBe(4);
    localStorage.setItem('k', '{not json');
    expect(
      renderHook(() => useStoredState('k', 4, options)).result.current[0],
    ).toBe(4);
  });

  it('keeps working when storage throws', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('blocked');
      });
    }
    const { result } = renderHook(() => useStoredState('k', 4));
    expect(result.current[0]).toBe(4);
    act(() => result.current[1](6));
    expect(result.current[0]).toBe(6);
    act(() => result.current[1](4));
    expect(result.current[0]).toBe(4);
  });
});
```

## New: libs/feature-recipes/src/detail/use-servings.ts
```ts
import { useStoredState } from '../shared/use-stored-state';

/**
 * The servings being cooked for, remembered per recipe on this device; going
 * back to the base servings forgets them. Mount it with `key={recipeId}`.
 */
export function useServings(
  recipeId: string,
  base: number,
  min: number,
  max: number,
) {
  return useStoredState(`bb:servings:${recipeId}`, base, {
    parse: (stored) =>
      typeof stored === 'number' &&
      Number.isInteger(stored) &&
      stored >= min &&
      stored <= max
        ? stored
        : undefined,
  });
}
```

## New: libs/feature-recipes/src/detail/use-servings.spec.ts
```ts
import { act, renderHook } from '@testing-library/react';
import { useServings } from './use-servings';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const setup = (id = 'r1') => renderHook(() => useServings(id, 4, 1, 100));

describe('useServings', () => {
  it('starts at the base servings', () => {
    expect(setup().result.current[0]).toBe(4);
  });

  it('remembers the servings per recipe on this device and restores them', () => {
    const { result } = setup();
    act(() => result.current[1](10));
    expect(result.current[0]).toBe(10);
    expect(localStorage.getItem('bb:servings:r1')).toBe('10');
    expect(setup().result.current[0]).toBe(10);
    expect(setup('r2').result.current[0]).toBe(4);
  });

  it('forgets the value when it is back at the base', () => {
    const { result } = setup();
    act(() => result.current[1](10));
    act(() => result.current[1](4));
    expect(localStorage.getItem('bb:servings:r1')).toBeNull();
  });

  it.each(['abc', '0', '101', '2.5', ''])('ignores a stored "%s"', (value) => {
    localStorage.setItem('bb:servings:r1', value);
    expect(setup().result.current[0]).toBe(4);
  });

  it('ignores storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = setup();
    expect(result.current[0]).toBe(4);
    act(() => result.current[1](6));
    expect(result.current[0]).toBe(6);
  });
});
```

## New: libs/ui-components/src/components/servings-stepper.tsx
```ts
import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';

export interface ServingsStepperProps {
  /** The current number of servings. */
  value: number;
  /** The recipe's own servings; the reset button shows when `value` differs. */
  base: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  /** "חזרה ל־4"; the button is shown only when `value` differs from `base`. */
  resetLabel: string;
  /** Shown while the typed value is empty or outside `min`–`max`. */
  rangeMessage: string;
  /** Read out politely whenever the servings change, e.g. "10 מנות". */
  announcement: string;
  className?: string;
}

/** Servings control with 44 px buttons and a typeable, clamped value (UX-DR9). */
export function ServingsStepper({
  value,
  base,
  min,
  max,
  onChange,
  label,
  decreaseLabel,
  increaseLabel,
  resetLabel,
  rangeMessage,
  announcement,
  className,
}: ServingsStepperProps) {
  const inputId = useId();
  const messageId = useId();
  // What is being typed; null while the field simply shows `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const invalid =
    draft !== null &&
    (draft === '' || Number(draft) < min || Number(draft) > max);

  const commit = (next: number) => {
    setDraft(null);
    onChange(Math.min(max, Math.max(min, next)));
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={inputId} className="text-label">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={decreaseLabel}
          disabled={value <= min}
          onClick={() => commit(value - 1)}
        >
          <Minus aria-hidden="true" />
        </Button>
        <Input
          id={inputId}
          type="text"
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          value={draft ?? String(value)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? messageId : undefined}
          className="w-16 text-center tabular-nums"
          onChange={(event) => {
            const text = event.target.value.replace(/\D/g, '');
            setDraft(text);
            const next = Number(text);
            if (text !== '' && next >= min && next <= max) onChange(next);
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setDraft(null);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={increaseLabel}
          disabled={value >= max}
          onClick={() => commit(value + 1)}
        >
          <Plus aria-hidden="true" />
        </Button>
        {value !== base ? (
          <Button type="button" variant="ghost" onClick={() => commit(base)}>
            {resetLabel}
          </Button>
        ) : null}
      </div>
      {invalid ? (
        <p id={messageId} className="text-label text-destructive">
          {rangeMessage}
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
```

## New: libs/ui-components/src/components/servings-stepper.spec.tsx
```ts
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServingsStepper } from './servings-stepper';

function Harness({ start = 4 }: { start?: number }) {
  const [value, setValue] = useState(start);
  return (
    <ServingsStepper
      value={value}
      base={4}
      min={1}
      max={100}
      onChange={setValue}
      label="מספר מנות"
      decreaseLabel="פחות מנות"
      increaseLabel="יותר מנות"
      resetLabel="חזרה ל־4"
      rangeMessage="בין 1 ל־100"
      announcement={`${value} מנות`}
    />
  );
}

const input = () => screen.getByRole('textbox', { name: 'מספר מנות' });

describe('ServingsStepper', () => {
  it('steps up and down with the buttons and announces politely', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'יותר מנות' }));
    expect((input() as HTMLInputElement).value).toBe('5');
    expect(screen.getByRole('status').textContent).toBe('5 מנות');
    await userEvent.click(screen.getByRole('button', { name: 'פחות מנות' }));
    await userEvent.click(screen.getByRole('button', { name: 'פחות מנות' }));
    expect((input() as HTMLInputElement).value).toBe('3');
  });

  it('shows the reset button only away from the base, and it restores it', async () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'חזרה ל־4' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'יותר מנות' }));
    await userEvent.click(screen.getByRole('button', { name: 'חזרה ל־4' }));
    expect((input() as HTMLInputElement).value).toBe('4');
    expect(screen.queryByRole('button', { name: 'חזרה ל־4' })).toBeNull();
  });

  it('disables the buttons at the limits', () => {
    const { unmount } = render(<Harness start={1} />);
    expect(
      screen
        .getByRole('button', { name: 'פחות מנות' })
        .hasAttribute('disabled'),
    ).toBe(true);
    unmount();
    render(<Harness start={100} />);
    expect(
      screen
        .getByRole('button', { name: 'יותר מנות' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('takes a typed value and ignores non-digits', async () => {
    render(<Harness />);
    await userEvent.clear(input());
    await userEvent.type(input(), '1a0');
    expect((input() as HTMLInputElement).value).toBe('10');
    expect(screen.getByRole('status').textContent).toBe('10 מנות');
    expect(screen.queryByText('בין 1 ל־100')).toBeNull();
  });

  it('shows the range message for empty or out-of-range input, then reverts on blur', async () => {
    render(<Harness />);
    await userEvent.clear(input());
    expect(screen.getByText('בין 1 ל־100')).toBeTruthy();
    expect(input().getAttribute('aria-invalid')).toBe('true');

    await userEvent.type(input(), '150');
    expect(screen.getByText('בין 1 ל־100')).toBeTruthy();
    // "15" was valid on the way to "150", so that is what the page holds.
    expect(screen.getByRole('status').textContent).toBe('15 מנות');

    await userEvent.tab();
    expect((input() as HTMLInputElement).value).toBe('15');
    expect(screen.queryByText('בין 1 ל־100')).toBeNull();
  });

  it('treats 0 as out of range', async () => {
    render(<Harness />);
    await userEvent.clear(input());
    await userEvent.type(input(), '0');
    expect(screen.getByText('בין 1 ל־100')).toBeTruthy();
  });

  it('drops the draft on Enter', async () => {
    render(<Harness />);
    await userEvent.clear(input());
    await userEvent.type(input(), '7{Enter}');
    expect((input() as HTMLInputElement).value).toBe('7');
  });
});
```
