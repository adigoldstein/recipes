---
title: "Bite & Board PRD"
status: final
created: 2026-10-26
updated: 2026-10-26
source: docs/prd.md
---

# Bite & Board — Product Requirements

## 1. Overview

**What it is.** Bite & Board is a personal recipe web app: a place to keep recipes, find them quickly, adjust them to taste, and scale them to the number of people being cooked for.

**Who it is for.** Adi, cooking at home, plus a few people Adi trusts (family, friends). Anyone can browse the recipes without logging in. Only signed-in users can change them. Adi is the admin and creates the other accounts; there is no public sign-up.

**Why it exists.** Two purposes, equally weighted:

1. **A recipe site Adi actually uses.** Recipes today live in bookmarks, screenshots and memory; quantities get tweaked over time and the tweaks are lost.
2. **A learning and portfolio project.** Adi is an Angular / NestJS developer using this project to learn React and FastAPI, and to show prospective employers a cleanly architected, well-tested full-stack app. Code and architecture quality are product requirements here, not nice-to-haves (see §7).

## 2. Goals and Success Criteria

| Goal | Success criterion |
|---|---|
| Recipes in one place | Adi can add, find, edit and delete recipes without touching the database or code. |
| Safe to show publicly | Visitors can browse, but only signed-in editors and the admin can create, edit or delete. |
| Recipes fit Adi's taste | Adi can change any quantity and still see what the original recipe said. |
| Cook for any group size | Any recipe can be viewed for any number of servings, with correct quantities. |
| Interview-worthy codebase | The repo passes lint, type-check and tests in CI; a reviewer can follow the architecture from the README in under 10 minutes. |
| Learning | Adi builds the React and FastAPI parts with AI support, and can explain every architectural choice. |

**Counter-metric.** Scope creep: if a post-MVP feature (§8) starts before the MVP is complete and deployed locally, the portfolio goal is at risk.

## 3. Non-Goals

- **Open multi-user.** No public sign-up page, no social login, no password reset by email, no per-user private recipes. Accounts are created by the admin (F8).
- Social features: sharing, comments, ratings, following.
- Nutrition data, calorie tracking, meal planning calendars.
- Native mobile apps (the web app must work on a phone browser — see NFR-4).
- Monetization of any kind.

## 4. Scope

**MVP (first complete, showable version):**

- Recipe library: list, search and filter (F1)
- Owner-managed tags, with pinned quick-filter tags (F10)
- Create, view, edit and delete recipes (F2–F5)
- Original-value hints on edited quantities (F4)
- Serving scaling (F6)
- Seed data for a realistic demo (F7)
- Users and roles: admin + editors, email + password login; browsing is public, changes require login (F8)
- AI recipe import from a URL or pasted text, reviewed before saving (F9)
- Runs locally with one command (NFR-6)

**Post-MVP candidates** (not committed; see §8): event menus, shopping list, further AI features such as smart ingredient substitution, public deployment.

## 5. User Journeys

**UJ-1 — Saving a new recipe.** Adi finds a shakshuka recipe online, opens Bite & Board, clicks *New recipe*, types the title, adds the tags *Breakfast* and *Brunch*, sets 4 servings, adds six ingredients and four steps, and saves. The recipe appears at the top of the library.

**UJ-2 — Making it personal.** After cooking it twice, Adi thinks it needs more cumin and less salt. Adi opens the recipe, clicks *Edit*, changes cumin from 1 tsp to 2 tsp and salt from 1 tsp to ½ tsp, and saves. From now on the recipe shows *2 tsp cumin* with a small hint *originally 1 tsp*. Months later, wondering whether the original was better, Adi resets cumin to the original value with one click.

**UJ-3 — Cooking for a crowd.** Friends are coming over: 10 people. Adi opens the lasagna recipe (base 4 servings), sets servings to 10, and every quantity updates instantly. Eggs show as *5*, not *5.000*. "Salt — to taste" stays as it is.

