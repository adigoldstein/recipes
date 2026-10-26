---
title: 'Story 1.2: Adapt the frontend scaffold and shared libs'
type: 'refactor'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '97e632c0bdabb7d91d72facf0d69d2a6e5e1da17'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/web` is the Nx welcome scaffold on `react-router-dom@6.30.3` (EOL), `libs/` is empty and module boundaries allow anything (`sourceTag: '*'`), so later frontend stories have nowhere correct to land and nothing enforces AD-2/AD-32/AD-33.

**Approach:** Swap to `react-router@8` in data mode with a lazy placeholder home route, make `apps/web` a thin shell, generate the three shared libs, enforce the full tag matrix (including `type:feature` for feature libs that later stories create), and add a root `npm run dev` with Vite proxying `/api` and `/media` to FastAPI.

## Boundaries & Constraints

**Always:**
- Tag matrix: `type:app` → feature, data-access, ui, domain; `type:feature` → data-access, ui, domain (never feature); `type:ui` → domain; `type:data-access` → nothing; `type:domain` → nothing.
- `bannedExternalImports`: `type:domain` bans `react`, `react-*`, `@tanstack/*`, `@hey-api/*`; `type:ui` bans `@tanstack/*`, `@hey-api/*`, `react-router`, `react-router-*`.
- `apps/web` holds only the shell: `src/main.tsx` and `src/app/` (router, placeholder home). Pages otherwise belong in feature libs.
- Pinned exact versions (`react-router` 8.5.0).
- Code comments explain why, never story/epic references.

**Never:**
- No feature libs yet: each is created by its first story (1.8 `feature-recipes`, 2.2 `feature-auth`, 2.4 `feature-users`, 4.1 `feature-tags`, 5.2 `feature-import`).
- No Tailwind/shadcn/theme/RTL/i18next (1.4), no TanStack Query/hey-api (1.6), no React Compiler, style lint rules or CI changes (1.3).
- No placeholder components or domain functions in the libs beyond an empty public entry point.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Home | Browser opens `/` | Lazy placeholder home renders its heading | N/A |
| Unknown path | `/nope` | Root error element renders (no crash) | N/A |
| Tag violation | `ui-components` imports `@bite-and-board/data-access` | `nx lint ui-components` fails (`@nx/enforce-module-boundaries`) | N/A |
| External ban | `recipe-domain` imports `react` | `nx lint recipe-domain` fails | N/A |
| Proxy | `GET http://localhost:4200/api/health` during `npm run dev` | `{"status":"ok"}` from FastAPI | N/A |

## Decisions (Adi, 2026-10-26)

1. Frontend features live in Nx feature libs (`libs/feature-<name>`, tag `type:feature`); the app is a thin shell. Spine, epics and epic context updated.
2. Libs are non-buildable and consumed from source; only `web` builds (1a).
3. `bannedExternalImports` back the tag matrix (2a).

</frozen-after-approval>

## Code Map

- `package.json` -- root; replace `react-router-dom` with `react-router@8.5.0`; add `"scripts.dev": "nx run-many -t serve -p recipe-service web"`. React installed is 19.3.1 (v8 needs ≥ 19.2.7).
- `apps/web/src/main.tsx` -- `BrowserRouter` from `react-router-dom`; becomes `RouterProvider` with the router from `src/app/router.tsx`.
- `apps/web/src/app/app.tsx`, `app.spec.tsx`, `nx-welcome.tsx`, `app.module.css` -- welcome scaffold; delete.
- `apps/web/vite.config.mts` -- add `server.proxy` `/api`, `/media` → `http://localhost:8000` (recipe-service `serve` port).
- `apps/web/package.json` -- `nx` block; add `tags: ["type:app"]`.
- `eslint.config.mjs` -- `@nx/enforce-module-boundaries` `depConstraints` is `*`→`*`; replace with the matrix + bans.
- `tsconfig.json` -- TS project references (workspaces + `customConditions`); generators add lib references.
- `nx.json` -- plugins already infer `lint`/`test`/`typecheck`; no change expected.
- `apps/recipe-service/project.json` -- `serve` (port 8000, continuous) is what `npm run dev` runs; do not change.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `package-lock.json` -- `npm uninstall react-router-dom`; `npm install react-router@8.5.0 --save-exact`; add `dev` script.
- [x] `libs/recipe-domain` -- `nx g @nx/js:library` (vitest, bundler none), tag `type:domain`, empty `src/index.ts`.
- [x] `libs/data-access`, `libs/ui-components` -- `nx g @nx/react:library` (vitest, bundler none, `--component=false`), tags `type:data-access` / `type:ui`.
- [x] `eslint.config.mjs` -- matrix + `bannedExternalImports`.
- [x] `apps/web/src/app/router.tsx`, `apps/web/src/app/placeholder-home.tsx`, `apps/web/src/main.tsx` -- `createBrowserRouter`, lazy `/` route, root error element; delete welcome files.
- [x] `apps/web/src/app/router.spec.tsx` -- `createMemoryRouter` with the same routes: `/` shows the home heading, unknown path shows the error element.
- [x] `apps/web/vite.config.mts` -- proxy.
- [x] Throwaway check of I/O rows 3–4 (temporary import, lint fails, revert); record in Implementation Notes.

**Acceptance Criteria:**
- Given the repo, when `npx nx run-many -t lint test build` runs, then all projects pass.
- Given `npm run dev`, when both servers are up, then `http://localhost:4200/` renders the home route and `/api/health` is proxied.
- Given `package.json`, then `react-router-dom` is absent and `react-router` is `8.5.0`.

## Implementation Notes

- Implemented directly (no implementation subagent), as in Story 1.1.
- Libs are generated with `@nx/js:library` (recipe-domain) and `@nx/react:library` (data-access, ui-components), `bundler none`, vitest. After generation: the placeholder `recipeDomain()` function and its spec, both `.babelrc` files, the `@babel/core`/`@babel/preset-react` devDependencies the React generator added, and the "workers" comment block are removed. Each lib gets `nx.name` (short project names `recipe-domain`, `data-access`, `ui-components`, like `web`), `private`, `type: module`, `export {};` as entry point, and `passWithNoTests` (vitest otherwise fails on an empty lib).
- The generator reformatted `nx.json` with Prettier and added `unitTestRunner: vitest` to the `@nx/react` library defaults; kept.
- Routes are exported as `routes: RouteObject[]` from `apps/web/src/app/router.tsx`; `main.tsx` creates the browser router, so the spec runs the same routes through `createMemoryRouter`. `RouterProvider` comes from `react-router/dom` (DOM build in v8). Root route has `errorElement: <RouteError />` (404 → "Page not found", otherwise "Something went wrong"); English placeholder copy until i18next lands in 1.4.
- Build emits the placeholder home as its own chunk (`placeholder-home-*.js`), so lazy loading works.
- Boundary probes (throwaway files, removed): `ui-components` → `@bite-and-board/data-access` fails ("type:ui can only depend on type:domain"); `ui-components` → `react-router` fails (banned external); `recipe-domain` → `react` fails (banned external); with both libs temporarily retagged `type:feature`, feature → feature fails. `@tanstack/*` / `@hey-api/*` bans can only fire once those packages are installed (1.6), since Nx checks banned imports against known external nodes.
- `npm run dev`: `GET http://localhost:4200/api/health` → `{"status":"ok"}` through the proxy; `/media/x.webp` → FastAPI's 404 (not Vite's SPA fallback), so `/media` is proxied too; `/` renders "Bite & Board" in the browser with no console errors.
- `npx nx run-many -t lint test build typecheck --skip-nx-cache`: 16/16 tasks succeed (web 3 tests, recipe-service 34 tests).
- Review patches: `recipe-domain` measures coverage on every `nx test` with a 100% threshold (empty lib passes; a half-covered throwaway function failed at 50% branches) and loads no Node types (`types: []`, so `node:fs` fails typecheck); its vitest `include` is `src/**` only. Root `react`/`react-dom` floors raised to `^19.2.7` and `@types/react*` to `^19.2.0` (react-router 8 peers); `engines.node >=22.22.0` (react-router 8; CI uses Node 24). Proxy keys are `/api/` and `/media/` so a client path like `/apiary` stays with the SPA (checked: `/apiary` serves `index.html`, `/api/health` still proxied). Root route has `HydrateFallback: () => null` (removes the React Router warning on `/`; it still logs once in the unknown-path test, where no route matches). `console.error` spy restored after each test. `test-output` added to `.gitignore`. Spine AD-2 lists `recipe-domain` for the app; capability map rows name their feature libs; memlog records Adi's confirmation of 1a/2a. Full `lint test build typecheck` re-run green (16/16).

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route | Evidence |
|---|--------|---------|---------|-------|----------|
| 1 | verification-gap, blind | Boundary rules have no automated regression test (probes were throwaway) | medium | defer | Real: deleting a constraint keeps lint green. Approved spec chose manual probes; an ESLint-API lint fixture belongs with Story 1.3's lint suite. Also re-check the `@tanstack/*`/`@hey-api/*` bans once 1.6 installs them. |
| 2 | verification-gap, edge | Dev proxy, `dev` script and `main.tsx` bootstrap verified only by hand; deleted `app.spec` covered the provider tree | low | defer | No e2e harness yet; Story 6.3 (Playwright) / 1.4 shell own boot-path coverage. Manually verified twice. |
| 3 | verification-gap, blind, edge | `recipe-domain` 100% coverage not enforced | medium | patch | No thresholds existed; now enabled with `thresholds: {100: true}`, proven to fail at 50%. |
| 4 | blind | memlog says "Adi can correct" while spec says Adi decided 1a/2a | low | patch | Adi later confirmed both in the thread; memlog updated. |
| 5 | blind, edge | `react` `^19.0.0` below react-router's peer `>=19.2.7` | medium | patch | Lockfile-less install could resolve an incompatible React; floors raised. |
| 6 | blind, edge | No Node engine declared (react-router needs >=22.22) | low | patch | `engines` added; CI already Node 24. |
| 7 | blind | Spec `in-review` vs sprint `in-progress` | false | reject | Workflow syncs sprint status to `review` at the present step; done. |
| 8 | blind | AD-2 omits app → domain allowed by the matrix | low | patch | Spine AD-2 updated. |
| 9 | blind | Capability map rows still say "web routes" | low | patch | F2–F5, F8, F9, F10 rows now name feature libs. |
| 10 | blind, edge | "No IO" for domain not enforced | low | patch | `types: []` makes Node built-ins fail typecheck (probed with `node:fs`). Network packages are not installed. |
| 11 | blind, edge | `console.error` spy never restored | low | patch | `afterEach(vi.restoreAllMocks)` added. |
| 12 | blind | `toBeTruthy()` on `findByRole` is weak; no code-split test | low | reject | `findByRole` throws when absent, so the test does fail; jest-dom not installed. Split verified in build output; size-limit (1.3) guards bundles. |
| 13 | blind | `recipe-domain` README names wrong consumers; no subpath-export example | low | patch | README fixed. Subpath example: false, AD-11 and the Story 1.8 AC specify it. |
| 14 | blind | Code map said no `nx.json` change; non-buildable libs keep `outDir`/`emitDeclarationOnly`; typecheck not in AC | false | reject | `nx.json` change recorded in notes (fix would edit spec). `outDir`/declaration emit is what the inferred `typecheck` (`tsc --build`) uses in the TS-solution setup. Running typecheck too is not a defect. |
| 15 | blind | `RouteError` lacks a home link; English copy not marked temporary | low | reject | Story 1.4 AC owns "הדף לא נמצא" + "חזרה לרשימה" and he.json strings. |
| 16 | edge | No `HydrateFallback` on initial lazy load | low | patch | Warning reproduced in tests; `HydrateFallback: () => null` added. |
| 17 | edge | Stale lazy chunk after redeploy shows generic error without reload | low | reject | Unlikely in a personal app; fix adds a branch. Production story can revisit. |
| 18 | edge | Non-404 statuses show the generic message | false | reject | No route throws other statuses yet. |
| 19 | edge | Proxy prefix `/api` also matches `/apiary` | low | patch | Keys changed to `/api/`, `/media/`; verified. |
| 20 | edge | Vitest includes `tests/**` but tsconfig.spec covers only `src` | low | patch | `recipe-domain` include narrowed to `src/**`; React libs already `src` only. |
| 21 | edge | `test-output` coverage dirs not gitignored | low | patch | `git check-ignore` confirmed; added. |
| 22 | edge | `apps/web/src` also has `styles.css` and `assets/` | low | reject | Wording only; global stylesheet belongs to the shell. |

## Verification

**Commands:**
- `npx nx run-many -t lint test build` -- expected: all green
- `npx nx show project <lib> --json` -- expected: tags as specified

**Manual checks (if no CLI):**
- `npm run dev`, open `http://localhost:4200/` and `http://localhost:4200/api/health` -- placeholder home and `{"status":"ok"}`.
