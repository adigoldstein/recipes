# Epic 1 Context: Browse and cook from the phone

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Anyone can open Bite & Board (ביס & סיר) on a phone or desktop — Hebrew, right-to-left, light or dark — browse seeded recipes, search them, filter by tag, open a recipe and scale servings live, with the screen kept awake while cooking. The epic first reshapes the existing brownfield Nx 24 scaffold (FastAPI backend + React SPA) to the agreed architecture and lays the shared groundwork (libs, OpenAPI client pipeline, database and migrations, theme, app shell, seed data, CI) that every later epic builds on.

## Stories

- Story 1.1: Adapt the backend scaffold
- Story 1.2: Adapt the frontend scaffold and shared libs
- Story 1.3: CI and quality gates
- Story 1.4: Theme, RTL and app shell
- Story 1.5: UI kit: shadcn primitives in ui-components
- Story 1.6: Recipe data model and read API
- Story 1.7: Generated API client pipeline
- Story 1.8: Demo seed data
- Story 1.9: Recipe library with search and tag filter
- Story 1.10: Recipe detail page
- Story 1.11: Live serving scaling and kitchen mode

## Requirements & Constraints

- Library: every recipe as a card (title, up to 2 tags plus +N, total time, photo), newest first; title search as you type (case-insensitive substring); multi-select pinned-tag chips (AND); filters live in the URL and survive navigation.
- Detail page shows photo, ingredients (amount, unit, name, note; to-taste lines read "לפי הטעם") and numbered steps; unknown id → not-found page.
- Servings scaling 1–100 runs on the client only; to-taste never scales; rounding: integers without decimals, else ≤ 2 decimals, countable units to nearest ½.
- One idempotent seed command creates ~10 Hebrew recipes covering every pinned tag.
- Quality: TS strict, mypy strict, lint/format enforced, CI on every push. Backend API tests for every endpoint; scaling/rounding at 100% branch coverage.
- Performance (200 recipes, local): library first render < 1 s, search < 100 ms per keystroke, detail < 500 ms.
- Mobile-first (375 px), keyboard accessible, visible focus, WCAG AA; Hebrew RTL throughout; design tokens only.
- Secrets come from env; one documented command runs the app with migrations applied.

## Technical Decisions

