---
status: final
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/prd.md
  - _bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-recipes-2026-10-26/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-recipes-2026-10-26/EXPERIENCE.md
---

# Bite & Board (ביס & סיר) - Epic Breakdown

## Overview

This document breaks the requirements from the PRD, the UX design contract (DESIGN.md + EXPERIENCE.md) and the architecture spine into epics and implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The library lists every recipe as a card showing the title, meal type, tags, total time (if known) and photo (if any), newest first. An empty state invites the user to create a recipe.
FR2: Search filters recipes by title as you type (case-insensitive substring). When nothing matches, the library shows "no recipes found" with a way to clear the search.
FR3: Filter by one meal type and by one or more tags (AND). The filters combine with search and survive navigating to a recipe and back.
FR4: Create a recipe through a form with every content field. Ingredients and steps can be added, removed and reordered. The form validates inline, and the API rejects the same errors with 422. Leaving with unsaved changes asks for confirmation. The user can add, replace or remove the photo.
FR5: The detail page shows all recipe content: photo, ingredients (amount, unit, name, note) and numbered steps. To-taste ingredients read "Salt — to taste". An unknown recipe id shows a not-found page.
FR6: Edit a recipe with the same form as FR4; saving overwrites it in place and updates `updated_at`.
FR7: The first change to an existing ingredient's amount or unit stores its original amount and unit. Later edits keep that first original. New ingredients get no original, and edits to the name or note alone don't create one.
FR8: An ingredient that has an original shows the hint "originally {amount} {unit}" on the detail page and in the edit form. The hint is secondary, readable by screen readers, and scaled together with the amounts.
FR9: "Reset to original" in the edit form restores the original amount and unit. After saving, the ingredient looks exactly as if it had never been edited.
FR10: Delete a recipe after a confirmation dialog that names it. Cancelling changes nothing. Confirming permanently removes the recipe and its children. Deleting a recipe that is already gone returns 404 and shows a non-blocking message.
FR11: Scale servings (1–100) on the detail page. Scaling happens instantly on the client, never scales to-taste ingredients, and uses the rounding rules (whole numbers as integers, otherwise up to 2 decimals, countable units to the nearest ½). It is view-only; a Reset control returns to the base servings.
FR12: One idempotent command seeds about 10 recipes covering every meal type and several tags. The set includes at least one to-taste ingredient and at least one ingredient with an original value.
FR13: A CLI command creates the first admin (a duplicate fails, or with a flag it changes the password). Passwords are hashed, at least 8 characters, and never returned by any API.
FR14: Log in with email and password. On success the controls for the user's role appear. A wrong email or password gives one generic error. The session expires after 7 days, and the user is then sent back to where they were after logging in again.
FR15: Log out ends the session, and the editing controls disappear.
FR16: Reading is public. Changes need an editor or admin session. User management needs the admin role (an editor gets 403). A protected endpoint without a session returns 401. Visitors see no edit controls, and an edit URL sends them to login.
FR17: Import from a URL: schema.org JSON-LD first, falling back to the page text sent to the LLM. Only public http(s) hosts are allowed, with size and time limits. A fetch failure suggests the "paste text" option. The main photo is taken from `Recipe.image`, or `og:image` if there is none.
FR18: Import from pasted text through the LLM. Text without a recognisable recipe gives "No recipe found in this text".
FR19: Review before saving. The import opens the create form prefilled, and nothing is saved until Save. Unfilled fields are flagged. Ingredients the LLM can't quantify become to-taste. An unmappable unit is left empty, with the original text kept in the note. The source URL is stored and shown. The imported photo can be kept or removed. Cancelling discards the draft.
FR20: The import shows progress and can be cancelled. It stops at its engine's time limit (60 s hosted, about 180 s local). LLM errors are shown in readable form, and nothing is saved.
FR21: Imports in another language produce a Hebrew draft. Amounts and units are preserved and mapped to the app's units, and the source URL is kept.
FR22: Every recipe needs exactly one meal type and can have any number of tags. On create the form suggests a meal type. Tag input autocompletes and creates new tags inline, reusing an existing tag regardless of case.
FR23: A management screen adds, renames and deletes meal types and tags. A rename applies everywhere. Deleting a tag asks for confirmation and shows how many recipes use it. A meal type that is still in use can't be deleted.
FR24: Import pre-picks a meal type and suggests tags, preferring existing ones. A suggested new tag is created only if the user keeps it and saves.
FR25: On the Users screen the admin lists users and adds a user (email, name, role, starting password). Emails are unique, compared without case.
FR26: The admin can change a user's role, block or unblock a user, and reset their password. A blocked user's session stops working on the next request. The last active admin can't be demoted or blocked.
FR27: Any signed-in user can change their own password by entering their current one.

### NonFunctional Requirements

NFR1: Code quality. TS strict and Python type-checked (mypy strict); lint and format enforced; CI runs lint, type-check, tests and build on every push.
NFR2: Testing. Backend: domain unit tests and API tests for every endpoint. Frontend: unit tests for scaling and rounding, plus component tests for the recipe form. The scaling and original-value logic reach 100% branch coverage.
NFR3: Performance with 200 recipes on a local machine: the library's first render takes under 1 s, search filtering under 100 ms per keystroke, and the detail page under 500 ms.
NFR4: Mobile-first and responsive. Every screen works at 375 px first, then scales up to tablet and desktop.
NFR5: Accessibility: keyboard navigation, visible focus, labelled fields, and WCAG AA contrast.
NFR6: One documented command runs the whole app with migrations applied, and data survives restarts.
NFR7: Design tokens only (Tailwind + shadcn theme). Shared presentational components live in `libs/ui-components` and consume tokens only.
NFR8: The backend publishes OpenAPI, and the frontend API types are generated from it, never hand-written.
NFR9: The README covers what the app is, how to run it, a short architecture overview, and a link to the architecture spine.
NFR10: Security basics: secrets come from env, passwords are hashed with a slow algorithm (Argon2id), and failed logins are rate-limited (5 per minute).
NFR11: Frontend performance. Routes are lazy-loaded, server data is cached, search never blocks typing, and images are lazy-loaded and sized. Targets: Lighthouse ≥ 90, LCP < 2.5 s, initial JS ≤ 200 KB gzip, with a bundle budget enforced in CI.
NFR12: The UI is in Hebrew and laid out right-to-left. The layout mirrors correctly, numbers and units render in the right order, fonts support Hebrew, and content in other languages still displays correctly.

### Additional Requirements

From ARCHITECTURE-SPINE.md (AD-1 to AD-33). There is **no starter template**: this is a brownfield Nx 24 workspace, and Epic 1 Story 1 ratifies and adapts the existing scaffold.

- Brownfield ratification:
  - Move `apps/recipe-service/app/{api,db,models}` into feature modules (`recipes`, `tags`, `auth`, `users`, `imports`, `photos`, plus `core`).
  - Move `/health` to `/api/health`.
  - Upgrade Python 3.12 to 3.13. Add `pydantic-settings` and runtime `httpx`.
  - Replace `react-router-dom@6.30.3` with `react-router@8` in data mode.
  - Add a root `dev` script. Remove the Nx welcome page.
- Create the libs `data-access`, `ui-components` and `recipe-domain`, with Nx tags and dependency constraints (AD-2, AD-32).
- OpenAPI pipeline:
  - `recipe-service:openapi` writes `openapi.json`, and `data-access:generate` runs hey-api (types, client, TanStack Query hooks, Zod).
  - Operation IDs follow `{tag}_{function}`, and CI has a drift check (AD-3, AD-19).
  - The client is configured once (credentials and the CSRF header), and invalidation goes through one map (AD-19).