**UJ-4 — Finding a recipe.** Adi has 60 recipes, types "chick" into the search box and sees the chickpea curry and the roast chicken, then narrows the list by tapping the pinned *Dinner* tag.

**UJ-5 — Cleaning up.** A recipe Adi tried once was bad. Adi deletes it, confirms in a dialog, and it is gone from the library.

**UJ-6 — Visitor, editor and admin.** A recruiter opens the app from Adi's CV and browses recipes and scales one to 6 servings, but sees no *New*, *Edit* or *Delete* buttons. Adi clicks *Log in*, enters email and password, and the editing controls appear. Adi opens *Users*, adds an editor account for their partner with a starting password, and the partner logs in and adds a recipe. A week later the session has expired and Adi logs in again.

**UJ-7 — Importing from the web.** Adi finds a great focaccia recipe on a cooking site, copies the URL, clicks *Import*, and pastes it. A few seconds later the recipe form opens pre-filled: title, 8 servings, ingredients with amounts and units, and steps. The import read "a pinch of salt" as amount 1, unit pinch; the import suggested the existing tag *Bakery* and proposed a new tag *Party*, which Adi accepts before saving. Another site blocks the import, so Adi copies the recipe text from the page, pastes it into the *Paste text* tab instead, and gets the same pre-filled form.

## 6. Features and Functional Requirements

FR IDs are global and stable. Each FR lists its acceptance criteria (AC).

### Recipe content (applies to F2–F5)

A recipe has: title (required, 1–120 chars), optional description (a short intro, up to 500 chars), optional notes (free multi-line text for tips and personal remarks, up to 5,000 chars), any number of tags (optional, 0..n, from one owner-managed list; some are pinned and seeded, such as Breakfast, Brunch, Lunch, Dinner, Snack, Main, Side, Starter/Salad, Soup, Pastry, Dessert, Drink, Sauce/Spread, and others are free tags such as "BBQ", "Finger food", "Party"), base servings (required, integer 1–100), optional prep time and cook time (minutes), an optional source URL, an optional photo (one per recipe), an ordered list of ingredients (at least one) and an ordered list of instruction steps (at least one).

An ingredient has: name (required), an optional amount (positive number), an optional unit (from a fixed list: g, kg, ml, l, tsp, tbsp, cup, unit, pinch, clove, slice, can, package), and an optional note (e.g. "finely chopped"), and, when it was converted on import, its source amount and unit (e.g. 8 oz). An ingredient without an amount is a **to-taste** ingredient (e.g. "Salt — to taste").

### F1. Recipe library

- **FR-1 — List recipes.** The library shows all recipes as cards with title, up to 2 tags plus a "+N" for the rest, total time (prep + cook, if known) and the photo if there is one, newest first.
  - AC: With 0 recipes, an empty state with a *New recipe* call to action is shown.
  - AC: With 60+ recipes the list loads in under 1 second locally (NFR-3).
- **FR-2 — Search.** A search box filters recipes by title, case-insensitive substring match, as the user types.
  - AC: "chick" matches "Chickpea Curry" and "Roast Chicken"; it does not match "Lasagna".
  - AC: No matches shows a "No recipes found" message with a way to clear the search.
- **FR-3 — Filter by tags.** The user can filter by one or more tags (a recipe must have all selected tags, AND). The pinned tags are shown as a quick-filter chip row that scrolls horizontally, and a "more tags" button opens every tag; filters and search combine.
  - AC: Selecting the pinned tag *Dinner* with search "chick" shows only recipes tagged *Dinner* whose title contains "chick"; adding the tag *BBQ* narrows it further to recipes that have both tags.
  - AC: Search text and filter survive navigating to a recipe and back.

### F2. Create recipe

- **FR-4 — Create.** The user creates a recipe through a form with all fields from *Recipe content*, adding, removing and reordering ingredients and steps.
  - AC: Saving a valid recipe creates it and navigates to its detail page.
  - AC: Invalid input (e.g. empty title, servings 0, no ingredients) shows inline field errors and does not save. The same rules are enforced by the API (an invalid request returns HTTP 422 with field-level errors).
  - AC: Leaving the form with unsaved changes asks for confirmation.
  - AC: The owner can add, replace or remove the recipe's photo by uploading an image (one per recipe, also in edit). Allowed types and size limits are shown beside the field; storage and resizing are decided in the architecture step.

