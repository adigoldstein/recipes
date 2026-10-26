# Architecture Spine Review — Rubric Pass

- **Reviewed:** `../ARCHITECTURE-SPINE.md` (draft, 2026-10-26)
- **Against:** PRD `prd.md` + `addendum.md`, UX `EXPERIENCE.md` / `DESIGN.md`, existing code in `apps/web` and `apps/recipe-service`
- **Reviewer stance:** independent, rubric-driven. The spine was not edited.

## Verdict

The spine is strong on the core seams: layering, the OpenAPI contract, the recipe aggregate and the original-value rule, auth, the LLM port, and RTL. It is **not ready to finalize**. Several divergence points that independently built stories will hit are still open: the list/search API shape, the photo API and lifecycle, how the import draft reaches the form, and meal-type bootstrap. It also leaves most of the operational envelope (logging, backups, per-environment config, health) undecided, and it silently contradicts the existing backend folder layout.

Counts: critical 0 · high 7 · medium 13 · low 9

---

## Rubric scorecard

| Criterion                                             | Result  | Notes                                                                                                                                    |
| ----------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Fixes real divergence points, misses none             | Partial | Misses list/search API (H-1), photo API/lifecycle (H-2), draft hand-off (H-3), meal-type bootstrap (H-4), session discovery/logout (M-1) |
| Every AD Rule enforceable and prevents its divergence | Mostly  | Tokens-only and RTL lint have no named mechanism (M-8); AD-1 has no import-linter (L-2); AD-4 float equality (M-6)                       |
| Nothing Deferred/Open lets units diverge              | Mostly  | Deferring deployment is fine, but backup/secure-cookie/config-per-env are mis-filed as "after MVP" (H-6)                                 |
| Ratifies, not contradicts, brownfield                 | **No**  | `app/api`, `app/db`, `app/models` and `/health` not addressed (H-5); no Python typecheck target (M-10)                                   |
| Covers every PRD capability incl. quiet reqs          | Partial | Photo limits (H-2), scaled hint (M-3), import phase feedback (M-4), seed (H-4/L-5), bundle tool (M-9), NFR-3/4/5/9 not mapped (M-12)     |
| Operational envelope decided/deferred/open            | **No**  | Logging, observability, backups, env matrix and health check are all absent (H-6)                                                        |

---

## Findings

### High

**H-1 — Library list/search/filter API is undecided**

- **Location:** AD-8 (List filters), Capability map row "F1", Consistency Conventions
- **Issue:** AD-8 puts `?q=&meal=&tags=` in the browser URL, but nothing says whether filtering happens on the server (`GET /api/recipes?q=&meal=&tags=`) or on the client (fetch all, filter in memory). It also doesn't fix the list payload: summary DTO or full aggregate, pagination or none, sort order. The library story and the recipes-API story will each pick one. NFR-3 (<100 ms per keystroke with 200 recipes) and FR-1 (cards need meal type, tags, total time, thumbnail) depend on this choice.
- **Fix:** Add an AD (or extend AD-4). Recommended: `GET /api/recipes` returns an unpaginated `RecipeSummary[]` (id, title, meal_type, tags, total_minutes, thumb_url, created_at), sorted `created_at desc`. The client filters in memory with `useDeferredValue` (A-1: a few hundred recipes max). State that `q` uses case-insensitive substring matching on title and that `tags` uses AND semantics, and where that logic lives (one pure function, unit-tested). If server-side filtering is preferred, fix the query param names and semantics in the contract instead.

**H-2 — Photo API, lifecycle and upload limits are not fixed**

- **Location:** AD-14, AD-4 ("photo key"), PRD FR-4 AC (limits shown beside field), EXPERIENCE "Photo upload" state, FR-19 (imported photo kept/removed)
- **Issue:** AD-14 decides the storage and encoding but not the contract. These questions are open:
  - Is there an upload endpoint (`POST /api/photos` → `{photo_key}`) before the recipe is saved, or a multipart field on the recipe save?
  - What happens to photos uploaded and then abandoned (orphans)?
  - Are files deleted when the photo is replaced or the recipe is deleted?
  - How does the imported-photo URL travel in the create payload, given that AD-4 only carries `photo_key` and AD-14 says imports download "on save"?
  - Where is the source-domain credit stored? (`photo_credit` is not in the AD-4 field list.)
  - **What are the allowed types and maximum size?** The PRD and UX explicitly defer these to architecture, and the UI must show them.
  - What is the thumbnail and URL naming scheme?

  The form story, the photos story and the import story will each invent their own answer.

