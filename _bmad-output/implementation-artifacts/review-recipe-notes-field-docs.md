```diff
diff --git a/_bmad-output/implementation-artifacts/deferred-work.md b/_bmad-output/implementation-artifacts/deferred-work.md
index bb08e28..bd0b81a 100644
--- a/_bmad-output/implementation-artifacts/deferred-work.md
+++ b/_bmad-output/implementation-artifacts/deferred-work.md
@@ -42,3 +42,9 @@
   summary: Decide how input/control boundaries meet WCAG 1.4.11 (3:1) before Input ships in 1.5 — the DESIGN.md `--border`/`--input` tokens are ~1.25:1 (light) and ~1.46:1 (dark) on the background.
   evidence: Measured from theme.css; DESIGN.md colours are fixed by the 1.4 spec, so changing them (or using a stronger focus/border treatment for inputs) is a design decision.
   resolved: Adi (2026-10-26) — scheduled into Story 1.5 as an AC (stronger `--input` border token, contrast-tested, Storybook preview for approval). Done in Story 1.5: `--input` light `#857f75`, dark `#7a726a`; `theme-contrast.spec.ts` checks 3:1 on background, card and popover; preview story "Foundations / Input border (for approval)".
+- source_spec: `_bmad-output/planning-artifacts/brainstorm-quick-wins.md`
+  summary: Search the library by ingredient names, not only titles (needs ingredient names in `RecipeSummary`, or a server-side search).
+  evidence: Adi (2026-10-26) wants it as a future feature, not now; it changes the summary shape (Story 1.6) and the filter function (Story 1.9), so decide it together with a larger-library plan.
+- source_spec: `_bmad-output/planning-artifacts/brainstorm-quick-wins.md`
+  summary: Open Graph link previews (title and photo when a recipe link is shared in WhatsApp), which needs server-set meta tags per recipe page in the production container.
+  evidence: Adi (2026-10-26) put it in the future; the SPA serves one HTML shell today, so it is a Story 6.x decision.
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index bb61edd..b5ccebe 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -66,6 +66,7 @@ development_status:
   3-5-reset-an-ingredient-to-its-original: backlog
   3-6-delete-a-recipe: backlog
   3-7-recipe-photos-upload-replace-remove: backlog
+  3-8-duplicate-a-recipe: backlog # stretch / optional: can be cut without affecting any other story
   epic-3-retrospective: optional

   epic-4: backlog
diff --git a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md
index 6dad705..c41e403 100644
--- a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md
+++ b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md
@@ -59,3 +59,7 @@ updated: 2026-10-26T11:23
 - (decision) 2026-10-26 Story 1.4 (Adi, "all your recommendations"): new lib `libs/i18n` (tag `type:i18n`) holds `he.json`, the i18next init and typed keys; depends on nothing; `type:app` and `type:feature` may import it, `type:ui` may not (i18next/react-i18next banned there). Hebrew literals outside `he.json` fail lint (specs exempt). shadcn arbitrary values are replaced with token utilities (ban stays unscoped); Rubik self-hosted from `@fontsource/rubik`; icons from `lucide-react`. Updated AD-2 and AD-33.
 - (decision) 2026-10-26 (Adi approved Storybook): Storybook 10.x on libs/ui-components via @nx/storybook (React + Vite builder); preview loads the theme CSS, global RTL decorator (dir=rtl + DirectionProvider), light/dark toolbar toggle, addon-a11y; one story per primitive/shared component; build-storybook in CI via nx affected (Story 1.5). Built Storybook published (e.g. GitHub Pages) and linked from the README (Story 6.5). Updated Testing rule and Stack.
 - (decision) 2026-10-26 Story 1.5 (Adi, "okay for all 3"): `AppProviders` lives in `apps/web/src/app/app-providers.tsx` (it needs i18n and ThemeProvider, which `type:ui` may not import) and also mounts the Toaster; the ui-components `Toaster` takes the theme as a `theme` prop from the app (no `next-themes`); stronger `--input` token light `#857f75` / dark `#7a726a`. Storybook 10.6.4 pinned exactly (`@nx/storybook` 24.0.0 to match the other Nx packages); the `@nx/storybook/plugin` infers `build-storybook` and CI runs it through `nx affected`. Hebrew sample copy is allowed in `*.stories.tsx` (lint exemption, colour ban stays).
