# Review: Story 3.1 Create a recipe (API and basic form)

Working tree on branch `claude/story-3-1-create-recipe` (cut from `main` at 13136bb). Not committed; for Adi's review. Commit
trailer on "c p": `Claude-Session: https://claude.ai/code/session_01Uibg2JgePptwJLiUbinmzh`.

## What it does

- **Server:** `POST /api/recipes` (`require_role("editor")`, so an admin also passes) returns 201 with the full `RecipeRead`.
  The router passes the signed-in user to `RecipeService.create_recipe(data, user_id)`, which sets `created_by` and
  `updated_by`. `user_id` defaults to `None` so the seed keeps working. Errors: 401 visitor, 403 without the CSRF header or
  role, 404 `tag_not_found` (rolls the recipe back), 422 for invalid input.
- **Validation (`recipes/schemas.py`):** `RecipeCreate`, `IngredientCreate` and `StepCreate` are now `extra="forbid"`; at
  least one ingredient and one step; servings 1 to 100; title 1 to 120; description up to 500; notes up to 5,000. An amount is
  a number above 0 and below 1,000,000,000 (it must fit `NUMERIC(12, 3)`), finite, and **quantized to 3 decimals in the
  schema** (so 0.33333 is stored and returned as 0.333; 0.0004 is rejected as `greater_than`, not stored as 0). The OpenAPI
  schema publishes it as a plain `number`, so the generated Zod is `z.number().gt(0).lt(1e9)`.
- **Client contract:** regenerated `openapi.json` and `src/generated/**` (`recipesCreateRecipeMutation`,
  `zRecipesCreateRecipeBody`). Running generate a second time gives no diff.
- **Page:** `/recipes/new`, lazy chunk `feature-recipes/recipe-new`, inside `protectedRoute(queryClient, 'editor', …)` (a
  visitor goes to `/login?next=/recipes/new`). Shared `BackLink` with `useBackNavigation`, an h1, then the form.
- **Form (`libs/feature-recipes/src/form/`):** React Hook Form, `RecipeFormValues` (every number is the text of its field),
  and the two pure mappers `toFormValues` and `toWritePayload`. `useFieldArray` for ingredients (amount, unit select with the
  Hebrew labels, name, note) and steps (textarea), with add and remove buttons; the last row of each cannot be removed.
  Description and notes have a live counter ("0/500", "0/5000") that turns red past the limit and never cuts a paste.
- **Validation on the client:** the resolver checks that numeric fields are numbers, then runs `toWritePayload` through the
  **generated Zod write schema**. Both turn into one `FieldIssue` shape.
- **422 on the fields (AD-9, AD-28):** `data-access/validation-errors.ts` maps FastAPI `loc` to the form path
  (`ingredients.0.name`) and keeps `type` and the numbers of `ctx`. `fromZodIssues` puts Zod's issues in the same vocabulary,
  so the client check and the server share one message table: `validation.*` in `he.json` (`validation.fields.ingredients.too_short`
  and `…steps.too_short` are the two special ones). Errors with a code (404 tag, 5xx, network) go under the button via
  `errors.<code>` / `errors.unknown`. The form keeps every value and the button works again, so a second try can go through.
