# Adversarial Review: Bite & Board PRD

- **Content:** `docs/prd.md` (document / docs class, behavior-defining)
- **Lens:** adversarial (`references/lens-adversarial.md`)
- **Date:** 2026-10-26
- **Context weighed:** personal/hobby-scale recipes app; Nx monorepo (React web + FastAPI recipe-service); PRD feeds UX, architecture, epics/stories.
- **Note on shape:** The shipped adversarial lens says "no severity". The caller asked for severity, so each finding carries an extra `severity` field (critical/high/medium/low) alongside the canonical fields `location`, `trigger_condition`, `guard_snippet`, `potential_consequence`.

## Verdict

**Not ready for downstream work.** This is a tech-stack memo with a feature sketch attached, not a PRD. It says almost nothing about who uses the product, what they need to do, or how anyone checks that a requirement is met. Meanwhile it locks in libraries, folder layouts and component patterns. UX gets no user flows. Architecture gets decisions already made but no quality attributes to test them against. Epics/stories get checklist items with no acceptance criteria and no FR IDs to trace back to. The core recipe loop (browse, view, create, edit, delete) is barely specified. The three feature areas that make this more than a CRUD app (scaling, shopping-list consolidation, AI import) each leave out the edge cases that decide their design.

**Counts:** 2 critical, 10 high, 10 medium, 4 low (26 total).

---

## Findings

### F1. No problem statement, users, goals, or testable requirements

- **severity:** critical
- **location:** general; §1 "Executive Summary & Vision"
- **trigger_condition:** The "vision" lists capabilities ("managing personal recipes, planning event menus...") and then moves straight to "Clean Architecture" and "seamless containerization via Docker". The PRD has no user/persona, no jobs-to-be-done, no success criteria, no numbered functional requirements (FRs), no acceptance criteria and no out-of-scope list.
- **guard_snippet:** Add sections for Problem & Users (even if the only user is "me, cooking for family/events"), Goals & Success Criteria, numbered FRs with acceptance criteria (e.g. FR-SCALE-1: "Given a recipe with base_servings 4, when target is 6, then each amount is ×1.5 and rounded per rule X"), Non-Goals, and NFRs.
- **potential_consequence:** Epics/stories will be invented by whoever writes them. Stories can't be traced or verified, and "done" means "the checkbox is ticked", not "the user can do the thing".

### F2. Core recipe lifecycle is incomplete: no update, no delete, no browse/detail/create UI

- **severity:** critical
- **location:** §6 Phase 1 "Implement CRUD endpoints (`GET /recipes`, `GET /recipes/{id}`, `POST /recipes`)"; §6 Phase 2; §4 `updated_at`
- **trigger_condition:** The section is labeled "CRUD" but only has Create and Read. No PUT/PATCH/DELETE, yet `updated_at` exists. Phase 2 never mentions a recipe list page, a detail page, or a create/edit form. "Implement client-side form validation using `Zod`" validates a form that is never specified.
- **guard_snippet:** Add FRs for list/browse, view detail, create, edit, and delete (including cascade to ingredients/steps). Add matching endpoints (`PUT/PATCH /recipes/{id}`, `DELETE /recipes/{id}`) and Phase 2 UI items: recipe list, recipe detail, recipe editor with dynamic ingredient/step rows.
- **potential_consequence:** The user can't fix a typo or a bad AI import. The most-used screens get built ad hoc with no UX spec, and every AI-import mistake becomes permanent.

### F3. "Smart Ingredient Substitution" appears from nowhere

- **severity:** high
- **location:** §6 Phase 3 "Implement Smart Ingredient Substitution endpoint."
- **trigger_condition:** A whole AI feature shows up as a single checklist line. It isn't in the Executive Summary or §5, and has no inputs, outputs, UI, or persistence behavior.
- **guard_snippet:** Either cut it (move to Non-Goals / Future) or give it a §5.4 spec: trigger (per ingredient? per recipe?), inputs (dietary constraint? pantry?), output shape, whether it changes the recipe or only suggests, and the UI surface.
- **potential_consequence:** Scope creep with no definition. Story writers will guess, or the feature will block Phase 3 sign-off.

### F4. AI import accepts URLs, but fetching and scraping is unspecified