+- (decision) 2026-10-26 (Adi, option B): recipes get a separate nullable `notes` text field next to the short `description` (filled from the source site on import). Notes are plain multi-line text, line breaks kept and never rendered as HTML, edited in a textarea ("הערות וטיפים") and shown in that section after the steps on the detail page; AI import leaves notes empty unless the source has its own. Docs updated: PRD data model and FR-5, addendum, epics (FR5, UX form fields, Stories 1.6, 1.10, 3.1, 5.2), spine, inventory.
+- (decision) 2026-10-26 (Adi): description max 500 chars, notes max 5,000, enforced by Pydantic; the recipe form shows a character counter for each. Added to PRD, epics (Stories 1.6, 3.1) and spine.
+- (decision) 2026-10-26 (Adi, units): only import converts. A deterministic table in the imports service (oz→g, lb→g, fl oz→ml, friendly rounding; cups and spoons unchanged) plus a °F→°C pass over step text rounded to 5; stored metric; nullable `source_amount`/`source_unit` on ingredients when converted (separate from FR-7 `original`); detail page toggle "הצג יחידות מקור". The metric/imperial display setting is post-MVP (deferred-work). PRD A-2 and FR-21, epics 1.6, 1.10, 5.2 and the spine updated.
+- (decision) 2026-10-26 (Adi, final units): no metric/imperial display setting at all (dropped). Converted recipes only get a "הצג מתכון מקורי" toggle (off by default) that shows original values; step text shows only °C by default and a converted step keeps its pre-conversion text in nullable `step.source_text`. Supersedes the earlier toggle name and bracketed-°F format.
diff --git a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
index b69cc9b..54f7ae2 100644
--- a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
+++ b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
@@ -229,6 +229,7 @@ flowchart LR
   - **Units:** `Unit` is one Python `StrEnum` of the PRD's English codes, used by every schema including `DraftRecipe` and published as an OpenAPI enum.
     - Hebrew labels live only in `he.json` (`units.<code>_one/_other`), and a test checks that every code has its labels.
     - The countable set (`unit, clove, slice, can, package`, rounded to the nearest ½) is defined once beside the enum.
+    - **Import conversion:** a deterministic table in the imports service (`oz→g`, `lb→g`, `fl oz→ml`, friendly rounding; cups and spoons unchanged) plus a °F→°C pass over step text (rounded to 5; a converted step keeps its pre-conversion text in `source_text`). It runs after the LLM returns, so the model never does the arithmetic, and it has its own unit tests. Everything is stored metric. A converted ingredient keeps `source_amount` and `source_unit` (`SourceUnit`: `oz`, `lb`, `fl_oz`), kept apart from the FR-7 `original`. The detail page shows originals only through the "הצג מתכון מקורי" toggle, for recipes that have any. There is no metric/imperial display setting, so the table needs no TypeScript twin.
   - **Read shapes:** read schemas embed `meal_type: {id, name}` and `tags: [{id, name}]`.
   - **Concurrency:** for the MVP, the last write wins [ASSUMPTION].

@@ -253,6 +254,7 @@ flowchart LR
   - **Timeouts:** `GET /api/imports/providers` (editor) returns `[{name, timeout_s}]`. The client aborts at `timeout_s + 5`, which replaces the UX's flat 60 s. The Vite proxy and uvicorn timeouts are set above the largest provider timeout.
   - **Progress:** phase text is client-timed and cosmetic. There is no streaming in the MVP.
   - **Errors:** import failures never return 422. They use these codes: `fetch_blocked`, `fetch_failed`, `fetch_too_large`, `no_recipe_found`, `llm_timeout`, `llm_unavailable`, `llm_quota`, `llm_invalid_output`, `import_cap_reached`, `provider_unavailable`.
