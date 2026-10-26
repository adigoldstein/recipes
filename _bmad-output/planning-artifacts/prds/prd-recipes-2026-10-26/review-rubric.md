# PRD Quality Review — Bite & Board (docs/prd.md)

## Overall verdict

This document is a technical design sketch with a PRD title. It does three things well: the stack, the deferred decisions with their fallbacks, and three feature mechanics (scaling formula, consolidation key, AI import pipeline). As a product requirements source it is thin to broken. It has no stated user or problem, no FR IDs or acceptance conditions, no success criteria, and no non-goals. Several features appear in the milestones but are never specified (Smart Ingredient Substitution, recipe edit/delete, search, menu persistence). For a personal hobby project the light rigor is fine. But the PRD is meant to feed UX, architecture, and epics/stories, and those workflows will have to invent most of the product behavior themselves unless the done-ness and scope gaps are closed first.

## Decision-readiness — adequate

The "Key Decision Points" block (top of doc) is the strongest part of the PRD. Each item is stated as a decision or an explicit deferral with a default and a trigger. For example: "Start with a single FastAPI backend using modular folders, and split into a dedicated `ai-service` app if/when asynchronous AI processing or heavy dependencies warrant it." Item 4 is closed: "Decided: `@nxlv/python` with `uv`." A reader pushing back on Zustand or the service split finds the objection already handled.

What is missing is product decisions. Every listed decision is technical. The product-level choices with real trade-offs are not surfaced, so they will be made silently downstream:

- whether AI-imported recipes are saved directly or reviewed first
- whether event menus are persisted entities
- single-user vs. multi-user
- how far ingredient matching goes in consolidation

The trigger for the service split ("if/when … warrant it") is also unmeasurable.

### Findings