### F3. View recipe

- **FR-5 — Detail page.** Shows all recipe content (including the photo, if any), ingredients in order with amount, unit, name and note, numbered steps, and the recipe's notes in their own section after the steps (line breaks kept) when there are any.
  - AC: To-taste ingredients render as "Salt — to taste".
  - AC: Opening a recipe ID that does not exist shows a not-found page with a link back to the library.

### F4. Edit recipe with original-value hints

- **FR-6 — Edit.** The user edits any part of a recipe using the same form as FR-4; saving overwrites the recipe in place (no versions).
  - AC: Same validation and unsaved-changes behavior as FR-4.
  - AC: The recipe's *updated* timestamp changes on save.
- **FR-7 — Remember the original quantity.** The first time an existing ingredient's amount or unit is changed, the system keeps its original amount and unit.
  - AC: Changing cumin from 1 tsp → 2 tsp → 3 tsp keeps *1 tsp* as the original (the first saved value, not the previous one).
  - AC: Ingredients added during an edit have no original value and show no hint.
  - AC: Changing only the name or note of an ingredient does not create a hint.
- **FR-8 — Show the hint.** Wherever an ingredient with a stored original is shown (detail page and edit form), a subtle hint reads "originally {amount} {unit}".
  - AC: The hint is visually secondary to the current value and readable by screen readers.
  - AC: When scaling (F6) is active, the hint is scaled by the same ratio.
- **FR-9 — Reset to original.** In the edit form, each hinted ingredient has a *Reset to original* action that restores the original amount and unit and removes the hint once saved.
  - AC: Resetting and saving makes the ingredient indistinguishable from never having been edited.

### F5. Delete recipe

- **FR-10 — Delete.** The user deletes a recipe from its detail page after confirming in a dialog that names the recipe.
  - AC: Cancel leaves the recipe untouched.
  - AC: After confirming, the recipe, its ingredients and steps are permanently removed, and the user returns to the library.
  - AC: Deleting a recipe that no longer exists returns HTTP 404 and the UI shows a non-blocking message.

### F6. Serving scaling

- **FR-11 — Scale servings.** On the detail page the user sets a target number of servings (1–100) and all ingredient amounts update immediately, without a page reload or server call.
  - AC: Scaled amount = base amount × target servings ÷ base servings.
  - AC: To-taste ingredients are never scaled.
  - AC: Display rounding: whole numbers show without decimals ("5", not "5.000"); otherwise at most 2 significant decimals ("1.5", "0.33"); `unit`-type ingredients (eggs, cloves) are shown to the nearest of ¼ ⅓ ½ ⅔ ¾ (with a whole part, e.g. 1⅓), minimum ¼ (⅓ and ⅔ display as 0.33 and 0.67 until fraction glyphs ship).
  - AC: Scaling is view-only — it never changes the saved recipe. Reloading the page returns to base servings.
  - AC: A *Reset* control returns to base servings.

### F7. Demo seed data

- **FR-12 — Seed.** A single command loads about 10 realistic recipes, covering every pinned tag and several free tags, at least one to-taste ingredient, and at least one ingredient with an original-value hint.
  - AC: Running the seed on an empty database produces the demo set; running it again does not create duplicates.

### F8. Users, roles and login

There are three access levels. A **visitor** is not logged in and can only read: list, search, view and scale. An **editor** has an account and can also create, edit, reset, delete and import recipes, upload photos, and manage tags. The **admin** can do everything an editor can, and also manages users. In this PRD, "the owner" in F2–F10 means any signed-in user (an editor or the admin). Recipes form one shared library: every editor can edit every recipe, and each recipe records who created it and who last updated it.