+  - **Recipe text fields:** `description` (a short intro) and `notes` (free multi-line tips and remarks) are separate nullable text columns and schema fields, limited by Pydantic to 500 and 5,000 characters (the form shows a live counter). The UI shows `notes` as plain text with line breaks kept, never as HTML. `DraftRecipe` fills `description` from the source and leaves `notes` null unless the source has its own.
   - **Draft shape:** `DraftRecipe` has every field nullable, plus `missing_fields: list[str]` (the server is authoritative) and `photo_source_url`. Its tags use the AD-25 tag reference.
   - **Draft hand-off:** the draft reaches the form only through router state, never the URL, mapped by one `draftToFormValues()`. A reload with no state shows an empty form.
   - **Form values:** the form has its own `RecipeFormValues` type (the amount is a string, so it can hold "½"). Exactly two pure functions convert to and from it: `toFormValues()` and `toWritePayload()`. The second is validated by the generated write Zod.
diff --git a/_bmad-output/planning-artifacts/epics.md b/_bmad-output/planning-artifacts/epics.md
index 125daee..03371a0 100644
--- a/_bmad-output/planning-artifacts/epics.md
+++ b/_bmad-output/planning-artifacts/epics.md
@@ -23,7 +23,7 @@ FR1: The library lists every recipe as a card showing the title, meal type, tags
 FR2: Search filters recipes by title as you type (case-insensitive substring). When nothing matches, the library shows "no recipes found" with a way to clear the search.
 FR3: Filter by one meal type and by one or more tags (AND). The filters combine with search and survive navigating to a recipe and back.
 FR4: Create a recipe through a form with every content field. Ingredients and steps can be added, removed and reordered. The form validates inline, and the API rejects the same errors with 422. Leaving with unsaved changes asks for confirmation. The user can add, replace or remove the photo.
-FR5: The detail page shows all recipe content: photo, ingredients (amount, unit, name, note) and numbered steps. To-taste ingredients read "Salt — to taste". An unknown recipe id shows a not-found page.
+FR5: The detail page shows all recipe content: photo, ingredients (amount, unit, name, note), numbered steps and the recipe's notes after the steps. To-taste ingredients read "Salt — to taste". An unknown recipe id shows a not-found page.
 FR6: Edit a recipe with the same form as FR4; saving overwrites it in place and updates `updated_at`.
 FR7: The first change to an existing ingredient's amount or unit stores its original amount and unit. Later edits keep that first original. New ingredients get no original, and edits to the name or note alone don't create one.
 FR8: An ingredient that has an original shows the hint "originally {amount} {unit}" on the detail page and in the edit form. The hint is secondary, readable by screen readers, and scaled together with the amounts.
@@ -39,7 +39,7 @@ FR17: Import from a URL: schema.org JSON-LD first, falling back to the page text
 FR18: Import from pasted text through the LLM. Text without a recognisable recipe gives "No recipe found in this text".
 FR19: Review before saving. The import opens the create form prefilled, and nothing is saved until Save. Unfilled fields are flagged. Ingredients the LLM can't quantify become to-taste. An unmappable unit is left empty, with the original text kept in the note. The source URL is stored and shown. The imported photo can be kept or removed. Cancelling discards the draft.
 FR20: The import shows progress and can be cancelled. It stops at its engine's time limit (60 s hosted, about 180 s local). LLM errors are shown in readable form, and nothing is saved.
-FR21: Imports in another language produce a Hebrew draft. Amounts and units are preserved and mapped to the app's units, and the source URL is kept.
+FR21: Imports in another language produce a Hebrew draft. Amounts and units are mapped to the app's units, imperial units (oz, lb, fl oz) are converted to g and ml with the source value kept, °F in the steps becomes °C with the original step text kept, and the source URL is kept.
 FR22: Every recipe needs exactly one meal type and can have any number of tags. On create the form suggests a meal type. Tag input autocompletes and creates new tags inline, reusing an existing tag regardless of case.
 FR23: A management screen adds, renames and deletes meal types and tags. A rename applies everywhere. Deleting a tag asks for confirmation and shows how many recipes use it. A meal type that is still in use can't be deleted.
 FR24: Import pre-picks a meal type and suggests tags, preferring existing ones. A suggested new tag is created only if the user keeps it and saves.
@@ -145,7 +145,7 @@ UX-DR4: App shell. One top bar with no sidebar:
 - a "תגיות" button that opens a sheet (phone) or popover (desktop) of tag checkboxes, with the selected tags shown as removable chips
 - all state kept in the URL
   UX-DR12: Recipe form:
