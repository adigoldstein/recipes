---
title: 'Story 1.3: CI and quality gates'
type: 'chore'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'f21efb75fcec4e39f2b5db977ad488e96f7758ec'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** CI is the Nx Cloud template (`start-ci-run`, `fix-ci`, `run-many`, no Python), the backend has no type checking or layer enforcement, and the web ESLint config enforces none of the RTL/token/a11y/compiler rules from AD-33, so rules hold only on the honour system.

**Approach:** One plain GitHub Actions workflow (Node + setup-uv + nx-set-shas → `nx affected -t lint typecheck test build`); `recipe-service` gains a mypy-strict `typecheck` target and import-linter contracts in `lint`; the shared ESLint config gains the styling bans, jsx-a11y and react-hooks ≥7; the React Compiler runs through Babel in Vite; fixture tests prove every rule (including the 1.2 boundary rules) actually fails a bad line.

## Boundaries & Constraints

**Always:**

- CI: `astral-sh/setup-uv`, `actions/setup-node` (Node 24, npm cache), `nrwl/nx-set-shas`, `npm ci`, `uv sync --locked`, `nx format:check`, `nx affected -t lint typecheck test build`. No Nx Cloud.
- mypy `strict = true` + `pydantic.mypy` plugin over `app` and `tests`.
- import-linter (AD-1, AD-25): per module, layers `router → service → repository → models`; a module imports another module's `service` only; `tags` never imports `recipes`; cross-module graph limited to `recipes → tags, photos`, `imports → tags`; `app.core` imports no feature module except `app.core.metadata` (models).
- `recipe-service:lint` = ruff check + `ruff format --check` + `lint-imports`.
- ESLint bans (in className strings, `cn()`/`clsx()`/`cva()` args): `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` (incl. variants and negatives, e.g. `md:-ml-2`), any arbitrary value `[...]`; hex/`rgb(a)`/`hsl(a)` literals in TS/TSX; `style` prop in `libs/ui-components`. Errors, not warnings.
- `eslint-plugin-react-hooks` ≥ 7 recommended (compiler rules) and jsx-a11y recommended as errors.
- React Compiler: `@vitejs/plugin-react` 6 `reactCompilerPreset` via `@rolldown/plugin-babel` + `babel-plugin-react-compiler`, in `apps/web` and in lib Vite/Vitest configs that render React.
- Exact pinned versions for new packages.

**Never:**

- No e2e, OpenAPI drift check (1.7) or size-limit (6.4) in CI yet.
- No Tailwind/shadcn install (1.4); rules must work without it.
- No hand-written `useMemo`/`useCallback`.

## I/O & Edge-Case Matrix

| Scenario         | Input                                                                  | Expected                     |
| ---------------- | ---------------------------------------------------------------------- | ---------------------------- |
| Physical utility | `className="ml-2"` in web                                              | lint fails                   |
| Logical utility  | `className="ms-2 text-start"`                                          | passes                       |
| Arbitrary value  | `cn('p-[13px]')`                                                       | fails                        |
| Colour literal   | `const c = '#ff0000'`                                                  | fails                        |
| style in ui      | `<div style={{}} />` in ui-components                                  | fails; allowed in web        |
| Boundary         | ui → data-access, ui → react-router, domain → react, feature → feature | each fails                   |
| Layer skip       | `recipes/router.py` imports `recipes.repository`                       | `lint-imports` fails         |
| Cross-module     | `recipes/service.py` imports `tags.repository`                         | fails; `tags.service` passes |
| Untyped def      | `def f(x): ...` in app                                                 | `typecheck` fails            |

## Decisions (Adi, 2026-10-26)

1. Tailwind bans (physical-direction utilities, arbitrary values) use `eslint-plugin-better-tailwindcss` `no-restricted-classes` (1a).
2. Lint fixture tests live in a new Nx project `tools/lint-checks` (tag `type:tooling`): Vitest + ESLint Node API for web rules, `lint-imports` on fixtures for Python contracts (2a).

</frozen-after-approval>

## Code Map