- **severity:** high
- **location:** §5.3 "User pastes raw text or a recipe URL into the UI."
- **trigger_condition:** Nothing says who fetches the URL, how HTML gets turned into text, or what happens with JS-rendered pages, paywalls, cookie walls, timeouts, non-recipe pages, huge pages (token limits) or failed requests. Server-side fetching of user-supplied URLs is also an SSRF surface once deployed. schema.org `Recipe` JSON-LD, which most recipe sites publish, is not mentioned as a cheaper and more reliable path than an LLM.
- **guard_snippet:** Split into FR-IMPORT-TEXT and FR-IMPORT-URL. For URL: server-side fetch with timeout/size cap and an allowlist of http(s) schemes, private IP ranges blocked; try JSON-LD `Recipe` first and fall back to LLM extraction; define error messages for each failure class. Or explicitly scope MVP to pasted text only.
- **potential_consequence:** The "URL" half of the headline feature is undesignable as written. Architecture will miss a fetcher/scraper component and its security posture.

### F5. AI output goes straight into the database with no review step

- **severity:** high
- **location:** §5.3 "Result: Direct ingestion into SQLite via FastAPI."; §6 Phase 3 "Raw text -> Structured JSON -> Database save"
- **trigger_condition:** LLM output that passes Pydantic validation can still be wrong: hallucinated quantities, wrong units, merged steps, invented servings. The PRD writes it directly to the DB, with no preview/edit/confirm step and no handling for validation failure or retries.
- **guard_snippet:** Require a preview-and-edit step: the importer returns a draft, the user edits it in the standard recipe editor (see F2), then saves explicitly. Specify behavior when validation fails after N `instructor` retries (show partial draft + error). Store `source_url`/`source_text` for provenance.
- **potential_consequence:** Bad data gets into the DB silently and spreads into scaling and shopping lists. With no edit endpoint (F2), it can't be fixed.

### F6. Shopping-list consolidation rule is too naive to give correct lists

- **severity:** high
- **location:** §5.2 "aggregates duplicate ingredients (matching `name` and `unit`) and sums their quantities"
- **trigger_condition:** Exact matching on free-text `name` and `unit` fails on "Egg" vs "eggs" vs "large eggs", "g" vs "grams", "tbsp" vs "Tbsp", and 500 g + 1 kg flour (same ingredient, different but convertible units). Ingredient `notes` ("chopped" vs "minced") is ignored. Nothing says whether case or whitespace are normalized.
- **guard_snippet:** Define a canonical unit vocabulary (enum + aliases) and a normalization rule for names (case-fold, trim, singularize, or a user-confirmed merge). Decide whether unit conversion is in scope (mass↔mass, volume↔volume only). Specify what happens with non-mergeable items (list separately, grouped by name). Add acceptance examples.
- **potential_consequence:** The headline "event" feature produces duplicate or wrong lines. The fix later needs a data migration, because `unit: str` free text is already baked into the schema.

### F7. Event menu has no data model, no persistence, and no scaling rule

- **severity:** high
- **location:** §5.2 "Users select multiple recipes for an event menu."; §3 "active event shopping cart"; §4 (absent)
- **trigger_condition:** §4 has no `Event`/`Menu` entity. §3 implies the event lives in client state ("shopping cart"), which is lost on refresh and not shareable. Nothing says whether each menu recipe has its own target servings (e.g. 12 guests) before aggregation, how §5.1 scaling feeds §5.2, or whether the shopping list can be checked off, edited, exported or printed.
- **guard_snippet:** Decide: persisted `Event` (name, date, guest_count, recipes with per-recipe target_servings) vs. ephemeral session. Define the pipeline: per-recipe scale → normalize → aggregate. Add FRs for list output (check-off, copy/print/share) or declare them non-goals.
- **potential_consequence:** Architecture can't decide whether this is a backend or client-only feature, and UX can't design the planner. Users lose their planned menu on refresh.

### F8. Scaling ignores rounding, display, and unscalable ingredients

- **severity:** high
- **location:** §5.1 "Scaled Amount = Base Amount × Scaling Ratio"; §4 `amount: float`
- **trigger_condition:** 2 eggs × 1.5 = 3, but 1 egg × 1.25 = 1.25 "units". 0.333 tbsp shows as a float artifact. "Salt to taste", "a pinch", "1 can" have no numeric amount, yet `amount: float` is required. Target servings has no bounds (0, negative, 1000). Nothing says whether step text with embedded quantities ("add 200 g sugar") gets scaled.
- **guard_snippet:** Make `amount` optional (null = unscalable/"to taste"). Define rounding and display rules per unit class (fractions for volume spoons, integer-ceil or half for countables, 0–1 decimals for grams). Bound target servings (1–100). State explicitly that instruction text is not scaled.
- **potential_consequence:** Ugly or nonsensical quantities in the one place the user looks while cooking. A schema change after data exists.