-- fields: title, description, meal type select, tag combobox (autocomplete, case-insensitive reuse, "יצירת תגית '{text}'"), servings, prep and cook time, source URL, photo (add, replace, remove, with an upload thumbnail and progress, limits shown beside the field)
+- fields: title, description, notes (a textarea for tips and remarks), meal type select, tag combobox (autocomplete, case-insensitive reuse, "יצירת תגית '{text}'"), servings, prep and cook time, source URL, photo (add, replace, remove, with an upload thumbnail and progress, limits shown beside the field)
 - ingredient rows (amount as text accepting ½ and ⅓, unit select, name, note; stacked on phone, one row from `sm`) with add, remove and up/down reorder, and Enter in the last row adding a row
 - hinted rows show "חזרה למקור"
 - step rows
@@ -362,6 +362,8 @@ So that the app has real data to show.

 - UUID ids
 - UTC timestamps
+- nullable `description` and `notes` text columns on `recipe` (`notes` holds free multi-line text for tips and personal remarks); the API limits them to 500 and 5,000 characters
+- nullable `source_amount` and `source_unit` columns on `ingredient` and a nullable `source_text` on `step`, set only when an import converted a unit or a temperature (separate from `original_*`, which FR-7 sets on edit)
 - nullable `created_by`/`updated_by` UUID columns (their foreign key to `user` is added in Story 2.1, when that table exists)
 - `ON DELETE CASCADE` on child rows
   **And** every connection has `PRAGMA foreign_keys=ON` and WAL enabled
@@ -373,8 +375,9 @@ So that the app has real data to show.
 **Then** it returns all `RecipeSummary` items, unpaginated, sorted by `created_at desc, id` (AD-26). Each summary has: id, title, meal_type `{id,name}`, tags `[{id,name}]`, total_minutes or null, photo or null, and created_at
 **And** `GET /api/recipes/{id}` returns the full `RecipeRead` (AD-20, AD-31), with:

-- ordered ingredients: `amount` as a JSON number or null, `unit` from the `Unit` enum or null, name, note, and `original` or null
-- ordered steps
+- `description` and `notes`, each a string or null
+- ordered ingredients: `amount` as a JSON number or null, `unit` from the `Unit` enum or null, name, note, `original` or null, and `source` (`{amount, unit}`, `unit` from `oz`, `lb`, `fl_oz`) or null
+- ordered steps, each with `source_text` or null
   **And** an unknown id returns 404 `{detail, code: "recipe_not_found"}` (AD-28)
   **And** operation IDs follow `{tag}_{function}`, enforced by a test (AD-19)
   **And** API tests cover both endpoints against a temporary database migrated with `alembic upgrade head`
@@ -430,6 +433,7 @@ So that I can quickly find what to cook (FR1, FR2, FR3).
 **Then** only recipes whose title contains the text remain (case-insensitive). The list updates as I type, using `useDeferredValue` and no network call, and the value is kept in `?q=` (UX-DR11)
 **And** with no matches I see "לא נמצאו מתכונים ל־'{q}'" with "ניקוי החיפוש", which clears both search and filter
 **And** a meal-type chip row ("הכל" plus the meal types) filters to one meal type, combines with search, and is kept in `?meal=<uuid>`
+**And** a "עד 30 דקות" chip keeps only recipes whose total time is known and at most 30 minutes, combines with search and the meal-type chips, and is kept in `?fast=1`; the test is part of the same pure filter function
 **And** after I open a recipe and go back, the search and filter are still applied
 **And** filtering is one pure function in `libs/recipe-domain`, with unit tests (AD-26, AD-32)
 **And** with 200 recipes, filtering takes under 100 ms per keystroke (NFR-3)
@@ -444,7 +448,8 @@ So that I can cook from it (FR5).

 **Given** a recipe exists
 **When** I open `/recipes/:id`
-**Then** I see the meal type, prep and cook time, the title in display style, the ingredient board, numbered steps, and the source link if there is one (UX-DR6, UX-DR10)
+**Then** I see the meal type, prep and cook time, the title in display style, the description under it if there is one, the ingredient board, numbered steps, and the source link if there is one (UX-DR6, UX-DR10)
+**And** when the recipe has notes, a "הערות וטיפים" section follows the steps and shows them as plain text with line breaks kept (never as HTML); with no notes, the section is absent
 **And** each `IngredientLine` shows:

 - the amount in quantity style, wrapped in `<bdi>`
