# Spec: Story 1.10 Recipe detail page

Source: `planning-artifacts/epics.md` (Story 1.10), AD-2, AD-11, AD-26, AD-28; EXPERIENCE.md (Ingredient line, States, Responsive); UX-DR6, 10, 20.
Status: IMPLEMENTED, in review.

## Goal

`/recipes/:id` shows one recipe for cooking on a phone: header, ingredient board, numbered steps, notes, source link, tick-off checkboxes and the "הצג מתכון מקורי" toggle. Lazy-loaded in its own chunk.

## Decisions (Adi, via coordinator: "y" to all recommendations)

- D1 `formatAmount(n)` added to `libs/recipe-domain` (whole numbers plain, else at most 2 decimals; 100% coverage). Story 1.11 extends it with scaling.
- D2 Presentational `IngredientLine`, `IngredientBoard`, `StepItem`, `RecipeDetailSkeleton` in `libs/ui-components` (stories + specs). Container `RecipeDetailPage` in `libs/feature-recipes`, second lazy subpath export `./recipe-detail`. Route `recipes/:id` in `apps/web`.
- D3 Own hook `useCookingChecks(recipeId)`: localStorage key `bb:checks:<id>`, every access in try/catch. No new library.
- D4 The toggle is a plain `useState` in the page (default off, per visit), built on the existing `Toggle`.
- D5 `units.<code>_one/_other` for all 13 `Unit` codes and `sourceUnits.*` in `he.json`; `he.spec.ts` checks every API unit has labels.
- D6 No photo on the detail page (not in the 1.10 AC); recorded in `deferred-work.md`.

## Design notes

- Layout: one column; from `lg` a flex row, sticky 400 px start column (`--container-board` token) holding the board, steps beside it.
- The source link is rendered only for http(s) URLs (no `javascript:` links), with the hostname shown.
- Notes render as text in `whitespace-pre-line`, never HTML.
- The checkbox is a native `<input type="checkbox">` inside a 44 px-min label that wraps the whole line; the `original`/source hint sits under the line and is linked with `aria-describedby`.
- Unit plurals use i18next `count` (`_one`/`_other`).

## Tests

- domain: `formatAmount`; ui: `IngredientLine`, `StepItem`, `IngredientBoard` specs and stories; i18n unit coverage.
- feature (Vitest + MSW): full page, notes present/absent, to-taste, source toggle, checks persist/clear/storage failure, not found, error + retry, skeleton.
- web: real `AppLayout` render of `/recipes/:id` (focus moves to the h1 on navigation from the library, stays while ticking), route lazy chunk.