- **Fix:** Extend AD-14 with:
  - Accepted MIME types (e.g. JPEG/PNG/WebP/HEIC-if-Pillow-supports), a max upload size (e.g. 10 MB) and a max pixel count (Pillow `MAX_IMAGE_PIXELS` decompression-bomb guard). Apply EXIF orientation, then strip metadata.
  - `POST /api/photos` (owner) accepts either a multipart file or `{source_url}` and returns `{photo_key, url, thumb_url}`. Imported photos go through this endpoint at save time, via the AD-13 safe fetcher (see H-7).
  - The recipe aggregate carries `photo_key` + `photo_credit`.
  - `recipes.service` calls `photos.service.delete(key)` on replace/remove/recipe delete. Unreferenced keys older than N hours are swept on startup.
  - URL scheme `/media/{key}.webp` and `/media/{key}_thumb.webp`. Cards use the thumbnail.
  - Put the limits in one config constant, exposed via OpenAPI (or a `GET /api/config`) so the UI hint never drifts from the server check.

**H-3 — Import-draft hand-off to the recipe form is undecided**

- **Location:** AD-12 ("drafts are never persisted"), EXPERIENCE route `/recipes/new?draft=…`, FR-19
- **Issue:** The draft is not stored on the server, but the UX routes to `/recipes/new?draft=…`. Nothing says how the draft gets there: router state, an in-memory context, a query param (it is too large for that, and NFR/privacy rules forbid data in URLs), or sessionStorage. Nothing covers what happens on refresh either. The form also needs to know which fields are "needs completing" (FR-19 flags), and the `DraftRecipe` → `RecipeCreate` mapping (suggested _new_ tags that only get created on save, FR-24) has no defined owner. The import story and the form story will diverge.
- **Fix:** Add a rule:
  - The draft travels as router navigation state (or a small `ImportDraftContext`). The `?draft=` param is a marker only; a refresh without state redirects to `/import`.
  - `DraftRecipe` includes an explicit `missing_fields: list[str]` and `suggested_new_tags: list[str]`.
  - One mapping function in `libs/data-access` converts a draft into RHF default values.
  - New tags are created inside the recipe save (AD-4 accepts `tag_names` for new tags) or via `tags.service` before save. Pick one and say so in AD-7.

**H-4 — Meal-type bootstrap and seeding are ambiguous; a fresh DB is unusable**

- **Location:** AD-18 ("Seed data … runs only by explicit command"), AD-7, PRD Recipe content ("owner-editable list seeded with Breakfast…"), FR-12
- **Issue:** A meal type is required on every recipe (AD-7, 422 otherwise). If the eight default meal types arrive only with the explicit demo-seed command, a freshly migrated DB cannot accept any recipe or import, which breaks NFR-6 ("one command starts the whole app"). The spine also doesn't say how the seed creates an ingredient with an original-value hint (FR-12) without either bypassing `recipes.service` (which would violate AD-4's "only recipes.service applies FR-7–9") or doing a create-then-update. Nor does it say where the CLI commands (seed, create-owner) live.
- **Fix:**
  - Default meal types are inserted by an Alembic **data migration** (idempotent, Hebrew names). The demo seed is separate and optional.
  - The seed goes through `recipes.service`, creating the recipe and then updating it, so originals are produced by the real rule.
  - Name one CLI entry point (e.g. `python -m app.cli seed|create-owner`, wrapped as Nx targets `recipe-service:seed` / `:create-owner`) and state that seed idempotency is keyed on recipe title.

**H-5 — Spine contradicts the existing backend layout instead of ratifying it**