@@ -452,7 +457,9 @@ So that I can cook from it (FR5).
 - the name and the note
 - for to-taste lines, "מלח — לפי הטעם"
   **And** the layout is one column on phone. From `lg`, the ingredient board sits in a sticky start column with the steps beside it (UX-DR20)
+  **And** when any ingredient has a `source` or any step has `source_text`, a "הצג מתכון מקורי" toggle appears (default off, kept for the visit only); recipes without converted values show no toggle. When on, converted ingredient lines read with their source value, e.g. "8 oz (227 גרם)", and converted steps show their original text beside the converted one; the FR-7 `original` hint is a separate thing and unaffected
   **And** `IngredientLine` already renders an `original` hint when the API sends one, so Epic 3 needs no layout change
+  **And** each ingredient and each step has a checkbox to tick it off while cooking; ticks are kept in this browser per recipe (localStorage, failures ignored), have a visible focus state and 44 px targets, and a "ניקוי סימונים" button clears them
   **And** an unknown id shows "המתכון לא נמצא" with a "חזרה לרשימה" link
   **And** a skeleton shows while loading, and the page renders in under 500 ms locally (NFR-3)
   **And** the route is lazy-loaded in its own chunk (AD-11)
@@ -477,6 +484,8 @@ So that I can cook for any group without doing the maths (FR11).
   **And** "חזרה ל־4" appears only when the value differs from the base, and it restores the base. A reload also returns to the base
   **And** `scaleAmount` and `formatAmount` live in `libs/recipe-domain` with 100% branch coverage. `IngredientLine` uses them for both the amount and any original hint (AD-32, NFR-2)
   **And** while the detail page is open it requests a screen wake lock, and silently ignores a refusal (UX-DR22)
+  **And** `formatAmount` shows common fractions as ½, ⅓, ⅔, ¼ and ¾ (with a whole part, e.g. "1½") when the value is within 0.01 of one, inside `<bdi>`, and otherwise keeps the FR11 decimals; 100% branch coverage includes these cases
+  **And** a "שיתוף" button shares the recipe as plain text through the Web Share API, or copies it to the clipboard when sharing is unavailable, confirming with the toast "הועתק". The text is the title, the ingredients at the current servings, the steps and the page link, in Hebrew, built by one pure function in `libs/recipe-domain` with unit tests

 ## Epic 2: Accounts, login and roles

@@ -600,9 +609,9 @@ So that my recipes live in one place (FR4).

 **Given** I'm signed in as an editor
 **When** I tap "מתכון חדש" (top bar, or "+" on phone)
-**Then** `/recipes/new` shows a form with these fields: title, description, meal type (required select), servings, prep and cook time, source URL (`dir="ltr"`), plus ingredient rows (amount as a number, unit select with Hebrew labels for the `Unit` enum, name, note) and step rows, with add and remove buttons
+**Then** `/recipes/new` shows a form with these fields: title, description, notes (a multi-line textarea, optional, "הערות וטיפים"), each of description and notes with a live character counter against its limit (500 and 5,000), meal type (required select), servings, prep and cook time, source URL (`dir="ltr"`), plus ingredient rows (amount as a number, unit select with Hebrew labels for the `Unit` enum, name, note) and step rows, with add and remove buttons
 **And** the form uses React Hook Form with its own `RecipeFormValues` type and the two mapping functions `toFormValues` and `toWritePayload`, validated by the generated write Zod schema (AD-22)
-**And** `POST /api/recipes` (editor) validates with Pydantic (`extra="forbid"`, at least one ingredient and one step, servings 1–100, title 1–120). It stores amounts quantized to 3 decimals, sets `created_by` and `updated_by` to me, and returns the `RecipeRead` (AD-20, AD-31)
+**And** `POST /api/recipes` (editor) validates with Pydantic (`extra="forbid"`, `description` up to 500 and `notes` up to 5,000 characters, at least one ingredient and one step, servings 1–100, title 1–120). It stores amounts quantized to 3 decimals, sets `created_by` and `updated_by` to me, and returns the `RecipeRead` (AD-20, AD-31)
 **And** invalid input returns 422, and the errors appear on the matching fields, mapped by `loc` and `type` to Hebrew messages (AD-9, AD-28)
 **And** after saving I land on the new recipe's detail page with the toast "המתכון נשמר", and the library list is invalidated (AD-19, UX-DR16)
 **And** the editor empty state in the library shows "מתכון חדש" (UX-DR17)
