# Validation Report — Bite & Board

- **PRD:** `docs/prd.md`
- **Rubric:** `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`
- **Run at:** 2026-10-26
- **Grade:** Poor

## Overall verdict

This document is a technical design sketch with a PRD title. It does three things well: the stack, the deferred decisions with their fallbacks, and three feature mechanics (scaling formula, consolidation key, AI import pipeline). As a product requirements source it is thin to broken. It has no stated user or problem, no FR IDs or acceptance conditions, no success criteria, and no non-goals. Several features appear in the milestones but are never specified (Smart Ingredient Substitution, recipe edit/delete, search, menu persistence). For a personal hobby project the light rigor is fine. But the PRD is meant to feed UX, architecture, and epics/stories, and those workflows will have to invent most of the product behavior themselves unless the done-ness and scope gaps are closed first.

The adversarial reviewer agrees on the core gaps (no user, no FRs, incomplete CRUD) and reaches the same bottom line: not ready for downstream work. It adds risks the rubric did not raise:
- **URL import:** server-side fetching is unspecified and is an SSRF surface; schema.org JSON-LD is ignored as a cheaper path.
- **Unauthenticated deployment:** a public instance exposes the paid LLM endpoint to anyone.
- **Missing NFRs:** most importantly phone-width use in the kitchen and LLM latency/cost bounds.
- **Scaling display:** no rounding, display, or "to taste" rules.
- **Phase 2 gaps:** no app shell, routing, or list/detail screens.
- **No test strategy.**
- **Technical consistency hazards:** Zod schemas written separately from the OpenAPI types, and two services writing to one SQLite file.

## Dimension verdicts

- **Decision-readiness:** adequate. The technical decisions are well framed. Product trade-offs are absent, and the split trigger is unmeasurable.
- **Substance over theater:** thin. There is no user or problem. Architecture content displaces product content.
- **Strategic coherence:** thin. There is no thesis, three "MVPs", and no success signals.
- **Done-ness clarity:** broken. There are no FRs or acceptance conditions. CRUD, search, and event-menu lifecycle are unspecified, and edge cases are missing.
- **Scope honesty:** thin. There are no non-goals, no assumption tags, and no open questions.
- **Downstream usability:** thin. There is nothing for UX to work from, no IDs for traceability, and no glossary.
- **Shape fit:** thin. The document is over-formalized on architecture and under-formalized on product for a chain-top PRD.

## Findings by severity

After deduplication: 3 critical, 14 high, 12 medium, 6 low (35 total). Merged findings take the higher of the two severities.

### Critical (3)

- **[Substance over theater + Adversarial F1]** — No problem statement, user, goals, or testable requirements (§1 Executive Summary & Vision)
  The Vision is a feature list followed by engineering values. Nothing says who uses the app or what problem it solves, so nothing downstream can prioritize. Sources: rubric; adversarial F1, which also notes the missing JTBD, success criteria, and out-of-scope list.
  Fix: Add 3–5 sentences naming the user (e.g., Adi, cooking for family and hosting events), the current pain, and the bet the app makes. Add Problem & Users, Goals & Success Criteria, Non-Goals, and NFR sections.

- **[Done-ness clarity; also Adversarial F1]** — No FRs with testable consequences (§5)
  Story creation will have no acceptance criteria to extract. Every story will need its "done" invented.
  Fix: Convert §5 into numbered FRs (FR-1…), each with 1–3 verifiable consequences. Example: "FR-2 Scaling: when target servings change, every ingredient amount equals base × target/base, displayed to at most 2 decimals (or common fractions for tbsp/tsp/cup); no network request is made."

- **[Done-ness clarity + Adversarial F2]** — Recipe management CRUD unspecified; no update/delete or browse/detail/create UI (§6 Phase 1 endpoint list; §6 Phase 2; §4 `updated_at`)
  §6 is labeled "CRUD" but lists only GET and POST. Zod validates a form that is never specified. AI-import mistakes can't be corrected.
  Fix: Add FRs for list, view, create, edit, and delete (with cascade to ingredients/steps). Add the endpoints `PUT/PATCH /recipes/{id}` and `DELETE /recipes/{id}`, and the Phase 2 list, detail, and editor screens.