- **Location:** AD-1, Structural Seed vs `apps/recipe-service/app/{api,db,models,core}` and `app/main.py`
- **Issue:** The brownfield scaffold is **layer-first**. `app/api/` holds routers (`health.py`), `app/db/` holds "engine, sessions and migrations support", and `app/models/` holds "SQLModel entities and Pydantic schemas". `/health` is mounted at root, not under `/api`. The spine prescribes feature-first `app/<module>/` with db inside `app/core`, and it never mentions the existing packages or the health route. The first story will either keep both structures or make an unrecorded move. Also, `react-router-dom@6.30.3` is installed and AD-11 mandates v8 without saying the upgrade is an explicit story task. `package.json` has no `dev` script, but AD-15 assumes `npm run dev`.
- **Fix:** Add a short "Brownfield ratification" note:
  - `app/api/health.py` moves to `app/core/health.py` (or stays), and is mounted at `/api/health` (also used by the container healthcheck).
  - `app/db` folds into `app/core/db.py`.
  - `app/models` is deleted in favor of per-module `models.py`, with an `app/models.py`/`app/core/metadata.py` that imports all module models so Alembic autogenerate sees them.
  - The first web story replaces `react-router-dom@6.30.3` with `react-router@8`.
  - The root `dev` script is defined as `nx run-many -t serve dev -p recipe-service web`.

**H-6 — Operational envelope is largely undecided (logging, backups, env matrix, health)**

