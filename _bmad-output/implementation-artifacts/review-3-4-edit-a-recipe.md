# Review: Story 3.4 Edit a recipe with original-value tracking

Working tree on branch `claude/story-3-4-edit-recipe` (cut from `main` at 5c26669). Not committed; for Adi's review. The
uncommitted `sprint-status.yaml` carries 3-3 `done` and 3-4 `in-progress`. Commit trailer on "c p":
`Claude-Session: https://claude.ai/code/session_01Uibg2JgePptwJLiUbinmzh`.

## What it does

**Backend (`apps/recipe-service`)**

- **`PUT /api/recipes/{id}`** (editor or admin; CSRF like every write). Body `RecipeUpdate`: the same fields as `RecipeCreate`, but each
  ingredient may carry an `id`. `extra="forbid"` and no `original*` fields, so the client can never send an original (AD-20).
  `RecipeCreate` and `RecipeUpdate` now share a private `_RecipeFields` base (mypy would not accept a subclass that changes the
  `ingredients` item type).
- **`RecipeService.update_recipe`**: one transaction. Matches ingredients by `id` and updates them in place (so their originals
  survive); omitted ingredients are deleted (`delete-orphan`); rows without an `id` are inserted; array order becomes `position`.
  An `id` that is not one of this recipe's ingredients raises a 422 `RequestValidationError` at `body.ingredients.N.id`, type
  `invalid`, and nothing is saved. Steps are replaced wholesale. Sets `updated_at` and `updated_by`. Tags are replaced through the new
  `TagService.replace_for_recipe` (unlink all, then the existing `assign_to_recipe`); an unknown tag id is 404 and rolls the whole save
  back (tested).
- **`recipes/originals.py`** (new, pure): `apply_edit(ingredient, amount, unit)` is the whole FR-7..9 truth table. Amounts are
  quantized to 3 decimals before comparing (AD-31); to taste is `(None, None)`.
  - first change stores the previous value as the original; later changes keep it (1 → 2 → 3 keeps 1);
  - to taste to or from a value counts as a change; name/note edits never touch it; new ingredients never get one;
  - back to the original clears it (this is the server half of Story 3.5's reset).
- **Seed**: `TUNED_RECIPE` "עוגיות חמאה", created and then updated through the service (sugar 1 cup → ½ cup), so the library has one
  recipe with a hinted ingredient. `SEED_TOTAL` is 11 (10 plain + this one); idempotent by title.

**Frontend**

- **`/recipes/:id/edit`**: new lazy page `recipe-edit.tsx` inside the editor-only `protectedRoute` (a visitor goes to
  `/login?next=…`). It fetches on arrival (`refetchOnMount: 'always'`, no refetch on focus, so the form never starts stale and never
  gets replaced while typing), shows the detail skeleton, the not-found `EmptyState` on a 404, and otherwise reuses `RecipeForm`
  with `toFormValues(recipe)`. BackLink goes to the recipe. The unsaved-changes guard comes with the form.
- **Save**: PUT, then `setQueryData` for the recipe (the detail page opens with the answer), `recipeWrite` invalidation (list and tags),
  toast "השינויים נשמרו", and `navigate(..., { replace: true })` so "back" from the recipe is not the form.
- **Form**: ingredient rows now carry `ingredientId` (sent as `id`) and `original` (display only, never sent). Under a hinted row the form
  shows "במקור 300 גרם" or "במקור: לפי הטעם" in the `hint` colour, tied to the amount and name inputs with `aria-describedby`.
  Validation now uses `zRecipesUpdateRecipeBody` (a superset of the create schema).
- **`useOriginalHint`** (new hook): one place that formats the hint text. The detail page uses it with the servings scale; the form uses
  it unscaled.
- **Detail page**: "עריכה" button (editors only, `useCan('editor')`) next to the back link.
- **i18n** (`he.json`): `detail.edit`, `recipeForm.editTitle`, `editBack`, `editSaved`.
- **API client**: regenerated (`api:types`): `recipesUpdateRecipe`, `RecipeUpdate`, `IngredientUpdate`.

## Decisions as agreed

PUT with whole-recipe replace; ingredients matched by id; the reset button and its UI are Story 3.5 (the form shows the hint only);
last write wins (AD-20 assumption, no `updated_at` check).

## Things to know

1. **A step's `source_text` is lost on edit.** Steps have no ids on the wire, so an edit recreates them. `source_text` only exists on
   steps converted by an import (°F → °C), and only matters for the "show original" toggle. If the import story lands before this
   matters, steps need to be matched by position or id. Not done here.
2. **Concurrent edits:** last write wins. Two editors saving the same recipe: the later save silently replaces the earlier one,
   including its ingredient edits. Original values are not lost, only the other person's changes.
3. **A refused ingredient `id`** (foreign or deleted) has no field to show on, so the form shows the generic "משהו השתבש, אפשר לנסות שוב"
   under the button. It cannot happen from the UI unless the recipe was changed in another tab.
4. **Mobile layout:** the hint is the last line of its ingredient's block, after the row-action buttons, so on a phone "במקור 300 גרם" sits
   right above the next ingredient's amount field. It is attached to the right row (`aria-describedby` is correct), but visually it can
   read as belonging to the one below. Easy to move above the action buttons if Adi prefers.
5. **The hint is unscaled in the form** (the form edits base amounts); only the detail page scales it with the servings.
6. **Tag ids and ingredient ids in the write schema are validated as UUIDs on the client too**, so tests must use real UUIDs.
7. **Not verified:** a real phone, a screen-reader pass.

## Checks run

- `npm run verify` (lint, typecheck, test, build on all 16 projects): 32/32 tasks succeeded. `npx nx format:check`: clean.
  (An earlier run of `web:test` timed out once on `main.spec.tsx` under load; it passed on re-runs.)
- Backend: truth table 13 parametrized cases plus thirds and normalization (`test_recipes_originals.py`); `PUT` access, replace, id
  matching, foreign id 422, tags, rollback, originals (`test_recipes_update_api.py`); seed tests updated for the tuned recipe.
- Frontend: edit page (prefill, hint + `aria-describedby`, payload with ids and no originals, invalidation, REPLACE navigation, server
  refusal, unsaved-changes guard both ways, not found), route specs in `apps/web` (editor sees the form, visitor goes to login), detail
  button for editor and visitor, form-value mapping.
- **Initial JS (gzip, entry + modulepreload):** 85,603 + 32,278 + 1,410 + 35,699 = **154,990 B (151.4 KiB)**, +389 B against 3.3's 154,601 B.
  Budget 200 KB. There is no `web:size` Nx target yet (AD-17 mentions it for CI), so I summed the gzip sizes by hand. The generated
  `zRecipeUpdate` and `recipesUpdateRecipe` are not in the entry chunk; the new `recipe-edit` chunk is 1,543 B gzip and reuses the
  `recipe-form` chunk (17,023 B).
- **Browser (scratch DB in the session scratchpad, seeded, one test editor):** signed in; detail shows "עריכה" and the sugar hint
  "במקור 1 כוס"; edit form prefilled with the hint under sugar; changed flour 300 → 350 and saved: the detail page opened with the toast,
  flour 350 with "במקור 300 גרם"; at 375 px the form has no horizontal scroll and the hint text is `hint`-coloured; desktop checked.
  Servers stopped afterwards.

## Not in this story

Reset to original (3.5), delete (3.6), photos (3.7), the `web:size` Nx target.