- `.github/workflows/ci.yml` -- Nx Cloud template; rewrite.
- `eslint.config.mjs` -- root flat config with boundary matrix (keep as is); add colour-literal ban and Tailwind bans for all TS/TSX.
- `libs/ui-components/eslint.config.mjs` -- add `react/forbid-dom-props` + `react/forbid-component-props` for `style`.
- `node_modules/@nx/eslint-plugin/dist/src/flat-configs/react-jsx.js` -- `flat/react` already registers `react-hooks` (recommended rules) and `jsx-a11y` (as `warn`); upgrading the package to 7.x swaps in compiler rules; override a11y rules to `error` in root config.
- `package.json` -- `eslint-plugin-react-hooks` 5.0.0 → 7.1.1; add `babel-plugin-react-compiler` 1.0.0, `@rolldown/plugin-babel`, `@babel/core`.
- `apps/web/vite.config.mts`, `libs/ui-components/vite.config.mts`, `libs/data-access/vite.config.mts` -- add Babel compiler plugin after `react()`.
- `apps/recipe-service/project.json` -- `lint` (ruff-check executor) → run-commands with ruff check, ruff format --check, lint-imports; add `typecheck` (`uv run mypy app tests`, cached).
- `apps/recipe-service/pyproject.toml` -- dev deps `mypy`, `import-linter`; `[tool.mypy]`, `[tool.importlinter]`. `uv.lock` regenerated.
- `apps/recipe-service/app/core/metadata.py` -- only core → feature import allowed (models).
- `apps/recipe-service/tests/test_structure.py` -- existing layout tests; leave.
- `nx.json` -- `@nx/vitest` plugin infers `test` for new tools project.

## Tasks & Acceptance

**Execution:**

- [x] `apps/recipe-service/pyproject.toml`, `uv.lock`, `project.json` -- mypy + import-linter config/targets; fix any strict errors in `app`/`tests`.
- [x] `package.json`, `package-lock.json` -- npm installs above.
- [x] `eslint.config.mjs`, `libs/ui-components/eslint.config.mjs` -- rules per Boundaries; fix existing violations.
- [x] `apps/web/vite.config.mts` + React lib Vite configs -- compiler.
- [x] `tools/lint-checks` -- fixture tests -- every I/O row asserted, plus a passing control per rule.
- [x] `.github/workflows/ci.yml` -- rewrite.
- [x] `deferred-work.md` -- mark boundary-test item resolved by this story (note only).

**Acceptance Criteria:**

- Given the repo, when `npx nx run-many -t lint typecheck test build` runs, then all projects pass.
- Given `className="ml-2"` added to `apps/web`, when `nx lint web` runs, then it fails; reverting makes it pass.
- Given `nx build web`, then the output contains React Compiler cache calls (`react/compiler-runtime` / `_c(`).
- Given `ci.yml`, then it contains no `nx-cloud`/`start-ci-run`/`fix-ci` and uses `nx affected`.

## Implementation Notes

- Implemented directly (no implementation subagent), as in Stories 1.1 and 1.2.
- **Python:** `mypy==2.4.0` and `import-linter==2.15` are pinned dev deps. `[tool.mypy]` sets `strict`, the `pydantic.mypy` plugin and `files = ["app", "tests"]`, so `typecheck` is plain `uv run mypy`. Strict mode found 5 errors, all fixed: an unused `type: ignore` in `load_settings` (the pydantic plugin types `Settings()`); `get_session` now returns `Generator[Session]` so tests can `close()` it; and the tests narrow `get_bind()` to `Engine`. `lint` is `@nxlv/python:run-commands` running ruff check, `ruff format --check` and `lint-imports`, with `PYTHONUTF8=1` because import-linter's `rich` output crashes on the Windows cp1252 console.
- **import-linter, 13 contracts:**
  - per-module layers (`exhaustive = false`, so `schemas` and `__init__` are free);
  - an extra forbidden contract "Routers never reach the repository or models", because layers contracts allow skipping a layer downward (a fixture caught this);
  - six `protected` contracts, so each module's router, repository, models and schemas are importable only from inside the module. `app.main` may import routers and `app.core.metadata` may import models;
  - the AD-25 graph as forbidden edges among recipes, tags, photos and imports. `auth`/`users` edges are left open, since routers will depend on auth guards;
  - `app.core` depends on no feature module except metadata → models.
