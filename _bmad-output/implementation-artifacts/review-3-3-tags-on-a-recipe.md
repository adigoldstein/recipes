# Review: Story 3.3 Tags on a recipe, with inline new tags

Working tree on branch `claude/story-3-3-recipe-tags` (cut from `main` at 69ed5fa). Not committed; for Adi's review. Commit
trailer on "c p": `Claude-Session: https://claude.ai/code/session_01Uibg2JgePptwJLiUbinmzh`.

## What it does

- **`TagPicker`** (`libs/ui-components/src/components/tag-picker.tsx`, with spec and stories): shadcn's combobox pattern, built on a new
  `ui/popover.tsx` and `ui/command.tsx` (cmdk). Props in, callbacks out; strings come in as `labels`. The closed field looks like our
  inputs. Tapping it opens a list **as wide as the field with ALL tags before any typing** (the order it is given: pinned first, then
  by name), a search box on top, a ✓ on chosen tags (picking a chosen tag again removes it), and a row "יצירת תגית '…'" when the
  cleaned-up text matches no existing tag. Chosen tags are 44 px removable chips under the field; Backspace in an empty search box removes
  the last one. Matching is ours (`shouldFilter={false}`), case-insensitive.
- **Form:** `RecipeFormValues.tags: {id?, name}[]`. `toWritePayload` sends `{id}` for an existing tag and `{name}` for a new one;
  `toFormValues` fills them from `recipe.tags` (ready for Story 3.4). The options come from `GET /api/tags` (the same query the
  library uses). If that call fails the picker still works: a typed name is sent and the server reuses an existing tag of that name.
  The field is after "קישור למקור", labelled "תגיות" (not required).
- **`normalizeTagName` / `TAG_NAME_MAX_LENGTH`** in `libs/recipe-domain` (unit-tested): NFC, trim, collapse whitespace, 40 characters;
  the client's copy of the server rule (AD-24), used only to decide "does this typed name already exist?". The search box has
  `maxLength=40`.
- **Invalidation:** `invalidationMap.recipeWrite` now also invalidates the tags list, so a tag created by a save shows in the library
  filter and in the next form without a reload (checked in the browser).
- **Planning:** `epics.md` has the optional Story 7.4 "Quick-pick chips for pinned tags in the recipe form" (split out of 3.3, per Adi),
  and `sprint-status.yaml` lists it as backlog; 3-3 is `in-progress` (set it to `review`/`done` on your word).
- **New dependency:** `cmdk` 1.1.1 (exact; `package.json` and the lock file). It is only in the lazy `recipe-new` chunk.

## Already done in 3.1 (no backend change)

`tags: [{id} | {name}]` in the write payload, name normalization, case-insensitive reuse (unique index on `lower(name)`), creation inside the
recipe's transaction (no orphan tag when the save fails), 404 `tag_not_found`, the import-linter contracts, and tags on cards and the
detail page. The backend tests already cover reuse ("  party " reuses "Party"; `test_create_resolves_ids_and_names`) and no orphan after
a failed save (`test_unknown_tag_id_rolls_back_the_recipe`), so I added none.

## Things to know

1. **The closed field is a button, not a combobox role.** cmdk's search input is already `role="combobox"`; two on one screen confuse screen
   readers, so the field is a button with `aria-haspopup="listbox"`, `aria-expanded` and `aria-controls`. Its accessible name is the
   FormField's label "תגיות".
2. **Desktop width:** the list is as wide as the field, which is the whole form column (about 1,000 px at 1100 px). Consistent with the other
   fields but wide for a list of words. Easy to cap with a `max-w-*` on the picker if Adi prefers.
3. **Phone keyboard:** not testable here. The list opens below the field; the on-screen keyboard may cover part of it. The list is
   capped at 15 rem and scrolls inside itself. The fallback would be a bottom sheet (another dependency, Adi's call).
4. **Initial JS (gzip, entry + modulepreload):** 85,311 + 35,638 + 32,242 + 1,410 = **154,601 B (151.0 KiB)**, +1,793 B against 3.2's 152,808 B.
   The chunk split moved `createLucideIcon` (35.6 KB) and `react-dom` into their own preloaded chunks; `cmdk` is not in the entry
   (only `recipe-new`, now 18,274 B gzip, was 9,771 B). Budget 200 KB.
5. **Dark mode:** a popover that was just opened looks see-through for about 100 ms (the fade-in); it is solid after.
6. **Tests that find the picker** use `getByLabelText('תגיות')`, because the label names the button.
7. **Not verified:** a real phone keyboard, a screen-reader pass, and a very large tag list (the list is not virtualized; fine for tens of tags).

## Checks run

- `npm run verify`: 32 tasks succeeded. `nx format:check`: clean (I also had to prettier-format `package.json` and `package-lock.json` after
  `npm install cmdk`).
- New tests: `tag-picker.spec.tsx` (12: opens with all tags in order, filters case-insensitively, adds by id with ✓, toggles off, create row
  with cleaned text, no create row for an existing name in any case or spacing, no duplicate new tag, chip remove, Backspace, keyboard
  arrows/Enter/Escape, empty list, field wiring); `normalize-tag-name.spec.ts`; mapper tests for tags in `recipe-form-values.spec.ts`; form tests in
  `recipe-new.spec.tsx` (list on open, existing by id and new by name in the payload, no create row for an existing name, tag list that
  fails to load, tag change counts as unsaved, tags list invalidated after save); `invalidationMap` spec.
- **Browser check, scratch DB** (`…/scratchpad/scratchdb`, my API on :8001 and a static server on :4301; Adi's :8000 and :4200 untouched): at
  375 px (dark) the tags field sits under "קישור למקור", opens with the 13 pinned tags and then מסיבות, על האש, פינגר פוד; picking "ערב" and
  creating "גרילים   חדשים" showed one create row with the text cleaned to "גרילים חדשים"; the save created the recipe with both tags and
  one new tag (17 tags in total); opening a second form (client navigation, no reload) listed the new tag. At 1100 px the list is the width of the
  field. Storybook (light and dark, 375 px, long Hebrew name, many tags): looked at in the browser. Both scratch servers stopped; my
  Storybook is still running on :6006 so Adi can look at it.

## Files

UI kit: `libs/ui-components/src/components/{tag-picker.tsx,tag-picker.spec.tsx,tag-picker.stories.tsx}`, `ui/{popover.tsx,command.tsx}`, `src/index.ts`.
Domain: `libs/recipe-domain/src/{normalize-tag-name.ts,normalize-tag-name.spec.ts,index.ts}`.
Data: `libs/data-access/src/{invalidation.ts,index.spec.ts}`.
Feature: `libs/feature-recipes/src/form/{recipe-form.tsx,recipe-form-values.ts,recipe-form-validation.ts}` (+ specs), `routes/recipe-new.spec.tsx`, `testing/server.ts`.
Strings: `libs/i18n/src/he.json` (`recipeForm.tags`). Dependencies: `package.json`, `package-lock.json`.
Tracking: `epics.md` (Story 7.4), `sprint-status.yaml`, this file.