@@ -710,6 +719,20 @@ So that recipes look appetising in the library and on the detail page (FR4 photo
 **And** `/media/*` is served by FastAPI and is never answered by the SPA fallback. Images are lazy-loaded with width and height set (NFR-11)
 **And** the seed adds openly licensed sample photos with their credits

+### Story 3.8: Duplicate a recipe (stretch, can be cut)
+
+As an editor,
+I want to duplicate a recipe and edit the copy,
+So that a variation takes seconds (FR4).
+
+**Acceptance Criteria:**
+
+**Given** a recipe's detail page
+**When** I tap "שכפול"
+**Then** the create form opens prefilled with that recipe's title (with " (עותק)" added), description, notes, meal type, servings, times, ingredients, steps and tags, through router state like the import draft (AD-22), and nothing is saved until "שמירה"
+**And** the copy has no `original` hints, no photo and no `source` values, so it starts clean, and the source URL is kept
+**And** the story is optional: it can be dropped without affecting any other story
+
 ## Epic 4: Organise with meal types and tags

 Editors manage the meal-type list and the tags, and everyone can filter the library by tags.
@@ -777,7 +800,9 @@ So that I don't retype recipes by hand (FR18, FR21, FR24).
 **Given** I'm signed in as an editor
 **When** I open "ייבוא", choose the "הדבקת טקסט" tab, paste text and submit (the page lives in a new `libs/feature-import`, tag `type:feature`, as a lazy subpath export; AD-2, AD-11)
 **Then** `POST /api/imports/text` (editor) calls the default provider through the `LlmProvider` registry, which in this story has the `ollama` and `fake` adapters and returns a `DraftRecipe` validated by Pydantic (AD-12, AD-22)
-**And** the draft is in Hebrew (translated if the source is in another language), its units are mapped to the `Unit` enum, unquantifiable ingredients are to-taste, and unmappable units are empty with the original text kept in the note (FR19, FR21)
+**And** the draft is in Hebrew (translated if the source is in another language), its units are mapped to the `Unit` enum, imperial units are converted by the deterministic table (oz→g, lb→g, fl oz→ml, friendly rounding; cups and spoons unchanged) with `source_amount`/`source_unit` kept, unquantifiable ingredients are to-taste, and units that are still unmappable are empty with the original text kept in the note (FR19, FR21)
+**And** a deterministic pass rewrites °F temperatures in the step text to °C, rounded to the nearest 5 (350°F becomes "180°C"), and keeps the unconverted step text as `source_text` for the "הצג מתכון מקורי" toggle; the conversions live in code with unit tests, never in the model's output (FR21)
+**And** the draft's description comes from the source's description when it has one, and its notes stay empty unless the source has notes or tips of its own (FR19)
 **And** the draft pre-picks a meal type and suggests tags, preferring existing ones (FR24)
 **And** the create form opens prefilled through router state (never the URL), via `draftToFormValues()`, and nothing is saved until "שמירה" (AD-22)
 **And** text with no recipe returns `no_recipe_found` ("לא נמצא מתכון בטקסט הזה"), and the text stays for editing
diff --git a/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/addendum.md b/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/addendum.md
index 2270a65..26b0c56 100644
--- a/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/addendum.md
+++ b/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/addendum.md
@@ -36,9 +36,9 @@ Decided: shared libraries live under `libs/` (Adi, 2026-10-26).

 ## Draft data model (original PRD, updated for the new requirements)

-- **Recipe:** id, title, description?, category, base_servings, prep_time_minutes?, cook_time_minutes?, created_at, updated_at.
-- **Ingredient:** id, recipe_id, position, name, amount? (null = to taste), unit?, note?, **original_amount?**, **original_unit?** (set on first change — FR-7).
-- **InstructionStep:** id, recipe_id, step_number, description.
+- **Recipe:** id, title, description?, notes?, category, base_servings, prep_time_minutes?, cook_time_minutes?, created_at, updated_at.
+- **Ingredient:** id, recipe_id, position, name, amount? (null = to taste), unit?, note?, **original_amount?**, **original_unit?** (set on first change — FR-7), **source_amount?**, **source_unit?** (set only when converted on import — FR-21; separate from the FR-7 original).
+- **InstructionStep:** id, recipe_id, step_number, description, source_text? (the pre-conversion text, set only when an import converted a temperature).

 Changes vs. the original: prep/cook time optional; amount optional (to-taste); explicit ingredient position; original-value fields; ID type to be decided in architecture (UUID vs. integer).

diff --git a/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/prd.md b/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/prd.md
index 35e4847..dcd0bf3 100644
--- a/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/prd.md
+++ b/_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/prd.md
@@ -78,9 +78,9 @@ FR IDs are global and stable. Each FR lists its acceptance criteria (AC).

 ### Recipe content (applies to F2–F5)

-A recipe has: title (required, 1–120 chars), optional description, a meal type (required, exactly one, from an owner-editable list seeded with Breakfast, Brunch, Lunch, Dinner, Dessert, Side, Drink, Other), any number of tags (optional, owner-managed free tags such as "BBQ", "Finger food", "Party"), base servings (required, integer 1–100), optional prep time and cook time (minutes), an optional source URL, an optional photo (one per recipe), an ordered list of ingredients (at least one) and an ordered list of instruction steps (at least one).
+A recipe has: title (required, 1–120 chars), optional description (a short intro, up to 500 chars), optional notes (free multi-line text for tips and personal remarks, up to 5,000 chars), a meal type (required, exactly one, from an owner-editable list seeded with Breakfast, Brunch, Lunch, Dinner, Dessert, Side, Drink, Other), any number of tags (optional, owner-managed free tags such as "BBQ", "Finger food", "Party"), base servings (required, integer 1–100), optional prep time and cook time (minutes), an optional source URL, an optional photo (one per recipe), an ordered list of ingredients (at least one) and an ordered list of instruction steps (at least one).

-An ingredient has: name (required), an optional amount (positive number), an optional unit (from a fixed list: g, kg, ml, l, tsp, tbsp, cup, unit, pinch, clove, slice, can, package), and an optional note (e.g. "finely chopped"). An ingredient without an amount is a **to-taste** ingredient (e.g. "Salt — to taste").
+An ingredient has: name (required), an optional amount (positive number), an optional unit (from a fixed list: g, kg, ml, l, tsp, tbsp, cup, unit, pinch, clove, slice, can, package), and an optional note (e.g. "finely chopped"), and, when it was converted on import, its source amount and unit (e.g. 8 oz). An ingredient without an amount is a **to-taste** ingredient (e.g. "Salt — to taste").

 ### F1. Recipe library

@@ -104,7 +104,7 @@ An ingredient has: name (required), an optional amount (positive number), an opt

 ### F3. View recipe

-- **FR-5 — Detail page.** Shows all recipe content (including the photo, if any), ingredients in order with amount, unit, name and note, and numbered steps.
+- **FR-5 — Detail page.** Shows all recipe content (including the photo, if any), ingredients in order with amount, unit, name and note, numbered steps, and the recipe's notes in their own section after the steps (line breaks kept) when there are any.
   - AC: To-taste ingredients render as "Salt — to taste".
   - AC: Opening a recipe ID that does not exist shows a not-found page with a link back to the library.

@@ -179,12 +179,13 @@ Owner-only (FR-16 applies). Import never saves anything by itself: it produces a
   - AC: The recipe's main photo is taken from the page when available (schema.org `Recipe.image` first, then the page's `og:image`). How photos are stored (local copy vs. link to the source) is decided in the architecture step.
 - **FR-18 — Import from pasted text.** The owner pastes raw recipe text; the LLM extracts a draft recipe in the same format.
   - AC: Text with no recognizable recipe gives "No recipe found in this text" and no draft.