- **ESLint:** better-tailwindcss `no-restricted-classes` uses regex restrictions with optional variants, `!` and negatives. Besides the AC list it also bans the RTL siblings `border-l/r`, `rounded-l/r/tl/tr/bl/br`, `scroll-m/p l/r` and `float/clear-left/right`. Any `[` in a class counts as an arbitrary value (this includes arbitrary variants). Colour literals are caught with `no-restricted-syntax` on `Literal`/`TemplateElement` (hex 3/4/6/8 digits, and `rgb/hsl/hwb/lab/lch/oklab/oklch(`). `#main` and `&#123;` are not flagged; a plain string like `"x #abc"` would be. The plugin requires the `tailwindcss` peer, so npm installed `tailwindcss@4.3.3` transitively; it is not in `package.json` and nothing is configured until 1.4.
- **jsx-a11y and react-hooks:** both are registered in the root config with the same module objects Nx's `flat/react` uses. Spreading `jsxA11y.flatConfigs.recommended` fails with "Cannot redefine plugin", because it carries a copy. Their rules apply at `error` everywhere (react-hooks `recommended-latest`, including the compiler rules).
- **Style prop:** banned through `react/forbid-dom-props` and `react/forbid-component-props` in `libs/ui-components/eslint.config.mjs` only.
- **React Compiler:** `@rolldown/plugin-babel@0.2.4` + `reactCompilerPreset()` from `@vitejs/plugin-react` 6, with `babel-plugin-react-compiler@1.0.0` and `@babel/core@8.0.9`. Wired into `apps/web` and the `ui-components`/`data-access` Vite configs (tests). The build output contains `react.memo_cache_sentinel` in both the index and the lazy home chunks.
- **`tools/lint-checks`:** generated with `@nx/js:library --minimal` (test-only; `src/index.ts` is an empty entry). The generator added `tools/*` to the npm workspaces and a root tsconfig reference. The tag is `type:tooling` (new depConstraint: depends on nothing). There are 42 tests:
  - `eslint-rules.spec.ts` uses the ESLint Node API with each project's real config. ESLint 9 resolves the config from `cwd`, so the engine is created per project dir;
  - `python-contracts.spec.ts` copies `app/` to a temp dir, injects a violation, and runs `uv run --project … lint-imports` and `mypy` there.
  - `implicitDependencies` on all five projects plus `inputs: [default, ^default, root eslint config]` keep it in `affected` and invalidate its cache when any rule changes. `dependsOn: []` skips the default `^build` (no Python wheel build needed). Its own eslint config turns off the two style rules for its specs, which hold forbidden strings as fixtures.
  - Feature → feature is asserted on the resolved config (no feature lib to lint yet).
- **CI:** checkout@v7, setup-node@v7 (Node 24), setup-uv@v10 (cache keyed on `uv.lock`), `npm ci`, `uv sync --locked`, nx-set-shas@v5, `nx format:check`, `nx affected -t lint typecheck test build`. Nx Cloud steps are gone. Prettier reformatted `apps/recipe-service/project.json` (arrays inlined) and the new files.
- **Local verification:**
  - `npx nx run-many -t lint typecheck test build --skip-nx-cache`: 6 projects green (web 3 tests, lint-checks 42, recipe-service 34, 13 contracts, mypy 50 files);
  - `nx affected … --base=f21efb7…` exits 0 and lists all 6 projects;
  - `nx format:check` is clean and `uv sync --locked` passes;
  - adding `className="ml-2"` to `placeholder-home.tsx` makes `nx lint web` fail, and reverting it passes.
  - A real GitHub run happens only after Adi pushes.
- **Review patches:**
  - The router forbidden contract now has `allow_indirect_imports = true`.
  - The arbitrary-value regex checks only the utility part, and the physical keyword pattern accepts a trailing `!`.
  - Hex literals: the 3/4-digit form is flagged only as a whole string.
  - lint-checks: timeouts set to 60 s, cache inputs list the plugins, and `spawnSync` errors are rethrown.
  - A new `react-compiler.spec.ts` transforms the home route through the web Vite config. Removing the Babel plugin makes it fail.
  - Added fixture cases for every contract, the `clsx`/`cva` callers, the passing controls and the `!` modifier.
  - CI: `timeout-minutes: 20`, plus PR-only `cancel-in-progress`.
  - Three new deferred entries.
  - Full re-run: `run-many -t lint typecheck test build` green (lint-checks 60 tests), and `format:check` is clean.

## Review Triage Log