- **high** Product trade-offs absent from decision list (§ Key Decision Points) — All four decisions are about infrastructure. AI import review-before-save, menu persistence, auth/user model, and unit normalization in consolidation all carry real cost/benefit and are left implicit. _Fix:_ Add a "Product decisions" subsection that states the chosen option and what was given up for each (e.g., "AI imports open in an editable preview before save; gives up one-click import").
- **medium** Split trigger is not testable (§ Key Decision Points #2) — "if/when asynchronous AI processing or heavy dependencies warrant it" gives no threshold. The architecture workflow will either ignore it or have to re-decide it. _Fix:_ Name a concrete trigger, e.g., "split if the AI deps exceed X MB in the recipe-service image or an import call exceeds the request timeout."
- **low** Decision #2 is partly overtaken by events (§ Key Decision Points #2, § 2 directory layout) — The repo already contains `apps/recipe-service`, and no `apps/ai-service` exists. The PRD still frames the split as open and lists `ai-service/` in the tree and in Docker files. _Fix:_ Mark single-service as the current state and show `ai-service` as conditional in the layout.

## Substance over theater — thin

There are no personas, so there is no persona theater. But there is no user at all. The Vision (§1) reads: "a modern web application for managing personal recipes, planning event menus, dynamically scaling ingredient portions, and automatically importing messy recipes using AI." That is a feature list and would fit any recipe app. The second paragraph of §1 states engineering values ("Clean Architecture … high developer ergonomics, and seamless containerization"), not product value. The PRD never says why this app exists or what goes wrong for its user today. The phrase "messy recipes" is the only hint at a real pain point, and it is never developed.

Large parts of the document (§2 directory tree, §3 Smart/Dumb component examples like `RecipeDashboardContainer`, state-management split) are architecture content. It is real content, not furniture, but it sits in the wrong document. It displaces the product content the PRD should hold. There are no NFRs, so there is no NFR theater, but there are also no product-specific quality bounds.

### Findings

- **critical** No problem statement or user (§1 Executive Summary & Vision) — The Vision does not say who uses the app or what problem it solves. Without that, nothing downstream can prioritize or make trade-offs. For example: is AI import the core bet, or a nice-to-have behind manual entry? _Fix:_ Add 3–5 sentences naming the user (e.g., Adi, cooking for family and hosting events), the current pain (recipes scattered across sites/screenshots, manual scaling and shopping-list math for events), and the bet the app makes.
- **medium** Architecture content occupies product space (§2, §3) — The directory tree, component names, and state-management rules belong in the architecture doc. In a PRD they pre-empt the architecture workflow and add bulk without adding requirements. _Fix:_ Move §2–§3 to a "Technical constraints" appendix, or hand them to the bmad-architecture step as input. Keep only real constraints in the PRD (Nx, React, FastAPI, SQLite, Docker).
- **low** Adjective-only qualities (§1 "seamless containerization", "high developer ergonomics"; §1 "modern") — These have no bounds. _Fix:_ Drop them, or replace with checkable statements (e.g., "`docker compose up` starts the full stack with persistent data").

## Strategic coherence — thin

There is no thesis, so the feature order follows the build order (backend → frontend → AI → containers) rather than user value. §6 labels phases "MVP-1/2/3", which gives three MVPs and no stated MVP scope kind. It is unclear whether the MVP is "I can store and scale my recipes" (Phase 1+2) or whether AI import is required for the app to be worth using. There are no Success Metrics or counter-metrics. Even for a hobby project, one or two personal success signals would anchor scope, e.g., "I plan a 3-recipe event menu and get one shopping list in under N minutes" or "an AI import needs at most N manual corrections."

The feature set itself does form a reasonable arc: store → scale → plan an event → shop → import faster. Stating that arc would make it a thesis.

### Findings

- **high** MVP boundary undefined (§6 phase headers "MVP-1", "MVP-2", "MVP-3") — Three "MVPs" means none is the MVP. Epic planning cannot tell what must ship first to be useful. _Fix:_ Declare one MVP cut (e.g., Phases 1–2 plus manual recipe entry). Label the rest as post-MVP increments with a one-line rationale.
- **medium** No success signals (whole document) — Nothing validates whether the app works for its user. _Fix:_ Add 2–3 lightweight personal success criteria tied to the core flows, plus one counter-signal (e.g., "AI import errors that go unnoticed until cooking").
- **medium** Smart Ingredient Substitution appears from nowhere (§6 Phase 3: "Implement Smart Ingredient Substitution endpoint") — It is not in the Vision, not in §5, and has no data model. It reads as a backlog item. _Fix:_ Either specify it in §5 with its purpose in the arc, or move it to an explicit "Later / ideas" list.

## Done-ness clarity — broken

This is the weakest dimension and the one stories depend on most. There are no numbered FRs. §5 holds three feature descriptions. Each gives a mechanism but no testable end state or edge-case behavior:

- **§5.1 Scaling:** gives the formula, but not rounding/precision, fraction display, minimum/maximum target servings, or behavior for count-type units ("2 units" eggs scaled ×0.75 = 1.5 eggs). Not stated whether target servings persist.
- **§5.2 Consolidation:** "matching `name` and `unit`" leaves open whether "Flour" vs "flour" or "g" vs "grams" match. Also unstated: whether scaling applies before aggregation (event servings per recipe), and the output format, ordering, export, and check-off.
- **§5.3 AI import:** "User pastes raw text or a recipe URL" does not say who fetches the URL or what happens when the fetch fails, paywalls, or JS-rendered pages block it. "Result: Direct ingestion into SQLite" gives no review/edit step, no validation-failure behavior, no handling for missing required fields (`prep_time_minutes: int` is required, but many recipes omit it), and no latency bound.

Whole capabilities that the UI implies have no requirement at all:

- recipe create/edit/delete (§6 lists only `GET /recipes`, `GET /recipes/{id}`, `POST /recipes`, yet "client-side form validation using `Zod`" implies forms)
- browse/search/filter (`SearchBar` is listed in §3 but no search requirement exists)
- recipe detail view content
- event menu save/load

### Findings

- **critical** No FRs with testable consequences (§5) — Story creation will have no acceptance criteria to extract. Every story will need its "done" invented. _Fix:_ Convert §5 into numbered FRs (FR-1…), each with 1–3 verifiable consequences. Example: "FR-2 Scaling: when target servings change, every ingredient amount equals base × target/base, displayed to at most 2 decimals (or common fractions for tbsp/tsp/cup); no network request is made."
- **critical** Recipe management CRUD unspecified (§6 Phase 1 endpoint list; §5 has none) — There is no update or delete endpoint and no requirement for manual entry or editing, yet these are the backbone of a recipe manager. AI-imported mistakes cannot be corrected under the current spec. _Fix:_ Add FRs for create, view, edit, and delete of a recipe (with ingredients and steps), and list the matching endpoints (`PUT/PATCH /recipes/{id}`, `DELETE /recipes/{id}`).
- **high** AI import failure and review behavior undefined (§5.3 "Result: Direct ingestion into SQLite via FastAPI") — It is unclear whether there is a preview, what happens on LLM schema-validation failure or URL fetch failure, and how missing required fields are filled. _Fix:_ Specify: parsed result shown in an editable form → user saves; on failure, show an error and keep the input; missing numeric fields default to null (adjust the model) or prompt the user.
- **high** Event menu has no data or lifecycle definition (§5.2; §4 has no Menu/Event model) — It is unknown whether a menu can be saved, named, and reopened, or whether per-recipe target servings apply inside a menu. §3 mentions an "active event shopping cart" that is never defined. _Fix:_ Add an `EventMenu` concept (ephemeral or persisted, decided explicitly), with per-recipe servings and the rule that consolidation operates on scaled amounts.
- **high** Consolidation matching rules ambiguous (§5.2 "matching `name` and `unit`") — Without normalization rules, the obvious test cases (case, whitespace, plural, unit synonyms) have no expected result. _Fix:_ State the rule, e.g., "case-insensitive, trimmed name; exact unit string; no unit conversion in MVP (non-goal)." Add one worked example.
- **medium** Data model cannot represent common recipe data (§4 Ingredient `amount: float`, Recipe `prep_time_minutes: int`) — "Salt to taste" and "a pinch" have no float amount, and imported recipes often lack times. This will collide with AI import. _Fix:_ Make `amount`/`unit` optional (or add a free-text quantity), and make the time fields optional.
- **medium** Search/browse implied but unspecified (§3 `SearchBar`; §4 `category`) — There is no requirement for listing, searching, or filtering by category. _Fix:_ Add an FR for recipe list/search (fields searched, filter by category), or declare it a non-goal.
- **low** Ambiguous ID type (§4 "`id`: `UUID` / `str`") — _Fix:_ Pick one (e.g., UUID stored as string in SQLite) and state it once.

## Scope honesty — thin

Omissions are almost entirely implicit. There is no Non-Goals section, no `[ASSUMPTION]` tags, no `[NOTE FOR PM]` callouts, and no Open Questions section. The Key Decision Points serve as open items for technical choices only. For a hobby project, a high open-item count would be acceptable. The problem here is the opposite: things that are clearly undecided are presented as if settled or simply left out. Phase 4 marks deployment as "(Optional)", which is the only explicit de-scoping in the document.

### Findings

- **high** No non-goals; major silent assumptions (whole document) — These are silently assumed and stated nowhere:
  - no authentication / single user
  - no recipe images
  - no unit conversion
  - no mobile/offline support
  - no sharing
  - no nutrition data

  UX and architecture will each guess differently. _Fix:_ Add a short "Non-goals for MVP" list. Auth/single-user is the most important item, because it shapes data model and deployment.

- **medium** Inferred requirements not flagged (§4 "`base_servings`: `int` (Default: 4)"; §6 "10 realistic recipes"; §5.3 URL support) — Several specifics read as guesses (URL import in particular implies scraping, which has legal and technical weight). _Fix:_ Tag unconfirmed items with `[ASSUMPTION: …]` and collect them in an index at the end.
- **low** Milestone checkboxes do not reflect actual state (§6 Phase 1 "Initialize Nx Workspace …" unchecked) — The repo already has `apps/web` and `apps/recipe-service` (commits b0df473, a82ea3b). _Fix:_ Check off completed items, or note "done" so epic creation does not re-plan them.

## Downstream usability — thin

The PRD is chain-top (UX → architecture → epics/stories), so this dimension matters.

- **Architecture:** has plenty to extract, arguably too much pre-decided.
- **UX:** has nothing to extract. There are no user journeys, screens, flows, or states (empty, loading, error) beyond component names.
- **Epics/stories:** the §6 checklists give a ready skeleton but mix infra tasks with features, and there are no FR IDs to trace to.
- **Glossary:** none. Terms drift: "event menu", "Event Menu Planner", "active event shopping cart", "shopping list".

### Findings

- **high** Nothing for UX to source from (whole document) — There are no journeys or flows for import → review → save, browse → open → scale, or build menu → generate list. _Fix:_ Add 3–4 short user journeys with a named protagonist (e.g., "Adi plans a Friday dinner for 10"), each listing steps and the end state.
- **medium** No IDs or traceability (§5, §6) — Stories cannot reference requirements. _Fix:_ Number FRs (FR-1…), and tag each §6 checklist item with the FR(s) it delivers.
- **low** No glossary; event terminology drifts (§3 "active event shopping cart", §5.2 "event menu", §6 "Event Menu Planner") — _Fix:_ Add a 5–8 term glossary (Recipe, Ingredient, Instruction Step, Base Servings, Target Servings, Event Menu, Shopping List) and use the terms consistently.

## Shape fit — thin

The product is a hobby/solo app with meaningful UX, so it needs light rigor and a few journeys. The document is over-formalized on architecture (directory tree, Dockerfile names, component naming conventions, state-library policy) and under-formalized on product (no user, journeys, FRs, or success criteria). For a standalone build note the shape would be fine. It is mis-shaped for a document meant to drive the BMAD UX → architecture → stories chain. As a brownfield note, existing-code references are mostly accurate (`apps/web`, `apps/recipe-service`, `@nxlv/python`). However, `libs/` is currently empty, the root is named `bite-and-board/` while the repo is `recipes`, and `ai-service` does not exist. The PRD should distinguish what exists from what is planned.

### Findings

- **medium** Wrong weight distribution for a chain-top PRD (§2–§3 vs §5) — Roughly half the document is architecture, and the product sections are short. _Fix:_ Rebalance: move §2–§3 to an architecture input/appendix, and expand §5 into FRs and journeys at hobby-appropriate depth (a page, not a spec book).
- **low** Planned vs existing structure not distinguished (§2 directory tree) — _Fix:_ Annotate each app/lib as "exists" or "planned".

## Mechanical notes

- **IDs:** There are no FR/UJ/SM IDs at all, so continuity cannot be checked. Section numbering (§1–§6) is contiguous. The Key Decision Points block sits unnumbered above §1.
- **Cross-references:** §6 Phase 3 "Smart Ingredient Substitution" has no target in §5. §3 "active event shopping cart" has no definition. §3 `SearchBar` and `ModalLayout` have no corresponding requirement.
- **Glossary drift:**
  - "event menu" / "Event Menu Planner" / "event shopping cart" / "shopping list"
  - "AI module" / "AI Service / Module" / "AI integration layer" / "ai-service"
  - "AI Recipe Importer" (§5.3) / "AI Recipe Import modal" (§6) / `AIImporterModal` (§3)
- **Assumptions Index:** absent; no inline `[ASSUMPTION]` tags exist, so nothing to roundtrip.
- **Data model consistency:** `id: UUID / str` vs `recipe_id: UUID` (FK typed differently from PK). `category: str` is free text with no enumerated values, although examples are given.
- **API surface:** §6 lists only GET list, GET by id, and POST, with no update/delete. This is inconsistent with a CRUD claim ("Implement CRUD endpoints").
- **Required sections missing for a chain-top PRD:** problem/user statement, FRs, user journeys, success criteria, non-goals, glossary.