- **FR-13 — Create the admin account.** A command-line command creates the first admin account from an email and a password. There is no sign-up page.
  - AC: Running it when an admin already exists fails with a clear message (or, with an explicit flag, changes that admin's password).
  - AC: The password is stored only as a salted hash, never in plain text, and is never returned by any API.
  - AC: Passwords shorter than 8 characters are rejected.
- **FR-14 — Log in.** A login page takes email and password. On success the backend issues a JWT and the UI shows the controls for the user's role.
  - AC: Wrong email or wrong password gives the same generic "Invalid email or password" message.
  - AC: The token expires after a fixed period (default 7 days); after expiry, the next protected action sends the user to the login page and returns them to where they were after logging in.
- **FR-15 — Log out.** A *Log out* action ends the session in the UI; editing controls disappear.
- **FR-16 — Public vs. protected.** Listing, searching, viewing and scaling recipes (FR-1–FR-3, FR-5, FR-11) work without login. Create, edit, reset-to-original, delete, import, photo upload and tag management (FR-4, FR-6–FR-10, F9, F10) require an editor or admin session. User management (FR-25–FR-27) requires the admin role.
  - AC: Calling a protected API endpoint without a valid token returns HTTP 401 and changes nothing.
  - AC: Visitors see no create, edit or delete controls; navigating directly to an edit URL sends them to the login page.
  - AC: An editor calling an admin-only endpoint gets HTTP 403 and changes nothing; editors never see the *Users* screen.
- **FR-25 — Manage users.** On a *Users* screen the admin lists users and adds a user with an email, a display name, a role (editor or admin) and a starting password.
  - AC: Emails are unique (case-insensitive); the starting password follows FR-13's rules.
- **FR-26 — Change role, block, reset password.** The admin can change a user's role, block or unblock a user, and set a new password for a user.
  - AC: A blocked user cannot log in, and their existing session stops working on the next request.
  - AC: The last active admin cannot be demoted or blocked.
- **FR-27 — Own password.** Any signed-in user can change their own password by entering the current one.

### F9. AI recipe import

Owner-only (FR-16 applies). Import never saves anything by itself: it produces a draft that the owner reviews in the normal recipe form.

- **FR-17 — Import from URL.** The owner pastes a recipe page URL; the system fetches the page and extracts a draft recipe in the app's recipe format (*Recipe content*, §6).
  - AC: If the page contains structured recipe data (schema.org `Recipe`, e.g. JSON-LD), it is used first; only if that is missing or incomplete is the page text sent to the LLM.
  - AC: Only `http`/`https` URLs to public hosts are fetched; private/internal addresses are refused, and pages larger than a fixed size or slower than a fixed timeout fail with a clear message.
  - AC: A fetch failure (blocked site, 404, timeout) shows a message suggesting the *Paste text* option (FR-18).
  - AC: The recipe's main photo is taken from the page when available (schema.org `Recipe.image` first, then the page's `og:image`). How photos are stored (local copy vs. link to the source) is decided in the architecture step.
- **FR-18 — Import from pasted text.** The owner pastes raw recipe text; the LLM extracts a draft recipe in the same format.
  - AC: Text with no recognizable recipe gives "No recipe found in this text" and no draft.
- **FR-21 — Hebrew drafts.** Imports from pages or text in another language (e.g. English) produce a draft translated to Hebrew (title, description, ingredient names and notes, steps). Amounts and units are mapped to the app's unit list; imperial units (oz, lb, fl oz) are converted to g and ml by a fixed table with friendly rounding (cups and spoons are kept), and the source amount and unit are kept on the ingredient. Fahrenheit temperatures in the steps become Celsius, rounded to 5 ("180°C"), and a converted step keeps its pre-conversion text. A recipe with any converted ingredient or step shows a "הצג מתכון מקורי" toggle (off by default) that reveals the original values. The source URL is kept.
  - AC: Importing an English recipe yields a Hebrew draft whose amounts and units match the source, with imperial units converted (8 oz becomes 227 g and keeps "8 oz" as its source value).
  - AC: A step that says "350°F" reads "180°C" in the draft and keeps the original step text; the conversion is deterministic code, not model arithmetic.