-- **FR-21 — Hebrew drafts.** Imports from pages or text in another language (e.g. English) produce a draft translated to Hebrew (title, description, ingredient names and notes, steps). Amounts and units are preserved and mapped to the app's unit list, and the source URL is kept.
-  - AC: Importing an English recipe yields a Hebrew draft whose amounts and units match the source.
+- **FR-21 — Hebrew drafts.** Imports from pages or text in another language (e.g. English) produce a draft translated to Hebrew (title, description, ingredient names and notes, steps). Amounts and units are mapped to the app's unit list; imperial units (oz, lb, fl oz) are converted to g and ml by a fixed table with friendly rounding (cups and spoons are kept), and the source amount and unit are kept on the ingredient. Fahrenheit temperatures in the steps become Celsius, rounded to 5 ("180°C"), and a converted step keeps its pre-conversion text. A recipe with any converted ingredient or step shows a "הצג מתכון מקורי" toggle (off by default) that reveals the original values. The source URL is kept.
+  - AC: Importing an English recipe yields a Hebrew draft whose amounts and units match the source, with imperial units converted (8 oz becomes 227 g and keeps "8 oz" as its source value).
+  - AC: A step that says "350°F" reads "180°C" in the draft and keeps the original step text; the conversion is deterministic code, not model arithmetic.
 - **FR-19 — Review before save.** A successful import opens the recipe create form (FR-4) pre-filled with the draft; nothing is saved until the owner clicks *Save*.
   - AC: The draft goes through the same validation as FR-4; fields the import could not fill (e.g. meal type, servings) are left empty and flagged for the owner to complete.
   - AC: Ingredients the import could not quantify become to-taste ingredients rather than invented amounts.