### High (14)

- **[Decision-readiness + Adversarial F21]** — Product trade-offs absent from the decision list; blocking decisions unlisted (§ Key Decision Points)
  All decisions are infrastructure. AI review-before-save, menu persistence, auth/user model, and unit normalization are left implicit, while Zustand-vs-Context gets the attention. The adversarial reviewer rated this medium.
  Fix: Add a "Product decisions" subsection, or an Open Questions table (question, what it blocks, decide-by, default), that states the chosen option and what was given up.

- **[Strategic coherence]** — MVP boundary undefined (§6 phase headers "MVP-1/2/3")
  Three "MVPs" means none of them is the MVP.
  Fix: Declare one MVP cut (e.g., Phases 1–2 plus manual entry). Label the rest as post-MVP with a one-line rationale.

- **[Strategic coherence + Adversarial F3]** — Smart Ingredient Substitution appears from nowhere (§6 Phase 3)
  It is not in the Vision or §5 and has no inputs, outputs, UI, or data model. The rubric rated this medium; the adversarial reviewer rated it high.
  Fix: Spec it as §5.4 (trigger, inputs, output, suggest vs mutate, UI), or move it to "Later / ideas".

- **[Done-ness clarity + Adversarial F5]** — AI import writes directly to the DB with no review step, and failure behavior is undefined (§5.3 "Direct ingestion into SQLite")
  Output that passes Pydantic can still be hallucinated. Nothing defines a preview, behavior on validation or fetch failure, or how missing required fields are filled.
  Fix: The importer returns a draft that is edited in the recipe editor and saved explicitly. On failure, show an error and keep the input. Define behavior after N retries, and store `source_url`/`source_text`.

- **[Done-ness clarity + Adversarial F7]** — Event menu has no data model, persistence, or lifecycle (§5.2; §3 "active event shopping cart"; §4)
  Nothing says whether a menu is saved or reopened, or whether per-recipe servings apply inside it. Client-state "cart" data is lost on refresh.
  Fix: Decide on a persisted `EventMenu` or an ephemeral session, with per-recipe target servings. Define the pipeline scale → normalize → aggregate, and add list check-off/export FRs or non-goals.

- **[Done-ness clarity + Adversarial F6]** — Consolidation matching rules are ambiguous or naive (§5.2 "matching `name` and `unit`")
  Case, plurals, unit synonyms, and convertible units (500 g + 1 kg) have no expected result.
  Fix: State a normalization rule (case-insensitive trimmed name, canonical unit enum with aliases). Decide on unit conversion (or make it a non-goal) and add worked examples.

- **[Done-ness clarity + Adversarial F11]** — Search, filter, and browse are implied but unspecified (§3 `SearchBar`; §4 `category`)
  There is no FR and no query params on `GET /recipes`. The rubric rated this medium; the adversarial reviewer rated it high.
  Fix: Add FR-BROWSE (search by title/ingredient, filter by category, sort) and state client-side vs server-side, or declare it a non-goal.

- **[Scope honesty]** — No non-goals; major silent assumptions (whole document)
  The PRD silently assumes no auth/single user, no images, no unit conversion, no mobile/offline, no sharing, and no nutrition data.
  Fix: Add a "Non-goals for MVP" list, leading with auth/single-user.

- **[Downstream usability]** — Nothing for UX to source from (whole document)
  There are no journeys for import → review → save, browse → open → scale, or build menu → generate list.
  Fix: Add 3–4 short user journeys with a named protagonist, each listing the steps and the end state.