- Database setup:
  - SQLite with `foreign_keys=ON` and WAL; Alembic in batch mode; tests run `alembic upgrade head` (AD-24).
  - The default Hebrew meal types come from a data migration with fixed UUIDs (AD-24).
  - The CLI `app.cli seed|create-admin|backup` is exposed as Nx targets (AD-24, AD-29).
- Recipe API (AD-4, AD-20, AD-31):
  - The recipe aggregate is read and written whole.
  - Ingredients are matched by id, and an explicit `original` object carries the first value.
  - `Unit` is a StrEnum of English codes.
  - Amounts are quantized to 3 decimals and sent as JSON numbers.
  - API schemas are Pydantic models with `extra="forbid"`.
- Tags in a recipe save are passed as id or name and created inside the recipe transaction. The `tags` module owns `recipe_tag`, and import-linter checks the module graph (AD-25).
- `GET /api/recipes` returns all summaries without paging; search and filtering run on the client in `recipe-domain` (AD-26).
- Photos are uploaded first and attached on save. The server builds the URLs. Images become WebP 1600 plus a 600 thumbnail, with limits of JPEG/PNG/WebP up to 10 MB. Unattached uploads are swept, and the `PhotoStorage` port uses local disk (AD-14, AD-27).
- Auth:
  - The session cookie is httpOnly with SameSite=Lax, the app runs on one origin, and requests send a CSRF header.
  - Endpoints: `/api/auth/session` (public), login (400 on bad credentials), logout. A 401 interceptor handles expired sessions. `COOKIE_SECURE` is a flag (AD-6, AD-21).
  - Passwords use Argon2id via pwdlib, and slowapi rate-limits logins (AD-6, AD-33).
- Users and roles: `require_role("editor"|"admin")`. The `users` module is admin-only. Recipes record `created_by` and `updated_by`. The last admin can't be demoted or blocked (AD-30).
- Errors are returned as `{detail, code, params}` with an `ErrorCode` enum, and the client shows Hebrew text from i18n. 422 errors map to form fields by `loc` and `type` (AD-28).
- AI import:
  - `LlmProvider` port with a registry of `ollama` (the default for now), `gemini` and `fake`, validated against a `DraftRecipe` Pydantic schema. Each provider has its own timeout, exposed by `GET /api/imports/providers`. Error codes are fixed, and `import_log` records imports and enforces the daily cap (AD-12, AD-22, AD-29).
  - The pipeline is safe fetch, then JSON-LD (recipe-scrapers), then readable text (trafilatura), then the LLM. `core/safe_fetch` handles every outbound URL (AD-13, AD-23).
  - The draft reaches the form through router state only, with `missing_fields` (AD-22).
- **Spike before the import feature:** compare Ollama and Gemini on about 5 real recipes (2 English, 3 Hebrew) for time and Hebrew quality, then confirm the default provider. Ollama runs as the native Windows app.
- Frontend shape: "thin app, thick libs". `apps/web` is only the shell (router, providers, top bar). Pages and containers live in feature libs `libs/feature-{recipes,auth,users,tags,import}` (tag `type:feature`, never importing each other), and each feature lib is created by the first story that needs it (AD-2).
- Frontend stack: React Router 8 lazy routes, TanStack Query, React Hook Form + Zod with `RecipeFormValues` and two mapping functions, i18next (`he.json`), and the React Compiler through the Babel plugin (AD-8 to AD-11, AD-22, AD-33).
- Enforcement: mypy strict, import-linter, ESLint rules (no physical-direction utilities, arbitrary values, hex colours or the `style` prop in ui-components; jsx-a11y), and size-limit as the `web:size` target (AD-33).
- Packaging: one container serves the SPA, `/api` and `/media` with a `/data` volume. `docker compose up` runs it locally. The SPA fallback excludes `/api` and `/media`, and there's a HEALTHCHECK (AD-15, AD-29).
- Tests (AD-16, AD-23):
  - Backend: pytest with TestClient and a temporary DB per test.
  - Frontend: Vitest, React Testing Library with MSW, and Playwright e2e (`apps/web-e2e`) for scaling, editing with the hint, and import with the fake provider.
  - The fake provider and fake fetcher are deterministic.
- CI: GitHub Actions with Node and setup-uv, nx-set-shas, and `nx affected -t lint typecheck test build e2e`, plus the OpenAPI drift check and the size check (AD-17).
- Ops:
  - Logging is pretty in dev and JSON in prod, with request IDs and secrets redacted.
  - `.env.example` lists the settings, and the app fails fast without `JWT_SECRET`.
  - A backup command uses `VACUUM INTO` and tars the photos.
  - A failed startup migration exits non-zero (AD-29).

### UX Design Requirements

UX-DR1: Implement the DESIGN.md theme as shadcn CSS variables. Light (`:root`) and dark (`.dark`) values for background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input and ring. Brand extensions `--board`, `--board-foreground`, `--hint`, `--hint-muted` and `--flag` are registered in Tailwind (`bg-board`, `text-hint`, `border-flag`). Radii: `sm` 8, `md` 12, `lg` 16, `board` 24, `full`.
UX-DR2: Typography. Rubik (400/600/800, Hebrew and Latin) is the only family. The type roles are display (40/56 lg), title 24, heading 18, body 16, quantity 20/800 with tabular figures, label 14/600 and hint 14/600. At most 5 visible sizes.
UX-DR3: Theme toggle in the top bar: system, light, dark. The choice is remembered per browser, and `.dark` is applied on `<html>`.
UX-DR4: App shell. One top bar with no sidebar:
  - the wordmark "ביס & סיר", linking to the library
  - for signed-in users, "מתכון חדש" and "ייבוא" (on phone, one "+" menu)
  - the theme toggle
  - "כניסה", or an account menu with "תגיות וסוגי ארוחה", "משתמשים" (admin only), "החשבון שלי" and "יציאה"
UX-DR5: RTL foundation:
  - `<html lang="he" dir="rtl">` and Radix `DirectionProvider`.
  - Logical utilities only.
  - Directional icons are mirrored.
  - Each amount+unit pair is wrapped in `<bdi>`.
  - `dir="auto"` on user content.
  - The URL, email and password fields are `dir="ltr"`.
UX-DR6: Board component. An oak slab with radius 24, padding 18 and 36 at the top for the handle slot (a 44×12 pill in the ground colour, centred 12 px from the top). It is used only for food surfaces.
UX-DR7: RecipeCard. A board with the slot, a 4:3 photo (14 px corners, cover), then the title, meal type, up to 3 tags and total time. The whole card is the link. Without a photo, the title is larger and there is no placeholder. Hover scales up 2% and press scales down 2%, with no shadow.
UX-DR8: Board-shaped photo on the detail page and in import review. Board radius with the handle slot cut through the image, 4:3 on phone and 16:9 on desktop. Imported photos show the credit "מקור: {domain}".
UX-DR9: ServingsStepper. Round 44 px − and + buttons, typing allowed, clamped to 1–100 with a range message. "חזרה ל־{base}" appears only when the value differs from the base. A polite live region announces the servings.
UX-DR10: IngredientLine. Shows the amount in the quantity role, the unit label (singular or plural), the name and the note. To-taste lines read "לפי הטעם". The hint "במקור …" sits under the line in `hint` colour, scaled, and linked with `aria-describedby`.
UX-DR11: Library filters:
  - a pill search field with clear (×), kept in `?q=`, focused with `/` on desktop
  - a single-select meal-type chip row ("הכל" plus the meal types; horizontal scroll on phone)
  - a "תגיות" button that opens a sheet (phone) or popover (desktop) of tag checkboxes, with the selected tags shown as removable chips
  - all state kept in the URL