-  - AC: Units are mapped to the app's unit list; an unmappable unit is left empty and the original text is kept in the ingredient note.
+  - AC: Units are mapped to the app's unit list, imperial units are converted (FR-21); a unit that is still unmappable is left empty and the original text is kept in the ingredient note.
   - AC: The source URL (if any) is stored with the saved recipe and shown on its detail page as a link.
   - AC: An imported photo is shown in the review form, where the owner can keep or remove it before saving.
   - AC: Cancelling the form discards the draft.
@@ -246,5 +247,5 @@ These are kept so the architecture does not rule them out. None has a committed
 - **C-1 — Admin-managed accounts.** The first admin is created from the command line; every other account is created by an admin. Visitors are anonymous and read-only. Daily AI import limits are shared by all users.
 - **C-2 — Learning project.** Technology choices favor learning React and FastAPI (Adi's background is Angular / NestJS). The stack and architecture are recorded in `addendum.md` and finalized in the architecture step.
 - **A-1 — Data volume.** At most a few hundred recipes; one embedded database is enough.
-- **A-2 — Units.** A fixed unit list (§6) is enough for the MVP; no unit conversion.
+- **A-2 — Units.** A fixed unit list (§6) is enough for the MVP. The only conversion is on import (FR-21): imperial weights and volumes become g and ml by a fixed table, and the source value is kept for a "show the original recipe" toggle. There is no metric/imperial display setting.
 - **A-3 — Delete is permanent.** No trash or undo in the MVP.
diff --git a/_bmad-output/planning-artifacts/ui-component-inventory.md b/_bmad-output/planning-artifacts/ui-component-inventory.md
index 0c1d997..fe3fc64 100644
--- a/_bmad-output/planning-artifacts/ui-component-inventory.md
+++ b/_bmad-output/planning-artifacts/ui-component-inventory.md
@@ -25,7 +25,7 @@ Used as shadcn ships them, styled only through the theme variables (DESIGN.md).
 | AlertDialog                   | confirms: block/reset user, delete recipe, unsaved changes, delete tag | users, recipe, tags                | **UI kit story**                                |
 | Select                        | user role; meal type; ingredient unit                                  | users, recipe form                 | **UI kit story**                                |
 | Table                         | users list                                                             | users                              | **UI kit story**                                |
-| Textarea                      | recipe description, steps; pasted import text                          | recipe form, import                | 3.1 (just in time)                              |
+| Textarea                      | recipe description, notes, steps; pasted import text                         | recipe form, import                | 3.1 (just in time)                              |
 | Popover + Command             | tag combobox with "יצירת תגית '{text}'"                                | recipe form, import review         | 3.3 (just in time)                              |
 | Sheet + Checkbox              | tag filter (sheet on phone, popover on desktop)                        | library                            | 4.2 (just in time)                              |
 | Tabs                          | import: "קישור" / "הדבקת טקסט"                                         | import                             | 5.2 (just in time)                              |
```