### F9. No authentication or ownership model, plus optional public deployment

- **severity:** high
- **location:** §1 "managing personal recipes"; §6 Phase 4 "(Optional) Deployment target setup (Railway / Render / Cloud server)"
- **trigger_condition:** "Personal" implies one owner, but the PRD never says whether there is one user, multiple users, or none. Deployed publicly with no auth, anyone can read, write, delete, and run the paid LLM import endpoint at the owner's expense.
- **guard_snippet:** State explicitly: "Single user, no auth; local-only" OR "Single user; deployed instance protected by [basic auth / shared secret / reverse-proxy auth]". If deploying, add rate limiting or a cap on LLM endpoints.
- **potential_consequence:** An unpleasant LLM bill or vandalized data. Retrofitting user_id onto every table is a schema migration.

### F10. Non-functional requirements are missing

- **severity:** high
- **location:** general
- **trigger_condition:** No mention of mobile/tablet responsiveness (recipes are read in the kitchen), accessibility, browser support, LLM latency/timeout budget, LLM cost ceiling, SQLite backup/restore, data export, offline behavior, or error-handling standards.
- **guard_snippet:** Add a short NFR list sized for hobby scale, e.g. "Usable on phone width ≥ 360px", "AI import responds or fails within 60 s with progress indicator", "LLM spend ≤ $X/month", "Nightly SQLite file backup / JSON export available", "WCAG AA contrast on core screens".
- **potential_consequence:** Architecture has nothing to trade off against, so it picks defaults. UX designs desktop-first by default, and the app is awkward on the device it will actually be used on.

### F11. Search and filtering are implied but never required

- **severity:** high
- **location:** §3 Examples "`SearchBar`"; §4 `category`
- **trigger_condition:** A `SearchBar` component and a `category` field exist, but there is no FR for search (by title? ingredient?), filter (by category, time) or sort, and `GET /recipes` has no query parameters or pagination.
- **guard_snippet:** Add FR-BROWSE: search by title/ingredient, filter by category, sort by recently added/updated. Specify server-side vs client-side (client-side is fine for <1k recipes; say so).
- **potential_consequence:** Components get built for features with no spec. The list endpoint contract will churn.

### F12. Phase 2 is missing the screens it depends on, and the phase order has a gap

- **severity:** high
- **location:** §6 Phase 2
- **trigger_condition:** Phase 2 lists `ui-components`, `PortionSelector`, the Event Planner, and Zod. There's no app shell, routing, recipe list page, or detail page to host the `PortionSelector`. Data-access wiring (`libs/data-access`, TanStack Query hooks) appears in no phase.
- **guard_snippet:** Add Phase 2 items in dependency order: app shell + routing → data-access hooks over generated types → recipe list → recipe detail with PortionSelector → recipe editor → event planner.
- **potential_consequence:** Stories created from this phase list will be out of order or missing, and the first story will turn out to be blocked by work nobody wrote down.

### F13. Implementation details pose as requirements

- **severity:** medium
- **location:** "Key Decision Points"; §2 Tech Stack; §3 "Smart vs. Dumb Component Separation", "Strict Rule: Zero API calls"; §3 Zustand discussion
- **trigger_condition:** About half the document is library choices, folder layout, component taxonomy and state-library deliberation (Zustand vs Context). These are architecture decisions, not product requirements, and they crowd out the actual requirements.
- **guard_snippet:** Move §2–§3 and Key Decisions 1–4 into the architecture doc, or into a "Technical Constraints (pre-decided)" appendix. Keep only true constraints in the PRD (e.g. "must run locally via Docker Compose", "Python backend").
- **potential_consequence:** The architecture step becomes rubber-stamping. Real requirement gaps (F1–F12) stay hidden behind technical detail that looks thorough.

### F14. The ai-service is "optional" but drawn as fixed structure

- **severity:** medium
- **location:** Key Decision 2 "Decide during Phase 1/3"; §2 layout `ai-service/ ... (Optional Split)`, `Dockerfile.ai-service`; §6 Phase 3 "either module within `recipe-service` or dedicated `apps/ai-service`"
- **trigger_condition:** The decision is deferred, yet the layout, Dockerfiles, and §2 stack treat `ai-service` as present. "Phase 1/3" is not a decision point. No trigger criteria for the split are given beyond "if/when ... warrant it".
- **guard_snippet:** Decide now for MVP (a single service is clearly fine at hobby scale). Remove `ai-service` and its Dockerfile from the layout, and record a concrete split trigger (e.g. "import p95 > 30 s blocking API workers" or "dependency conflicts").
- **potential_consequence:** Scaffolding drift, empty projects, and a second service writing to the same SQLite file (see F15).