UX-DR12: Recipe form:
  - fields: title, description, meal type select, tag combobox (autocomplete, case-insensitive reuse, "יצירת תגית '{text}'"), servings, prep and cook time, source URL, photo (add, replace, remove, with an upload thumbnail and progress, limits shown beside the field)
  - ingredient rows (amount as text accepting ½ and ⅓, unit select, name, note; stacked on phone, one row from `sm`) with add, remove and up/down reorder, and Enter in the last row adding a row
  - hinted rows show "חזרה למקור"
  - step rows
  - errors on blur and submit, with focus moving to the first error
  - an unsaved-changes guard
UX-DR13: Import dialog. A dialog on desktop and a full page on phone, with tabs "קישור" and "הדבקת טקסט". An engine choice (local or Gemini) remembers the last pick. While running, it shows client-timed phase text, an indeterminate progress bar and Cancel. Errors switch to the paste tab or offer "לנסות שוב עם Gemini".
UX-DR14: Import review. A banner in `flag` colour ("N שדות דורשים השלמה · המתכון תורגם מאנגלית"). Flagged fields get a 2 px `flag` border and the note "יש להשלים". Suggested tags are shown as chips. The photo panel offers "הסרה" and "החלפה".
UX-DR15: Confirm dialogs (shadcn AlertDialog) for delete, unsaved changes and tag deletion. They name the object and its usage count, start focus on Cancel, and label the destructive action ("מחיקה").
UX-DR16: Toasts, one at a time: saved, deleted, deleted-already (404), logged out.
UX-DR17: States:
  - skeleton cards (6) and a detail skeleton
  - empty library for editors (with "מתכון חדש" and "ייבוא מקישור") and for visitors
  - no results, with "ניקוי החיפוש"
  - not found, with "חזרה לרשימה"
  - session expired ("פג תוקף החיבור", returning to the same place, with form data kept)
  - blocked user
  - login errors, generic and rate-limited
  - save failed (values kept)
UX-DR18: Tags management screen at `/tags`: two lists (meal types, tags) with inline rename and add. Deletes are confirmed and show usage counts. A meal type in use can't be deleted.
UX-DR19: Users screen at `/users` (admin): a list, add user (email, name, role, starting password), role change, block or unblock, and reset password. The controls on the last admin are disabled with a reason. `/account` lets a user change their own password.
UX-DR20: Responsive layouts:
  - library: 1 column below 640, 2 columns from `sm`, 3 from `lg`
  - detail: one column on phone (photo, header, servings, board, steps); from `lg`, a 400 px sticky start column (servings and board) with the photo and steps beside it
  - form: up to about 860 px wide
  - import review: from `lg`, the photo panel sits beside the fields
UX-DR21: Accessibility behaviours:
  - focus moves to the `h1` and `document.title` updates on route change
  - visible focus through `ring`
  - touch targets at least 44 px
  - reduced motion drops everything except opacity
  - labelled fields, with errors linked through `aria-describedby`
UX-DR22: Kitchen mode. The detail page requests a screen wake lock and ignores failure.
UX-DR23: All UI copy follows the Voice and Tone rules: Hebrew, gender-neutral infinitives, no exclamation marks or emoji, and every string comes from `he.json`.

### FR Coverage Map

FR1: Epic 1 - Library list with cards, newest first, empty state
FR2: Epic 1 - Search by title as you type
FR3: Epic 1 (meal-type filter) + Epic 4 (tag filter) - Combined filters kept in the URL
FR4: Epic 3 - Create a recipe through the form (incl. photo)
FR5: Epic 1 - Recipe detail page
FR6: Epic 3 - Edit a recipe with the same form
FR7: Epic 3 - Remember the first original amount and unit
FR8: Epic 3 - Show the "originally" hint (scaled)
FR9: Epic 3 - Reset to original
FR10: Epic 3 - Delete with confirmation
FR11: Epic 1 - Serving scaling with the rounding rules
FR12: Epic 1 - Idempotent seed (the hinted ingredient is added in Epic 3)
FR13: Epic 2 - CLI to create the first admin
FR14: Epic 2 - Log in
FR15: Epic 2 - Log out
FR16: Epic 2 - Public vs. editor vs. admin guards
FR17: Epic 5 - Import from a URL (safe fetch, JSON-LD, photo)
FR18: Epic 5 - Import from pasted text
FR19: Epic 5 - Review the import before saving
FR20: Epic 5 - Import progress, cancel and per-engine timeouts
FR21: Epic 5 - Hebrew drafts from other languages
FR22: Epic 3 - Meal type and tags on a recipe, with inline new tags
FR23: Epic 4 - Manage meal types and tags
FR24: Epic 5 - Import suggests a meal type and tags
FR25: Epic 2 - Users screen: list and add users
FR26: Epic 2 - Change role, block, reset password; protect the last admin
FR27: Epic 2 - Change your own password

## Epic List

> Approved by Adi 2026-10-26: Q1 A (auth before editing), Q2 A (tags as their own epic), Q3 A (the LLM spike opens Epic 5; all AI work stays together), Q4 A (final "ready to show" epic).

### Epic 1: Browse and cook from the phone
Anyone can open ביס & סיר on a phone or desktop (Hebrew, RTL, light or dark), browse the seeded recipes, search them, filter by meal type, open a recipe and scale it live, with the screen staying awake in the kitchen. The groundwork comes first: adapting the scaffold, the shared libs, the OpenAPI pipeline, the database with its migrations and Hebrew meal types, the theme, the app shell, seed data and CI.
**FRs covered:** FR1, FR2, FR3 (meal type), FR5, FR11, FR12

### Epic 2: Accounts, login and roles
Adi bootstraps the admin account, and users log in and out. Visitors read, editors change content, and the admin also manages users on the Users screen (add, change role, block, reset password). Everyone can change their own password.
**FRs covered:** FR13, FR14, FR15, FR16, FR25, FR26, FR27

### Epic 3: Create, edit and delete recipes
Editors create recipes in the full form: ingredient and step rows, fractions, validation, and an unsaved-changes guard. They pick the meal type and tags (creating new tags inline) and add a photo. Editing keeps "originally …" hints, with reset to original, and recipes can be deleted after a confirmation.
**FRs covered:** FR4, FR6, FR7, FR8, FR9, FR10, FR22

### Epic 4: Organise with meal types and tags
Editors manage meal types and tags (add, rename, delete, with usage counts), and everyone can filter the library by tags.
**FRs covered:** FR3 (tags), FR23

### Epic 5: AI import
Editors import a recipe from a link or from pasted text with Ollama (local) or Gemini. They get a Hebrew draft with a suggested meal type, tags and photo, review the flagged fields, and save. Progress, cancel and per-engine timeouts make slow local runs usable. Story 5.1 is the spike that compares Ollama and Gemini and confirms the default engine.
**FRs covered:** FR17, FR18, FR19, FR20, FR21, FR24

