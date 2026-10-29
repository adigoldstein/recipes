# Review: Story 3.6 Delete a recipe

Working tree on branch `claude/story-3-6-delete-recipe` (cut from `main` at 31ac307). Not committed; for Adi's review. The uncommitted
planning edits (Story 3.5 moved to the optional 7.5 in `epics.md`, and `sprint-status.yaml`) ride along. Commit trailer on "c p":
`Claude-Session: https://claude.ai/code/session_01Uibg2JgePptwJLiUbinmzh`.

## What it does

**Backend (`apps/recipe-service`)**

- **`DELETE /api/recipes/{id}`** (editor or admin; CSRF like every write). 204 No Content on success; 404 `recipe_not_found` if the recipe
  does not exist (so a second delete is a 404). Visitor 401, missing CSRF header 403.
- **`RecipeService.delete_recipe`** loads the recipe (404 if missing), deletes it and commits; any failure rolls back. **`RecipeRepository.delete`**
  stages the removal. No migration: the ingredient, step and recipe-tag foreign keys already have `ON DELETE CASCADE`, and SQLite's
  `foreign_keys` pragma is on. Tags themselves are kept; only their links to the recipe go.
- Tests (`test_recipes_delete_api.py`): 401, CSRF 403, the recipe plus its ingredients, steps and tag links are gone while the tag stays, only
  the named recipe is deleted, delete twice is 404, unknown id is 404, a failed commit rolls back, and the service raises not-found.

**Frontend**

- **`detail/delete-recipe.tsx`**: the "מחיקה" button and its `ConfirmDialog` (destructive). Title "למחוק את המתכון?", text "המתכון '{title}'
  יימחק לצמיתות.", buttons "מחיקה" and "ביטול". Radix puts focus on "ביטול" (asserted in a test and checked in the browser).
- **Button:** ghost, `text-destructive`, trash icon, next to "עריכה" in the header row of the detail page, editors only (`useCan('editor')`).
  On a phone it is a 44 x 44 px icon-only button (text is `sr-only`, so its accessible name is still "מחיקה"); from `sm` up the text shows.
- **After success:** toast "המתכון נמחק", then one step back in history when the visitor came from inside the app (so the library keeps its
  filters), otherwise to `/` with `replace`. Only after leaving the page does it remove that recipe's query and run
  `invalidationMap.recipeWrite` (list and tags), so the page never refetches a recipe that is not there.
- **404 (already deleted):** toast "המתכון כבר נמחק", the dialog closes, same navigation and refresh.
- **Other failures:** the dialog stays open and shows the message under the text (the existing `ConfirmDialog` error line), and the button
  works again.
- **i18n** (`he.json`): `detail.delete.{action,title,description,confirm,cancel,done,gone}`. **API client** regenerated (`recipesDeleteRecipe`).
- `render-detail.tsx` (test helper) now also returns `router` and `queryClient` and mounts the `Toaster`.

## Decisions as agreed

204 with 404 for a missing recipe; editor and admin; ghost destructive button next to "עריכה", icon-only on phones; go back in history when
the visitor came from the app, otherwise `/`, with the recipe query removed and the list invalidated.

## Things to know

1. **Browser Forward after a delete** lands on the deleted recipe's URL and shows the existing "המתכון לא נמצא" page. Expected with the
   "one step back" choice.
2. **Photos (Story 3.7):** there are no photo files yet, so nothing is removed from disk here. 3.7 must delete a recipe's photo file when
   the recipe is deleted (and the image row, if it gets one).
3. **No undo.** Deleting is permanent, as the AC says; the dialog is the only safeguard.
4. **Step order in the header:** in RTL the button sits at the inline-end of "עריכה", so it is to its left. A destructive action next to the
   most common one is safe here because it needs a second confirmation with focus on "ביטול".
5. **Not verified:** a real phone, a screen reader pass, and a very slow or offline network during the delete (the pending state disables
   both dialog buttons, covered by `ConfirmDialog`'s own tests).

## Checks run

- `npm run verify` (lint, typecheck, test, build on all projects): 32/32 tasks succeeded. `npx nx format:check`: clean (also on the two
  new notes in `_bmad-output`).
- Backend: lint, typecheck, and pytest all green; new tests listed above.
- Frontend (`recipe-delete.spec.tsx`): not offered to a visitor; the dialog names the recipe and starts on "ביטול"; cancel calls nothing;
  delete goes back to `/?tag=dinner` with the filter, shows "המתכון נמחק", removes the recipe query and invalidates the list; a direct visit
  goes to `/` with `replace`; 404 shows "המתכון כבר נמחק"; a 500 keeps the dialog open with the message.
- **Initial JS (gzip, entry + modulepreload):** 155,120 B (151.5 KiB), +130 B against 3.4's 154,990 B. Budget 200 KB. There is still no
  `web:size` Nx target, so I summed the gzip sizes by hand. The delete code lives in the lazy `recipe-detail` chunk (7,995 B gzip); the
  generated client's `recipes/{recipe_id}` paths are not in the entry chunk.
- **Browser (scratch DB in the session scratchpad, seeded, one test editor; servers stopped afterwards):**
  - Desktop: with the filter `?q=אורז`, opened the recipe; the red ghost "מחיקה" sits next to "עריכה"; the dialog shows the text from the
    AC and focus is on "ביטול".
  - Cancel closed the dialog; the page stayed and all 11 recipes were still there.
  - Confirm: back on `/` with `?q=אורז` kept, toast "המתכון נמחק", the library shows "לא נמצאו מתכונים ל־'אורז'", and the API count went
    from 11 to 10.
  - Already deleted: deleted a recipe through the API while its page was open, then confirmed from the page; got the toast "המתכון כבר נמחק"
    and landed on the library with the filter kept.
  - 375 px: no horizontal scroll, the button is 44 x 44 px and icon-only, the dialog is 320 px wide with focus on "ביטול".

## Not in this story

Photos on delete (3.7), undo or soft delete, bulk delete.