### F15. Several writers sharing one SQLite file is not addressed

- **severity:** medium
- **location:** §2 "SQLite (Embedded DB)"; §5.3 "Direct ingestion into SQLite"; §6 Phase 4 "persistent SQLite volumes"
- **trigger_condition:** If `ai-service` splits out and writes recipes directly, two containers share a SQLite file over a volume, which brings locking and WAL problems. PaaS targets like Railway/Render often have ephemeral filesystems, so SQLite data disappears on redeploy unless a volume is attached.
- **guard_snippet:** State "only recipe-service owns the DB; ai-service (if split) returns a draft to recipe-service". Add a deployment constraint that a persistent volume is required, or that hosted deploy is out of scope.
- **potential_consequence:** Data loss on first redeploy, or intermittent "database is locked" errors.

### F16. Two sources of truth for schemas

- **severity:** medium
- **location:** §2 `libs/data-access/ # ... Zod Schemas` and `libs/shared-types/ # Generated TypeScript types from FastAPI OpenAPI schemas`; §6 Phase 2 "client-side form validation using `Zod`"
- **trigger_condition:** Types are generated from OpenAPI while Zod schemas are hand-written separately, so validation rules (required fields, bounds) will drift from Pydantic.
- **guard_snippet:** Require Zod schemas to be generated from OpenAPI too (e.g. an openapi-to-zod generator), or state that Pydantic is authoritative and Zod schemas must be derived from or tested against it.
- **potential_consequence:** The form accepts input the API rejects (or the reverse). The bugs surface only at runtime.

### F17. Data model is thin and makes questionable required/optional choices

- **severity:** medium
- **location:** §4 `Recipe`, `Ingredient`
- **trigger_condition:** `prep_time_minutes` and `cook_time_minutes` are required ints, but imports often lack them. `category` is a single free-text string (no taxonomy, no multi-tag). No `image_url`, `source_url`, `tags`, `notes`, or `yield` text. Ingredients have no ordering field or section grouping ("For the sauce"). Nothing says whether `base_servings` must be ≥ 1.
- **guard_snippet:** Make times optional; add `source_url`, `image_url` (or explicitly no images), `tags` or a fixed category enum; add `Ingredient.position` and an optional `group`; add a `base_servings >= 1` constraint. State what is intentionally excluded.
- **potential_consequence:** AI imports fail validation on missing times. Ingredient order is scrambled on display, which hurts readability while cooking. Alembic migrations start churning right after MVP-1.

### F18. AI importer's behavior when fields are missing is unspecified

- **severity:** medium
- **location:** §5.3 "Output: Validated JSON matching `Recipe`, `Ingredient`, and `InstructionStep` schemas."
- **trigger_condition:** Source text rarely states servings, category, or prep/cook split. The PRD doesn't say whether the LLM should infer, default (base_servings "Default: 4"), or leave blank. It also doesn't say how category maps into the existing set, or what happens with non-English recipes or multiple recipes in one paste.
- **guard_snippet:** Define per-field rules: infer-with-flag vs default vs null. Flag inferred fields in the preview UI. Specify one recipe per import, and the language policy.
- **potential_consequence:** Silent default "4 servings" breaks scaling math, and category sprawl ("Italian", "italian", "Italian cuisine").

### F19. LLM provider abstraction hides real differences in capability

- **severity:** medium
- **location:** Key Decision 3 "swap between Ollama (`Llama 3`) and Cloud APIs ... with an environment variable"
- **trigger_condition:** Local Llama 3 structured-output reliability, context length and latency differ sharply from cloud models. Swapping with an env var assumes equivalent quality. Secrets/API-key handling and the behavior when no provider is configured are not stated.
- **guard_snippet:** Add an acceptance bar per provider (e.g. "≥ 9/10 golden-set recipes extracted correctly"). Define a golden test set. Specify that the import UI is disabled with a clear message when no provider is configured, and that keys come from env/secrets only.
- **potential_consequence:** "Works on my machine with GPT" turns into a broken feature on Ollama, or the reverse, with nothing to catch it.

### F20. No testing or verification strategy