| #   | Source      | Finding                                                                                     | Verdict | Route  | Evidence                                                                                                                                                              |
| --- | ----------- | ------------------------------------------------------------------------------------------- | ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | blind, edge | Router forbidden contract also bans the indirect router → service → repository/models chain | high    | patch  | Reproduced: chain fixture broke the contract. `allow_indirect_imports = true` added; fixture now asserts the full chain passes.                                       |
| 2   | blind       | `\[` ban also blocks arbitrary variants (`data-[state=open]:`, `[&_svg]:`) that shadcn uses | medium  | patch  | Variants only select; regex now matches brackets in the utility part only. Control asserts variants pass.                                                             |
| 3   | edge        | `text-left!` (Tailwind v4 trailing important) escapes the keyword ban                       | low     | patch  | `$` anchor; now `!?$`, fixtures for `ml-2!`, `text-right!`.                                                                                                           |
| 4   | blind, edge | Hex regex flags `Recipe #123`, `#add`-style strings                                         | low     | patch  | 3/4-digit hex now only when the whole string is the colour; `Recipe #123` control added. `'#add'` as a whole string is still flagged (accepted).                      |
| 5   | blind, edge | Spawning specs can exceed Vitest's 5 s default on CI                                        | medium  | patch  | mypy alone ~1.2 s warm locally, cold on CI; `testTimeout`/`hookTimeout` 60 s.                                                                                         |
| 6   | blind, edge | `externalDependencies: [eslint]` ignores plugin bumps in the cache hash                     | low     | patch  | Listed the ESLint plugins and the Vite/compiler packages.                                                                                                             |
| 7   | blind       | `tailwindcss` is an undeclared transitive peer                                              | low     | defer  | npm installs peers and the lockfile pins 4.3.3, so `npm ci` is reproducible; explicit declaration belongs to 1.4's Tailwind install.                                  |
| 8   | blind       | deferred-work marks an item resolved while the `@tanstack`/`@hey-api` re-check stays open   | low     | patch  | New open deferred entry for the re-check (also `react-router-*`).                                                                                                     |
| 9   | blind       | Spec `in-review` vs sprint `in-progress`                                                    | false   | reject | Workflow syncs sprint status to `review` at the present step.                                                                                                         |
| 10  | blind, vgap | Layers contract, photos/recipes/imports contracts lack fixtures                             | medium  | patch  | Upward-import fixtures (3) and an `it.each` over all five graph edges added.                                                                                          |
| 11  | blind       | Passing controls do not prove the temp copy is analysed                                     | false   | reject | The violation fixtures only fail if the copy is analysed; they do.                                                                                                    |
| 12  | blind, edge | No clsx/cva, a11y/hooks/boundary/mypy passing controls                                      | low     | patch  | Added clsx and cva-variants fixtures, an a11y/hooks clean control, two allowed imports, a typed mypy control.                                                         |
| 13  | blind       | No `react-router-dom` boundary fixture                                                      | low     | defer  | Not installed; Nx checks bans only against graph nodes. Folded into #8's deferred entry.                                                                              |
| 14  | blind       | `.mts/.mjs/.cts` files skip the style bans                                                  | low     | reject | Only Vite/ESLint config files use those extensions; no class or colour strings live there, and widening globs adds churn.                                             |
| 15  | blind, vgap | React Compiler wiring has no automated check                                                | medium  | patch  | `react-compiler.spec.ts` transforms `placeholder-home.tsx` through the web Vite config and asserts the memo sentinel; mutation check (Babel plugin removed) fails it. |
| 16  | blind       | CI lacks concurrency and timeout; permissions unclear                                       | low     | patch  | `permissions` already present; added `timeout-minutes: 20` and PR-only `cancel-in-progress`.                                                                          |
| 17  | blind       | Overriding `no-restricted-syntax` silently drops the colour ban                             | low     | patch  | Comment added at the rule; the lint-checks override is deliberate (fixture strings).                                                                                  |
| 18  | edge        | Missing uv makes "exits non-zero" assertions pass vacuously                                 | low     | patch  | `spawnSync` error is now rethrown.                                                                                                                                    |
| 19  | edge        | Protected contracts miss other submodules / `__init__` re-exports                           | low     | reject | No such modules exist (`test_structure` pins the five layer files); covering them adds wildcard contracts for a hypothetical.                                         |
| 20  | edge        | auth/users edges not constrained                                                            | low     | reject | Deliberate: spine's graph names only the catalogue modules and routers will import auth guards; recorded in Implementation Notes. Fix would edit the spec.            |
| 21  | vgap        | Arbitrary values in generated shadcn components will fail the ban                           | medium  | defer  | Surfaced while triaging #2; Adi decides token replacement vs scoped exception before 1.4/1.5.                                                                         |

## Verification

**Commands:**

- `npx nx run-many -t lint typecheck test build --skip-nx-cache` -- all green
- `npx nx show project recipe-service --json` -- `typecheck` and new `lint` present

**Manual checks:**

- Real CI run on GitHub after Adi pushes (green), plus one throwaway-branch push with `ml-2` (red) if Adi wants live proof.