### Epic 6: Ready to show
The app runs as one production container (`docker compose up`) with backups, structured logging and an env template. Performance budgets (bundle size, Lighthouse) and the Playwright e2e flows run in CI. A README explains the app and its architecture for recruiters.
**NFRs completed:** NFR3, NFR6, NFR9, NFR11 (NFR1, 2, 4, 5, 7, 8, 10 and 12 are met inside every epic's stories)

## Epic 1: Browse and cook from the phone

Anyone can open ביס & סיר on a phone or desktop (Hebrew, RTL, light or dark), browse the seeded recipes, search them, filter by meal type, open a recipe and scale it live. The first stories adapt the existing scaffold to the architecture spine.

### Story 1.1: Adapt the backend scaffold

As a developer (Adi),
I want the existing FastAPI scaffold reshaped to the agreed architecture,
So that every later backend story lands in the right place and follows the same structure.

**Acceptance Criteria:**

**Given** the current `apps/recipe-service` with layer-first `app/{api,db,models}`
**When** the story is done
**Then** the backend has `app/core` (config, db, a security placeholder, errors, health) plus empty feature packages `recipes`, `tags`, `auth`, `users`, `imports` and `photos`, each with `router.py`, `service.py`, `repository.py`, `models.py` and `schemas.py` (AD-1)
**And** `app/core/metadata.py` imports every module's models, so Alembic autogenerate sees them
**And** `GET /api/health` returns 200 `{status: "ok"}`, and the old `/health` route is gone
**And** Python is 3.13 (`.python-version` and `requires-python`), and `pydantic-settings` and runtime `httpx` are added
**And** config is read once through pydantic-settings, and the app refuses to start without `JWT_SECRET`, with a clear message (AD-29)
**And** `.env.example` lists every setting from AD-29, and `.env` is gitignored
**And** `nx run recipe-service:serve`, `:test` and `:lint` pass

### Story 1.2: Adapt the frontend scaffold and shared libs

As a developer (Adi),
I want the React app and the shared libraries set up the way the architecture describes,
So that every later frontend story lands in the right place and respects the boundaries.

**Acceptance Criteria:**

**Given** `apps/web` with the Nx welcome page and `react-router-dom@6.30.3`
**When** the story is done
**Then** `react-router-dom` is replaced by `react-router@8` (data mode, lazy route modules), and the Nx welcome component is removed
**And** the shared libs `data-access`, `ui-components` and `recipe-domain` exist (non-buildable, consumed from source) with the Nx tags `type:data-access`, `type:ui` and `type:domain`, `apps/web` is tagged `type:app`, and `depConstraints` enforce AD-2, AD-32 and AD-33, including the `type:feature` rules for the feature libs that later stories create (a forbidden import fails `nx lint`)
**And** a root `npm run dev` starts web and API together (Story 1.1), with Vite proxying `/api` and `/media` to FastAPI (AD-15)
**And** a placeholder home route renders through the router
**And** `nx run-many -t lint test build` passes

### Story 1.3: CI and quality gates

As a developer (Adi),
I want every push checked automatically for lint, types, tests and build on both front and back end,
So that the repo is always green and interview-ready (NFR-1).

**Acceptance Criteria:**

**Given** a push or pull request to GitHub
**When** CI runs
**Then** one GitHub Actions workflow sets up Node and Python (with setup-uv), uses `nrwl/nx-set-shas`, and runs `nx affected -t lint typecheck test build` (AD-17)
**And** the old Nx Cloud `start-ci-run` / `fix-ci` steps are removed
**And** `recipe-service:typecheck` runs mypy in strict mode with the pydantic plugin, and `recipe-service:lint` runs ruff plus the import-linter contracts for AD-1
**And** the web ESLint config bans:
  - physical-direction Tailwind utilities (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left/right`)
  - arbitrary values
  - hex/rgb literals outside the theme file
  - the `style` prop in `libs/ui-components`
**And** the web ESLint config also enables jsx-a11y and the version of the React hooks rules that the compiler needs (AD-33)
**And** a deliberately broken line (e.g. `className="ml-2"`) makes CI fail, and reverting it makes CI pass
**And** the React Compiler is enabled through `babel-plugin-react-compiler` in the Vite config

### Story 1.4: Theme, RTL and app shell

As a visitor,
I want the app to open in Hebrew, right to left, with the ביס & סיר look in light or dark,
So that it feels like a finished, personal app from the first screen.

**Acceptance Criteria:**

**Given** the web app is opened
**When** the first page renders
**Then** `<html lang="he" dir="rtl">` is set, the Radix `DirectionProvider` is `rtl`, and Rubik (400/600/800) loads with a system fallback (UX-DR2, UX-DR5)
**And** every DESIGN.md token is a CSS variable in `:root` (light) and `.dark`, including `--board`, `--board-foreground`, `--hint`, `--hint-muted` and `--flag`, and is usable as Tailwind classes such as `bg-board` and `text-hint`, together with the radius scale (UX-DR1)
**And** the top bar shows the wordmark "ביס & סיר" linking to `/`, and a theme toggle that cycles system, light and dark and remembers the choice (UX-DR3, UX-DR4)
**And** all UI strings come from `he.json` through i18next, with no Hebrew hard-coded in components (AD-10). They follow the EXPERIENCE.md Voice and Tone rules: gender-neutral infinitives, no exclamation marks, no emoji (UX-DR23). Every later story's copy is held to the same rules
**And** an unknown route shows "הדף לא נמצא" with a "חזרה לרשימה" link
**And** focus moves to the page `h1` and `document.title` updates on every route change (UX-DR21)
**And** shared presentational pieces (the top bar, the Board container, buttons) live in `libs/ui-components` and use tokens only
**And** every text/background pair used passes WCAG AA in both themes

### Story 1.5: Recipe data model and read API

As a visitor,
I want the server to provide the recipe list and full recipe details,
So that the app has real data to show.

**Acceptance Criteria:**

**Given** a fresh database
**When** the app starts
**Then** Alembic migrations (batch mode) run automatically and create `recipe`, `ingredient`, `step`, `tag` and `recipe_tag` (AD-5, AD-24), with:
  - UUID ids
  - UTC timestamps
  - nullable `created_by`/`updated_by` UUID columns (their foreign key to `user` is added in Story 2.1, when that table exists)
  - `ON DELETE CASCADE` on child rows
**And** every connection has `PRAGMA foreign_keys=ON` and WAL enabled
**And** a data migration inserts the default meal types with fixed UUIDs and Hebrew names (בוקר, בראנץ', צהריים, ערב, קינוח, תוספת, משקה, אחר)
**And** a failed migration exits the app non-zero

**Given** recipes exist
**When** `GET /api/recipes` is called
**Then** it returns all `RecipeSummary` items, unpaginated, sorted by `created_at desc, id` (AD-26). Each summary has: id, title, meal_type `{id,name}`, tags `[{id,name}]`, total_minutes or null, photo or null, and created_at
**And** `GET /api/recipes/{id}` returns the full `RecipeRead` (AD-20, AD-31), with:
  - ordered ingredients: `amount` as a JSON number or null, `unit` from the `Unit` enum or null, name, note, and `original` or null
  - ordered steps
**And** an unknown id returns 404 `{detail, code: "recipe_not_found"}` (AD-28)
**And** operation IDs follow `{tag}_{function}`, enforced by a test (AD-19)
**And** API tests cover both endpoints against a temporary database migrated with `alembic upgrade head`

### Story 1.6: Generated API client pipeline

As a developer (Adi),
I want the frontend's API types and hooks generated from the backend,
So that client and server can never drift apart (NFR-8).

**Acceptance Criteria:**

**Given** the backend from Story 1.5
**When** `nx run data-access:generate` runs
**Then** `recipe-service:openapi` writes `libs/data-access/openapi.json` (committed), and hey-api generates types, the fetch client, TanStack Query hooks and Zod schemas into `libs/data-access/src/generated` (AD-3)
**And** the client is configured once, with `credentials: 'same-origin'` and the `X-Requested-With: bite-and-board` header on every non-GET request (AD-19)
**And** there is one `QueryClient` provider in the app, and `libs/data-access` exports a query-invalidation map, empty for now (AD-19)
**And** CI regenerates the client and fails on `git diff --exit-code` if it is stale
**And** a non-422 API error reaches the UI as an `ErrorCode`, and the UI shows `errors.<code>` from `he.json`, with a generic message for unknown codes (AD-28)

### Story 1.7: Demo seed data

As Adi,
I want one command that fills the app with realistic recipes,
So that it looks alive for demos and development (FR12).

**Acceptance Criteria:**

**Given** a migrated database
**When** `nx run recipe-service:seed` (`python -m app.cli seed`) runs
**Then** about 10 Hebrew recipes are created through `recipes.service`, not raw SQL. They cover every default meal type and several tags, such as על האש, פינגר פוד and מסיבות (AD-24)
**And** at least one recipe has a to-taste ingredient, and the recipes include fractions such as ½ and ⅓
**And** running the seed again creates no duplicates (keyed by title)
**And** the seed never creates meal types
**And** an ingredient with an original value is added to the seed in Epic 3, once the original-value rule exists

### Story 1.8: Recipe library with search and meal-type filter

As a visitor,
I want to see all recipes as cards, search them and filter by meal type,
So that I can quickly find what to cook (FR1, FR2, FR3).

**Acceptance Criteria:**

**Given** the seeded recipes
**When** I open `/`
**Then** I see `RecipeCard`s, newest first: 1 column on phone, 2 from `sm`, 3 from `lg` (UX-DR6, UX-DR7, UX-DR20). Each card is a board with the slot, title, meal type, up to 3 tags and total time, with a larger title when there is no photo
**And** the page lives in a new `libs/feature-recipes` (tag `type:feature`) as the lazy subpath export `@bite-and-board/feature-recipes/library`, replacing the placeholder home route in `apps/web` (AD-2, AD-11)
**And** while loading I see 6 skeleton cards. With no recipes I see the visitor empty state "עוד אין כאן מתכונים" (UX-DR17)

**Given** the library
**When** I type in the search field
**Then** only recipes whose title contains the text remain (case-insensitive). The list updates as I type, using `useDeferredValue` and no network call, and the value is kept in `?q=` (UX-DR11)
**And** with no matches I see "לא נמצאו מתכונים ל־'{q}'" with "ניקוי החיפוש", which clears both search and filter
**And** a meal-type chip row ("הכל" plus the meal types) filters to one meal type, combines with search, and is kept in `?meal=<uuid>`
**And** after I open a recipe and go back, the search and filter are still applied
**And** filtering is one pure function in `libs/recipe-domain`, with unit tests (AD-26, AD-32)
**And** with 200 recipes, filtering takes under 100 ms per keystroke (NFR-3)

### Story 1.9: Recipe detail page

As a visitor,
I want to open a recipe and read its ingredients and steps comfortably on my phone,
So that I can cook from it (FR5).

**Acceptance Criteria:**

**Given** a recipe exists
**When** I open `/recipes/:id`
**Then** I see the meal type, prep and cook time, the title in display style, the ingredient board, numbered steps, and the source link if there is one (UX-DR6, UX-DR10)
**And** each `IngredientLine` shows:
  - the amount in quantity style, wrapped in `<bdi>`
  - the singular or plural Hebrew unit label from `he.json`
  - the name and the note
  - for to-taste lines, "מלח — לפי הטעם"
**And** the layout is one column on phone. From `lg`, the ingredient board sits in a sticky start column with the steps beside it (UX-DR20)
**And** `IngredientLine` already renders an `original` hint when the API sends one, so Epic 3 needs no layout change
**And** an unknown id shows "המתכון לא נמצא" with a "חזרה לרשימה" link
**And** a skeleton shows while loading, and the page renders in under 500 ms locally (NFR-3)
**And** the route is lazy-loaded in its own chunk (AD-11)

### Story 1.10: Live serving scaling and kitchen mode

As a cook,
I want to change the number of servings and see every amount update instantly,
So that I can cook for any group without doing the maths (FR11).

**Acceptance Criteria:**

**Given** a recipe with 4 base servings
**When** I tap + until the servings read 10
**Then** every amount is multiplied by 10/4 immediately, with no server call, and to-taste ingredients never change
**And** rounding follows FR11:
  - whole numbers have no decimals ("5", not "5.000")
  - other numbers have at most 2 decimals
  - countable units (unit, clove, slice, can, package) round to the nearest ½
**And** the `ServingsStepper` has 44 px − and + buttons and a typeable value clamped to 1–100 with a range message. A polite live region announces the new servings count (UX-DR9)
**And** "חזרה ל־4" appears only when the value differs from the base, and it restores the base. A reload also returns to the base
**And** `scaleAmount` and `formatAmount` live in `libs/recipe-domain` with 100% branch coverage. `IngredientLine` uses them for both the amount and any original hint (AD-32, NFR-2)
**And** while the detail page is open it requests a screen wake lock, and silently ignores a refusal (UX-DR22)

## Epic 2: Accounts, login and roles

Adi bootstraps the admin account, and people can log in and out. Visitors read; editors and the admin get the controls their role allows; the admin manages users.

### Story 2.1: Admin account from the command line

As Adi,
I want to create my admin account with a command,
So that the app has a first, trusted user and there is no public sign-up (FR13).

**Acceptance Criteria:**

**Given** a migrated database
**When** `nx run recipe-service:create-admin` (`python -m app.cli create-admin --email … --name …`) runs and asks for the password twice
**Then** a migration has created the `user` table (`id`, `email` unique compared without case, `name`, `role` ∈ {editor, admin}, `password_hash`, `is_blocked`, `created_at`), and an admin user is stored (AD-30)
**And** the password is hashed with Argon2id via pwdlib and never stored or logged in plain text (AD-6)
**And** a password shorter than 8 characters is rejected with a clear message
**And** running the command when that email already exists fails clearly, unless `--reset-password` is given, in which case only the password changes
**And** the same migration adds the foreign keys from `recipe.created_by`/`updated_by` to `user`
**And** unit tests cover hashing, verification and the CLI paths

### Story 2.2: Log in and log out

As a user with an account,
I want to log in with my email and password and log out again,
So that I get my editing controls only when I'm signed in (FR14, FR15).

**Acceptance Criteria:**

**Given** an active user exists
**When** I submit correct credentials on `/login`
**Then** `POST /api/auth/login` sets a signed JWT in an `httpOnly; SameSite=Lax` cookie (with `Secure` per `COOKIE_SECURE`) that expires after 7 days, and I'm sent to `?next=` or to `/` (AD-6, AD-21)
**And** the `/login` page lives in a new `libs/feature-auth` (tag `type:feature`) as a lazy subpath export (AD-2, AD-11)
**And** `GET /api/auth/session` (public) always returns 200 `{user: {id, email, name, role} | null}`, and the app's auth context reads it through the generated hook
**And** wrong credentials return 400 `invalid_credentials`, and the form shows "אימייל או סיסמה שגויים" without revealing which field was wrong
**And** a 6th attempt within a minute from the same client returns 429, and the form shows "יותר מדי ניסיונות. אפשר לנסות שוב בעוד דקה." (slowapi, NFR-10)
**And** the top bar shows "כניסה" to visitors, and an account menu with the user's name and "יציאה" to signed-in users (UX-DR4)
**And** "יציאה" calls `POST /api/auth/logout`, which clears the cookie, the session query is invalidated, and editing controls disappear without a reload
**And** the email and password fields are `dir="ltr"`, labelled, and keyboard-accessible
**And** the login route is lazy-loaded

### Story 2.3: Role guards and protected areas

As Adi,
I want every protected action checked by role on the server and hidden in the UI,
So that visitors can only read and editors can't reach admin features (FR16).

**Acceptance Criteria:**

**Given** the `require_role("editor")` and `require_role("admin")` dependencies in `app/core/security` (AD-30)
**When** a protected endpoint is called without a session
**Then** it returns 401, and with a lower role it returns 403, and nothing changes
**And** a mutating request without `X-Requested-With: bite-and-board` returns 403 `csrf_header_missing` (AD-6)
**And** each protected request re-checks the user's `role` and `is_blocked` from the database, so a demotion or a block takes effect on the next request
**And** the 401 interceptor in `libs/data-access` fires only for session-required calls. It navigates through the router to `/login?next=…`, shows "פג תוקף החיבור", and keeps in-memory form state (AD-21)
**And** signed-in routes use a loader guard, which also takes an admin-only option. An editor who opens an admin-only route sees the not-found page (tested with a test route; Story 2.4 applies it to `/users`)
**And** components get a `useCan(role)` helper, and controls a role can't use are absent, not disabled
**And** tests use a test-only protected route to cover visitor, editor, admin and blocked-user cases

### Story 2.4: Users screen: list and add users

As the admin,
I want to see all users and add an account for someone I trust,
So that my partner or friends can edit recipes (FR25).

**Acceptance Criteria:**

**Given** I'm signed in as admin
**When** I open "משתמשים" from the account menu
**Then** `/users` lists users (name, email, role, blocked state) from `GET /api/users` (admin only) (UX-DR19)
**And** the page lives in a new `libs/feature-users` (tag `type:feature`) as a lazy subpath export (AD-2, AD-11)
**And** "הוספת משתמש" opens a form for email, name, role (עורך/מנהל) and a starting password with confirmation, and `POST /api/users` creates the user
**And** a duplicate email (compared without case) returns 409 `email_taken`, shown on the email field
**And** a starting password shorter than 8 characters is rejected on the client and the server
**And** the new user can log in immediately
**And** the screen works at 375 px, and it is lazy-loaded

### Story 2.5: Change role, block, reset password

As the admin,
I want to change someone's role, block them, or set a new password for them,
So that I stay in control of who can edit (FR26).

**Acceptance Criteria:**

**Given** the Users screen
**When** I change a user's role, block or unblock them, or reset their password (with a confirm dialog that names the user)
**Then** `PATCH /api/users/{id}` (admin) applies the change, and the list updates
**And** a blocked user's next request fails, and the app shows "החשבון חסום. יש לפנות למנהל." on the login page (UX-DR17)
**And** demoting or blocking the last active admin returns 409 `last_admin`, and in the UI those controls are disabled with "חייב להישאר מנהל אחד לפחות" (AD-30)
**And** a password reset requires a new password of at least 8 characters, and the user's existing sessions stop working
**And** API tests cover every transition, including the last-admin rule

### Story 2.6: My account: change my password

As a signed-in user,
I want to change my own password,
So that I can replace the starting password the admin gave me (FR27).

**Acceptance Criteria:**

**Given** I'm signed in
**When** I open "החשבון שלי" and submit my current password and a new password twice
**Then** `POST /api/auth/password` verifies the current password, stores the new hash, and shows a toast "הסיסמה עודכנה"
**And** a wrong current password returns 400 `invalid_credentials`, shown on that field
**And** a new password shorter than 8 characters is rejected
**And** my session stays valid after the change

## Epic 3: Create, edit and delete recipes

Editors create recipes with the full form, attach meal type, tags and a photo, edit them while the app remembers the original quantities, reset to original, and delete.

### Story 3.1: Create a recipe (API and basic form)

As an editor,
I want to add a new recipe with its ingredients and steps,
So that my recipes live in one place (FR4).

**Acceptance Criteria:**

**Given** I'm signed in as an editor
**When** I tap "מתכון חדש" (top bar, or "+" on phone)
**Then** `/recipes/new` shows a form with these fields: title, description, meal type (required select), servings, prep and cook time, source URL (`dir="ltr"`), plus ingredient rows (amount as a number, unit select with Hebrew labels for the `Unit` enum, name, note) and step rows, with add and remove buttons
**And** the form uses React Hook Form with its own `RecipeFormValues` type and the two mapping functions `toFormValues` and `toWritePayload`, validated by the generated write Zod schema (AD-22)
**And** `POST /api/recipes` (editor) validates with Pydantic (`extra="forbid"`, at least one ingredient and one step, servings 1–100, title 1–120). It stores amounts quantized to 3 decimals, sets `created_by` and `updated_by` to me, and returns the `RecipeRead` (AD-20, AD-31)
**And** invalid input returns 422, and the errors appear on the matching fields, mapped by `loc` and `type` to Hebrew messages (AD-9, AD-28)
**And** after saving I land on the new recipe's detail page with the toast "המתכון נשמר", and the library list is invalidated (AD-19, UX-DR16)
**And** the editor empty state in the library shows "מתכון חדש" (UX-DR17)
**And** API tests cover create plus the validation errors, and a component test covers a successful submit

### Story 3.2: Recipe form experience

As an editor,
I want the recipe form to be quick and forgiving on my phone,
So that typing a recipe while cooking or reading is easy (FR4).

**Acceptance Criteria:**

**Given** the form from Story 3.1
**When** I type amounts
**Then** "1.5", "½", "⅓", "1 ½" and "1/3" are accepted and parsed by `parseAmount` in `libs/recipe-domain` (unit-tested), and anything else shows a field error
**And** ingredient rows stack amount and unit over name and note on phone, and sit on one row from `sm` (UX-DR12, UX-DR20)
**And** Enter in the last ingredient row adds a new row, and rows can be moved up or down with buttons that work from the keyboard
**And** the meal type is preselected by time of day (morning → בוקר, evening → ערב) [ASSUMPTION from UX]
**And** errors appear on blur and on submit, and focus moves to the first error
**And** leaving with unsaved changes (link, back or closing the tab) asks "לצאת בלי לשמור?" (UX-DR15)
**And** a failed save (network or 5xx) keeps every value and shows a retry toast (UX-DR17)
**And** component tests cover fractions, reordering and the unsaved-changes guard

### Story 3.3: Tags on a recipe, with inline new tags

As an editor,
I want to add tags to a recipe and create a new tag right there in the form,
So that I can group recipes like "על האש" or "מסיבות" without leaving the form (FR22).

**Acceptance Criteria:**

**Given** the recipe form
**When** I type in the tag combobox
**Then** existing tags matching the text (compared without case) are suggested, and if none matches exactly, "יצירת תגית '{text}'" is offered
**And** chosen tags appear as removable chips (UX-DR12)
**And** the write payload carries `tags: [{id} | {name}]`. `recipes.service` resolves names through `tags.service.get_or_create` inside the recipe transaction, so a cancelled form never leaves an orphan tag (AD-25)
**And** tag names are normalized (NFC, trimmed, collapsed spaces, max 40 characters), so "BBQ " and "bbq" reuse the same tag (AD-24)
**And** the `tags` module owns `recipe_tag`, `recipes` imports `tags` and never the reverse, and the import-linter contract enforces it
**And** recipe cards and the detail page show the tags

### Story 3.4: Edit a recipe with original-value tracking

As an editor,
I want to change a recipe's quantities and still see what the original said,
So that I can tune recipes to my taste without losing the source (FR6, FR7, FR8).

**Acceptance Criteria:**

**Given** a saved recipe
**When** I tap "עריכה" on the detail page and save changes
**Then** `/recipes/:id/edit` opens the same form prefilled, and `PUT /api/recipes/{id}` replaces the aggregate, matching ingredients by `id`. An `id` from another recipe returns 422, omitted ingredients are deleted, and rows without an `id` are inserted (AD-20)
**And** the first change to an existing ingredient's amount or unit stores its original. Further changes keep the first original (1 tsp → 2 tsp → 3 tsp keeps "1 tsp"). Changing to or from to-taste counts as a change. Name-only or note-only edits never create an original. New ingredients never get one (FR7)
**And** comparisons use amounts quantized to 3 decimals (AD-31)
**And** the detail page and the edit form show "במקור {amount} {unit}" under hinted ingredients, in the `hint` colour, scaled together with the servings, and linked with `aria-describedby` (FR8, UX-DR10)
**And** `updated_at` and `updated_by` change on save
**And** the seed now adds one recipe with a hinted ingredient (by create, then update, through the service) (FR12)
**And** unit tests cover every rule in the original-value truth table with 100% branch coverage (NFR-2)

### Story 3.5: Reset an ingredient to its original

As an editor,
I want to put an ingredient back to its original amount with one click,
So that I can undo my tweaks when the original was better (FR9).

**Acceptance Criteria:**

**Given** a hinted ingredient in the edit form
**When** I tap "חזרה למקור"
**Then** the amount and unit fields return to the original values. The hint stays until I save, and typing a different value undoes the reset
**And** after saving, the server sees the amount and unit equal to the original, clears both original fields, and the ingredient looks as if it had never been edited (AD-4)
**And** this works for thirds (⅓ saved as 0.333) and for an original that was to-taste
**And** the e2e-ready test path is: edit cumin 1→2 tsp, save, see the hint, reset, save, and the hint is gone

### Story 3.6: Delete a recipe

As an editor,
I want to delete a recipe I didn't like, after confirming,
So that my library stays clean (FR10).

**Acceptance Criteria:**

**Given** a recipe's detail page
**When** I tap "מחיקה"
**Then** a confirm dialog says "המתכון '{title}' יימחק לצמיתות.", with focus starting on "ביטול" (UX-DR15)
**And** "ביטול" changes nothing
**And** confirming calls `DELETE /api/recipes/{id}` (editor), which removes the recipe with its ingredients, steps and tag links. I return to the library with my filters intact and a toast "המתכון נמחק"
**And** deleting a recipe that no longer exists returns 404, and the UI shows the non-blocking toast "המתכון כבר נמחק"

### Story 3.7: Recipe photos: upload, replace, remove

As an editor,
I want to add a photo to a recipe, or replace or remove it,
So that recipes look appetising in the library and on the detail page (FR4 photo, FR1, FR5).

**Acceptance Criteria:**

**Given** the recipe form
**When** I pick an image
**Then** `uploadPhoto()` in `libs/data-access` sends it to `POST /api/photos` (editor) with progress shown as a thumbnail and bar, and receives an unattached `photo_key` (AD-27, UX-DR12)
**And** the limits (JPEG/PNG/WebP, max 10 MB) come from config through OpenAPI and are shown beside the field. Larger or other files are rejected with 413/415 and a clear message
**And** the server applies EXIF orientation, strips metadata, guards against huge pixel counts, and stores WebP at max 1600 px plus a 600 px thumbnail through the `PhotoStorage` port on the local `/data` volume (AD-14)
**And** saving the recipe attaches the key. Replacing or removing the photo, or deleting the recipe (Story 3.6), detaches it and deletes the old files after commit. Unattached keys older than 24 h are swept at startup
**And** read schemas return `photo: {url, thumb_url, credit_domain} | null` built by the server. Cards use the thumbnail and the detail page uses the board-shaped photo (4:3 on phone, 16:9 from `lg`) (UX-DR7, UX-DR8)
**And** `/media/*` is served by FastAPI and is never answered by the SPA fallback. Images are lazy-loaded with width and height set (NFR-11)
**And** the seed adds openly licensed sample photos with their credits

## Epic 4: Organise with meal types and tags

Editors manage the meal-type list and the tags, and everyone can filter the library by tags.

### Story 4.1: Manage meal types and tags

As an editor,
I want one screen to add, rename and delete meal types and tags,
So that my categories stay tidy (FR23).

**Acceptance Criteria:**

**Given** I'm signed in as an editor
**When** I open "תגיות וסוגי ארוחה" from the account menu
**Then** `/tags` shows two lists, meal types and tags, each with inline rename and add (UX-DR18)
**And** the page lives in a new `libs/feature-tags` (tag `type:feature`) as a lazy subpath export (AD-2, AD-11)
**And** renaming updates every recipe that uses it, and a duplicate name (after normalization) returns 409 `tag_name_taken`
**And** deleting a tag opens a confirm dialog with its usage count ("התגית משויכת ל־7 מתכונים"), and confirming detaches it from all recipes
**And** deleting a meal type that recipes use returns 409 `meal_type_in_use` with the count in `params`, and the UI explains it. An unused meal type can be deleted
**And** after any change, the tags, the library list and recipe details are invalidated (AD-19)
**And** only `tags.service` changes tags (AD-7), and API tests cover every rule

### Story 4.2: Filter the library by tags

As a visitor,
I want to narrow the library by one or more tags,
So that I can find, for example, all barbecue party dishes (FR3 tags).

**Acceptance Criteria:**

**Given** the library
**When** I tap "תגיות"
**Then** a sheet (phone) or popover (desktop) lists every tag with checkboxes (UX-DR11)
**And** selected tags appear as removable chips under the search field, and a recipe must have all of them (AND)
**And** the tag filter combines with search and meal type, is kept in `?tags=<uuid>,<uuid>`, ignores unknown ids, and survives going to a recipe and back
**And** "ניקוי החיפוש" in the no-results state clears the tags too
**And** the filter function in `libs/recipe-domain` gains tag tests

## Epic 5: AI import

Editors import a recipe from a link or from pasted text, get a Hebrew draft from Ollama (local) or Gemini, review it, and save.

### Story 5.1: Spike: Ollama vs Gemini on real recipes

As Adi,
I want to measure Ollama and Gemini on real recipes before building the feature,
So that the default engine is chosen on real numbers (AD-12).

**Acceptance Criteria:**

**Given** Ollama installed as the native Windows app (a 7B model, e.g. qwen) and a Gemini free-tier key
**When** a standalone script under `tools/llm-spike/` runs about 5 real recipes (2 English pages, 3 Hebrew) through both, with the `DraftRecipe` JSON schema as the required output
**Then** a results table records per recipe and engine: time, schema-valid yes/no, Hebrew quality (1–5, judged by Adi), units mapped correctly, and to-taste handling
**And** the outcome is recorded in the architecture memlog: the default engine, the Ollama model name, and the timeout values
**And** no app code is changed, and the script reads keys only from env

### Story 5.2: Import from pasted text

As an editor,
I want to paste a recipe's text and get it as a ready-to-edit recipe in Hebrew,
So that I don't retype recipes by hand (FR18, FR21, FR24).

**Acceptance Criteria:**

**Given** I'm signed in as an editor
**When** I open "ייבוא", choose the "הדבקת טקסט" tab, paste text and submit (the page lives in a new `libs/feature-import`, tag `type:feature`, as a lazy subpath export; AD-2, AD-11)
**Then** `POST /api/imports/text` (editor) calls the default provider through the `LlmProvider` registry, which in this story has the `ollama` and `fake` adapters and returns a `DraftRecipe` validated by Pydantic (AD-12, AD-22)
**And** the draft is in Hebrew (translated if the source is in another language), its units are mapped to the `Unit` enum, unquantifiable ingredients are to-taste, and unmappable units are empty with the original text kept in the note (FR19, FR21)
**And** the draft pre-picks a meal type and suggests tags, preferring existing ones (FR24)
**And** the create form opens prefilled through router state (never the URL), via `draftToFormValues()`, and nothing is saved until "שמירה" (AD-22)
**And** text with no recipe returns `no_recipe_found` ("לא נמצא מתכון בטקסט הזה"), and the text stays for editing
**And** every import writes an `import_log` row (user, provider, ms, tokens, outcome), and the daily cap returns 429 `import_cap_reached` (AD-29)
**And** the import dialog is a dialog on desktop and a full page on phone (UX-DR13)
**And** tests use the deterministic `fake` provider (`FAKE:<scenario>`), so CI never calls a real model

### Story 5.3: Review the draft before saving

As an editor,
I want the imported draft clearly marked where it needs my attention,
So that I can complete it quickly and save with confidence (FR19, FR24).

**Acceptance Criteria:**

**Given** a draft opened in the create form
**When** the form renders
**Then** a banner in the `flag` colour shows "N שדות דורשים השלמה" (plus "המתכון תורגם מאנגלית" when translated), driven by the server's `missing_fields` (UX-DR14)
**And** each missing field has a 2 px `flag` border and "יש להשלים", which clears once filled
**And** suggested new tags appear as chips that I can keep or remove, and they're created only if I save (AD-25)
**And** the source URL is kept and shown on the saved recipe's detail page as a link
**And** "ביטול" discards the draft, and reloading `/recipes/new` without router state shows an empty form

### Story 5.4: Import from a URL

As an editor,
I want to paste a recipe page's link and get the recipe with its photo,
So that importing from cooking sites takes seconds (FR17).

**Acceptance Criteria:**

**Given** the "קישור" tab
**When** I paste a URL and submit
**Then** `POST /api/imports/url` (editor) fetches it only through `app/core/safe_fetch.py`: http/https only, public addresses only (re-checked on every redirect), with size and time caps (AD-13, AD-23)
**And** schema.org Recipe JSON-LD (via recipe-scrapers) is used first. Otherwise readable text (via trafilatura) is used. The LLM always runs to translate, map units and suggest tags
**And** the main photo URL (`Recipe.image`, else `og:image`) comes back as `photo_source_url`. The review form shows it with "הסרה"/"החלפה", and on save it is uploaded through `POST /api/photos {source_url}` via safe fetch, with the source domain stored as credit (AD-27)
**And** blocked, failed or too-large fetches return `fetch_blocked`, `fetch_failed` or `fetch_too_large`, and the UI offers a one-click switch to "הדבקת טקסט" (FR17)
**And** tests cover SSRF cases (localhost, private IPs, a redirect to a private IP) with the fake fetcher and fixture pages (`fake://<fixture>`)

### Story 5.5: Progress, cancel, engine choice and errors

As an editor,
I want to see the import working, cancel it, and switch to Gemini if the local model is slow or weak,
So that slow local imports are still usable (FR20).

**Acceptance Criteria:**

**Given** an import is running
**When** I watch the dialog
**Then** it shows client-timed phase text ("מביאים את הדף…", "קוראים את המתכון…", "מארגנים…") with an indeterminate bar and "ביטול" (AD-22)
**And** "ביטול" aborts the request, and the server stops waiting on the provider where possible
**And** `GET /api/imports/providers` returns `[{name, timeout_s}]`, and the client aborts at `timeout_s + 5`. The Vite proxy and uvicorn timeouts exceed the largest provider timeout
**And** the `gemini` adapter (google-genai SDK, model from `GEMINI_MODEL`, structured output validated by the same `DraftRecipe`) is added to the registry and enabled when `GEMINI_API_KEY` is set
**And** the dialog has an engine choice (מקומי / Gemini) listing only enabled providers, defaulting to the configured default and remembering the last choice
**And** `llm_timeout`, `llm_unavailable`, `llm_quota` and `llm_invalid_output` show readable Hebrew messages with "לנסות שוב" and, when Gemini is enabled, "לנסות שוב עם Gemini". Nothing is saved
**And** an unknown or disabled provider returns 400 `provider_unavailable`

## Epic 6: Ready to show

The app runs as one production container with backups and logs, passes its performance budgets and end-to-end tests in CI, and has a README that tells its story.

### Story 6.1: One production container

As Adi,
I want to run the whole app with `docker compose up`,
So that it works like production on any machine (NFR6).

**Acceptance Criteria:**

**Given** Docker is installed
**When** I run `docker compose up`
**Then** a multi-stage Dockerfile builds the SPA and the API into one image, where FastAPI serves the SPA (with an `index.html` fallback only for non-`/api` and non-`/media` HTML requests), `/api/*` and `/media/*` (AD-15)
**And** SQLite and the photos live on a `/data` volume and survive restarts, and migrations run on start
**And** the container `HEALTHCHECK` calls `/api/health`
**And** `OLLAMA_URL` defaults to `http://host.docker.internal:11434` under compose
**And** static assets get immutable cache headers, and `/media` gets long-lived caching

### Story 6.2: Logging and backups

As Adi,
I want readable logs and a one-command backup,
So that I can debug problems and never lose my recipes (AD-29).

**Acceptance Criteria:**

**Given** the app running in dev or prod
**When** requests are handled
**Then** logs are pretty in dev and JSON in prod, each carrying a request id. Passwords, cookies and API keys are redacted
**And** each import logs one line (provider, ms, tokens, outcome)
**And** `nx run recipe-service:backup` (`app.cli backup`) writes a timestamped archive containing a `VACUUM INTO` copy of the database and the photos
**And** the README documents how to restore from that archive, and the restore is tested once

### Story 6.3: End-to-end tests in CI

As Adi,
I want the key flows tested in a real browser on every push,
So that a regression never reaches the demo (NFR2).

**Acceptance Criteria:**

**Given** an `apps/web-e2e` Playwright project
**When** CI runs `e2e`
**Then** it boots the API with `LLM_PROVIDERS=fake` on a temporary `DATA_DIR`, migrated and seeded, plus a test editor account
**And** three flows pass: (1) open a recipe and scale it to 10, checking the amounts; (2) log in, edit an amount, see the hint, reset to original, and see the hint gone; (3) import from fake text, complete the flagged fields, save, and see the recipe in the library
**And** an axe accessibility check runs on the library, detail and form pages with no serious violations (NFR5)
**And** the flows run at 375 px and at desktop width

### Story 6.4: Performance budgets

As Adi,
I want the app's speed checked automatically,
So that it stays fast on a mid-range phone (NFR3, NFR11).

**Acceptance Criteria:**

**Given** the production build
**When** `nx run web:size` runs in CI
**Then** size-limit fails the build if the initial JS exceeds 200 KB gzip
**And** visitor routes don't download the editor, login, import, tags or users code (verified by checking the chunks)
**And** a Lighthouse run on the library and detail pages (mobile profile) scores at least 90 for performance with LCP under 2.5 s, run manually and recorded in the README, or in CI if it's stable
**And** with 200 seeded recipes the library first render is under 1 s and the detail page under 500 ms

### Story 6.5: README for recruiters

As Adi,
I want a README that explains the app and its architecture in minutes,
So that a reviewer can follow the project quickly (NFR9).

**Acceptance Criteria:**

**Given** a reviewer opens the repository
**When** they read the README
**Then** it explains what ביס & סיר is (with screenshots), how to run it (`npm run dev` and `docker compose up`), the env settings, and how to create the admin and seed the data
**And** it shows the architecture at a glance (a diagram plus the key decisions) and links to `ARCHITECTURE-SPINE.md`, the PRD and the UX docs
**And** it lists the quality gates (CI, tests, budgets) and the tech stack with the reasons behind each choice
**And** a reader new to the project can follow the architecture in under 10 minutes