- **severity:** medium
- **location:** general; §6
- **trigger_condition:** No phase includes tests. The scaling math, aggregation and AI extraction are exactly the logic that needs unit tests and golden fixtures.
- **guard_snippet:** Add per-phase test expectations: unit tests for scaling/aggregation (pure functions), API tests for endpoints, a golden-set eval for AI import, and an e2e smoke test for the core flow.
- **potential_consequence:** Regressions in the core math go unnoticed, and story DoD has no testing bar.

### F21. "Key Decision Points" mixes resolved, deferred and trivial items without owners or deadlines

- **severity:** medium
- **location:** "Key Decision Points (To Decide On-the-Go or Before Implementation)"
- **trigger_condition:** "On-the-Go OR Before Implementation" is not a schedule. A Zustand-vs-Context choice sits next to an unspecified auth/ownership model (F9), event persistence (F7) and URL import scope (F4), which are the decisions that actually block downstream work and are not listed.
- **guard_snippet:** Replace with an Open Questions table: question, blocking which phase/artifact, decide-by, default if undecided. Add F4/F7/F9 decisions; drop or move the library choices to architecture.
- **potential_consequence:** The decisions that block downstream work stay invisible, and trivial ones get the attention.

### F22. Optimistic updates and cache invalidation are promised with nothing to apply them to

- **severity:** medium
- **location:** §3 "Server State: Managed exclusively by TanStack Query (Caching, Invalidation, Optimistic Updates, Error Handling)."
- **trigger_condition:** The only mutation defined is POST /recipes. Optimistic updates for create-with-server-generated-UUID add complexity with no stated UX need.
- **guard_snippet:** Drop "Optimistic Updates" unless an FR needs instant feedback (e.g. shopping list check-off). Tie error handling to a defined UX pattern (toast, inline, retry).
- **potential_consequence:** Over-engineered data layer and stories about cache plumbing instead of user value.

### F23. Phase 1 checklist is stale

- **severity:** low
- **location:** §6 Phase 1 "Initialize Nx Workspace with `apps/web` (React + Vite) and `apps/recipe-service` (FastAPI)."
- **trigger_condition:** Commits `b0df473` and `a82ea3b` already scaffold the workspace and recipe-service, but the item is unchecked. §2 also says "Integrated Workspace", which may not match the generated layout.
- **guard_snippet:** Tick completed items and confirm the workspace style matches what was actually generated.
- **potential_consequence:** Epics duplicate work that's done. Story writers distrust the document.

### F24. Ambiguous ID type

- **severity:** low
- **location:** §4 "`id`: `UUID` / `str` (Primary Key)"
- **trigger_condition:** "UUID / str" doesn't say what is stored (SQLite has no native UUID), who generates it (client or server), or what format appears in URLs.
- **guard_snippet:** "Server-generated UUIDv4, stored as TEXT, serialized as canonical string."
- **potential_consequence:** Mismatched types between SQLModel, OpenAPI, and the generated TS types.

### F25. Seed data source and licensing unstated

- **severity:** low
- **location:** §6 Phase 1 "Create initial seed data script (10 realistic recipes)."
- **trigger_condition:** No rule on where recipes come from (copied from sites? invented?) or whether seeds should cover edge cases (no amount, mixed units, duplicate ingredients across recipes) to exercise F6/F8.
- **guard_snippet:** "Seed recipes are original/invented and deliberately include: ingredients without amounts, shared ingredients across ≥ 3 recipes with unit variants, varying base_servings."
- **potential_consequence:** Seeds only exercise the happy path, and the aggregation bugs stay hidden until real use.

### F26. "Seamless containerization" is vision copy, not a requirement

- **severity:** low
- **location:** §1 "seamless containerization via Docker"; §6 Phase 4
- **trigger_condition:** Docker is in the vision statement but comes last in the roadmap. Nothing says whether day-to-day development uses Compose or Nx serve, or whether hot reload works inside containers.
- **guard_snippet:** State the dev workflow (e.g. "dev via `nx serve`; Docker Compose for prod-like run") and drop the adjective.
- **potential_consequence:** Minor. Wasted effort on dev-container parity nobody needs.

---

## Severity rollup

| Severity | Count | Findings                                         |
| -------- | ----- | ------------------------------------------------ |
| critical | 2     | F1, F2                                           |
| high     | 10    | F3, F4, F5, F6, F7, F8, F9, F10, F11, F12        |
| medium   | 10    | F13, F14, F15, F16, F17, F18, F19, F20, F21, F22 |
| low      | 4     | F23, F24, F25, F26                               |