- **[Adversarial F4]** — AI import accepts URLs, but fetching and scraping is unspecified (§5.3 "raw text or a recipe URL")
  Nothing covers who fetches, JS-rendered pages, paywalls, timeouts, or token limits. The fetch is an SSRF surface, and JSON-LD is ignored.
  Fix: Split the requirement into FR-IMPORT-TEXT and FR-IMPORT-URL. For URL import: timeout/size cap, http(s) only, private IPs blocked, JSON-LD first with LLM fallback, and a defined error for each failure class. Alternatively, limit the MVP to pasted text.

- **[Adversarial F8]** — Scaling ignores rounding, display, and unscalable ingredients (§5.1; §4 `amount: float`)
  Scaling produces 1.25 eggs and 0.333 tbsp, and "to taste" has no amount. Target servings are unbounded, and step text scaling is unstated.
  Fix: Make `amount` optional. Set rounding and display rules per unit class and bound target servings (1–100). State that instruction text is not scaled.

- **[Adversarial F9]** — No authentication or ownership model, plus optional public deployment (§1; §6 Phase 4)
  A public deploy would let anyone read, write, and run the paid LLM endpoint.
  Fix: State "single user, local-only" or "single user behind basic/proxy auth", and add an LLM rate limit or cap.

- **[Adversarial F10]** — Non-functional requirements are missing (general)
  Nothing covers mobile/kitchen use, accessibility, LLM latency/cost, backup/export, or error handling.
  Fix: Add hobby-scale NFRs: phone width ≥ 360px, AI import ≤ 60 s with progress, an LLM spend cap, backup/export, and WCAG AA.

- **[Adversarial F12]** — Phase 2 is missing its prerequisite screens and data-access wiring (§6 Phase 2)
  There is no app shell, routing, list page, or detail page, and data-access hooks are in no phase.
  Fix: Order Phase 2 as shell + routing → data-access hooks → list → detail with PortionSelector → editor → event planner.

### Medium (12)