- **After saving:** the answer is put in the detail query cache, `invalidationMap.recipeWrite` refreshes the library list (and,
  given an id, that recipe's page), toast "המתכון נשמר", then `navigate(/recipes/:id, { replace: true })`, so "back" from the
  new recipe is the library, not the form. Everything after the POST is non-throwing, so a failure cannot cause a duplicate.
- **Entry points:** "מתכון חדש" in the top bar (a lazy chunk, `feature-recipes/new-recipe-button`, rendered only when
  `useCan('editor')`; a 44 px "+" on phone and the text from `sm`), and in the library's empty state for editors.
- **New in `ui-components`:** `Textarea`, `FormField` (label, control props with `aria-invalid` / `aria-required` / `aria-describedby`,
  hint, error, counter), `CharacterCounter`, `RequiredMark` and `RequiredNote`, with specs and stories. Tokens only; logical classes.
- **Required-field indicator (added after Adi's review of the form):** `FormField` takes `required`. It puts a **red** (`text-destructive`)
  `aria-hidden` " *" at the end of the label text and sets `aria-required="true"` on the control (forms stay `noValidate`; no native
  `required`). `RequiredNote` is the legend at the top of a form, "שדות המסומנים ב־* הם שדות חובה" (`form.requiredNote` in `he.json`),
  with its own `*` drawn red. In the recipe form: title and servings carry the star; the rows have no visible labels, so the star is on
  the **headings** "מצרכים *" and "אופן הכנה *", and the ingredient-name inputs and step textareas have `aria-required`. No stars in
  placeholders. The same was applied to **login** (both fields), **account** (the three password fields), **add user** (email, name,
  password, confirm; not the role, which always has a value) and **reset password** (both). To do that, the login, account and the
  two users dialogs now use `FormField`, and `feature-users/src/users/field.tsx` (a copy of the same idea) is deleted.

## Decisions applied (Adi: "all ok")

D1 no tags in 3.1 (`tags: []`; the picker is 3.3). D2 the form lives in `feature-recipes/form`, ready for 3.4. D3 one shared 422
helper in `data-access`. D4 lazy top-bar button. Effort high. Later, on seeing the form: a required-field indicator, option A
(star on required fields, not "(אופציונלי)" on the optional ones), red, with the legend, also on the four existing forms.

## Things to know

1. **Initial JS (gzip, entry + modulepreload from `apps/web/dist/index.html`), measured again after the required-field work:**
   120,390 + 32,063 = **152,453 B (148.88 KiB)** (it was 152,427 B before it); the
   last review recorded 149.4 KiB, so no growth. Budget 200 KB. `web:size` does not exist yet, so I measured by hand. The data-access
   client, Zod and the form are not in the entry: `recipe-new` is 7,619 B gzip and `new-recipe-button` 479 B, both lazy. (The
   string `string_too_short` appears in the entry only as a `he.json` key.)
2. **The form's field names are the payload's** (`base_servings`, `prep_time_minutes`, …), not camelCase. That makes a 422 `loc`
   the field path with no translation table. Worth knowing when 3.4 reuses it.
3. **An ingredient with no amount is "to taste"**: its unit select is disabled and `toWritePayload` sends `unit: null`, matching the
   AD-20 original semantics. A blank servings becomes `NaN` in the payload, which Zod reports as `missing` ("יש למלא את השדה").
4. **Units in the select** use the plural form (`units.<code>` with `count: 0`, the same trick `recipe-detail` uses) because Hebrew's
   `count: 2` asks for a `_two` key that does not exist.
5. **Amounts are plain decimals for now** ("1.5"); "½", "1/3" and a friendlier parse are Story 3.2. Also not here, by the epic:
   unsaved-changes guard, Enter adding a row, reordering, focus management beyond RHF's focus on the first error (3.2), tag picker (3.3).
6. **`TagInput` is not `extra="forbid"`** (it lives in `tags/schemas.py` and 3.3 reworks it). The recipe-level schemas are.
7. **Tests that load lazy chunks** (`apps/web/src/app/new-recipe-route.spec.tsx`) had one timeout under a fully loaded machine in my
   first `npm run verify`; I gave them a 10 s wait, and when one still timed out while five projects ran in parallel I raised it to 30 s
   (the first import transforms the whole module graph; alone the file runs in under 0.5 s). Uncached full runs passed afterwards. Nx now lists `web:test` as "flaky"
   because it saw one fail and then pass. Same pattern as the existing 4 s `protected-route` test.
8. **Tests that find a field by its label** needed a small change: a required field's label text now ends in " *", so `getByLabelText('אימייל')`
   no longer matches exactly. The login, account and users specs use a `labelled()` helper (`testing/labelled.ts` in `feature-auth` and
   `feature-users`) and the recipe form spec a `field()` helper; the accessible name (what a screen reader hears) is unchanged because the
   star is `aria-hidden`. A future form spec will need the same.
9. **Line endings:** Python on this Windows machine wrote CRLF into files; every changed file is LF again, and `nx format:check` is clean.
10. **A slip, already undone:** while checking the bundle I ran `git stash` followed by `git stash apply` by mistake. I confirmed the
   tree was identical to the stash (empty diff) and dropped it; there is no stash left and nothing was lost.
11. **Not verified:** a screen-reader and keyboard-only pass (labels, `aria-invalid`, `aria-describedby` and the `role="alert"` lines are
    covered by tests); the desktop layout (`sm` and up) in a real browser (only 375 px was checked by eye); a real 422 from the
    server in the browser (covered by the component tests with the exact FastAPI shape, and the API tests assert the `loc` and `type`).

## Housekeeping

`sprint-status.yaml`: `epic-2: done`, `epic-3: in-progress`, `3-1…: review`, `last_updated` bumped. Both retros stay `optional`.

## Checks run

- `npm run verify` (lint, typecheck, test, build): all tasks succeeded, uncached, after the required-field work (one lint error on my
  own spec, a `role="combobox"` on a `<button>`, was fixed on the way). `nx format:check`: clean. `git diff --check`: clean.
- Backend: **333 pytest tests** (307 before; 26 new in `tests/test_recipes_create_api.py`, plus the old helper in
  `test_recipes_create.py` now gives its recipes an ingredient and a step), `ruff`, `mypy` strict, `lint-imports` (13 contracts kept).
  `seed` still creates all 10 demo recipes.
- Required-field tests: `FormField` (star, `aria-hidden`, red class, `aria-required`, none when optional, works for any control),
  `RequiredMark` / `RequiredNote`, the recipe form (which fields have the star, headings, rows, legend, no star in placeholders), and one test
  each for login, account, add user (role not marked) and reset password. Story: `Form field / Required`.
- Frontend new specs: mapper unit tests, validation unit tests, `validation-errors` (including Zod vs server vocabulary),
  `invalidationMap`, `FormField` / `CharacterCounter`, 12 component tests for the page (fields, counters, units, rows, save, history,
  client errors, over-limit, 422 on fields, list error, code error, network failure then retry), the library empty state for an
  editor and a visitor, and 4 route tests in `apps/web` (guard, redirect, the top-bar button for an editor and not for a visitor).
- **Browser check, 375 px, scratch DB** (`…/scratchpad/scratchdb`, my own API on :8000 and web on :4200; both ports were free, so none
  of Adi's servers were involved and `apps/recipe-service/data` was not touched): "+" in the top bar, stacked ingredient row, Hebrew
  unit list, empty submit shows "יש למלא את השדה" and focuses the title, a filled form saved and landed on the detail page, the row
  in the DB has `created_by = updated_by = the editor`, "back" lands on the library with the new recipe first. No console errors.
  Both servers stopped afterwards. After the required-field work I looked again at 375 px: the legend line under the h1 with a red star,
  red stars on "שם המתכון", "מספר מנות", "מצרכים" and "אופן הכנה"; login and the dialogs are covered by tests only, not looked at.

## Files

Backend: `recipes/{router,schemas,service}.py`, `tests/test_recipes_create_api.py` (new), `tests/test_recipes_create.py`.
Contract: `libs/data-access/openapi.json`, `src/generated/**`, `src/invalidation.ts`, `src/validation-errors.ts` (+ spec, new), `src/index.ts`, `src/index.spec.ts`.
UI kit: `ui/textarea.tsx`, `form-field.tsx`, `character-counter.tsx`, `required-mark.tsx` (+ spec, stories, all new), `src/index.ts`.
Other forms: `feature-auth/src/routes/{login,account}.tsx`, `feature-users/src/users/{add-user-dialog,reset-password-dialog}.tsx`, `field.tsx` deleted,
`testing/labelled.ts` in both libs, and their specs.
Feature: `feature-recipes/src/form/*` (new), `routes/recipe-new.tsx`, `routes/new-recipe-button.tsx` (+ spec, new), `routes/library.tsx`
(+ spec), `testing/{server,setup,render-new}`, `package.json`.
App: `apps/web/src/app/{router,app-layout}.tsx`, `new-recipe-route.spec.tsx` (new). Strings: `libs/i18n/src/he.json`
(`recipeForm`, `validation`). Tracking: `sprint-status.yaml`, this file.