- **Backend shape:** modular monolith. Feature modules `recipes, tags, auth, users, imports, photos` under `app/<module>/`, each `router.py → service.py → repository.py → models.py/schemas.py`, plus shared `app/core` (config, db, errors, security, health). Layers only point down; cross-module calls go through the other module's service only; routers hold no business logic. `app/core/metadata.py` imports all models for Alembic.
- **Config:** env vars only, read once in `app/core/config` via pydantic-settings. Settings: `ENV, DATA_DIR, JWT_SECRET (fail fast if missing), COOKIE_SECURE, LLM_PROVIDERS, OLLAMA_URL, GEMINI_API_KEY, GEMINI_MODEL, IMPORT_DAILY_CAP, LLM_MAX_TOKENS, APP_TIMEZONE (default Asia/Jerusalem), LOG_LEVEL`. `COOKIE_SECURE` defaults true, may be false only when `ENV=dev`. Committed `.env.example`.
- **Health:** `GET /api/health` (moved from `/health`); container HEALTHCHECK target.
- **API conventions:** paths `/api/<plural-noun>`; snake_case JSON; operation IDs `{tag}_{function}` via `generate_unique_id_function`, every router declares `tags=[<module>]`, route functions named `verb_noun`, a test asserts the pattern. Errors `{detail, code, params?}` with an `ErrorCode` StrEnum (422 keeps FastAPI's shape).
- **Persistence:** SQLite, UUID v4 ids, UTC timestamps serialized with `Z`; every connection `PRAGMA foreign_keys=ON` + WAL; Alembic `render_as_batch=True`, auto-applied at startup (failure exits non-zero); 13 default pinned Hebrew tags via data migration with fixed UUIDs. Tags are one flat list: a `tag` table with `pinned` and `sort_order`, no groups, no meal types.
- **Recipe read API:** `GET /api/recipes` returns all summaries unpaginated, sorted `created_at desc, id`; `GET /api/recipes/{id}` returns the full aggregate. `amount` is NUMERIC quantized to 3 decimals, JSON number or null; `Unit` is a StrEnum of English codes; countable set `unit, clove, slice, can, package`.
- **CLI:** `python -m app.cli seed|create-admin|backup`, exposed as Nx targets.
- **Frontend:** React 19 + Vite 8, React Router 8 data mode with lazy route modules, TanStack Query for server data, URL for filters, i18next with `he.json`. "Thin app, thick libs": `apps/web` is only the shell (router, providers, top bar). Pages and containers live in feature libs `libs/feature-{recipes,auth,users,tags,import}` (tag `type:feature`, never importing each other). Each feature lib is created by the first story that needs it, and each page is a lazy subpath export (e.g. `@bite-and-board/feature-recipes/library`). Shared libs: `data-access` (hey-api generated client/hooks/Zod), `ui-components` (presentational, tokens only), `recipe-domain` (pure TS: scale, format, parse, filter; 100% branch coverage). All libs are non-buildable and consumed from source. Nx tags `type:app|feature|data-access|ui|domain`. depConstraints: app → feature/data-access/ui/domain, feature → data-access/ui/domain, ui → domain, data-access and domain → nothing. `bannedExternalImports` keep `domain` free of React/IO and `ui` free of query/client/router packages.
- **Tests:** pytest + TestClient with a fresh temp SQLite DB per test (migrated via `alembic upgrade head`); Vitest + RTL + MSW on the web.
- **Dev:** root `npm run dev` runs `web` and `recipe-service` together; Vite proxies `/api` and `/media`.
- **Python:** 3.13; FastAPI ≥ 0.162, SQLModel ≥ 0.0.48, Pydantic 2, Alembic ≥ 1.20; adds pydantic-settings and runtime httpx.

## UX & Interaction Patterns

- `<html lang="he" dir="rtl">`, Radix DirectionProvider, logical Tailwind utilities only, amount+unit wrapped in `<bdi>`, `dir="auto"` on user content.
- Theme = shadcn CSS variables in `:root`/`.dark` plus brand tokens (`--board`, `--hint`, `--flag` …); Rubik only; theme toggle system/light/dark remembered per browser.
- Components: `_bmad-output/planning-artifacts/ui-component-inventory.md` maps every shadcn primitive and custom shared component to the story that adds it. 1.4 initializes shadcn with Button; 1.5 adds Input, Label, Skeleton, ToggleGroup, DropdownMenu, Sonner, Dialog, AlertDialog, Select and Table; the rest are added just in time.
- Top bar only (no sidebar): wordmark linking to `/`, theme toggle, login/account.
- RecipeCard is a "board" (oak slab, radius 24, handle slot); grid 1/2/3 columns at base/`sm`/`lg`. Skeletons while loading; empty, no-results and not-found states.
- Detail: one column on phone; from `lg` a sticky start column (servings + ingredient board) beside photo and steps. ServingsStepper: 44 px buttons, typeable, clamped, polite live region; screen wake lock requested, failure ignored.
- Focus moves to `h1` and `document.title` updates on route change. All copy from `he.json`, gender-neutral, no exclamation marks or emoji.

## Cross-Story Dependencies

- 1.1 (backend layout, config, `/api/health`) precedes 1.2's root `dev` script and Vite proxy, and every backend story.
- 1.3 adds mypy strict + import-linter to the layout from 1.1 and ESLint rules over the libs from 1.2.
- 1.6 adds DB/Alembic into `app/core` and the `recipes`/`tags` modules; 1.7 generates the client from 1.6's OpenAPI; 1.8 seeds through `recipes.service`.
- 1.9–1.11 consume 1.4's theme/shell, 1.7's hooks and `recipe-domain`; 1.9 creates `libs/feature-recipes` and replaces 1.2's placeholder home route.
- `created_by/updated_by` FKs to `user` wait for Epic 2 (Story 2.1).
