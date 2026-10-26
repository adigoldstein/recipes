# Review: Story 1.2 — Adapt the frontend scaffold and shared libs

**Status:** ready for Adi's review. Nothing is committed (baseline `97e632c0bdabb7d91d72facf0d69d2a6e5e1da17`).
**Spec:** [spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md](spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md) · **Deferred:** [deferred-work.md](deferred-work.md)

## Verification

- `npx nx run-many -t lint test build typecheck --skip-nx-cache` → 16/16 tasks green (web 3 tests, recipe-service 34 tests; libs pass with no tests, recipe-domain coverage gate 100%).
- Boundary probes (throwaway files, removed): ui → data-access ❌, ui → react-router ❌, domain → react ❌, feature → feature ❌ (libs temporarily retagged), domain → `node:fs` ❌ typecheck.
- `npm run dev` → `http://localhost:4200/` shows the lazy home page (own chunk), no console errors; `/api/health` → `{"status":"ok"}` via proxy; `/media/*` reaches FastAPI; `/apiary` stays with the SPA.
- 3 parallel reviews (blind, edge-case, verification-gap): 22 findings → 13 patched, 2 deferred, 7 rejected (see the spec's Review Triage Log).

## Acceptance criteria

| AC | Result |
|----|--------|
| `react-router-dom` replaced by `react-router` 8.5.0, data mode, lazy routes; welcome page removed | ✅ `package.json`, `apps/web/src/app/router.tsx`, `router.spec.tsx` |
| Libs `data-access`, `ui-components`, `recipe-domain` (non-buildable) with tags; `web` tagged `type:app` | ✅ `libs/*/package.json`, `apps/web/package.json` |
| `depConstraints` (incl. `type:feature`) + `bannedExternalImports`; forbidden import fails `nx lint` | ✅ `eslint.config.mjs` + probes above |
| Root `npm run dev` starts web + API; Vite proxies `/api` and `/media` | ✅ manual run |
| Placeholder home route renders through the router | ✅ `router.spec.tsx` + browser |
| `nx run-many -t lint test build` passes | ✅ |

## Also changed (planning docs, Adi's choice B: feature libs)

- `ARCHITECTURE-SPINE.md`: thin app / thick libs, AD-2 feature libs, AD-11 page subpath exports, AD-33 tag matrix, conventions, layout, capability map.
- `.memlog.md`: decisions B, 1a, 2a.
- `epics.md`: requirements bullet; 1.2 AC; feature lib creation in 1.8, 2.2, 2.4, 4.1, 5.2.
- `epic-1-context.md`, `sprint-status.yaml` (1.2 → review), `deferred-work.md` (2 entries).

## Changed files

     .gitignore                                                      |   3 +
     _bmad-output/implementation-artifacts/deferred-work.md          |   6 +
     _bmad-output/implementation-artifacts/epic-1-context.md         |   4 +-
     .../spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md     | 130 +++++
     _bmad-output/implementation-artifacts/sprint-status.yaml        |   4 +-
     .../architecture/architecture-recipes-2026-10-26/.memlog.md     |   2 +
     .../architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md       |  45 +-
     _bmad-output/planning-artifacts/epics.md                        |   9 +-
     apps/web/package.json                                           |   5 +-
     apps/web/src/app/app.module.css                                 |   1 -
     apps/web/src/app/app.spec.tsx                                   |  26 -
     apps/web/src/app/app.tsx                                        |  52 --
     apps/web/src/app/nx-welcome.tsx                                 | 858 ----------------------------
     apps/web/src/app/placeholder-home.tsx                           |   8 +
     apps/web/src/app/route-error.tsx                                |  12 +
     apps/web/src/app/router.spec.tsx                                |  49 ++
     apps/web/src/app/router.tsx                                     |  19 +
     apps/web/src/main.tsx                                           |  11 +-
     apps/web/vite.config.mts                                        |   5 +
     eslint.config.mjs                                               |  45 +-
     libs/data-access/README.md                                      |   7 +
     libs/data-access/eslint.config.mjs                              |  15 +
     libs/data-access/package.json                                   |  22 +
     libs/data-access/src/index.ts                                   |   1 +
     libs/data-access/tsconfig.json                                  |  13 +
     libs/data-access/tsconfig.lib.json                              |  44 ++
     libs/data-access/tsconfig.spec.json                             |  36 ++
     libs/data-access/vite.config.mts                                |  20 +
     libs/recipe-domain/README.md                                    |   8 +
     libs/recipe-domain/eslint.config.mjs                            |   8 +
     libs/recipe-domain/package.json                                 |  22 +
     libs/recipe-domain/src/index.ts                                 |   1 +
     libs/recipe-domain/tsconfig.json                                |  13 +
     libs/recipe-domain/tsconfig.lib.json                            |  27 +
     libs/recipe-domain/tsconfig.spec.json                           |  34 ++
     libs/recipe-domain/vitest.config.mts                            |  24 +
     libs/ui-components/README.md                                    |   7 +
     libs/ui-components/eslint.config.mjs                            |  15 +
     libs/ui-components/package.json                                 |  22 +
     libs/ui-components/src/index.ts                                 |   1 +
     libs/ui-components/tsconfig.json                                |  13 +
     libs/ui-components/tsconfig.lib.json                            |  44 ++
     libs/ui-components/tsconfig.spec.json                           |  36 ++
     libs/ui-components/vite.config.mts                              |  20 +
     nx.json                                                         |  12 +-
     package.json                                                    |  17 +-
     tsconfig.json                                                   |   9 +
     47 files changed, 805 insertions(+), 980 deletions(-)
    package-lock.json: react-router-dom/@remix-run/router removed; react-router 8.5.0, @remix-run/route-pattern, cookie-es and the 3 workspace links added

## Diff

```diff
diff --git a/.gitignore b/.gitignore
index fb92451..16f1f81 100644
--- a/.gitignore
+++ b/.gitignore
@@ -76,3 +76,6 @@ vitest.config.*.timestamp*
 # Test reports
 /reports
 .coverage
+
+# Vitest coverage output
+test-output
diff --git a/_bmad-output/implementation-artifacts/deferred-work.md b/_bmad-output/implementation-artifacts/deferred-work.md
index dc2cef0..b866182 100644
--- a/_bmad-output/implementation-artifacts/deferred-work.md
+++ b/_bmad-output/implementation-artifacts/deferred-work.md
@@ -13,3 +13,9 @@
 - source_spec: `_bmad-output/implementation-artifacts/spec-1-1-adapt-the-backend-scaffold.md`
   summary: Dispose the SQLite engine on app shutdown (lifespan).
   evidence: Engine is cached without a shutdown hook; Story 1.5 adds DB/lifespan.
+- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md`
+  summary: Add an automated lint fixture test (ESLint Node API) proving each Nx boundary rule fails a forbidden import (ui → data-access, ui → react-router, domain → react, feature → feature), and re-check the `@tanstack/*`/`@hey-api/*` bans once Story 1.6 installs them.
+  evidence: Rules were verified with throwaway probes only; removing a constraint keeps `nx lint` green because no file violates it yet. Natural home Story 1.3.
+- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md`
+  summary: Cover the real app boot (`main.tsx` + `react-router/dom`) and the Vite `/api`, `/media` proxy with an automated check.
+  evidence: Only manual runs today; no e2e harness until Story 6.3 (Playwright), app-shell tests from 1.4.
diff --git a/_bmad-output/implementation-artifacts/epic-1-context.md b/_bmad-output/implementation-artifacts/epic-1-context.md
index 7ca6a47..f7e06e3 100644
--- a/_bmad-output/implementation-artifacts/epic-1-context.md
+++ b/_bmad-output/implementation-artifacts/epic-1-context.md
@@ -39,7 +39,7 @@ Anyone can open Bite & Board (ביס & סיר) on a phone or desktop — Hebrew,
 - **Persistence:** SQLite, UUID v4 ids, UTC timestamps serialized with `Z`; every connection `PRAGMA foreign_keys=ON` + WAL; Alembic `render_as_batch=True`, auto-applied at startup (failure exits non-zero); default Hebrew meal types via data migration with fixed UUIDs. Meal types and tags share one `tag` table with a `group` column.
 - **Recipe read API:** `GET /api/recipes` returns all summaries unpaginated, sorted `created_at desc, id`; `GET /api/recipes/{id}` returns the full aggregate. `amount` is NUMERIC quantized to 3 decimals, JSON number or null; `Unit` is a StrEnum of English codes; countable set `unit, clove, slice, can, package`.
 - **CLI:** `python -m app.cli seed|create-admin|backup`, exposed as Nx targets.
-- **Frontend:** React 19 + Vite 8, React Router 8 data mode with lazy route modules, TanStack Query for server data, URL for filters, i18next with `he.json`. Libs: `data-access` (hey-api generated client/hooks/Zod), `ui-components` (presentational, tokens only), `recipe-domain` (pure TS: scale, format, parse, filter; 100% branch coverage). Nx tags `type:app|data-access|ui|domain` with depConstraints.
+- **Frontend:** React 19 + Vite 8, React Router 8 data mode with lazy route modules, TanStack Query for server data, URL for filters, i18next with `he.json`. "Thin app, thick libs": `apps/web` is only the shell (router, providers, top bar). Pages and containers live in feature libs `libs/feature-{recipes,auth,users,tags,import}` (tag `type:feature`, never importing each other). Each feature lib is created by the first story that needs it, and each page is a lazy subpath export (e.g. `@bite-and-board/feature-recipes/library`). Shared libs: `data-access` (hey-api generated client/hooks/Zod), `ui-components` (presentational, tokens only), `recipe-domain` (pure TS: scale, format, parse, filter; 100% branch coverage). All libs are non-buildable and consumed from source. Nx tags `type:app|feature|data-access|ui|domain`. depConstraints: app → feature/data-access/ui/domain, feature → data-access/ui/domain, ui → domain, data-access and domain → nothing. `bannedExternalImports` keep `domain` free of React/IO and `ui` free of query/client/router packages.
 - **Tests:** pytest + TestClient with a fresh temp SQLite DB per test (migrated via `alembic upgrade head`); Vitest + RTL + MSW on the web.
 - **Dev:** root `npm run dev` runs `web` and `recipe-service` together; Vite proxies `/api` and `/media`.
 - **Python:** 3.13; FastAPI ≥ 0.162, SQLModel ≥ 0.0.48, Pydantic 2, Alembic ≥ 1.20; adds pydantic-settings and runtime httpx.
@@ -58,5 +58,5 @@ Anyone can open Bite & Board (ביס & סיר) on a phone or desktop — Hebrew,
 - 1.1 (backend layout, config, `/api/health`) precedes 1.2's root `dev` script and Vite proxy, and every backend story.
 - 1.3 adds mypy strict + import-linter to the layout from 1.1 and ESLint rules over the libs from 1.2.
 - 1.5 adds DB/Alembic into `app/core` and the `recipes`/`tags` modules; 1.6 generates the client from 1.5's OpenAPI; 1.7 seeds through `recipes.service`.
-- 1.8–1.10 consume 1.4's theme/shell, 1.6's hooks and `recipe-domain`.
+- 1.8–1.10 consume 1.4's theme/shell, 1.6's hooks and `recipe-domain`; 1.8 creates `libs/feature-recipes` and replaces 1.2's placeholder home route.
 - `created_by/updated_by` FKs to `user` wait for Epic 2 (Story 2.1).
diff --git a/_bmad-output/implementation-artifacts/spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md b/_bmad-output/implementation-artifacts/spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md
new file mode 100644
index 0000000..400b5d6
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md
@@ -0,0 +1,130 @@
+---
+title: 'Story 1.2: Adapt the frontend scaffold and shared libs'
+type: 'refactor'
+created: '2026-10-26'
+status: 'done'
+route: 'dispatch'
+review_loop_iteration: 0
+baseline_commit: '97e632c0bdabb7d91d72facf0d69d2a6e5e1da17'
+context:
+  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** `apps/web` is the Nx welcome scaffold on `react-router-dom@6.30.3` (EOL), `libs/` is empty and module boundaries allow anything (`sourceTag: '*'`), so later frontend stories have nowhere correct to land and nothing enforces AD-2/AD-32/AD-33.
+
+**Approach:** Swap to `react-router@8` in data mode with a lazy placeholder home route, make `apps/web` a thin shell, generate the three shared libs, enforce the full tag matrix (including `type:feature` for feature libs that later stories create), and add a root `npm run dev` with Vite proxying `/api` and `/media` to FastAPI.
+
+## Boundaries & Constraints
+
+**Always:**
+- Tag matrix: `type:app` → feature, data-access, ui, domain; `type:feature` → data-access, ui, domain (never feature); `type:ui` → domain; `type:data-access` → nothing; `type:domain` → nothing.
+- `bannedExternalImports`: `type:domain` bans `react`, `react-*`, `@tanstack/*`, `@hey-api/*`; `type:ui` bans `@tanstack/*`, `@hey-api/*`, `react-router`, `react-router-*`.
+- `apps/web` holds only the shell: `src/main.tsx` and `src/app/` (router, placeholder home). Pages otherwise belong in feature libs.
+- Pinned exact versions (`react-router` 8.5.0).
+- Code comments explain why, never story/epic references.
+
+**Never:**
+- No feature libs yet: each is created by its first story (1.8 `feature-recipes`, 2.2 `feature-auth`, 2.4 `feature-users`, 4.1 `feature-tags`, 5.2 `feature-import`).
+- No Tailwind/shadcn/theme/RTL/i18next (1.4), no TanStack Query/hey-api (1.6), no React Compiler, style lint rules or CI changes (1.3).
+- No placeholder components or domain functions in the libs beyond an empty public entry point.
+
+## I/O & Edge-Case Matrix
+
+| Scenario | Input / State | Expected Output / Behavior | Error Handling |
+|----------|--------------|---------------------------|----------------|
+| Home | Browser opens `/` | Lazy placeholder home renders its heading | N/A |
+| Unknown path | `/nope` | Root error element renders (no crash) | N/A |
+| Tag violation | `ui-components` imports `@bite-and-board/data-access` | `nx lint ui-components` fails (`@nx/enforce-module-boundaries`) | N/A |
+| External ban | `recipe-domain` imports `react` | `nx lint recipe-domain` fails | N/A |
+| Proxy | `GET http://localhost:4200/api/health` during `npm run dev` | `{"status":"ok"}` from FastAPI | N/A |
+
+## Decisions (Adi, 2026-10-26)
+
+1. Frontend features live in Nx feature libs (`libs/feature-<name>`, tag `type:feature`); the app is a thin shell. Spine, epics and epic context updated.
+2. Libs are non-buildable and consumed from source; only `web` builds (1a).
+3. `bannedExternalImports` back the tag matrix (2a).
+
+</frozen-after-approval>
+
+## Code Map
+
+- `package.json` -- root; replace `react-router-dom` with `react-router@8.5.0`; add `"scripts.dev": "nx run-many -t serve -p recipe-service web"`. React installed is 19.3.1 (v8 needs ≥ 19.2.7).
+- `apps/web/src/main.tsx` -- `BrowserRouter` from `react-router-dom`; becomes `RouterProvider` with the router from `src/app/router.tsx`.
+- `apps/web/src/app/app.tsx`, `app.spec.tsx`, `nx-welcome.tsx`, `app.module.css` -- welcome scaffold; delete.
+- `apps/web/vite.config.mts` -- add `server.proxy` `/api`, `/media` → `http://localhost:8000` (recipe-service `serve` port).
+- `apps/web/package.json` -- `nx` block; add `tags: ["type:app"]`.
+- `eslint.config.mjs` -- `@nx/enforce-module-boundaries` `depConstraints` is `*`→`*`; replace with the matrix + bans.
+- `tsconfig.json` -- TS project references (workspaces + `customConditions`); generators add lib references.
+- `nx.json` -- plugins already infer `lint`/`test`/`typecheck`; no change expected.
+- `apps/recipe-service/project.json` -- `serve` (port 8000, continuous) is what `npm run dev` runs; do not change.
+
+## Tasks & Acceptance
+
+**Execution:**
+- [x] `package.json`, `package-lock.json` -- `npm uninstall react-router-dom`; `npm install react-router@8.5.0 --save-exact`; add `dev` script.
+- [x] `libs/recipe-domain` -- `nx g @nx/js:library` (vitest, bundler none), tag `type:domain`, empty `src/index.ts`.
+- [x] `libs/data-access`, `libs/ui-components` -- `nx g @nx/react:library` (vitest, bundler none, `--component=false`), tags `type:data-access` / `type:ui`.
+- [x] `eslint.config.mjs` -- matrix + `bannedExternalImports`.
+- [x] `apps/web/src/app/router.tsx`, `apps/web/src/app/placeholder-home.tsx`, `apps/web/src/main.tsx` -- `createBrowserRouter`, lazy `/` route, root error element; delete welcome files.
+- [x] `apps/web/src/app/router.spec.tsx` -- `createMemoryRouter` with the same routes: `/` shows the home heading, unknown path shows the error element.
+- [x] `apps/web/vite.config.mts` -- proxy.
+- [x] Throwaway check of I/O rows 3–4 (temporary import, lint fails, revert); record in Implementation Notes.
+
+**Acceptance Criteria:**
+- Given the repo, when `npx nx run-many -t lint test build` runs, then all projects pass.
+- Given `npm run dev`, when both servers are up, then `http://localhost:4200/` renders the home route and `/api/health` is proxied.
+- Given `package.json`, then `react-router-dom` is absent and `react-router` is `8.5.0`.
+
+## Implementation Notes
+
+- Implemented directly (no implementation subagent), as in Story 1.1.
+- Libs are generated with `@nx/js:library` (recipe-domain) and `@nx/react:library` (data-access, ui-components), `bundler none`, vitest. After generation: the placeholder `recipeDomain()` function and its spec, both `.babelrc` files, the `@babel/core`/`@babel/preset-react` devDependencies the React generator added, and the "workers" comment block are removed. Each lib gets `nx.name` (short project names `recipe-domain`, `data-access`, `ui-components`, like `web`), `private`, `type: module`, `export {};` as entry point, and `passWithNoTests` (vitest otherwise fails on an empty lib).
+- The generator reformatted `nx.json` with Prettier and added `unitTestRunner: vitest` to the `@nx/react` library defaults; kept.
+- Routes are exported as `routes: RouteObject[]` from `apps/web/src/app/router.tsx`; `main.tsx` creates the browser router, so the spec runs the same routes through `createMemoryRouter`. `RouterProvider` comes from `react-router/dom` (DOM build in v8). Root route has `errorElement: <RouteError />` (404 → "Page not found", otherwise "Something went wrong"); English placeholder copy until i18next lands in 1.4.
+- Build emits the placeholder home as its own chunk (`placeholder-home-*.js`), so lazy loading works.
+- Boundary probes (throwaway files, removed): `ui-components` → `@bite-and-board/data-access` fails ("type:ui can only depend on type:domain"); `ui-components` → `react-router` fails (banned external); `recipe-domain` → `react` fails (banned external); with both libs temporarily retagged `type:feature`, feature → feature fails. `@tanstack/*` / `@hey-api/*` bans can only fire once those packages are installed (1.6), since Nx checks banned imports against known external nodes.
+- `npm run dev`: `GET http://localhost:4200/api/health` → `{"status":"ok"}` through the proxy; `/media/x.webp` → FastAPI's 404 (not Vite's SPA fallback), so `/media` is proxied too; `/` renders "Bite & Board" in the browser with no console errors.
+- `npx nx run-many -t lint test build typecheck --skip-nx-cache`: 16/16 tasks succeed (web 3 tests, recipe-service 34 tests).
+- Review patches: `recipe-domain` measures coverage on every `nx test` with a 100% threshold (empty lib passes; a half-covered throwaway function failed at 50% branches) and loads no Node types (`types: []`, so `node:fs` fails typecheck); its vitest `include` is `src/**` only. Root `react`/`react-dom` floors raised to `^19.2.7` and `@types/react*` to `^19.2.0` (react-router 8 peers); `engines.node >=22.22.0` (react-router 8; CI uses Node 24). Proxy keys are `/api/` and `/media/` so a client path like `/apiary` stays with the SPA (checked: `/apiary` serves `index.html`, `/api/health` still proxied). Root route has `HydrateFallback: () => null` (removes the React Router warning on `/`; it still logs once in the unknown-path test, where no route matches). `console.error` spy restored after each test. `test-output` added to `.gitignore`. Spine AD-2 lists `recipe-domain` for the app; capability map rows name their feature libs; memlog records Adi's confirmation of 1a/2a. Full `lint test build typecheck` re-run green (16/16).
+
+## Spec Change Log
+
+## Review Triage Log
+
+| # | Source | Finding | Verdict | Route | Evidence |
+|---|--------|---------|---------|-------|----------|
+| 1 | verification-gap, blind | Boundary rules have no automated regression test (probes were throwaway) | medium | defer | Real: deleting a constraint keeps lint green. Approved spec chose manual probes; an ESLint-API lint fixture belongs with Story 1.3's lint suite. Also re-check the `@tanstack/*`/`@hey-api/*` bans once 1.6 installs them. |
+| 2 | verification-gap, edge | Dev proxy, `dev` script and `main.tsx` bootstrap verified only by hand; deleted `app.spec` covered the provider tree | low | defer | No e2e harness yet; Story 6.3 (Playwright) / 1.4 shell own boot-path coverage. Manually verified twice. |
+| 3 | verification-gap, blind, edge | `recipe-domain` 100% coverage not enforced | medium | patch | No thresholds existed; now enabled with `thresholds: {100: true}`, proven to fail at 50%. |
+| 4 | blind | memlog says "Adi can correct" while spec says Adi decided 1a/2a | low | patch | Adi later confirmed both in the thread; memlog updated. |
+| 5 | blind, edge | `react` `^19.0.0` below react-router's peer `>=19.2.7` | medium | patch | Lockfile-less install could resolve an incompatible React; floors raised. |
+| 6 | blind, edge | No Node engine declared (react-router needs >=22.22) | low | patch | `engines` added; CI already Node 24. |
+| 7 | blind | Spec `in-review` vs sprint `in-progress` | false | reject | Workflow syncs sprint status to `review` at the present step; done. |
+| 8 | blind | AD-2 omits app → domain allowed by the matrix | low | patch | Spine AD-2 updated. |
+| 9 | blind | Capability map rows still say "web routes" | low | patch | F2–F5, F8, F9, F10 rows now name feature libs. |
+| 10 | blind, edge | "No IO" for domain not enforced | low | patch | `types: []` makes Node built-ins fail typecheck (probed with `node:fs`). Network packages are not installed. |
+| 11 | blind, edge | `console.error` spy never restored | low | patch | `afterEach(vi.restoreAllMocks)` added. |
+| 12 | blind | `toBeTruthy()` on `findByRole` is weak; no code-split test | low | reject | `findByRole` throws when absent, so the test does fail; jest-dom not installed. Split verified in build output; size-limit (1.3) guards bundles. |
+| 13 | blind | `recipe-domain` README names wrong consumers; no subpath-export example | low | patch | README fixed. Subpath example: false, AD-11 and the Story 1.8 AC specify it. |
+| 14 | blind | Code map said no `nx.json` change; non-buildable libs keep `outDir`/`emitDeclarationOnly`; typecheck not in AC | false | reject | `nx.json` change recorded in notes (fix would edit spec). `outDir`/declaration emit is what the inferred `typecheck` (`tsc --build`) uses in the TS-solution setup. Running typecheck too is not a defect. |
+| 15 | blind | `RouteError` lacks a home link; English copy not marked temporary | low | reject | Story 1.4 AC owns "הדף לא נמצא" + "חזרה לרשימה" and he.json strings. |
+| 16 | edge | No `HydrateFallback` on initial lazy load | low | patch | Warning reproduced in tests; `HydrateFallback: () => null` added. |
+| 17 | edge | Stale lazy chunk after redeploy shows generic error without reload | low | reject | Unlikely in a personal app; fix adds a branch. Production story can revisit. |
+| 18 | edge | Non-404 statuses show the generic message | false | reject | No route throws other statuses yet. |
+| 19 | edge | Proxy prefix `/api` also matches `/apiary` | low | patch | Keys changed to `/api/`, `/media/`; verified. |
+| 20 | edge | Vitest includes `tests/**` but tsconfig.spec covers only `src` | low | patch | `recipe-domain` include narrowed to `src/**`; React libs already `src` only. |
+| 21 | edge | `test-output` coverage dirs not gitignored | low | patch | `git check-ignore` confirmed; added. |
+| 22 | edge | `apps/web/src` also has `styles.css` and `assets/` | low | reject | Wording only; global stylesheet belongs to the shell. |
+
+## Verification
+
+**Commands:**
+- `npx nx run-many -t lint test build` -- expected: all green
+- `npx nx show project <lib> --json` -- expected: tags as specified
+
+**Manual checks (if no CLI):**
+- `npm run dev`, open `http://localhost:4200/` and `http://localhost:4200/api/health` -- placeholder home and `{"status":"ok"}`.
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index e396959..f85b4e3 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -29,7 +29,7 @@
 # - Dev moves story to 'review', then runs code-review (fresh context, different LLM recommended)
 # - Retrospective appends its action items to action_items; the status view surfaces open ones
 generated: 10-26-2026 13:09
-last_updated: 10-26-2026 13:40
+last_updated: 10-26-2026 13:57
 project: recipes
 project_key: NOKEY
 tracking_system: file-system
@@ -37,7 +37,7 @@ story_location: _bmad-output/implementation-artifacts
 development_status:
   epic-1: in-progress
   1-1-adapt-the-backend-scaffold: done
-  1-2-adapt-the-frontend-scaffold-and-shared-libs: backlog
+  1-2-adapt-the-frontend-scaffold-and-shared-libs: review
   1-3-ci-and-quality-gates: backlog
   1-4-theme-rtl-and-app-shell: backlog
   1-5-recipe-data-model-and-read-api: backlog
diff --git a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md
index 9370129..aa62af7 100644
--- a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md
+++ b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md
@@ -53,3 +53,5 @@ updated: 2026-10-26T11:23
 - (question) Adi wants user management: admin (Adi) manages users; default role viewer; admin can grant editor. Open: anonymous browsing kept?, public sign-up vs admin-created, shared library vs own recipes, password reset (admin vs email), editors import. Changes PRD F8/C-1/non-goals, UX, AD-6/AD-21 + users module.
 - (decision) R5 (Adi 'all 5' = all A): AD-25..AD-29 adopted; amounts 3dp JSON number (AD-31); libs/recipe-domain (AD-32); tooling mypy/import-linter/slowapi/size-limit/ESLint token+RTL rules/recipe-scrapers+trafilatura/Babel React Compiler (AD-33); Python 3.13. Roles: visitor/editor/admin, no sign-up, shared library, admin resets passwords, editors import (AD-30).
 - (event) spine finalized (Adi: commit and push)
+- (decision) 2026-10-26 (Adi, during Story 1.2 planning): frontend features move to Nx feature libs ('thin app, thick libs', option B). libs/feature-{recipes,auth,users,tags,import}, tag type:feature; app = shell only (router, providers, top bar). Matrix: app->feature/data-access/ui/domain, feature->data-access/ui/domain (feature-to-feature banned), ui->domain, data-access->none, domain->none. Pages are subpath exports of their feature lib for per-page lazy chunks. Each feature lib is created by the first story that needs it. Updated Design Paradigm, AD-2, AD-11, AD-33, conventions, structural seed, capability map.
+- (decision) 2026-10-26 Story 1.2: libs are non-buildable and consumed from source (1a); bannedExternalImports guard type:domain and type:ui (2a). Confirmed by Adi ("go with your recommendation"; 2a confirmed explicitly).
diff --git a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
index bbf9f92..97d5e93 100644
--- a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
+++ b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
@@ -21,13 +21,14 @@ companions: []
 
 ## Design Paradigm
 
-**Modular monolith.** There is one FastAPI service and one React SPA, both inside the Nx workspace. The backend is split by **feature module**. Each module is layered `router → service → repository → models/schemas`, much like a NestJS module: router = controller, service = provider, and FastAPI `Depends()` = DI. The frontend splits **containers** (routes, data, side effects) in `apps/web` from **presentational** components in `libs/ui-components`.
+**Modular monolith.** There is one FastAPI service and one React SPA, both inside the Nx workspace. The backend is split by **feature module**. Each module is layered `router → service → repository → models/schemas`, much like a NestJS module: router = controller, service = provider, and FastAPI `Depends()` = DI. The frontend follows Nx's "thin app, thick libs": `apps/web` is only the shell (router, providers, top bar). Each feature's pages and **containers** (routes, data, side effects) live in a `libs/feature-<name>` library, and **presentational** components live in `libs/ui-components`.
 
 ```mermaid
 flowchart LR
   subgraph web[apps/web]
-    routes[routes + containers]
+    shell[shell: router · providers · top bar]
   end
+  feat[libs/feature-*<br/>route pages + containers]
   da[libs/data-access<br/>generated client · query hooks · zod]
   ui[libs/ui-components<br/>presentational · tokens only]
   subgraph api[apps/recipe-service]
@@ -35,8 +36,9 @@ flowchart LR
     r[routers] --> s[services] --> repo[repositories] --> m[models]
     s --> ports[ports: LlmProvider · PhotoStorage]
   end
-  routes --> da
-  routes --> ui
+  shell --> feat
+  feat --> da
+  feat --> ui
   da -- HTTP /api --> r
 ```
 
@@ -52,7 +54,13 @@ flowchart LR
 
 - **Binds:** apps/web, libs/*
 - **Prevents:** presentational components that fetch data, and hand-rolled API calls.
-- **Rule:** `apps/web` may import `libs/data-access` and `libs/ui-components`. `libs/ui-components` imports neither the API nor any global state: props in, callbacks out, design tokens only (DESIGN.md). Every server call goes through `libs/data-access`. Nx module-boundary tags enforce this.
+- **Rule:**
+  - Feature libraries are `libs/feature-recipes` (library, detail, editor), `feature-auth` (login, account), `feature-users`, `feature-tags` and `feature-import`. The first story that needs one creates it.
+  - `apps/web` holds only the shell (router, providers, app-wide layout). It lazy-loads pages from feature libs and may also import `libs/data-access` (the query client provider and the 401 handler), `libs/ui-components` (the shell's own UI) and `libs/recipe-domain`.
+  - A feature lib may import `data-access`, `ui-components` and `recipe-domain`, but never another feature lib.
+  - `libs/ui-components` imports neither the API nor any global state: props in, callbacks out, design tokens only (DESIGN.md).
+  - Every server call goes through `libs/data-access`.
+  - Nx module-boundary tags enforce this.
 
 ### AD-3 — OpenAPI is the only contract [ADOPTED]
 
@@ -126,7 +134,7 @@ flowchart LR
 
 - **Binds:** apps/web, NFR-11
 - **Prevents:** eager bundles that ship editor or import code to visitors.
-- **Rule:** React Router v8 with **lazy** route modules per page (like Angular `loadChildren`). Signed-in routes (edit, new, import, tags, users, account, login) live in their own chunks. The React Compiler is enabled; hand-written `useMemo`/`useCallback` only with a measured reason.
+- **Rule:** React Router v8 with **lazy** route modules per page (like Angular `loadChildren`). Each page is its own subpath export of its feature lib (for example `@bite-and-board/feature-recipes/library`), so lazy-loading one page never pulls in the rest of the lib. Signed-in routes (edit, new, import, tags, users, account, login) live in their own chunks. The React Compiler is enabled; hand-written `useMemo`/`useCallback` only with a measured reason.
 
 ### AD-12 — AI providers behind one port [ADOPTED]
 
@@ -351,7 +359,12 @@ flowchart LR
 - **Rule:**
   - **Python:** mypy (strict, with the pydantic plugin) is the `recipe-service:typecheck` target. import-linter contracts for AD-1 and AD-25 run in `lint`.
   - **Rate limit:** slowapi limits login attempts (in memory, which is fine for one container).
-  - **Frontend boundaries:** Nx tags `type:app`, `type:data-access`, `type:ui` and `type:domain` carry dependency constraints.
+  - **Frontend boundaries:** Nx tags `type:app`, `type:feature`, `type:data-access`, `type:ui` and `type:domain` carry these dependency constraints:
+    - app → feature, data-access, ui, domain
+    - feature → data-access, ui, domain (never another feature)
+    - ui → domain
+    - data-access → nothing
+    - domain → nothing
   - **Styling:** ESLint rules ban physical-direction utilities, arbitrary Tailwind values, hex/rgb literals outside the theme, and the `style` prop in `libs/ui-components`. They also cover jsx-a11y and the React hooks rules version the compiler needs.
   - **Bundle size:** size-limit checks the initial JS (≤ 200 KB gzip) as `web:size` in CI.
   - **Recipe pages:** recipe-scrapers (JSON-LD) and trafilatura (readable text) parse imported pages.
@@ -374,7 +387,7 @@ flowchart LR
 | Timestamps | UTC ISO-8601 (`created_at`, `updated_at`) |
 | Errors | 422 validation; 400 bad input or credentials; 401 no session on a protected call; 403 CSRF or insufficient role; 404 missing; 409 conflict (duplicate tag rename, meal type in use); 413 upload too large; 429 rate limit or import cap; 502/504 provider failure or timeout. Body shape per AD-28 |
 | Python naming | modules `snake_case`; schemas `RecipeCreate / RecipeRead / RecipeUpdate` |
-| TS naming | components `PascalCase.tsx`; hooks `useX`; route modules `routes/<page>.tsx` |
+| TS naming | components `PascalCase.tsx`; hooks `useX`; route modules `libs/feature-<name>/src/routes/<page>.tsx` |
 | Config | env vars only, read once in `app/core/config` (pydantic-settings); no secrets in the repo |
 | Styling | design tokens only (CLAUDE.md, NFR-7) |
 
@@ -421,13 +434,15 @@ erDiagram
 ```text
 apps/
   web/src/
-    routes/            # lazy page modules (library, recipe, edit, import, tags, login)
-    app/               # providers: query client, router, i18n, theme, auth context
+    app/               # shell only: router, providers (query client, i18n, theme, auth context), top bar
   recipe-service/app/
     core/              # config, db, errors, security
     recipes/ tags/ auth/ users/ imports/ photos/   # each: router.py service.py repository.py models.py schemas.py
     imports/providers/ # ollama.py gemini.py fake.py registry.py
 libs/
+  feature-recipes/     # pages + containers: library, detail, editor (src/routes/<page>.tsx)
+  feature-auth/        # login, account
+  feature-users/ feature-tags/ feature-import/
   data-access/         # generated client + hooks + zod, query keys
   ui-components/       # shadcn-based presentational components, tokens only
   recipe-domain/       # pure TS: scale, format, parse, filter (AD-32)
@@ -437,13 +452,13 @@ libs/
 
 | Capability | Lives in | Governed by |
 | --- | --- | --- |
-| F1 library, search, filters | web routes/library · recipes.router | AD-8, AD-7 |
-| F2–F5 recipe CRUD | recipes module · web routes | AD-1, AD-4, AD-9 |
+| F1 library, search, filters | libs/feature-recipes · recipes.router | AD-8, AD-7 |
+| F2–F5 recipe CRUD | recipes module · libs/feature-recipes | AD-1, AD-4, AD-9 |
 | F4 original-value hints | recipes.service | AD-4 |
 | F6 scaling | libs/recipe-domain | AD-31, AD-32 |
-| F8 users, roles, login | auth + users modules | AD-6, AD-21, AD-30 |
-| F9 AI import | imports module + providers | AD-12, AD-13 |
-| F10 meal types & tags | tags module | AD-7 |
+| F8 users, roles, login | auth + users modules · libs/feature-auth, libs/feature-users | AD-6, AD-21, AD-30 |
+| F9 AI import | imports module + providers · libs/feature-import | AD-12, AD-13 |
+| F10 meal types & tags | tags module · libs/feature-tags | AD-7 |
 | Photos | photos module | AD-14 |
 | NFR-6 one-command run | compose + nx dev target | AD-15, AD-18 |
 | NFR-1/2 quality, CI | all projects | AD-16, AD-17 |
diff --git a/_bmad-output/planning-artifacts/epics.md b/_bmad-output/planning-artifacts/epics.md
index ecc576c..90b138f 100644
--- a/_bmad-output/planning-artifacts/epics.md
+++ b/_bmad-output/planning-artifacts/epics.md
@@ -101,6 +101,7 @@ From ARCHITECTURE-SPINE.md (AD-1 to AD-33). There is **no starter template**: th
   - The pipeline is safe fetch, then JSON-LD (recipe-scrapers), then readable text (trafilatura), then the LLM. `core/safe_fetch` handles every outbound URL (AD-13, AD-23).
   - The draft reaches the form through router state only, with `missing_fields` (AD-22).
 - **Spike before the import feature:** compare Ollama and Gemini on about 5 real recipes (2 English, 3 Hebrew) for time and Hebrew quality, then confirm the default provider. Ollama runs as the native Windows app.
+- Frontend shape: "thin app, thick libs". `apps/web` is only the shell (router, providers, top bar). Pages and containers live in feature libs `libs/feature-{recipes,auth,users,tags,import}` (tag `type:feature`, never importing each other), and each feature lib is created by the first story that needs it (AD-2).
 - Frontend stack: React Router 8 lazy routes, TanStack Query, React Hook Form + Zod with `RecipeFormValues` and two mapping functions, i18next (`he.json`), and the React Compiler through the Babel plugin (AD-8 to AD-11, AD-22, AD-33).
 - Enforcement: mypy strict, import-linter, ESLint rules (no physical-direction utilities, arbitrary values, hex colours or the `style` prop in ui-components; jsx-a11y), and size-limit as the `web:size` target (AD-33).
 - Packaging: one container serves the SPA, `/api` and `/media` with a `/data` volume. `docker compose up` runs it locally. The SPA fallback excludes `/api` and `/media`, and there's a HEALTHCHECK (AD-15, AD-29).
@@ -269,7 +270,7 @@ So that every later frontend story lands in the right place and respects the bou
 **Given** `apps/web` with the Nx welcome page and `react-router-dom@6.30.3`
 **When** the story is done
 **Then** `react-router-dom` is replaced by `react-router@8` (data mode, lazy route modules), and the Nx welcome component is removed
-**And** the libs `data-access`, `ui-components` and `recipe-domain` exist with the Nx tags `type:app`, `type:data-access`, `type:ui` and `type:domain`, and `depConstraints` enforce AD-2 and AD-32 (a forbidden import fails `nx lint`)
+**And** the shared libs `data-access`, `ui-components` and `recipe-domain` exist (non-buildable, consumed from source) with the Nx tags `type:data-access`, `type:ui` and `type:domain`, `apps/web` is tagged `type:app`, and `depConstraints` enforce AD-2, AD-32 and AD-33, including the `type:feature` rules for the feature libs that later stories create (a forbidden import fails `nx lint`)
 **And** a root `npm run dev` starts web and API together (Story 1.1), with Vite proxying `/api` and `/media` to FastAPI (AD-15)
 **And** a placeholder home route renders through the router
 **And** `nx run-many -t lint test build` passes
@@ -387,6 +388,7 @@ So that I can quickly find what to cook (FR1, FR2, FR3).
 **Given** the seeded recipes
 **When** I open `/`
 **Then** I see `RecipeCard`s, newest first: 1 column on phone, 2 from `sm`, 3 from `lg` (UX-DR6, UX-DR7, UX-DR20). Each card is a board with the slot, title, meal type, up to 3 tags and total time, with a larger title when there is no photo
+**And** the page lives in a new `libs/feature-recipes` (tag `type:feature`) as the lazy subpath export `@bite-and-board/feature-recipes/library`, replacing the placeholder home route in `apps/web` (AD-2, AD-11)
 **And** while loading I see 6 skeleton cards. With no recipes I see the visitor empty state "עוד אין כאן מתכונים" (UX-DR17)
 
 **Given** the library
@@ -472,6 +474,7 @@ So that I get my editing controls only when I'm signed in (FR14, FR15).
 **Given** an active user exists
 **When** I submit correct credentials on `/login`
 **Then** `POST /api/auth/login` sets a signed JWT in an `httpOnly; SameSite=Lax` cookie (with `Secure` per `COOKIE_SECURE`) that expires after 7 days, and I'm sent to `?next=` or to `/` (AD-6, AD-21)
+**And** the `/login` page lives in a new `libs/feature-auth` (tag `type:feature`) as a lazy subpath export (AD-2, AD-11)
 **And** `GET /api/auth/session` (public) always returns 200 `{user: {id, email, name, role} | null}`, and the app's auth context reads it through the generated hook
 **And** wrong credentials return 400 `invalid_credentials`, and the form shows "אימייל או סיסמה שגויים" without revealing which field was wrong
 **And** a 6th attempt within a minute from the same client returns 429, and the form shows "יותר מדי ניסיונות. אפשר לנסות שוב בעוד דקה." (slowapi, NFR-10)
@@ -509,6 +512,7 @@ So that my partner or friends can edit recipes (FR25).
 **Given** I'm signed in as admin
 **When** I open "משתמשים" from the account menu
 **Then** `/users` lists users (name, email, role, blocked state) from `GET /api/users` (admin only) (UX-DR19)
+**And** the page lives in a new `libs/feature-users` (tag `type:feature`) as a lazy subpath export (AD-2, AD-11)
 **And** "הוספת משתמש" opens a form for email, name, role (עורך/מנהל) and a starting password with confirmation, and `POST /api/users` creates the user
 **And** a duplicate email (compared without case) returns 409 `email_taken`, shown on the email field
 **And** a starting password shorter than 8 characters is rejected on the client and the server
@@ -685,6 +689,7 @@ So that my categories stay tidy (FR23).
 **Given** I'm signed in as an editor
 **When** I open "תגיות וסוגי ארוחה" from the account menu
 **Then** `/tags` shows two lists, meal types and tags, each with inline rename and add (UX-DR18)
+**And** the page lives in a new `libs/feature-tags` (tag `type:feature`) as a lazy subpath export (AD-2, AD-11)
 **And** renaming updates every recipe that uses it, and a duplicate name (after normalization) returns 409 `tag_name_taken`
 **And** deleting a tag opens a confirm dialog with its usage count ("התגית משויכת ל־7 מתכונים"), and confirming detaches it from all recipes
 **And** deleting a meal type that recipes use returns 409 `meal_type_in_use` with the count in `params`, and the UI explains it. An unused meal type can be deleted
@@ -734,7 +739,7 @@ So that I don't retype recipes by hand (FR18, FR21, FR24).
 **Acceptance Criteria:**
 
 **Given** I'm signed in as an editor
-**When** I open "ייבוא", choose the "הדבקת טקסט" tab, paste text and submit
+**When** I open "ייבוא", choose the "הדבקת טקסט" tab, paste text and submit (the page lives in a new `libs/feature-import`, tag `type:feature`, as a lazy subpath export; AD-2, AD-11)
 **Then** `POST /api/imports/text` (editor) calls the default provider through the `LlmProvider` registry, which in this story has the `ollama` and `fake` adapters and returns a `DraftRecipe` validated by Pydantic (AD-12, AD-22)
 **And** the draft is in Hebrew (translated if the source is in another language), its units are mapped to the `Unit` enum, unquantifiable ingredients are to-taste, and unmappable units are empty with the original text kept in the note (FR19, FR21)
 **And** the draft pre-picks a meal type and suggests tags, preferring existing ones (FR24)
diff --git a/apps/web/package.json b/apps/web/package.json
index a29afb6..2a357da 100644
--- a/apps/web/package.json
+++ b/apps/web/package.json
@@ -3,6 +3,9 @@
   "version": "0.0.1",
   "private": true,
   "nx": {
-    "name": "web"
+    "name": "web",
+    "tags": [
+      "type:app"
+    ]
   }
 }
diff --git a/apps/web/src/app/app.module.css b/apps/web/src/app/app.module.css
deleted file mode 100644
index 7b88fba..0000000
--- a/apps/web/src/app/app.module.css
+++ /dev/null
@@ -1 +0,0 @@
-/* Your styles goes here. */
diff --git a/apps/web/src/app/app.spec.tsx b/apps/web/src/app/app.spec.tsx
deleted file mode 100644
index 8c29436..0000000
--- a/apps/web/src/app/app.spec.tsx
+++ /dev/null
@@ -1,26 +0,0 @@
-import { render } from '@testing-library/react';
-import { BrowserRouter } from 'react-router-dom';
-
-import App from './app';
-
-describe('App', () => {
-  it('should render successfully', () => {
-    const { baseElement } = render(
-      <BrowserRouter>
-        <App />
-      </BrowserRouter>,
-    );
-    expect(baseElement).toBeTruthy();
-  });
-
-  it('should have a greeting as the title', () => {
-    const { getAllByText } = render(
-      <BrowserRouter>
-        <App />
-      </BrowserRouter>,
-    );
-    expect(
-      getAllByText(new RegExp('Welcome web', 'gi')).length > 0,
-    ).toBeTruthy();
-  });
-});
diff --git a/apps/web/src/app/app.tsx b/apps/web/src/app/app.tsx
deleted file mode 100644
index 442dcb8..0000000
--- a/apps/web/src/app/app.tsx
+++ /dev/null
@@ -1,52 +0,0 @@
-// Uncomment this line to use CSS modules
-// import styles from './app.module.css';
-import NxWelcome from './nx-welcome';
-
-import { Route, Routes, Link } from 'react-router-dom';
-
-export function App() {
-  return (
-    <div>
-      <NxWelcome title="web" />
-
-      {/* START: routes */}
-      {/* These routes and navigation have been generated for you */}
-      {/* Feel free to move and update them to fit your needs */}
-      <br />
-      <hr />
-      <br />
-      <nav>
-        <ul>
-          <li>
-            <Link to="/">Home</Link>
-          </li>
-          <li>
-            <Link to="/page-2">Page 2</Link>
-          </li>
-        </ul>
-      </nav>
-      <Routes>
-        <Route
-          path="/"
-          element={
-            <div>
-              This is the generated root route.{' '}
-              <Link to="/page-2">Click here for page 2.</Link>
-            </div>
-          }
-        />
-        <Route
-          path="/page-2"
-          element={
-            <div>
-              <Link to="/">Click here to go back to root page.</Link>
-            </div>
-          }
-        />
-      </Routes>
-      {/* END: routes */}
-    </div>
-  );
-}
-
-export default App;
diff --git a/apps/web/src/app/nx-welcome.tsx b/apps/web/src/app/nx-welcome.tsx
deleted file mode 100644
index d05bdb3..0000000
--- a/apps/web/src/app/nx-welcome.tsx
+++ /dev/null
@@ -1,858 +0,0 @@
-/*
- * * * * * * * * * * * * * * * * * * * * * * * * * * * *
- This is a starter component and can be deleted.
- * * * * * * * * * * * * * * * * * * * * * * * * * * * *
- Delete this file and get started with your project!
- * * * * * * * * * * * * * * * * * * * * * * * * * * * *
- */
-/* oxlint-disable jsx-a11y/prefer-tag-over-role -- the icons below
-   are inline SVGs, which have no tag to swap the role for. */
-export function NxWelcome({ title }: { title: string }) {
-  return (
-    <>
-      <style
-        dangerouslySetInnerHTML={{
-          __html: `
-    html {
-      -webkit-text-size-adjust: 100%;
-      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
-      'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif,
-      'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
-      'Noto Color Emoji';
-      line-height: 1.5;
-      tab-size: 4;
-      scroll-behavior: smooth;
-    }
-    body {
-      font-family: inherit;
-      line-height: inherit;
-      margin: 0;
-    }
-    h1,
-    h2,
-    p,
-    pre {
-      margin: 0;
-    }
-    *,
-    ::before,
-    ::after {
-      box-sizing: border-box;
-      border-width: 0;
-      border-style: solid;
-      border-color: currentColor;
-    }
-    h1,
-    h2 {
-      font-size: inherit;
-      font-weight: inherit;
-    }
-    a {
-      color: inherit;
-      text-decoration: inherit;
-    }
-    pre {
-      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
-      'Liberation Mono', 'Courier New', monospace;
-    }
-    svg {
-      display: block;
-      vertical-align: middle;
-      shape-rendering: auto;
-      text-rendering: optimizeLegibility;
-    }
-    pre {
-      background-color: rgba(55, 65, 81, 1);
-      border-radius: 0.25rem;
-      color: rgba(229, 231, 235, 1);
-      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
-      'Liberation Mono', 'Courier New', monospace;
-      overflow: auto;
-      padding: 0.5rem 0.75rem;
-    }
-
-    .shadow {
-      box-shadow: 0 0 #0000, 0 0 #0000, 0 10px 15px -3px rgba(0, 0, 0, 0.1),
-      0 4px 6px -2px rgba(0, 0, 0, 0.05);
-    }
-    .rounded {
-      border-radius: 1.5rem;
-    }
-    .wrapper {
-      width: 100%;
-    }
-    .container {
-      margin-left: auto;
-      margin-right: auto;
-      max-width: 768px;
-      padding-bottom: 3rem;
-      padding-left: 1rem;
-      padding-right: 1rem;
-      color: rgba(55, 65, 81, 1);
-      width: 100%;
-    }
-    #welcome {
-      margin-top: 2.5rem;
-    }
-    #welcome h1 {
-      font-size: 3rem;
-      font-weight: 500;
-      letter-spacing: -0.025em;
-      line-height: 1;
-    }
-    #welcome span {
-      display: block;
-      font-size: 1.875rem;
-      font-weight: 300;
-      line-height: 2.25rem;
-      margin-bottom: 0.5rem;
-    }
-    #hero {
-      align-items: center;
-      background-color: hsla(214, 62%, 21%, 1);
-      border: none;
-      box-sizing: border-box;
-      color: rgba(55, 65, 81, 1);
-      display: grid;
-      grid-template-columns: 1fr;
-      margin-top: 3.5rem;
-    }
-    #hero .text-container {
-      color: rgba(255, 255, 255, 1);
-      padding: 3rem 2rem;
-    }
-    #hero .text-container h2 {
-      font-size: 1.5rem;
-      line-height: 2rem;
-      position: relative;
-    }
-    #hero .text-container h2 svg {
-      color: hsla(162, 47%, 50%, 1);
-      height: 2rem;
-      left: -0.25rem;
-      position: absolute;
-      top: 0;
-      width: 2rem;
-    }
-    #hero .text-container h2 span {
-      margin-left: 2.5rem;
-    }
-    #hero .text-container a {
-      background-color: rgba(255, 255, 255, 1);
-      border-radius: 0.75rem;
-      color: rgba(55, 65, 81, 1);
-      display: inline-block;
-      margin-top: 1.5rem;
-      padding: 1rem 2rem;
-      text-decoration: inherit;
-    }
-    #hero .logo-container {
-      display: none;
-      justify-content: center;
-      padding-left: 2rem;
-      padding-right: 2rem;
-    }
-    #hero .logo-container svg {
-      color: rgba(255, 255, 255, 1);
-      width: 66.666667%;
-    }
-    #middle-content {
-      align-items: flex-start;
-      display: grid;
-      grid-template-columns: 1fr;
-      margin-top: 3.5rem;
-    }
-
-    #middle-content #middle-content-container {
-      display: flex;
-      flex-direction: column;
-      gap: 2rem;
-    }
-    #learning-materials {
-      padding: 2.5rem 2rem;
-    }
-    #learning-materials h2 {
-      font-weight: 500;
-      font-size: 1.25rem;
-      letter-spacing: -0.025em;
-      line-height: 1.75rem;
-      padding-left: 1rem;
-      padding-right: 1rem;
-    }
-    .list-item-link {
-      align-items: center;
-      border-radius: 0.75rem;
-      display: flex;
-      margin-top: 1rem;
-      padding: 1rem;
-      transition-property: background-color, border-color, color, fill, stroke,
-      opacity, box-shadow, transform, filter, backdrop-filter,
-      -webkit-backdrop-filter;
-      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
-      transition-duration: 150ms;
-      width: 100%;
-    }
-    .list-item-link svg:first-child {
-      margin-right: 1rem;
-      height: 1.5rem;
-      transition-property: background-color, border-color, color, fill, stroke,
-      opacity, box-shadow, transform, filter, backdrop-filter,
-      -webkit-backdrop-filter;
-      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
-      transition-duration: 150ms;
-      width: 1.5rem;
-    }
-    .list-item-link > span {
-      flex-grow: 1;
-      font-weight: 400;
-      transition-property: background-color, border-color, color, fill, stroke,
-      opacity, box-shadow, transform, filter, backdrop-filter,
-      -webkit-backdrop-filter;
-      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
-    }
-    .list-item-link > span > span {
-      color: rgba(107, 114, 128, 1);
-      display: block;
-      flex-grow: 1;
-      font-size: 0.75rem;
-      font-weight: 300;
-      line-height: 1rem;
-      transition-property: background-color, border-color, color, fill, stroke,
-      opacity, box-shadow, transform, filter, backdrop-filter,
-      -webkit-backdrop-filter;
-      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
-    }
-    .list-item-link svg:last-child {
-      height: 1rem;
-      transition-property: all;
-      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
-      transition-duration: 150ms;
-      width: 1rem;
-    }
-    .list-item-link:hover {
-      color: rgba(255, 255, 255, 1);
-      background-color: hsla(162, 55%, 33%, 1);
-    }
-    .list-item-link:hover > span {}
-    .list-item-link:hover > span > span {
-      color: rgba(243, 244, 246, 1);
-    }
-    .list-item-link:hover svg:last-child {
-      transform: translateX(0.25rem);
-    }
-    #other-links {}
-    .button-pill {
-      padding: 1.5rem 2rem;
-      margin-bottom: 2rem;
-      transition-duration: 300ms;
-      transition-property: background-color, border-color, color, fill, stroke,
-      opacity, box-shadow, transform, filter, backdrop-filter,
-      -webkit-backdrop-filter;
-      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
-      align-items: center;
-      display: flex;
-    }
-    .button-pill svg {
-      transition-property: background-color, border-color, color, fill, stroke,
-      opacity, box-shadow, transform, filter, backdrop-filter,
-      -webkit-backdrop-filter;
-      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
-      transition-duration: 150ms;
-      flex-shrink: 0;
-      width: 3rem;
-    }
-    .button-pill > span {
-      letter-spacing: -0.025em;
-      font-weight: 400;
-      font-size: 1.125rem;
-      line-height: 1.75rem;
-      padding-left: 1rem;
-      padding-right: 1rem;
-    }
-    .button-pill span span {
-      display: block;
-      font-size: 0.875rem;
-      font-weight: 300;
-      line-height: 1.25rem;
-    }
-    .button-pill:hover svg,
-    .button-pill:hover {
-      color: rgba(255, 255, 255, 1) !important;
-    }
-    #nx-console:hover {
-      background-color: rgba(0, 122, 204, 1);
-    }
-    #nx-console svg {
-      color: rgba(0, 122, 204, 1);
-    }
-    #nx-console-jetbrains {
-      margin-top: 2rem;
-    }
-    #nx-console-jetbrains:hover {
-      background-color: rgba(255, 49, 140, 1);
-    }
-    #nx-console-jetbrains svg {
-      color: rgba(255, 49, 140, 1);
-    }
-    #nx-repo:hover {
-      background-color: rgba(24, 23, 23, 1);
-    }
-    #nx-repo svg {
-      color: rgba(24, 23, 23, 1);
-    }
-    #nx-cloud {
-      margin-bottom: 2rem;
-      margin-top: 2rem;
-      padding: 2.5rem 2rem;
-    }
-    #nx-cloud > div {
-      align-items: center;
-      display: flex;
-    }
-    #nx-cloud > div svg {
-      border-radius: 0.375rem;
-      flex-shrink: 0;
-      width: 3rem;
-    }
-    #nx-cloud > div h2 {
-      font-size: 1.125rem;
-      font-weight: 400;
-      letter-spacing: -0.025em;
-      line-height: 1.75rem;
-      padding-left: 1rem;
-      padding-right: 1rem;
-    }
-    #nx-cloud > div h2 span {
-      display: block;
-      font-size: 0.875rem;
-      font-weight: 300;
-      line-height: 1.25rem;
-    }
-    #nx-cloud p {
-      font-size: 1rem;
-      line-height: 1.5rem;
-      margin-top: 1rem;
-    }
-    #nx-cloud pre {
-      margin-top: 1rem;
-    }
-    #nx-cloud a {
-      color: rgba(107, 114, 128, 1);
-      display: block;
-      font-size: 0.875rem;
-      line-height: 1.25rem;
-      margin-top: 1.5rem;
-      text-align: right;
-    }
-    #nx-cloud a:hover {
-      text-decoration: underline;
-    }
-    #commands {
-      padding: 2.5rem 2rem;
-      margin-top: 3.5rem;
-    }
-    #commands h2 {
-      font-size: 1.25rem;
-      font-weight: 400;
-      letter-spacing: -0.025em;
-      line-height: 1.75rem;
-      padding-left: 1rem;
-      padding-right: 1rem;
-    }
-    #commands p {
-      font-size: 1rem;
-      font-weight: 300;
-      line-height: 1.5rem;
-      margin-top: 1rem;
-      padding-left: 1rem;
-      padding-right: 1rem;
-    }
-    details {
-      align-items: center;
-      display: flex;
-      margin-top: 1rem;
-      padding-left: 1rem;
-      padding-right: 1rem;
-      width: 100%;
-    }
-    details pre > span {
-      color: rgba(181, 181, 181, 1);
-      display: block;
-    }
-    summary {
-      border-radius: 0.5rem;
-      display: flex;
-      font-weight: 400;
-      padding: 0.5rem;
-      cursor: pointer;
-      transition-property: background-color, border-color, color, fill, stroke,
-      opacity, box-shadow, transform, filter, backdrop-filter,
-      -webkit-backdrop-filter;
-      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
-      transition-duration: 150ms;
-    }
-    summary:hover {
-      background-color: rgba(243, 244, 246, 1);
-    }
-    summary svg {
-      height: 1.5rem;
-      margin-right: 1rem;
-      width: 1.5rem;
-    }
-    #love {
-      color: rgba(107, 114, 128, 1);
-      font-size: 0.875rem;
-      line-height: 1.25rem;
-      margin-top: 3.5rem;
-      opacity: 0.6;
-      text-align: center;
-    }
-    #love svg {
-      color: rgba(252, 165, 165, 1);
-      width: 1.25rem;
-      height: 1.25rem;
-      display: inline;
-      margin-top: -0.25rem;
-    }
-    @media screen and (min-width: 768px) {
-      #hero {
-        grid-template-columns: repeat(2, minmax(0, 1fr));
-      }
-      #hero .logo-container {
-        display: flex;
-      }
-      #middle-content {
-        grid-template-columns: repeat(2, minmax(0, 1fr));
-        gap: 4rem;
-      }
-    }
-          `,
-        }}
-      />
-      <div className="wrapper">
-        <div className="container">
-          <div id="welcome">
-            <h1>
-              <span> Hello there, </span>
-              Welcome {title} 👋
-            </h1>
-          </div>
-
-          <div id="hero" className="rounded">
-            <div className="text-container">
-              <h2>
-                <svg
-                  fill="none"
-                  stroke="currentColor"
-                  viewBox="0 0 24 24"
-                  xmlns="http://www.w3.org/2000/svg"
-                >
-                  <path
-                    strokeLinecap="round"
-                    strokeLinejoin="round"
-                    strokeWidth="2"
-                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
-                  />
-                </svg>
-                <span>You&apos;re up and running</span>
-              </h2>
-              <a href="#commands"> What&apos;s next? </a>
-            </div>
-            <div className="logo-container">
-              <svg
-                fill="currentColor"
-                role="img"
-                viewBox="0 0 24 24"
-                xmlns="http://www.w3.org/2000/svg"
-              >
-                <path d="M11.987 14.138l-3.132 4.923-5.193-8.427-.012 8.822H0V4.544h3.691l5.247 8.833.005-3.998 3.044 4.759zm.601-5.761c.024-.048 0-3.784.008-3.833h-3.65c.002.059-.005 3.776-.003 3.833h3.645zm5.634 4.134a2.061 2.061 0 0 0-1.969 1.336 1.963 1.963 0 0 1 2.343-.739c.396.161.917.422 1.33.283a2.1 2.1 0 0 0-1.704-.88zm3.39 1.061c-.375-.13-.8-.277-1.109-.681-.06-.08-.116-.17-.176-.265a2.143 2.143 0 0 0-.533-.642c-.294-.216-.68-.322-1.18-.322a2.482 2.482 0 0 0-2.294 1.536 2.325 2.325 0 0 1 4.002.388.75.75 0 0 0 .836.334c.493-.105.46.36 1.203.518v-.133c-.003-.446-.246-.55-.75-.733zm2.024 1.266a.723.723 0 0 0 .347-.638c-.01-2.957-2.41-5.487-5.37-5.487a5.364 5.364 0 0 0-4.487 2.418c-.01-.026-1.522-2.39-1.538-2.418H8.943l3.463 5.423-3.379 5.32h3.54l1.54-2.366 1.568 2.366h3.541l-3.21-5.052a.7.7 0 0 1-.084-.32 2.69 2.69 0 0 1 2.69-2.691h.001c1.488 0 1.736.89 2.057 1.308.634.826 1.9.464 1.9 1.541a.707.707 0 0 0 1.066.596zm.35.133c-.173.372-.56.338-.755.639-.176.271.114.412.114.412s.337.156.538-.311c.104-.231.14-.488.103-.74z" />
-              </svg>
-            </div>
-          </div>
-
-          <div id="middle-content">
-            <div id="middle-content-container">
-              <div id="learning-materials" className="rounded shadow">
-                <h2>Learning materials</h2>
-                <a
-                  href="https://nx.dev/getting-started/intro?utm_source=nx-project"
-                  target="_blank"
-                  rel="noreferrer"
-                  className="list-item-link"
-                >
-                  <svg
-                    fill="none"
-                    stroke="currentColor"
-                    viewBox="0 0 24 24"
-                    xmlns="http://www.w3.org/2000/svg"
-                  >
-                    <path
-                      strokeLinecap="round"
-                      strokeLinejoin="round"
-                      strokeWidth="2"
-                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
-                    />
-                  </svg>
-                  <span>
-                    Documentation
-                    <span> Everything is in there </span>
-                  </span>
-                  <svg
-                    fill="none"
-                    stroke="currentColor"
-                    viewBox="0 0 24 24"
-                    xmlns="http://www.w3.org/2000/svg"
-                  >
-                    <path
-                      strokeLinecap="round"
-                      strokeLinejoin="round"
-                      strokeWidth="2"
-                      d="M9 5l7 7-7 7"
-                    />
-                  </svg>
-                </a>
-                <a
-                  href="https://nx.dev/blog/?utm_source=nx-project"
-                  target="_blank"
-                  rel="noreferrer"
-                  className="list-item-link"
-                >
-                  <svg
-                    fill="none"
-                    stroke="currentColor"
-                    viewBox="0 0 24 24"
-                    xmlns="http://www.w3.org/2000/svg"
-                  >
-                    <path
-                      strokeLinecap="round"
-                      strokeLinejoin="round"
-                      strokeWidth="2"
-                      d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
-                    />
-                  </svg>
-                  <span>
-                    Blog
-                    <span> Changelog, features & events </span>
-                  </span>
-                  <svg
-                    fill="none"
-                    stroke="currentColor"
-                    viewBox="0 0 24 24"
-                    xmlns="http://www.w3.org/2000/svg"
-                  >
-                    <path
-                      strokeLinecap="round"
-                      strokeLinejoin="round"
-                      strokeWidth="2"
-                      d="M9 5l7 7-7 7"
-                    />
-                  </svg>
-                </a>
-                <a
-                  href="https://www.youtube.com/@NxDevtools/videos?utm_source=nx-project&sub_confirmation=1"
-                  target="_blank"
-                  rel="noreferrer"
-                  className="list-item-link"
-                >
-                  <svg
-                    role="img"
-                    viewBox="0 0 24 24"
-                    fill="currentColor"
-                    xmlns="http://www.w3.org/2000/svg"
-                  >
-                    <title>YouTube</title>
-                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
-                  </svg>
-                  <span>
-                    YouTube channel
-                    <span> Nx Show, talks & tutorials </span>
-                  </span>
-                  <svg
-                    fill="none"
-                    stroke="currentColor"
-                    viewBox="0 0 24 24"
-                    xmlns="http://www.w3.org/2000/svg"
-                  >
-                    <path
-                      strokeLinecap="round"
-                      strokeLinejoin="round"
-                      strokeWidth="2"
-                      d="M9 5l7 7-7 7"
-                    />
-                  </svg>
-                </a>
-                <a
-                  href="https://nx.dev/react-tutorial/1-code-generation?utm_source=nx-project"
-                  target="_blank"
-                  rel="noreferrer"
-                  className="list-item-link"
-                >
-                  <svg
-                    fill="none"
-                    stroke="currentColor"
-                    viewBox="0 0 24 24"
-                    xmlns="http://www.w3.org/2000/svg"
-                  >
-                    <path
-                      strokeLinecap="round"
-                      strokeLinejoin="round"
-                      strokeWidth="2"
-                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
-                    />
-                  </svg>
-                  <span>
-                    Interactive tutorials
-                    <span> Create an app, step-by-step </span>
-                  </span>
-                  <svg
-                    fill="none"
-                    stroke="currentColor"
-                    viewBox="0 0 24 24"
-                    xmlns="http://www.w3.org/2000/svg"
-                  >
-                    <path
-                      strokeLinecap="round"
-                      strokeLinejoin="round"
-                      strokeWidth="2"
-                      d="M9 5l7 7-7 7"
-                    />
-                  </svg>
-                </a>
-              </div>
-              <a
-                id="nx-repo"
-                className="button-pill rounded shadow"
-                href="https://github.com/nrwl/nx?utm_source=nx-project"
-                target="_blank"
-                rel="noreferrer"
-              >
-                <svg
-                  fill="currentColor"
-                  role="img"
-                  viewBox="0 0 24 24"
-                  xmlns="http://www.w3.org/2000/svg"
-                >
-                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
-                </svg>
-                <span>
-                  Nx is open source
-                  <span> Love Nx? Give us a star! </span>
-                </span>
-              </a>
-            </div>
-            <div id="other-links">
-              <a
-                id="nx-console"
-                className="button-pill rounded shadow"
-                href="https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console&utm_source=nx-project"
-                target="_blank"
-                rel="noreferrer"
-              >
-                <svg
-                  fill="currentColor"
-                  role="img"
-                  viewBox="0 0 24 24"
-                  xmlns="http://www.w3.org/2000/svg"
-                >
-                  <title>Visual Studio Code</title>
-                  <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
-                </svg>
-                <span>
-                  Install Nx Console for VSCode
-                  <span>The official VSCode extension for Nx.</span>
-                </span>
-              </a>
-              <a
-                id="nx-console-jetbrains"
-                className="button-pill rounded shadow"
-                href="https://plugins.jetbrains.com/plugin/21060-nx-console"
-                target="_blank"
-                rel="noreferrer"
-              >
-                <svg
-                  height="48"
-                  width="48"
-                  viewBox="20 20 60 60"
-                  xmlns="http://www.w3.org/2000/svg"
-                >
-                  <path d="m22.5 22.5h60v60h-60z" />
-                  <g fill="#fff">
-                    <path d="m29.03 71.25h22.5v3.75h-22.5z" />
-                    <path d="m28.09 38 1.67-1.58a1.88 1.88 0 0 0 1.47.87c.64 0 1.06-.44 1.06-1.31v-5.98h2.58v6a3.48 3.48 0 0 1 -.87 2.6 3.56 3.56 0 0 1 -2.57.95 3.84 3.84 0 0 1 -3.34-1.55z" />
-                    <path d="m36 30h7.53v2.19h-5v1.44h4.49v2h-4.42v1.49h5v2.21h-7.6z" />
-                    <path d="m47.23 32.29h-2.8v-2.29h8.21v2.27h-2.81v7.1h-2.6z" />
-                    <path d="m29.13 43.08h4.42a3.53 3.53 0 0 1 2.55.83 2.09 2.09 0 0 1 .6 1.53 2.16 2.16 0 0 1 -1.44 2.09 2.27 2.27 0 0 1 1.86 2.29c0 1.61-1.31 2.59-3.55 2.59h-4.44zm5 2.89c0-.52-.42-.8-1.18-.8h-1.29v1.64h1.24c.79 0 1.25-.26 1.25-.81zm-.9 2.66h-1.57v1.73h1.62c.8 0 1.24-.31 1.24-.86 0-.5-.4-.87-1.27-.87z" />
-                    <path d="m38 43.08h4.1a4.19 4.19 0 0 1 3 1 2.93 2.93 0 0 1 .9 2.19 3 3 0 0 1 -1.93 2.89l2.24 3.27h-3l-1.88-2.84h-.87v2.84h-2.56zm4 4.5c.87 0 1.39-.43 1.39-1.11 0-.75-.54-1.12-1.4-1.12h-1.44v2.26z" />
-                    <path d="m49.59 43h2.5l4 9.44h-2.79l-.67-1.69h-3.63l-.67 1.69h-2.71zm2.27 5.73-1-2.65-1.06 2.65z" />
-                    <path d="m56.46 43.05h2.6v9.37h-2.6z" />
-                    <path d="m60.06 43.05h2.42l3.37 5v-5h2.57v9.37h-2.26l-3.53-5.14v5.14h-2.57z" />
-                    <path d="m68.86 51 1.45-1.73a4.84 4.84 0 0 0 3 1.13c.71 0 1.08-.24 1.08-.65 0-.4-.31-.6-1.59-.91-2-.46-3.53-1-3.53-2.93 0-1.74 1.37-3 3.62-3a5.89 5.89 0 0 1 3.86 1.25l-1.26 1.84a4.63 4.63 0 0 0 -2.62-.92c-.63 0-.94.25-.94.6 0 .42.32.61 1.63.91 2.14.46 3.44 1.16 3.44 2.91 0 1.91-1.51 3-3.79 3a6.58 6.58 0 0 1 -4.35-1.5z" />
-                  </g>
-                </svg>
-                <span>
-                  Install Nx Console for JetBrains
-                  <span>
-                    Available for WebStorm, Intellij IDEA Ultimate and more!
-                  </span>
-                </span>
-              </a>
-              <div id="nx-cloud" className="rounded shadow">
-                <div>
-                  <svg
-                    id="nx-cloud-logo"
-                    role="img"
-                    xmlns="http://www.w3.org/2000/svg"
-                    stroke="currentColor"
-                    fill="transparent"
-                    viewBox="0 0 24 24"
-                  >
-                    <path
-                      strokeWidth="2"
-                      d="M23 3.75V6.5c-3.036 0-5.5 2.464-5.5 5.5s-2.464 5.5-5.5 5.5-5.5 2.464-5.5 5.5H3.75C2.232 23 1 21.768 1 20.25V3.75C1 2.232 2.232 1 3.75 1h16.5C21.768 1 23 2.232 23 3.75Z"
-                    />
-                    <path
-                      strokeWidth="2"
-                      d="M23 6v14.1667C23 21.7307 21.7307 23 20.1667 23H6c0-3.128 2.53867-5.6667 5.6667-5.6667 3.128 0 5.6666-2.5386 5.6666-5.6666C17.3333 8.53867 19.872 6 23 6Z"
-                    />
-                  </svg>
-                  <h2>
-                    Nx Cloud
-                    <span>Enable faster CI & better DX</span>
-                  </h2>
-                </div>
-                <p>
-                  You can activate distributed tasks executions and caching by
-                  running:
-                </p>
-                <pre>nx connect</pre>
-                <a
-                  href="https://nx.dev/nx-cloud?utm_source=nx-project"
-                  target="_blank"
-                  rel="noreferrer"
-                >
-                  {' '}
-                  What is Nx Cloud?{' '}
-                </a>
-              </div>
-            </div>
-          </div>
-
-          <div id="commands" className="rounded shadow">
-            <h2>Next steps</h2>
-            <p>Here are some things you can do with Nx:</p>
-            <details>
-              <summary>
-                <svg
-                  fill="none"
-                  stroke="currentColor"
-                  viewBox="0 0 24 24"
-                  xmlns="http://www.w3.org/2000/svg"
-                >
-                  <path
-                    strokeLinecap="round"
-                    strokeLinejoin="round"
-                    strokeWidth="2"
-                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
-                  />
-                </svg>
-                Build, test and lint your app
-              </summary>
-              <pre>
-                <span># Build</span>
-                nx build {title}
-                <span># Test</span>
-                nx test {title}
-                <span># Lint</span>
-                nx lint {title}
-                <span># Run them together!</span>
-                nx run-many -p {title} -t build test lint
-              </pre>
-            </details>
-
-            <details>
-              <summary>
-                <svg
-                  fill="none"
-                  stroke="currentColor"
-                  viewBox="0 0 24 24"
-                  xmlns="http://www.w3.org/2000/svg"
-                >
-                  <path
-                    strokeLinecap="round"
-                    strokeLinejoin="round"
-                    strokeWidth="2"
-                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
-                  />
-                </svg>
-                View project details
-              </summary>
-              <pre>nx show project {title}</pre>
-            </details>
-            <details>
-              <summary>
-                <svg
-                  fill="none"
-                  stroke="currentColor"
-                  viewBox="0 0 24 24"
-                  xmlns="http://www.w3.org/2000/svg"
-                >
-                  <path
-                    strokeLinecap="round"
-                    strokeLinejoin="round"
-                    strokeWidth="2"
-                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
-                  />
-                </svg>
-                View interactive project graph
-              </summary>
-              <pre>nx graph</pre>
-            </details>
-            <details>
-              <summary>
-                <svg
-                  fill="none"
-                  stroke="currentColor"
-                  viewBox="0 0 24 24"
-                  xmlns="http://www.w3.org/2000/svg"
-                >
-                  <path
-                    strokeLinecap="round"
-                    strokeLinejoin="round"
-                    strokeWidth="2"
-                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
-                  />
-                </svg>
-                Add UI library
-              </summary>
-              <pre>
-                <span># Generate UI lib</span>
-                nx g @nx/react:lib ui
-                <span># Add a component</span>
-                nx g @nx/react:component ui/src/lib/button
-              </pre>
-            </details>
-          </div>
-
-          <p id="love">
-            Carefully crafted with
-            <svg
-              fill="currentColor"
-              stroke="none"
-              viewBox="0 0 24 24"
-              xmlns="http://www.w3.org/2000/svg"
-            >
-              <path
-                strokeLinecap="round"
-                strokeLinejoin="round"
-                strokeWidth="2"
-                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
-              />
-            </svg>
-          </p>
-        </div>
-      </div>
-    </>
-  );
-}
-
-export default NxWelcome;
diff --git a/apps/web/src/app/placeholder-home.tsx b/apps/web/src/app/placeholder-home.tsx
new file mode 100644
index 0000000..ba63ad3
--- /dev/null
+++ b/apps/web/src/app/placeholder-home.tsx
@@ -0,0 +1,8 @@
+// Stands in for the recipe library page until it lands in its feature lib.
+export function PlaceholderHome() {
+  return (
+    <main>
+      <h1>Bite &amp; Board</h1>
+    </main>
+  );
+}
diff --git a/apps/web/src/app/route-error.tsx b/apps/web/src/app/route-error.tsx
new file mode 100644
index 0000000..7d30276
--- /dev/null
+++ b/apps/web/src/app/route-error.tsx
@@ -0,0 +1,12 @@
+import { isRouteErrorResponse, useRouteError } from 'react-router';
+
+export function RouteError() {
+  const error = useRouteError();
+  const notFound = isRouteErrorResponse(error) && error.status === 404;
+
+  return (
+    <main>
+      <h1>{notFound ? 'Page not found' : 'Something went wrong'}</h1>
+    </main>
+  );
+}
diff --git a/apps/web/src/app/router.spec.tsx b/apps/web/src/app/router.spec.tsx
new file mode 100644
index 0000000..c394c2a
--- /dev/null
+++ b/apps/web/src/app/router.spec.tsx
@@ -0,0 +1,49 @@
+import { render, screen } from '@testing-library/react';
+import { createMemoryRouter, RouterProvider } from 'react-router';
+import { RouteError } from './route-error';
+import { routes } from './router';
+
+function renderAt(path: string) {
+  const router = createMemoryRouter(routes, { initialEntries: [path] });
+  render(<RouterProvider router={router} />);
+}
+
+describe('routes', () => {
+  it('renders the lazy home page at /', async () => {
+    renderAt('/');
+    expect(
+      await screen.findByRole('heading', { name: 'Bite & Board' }),
+    ).toBeTruthy();
+  });
+
+  it('renders the not-found error for an unknown path', async () => {
+    renderAt('/nope');
+    expect(
+      await screen.findByRole('heading', { name: 'Page not found' }),
+    ).toBeTruthy();
+  });
+});
+
+describe('RouteError', () => {
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  it('renders a generic message when a route throws', async () => {
+    // The router logs the thrown error; keep the test output clean.
+    vi.spyOn(console, 'error').mockImplementation(() => undefined);
+    const router = createMemoryRouter([
+      {
+        path: '/',
+        errorElement: <RouteError />,
+        loader: () => {
+          throw new Error('boom');
+        },
+      },
+    ]);
+    render(<RouterProvider router={router} />);
+    expect(
+      await screen.findByRole('heading', { name: 'Something went wrong' }),
+    ).toBeTruthy();
+  });
+});
diff --git a/apps/web/src/app/router.tsx b/apps/web/src/app/router.tsx
new file mode 100644
index 0000000..cd1296b
--- /dev/null
+++ b/apps/web/src/app/router.tsx
@@ -0,0 +1,19 @@
+import type { RouteObject } from 'react-router';
+import { RouteError } from './route-error';
+
+export const routes: RouteObject[] = [
+  {
+    path: '/',
+    errorElement: <RouteError />,
+    // Rendered while the first lazy page chunk loads; the app shell replaces it.
+    HydrateFallback: () => null,
+    children: [
+      {
+        index: true,
+        lazy: async () => ({
+          Component: (await import('./placeholder-home')).PlaceholderHome,
+        }),
+      },
+    ],
+  },
+];
diff --git a/apps/web/src/main.tsx b/apps/web/src/main.tsx
index 6bd3cda..de20716 100644
--- a/apps/web/src/main.tsx
+++ b/apps/web/src/main.tsx
@@ -1,7 +1,10 @@
 import { StrictMode } from 'react';
-import { BrowserRouter } from 'react-router-dom';
 import * as ReactDOM from 'react-dom/client';
-import App from './app/app';
+import { createBrowserRouter } from 'react-router';
+import { RouterProvider } from 'react-router/dom';
+import { routes } from './app/router';
+
+const router = createBrowserRouter(routes);
 
 const root = ReactDOM.createRoot(
   document.getElementById('root') as HTMLElement,
@@ -9,8 +12,6 @@ const root = ReactDOM.createRoot(
 
 root.render(
   <StrictMode>
-    <BrowserRouter>
-      <App />
-    </BrowserRouter>
+    <RouterProvider router={router} />
   </StrictMode>,
 );
diff --git a/apps/web/vite.config.mts b/apps/web/vite.config.mts
index ffb1320..eca5fc5 100644
--- a/apps/web/vite.config.mts
+++ b/apps/web/vite.config.mts
@@ -9,6 +9,11 @@ export default defineConfig(() => ({
   server: {
     port: 4200,
     host: 'localhost',
+    // Same origin in dev as in prod, so the auth cookie needs no CORS setup.
+    proxy: {
+      '/api/': 'http://localhost:8000',
+      '/media/': 'http://localhost:8000',
+    },
   },
   preview: {
     port: 4300,
diff --git a/eslint.config.mjs b/eslint.config.mjs
index 6865fc2..7e8774d 100644
--- a/eslint.config.mjs
+++ b/eslint.config.mjs
@@ -22,8 +22,49 @@ export default [
           allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
           depConstraints: [
             {
-              sourceTag: '*',
-              onlyDependOnLibsWithTags: ['*'],
+              sourceTag: 'type:app',
+              onlyDependOnLibsWithTags: [
+                'type:feature',
+                'type:data-access',
+                'type:ui',
+                'type:domain',
+              ],
+            },
+            {
+              sourceTag: 'type:feature',
+              onlyDependOnLibsWithTags: [
+                'type:data-access',
+                'type:ui',
+                'type:domain',
+              ],
+            },
+            {
+              sourceTag: 'type:ui',
+              onlyDependOnLibsWithTags: ['type:domain'],
+              // Presentational only: no server state, API client or routing.
+              bannedExternalImports: [
+                '@tanstack/*',
+                '@hey-api/*',
+                'react-router',
+                'react-router/*',
+                'react-router-*',
+              ],
+            },
+            {
+              sourceTag: 'type:data-access',
+              onlyDependOnLibsWithTags: [],
+            },
+            {
+              sourceTag: 'type:domain',
+              onlyDependOnLibsWithTags: [],
+              // Pure TypeScript: no React and no IO.
+              bannedExternalImports: [
+                'react',
+                'react/*',
+                'react-*',
+                '@tanstack/*',
+                '@hey-api/*',
+              ],
             },
           ],
         },
diff --git a/libs/data-access/README.md b/libs/data-access/README.md
new file mode 100644
index 0000000..27509fe
--- /dev/null
+++ b/libs/data-access/README.md
@@ -0,0 +1,7 @@
+# data-access
+
+The only way the web app talks to the API: the hey-api generated client, TanStack Query hooks, Zod schemas and query keys.
+
+- Tag `type:data-access`: imports no other workspace lib.
+
+Run `npx nx test data-access`.
diff --git a/libs/data-access/eslint.config.mjs b/libs/data-access/eslint.config.mjs
new file mode 100644
index 0000000..2cde510
--- /dev/null
+++ b/libs/data-access/eslint.config.mjs
@@ -0,0 +1,15 @@
+import nx from '@nx/eslint-plugin';
+import baseConfig from '../../eslint.config.mjs';
+
+export default [
+  ...nx.configs['flat/react'],
+  ...baseConfig,
+  {
+    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
+    // Override or add rules here
+    rules: {},
+  },
+  {
+    ignores: ['**/out-tsc'],
+  },
+];
diff --git a/libs/data-access/package.json b/libs/data-access/package.json
new file mode 100644
index 0000000..fbb90d8
--- /dev/null
+++ b/libs/data-access/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "@bite-and-board/data-access",
+  "version": "0.0.1",
+  "private": true,
+  "type": "module",
+  "main": "./src/index.ts",
+  "types": "./src/index.ts",
+  "exports": {
+    ".": {
+      "types": "./src/index.ts",
+      "import": "./src/index.ts",
+      "default": "./src/index.ts"
+    },
+    "./package.json": "./package.json"
+  },
+  "nx": {
+    "name": "data-access",
+    "tags": [
+      "type:data-access"
+    ]
+  }
+}
diff --git a/libs/data-access/src/index.ts b/libs/data-access/src/index.ts
new file mode 100644
index 0000000..cb0ff5c
--- /dev/null
+++ b/libs/data-access/src/index.ts
@@ -0,0 +1 @@
+export {};
diff --git a/libs/data-access/tsconfig.json b/libs/data-access/tsconfig.json
new file mode 100644
index 0000000..8c5fc02
--- /dev/null
+++ b/libs/data-access/tsconfig.json
@@ -0,0 +1,13 @@
+{
+  "files": [],
+  "include": [],
+  "references": [
+    {
+      "path": "./tsconfig.lib.json"
+    },
+    {
+      "path": "./tsconfig.spec.json"
+    }
+  ],
+  "extends": "../../tsconfig.base.json"
+}
diff --git a/libs/data-access/tsconfig.lib.json b/libs/data-access/tsconfig.lib.json
new file mode 100644
index 0000000..7c58263
--- /dev/null
+++ b/libs/data-access/tsconfig.lib.json
@@ -0,0 +1,44 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": {
+    "outDir": "dist",
+    "types": [
+      "node",
+      "@nx/react/typings/cssmodule.d.ts",
+      "@nx/react/typings/image.d.ts"
+    ],
+    "rootDir": "src",
+    "jsx": "react-jsx",
+    "module": "esnext",
+    "moduleResolution": "bundler",
+    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo"
+  },
+  "exclude": [
+    "out-tsc",
+    "dist",
+    "**/*.spec.ts",
+    "**/*.test.ts",
+    "**/*.spec.tsx",
+    "**/*.test.tsx",
+    "**/*.spec.js",
+    "**/*.test.js",
+    "**/*.spec.jsx",
+    "**/*.test.jsx",
+    "vite.config.ts",
+    "vite.config.mts",
+    "vitest.config.ts",
+    "vitest.config.mts",
+    "src/**/*.test.ts",
+    "src/**/*.spec.ts",
+    "src/**/*.test.tsx",
+    "src/**/*.spec.tsx",
+    "src/**/*.test.js",
+    "src/**/*.spec.js",
+    "src/**/*.test.jsx",
+    "src/**/*.spec.jsx",
+    "eslint.config.js",
+    "eslint.config.cjs",
+    "eslint.config.mjs"
+  ],
+  "include": ["src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"]
+}
diff --git a/libs/data-access/tsconfig.spec.json b/libs/data-access/tsconfig.spec.json
new file mode 100644
index 0000000..60ca21b
--- /dev/null
+++ b/libs/data-access/tsconfig.spec.json
@@ -0,0 +1,36 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": {
+    "outDir": "./out-tsc/vitest",
+    "types": [
+      "vitest/globals",
+      "vitest/importMeta",
+      "vite/client",
+      "node",
+      "vitest"
+    ],
+    "jsx": "react-jsx",
+    "module": "esnext",
+    "moduleResolution": "bundler"
+  },
+  "include": [
+    "vite.config.ts",
+    "vite.config.mts",
+    "vitest.config.ts",
+    "vitest.config.mts",
+    "src/**/*.test.ts",
+    "src/**/*.spec.ts",
+    "src/**/*.test.tsx",
+    "src/**/*.spec.tsx",
+    "src/**/*.test.js",
+    "src/**/*.spec.js",
+    "src/**/*.test.jsx",
+    "src/**/*.spec.jsx",
+    "src/**/*.d.ts"
+  ],
+  "references": [
+    {
+      "path": "./tsconfig.lib.json"
+    }
+  ]
+}
diff --git a/libs/data-access/vite.config.mts b/libs/data-access/vite.config.mts
new file mode 100644
index 0000000..c014f64
--- /dev/null
+++ b/libs/data-access/vite.config.mts
@@ -0,0 +1,20 @@
+import { defineConfig } from 'vite';
+import react from '@vitejs/plugin-react';
+export default defineConfig(() => ({
+  root: import.meta.dirname,
+  cacheDir: '../../node_modules/.vite/libs/data-access',
+  plugins: [react()],
+  test: {
+    name: '@bite-and-board/data-access',
+    watch: false,
+    passWithNoTests: true,
+    globals: true,
+    environment: 'jsdom',
+    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
+    reporters: ['default'],
+    coverage: {
+      reportsDirectory: './test-output/vitest/coverage',
+      provider: 'v8' as const,
+    },
+  },
+}));
diff --git a/libs/recipe-domain/README.md b/libs/recipe-domain/README.md
new file mode 100644
index 0000000..dae340f
--- /dev/null
+++ b/libs/recipe-domain/README.md
@@ -0,0 +1,8 @@
+# recipe-domain
+
+Pure TypeScript recipe rules shared by the feature libs, the app and `ui-components`: scaling, amount formatting and parsing, the countable-unit rule and the library filter.
+
+- Tag `type:domain`: imports no other workspace lib, and lint bans React, TanStack Query and the generated API client. No Node types are loaded, so Node built-ins (`fs`, `http`, ...) fail typecheck.
+- Held to 100% coverage: `nx test recipe-domain` always measures coverage and fails below 100%.
+
+Run `npx nx test recipe-domain`.
diff --git a/libs/recipe-domain/eslint.config.mjs b/libs/recipe-domain/eslint.config.mjs
new file mode 100644
index 0000000..0232736
--- /dev/null
+++ b/libs/recipe-domain/eslint.config.mjs
@@ -0,0 +1,8 @@
+import baseConfig from '../../eslint.config.mjs';
+
+export default [
+  ...baseConfig,
+  {
+    ignores: ['**/out-tsc'],
+  },
+];
diff --git a/libs/recipe-domain/package.json b/libs/recipe-domain/package.json
new file mode 100644
index 0000000..4b62d8b
--- /dev/null
+++ b/libs/recipe-domain/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "@bite-and-board/recipe-domain",
+  "version": "0.0.1",
+  "private": true,
+  "type": "module",
+  "main": "./src/index.ts",
+  "types": "./src/index.ts",
+  "exports": {
+    ".": {
+      "types": "./src/index.ts",
+      "import": "./src/index.ts",
+      "default": "./src/index.ts"
+    },
+    "./package.json": "./package.json"
+  },
+  "nx": {
+    "name": "recipe-domain",
+    "tags": [
+      "type:domain"
+    ]
+  }
+}
diff --git a/libs/recipe-domain/src/index.ts b/libs/recipe-domain/src/index.ts
new file mode 100644
index 0000000..cb0ff5c
--- /dev/null
+++ b/libs/recipe-domain/src/index.ts
@@ -0,0 +1 @@
+export {};
diff --git a/libs/recipe-domain/tsconfig.json b/libs/recipe-domain/tsconfig.json
new file mode 100644
index 0000000..62ebbd9
--- /dev/null
+++ b/libs/recipe-domain/tsconfig.json
@@ -0,0 +1,13 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "files": [],
+  "include": [],
+  "references": [
+    {
+      "path": "./tsconfig.lib.json"
+    },
+    {
+      "path": "./tsconfig.spec.json"
+    }
+  ]
+}
diff --git a/libs/recipe-domain/tsconfig.lib.json b/libs/recipe-domain/tsconfig.lib.json
new file mode 100644
index 0000000..c347bb3
--- /dev/null
+++ b/libs/recipe-domain/tsconfig.lib.json
@@ -0,0 +1,27 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": {
+    "rootDir": "src",
+    "outDir": "dist",
+    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
+    "emitDeclarationOnly": true,
+    "forceConsistentCasingInFileNames": true,
+    "types": []
+  },
+  "include": ["src/**/*.ts"],
+  "references": [],
+  "exclude": [
+    "vite.config.ts",
+    "vite.config.mts",
+    "vitest.config.ts",
+    "vitest.config.mts",
+    "src/**/*.test.ts",
+    "src/**/*.spec.ts",
+    "src/**/*.test.tsx",
+    "src/**/*.spec.tsx",
+    "src/**/*.test.js",
+    "src/**/*.spec.js",
+    "src/**/*.test.jsx",
+    "src/**/*.spec.jsx"
+  ]
+}
diff --git a/libs/recipe-domain/tsconfig.spec.json b/libs/recipe-domain/tsconfig.spec.json
new file mode 100644
index 0000000..f68d9d3
--- /dev/null
+++ b/libs/recipe-domain/tsconfig.spec.json
@@ -0,0 +1,34 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": {
+    "outDir": "./out-tsc/vitest",
+    "types": [
+      "vitest/globals",
+      "vitest/importMeta",
+      "vite/client",
+      "node",
+      "vitest"
+    ],
+    "forceConsistentCasingInFileNames": true
+  },
+  "include": [
+    "vite.config.ts",
+    "vite.config.mts",
+    "vitest.config.ts",
+    "vitest.config.mts",
+    "src/**/*.test.ts",
+    "src/**/*.spec.ts",
+    "src/**/*.test.tsx",
+    "src/**/*.spec.tsx",
+    "src/**/*.test.js",
+    "src/**/*.spec.js",
+    "src/**/*.test.jsx",
+    "src/**/*.spec.jsx",
+    "src/**/*.d.ts"
+  ],
+  "references": [
+    {
+      "path": "./tsconfig.lib.json"
+    }
+  ]
+}
diff --git a/libs/recipe-domain/vitest.config.mts b/libs/recipe-domain/vitest.config.mts
new file mode 100644
index 0000000..6423bfd
--- /dev/null
+++ b/libs/recipe-domain/vitest.config.mts
@@ -0,0 +1,24 @@
+import { defineConfig } from 'vitest/config';
+
+export default defineConfig(() => ({
+  root: import.meta.dirname,
+  cacheDir: '../../node_modules/.vite/libs/recipe-domain',
+  test: {
+    name: '@bite-and-board/recipe-domain',
+    watch: false,
+    passWithNoTests: true,
+    globals: true,
+    environment: 'node',
+    include: ['src/**/*.{test,spec}.ts'],
+    reporters: ['default'],
+    // Scaling and rounding rules must stay fully covered, so every
+    // test run measures coverage and fails below 100%.
+    coverage: {
+      enabled: true,
+      include: ['src/**/*.ts'],
+      thresholds: { 100: true },
+      reportsDirectory: './test-output/vitest/coverage',
+      provider: 'v8' as const,
+    },
+  },
+}));
diff --git a/libs/ui-components/README.md b/libs/ui-components/README.md
new file mode 100644
index 0000000..e95777b
--- /dev/null
+++ b/libs/ui-components/README.md
@@ -0,0 +1,7 @@
+# ui-components
+
+Presentational React components: props in, callbacks out, design tokens only.
+
+- Tag `type:ui`: may import `recipe-domain` only, and lint bans TanStack Query, the generated API client and React Router.
+
+Run `npx nx test ui-components`.
diff --git a/libs/ui-components/eslint.config.mjs b/libs/ui-components/eslint.config.mjs
new file mode 100644
index 0000000..2cde510
--- /dev/null
+++ b/libs/ui-components/eslint.config.mjs
@@ -0,0 +1,15 @@
+import nx from '@nx/eslint-plugin';
+import baseConfig from '../../eslint.config.mjs';
+
+export default [
+  ...nx.configs['flat/react'],
+  ...baseConfig,
+  {
+    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
+    // Override or add rules here
+    rules: {},
+  },
+  {
+    ignores: ['**/out-tsc'],
+  },
+];
diff --git a/libs/ui-components/package.json b/libs/ui-components/package.json
new file mode 100644
index 0000000..bcd5fd4
--- /dev/null
+++ b/libs/ui-components/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "@bite-and-board/ui-components",
+  "version": "0.0.1",
+  "private": true,
+  "type": "module",
+  "main": "./src/index.ts",
+  "types": "./src/index.ts",
+  "exports": {
+    ".": {
+      "types": "./src/index.ts",
+      "import": "./src/index.ts",
+      "default": "./src/index.ts"
+    },
+    "./package.json": "./package.json"
+  },
+  "nx": {
+    "name": "ui-components",
+    "tags": [
+      "type:ui"
+    ]
+  }
+}
diff --git a/libs/ui-components/src/index.ts b/libs/ui-components/src/index.ts
new file mode 100644
index 0000000..cb0ff5c
--- /dev/null
+++ b/libs/ui-components/src/index.ts
@@ -0,0 +1 @@
+export {};
diff --git a/libs/ui-components/tsconfig.json b/libs/ui-components/tsconfig.json
new file mode 100644
index 0000000..8c5fc02
--- /dev/null
+++ b/libs/ui-components/tsconfig.json
@@ -0,0 +1,13 @@
+{
+  "files": [],
+  "include": [],
+  "references": [
+    {
+      "path": "./tsconfig.lib.json"
+    },
+    {
+      "path": "./tsconfig.spec.json"
+    }
+  ],
+  "extends": "../../tsconfig.base.json"
+}
diff --git a/libs/ui-components/tsconfig.lib.json b/libs/ui-components/tsconfig.lib.json
new file mode 100644
index 0000000..7c58263
--- /dev/null
+++ b/libs/ui-components/tsconfig.lib.json
@@ -0,0 +1,44 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": {
+    "outDir": "dist",
+    "types": [
+      "node",
+      "@nx/react/typings/cssmodule.d.ts",
+      "@nx/react/typings/image.d.ts"
+    ],
+    "rootDir": "src",
+    "jsx": "react-jsx",
+    "module": "esnext",
+    "moduleResolution": "bundler",
+    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo"
+  },
+  "exclude": [
+    "out-tsc",
+    "dist",
+    "**/*.spec.ts",
+    "**/*.test.ts",
+    "**/*.spec.tsx",
+    "**/*.test.tsx",
+    "**/*.spec.js",
+    "**/*.test.js",
+    "**/*.spec.jsx",
+    "**/*.test.jsx",
+    "vite.config.ts",
+    "vite.config.mts",
+    "vitest.config.ts",
+    "vitest.config.mts",
+    "src/**/*.test.ts",
+    "src/**/*.spec.ts",
+    "src/**/*.test.tsx",
+    "src/**/*.spec.tsx",
+    "src/**/*.test.js",
+    "src/**/*.spec.js",
+    "src/**/*.test.jsx",
+    "src/**/*.spec.jsx",
+    "eslint.config.js",
+    "eslint.config.cjs",
+    "eslint.config.mjs"
+  ],
+  "include": ["src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"]
+}
diff --git a/libs/ui-components/tsconfig.spec.json b/libs/ui-components/tsconfig.spec.json
new file mode 100644
index 0000000..60ca21b
--- /dev/null
+++ b/libs/ui-components/tsconfig.spec.json
@@ -0,0 +1,36 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": {
+    "outDir": "./out-tsc/vitest",
+    "types": [
+      "vitest/globals",
+      "vitest/importMeta",
+      "vite/client",
+      "node",
+      "vitest"
+    ],
+    "jsx": "react-jsx",
+    "module": "esnext",
+    "moduleResolution": "bundler"
+  },
+  "include": [
+    "vite.config.ts",
+    "vite.config.mts",
+    "vitest.config.ts",
+    "vitest.config.mts",
+    "src/**/*.test.ts",
+    "src/**/*.spec.ts",
+    "src/**/*.test.tsx",
+    "src/**/*.spec.tsx",
+    "src/**/*.test.js",
+    "src/**/*.spec.js",
+    "src/**/*.test.jsx",
+    "src/**/*.spec.jsx",
+    "src/**/*.d.ts"
+  ],
+  "references": [
+    {
+      "path": "./tsconfig.lib.json"
+    }
+  ]
+}
diff --git a/libs/ui-components/vite.config.mts b/libs/ui-components/vite.config.mts
new file mode 100644
index 0000000..7879e0d
--- /dev/null
+++ b/libs/ui-components/vite.config.mts
@@ -0,0 +1,20 @@
+import { defineConfig } from 'vite';
+import react from '@vitejs/plugin-react';
+export default defineConfig(() => ({
+  root: import.meta.dirname,
+  cacheDir: '../../node_modules/.vite/libs/ui-components',
+  plugins: [react()],
+  test: {
+    name: '@bite-and-board/ui-components',
+    watch: false,
+    passWithNoTests: true,
+    globals: true,
+    environment: 'jsdom',
+    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
+    reporters: ['default'],
+    coverage: {
+      reportsDirectory: './test-output/vitest/coverage',
+      provider: 'v8' as const,
+    },
+  },
+}));
diff --git a/nx.json b/nx.json
index 841764d..c73a40d 100644
--- a/nx.json
+++ b/nx.json
@@ -1,10 +1,7 @@
 {
   "$schema": "./node_modules/nx/schemas/nx-schema.json",
   "namedInputs": {
-    "default": [
-      "{projectRoot}/**/*",
-      "sharedGlobals"
-    ],
+    "default": ["{projectRoot}/**/*", "sharedGlobals"],
     "production": [
       "default",
       "!{projectRoot}/.eslintrc.json",
@@ -67,9 +64,7 @@
   "analytics": false,
   "targetDefaults": {
     "test": {
-      "dependsOn": [
-        "^build"
-      ]
+      "dependsOn": ["^build"]
     }
   },
   "generators": {
@@ -85,7 +80,8 @@
       },
       "library": {
         "style": "css",
-        "linter": "eslint"
+        "linter": "eslint",
+        "unitTestRunner": "vitest"
       }
     }
   }
diff --git a/package.json b/package.json
index fcee084..4c3ff98 100644
--- a/package.json
+++ b/package.json
@@ -2,8 +2,13 @@
   "name": "@bite-and-board/source",
   "version": "0.0.0",
   "license": "MIT",
-  "scripts": {},
+  "scripts": {
+    "dev": "nx run-many -t serve -p recipe-service web"
+  },
   "private": true,
+  "engines": {
+    "node": ">=22.22.0"
+  },
   "devDependencies": {
     "@eslint/js": "^9.8.0",
     "@nx/eslint": "24.0.0",
@@ -21,8 +26,8 @@
     "@testing-library/dom": "10.4.0",
     "@testing-library/react": "16.3.0",
     "@types/node": "^24.0.0",
-    "@types/react": "^19.0.0",
-    "@types/react-dom": "^19.0.0",
+    "@types/react": "^19.2.0",
+    "@types/react-dom": "^19.2.0",
     "@vitejs/plugin-react": "^6.0.0",
     "@vitest/coverage-v8": "~5.0.1",
     "@vitest/ui": "~5.0.1",
@@ -48,8 +53,8 @@
   ],
   "packageManager": "npm@12.1.0",
   "dependencies": {
-    "react": "^19.0.0",
-    "react-dom": "^19.0.0",
-    "react-router-dom": "6.30.3"
+    "react": "^19.2.7",
+    "react-dom": "^19.2.7",
+    "react-router": "8.5.0"
   }
 }
diff --git a/tsconfig.json b/tsconfig.json
index 6a95697..52df2e7 100644
--- a/tsconfig.json
+++ b/tsconfig.json
@@ -5,6 +5,15 @@
   "references": [
     {
       "path": "./apps/web"
+    },
+    {
+      "path": "./libs/recipe-domain"
+    },
+    {
+      "path": "./libs/data-access"
+    },
+    {
+      "path": "./libs/ui-components"
     }
   ],
   "compilerOptions": {}
```