- **[Decision-readiness + Adversarial F14]** — The ai-service split has no testable trigger but is drawn as fixed structure (§ Key Decision Points #2; §2 layout; §6 Phase 3)
  "if/when … warrant it" gives no threshold, and "Phase 1/3" is not a decision point. The layout and Dockerfiles treat `ai-service` as present, but the repo has only `recipe-service`. This also covers the rubric's low finding that decision #2 is overtaken by events.
  Fix: Decide on a single service for MVP, show `ai-service` as conditional or remove it, and record a concrete trigger (e.g., import p95 > 30 s, or a dependency conflict).

- **[Substance over theater + Shape fit + Adversarial F13]** — Architecture content occupies product space; wrong weight for a chain-top PRD (§2–§3, Key Decision Points vs §5)
  Roughly half the doc is library choices, folder layout, and component taxonomy. It pre-empts the architecture step and hides the requirement gaps.
  Fix: Move §2–§3 into a "Technical constraints" appendix or the architecture input. Keep only real constraints, and expand §5 into FRs and journeys.

- **[Strategic coherence]** — No success signals (whole document)
  Fix: Add 2–3 personal success criteria tied to the core flows, plus one counter-signal.

- **[Done-ness clarity + Adversarial F17]** — Data model cannot represent common recipe data (§4 Recipe, Ingredient)
  "To taste" has no float amount, and the times are required even though imports often lack them. There is no source, image, or tags field, no ingredient ordering or grouping, and no `base_servings ≥ 1` constraint.
  Fix: Make `amount`/`unit` and the times optional. Add `source_url`, `position`/`group`, and tags or a category enum, and add the constraint.

- **[Scope honesty]** — Inferred requirements not flagged (§4 `base_servings` Default: 4; §6 "10 realistic recipes"; §5.3 URL support)
  Fix: Tag guesses with `[ASSUMPTION: …]` and collect them in an index.

- **[Downstream usability]** — No IDs or traceability (§5, §6)
  Fix: Number the FRs, and tag each §6 checklist item with the FR(s) it delivers.

- **[Adversarial F15]** — Several writers sharing one SQLite file is not addressed (§2; §5.3; §6 Phase 4)
  Fix: Only recipe-service owns the DB. Require a persistent volume, or put hosted deployment out of scope.

- **[Adversarial F16]** — Two sources of truth for schemas (§2 `libs/data-access` Zod vs `libs/shared-types`)
  Fix: Generate Zod from OpenAPI, or make Pydantic authoritative and test Zod against it.

- **[Adversarial F18]** — AI importer's behavior when fields are missing is unspecified (§5.3 Output)
  Fix: Set per-field rules (infer-with-flag / default / null), one recipe per import, and a language policy.

- **[Adversarial F19]** — LLM provider abstraction hides real differences in capability (Key Decision 3)
  Fix: Set an acceptance bar per provider against a golden set, disable the import UI when no provider is configured, and load keys from env only.

- **[Adversarial F20]** — No testing or verification strategy (general; §6)
  Fix: Add per-phase test expectations: unit tests for scaling/aggregation, API tests, an AI golden-set eval, and an e2e smoke test.

- **[Adversarial F22]** — Optimistic updates and cache invalidation are promised with nothing to apply them to (§3 Server State)
  Fix: Drop optimistic updates unless an FR needs them, and tie error handling to a UX pattern.

### Low (6)

- **[Substance over theater + Adversarial F26]** — Adjective-only qualities ("seamless containerization", "high developer ergonomics", "modern") (§1; §6 Phase 4)
  Fix: Drop them, or make them checkable (e.g., "`docker compose up` starts the full stack with persistent data"), and state the dev workflow.

- **[Done-ness clarity + Adversarial F24]** — Ambiguous ID type (§4 "`id`: `UUID` / `str`")
  Fix: "Server-generated UUIDv4, stored as TEXT, serialized as canonical string."

- **[Scope honesty + Adversarial F23]** — Milestone checkboxes are stale (§6 Phase 1 "Initialize Nx Workspace …")
  Commits b0df473 and a82ea3b already did this work.
  Fix: Tick completed items, or mark them "done".

- **[Downstream usability]** — No glossary; event terminology drifts (§3, §5.2, §6)
  Fix: Add a 5–8 term glossary and use the terms consistently.

- **[Shape fit]** — Planned vs existing structure not distinguished (§2 directory tree)
  Fix: Annotate each app/lib as "exists" or "planned".

- **[Adversarial F25]** — Seed data source and licensing unstated (§6 Phase 1 seed script)
  Fix: Use original recipes that deliberately cover edge cases (no-amount ingredients, shared ingredients with unit variants, varied servings).

## Mechanical notes

- **IDs:** No FR/UJ/SM IDs at all, so continuity cannot be checked. Section numbering (§1–§6) is contiguous. The Key Decision Points block sits unnumbered above §1.
- **Cross-references:**
  - §6 Phase 3 "Smart Ingredient Substitution" has no target in §5.
  - §3 "active event shopping cart" has no definition.
  - §3 `SearchBar` and `ModalLayout` have no corresponding requirement.
- **Glossary drift:**
  - "event menu" / "Event Menu Planner" / "event shopping cart" / "shopping list"
  - "AI module" / "AI Service / Module" / "AI integration layer" / "ai-service"
  - "AI Recipe Importer" / "AI Recipe Import modal" / `AIImporterModal`
- **Assumptions Index:** Absent. There are no inline `[ASSUMPTION]` tags, so nothing to roundtrip.
- **Data model consistency:**
  - `id: UUID / str` vs `recipe_id: UUID`: the FK is typed differently from the PK.
  - `category: str` is free text with no enumerated values.
- **API surface:** Only GET list, GET by id, and POST are listed. This is inconsistent with "Implement CRUD endpoints".
- **Required sections missing for a chain-top PRD:** problem/user statement, FRs, user journeys, success criteria, non-goals, glossary.

## Reviewer files

- `_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/review-rubric.md`: rubric walker, seven dimensions (primary)
- `_bmad-output/planning-artifacts/prds/prd-recipes-2026-10-26/review-adversarial-general.md`: adversarial general lens (26 findings)