- **FR-19 — Review before save.** A successful import opens the recipe create form (FR-4) pre-filled with the draft; nothing is saved until the owner clicks *Save*.
  - AC: The draft goes through the same validation as FR-4; fields the import could not fill (e.g. servings) are left empty and flagged for the owner to complete.
  - AC: Ingredients the import could not quantify become to-taste ingredients rather than invented amounts.
  - AC: Units are mapped to the app's unit list, imperial units are converted (FR-21); a unit that is still unmappable is left empty and the original text is kept in the ingredient note.
  - AC: The source URL (if any) is stored with the saved recipe and shown on its detail page as a link.
  - AC: An imported photo is shown in the review form, where the owner can keep or remove it before saving.
  - AC: Cancelling the form discards the draft.
- **FR-20 — Import feedback.** While an import runs, the UI shows progress and the owner can cancel it.
  - AC: An import that exceeds its engine's time limit is stopped with a clear message. Limits are set per AI engine (default: 60 seconds for a hosted model, about 180 seconds for a local model running on the laptop's CPU).
  - AC: LLM errors (provider down, quota exceeded, invalid output) show a readable message; nothing is saved and no partial recipe is created.

### F10. Tags

Owner-only for changes (FR-16 applies); everyone can filter by them.

- **FR-22 — Tags on a recipe.** The recipe form (FR-4/FR-6) accepts any number of tags (zero or more; none is required). Tag input autocompletes from existing tags and can create a new tag inline. There are no meal types or tag groups: a meal type like *Breakfast* is just a pinned tag.
  - AC: A recipe can be saved with no tags.
  - AC: Typing a tag name that already exists (case-insensitive) reuses it instead of creating a duplicate.
- **FR-23 — Manage tags.** A management screen lets the owner add, rename, delete and pin or unpin tags. Pinned tags appear as the quick-filter chips in the library (FR-3).
  - AC: Renaming updates every recipe that uses it, and a name that already exists (case-insensitive) is refused.
  - AC: Deleting a tag removes it from all recipes after a confirmation that shows how many recipes use it.
  - AC: Pinning or unpinning a tag adds it to or removes it from the library's quick-filter chip row.
- **FR-24 — Import suggestions.** AI import (F9) suggests tags from the existing list; suggested new tag names are proposed in the draft, and are only created if the owner accepts them and saves.

## 7. Non-Functional Requirements

- **NFR-1 — Code quality (portfolio).** Frontend and backend are fully typed (TypeScript strict; Python type hints checked). Lint and format are enforced. CI runs lint, type-check and tests on every push and must pass.
- **NFR-2 — Testing.** Backend: unit tests for domain logic (validation, original-value rules) and API tests for every endpoint. Frontend: unit tests for scaling and rounding, component tests for the recipe form. Scaling and original-value logic have 100% branch coverage.
- **NFR-3 — Performance.** With 200 recipes on a local machine: library first render < 1 s, search filtering feels instant (< 100 ms per keystroke), detail page < 500 ms.
- **NFR-4 — Responsive, mobile-first.** Every MVP screen is designed for a 375 px wide phone first (cooking from the phone in the kitchen), then enhanced for tablet and desktop.
- **NFR-5 — Accessibility.** Keyboard navigable, visible focus, labelled form fields, WCAG AA color contrast.
- **NFR-6 — Run locally.** One documented command starts the whole app (frontend, backend, database with migrations applied). Data survives restarts.
- **NFR-7 — Design system.** All UI styling uses design tokens (Tailwind + shadcn/ui theme): no hard-coded colors, spacing or font sizes. Shared presentational components live in a shared UI library and consume only tokens.
- **NFR-8 — API contract.** The backend publishes an OpenAPI schema; frontend API types are generated from it, never hand-written.
- **NFR-9 — Documentation.** The README explains what the app does, how to run it, the architecture at a glance, and links to the architecture decision record.
- **NFR-10 — Security basics.** Secrets (JWT signing key, admin bootstrap credentials) come from environment variables, never from the repo. Passwords are hashed with a current, slow password-hashing algorithm. Repeated failed logins are rate-limited (e.g. 5 per minute). Token storage in the browser and the hashing library are decided in the architecture step.
- **NFR-11 — Frontend performance best practices.** Routes are lazy-loaded (code-split per page, like Angular lazy modules), so visitors never download the editor, login or import code they don't use. Server data is cached and not re-fetched needlessly. Search input does not block typing. Images are lazy-loaded and sized. Targets on a mid-range phone: Lighthouse performance ≥ 90, LCP < 2.5 s, initial JavaScript ≤ 200 KB gzipped; a bundle-size budget fails CI when exceeded. Concrete tools are chosen in the architecture step.
- **NFR-12 — Hebrew, right-to-left.** The whole UI is in Hebrew and laid out right-to-left (`lang="he" dir="rtl"`); layout mirrors correctly, numbers and units inside Hebrew text display in the right order, and fonts support Hebrew. User content in another language still displays correctly. How UI strings are stored (translation files vs. inline) is decided in the architecture step.