- **Location:** Whole spine. Deferred only covers "Deployment host" and S3.
- **Issue:** The rubric requires every dimension at this altitude to be decided, deferred or open. Missing entirely:
  - **Logging/observability:** format, level, request id, logging of LLM calls (provider, latency, tokens, for the OQ-2 cost ceiling), and what must never be logged (passwords, cookies, provider keys).
  - **Backups** of the `/data` volume (SQLite + photos). PRD OQ-1 names this explicitly, and real data exists locally from day one. An SQLite file can't be copied safely while it is being written.
  - **Environments and per-environment config:** dev (Vite proxy, http), compose (http://localhost), prod (https). No list of required env vars, no `.env.example`, and no fail-fast rule when `JWT_SECRET` is missing.
  - **Health/readiness:** `/health` exists but isn't in the spine, and there is no container `HEALTHCHECK`.
  - **Startup-migration failure behavior.**
- **Fix:** Add an AD-19 "Operational envelope" covering:
  - Python `logging` with JSON (prod) / pretty (dev) output, a request-id middleware, a redaction list, and one structured log line per import (provider, ms, tokens, outcome).
  - An env matrix table: `ENV`, `DATABASE_URL`/`DATA_DIR`, `JWT_SECRET` (required, fail fast), `COOKIE_SECURE`, `LLM_PROVIDER`, `OLLAMA_URL`, `GEMINI_API_KEY`, `IMPORT_DAILY_CAP`, `LOG_LEVEL`. Commit `.env.example`; `.env` is gitignored.
  - A backup command (`recipe-service:backup` using `sqlite3 .backup` / `VACUUM INTO` + a tar of `/data/photos`) with a documented restore. Scheduling is deferred with the host.
  - `GET /api/health` as the Docker `HEALTHCHECK`.
  - If startup migration fails, the app exits non-zero.

  Move "where backups go in prod" under Deferred alongside OQ-1.

**H-7 — Imported-photo download bypasses the SSRF guard**

- **Location:** AD-14 ("Imported photos are downloaded on save"), AD-13
- **Issue:** AD-13's safe-fetch rules (public addresses only, DNS re-check on every redirect, size/time caps) are scoped to the "import pipeline". The photo download happens later, in `photos.service`, from a URL the client sends back. A separate implementer can write a plain `httpx.get(url)`, which opens an owner-authenticated SSRF and an unbounded download.
- **Fix:** Lift the safe fetcher into `app/core/safe_fetch.py` and state as a rule: "every server-side outbound HTTP fetch of a user-supplied or page-supplied URL goes through `core.safe_fetch`". Image downloads also cap bytes (same max as uploads) and check the content type.

### Medium

**M-1 — Session discovery and logout with an httpOnly cookie are unspecified**

- **Location:** AD-6, AD-8 ("auth session view"), FR-15, FR-16 AC (visitors redirected from edit URL)
- **Issue:** JS can't read an httpOnly cookie, so the SPA needs a server endpoint to learn whether the owner is logged in (to show or hide owner controls, and to guard owner routes before any mutation). Logout must also clear the cookie server-side. Neither endpoint is named, so the auth story and the UI stories will diverge.
- **Fix:** Add `GET /api/auth/me` → `200 {email}` or `401`, `POST /api/auth/login`, and `POST /api/auth/logout` (clears the cookie). The session context is a TanStack query on `/auth/me`. Lazy owner routes use a loader/guard that redirects to `/login?next=`.

**M-2 — The `Secure` cookie breaks phone testing over the LAN**

- **Location:** AD-6, NFR-4 (mobile-first, kitchen phone use)
- **Issue:** `Secure` cookies aren't set over `http://192.168.x.x`, so logging in from a phone against the dev or compose instance silently fails.
- **Fix:** Make `COOKIE_SECURE` a config flag (default true; false allowed only when `ENV=dev`). Document it in the env matrix (H-6).

**M-3 — Scaling rules are not pinned, and the scaled hint is missing**

- **Location:** AD-8 ("Scaling: local component state"), Capability map "F6 … libs/data-access pure function"
- **Issue:** FR-8 AC requires the original-value hint to scale by the same ratio. FR-11 requires specific rounding: integers, at most 2 significant decimals, and nearest ½ for `unit`-type ingredients. The spine names neither, so the detail-page story and the hint story can scale differently. Putting the pure function in `data-access` (the generated-API lib) also mixes concerns.
- **Fix:** Add one rule: "one pure `scaleAmount(amount, unit, ratio)` + `formatAmount()` is used for both current and original amounts; to-taste is never scaled". Choose its home with Adi (recommendation: `libs/recipe-domain`, or a non-generated `src/domain` folder inside data-access) and tag it for 100% branch coverage.

**M-4 — Import progress phases conflict with the "one synchronous request" design; timeout conflicts with UX**

- **Location:** AD-12 vs EXPERIENCE "Import dialog" (phase text fetching/reading/organising, "Hard timeout at 60s")
- **Issue:** A single synchronous request can't report real phases, so the UI must fake them. The spine doesn't say so, and implementers may add SSE/polling. UX says 60 s; AD-12 says about 180 s for Ollama. Also, client cancel doesn't stop server-side Ollama generation, and the Vite dev proxy and uvicorn have default timeouts that may cut a 180 s request.
- **Fix:**
  - State that phase text is client-timed (cosmetic), with no streaming in the MVP.
  - The client timeout equals the provider timeout plus a margin, overriding the UX 60 s note (record this as a UX amendment).
  - Configure the Vite proxy `timeout`/`proxyTimeout` ≥ 200 s.
  - The server handler checks `request.is_disconnected()` and cancels the provider call where possible.
  - Cancelled requests do (or don't) count toward the daily cap; pick one.

**M-5 — SQLite specifics that affect correctness are not fixed**

- **Location:** AD-18, AD-4, FR-10 (cascade delete)
- **Issue:** SQLite ignores foreign keys unless `PRAGMA foreign_keys=ON` is set on every connection, so cascade delete of ingredients, steps and `recipe_tag` can silently fail or be implemented differently per story. Alembic on SQLite needs `render_as_batch=True` for ALTERs. WAL mode matters for safe backups (H-6).
- **Fix:** Add to AD-18: an engine `connect` event sets `foreign_keys=ON` and `journal_mode=WAL`; FKs are declared `ON DELETE CASCADE` for child rows; Alembic `env.py` uses `render_as_batch=True`.

**M-6 — Original-value equality and amount type are undefined**

- **Location:** AD-4 ("set back to equal the original")
- **Issue:** With float amounts, `0.33` vs `0.33000000001` breaks the reset rule. Transitions involving null amounts (to-taste ↔ quantified) and unit-only changes from null aren't spelled out, and the 100%-branch tests may encode different interpretations.
- **Fix:** Fix the amount type (`Decimal` with 3 dp on the wire as a number, or float compared with a tolerance). Add a short truth table: amount/unit change → set original if absent; equal to original → clear; null↔value counts as a change; name/note-only edits → no change. Also: PUT with an ingredient `id` that doesn't belong to the recipe → 422.

**M-7 — The fixed unit list has no single source**

- **Location:** PRD Recipe content (fixed unit list), FR-19/21 (LLM maps to the list), EXPERIENCE (Hebrew singular/plural labels), AD-12
- **Issue:** The backend validator, the LLM prompt/schema, the form select and the i18n map each need the same 13 units. The spine doesn't say where they are defined.
- **Fix:** Define a Python `Unit` `StrEnum` in `recipes/schemas.py`. It flows to OpenAPI → generated TS enum and Zod, and is used in `DraftRecipe`'s JSON schema. `he.json` has `unit.<code>.one/other` keys, and a unit test asserts every enum member has labels.

**M-8 — "Tokens only" and the RTL lint have no enforcement mechanism**

- **Location:** AD-2, AD-10, Conventions "Styling", CLAUDE.md
- **Issue:** The rules say "lint bans …" and "design tokens only" without naming a tool. Tailwind v4 with ESLint needs a specific plugin or custom rule. Without one, the rule is honor-system, and stories will diverge (arbitrary values `p-[13px]`, `style={{}}`, hex colors).
- **Fix:** Name the mechanism: an ESLint `no-restricted-syntax` / custom rule (or `eslint-plugin-better-tailwindcss`) banning physical-direction utilities, arbitrary values `\[[^\]]*\]` in `className`, the `style` prop in `libs/ui-components`, and hex/rgb literals in TS/CSS outside the theme file. Make it part of the `lint` target CI runs.

**M-9 — The bundle-budget and performance tooling is not chosen**

- **Location:** AD-17 ("bundle-size budget (NFR-11)"), NFR-11 ("concrete tools are chosen in the architecture step")
- **Issue:** The PRD delegates the tool choice to this step, and the spine names none. The Lighthouse ≥ 90 / LCP target has no check.
- **Fix:** Pick one: `size-limit` (or a Vite `build` check of the gzipped initial chunk ≤ 200 KB) as an Nx target `web:size`. Optionally run Lighthouse CI on the built SPA, or explicitly defer the Lighthouse check to manual verification.

**M-10 — No Python type-check target, though NFR-1 and AD-17 require one**

- **Location:** AD-17 (`nx affected -t … typecheck …`), `apps/recipe-service/project.json` (no `typecheck` target), NFR-1
- **Issue:** CI would silently skip Python type-checking, which is exactly the divergence AD-17 claims to prevent.
- **Fix:** Pick mypy (strict, with the pydantic plugin) or pyright, and add a `typecheck` target to `recipe-service`. Also note that `nx affected` in GitHub Actions needs `nrwl/nx-set-shas` and that `uv` must be installed (`astral-sh/setup-uv`).

**M-11 — OpenAPI generation pipeline details are missing**

- **Location:** AD-3
- **Issue:** It doesn't say how the schema is produced (running server vs `app.openapi()` dumped by a script), where `openapi.json` lives (committed?), which Nx target owns it, or how data-access depends on it. hey-api's generated Zod schemas won't carry Hebrew messages, and cross-field rules (e.g. at least one ingredient) must exist in Pydantic to flow through. The CSRF header (AD-6) needs a client interceptor in data-access.
- **Fix:** Name it: `recipe-service:openapi` writes `libs/data-access/openapi.json` (committed) via `python -m app.export_openapi`. `data-access:generate` depends on it, and CI runs both, then `git diff --exit-code`. Validation constraints live in Pydantic (`min_length=1`, `ge=1, le=100`). Hebrew messages come from a Zod error map keyed by issue code in i18n. `libs/data-access` configures the client once with `credentials: 'same-origin'` and the `X-Requested-With` header.

**M-12 — The capability map omits several PRD items**

- **Location:** Capability → Architecture Map
- **Issue:** It has no rows for F7 seed, NFR-3 performance, NFR-4 mobile-first, NFR-5 a11y, NFR-7 tokens, NFR-9 README/ADR, or NFR-10 security (only partially via AD-6/13). The frontmatter claims `binds: NFR-1..12`.
- **Fix:** Add rows: F7 → AD-18/H-4 CLI; NFR-3 → H-1 decision + AD-8; NFR-4 → Tailwind mobile-first breakpoints (unprefixed = phone) in Conventions; NFR-5 → Radix/shadcn primitives + `jsx-a11y` lint + an axe check in Playwright; NFR-7 → M-8; NFR-9 → README links to this spine; NFR-10 → AD-6, AD-13, H-6 env.

**M-13 — Rate-limit and import-cap mechanisms are unspecified**

- **Location:** AD-6 ("5 per minute"), AD-13 ("daily import cap", "max_tokens cap")
- **Issue:** No library or storage is named. An in-memory limiter resets on restart, and the cap values aren't set. PRD OQ-2 also asks for a monthly cost ceiling, which the spine doesn't close.
- **Fix:** Name the approach, e.g. `slowapi` in-memory keyed by client IP, which is acceptable for a single process (note it). The daily cap is counted in a small `import_log` table (which also serves logging). Values come from config (`IMPORT_DAILY_CAP=20`, `LLM_MAX_TOKENS=4096`). Record that Ollama makes the cost ceiling moot for now, and that the ceiling is to be revisited with the Haiku adapter (Open).

### Low

**L-1 — The error convention lacks 409/413/429**

- **Location:** Conventions "Errors"
- **Fix:** Add: 409 for a duplicate tag rename or deleting a meal type that is in use (with `{detail, count}`); 413 for an oversized upload; 429 for rate limits and the import cap; 502/504 for provider failure/timeout. Map each to the EXPERIENCE messages.

**L-2 — AD-1 boundaries are not mechanically enforced**

- **Location:** AD-1
- **Fix:** Add `import-linter` contracts (layers per module; no cross-module repository/model imports) to the `lint` target. Without this, AD-1 is honor-system, unlike AD-2's Nx tags.

**L-3 — Nx tag names for AD-2 are not specified**

- **Location:** AD-2
- **Fix:** Fix the tags (`type:app`, `type:data-access`, `type:ui`, `type:domain`) and the `depConstraints` so the scaffold stories create matching tags.

**L-4 — The SPA fallback can mask API 404s**

- **Location:** AD-15
- **Fix:** State that the `index.html` fallback applies only to non-`/api`, non-`/media` GETs that accept `text/html`. Unknown `/api/*` returns a JSON 404. Static assets get immutable cache headers, and `/media` gets long-lived caching (keys are content-addressed or versioned).

**L-5 — The e2e project, and how it boots the app, are missing**

- **Location:** AD-16, Structural Seed
- **Fix:** Add `apps/web-e2e` (Playwright) to the seed. It boots the backend with `LLM_PROVIDER=fake` on a temporary `DATA_DIR`, runs migrations and seed, and creates a test owner from fixture credentials.

**L-6 — Ollama from inside Docker**

- **Location:** AD-15 ("Ollama runs as the native Windows app")
- **Fix:** Note that compose sets `OLLAMA_URL=http://host.docker.internal:11434`, while dev uses `http://localhost:11434`.

**L-7 — UUID storage format in SQLite**

- **Location:** AD-5
- **Fix:** State the storage format (SQLModel `uuid.UUID` → `CHAR(32)` hex) so hand-written migrations and seed scripts agree; the API always uses the hyphenated string form.

**L-8 — Search input responsiveness and case-folding**

- **Location:** AD-8 / NFR-3, NFR-11
- **Fix:** If client-side filtering is chosen (H-1), mandate `useDeferredValue`. Note that case-insensitive matching uses JS `toLocaleLowerCase` (Hebrew has no case; English titles do). SQLite `lower()` / `LIKE` are ASCII-only, which matters if the filter moves to the server.

**L-9 — The Stack table is missing chosen-but-unlisted tools**

- **Location:** Stack
- **Fix:** Add the Python type checker (M-10), the rate limiter (M-13), the bundle-size tool (M-9), the import linter (L-2), `uv`, and Radix `DirectionProvider`/shadcn RTL notes. "Current stable, pinned at scaffold" is fine, but name each package.

---

## What is good (keep as-is)

- AD-4 places the original-value rule in exactly one service, and the client never sends originals. This is the right seam and directly prevents the riskiest divergence.
- AD-3 makes generated-only API code with a CI drift check, which is a strong, enforceable contract.
- AD-6 uses a same-origin httpOnly cookie plus a CSRF header and one 401 handler. It is coherent with AD-15.
- AD-12/AD-16 add a `fake` provider and make the "never a real model in CI" rule explicit.
- AD-13 states the pipeline order and SSRF rules explicitly. Extend them per H-7.
- AD-10 puts RTL rules (logical utilities, `<bdi>`, i18n keys) at the spine level, where they belong.
- The Deferred items (host, S3, Zustand) sit behind ports or rules that keep units consistent.