## 8. Post-MVP Candidates (not committed)

These are kept so the architecture does not rule them out. None has a committed design; each needs Adi's decisions before work starts (§9).

- **Event menus.** Group several recipes into a named event (e.g. "Friday dinner, 8 guests").
- **Shopping list.** Combine the ingredients of an event's recipes, scaled to its guest count, into one list.
- **Further AI features.** To be discussed after the MVP (AI import itself is in the MVP — F9).
- **Smart ingredient substitution.** Suggest replacements for an ingredient.
- **Public deployment.** Host the app online as a live portfolio demo.

## 9. Open Questions and Deferred Decisions

| # | Question | Blocks | Revisit when |
|---|---|---|---|
| OQ-1 | **Deployment target.** Where to host the public demo (e.g. Railway, Render, a VPS), and how the SQLite data is persisted and backed up there. | Public deployment | When MVP is done |
| OQ-2 | **LLM provider and cost.** Which provider/model for F9 (cloud API vs. local Ollama), and a monthly cost ceiling. Scope is decided: URL + pasted text, review before save, structured data first. | F9 implementation | Architecture step |
| OQ-3 | **Event menus.** Saved and reopenable, or temporary? Fields (date, guest count)? | Event menus, shopping list | When MVP is done |
| OQ-4 | **Shopping list merging.** Exact name + unit, or unit conversion (g↔kg, tsp↔tbsp) and plural matching? Can items be ticked off or edited? | Shopping list | With OQ-3 |
| OQ-5 | **Smart substitution.** In or out; rule-based or AI? | Substitution | After OQ-2 |
| OQ-6 | ~~Tags.~~ **Resolved 2026-10-26 (Adi):** fixed category replaced by one meal type per recipe + free tags (F10). **Superseded 2026-10-27 (Adi):** no meal types at all; one flat list of tags, some of them pinned as quick filters. | — | — |
| OQ-7 | **Old PRD.** `docs/prd.md` predates this document. Keep, replace with a pointer, or delete? | Nothing | Next review |

## 10. Constraints and Assumptions

- **C-1 — Admin-managed accounts.** The first admin is created from the command line; every other account is created by an admin. Visitors are anonymous and read-only. Daily AI import limits are shared by all users.
- **C-2 — Learning project.** Technology choices favor learning React and FastAPI (Adi's background is Angular / NestJS). The stack and architecture are recorded in `addendum.md` and finalized in the architecture step.
- **A-1 — Data volume.** At most a few hundred recipes; one embedded database is enough.
- **A-2 — Units.** A fixed unit list (§6) is enough for the MVP. The only conversion is on import (FR-21): imperial weights and volumes become g and ml by a fixed table, and the source value is kept for a "show the original recipe" toggle. There is no metric/imperial display setting.
- **A-3 — Delete is permanent.** No trash or undo in the MVP.
