# Review: Story 1.3 — CI and quality gates

**Status:** ready for Adi's review. Nothing is committed (baseline `f21efb75fcec4e39f2b5db977ad488e96f7758ec`).
**Spec:** [spec-1-3-ci-and-quality-gates.md](spec-1-3-ci-and-quality-gates.md) · **Deferred:** [deferred-work.md](deferred-work.md)

## Verification

- `npx nx run-many -t lint typecheck test build --skip-nx-cache` → 6 projects green: web 3 tests, recipe-service 34 tests + mypy strict (50 files) + 13 import-linter contracts, lint-checks 60 fixture tests.
- `npx nx affected -t lint typecheck test build --base=f21efb7…` (the CI command) → exit 0, all 6 projects affected. `nx format:check` clean, `uv sync --locked` OK.
- Broken line: `className="ml-2"` in `placeholder-home.tsx` → `nx lint web` fails; reverting passes.
- Mutation check: removing the Babel compiler plugin from `apps/web/vite.config.mts` fails `react-compiler.spec.ts`.
- 3 parallel reviews (blind, edge-case, verification-gap): 21 findings → 14 patched, 3 deferred, 4 rejected (see the spec's Review Triage Log). The biggest catch: the router contract would have failed the normal router → service → repository chain.
- Not verified yet: a real GitHub Actions run (happens on push).

## Acceptance criteria

| AC                                                                                                     | Result                                                                                 |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| One workflow: Node + setup-uv + nx-set-shas + `nx affected -t lint typecheck test build`               | ✅ `.github/workflows/ci.yml`                                                          |
| Nx Cloud `start-ci-run` / `fix-ci` removed                                                             | ✅                                                                                     |
| `recipe-service:typecheck` = mypy strict + pydantic plugin; `lint` = ruff + import-linter (AD-1/AD-25) | ✅ `project.json`, `pyproject.toml`, `python-contracts.spec.ts`                        |
| ESLint bans physical utilities, arbitrary values, hex/rgb literals, `style` in ui-components           | ✅ `eslint.config.mjs`, `libs/ui-components/eslint.config.mjs`, `eslint-rules.spec.ts` |
| jsx-a11y + react-hooks 7 (compiler rules)                                                              | ✅ errors, fixture-tested                                                              |
| Broken line fails, revert passes                                                                       | ✅ locally + fixtures                                                                  |
| React Compiler via `babel-plugin-react-compiler` in Vite                                               | ✅ `@rolldown/plugin-babel` + `reactCompilerPreset`, `react-compiler.spec.ts`          |

## For Adi to decide (deferred)

- shadcn components ship arbitrary values (`size-[1.15rem]`, `rounded-[4px]`): replace with tokens or allow a scoped exception, before 1.4/1.5.
- Declare `tailwindcss` explicitly in 1.4 (it is only a transitive peer now).

## Changed files

     .github/workflows/ci.yml                                               |   37 +-
     _bmad-output/implementation-artifacts/deferred-work.md                 |   10 +
     _bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md |  166 ++
     _bmad-output/implementation-artifacts/sprint-status.yaml               |    4 +-
     apps/recipe-service/app/core/config.py                                 |    2 +-
     apps/recipe-service/app/core/db.py                                     |    4 +-
     apps/recipe-service/project.json                                       |   34 +-
     apps/recipe-service/pyproject.toml                                     |  168 ++
     apps/recipe-service/tests/test_structure.py                            |    9 +-
     apps/recipe-service/uv.lock                                            |  184 ++
     apps/web/vite.config.mts                                               |    9 +-
     eslint.config.mjs                                                      |   82 +
     libs/data-access/vite.config.mts                                       |    6 +-
     libs/ui-components/eslint.config.mjs                                   |    7 +-
     libs/ui-components/vite.config.mts                                     |    6 +-
     package-lock.json                                                      | 5100 ++++++++++++++++++++++++----------------
     package.json                                                           |    9 +-
     tools/lint-checks/eslint.config.mjs                                    |   16 +
     tools/lint-checks/package.json                                         |   53 +
     tools/lint-checks/src/eslint-rules.spec.ts                             |  215 ++
     tools/lint-checks/src/index.ts                                         |    2 +
     tools/lint-checks/src/python-contracts.spec.ts                         |  141 ++
     tools/lint-checks/src/react-compiler.spec.ts                           |   25 +
     tools/lint-checks/tsconfig.json                                        |   13 +
     tools/lint-checks/tsconfig.lib.json                                    |   27 +
     tools/lint-checks/tsconfig.spec.json                                   |   34 +
     tools/lint-checks/vitest.config.mts                                    |   21 +
     tsconfig.json                                                          |    3 +
     28 files changed, 4265 insertions(+), 2122 deletions(-)

## Diff

Lockfiles (`package-lock.json`, `apps/recipe-service/uv.lock`) omitted.

diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 7ab067d..251557c 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -10,31 +10,40 @@ permissions:
actions: read
contents: read

+# A newer push to a PR supersedes its running check; main runs always finish.
+concurrency:

- group: ci-${{ github.ref }}
- cancel-in-progress: ${{ github.event_name == 'pull_request' }}
-

jobs:
main:
runs-on: ubuntu-latest

- timeout-minutes: 20
  steps:

*      - uses: actions/checkout@v5

-      - uses: actions/checkout@v7
         with:
           filter: tree:0
           fetch-depth: 0

*      # This enables task distribution via Nx Cloud
*      # Run this command as early as possible, before dependencies are installed
*      # Learn more at https://nx.dev/docs/reference/nx-cloud-cli#npx-nxcloud-startcirun
*      - run: npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e"
*
*      # Cache node_modules
*      - uses: actions/setup-node@v5

-      - uses: actions/setup-node@v7
         with:
           node-version: 24
           cache: 'npm'

-      # Installs the Python from apps/recipe-service/.python-version on first `uv sync`.
-      - uses: astral-sh/setup-uv@v10
-        with:
-          enable-cache: true
-          cache-dependency-glob: apps/recipe-service/uv.lock
-      - run: npm ci

*      # Prepend any command with "nx record --" to record its logs to Nx Cloud
*      - run: npx nx record -- npx nx format:check --base="remotes/origin/main"
*      - run: npx nx run-many -t lint test build typecheck e2e
*      # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/docs/features/ci-features/self-healing-ci
*      - run: npx nx fix-ci
*        if: always()

-      # --locked fails the run if uv.lock no longer matches pyproject.toml.
-      - run: uv sync --locked
-        working-directory: apps/recipe-service
-
-      # Base = last green CI run on main, so `affected` checks everything since then.
-      - uses: nrwl/nx-set-shas@v5
-
-      - run: npx nx format:check
-      - run: npx nx affected -t lint typecheck test build

diff --git a/_bmad-output/implementation-artifacts/deferred-work.md b/_bmad-output/implementation-artifacts/deferred-work.md
index 7bfffe1..81f48cb 100644
--- a/_bmad-output/implementation-artifacts/deferred-work.md
+++ b/_bmad-output/implementation-artifacts/deferred-work.md
@@ -16,6 +16,16 @@

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md`
  summary: Add an automated lint fixture test (ESLint Node API) proving each Nx boundary rule fails a forbidden import (ui → data-access, ui → react-router, domain → react, feature → feature), and re-check the `@tanstack/*`/`@hey-api/*` bans once Story 1.7 installs them.
  evidence: Rules were verified with throwaway probes only; removing a constraint keeps `nx lint` green because no file violates it yet. Natural home Story 1.3.

* resolved: Story 1.3 — `tools/lint-checks/src/eslint-rules.spec.ts` lints fixtures for ui → data-access, ui → react-router and domain → react; feature → feature is asserted on the resolved config until a feature lib exists. The `@tanstack/*`/`@hey-api/*` bans still need a re-check when 1.7 installs them.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md`
  summary: Cover the real app boot (`main.tsx` + `react-router/dom`) and the Vite `/api`, `/media` proxy with an automated check.
  evidence: Only manual runs today; no e2e harness until Story 6.3 (Playwright), app-shell tests from 1.4.
  +- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md`

* summary: Re-check the `@tanstack/*`, `@hey-api/*` and `react-router-*` boundary bans with lint fixtures once those packages are installed.
* evidence: Nx only enforces `bannedExternalImports` for packages in the project graph; none of them is installed yet, so the fixtures cannot exercise them (Story 1.7 installs TanStack Query and hey-api).
  +- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md`
* summary: Declare `tailwindcss` explicitly (pinned) in `package.json` when Story 1.4 installs Tailwind.
* evidence: It is present today only as an auto-installed peer of `eslint-plugin-better-tailwindcss` (4.3.3 in the lockfile); lint resolves it through hoisting.
  +- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md`
* summary: Decide how shadcn primitives that ship arbitrary values (e.g. `size-[1.15rem]`, `rounded-[4px]`, `max-h-(--radix-…)`) meet the arbitrary-value ban.
* evidence: Arbitrary variants (`data-[state=open]:`) are allowed, but arbitrary values in generated shadcn components will fail lint in Stories 1.4/1.5; options are token replacements or a scoped exception, which is Adi's call.
  diff --git a/_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md b/_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md
  new file mode 100644
  index 0000000..8b64f89
  --- /dev/null
  +++ b/_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md
  @@ -0,0 +1,166 @@
  +---
  +title: 'Story 1.3: CI and quality gates'
  +type: 'chore'
  +created: '2026-10-26'
  +status: 'done'
  +route: 'dispatch'
  +review_loop_iteration: 0
  +baseline_commit: 'f21efb75fcec4e39f2b5db977ad488e96f7758ec'
  +context:
* - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
    +---
*

+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates"> +
+## Intent + +**Problem:** CI is the Nx Cloud template (`start-ci-run`, `fix-ci`, `run-many`, no Python), the backend has no type checking or layer enforcement, and the web ESLint config enforces none of the RTL/token/a11y/compiler rules from AD-33, so rules hold only on the honour system. + +**Approach:** One plain GitHub Actions workflow (Node + setup-uv + nx-set-shas → `nx affected -t lint typecheck test build`); `recipe-service` gains a mypy-strict `typecheck` target and import-linter contracts in `lint`; the shared ESLint config gains the styling bans, jsx-a11y and react-hooks ≥7; the React Compiler runs through Babel in Vite; fixture tests prove every rule (including the 1.2 boundary rules) actually fails a bad line. +
+## Boundaries & Constraints + +**Always:** +
+- CI: `astral-sh/setup-uv`, `actions/setup-node` (Node 24, npm cache), `nrwl/nx-set-shas`, `npm ci`, `uv sync --locked`, `nx format:check`, `nx affected -t lint typecheck test build`. No Nx Cloud.
+- mypy `strict = true` + `pydantic.mypy` plugin over `app` and `tests`.
+- import-linter (AD-1, AD-25): per module, layers `router → service → repository → models`; a module imports another module's `service` only; `tags` never imports `recipes`; cross-module graph limited to `recipes → tags, photos`, `imports → tags`; `app.core` imports no feature module except `app.core.metadata` (models).
+- `recipe-service:lint` = ruff check + `ruff format --check` + `lint-imports`.
+- ESLint bans (in className strings, `cn()`/`clsx()`/`cva()` args): `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` (incl. variants and negatives, e.g. `md:-ml-2`), any arbitrary value `[...]`; hex/`rgb(a)`/`hsl(a)` literals in TS/TSX; `style` prop in `libs/ui-components`. Errors, not warnings.
+- `eslint-plugin-react-hooks` ≥ 7 recommended (compiler rules) and jsx-a11y recommended as errors.
+- React Compiler: `@vitejs/plugin-react` 6 `reactCompilerPreset` via `@rolldown/plugin-babel` + `babel-plugin-react-compiler`, in `apps/web` and in lib Vite/Vitest configs that render React.
+- Exact pinned versions for new packages. + +**Never:** +
+- No e2e, OpenAPI drift check (1.7) or size-limit (6.4) in CI yet.
+- No Tailwind/shadcn install (1.4); rules must work without it.
+- No hand-written `useMemo`/`useCallback`. +
+## I/O & Edge-Case Matrix +
+| Scenario | Input | Expected |
+| ---------------- | ---------------------------------------------------------------------- | ---------------------------- |
+| Physical utility | `className="ml-2"` in web | lint fails |
+| Logical utility | `className="ms-2 text-start"` | passes |
+| Arbitrary value | `cn('p-[13px]')` | fails |
+| Colour literal | `const c = '#ff0000'` | fails |
+| style in ui | `<div style={{}} />` in ui-components | fails; allowed in web |
+| Boundary | ui → data-access, ui → react-router, domain → react, feature → feature | each fails |
+| Layer skip | `recipes/router.py` imports `recipes.repository` | `lint-imports` fails |
+| Cross-module | `recipes/service.py` imports `tags.repository` | fails; `tags.service` passes |
+| Untyped def | `def f(x): ...` in app | `typecheck` fails | +
+## Decisions (Adi, 2026-10-26) +
+1. Tailwind bans (physical-direction utilities, arbitrary values) use `eslint-plugin-better-tailwindcss` `no-restricted-classes` (1a).
+2. Lint fixture tests live in a new Nx project `tools/lint-checks` (tag `type:tooling`): Vitest + ESLint Node API for web rules, `lint-imports` on fixtures for Python contracts (2a). + +</frozen-after-approval> +
+## Code Map +
+- `.github/workflows/ci.yml` -- Nx Cloud template; rewrite.
+- `eslint.config.mjs` -- root flat config with boundary matrix (keep as is); add colour-literal ban and Tailwind bans for all TS/TSX.
+- `libs/ui-components/eslint.config.mjs` -- add `react/forbid-dom-props` + `react/forbid-component-props` for `style`.
+- `node_modules/@nx/eslint-plugin/dist/src/flat-configs/react-jsx.js` -- `flat/react` already registers `react-hooks` (recommended rules) and `jsx-a11y` (as `warn`); upgrading the package to 7.x swaps in compiler rules; override a11y rules to `error` in root config.
+- `package.json` -- `eslint-plugin-react-hooks` 5.0.0 → 7.1.1; add `babel-plugin-react-compiler` 1.0.0, `@rolldown/plugin-babel`, `@babel/core`.
+- `apps/web/vite.config.mts`, `libs/ui-components/vite.config.mts`, `libs/data-access/vite.config.mts` -- add Babel compiler plugin after `react()`.
+- `apps/recipe-service/project.json` -- `lint` (ruff-check executor) → run-commands with ruff check, ruff format --check, lint-imports; add `typecheck` (`uv run mypy app tests`, cached).
+- `apps/recipe-service/pyproject.toml` -- dev deps `mypy`, `import-linter`; `[tool.mypy]`, `[tool.importlinter]`. `uv.lock` regenerated.
+- `apps/recipe-service/app/core/metadata.py` -- only core → feature import allowed (models).
+- `apps/recipe-service/tests/test_structure.py` -- existing layout tests; leave.
+- `nx.json` -- `@nx/vitest` plugin infers `test` for new tools project. +
+## Tasks & Acceptance + +**Execution:** +
+- [x] `apps/recipe-service/pyproject.toml`, `uv.lock`, `project.json` -- mypy + import-linter config/targets; fix any strict errors in `app`/`tests`.
+- [x] `package.json`, `package-lock.json` -- npm installs above.
+- [x] `eslint.config.mjs`, `libs/ui-components/eslint.config.mjs` -- rules per Boundaries; fix existing violations.
+- [x] `apps/web/vite.config.mts` + React lib Vite configs -- compiler.
+- [x] `tools/lint-checks` -- fixture tests -- every I/O row asserted, plus a passing control per rule.
+- [x] `.github/workflows/ci.yml` -- rewrite.
+- [x] `deferred-work.md` -- mark boundary-test item resolved by this story (note only). + +**Acceptance Criteria:** +
+- Given the repo, when `npx nx run-many -t lint typecheck test build` runs, then all projects pass.
+- Given `className="ml-2"` added to `apps/web`, when `nx lint web` runs, then it fails; reverting makes it pass.
+- Given `nx build web`, then the output contains React Compiler cache calls (`react/compiler-runtime` / `_c(`).
+- Given `ci.yml`, then it contains no `nx-cloud`/`start-ci-run`/`fix-ci` and uses `nx affected`. +
+## Implementation Notes +
+- Implemented directly (no implementation subagent), as in Stories 1.1 and 1.2.
+- **Python:** `mypy==2.4.0` and `import-linter==2.15` are pinned dev deps. `[tool.mypy]` sets `strict`, the `pydantic.mypy` plugin and `files = ["app", "tests"]`, so `typecheck` is plain `uv run mypy`. Strict mode found 5 errors, all fixed: an unused `type: ignore` in `load_settings` (the pydantic plugin types `Settings()`); `get_session` now returns `Generator[Session]` so tests can `close()` it; and the tests narrow `get_bind()` to `Engine`. `lint` is `@nxlv/python:run-commands` running ruff check, `ruff format --check` and `lint-imports`, with `PYTHONUTF8=1` because import-linter's `rich` output crashes on the Windows cp1252 console.
+- **import-linter, 13 contracts:**

- - per-module layers (`exhaustive = false`, so `schemas` and `__init__` are free);
- - an extra forbidden contract "Routers never reach the repository or models", because layers contracts allow skipping a layer downward (a fixture caught this);
- - six `protected` contracts, so each module's router, repository, models and schemas are importable only from inside the module. `app.main` may import routers and `app.core.metadata` may import models;
- - the AD-25 graph as forbidden edges among recipes, tags, photos and imports. `auth`/`users` edges are left open, since routers will depend on auth guards;
- - `app.core` depends on no feature module except metadata → models.
    +- **ESLint:** better-tailwindcss `no-restricted-classes` uses regex restrictions with optional variants, `!` and negatives. Besides the AC list it also bans the RTL siblings `border-l/r`, `rounded-l/r/tl/tr/bl/br`, `scroll-m/p l/r` and `float/clear-left/right`. Any `[` in a class counts as an arbitrary value (this includes arbitrary variants). Colour literals are caught with `no-restricted-syntax` on `Literal`/`TemplateElement` (hex 3/4/6/8 digits, and `rgb/hsl/hwb/lab/lch/oklab/oklch(`). `#main` and `&#123;` are not flagged; a plain string like `"x #abc"` would be. The plugin requires the `tailwindcss` peer, so npm installed `tailwindcss@4.3.3` transitively; it is not in `package.json` and nothing is configured until 1.4.
    +- **jsx-a11y and react-hooks:** both are registered in the root config with the same module objects Nx's `flat/react` uses. Spreading `jsxA11y.flatConfigs.recommended` fails with "Cannot redefine plugin", because it carries a copy. Their rules apply at `error` everywhere (react-hooks `recommended-latest`, including the compiler rules).
    +- **Style prop:** banned through `react/forbid-dom-props` and `react/forbid-component-props` in `libs/ui-components/eslint.config.mjs` only.
    +- **React Compiler:** `@rolldown/plugin-babel@0.2.4` + `reactCompilerPreset()` from `@vitejs/plugin-react` 6, with `babel-plugin-react-compiler@1.0.0` and `@babel/core@8.0.9`. Wired into `apps/web` and the `ui-components`/`data-access` Vite configs (tests). The build output contains `react.memo_cache_sentinel` in both the index and the lazy home chunks.
    +- **`tools/lint-checks`:** generated with `@nx/js:library --minimal` (test-only; `src/index.ts` is an empty entry). The generator added `tools/*` to the npm workspaces and a root tsconfig reference. The tag is `type:tooling` (new depConstraint: depends on nothing). There are 42 tests:
- - `eslint-rules.spec.ts` uses the ESLint Node API with each project's real config. ESLint 9 resolves the config from `cwd`, so the engine is created per project dir;
- - `python-contracts.spec.ts` copies `app/` to a temp dir, injects a violation, and runs `uv run --project … lint-imports` and `mypy` there.
- - `implicitDependencies` on all five projects plus `inputs: [default, ^default, root eslint config]` keep it in `affected` and invalidate its cache when any rule changes. `dependsOn: []` skips the default `^build` (no Python wheel build needed). Its own eslint config turns off the two style rules for its specs, which hold forbidden strings as fixtures.
- - Feature → feature is asserted on the resolved config (no feature lib to lint yet).
    +- **CI:** checkout@v7, setup-node@v7 (Node 24), setup-uv@v10 (cache keyed on `uv.lock`), `npm ci`, `uv sync --locked`, nx-set-shas@v5, `nx format:check`, `nx affected -t lint typecheck test build`. Nx Cloud steps are gone. Prettier reformatted `apps/recipe-service/project.json` (arrays inlined) and the new files.
    +- **Local verification:**
- - `npx nx run-many -t lint typecheck test build --skip-nx-cache`: 6 projects green (web 3 tests, lint-checks 42, recipe-service 34, 13 contracts, mypy 50 files);
- - `nx affected … --base=f21efb7…` exits 0 and lists all 6 projects;
- - `nx format:check` is clean and `uv sync --locked` passes;
- - adding `className="ml-2"` to `placeholder-home.tsx` makes `nx lint web` fail, and reverting it passes.
- - A real GitHub run happens only after Adi pushes.
    +- **Review patches:**
- - The router forbidden contract now has `allow_indirect_imports = true`.
- - The arbitrary-value regex checks only the utility part, and the physical keyword pattern accepts a trailing `!`.
- - Hex literals: the 3/4-digit form is flagged only as a whole string.
- - lint-checks: timeouts set to 60 s, cache inputs list the plugins, and `spawnSync` errors are rethrown.
- - A new `react-compiler.spec.ts` transforms the home route through the web Vite config. Removing the Babel plugin makes it fail.
- - Added fixture cases for every contract, the `clsx`/`cva` callers, the passing controls and the `!` modifier.
- - CI: `timeout-minutes: 20`, plus PR-only `cancel-in-progress`.
- - Three new deferred entries.
- - Full re-run: `run-many -t lint typecheck test build` green (lint-checks 60 tests), and `format:check` is clean.
-

+## Review Triage Log +
+| # | Source | Finding | Verdict | Route | Evidence |
+| --- | ----------- | ------------------------------------------------------------------------------------------- | ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| 1 | blind, edge | Router forbidden contract also bans the indirect router → service → repository/models chain | high | patch | Reproduced: chain fixture broke the contract. `allow_indirect_imports = true` added; fixture now asserts the full chain passes. |
+| 2 | blind | `\[` ban also blocks arbitrary variants (`data-[state=open]:`, `[&_svg]:`) that shadcn uses | medium | patch | Variants only select; regex now matches brackets in the utility part only. Control asserts variants pass. |
+| 3 | edge | `text-left!` (Tailwind v4 trailing important) escapes the keyword ban | low | patch | `$` anchor; now `!?$`, fixtures for `ml-2!`, `text-right!`. |
+| 4 | blind, edge | Hex regex flags `Recipe #123`, `#add`-style strings | low | patch | 3/4-digit hex now only when the whole string is the colour; `Recipe #123` control added. `'#add'` as a whole string is still flagged (accepted). |
+| 5 | blind, edge | Spawning specs can exceed Vitest's 5 s default on CI | medium | patch | mypy alone ~1.2 s warm locally, cold on CI; `testTimeout`/`hookTimeout` 60 s. |
+| 6 | blind, edge | `externalDependencies: [eslint]` ignores plugin bumps in the cache hash | low | patch | Listed the ESLint plugins and the Vite/compiler packages. |
+| 7 | blind | `tailwindcss` is an undeclared transitive peer | low | defer | npm installs peers and the lockfile pins 4.3.3, so `npm ci` is reproducible; explicit declaration belongs to 1.4's Tailwind install. |
+| 8 | blind | deferred-work marks an item resolved while the `@tanstack`/`@hey-api` re-check stays open | low | patch | New open deferred entry for the re-check (also `react-router-*`). |
+| 9 | blind | Spec `in-review` vs sprint `in-progress` | false | reject | Workflow syncs sprint status to `review` at the present step. |
+| 10 | blind, vgap | Layers contract, photos/recipes/imports contracts lack fixtures | medium | patch | Upward-import fixtures (3) and an `it.each` over all five graph edges added. |
+| 11 | blind | Passing controls do not prove the temp copy is analysed | false | reject | The violation fixtures only fail if the copy is analysed; they do. |
+| 12 | blind, edge | No clsx/cva, a11y/hooks/boundary/mypy passing controls | low | patch | Added clsx and cva-variants fixtures, an a11y/hooks clean control, two allowed imports, a typed mypy control. |
+| 13 | blind | No `react-router-dom` boundary fixture | low | defer | Not installed; Nx checks bans only against graph nodes. Folded into #8's deferred entry. |
+| 14 | blind | `.mts/.mjs/.cts` files skip the style bans | low | reject | Only Vite/ESLint config files use those extensions; no class or colour strings live there, and widening globs adds churn. |
+| 15 | blind, vgap | React Compiler wiring has no automated check | medium | patch | `react-compiler.spec.ts` transforms `placeholder-home.tsx` through the web Vite config and asserts the memo sentinel; mutation check (Babel plugin removed) fails it. |
+| 16 | blind | CI lacks concurrency and timeout; permissions unclear | low | patch | `permissions` already present; added `timeout-minutes: 20` and PR-only `cancel-in-progress`. |
+| 17 | blind | Overriding `no-restricted-syntax` silently drops the colour ban | low | patch | Comment added at the rule; the lint-checks override is deliberate (fixture strings). |
+| 18 | edge | Missing uv makes "exits non-zero" assertions pass vacuously | low | patch | `spawnSync` error is now rethrown. |
+| 19 | edge | Protected contracts miss other submodules / `__init__` re-exports | low | reject | No such modules exist (`test_structure` pins the five layer files); covering them adds wildcard contracts for a hypothetical. |
+| 20 | edge | auth/users edges not constrained | low | reject | Deliberate: spine's graph names only the catalogue modules and routers will import auth guards; recorded in Implementation Notes. Fix would edit the spec. |
+| 21 | vgap | Arbitrary values in generated shadcn components will fail the ban | medium | defer | Surfaced while triaging #2; Adi decides token replacement vs scoped exception before 1.4/1.5. | +
+## Verification + +**Commands:** +
+- `npx nx run-many -t lint typecheck test build --skip-nx-cache` -- all green
+- `npx nx show project recipe-service --json` -- `typecheck` and new `lint` present + +**Manual checks:** +
+- Real CI run on GitHub after Adi pushes (green), plus one throwaway-branch push with `ml-2` (red) if Adi wants live proof.
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index 4ecb29d..fb45a9f 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -29,7 +29,7 @@

# - Dev moves story to 'review', then runs code-review (fresh context, different LLM recommended)

# - Retrospective appends its action items to action_items; the status view surfaces open ones

generated: 10-26-2026 13:09
-last_updated: 10-26-2026 14:18
+last_updated: 10-26-2026 15:05
project: recipes
project_key: NOKEY
tracking_system: file-system
@@ -38,7 +38,7 @@ development_status:
epic-1: in-progress
1-1-adapt-the-backend-scaffold: done
1-2-adapt-the-frontend-scaffold-and-shared-libs: done

- 1-3-ci-and-quality-gates: backlog

* 1-3-ci-and-quality-gates: review
  1-4-theme-rtl-and-app-shell: backlog
  1-5-ui-kit-shadcn-primitives-in-ui-components: backlog
  1-6-recipe-data-model-and-read-api: backlog
  diff --git a/apps/recipe-service/app/core/config.py b/apps/recipe-service/app/core/config.py
  index 51996c0..461a935 100644
  --- a/apps/recipe-service/app/core/config.py
  +++ b/apps/recipe-service/app/core/config.py
  @@ -81,7 +81,7 @@ def _describe(error: ValidationError) -> str:
  def load_settings() -> Settings:
  """Build Settings, turning validation errors into a readable startup failure."""
  try:

-        return Settings()  # type: ignore[call-arg]  # values come from env

*        return Settings()
  except ValidationError as error:
  raise SystemExit(_describe(error)) from None

diff --git a/apps/recipe-service/app/core/db.py b/apps/recipe-service/app/core/db.py
index 2795536..2dbf704 100644
--- a/apps/recipe-service/app/core/db.py
+++ b/apps/recipe-service/app/core/db.py
@@ -1,4 +1,4 @@
-from collections.abc import Iterator
+from collections.abc import Generator
from functools import lru_cache
from pathlib import Path
from typing import Annotated
@@ -25,7 +25,7 @@ def get_engine(data_dir: Path) -> Engine:

def get_session(
settings: Annotated[Settings, Depends(get_settings)],
-) -> Iterator[Session]:
+) -> Generator[Session]:
"""One session per request, injectable with `Depends(get_session)`."""
with Session(get_engine(settings.data_dir)) as session:
yield session
diff --git a/apps/recipe-service/project.json b/apps/recipe-service/project.json
index 486dff7..5b4044e 100644
--- a/apps/recipe-service/project.json
+++ b/apps/recipe-service/project.json
@@ -28,9 +28,7 @@
},
"build": {
"executor": "@nxlv/python:build",

-      "outputs": [
-        "{projectRoot}/dist"
-      ],

*      "outputs": ["{projectRoot}/dist"],
       "options": {
         "outputPath": "{projectRoot}/dist",
         "publish": false,

@@ -40,13 +38,28 @@
"cache": true
},
"lint": {

-      "executor": "@nxlv/python:ruff-check",

*      "executor": "@nxlv/python:run-commands",
*      "outputs": [],
*      "options": {
*        "commands": [
*          "uv run ruff check app tests",
*          "uv run ruff format --check app tests",
*          "uv run lint-imports"
*        ],
*        "parallel": false,
*        "cwd": "{projectRoot}",
*        "env": {
*          "PYTHONUTF8": "1"
*        }
*      },
*      "cache": true
* },
* "typecheck": {
*      "executor": "@nxlv/python:run-commands",
       "outputs": [],
       "options": {

-        "lintFilePatterns": [
-          "app",
-          "tests"
-        ]

*        "command": "uv run mypy",
*        "cwd": "{projectRoot}"
       },
       "cache": true
  },
  @@ -54,10 +67,7 @@
  "executor": "@nxlv/python:ruff-format",
  "outputs": [],
  "options": {

-        "filePatterns": [
-          "app",
-          "tests"
-        ]

*        "filePatterns": ["app", "tests"]
       },
       "cache": true
  },
  diff --git a/apps/recipe-service/pyproject.toml b/apps/recipe-service/pyproject.toml
  index 17165a2..b268ae0 100644
  --- a/apps/recipe-service/pyproject.toml
  +++ b/apps/recipe-service/pyproject.toml
  @@ -45,6 +45,8 @@ dev = [
  "pytest-sugar>=1.0.0",
  "pytest-cov>=6.0.0",
  "pytest-html>=4.1.1",
* "mypy==2.4.0",
* "import-linter==2.15",
  ]

[build-system]
@@ -82,3 +84,169 @@ ignore = []

fixable = ["ALL"]
unfixable = [] +
+[tool.mypy]
+strict = true
+plugins = ["pydantic.mypy"]
+files = ["app", "tests"] +
+[tool.pydantic-mypy]
+init_forbid_extra = true
+init_typed = true
+warn_required_dynamic_aliases = true +
+# Feature-module rules: layers point down, and modules meet only through services.
+[tool.importlinter]
+root_package = "app" + +[[tool.importlinter.contracts]]
+name = "Feature layers point down: router -> service -> repository -> models"
+type = "layers"
+containers = [

- "app.auth",
- "app.imports",
- "app.photos",
- "app.recipes",
- "app.tags",
- "app.users",
  +]
  +layers = ["router", "service", "repository", "models"]
  +exhaustive = false
-

+[[tool.importlinter.contracts]]
+name = "auth: router, repository, models and schemas are private to the module"
+type = "protected"
+protected_modules = [

- "app.auth.router",
- "app.auth.repository",
- "app.auth.models",
- "app.auth.schemas",
  +]
  +allowed_importers = ["app.auth"]
  +ignore_imports = [
- "app.main -> app.auth.router",
- "app.core.metadata -> app.auth.models",
  +]
-

+[[tool.importlinter.contracts]]
+name = "imports: router, repository, models and schemas are private to the module"
+type = "protected"
+protected_modules = [

- "app.imports.router",
- "app.imports.repository",
- "app.imports.models",
- "app.imports.schemas",
  +]
  +allowed_importers = ["app.imports"]
  +ignore_imports = [
- "app.main -> app.imports.router",
- "app.core.metadata -> app.imports.models",
  +]
-

+[[tool.importlinter.contracts]]
+name = "photos: router, repository, models and schemas are private to the module"
+type = "protected"
+protected_modules = [

- "app.photos.router",
- "app.photos.repository",
- "app.photos.models",
- "app.photos.schemas",
  +]
  +allowed_importers = ["app.photos"]
  +ignore_imports = [
- "app.main -> app.photos.router",
- "app.core.metadata -> app.photos.models",
  +]
-

+[[tool.importlinter.contracts]]
+name = "recipes: router, repository, models and schemas are private to the module"
+type = "protected"
+protected_modules = [

- "app.recipes.router",
- "app.recipes.repository",
- "app.recipes.models",
- "app.recipes.schemas",
  +]
  +allowed_importers = ["app.recipes"]
  +ignore_imports = [
- "app.main -> app.recipes.router",
- "app.core.metadata -> app.recipes.models",
  +]
-

+[[tool.importlinter.contracts]]
+name = "tags: router, repository, models and schemas are private to the module"
+type = "protected"
+protected_modules = [

- "app.tags.router",
- "app.tags.repository",
- "app.tags.models",
- "app.tags.schemas",
  +]
  +allowed_importers = ["app.tags"]
  +ignore_imports = [
- "app.main -> app.tags.router",
- "app.core.metadata -> app.tags.models",
  +]
-

+[[tool.importlinter.contracts]]
+name = "users: router, repository, models and schemas are private to the module"
+type = "protected"
+protected_modules = [

- "app.users.router",
- "app.users.repository",
- "app.users.models",
- "app.users.schemas",
  +]
  +allowed_importers = ["app.users"]
  +ignore_imports = [
- "app.main -> app.users.router",
- "app.core.metadata -> app.users.models",
  +]
-

+# Layers contracts allow skipping downwards; routers must still go through their service. +[[tool.importlinter.contracts]]
+name = "Routers never reach the repository or models"
+type = "forbidden"
+source_modules = ["app._.router"]
+forbidden_modules = ["app._.repository", "app.*.models"]
+# Direct imports only: router -> service -> repository is the intended chain.
+allow_indirect_imports = true +
+# The only cross-module edges among these four: recipes -> tags, photos; imports -> tags. +[[tool.importlinter.contracts]]
+name = "tags depends on no other catalogue module"
+type = "forbidden"
+source_modules = ["app.tags"]
+forbidden_modules = ["app.recipes", "app.imports", "app.photos"] + +[[tool.importlinter.contracts]]
+name = "photos depends on no other catalogue module"
+type = "forbidden"
+source_modules = ["app.photos"]
+forbidden_modules = ["app.recipes", "app.imports", "app.tags"] + +[[tool.importlinter.contracts]]
+name = "recipes does not depend on imports"
+type = "forbidden"
+source_modules = ["app.recipes"]
+forbidden_modules = ["app.imports"] + +[[tool.importlinter.contracts]]
+name = "imports depends only on tags"
+type = "forbidden"
+source_modules = ["app.imports"]
+forbidden_modules = ["app.recipes", "app.photos"] + +[[tool.importlinter.contracts]]
+name = "core depends on no feature module (metadata only collects models)"
+type = "forbidden"
+source_modules = ["app.core"]
+forbidden_modules = [

- "app.auth",
- "app.imports",
- "app.photos",
- "app.recipes",
- "app.tags",
- "app.users",
  +]
  +ignore_imports = ["app.core.metadata -> app.*.models"]
  diff --git a/apps/recipe-service/tests/test_structure.py b/apps/recipe-service/tests/test_structure.py
  index dedf1bb..c5354f1 100644
  --- a/apps/recipe-service/tests/test_structure.py
  +++ b/apps/recipe-service/tests/test_structure.py
  @@ -5,6 +5,7 @@ from pathlib import Path
  import pytest
  from fastapi import APIRouter, FastAPI
  from fastapi.testclient import TestClient
  +from sqlalchemy import Engine
  from sqlmodel import Session

from app.core import metadata
@@ -100,7 +101,9 @@ def test_session_uses_sqlite_in_data_dir(tmp_path: Path) -> None:
sessions = get_session(get_settings())
session = next(sessions)
assert isinstance(session, Session)

- assert session.get_bind().url.database == str(tmp_path / "data" / DB_FILENAME)

* bind = session.get_bind()
* assert isinstance(bind, Engine)
* assert bind.url.database == str(tmp_path / "data" / DB_FILENAME)
  assert (tmp_path / "data").is_dir()
  sessions.close()

@@ -109,6 +112,8 @@ def test_session_follows_overridden_settings(tmp_path: Path) -> None:
other = get_settings().model_copy(update={"data_dir": tmp_path / "other"})
sessions = get_session(other)
session = next(sessions)

- assert session.get_bind().url.database == str(tmp_path / "other" / DB_FILENAME)

* bind = session.get_bind()
* assert isinstance(bind, Engine)
* assert bind.url.database == str(tmp_path / "other" / DB_FILENAME)
  sessions.close()
  get_engine(tmp_path / "other").dispose()
  diff --git a/apps/web/vite.config.mts b/apps/web/vite.config.mts
  index eca5fc5..db625c7 100644
  --- a/apps/web/vite.config.mts
  +++ b/apps/web/vite.config.mts
  @@ -1,6 +1,7 @@
  /// <reference types='vitest' />
  import { defineConfig } from 'vite';
  -import react from '@vitejs/plugin-react';
  +import babel from '@rolldown/plugin-babel';
  +import react, { reactCompilerPreset } from '@vitejs/plugin-react';
  import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

export default defineConfig(() => ({
@@ -19,7 +20,11 @@ export default defineConfig(() => ({
port: 4300,
host: 'localhost',
},

- plugins: [react(), nxReadySignal()],

* plugins: [
* react(),
* babel({ presets: [reactCompilerPreset()] }),
* nxReadySignal(),
* ],
  // Uncomment this if you are using workers.
  // worker: {
  // plugins: [],
  diff --git a/eslint.config.mjs b/eslint.config.mjs
  index 7e8774d..f442281 100644
  --- a/eslint.config.mjs
  +++ b/eslint.config.mjs
  @@ -1,4 +1,46 @@
  import nx from '@nx/eslint-plugin';
  +import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
  +import jsxA11y from 'eslint-plugin-jsx-a11y';
  +import reactHooks from 'eslint-plugin-react-hooks';
*

+// Optional variant prefixes (`md:`, `rtl:`, `[&>a]:`) and the negative sign (`-ml-2`).
+const VARIANTS = String.raw`^(?:[^:]+:)*!?-?`; +
+// Physical sides break in RTL; Tailwind's logical utilities (ms/me/ps/pe/start/end) flip with `dir`.
+const PHYSICAL_DIRECTION = [

- 'm[lr]',
- 'p[lr]',
- 'left',
- 'right',
- 'border-[lr]',
- 'rounded-[lr]',
- 'rounded-[tb][lr]',
- 'scroll-m[lr]',
- 'scroll-p[lr]',
  +].map((utility) => ({
- pattern: `${VARIANTS}${utility}(?:-|$)`,
- message:
- 'Physical-direction utility breaks RTL: use the logical one (ms/me/ps/pe/start/end).',
  +}));
-

+const PHYSICAL_KEYWORD = {

- pattern: `${VARIANTS}(?:text|float|clear)-(?:left|right)!?$`,
- message: 'Physical alignment breaks RTL: use start/end.',
  +};
-

+// Arbitrary values (`p-[13px]`, `bg-[#f00]`, `[mask:none]`) bypass the design tokens.
+// Brackets in a variant (`data-[state=open]:`, `[&_svg]:`) only select, so they stay allowed.
+const ARBITRARY_VALUE = {

- pattern: String.raw`^(?:(?:[^:\[\]]|\[[^\]]*\])+:)*[^\[\]:]*\[[^\]]*\][^:]*$`,
- message: 'Arbitrary values bypass the design tokens: use a token utility.',
  +};
-

+// A string that is a hex colour, or a 6/8-digit hex anywhere; short `#abc` inside
+// text is too often an id or issue number (`Recipe #123`).
+const HEX_COLOUR = String.raw`/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$|(^|[^\w&])#([0-9a-f]{6}|[0-9a-f]{8})\b/i`;
+const FUNCTIONAL_COLOUR = String.raw`/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i`;
+const COLOUR_MESSAGE =

- 'Colour literals belong in the theme; use a design token class instead.';

export default [
...nx.configs['flat/base'],
@@ -50,6 +92,11 @@ export default [
'react-router-*',
],
},

-            {
-              // Workspace tooling (lint fixture tests) imports no project code.
-              sourceTag: 'type:tooling',
-              onlyDependOnLibsWithTags: [],
-            },
             {
               sourceTag: 'type:data-access',
               onlyDependOnLibsWithTags: [],

@@ -71,6 +118,41 @@ export default [
],
},
},

- {
- files: ['**/\*.ts', '**/_.tsx', '\**/_.js', '**/*.jsx'],
- plugins: { 'better-tailwindcss': betterTailwindcss },
- rules: {
-      'better-tailwindcss/no-restricted-classes': [
-        'error',
-        {
-          restrict: [...PHYSICAL_DIRECTION, PHYSICAL_KEYWORD, ARBITRARY_VALUE],
-        },
-      ],
-      // A later block that sets `no-restricted-syntax` replaces this list: extend it instead.
-      'no-restricted-syntax': [
-        'error',
-        ...[HEX_COLOUR, FUNCTIONAL_COLOUR].flatMap((regex) => [
-          { selector: `Literal[value=${regex}]`, message: COLOUR_MESSAGE },
-          {
-            selector: `TemplateElement[value.raw=${regex}]`,
-            message: COLOUR_MESSAGE,
-          },
-        ]),
-      ],
- },
- },
- {
- files: ['**/\*.tsx', '**/*.jsx'],
- // Same plugin object Nx's react config registers; flatConfigs carries a copy ESLint rejects.
- plugins: { 'jsx-a11y': jsxA11y },
- rules: jsxA11y.flatConfigs.recommended.rules,
- },
- {
- files: ['**/\*.ts', '**/_.tsx', '\**/_.js', '**/*.jsx'],
- plugins: { 'react-hooks': reactHooks },
- // The compiler-era rules (purity, refs, immutability...) keep code compilable.
- rules: reactHooks.configs['recommended-latest'].rules,
- },
  {
  files: [
  '**/*.ts',
  diff --git a/libs/data-access/vite.config.mts b/libs/data-access/vite.config.mts
  index c014f64..c42519f 100644
  --- a/libs/data-access/vite.config.mts
  +++ b/libs/data-access/vite.config.mts
  @@ -1,9 +1,11 @@
  import { defineConfig } from 'vite';
  -import react from '@vitejs/plugin-react';
  +import babel from '@rolldown/plugin-babel';
  +import react, { reactCompilerPreset } from '@vitejs/plugin-react';
  export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/data-access',

* plugins: [react()],

- // Tests run the same compiled components the app ships.
- plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  test: {
  name: '@bite-and-board/data-access',
  watch: false,
  diff --git a/libs/ui-components/eslint.config.mjs b/libs/ui-components/eslint.config.mjs
  index 2cde510..839b7b2 100644
  --- a/libs/ui-components/eslint.config.mjs
  +++ b/libs/ui-components/eslint.config.mjs
  @@ -6,8 +6,11 @@ export default [
  ...baseConfig,
  {
  files: ['**/\*.ts', '**/_.tsx', '\**/_.js', '**/*.jsx'],

* // Override or add rules here
* rules: {},

- // Inline styles skip the design tokens; shared components style through classes only.
- rules: {
-      'react/forbid-dom-props': ['error', { forbid: ['style'] }],
-      'react/forbid-component-props': ['error', { forbid: ['style'] }],
- },
  },
  {
  ignores: ['**/out-tsc'],
  diff --git a/libs/ui-components/vite.config.mts b/libs/ui-components/vite.config.mts
  index 7879e0d..1f920f9 100644
  --- a/libs/ui-components/vite.config.mts
  +++ b/libs/ui-components/vite.config.mts
  @@ -1,9 +1,11 @@
  import { defineConfig } from 'vite';
  -import react from '@vitejs/plugin-react';
  +import babel from '@rolldown/plugin-babel';
  +import react, { reactCompilerPreset } from '@vitejs/plugin-react';
  export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/ui-components',

* plugins: [react()],

- // Tests run the same compiled components the app ships.
- plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  test: {
  name: '@bite-and-board/ui-components',
  watch: false,
  diff --git a/package.json b/package.json
  index 4c3ff98..9ceacfb 100644
  --- a/package.json
  +++ b/package.json
  @@ -10,6 +10,7 @@
  "node": ">=22.22.0"
  },
  "devDependencies": {
- "@babel/core": "8.0.9",
  "@eslint/js": "^9.8.0",
  "@nx/eslint": "24.0.0",
  "@nx/eslint-plugin": "24.0.0",
  @@ -19,6 +20,7 @@
  "@nx/vitest": "24.0.0",
  "@nx/web": "24.0.0",
  "@nxlv/python": "^23.3.1",
- "@rolldown/plugin-babel": "0.2.4",
  "@swc-node/register": "1.11.1",
  "@swc/cli": "~0.8.1",
  "@swc/core": "1.15.8",
  @@ -31,12 +33,14 @@
  "@vitejs/plugin-react": "^6.0.0",
  "@vitest/coverage-v8": "~5.0.1",
  "@vitest/ui": "~5.0.1",
- "babel-plugin-react-compiler": "1.0.0",
  "eslint": "^9.8.0",
  "eslint-config-prettier": "^10.0.0",
- "eslint-plugin-better-tailwindcss": "4.10.0",
  "eslint-plugin-import": "2.31.0",
  "eslint-plugin-jsx-a11y": "6.10.1",
  "eslint-plugin-react": "^7.35.0",

* "eslint-plugin-react-hooks": "5.0.0",

- "eslint-plugin-react-hooks": "7.1.1",
  "jiti": "2.4.2",
  "jsdom": "^27.1.0",
  "nx": "24.0.0",
  @@ -49,7 +53,8 @@
  },
  "workspaces": [
  "apps/*",

* "libs/*"

- "libs/*",
- "tools/*"
  ],
  "packageManager": "npm@12.1.0",
  "dependencies": {
  diff --git a/tools/lint-checks/eslint.config.mjs b/tools/lint-checks/eslint.config.mjs
  new file mode 100644
  index 0000000..4f14b4e
  --- /dev/null
  +++ b/tools/lint-checks/eslint.config.mjs
  @@ -0,0 +1,16 @@
  +import baseConfig from '../../eslint.config.mjs';
-

+export default [

- ...baseConfig,
- {
- files: ['src/**/*.spec.ts'],
- // The specs hold forbidden classes and colours as fixture strings on purpose.
- rules: {
-      'no-restricted-syntax': 'off',
-      'better-tailwindcss/no-restricted-classes': 'off',
- },
- },
- {
- ignores: ['**/out-tsc'],
- },
  +];
  diff --git a/tools/lint-checks/package.json b/tools/lint-checks/package.json
  new file mode 100644
  index 0000000..ae4a7b9
  --- /dev/null
  +++ b/tools/lint-checks/package.json
  @@ -0,0 +1,53 @@
  +{
- "name": "@bite-and-board/lint-checks",
- "version": "0.0.1",
- "private": true,
- "type": "module",
- "main": "./src/index.ts",
- "types": "./src/index.ts",
- "exports": {
- ".": {
-      "types": "./src/index.ts",
-      "import": "./src/index.ts",
-      "default": "./src/index.ts"
- },
- "./package.json": "./package.json"
- },
- "nx": {
- "name": "lint-checks",
- "tags": [
-      "type:tooling"
- ],
- "implicitDependencies": [
-      "web",
-      "ui-components",
-      "data-access",
-      "recipe-domain",
-      "recipe-service"
- ],
- "targets": {
-      "test": {
-        "dependsOn": [],
-        "inputs": [
-          "default",
-          "^default",
-          "{workspaceRoot}/eslint.config.mjs",
-          {
-            "externalDependencies": [
-              "eslint",
-              "@nx/eslint-plugin",
-              "eslint-plugin-better-tailwindcss",
-              "eslint-plugin-jsx-a11y",
-              "eslint-plugin-react",
-              "eslint-plugin-react-hooks",
-              "vite",
-              "@vitejs/plugin-react",
-              "@rolldown/plugin-babel",
-              "babel-plugin-react-compiler"
-            ]
-          }
-        ]
-      }
- }
- }
  +}
  diff --git a/tools/lint-checks/src/eslint-rules.spec.ts b/tools/lint-checks/src/eslint-rules.spec.ts
  new file mode 100644
  index 0000000..6638a8c
  --- /dev/null
  +++ b/tools/lint-checks/src/eslint-rules.spec.ts
  @@ -0,0 +1,215 @@
  +import { ESLint, type Linter } from 'eslint';
  +import { join } from 'node:path';
-

+const WORKSPACE = join(import.meta.dirname, '../../..'); +
+const engines = new Map<string, ESLint>(); +
+/** Lints `code` as if it were a file in `project`, with that project's real config. */
+async function lint(

- project: string,
- code: string,
- file = 'src/fixture.tsx',
  +): Promise<Linter.LintMessage[]> {
- const cwd = join(WORKSPACE, project);
- let engine = engines.get(cwd);
- if (!engine) {
- engine = new ESLint({ cwd });
- engines.set(cwd, engine);
- }
- const [result] = await engine.lintText(code, {
- filePath: join(cwd, file),
- });
- return result.messages;
  +}
-

+const rulesOf = (messages: Linter.LintMessage[]) =>

- messages.map((message) => message.ruleId);
-

+const TAILWIND = 'better-tailwindcss/no-restricted-classes'; +
+describe('RTL and design-token class bans', () => {

- it.each([
- 'ml-2',
- 'mr-auto',
- 'pl-4',
- 'pr-1',
- 'left-0',
- 'right-2',
- 'text-left',
- 'text-right',
- 'md:-ml-2',
- 'hover:pr-3',
- 'border-l',
- 'rounded-tr-lg',
- 'ml-2!',
- 'text-right!',
- ])('rejects the physical-direction utility %s', async (cls) => {
- const messages = await lint(
-      'apps/web',
-      `export const A = () => <div className="flex ${cls}" />;\n`,
- );
- expect(rulesOf(messages)).toEqual([TAILWIND]);
- });
-
- it.each(['p-[13px]', 'bg-[#ff0000]', 'w-[372px]', '[mask-type:luminance]'])(
- 'rejects the arbitrary value %s inside cn()',
- async (cls) => {
-      const messages = await lint(
-        'apps/web',
-        `declare function cn(...c: string[]): string;\nexport const A = () => <div className={cn('flex', '${cls}')} />;\n`,
-      );
-      // `bg-[#ff0000]` also trips the colour-literal rule.
-      expect(rulesOf(messages)).toContain(TAILWIND);
- },
- );
-
- it.each([
- ['clsx', "clsx('flex', { 'mr-2': true })"],
- ['cva', "cva('flex', { variants: { side: { start: 'pl-2' } } })"],
- ])('rejects physical utilities inside %s()', async (callee, call) => {
- const messages = await lint(
-      'libs/ui-components',
-      `declare function ${callee}(...a: unknown[]): string;\nexport const c = ${call};\n`,
-      'src/fixture.ts',
- );
- expect(rulesOf(messages)).toEqual([TAILWIND]);
- });
-
- it('rejects physical utilities in template literals', async () => {
- const messages = await lint(
-      'libs/ui-components',
-      'export const A = ({ on }: { on: boolean }) => <div className={`ms-2 ${on ? "pl-2" : ""}`} />;\n',
- );
- expect(rulesOf(messages)).toEqual([TAILWIND]);
- });
-
- it('accepts logical utilities and design tokens', async () => {
- const messages = await lint(
-      'apps/web',
-      'export const A = () => <div className="ms-2 me-auto ps-4 pe-1 start-0 end-2 text-start text-end md:-ms-2 border-s rounded-se-lg bg-primary p-3 data-[state=open]:bg-accent [&_svg]:size-4 has-[>svg]:ps-2" />;\n',
- );
- expect(messages).toEqual([]);
- });
  +});
-

+describe('colour literals', () => {

- it.each([
- `'#ff0000'`,
- `'#FFF'`,
- '`color: rgb(1 2 3)`',
- `'rgba(0,0,0,0.5)'`,
- `'hsl(10 20% 30%)'`,
- `'oklch(0.7 0.1 30)'`,
- ])('rejects %s', async (literal) => {
- const messages = await lint(
-      'libs/ui-components',
-      `export const c = ${literal};\n`,
-      'src/fixture.ts',
- );
- expect(rulesOf(messages)).toEqual(['no-restricted-syntax']);
- });
-
- it.each([`'#main'`, `'&#123;'`, `'bg-primary'`, `'Recipe #123'`])(
- 'accepts the non-colour %s',
- async (literal) => {
-      const messages = await lint(
-        'libs/ui-components',
-        `export const c = ${literal};\n`,
-        'src/fixture.ts',
-      );
-      expect(messages).toEqual([]);
- },
- );
  +});
-

+describe('style prop', () => {

- const code =
- 'import type { FC } from "react";\nexport const A = ({ C }: { C: FC<{ style?: object }> }) => <><div style={{}} /><C style={{}} /></>;\n';
-
- it('is banned on DOM nodes and components in ui-components', async () => {
- const messages = await lint('libs/ui-components', code);
- expect(rulesOf(messages)).toEqual([
-      'react/forbid-dom-props',
-      'react/forbid-component-props',
- ]);
- });
-
- it('stays allowed in the app shell', async () => {
- expect(await lint('apps/web', code)).toEqual([]);
- });
  +});
-

+describe('accessibility and React Compiler rules', () => {

- it('enforces jsx-a11y as errors', async () => {
- const messages = await lint(
-      'libs/ui-components',
-      'export const A = () => <img src="x.png" />;\n',
- );
- expect(messages.map((m) => [m.ruleId, m.severity])).toEqual([
-      ['jsx-a11y/alt-text', 2],
- ]);
- });
-
- it('accepts accessible markup and pure components', async () => {
- const messages = await lint(
-      'libs/ui-components',
-      'export function A({ src }: { src: string }) {\n  return <img src={src} alt="" />;\n}\n',
- );
- expect(messages).toEqual([]);
- });
-
- it('enforces the compiler-era hooks rules', async () => {
- const messages = await lint(
-      'apps/web',
-      'export function A() {\n  const now = Date.now();\n  return <p>{now}</p>;\n}\n',
- );
- expect(rulesOf(messages)).toEqual(['react-hooks/purity']);
- });
  +});
-

+describe('module boundaries', () => {

- const BOUNDARIES = '@nx/enforce-module-boundaries';
-
- it.each([
- ['libs/ui-components', '@bite-and-board/data-access'],
- ['libs/ui-components', 'react-router'],
- ['libs/recipe-domain', 'react'],
- ])('%s may not import %s', async (project, target) => {
- const messages = await lint(
-      project,
-      `import * as dep from '${target}';\nexport const x = dep;\n`,
-      'src/fixture.ts',
- );
- expect(rulesOf(messages)).toEqual([BOUNDARIES]);
- });
-
- it.each([
- ['libs/ui-components', '@bite-and-board/recipe-domain'],
- ['apps/web', '@bite-and-board/ui-components'],
- ])('%s may import %s', async (project, target) => {
- const messages = await lint(
-      project,
-      `import * as dep from '${target}';\nexport const x = dep;\n`,
-      'src/fixture.ts',
- );
- expect(messages).toEqual([]);
- });
-
- it('keeps feature libs from importing each other', async () => {
- // No feature lib exists yet to lint against, so assert the constraint itself.
- const engine = new ESLint({ cwd: join(WORKSPACE, 'apps/web') });
- const config = await engine.calculateConfigForFile(
-      join(WORKSPACE, 'apps/web/src/main.tsx'),
- );
- const [, { depConstraints }] = config.rules[BOUNDARIES];
- const feature = depConstraints.find(
-      (c: { sourceTag: string }) => c.sourceTag === 'type:feature',
- );
- expect(feature.onlyDependOnLibsWithTags).toEqual([
-      'type:data-access',
-      'type:ui',
-      'type:domain',
- ]);
- });
  +});
  diff --git a/tools/lint-checks/src/index.ts b/tools/lint-checks/src/index.ts
  new file mode 100644
  index 0000000..cd4f0fa
  --- /dev/null
  +++ b/tools/lint-checks/src/index.ts
  @@ -0,0 +1,2 @@
  +// Test-only project: the specs prove each workspace lint rule rejects a bad line.
  +export {};
  diff --git a/tools/lint-checks/src/python-contracts.spec.ts b/tools/lint-checks/src/python-contracts.spec.ts
  new file mode 100644
  index 0000000..538cd89
  --- /dev/null
  +++ b/tools/lint-checks/src/python-contracts.spec.ts
  @@ -0,0 +1,141 @@
  +import { spawnSync } from 'node:child_process';
  +import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
  +import { tmpdir } from 'node:os';
  +import { join } from 'node:path';
-

+const SERVICE = join(import.meta.dirname, '../../../apps/recipe-service'); +
+function uv(args: string[], cwd: string) {

- const result = spawnSync('uv', ['run', '--project', SERVICE, ...args], {
- cwd,
- encoding: 'utf-8',
- env: { ...process.env, PYTHONUTF8: '1' },
- });
- // A missing uv must fail loudly, not pass every "exits non-zero" check.
- if (result.error) throw result.error;
- return { status: result.status, output: result.stdout + result.stderr };
  +}
-

+let workdir: string; +
+beforeEach(() => {

- // A scratch copy of the real `app` package, so fixtures never touch the source.
- workdir = mkdtempSync(join(tmpdir(), 'lint-checks-'));
- cpSync(join(SERVICE, 'app'), join(workdir, 'app'), {
- recursive: true,
- filter: (source) => !source.includes('**pycache**'),
- });
  +});
-

+afterEach(() => {

- rmSync(workdir, { recursive: true, force: true });
  +});
-

+function lintImports(files: Record<string, string>) {

- for (const [path, code] of Object.entries(files)) {
- writeFileSync(join(workdir, 'app', path), code);
- }
- return uv(
- ['lint-imports', '--no-cache', '--config', join(SERVICE, 'pyproject.toml')],
- workdir,
- );
  +}
-

+const importing = (module: string, name: string) =>

- `from app.${module} import ${name}  # noqa: F401\n`;
-

+describe('import-linter contracts', () => {

- it('pass on the untouched app', () => {
- expect(lintImports({}).status).toBe(0);
- });
-
- it('allow the full router -> service -> repository -> models chain', () => {
- expect(
-      lintImports({
-        'recipes/router.py': importing('recipes', 'service'),
-        'recipes/service.py': importing('recipes', 'repository'),
-        'recipes/repository.py': importing('recipes', 'models'),
-      }).status,
- ).toBe(0);
- });
-
- it('reject a router that skips the service layer', () => {
- const { status, output } = lintImports({
-      'recipes/router.py': importing('recipes', 'repository'),
- });
- expect(status).not.toBe(0);
- expect(output).toContain('Routers never reach the repository or models');
- });
-
- it.each([
- ['repository', 'service'],
- ['models', 'repository'],
- ['service', 'router'],
- ])('reject %s importing its own %s (upward)', (from, target) => {
- const { status, output } = lintImports({
-      [`recipes/${from}.py`]: importing('recipes', target),
- });
- expect(status).not.toBe(0);
- expect(output).toContain('Feature layers point down');
- });
-
- it("reject reaching into another module's repository", () => {
- const { status, output } = lintImports({
-      'recipes/service.py': importing('tags', 'repository'),
- });
- expect(status).not.toBe(0);
- expect(output).toContain(
-      'tags: router, repository, models and schemas are private',
- );
- });
-
- it("allow calling another module's service", () => {
- expect(
-      lintImports({ 'recipes/service.py': importing('tags', 'service') })
-        .status,
- ).toBe(0);
- });
-
- it.each([
- ['tags', 'recipes', 'tags depends on no other catalogue module'],
- ['photos', 'recipes', 'photos depends on no other catalogue module'],
- ['recipes', 'imports', 'recipes does not depend on imports'],
- ['imports', 'recipes', 'imports depends only on tags'],
- ['imports', 'photos', 'imports depends only on tags'],
- ])('reject %s depending on %s', (from, target, contract) => {
- const { status, output } = lintImports({
-      [`${from}/service.py`]: importing(target, 'service'),
- });
- expect(status).not.toBe(0);
- expect(output).toContain(contract);
- });
-
- it('reject core depending on a feature module', () => {
- const { status, output } = lintImports({
-      'core/errors.py': importing('recipes', 'service'),
- });
- expect(status).not.toBe(0);
- expect(output).toContain('core depends on no feature module');
- });
  +});
-

+describe('mypy strict', () => {

- function mypy(code: string) {
- const file = join(workdir, 'app', 'fixture.py');
- writeFileSync(file, code);
- return uv(
-      ['mypy', '--config-file', join(SERVICE, 'pyproject.toml'), file],
-      workdir,
- );
- }
-
- it('rejects an unannotated function', () => {
- const { status, output } = mypy('def f(x):\n return x\n');
- expect(status).not.toBe(0);
- expect(output).toContain('[no-untyped-def]');
- });
-
- it('accepts an annotated function', () => {
- expect(mypy('def f(x: int) -> int:\n return x\n').status).toBe(0);
- });
  +});
  diff --git a/tools/lint-checks/src/react-compiler.spec.ts b/tools/lint-checks/src/react-compiler.spec.ts
  new file mode 100644
  index 0000000..d8b9ef4
  --- /dev/null
  +++ b/tools/lint-checks/src/react-compiler.spec.ts
  @@ -0,0 +1,25 @@
  +import { join } from 'node:path';
  +import { createServer } from 'vite';
-

+const WORKSPACE = join(import.meta.dirname, '../../..'); +
+// The memo cache sentinel only appears in components the React Compiler rewrote.
+const COMPILED = 'react.memo_cache_sentinel'; +
+it('compiles app components with the React Compiler', async () => {

- const root = join(WORKSPACE, 'apps/web');
- const server = await createServer({
- configFile: join(root, 'vite.config.mts'),
- root,
- logLevel: 'silent',
- server: { middlewareMode: true, hmr: false },
- });
- try {
- const result = await server.transformRequest(
-      '/src/app/placeholder-home.tsx',
- );
- expect(result?.code).toContain(COMPILED);
- } finally {
- await server.close();
- }
  +});
  diff --git a/tools/lint-checks/tsconfig.json b/tools/lint-checks/tsconfig.json
  new file mode 100644
  index 0000000..62ebbd9
  --- /dev/null
  +++ b/tools/lint-checks/tsconfig.json
  @@ -0,0 +1,13 @@
  +{
- "extends": "../../tsconfig.base.json",
- "files": [],
- "include": [],
- "references": [
- {
-      "path": "./tsconfig.lib.json"
- },
- {
-      "path": "./tsconfig.spec.json"
- }
- ]
  +}
  diff --git a/tools/lint-checks/tsconfig.lib.json b/tools/lint-checks/tsconfig.lib.json
  new file mode 100644
  index 0000000..4e1ed54
  --- /dev/null
  +++ b/tools/lint-checks/tsconfig.lib.json
  @@ -0,0 +1,27 @@
  +{
- "extends": "../../tsconfig.base.json",
- "compilerOptions": {
- "rootDir": "src",
- "outDir": "dist",
- "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
- "emitDeclarationOnly": true,
- "forceConsistentCasingInFileNames": true,
- "types": ["node"]
- },
- "include": ["src/**/*.ts"],
- "references": [],
- "exclude": [
- "vite.config.ts",
- "vite.config.mts",
- "vitest.config.ts",
- "vitest.config.mts",
- "src/**/*.test.ts",
- "src/**/*.spec.ts",
- "src/**/*.test.tsx",
- "src/**/*.spec.tsx",
- "src/**/*.test.js",
- "src/**/*.spec.js",
- "src/**/*.test.jsx",
- "src/**/*.spec.jsx"
- ]
  +}
  diff --git a/tools/lint-checks/tsconfig.spec.json b/tools/lint-checks/tsconfig.spec.json
  new file mode 100644
  index 0000000..f68d9d3
  --- /dev/null
  +++ b/tools/lint-checks/tsconfig.spec.json
  @@ -0,0 +1,34 @@
  +{
- "extends": "../../tsconfig.base.json",
- "compilerOptions": {
- "outDir": "./out-tsc/vitest",
- "types": [
-      "vitest/globals",
-      "vitest/importMeta",
-      "vite/client",
-      "node",
-      "vitest"
- ],
- "forceConsistentCasingInFileNames": true
- },
- "include": [
- "vite.config.ts",
- "vite.config.mts",
- "vitest.config.ts",
- "vitest.config.mts",
- "src/**/*.test.ts",
- "src/**/*.spec.ts",
- "src/**/*.test.tsx",
- "src/**/*.spec.tsx",
- "src/**/*.test.js",
- "src/**/*.spec.js",
- "src/**/*.test.jsx",
- "src/**/*.spec.jsx",
- "src/**/*.d.ts"
- ],
- "references": [
- {
-      "path": "./tsconfig.lib.json"
- }
- ]
  +}
  diff --git a/tools/lint-checks/vitest.config.mts b/tools/lint-checks/vitest.config.mts
  new file mode 100644
  index 0000000..8c8e3af
  --- /dev/null
  +++ b/tools/lint-checks/vitest.config.mts
  @@ -0,0 +1,21 @@
  +import { defineConfig } from 'vitest/config';
-

+export default defineConfig(() => ({

- root: import.meta.dirname,
- cacheDir: '../../node_modules/.vite/tools/lint-checks',
- test: {
- name: 'lint-checks',
- watch: false,
- globals: true,
- environment: 'node',
- // Specs spawn uv, mypy and Vite with cold caches; CI runners need headroom.
- testTimeout: 60_000,
- hookTimeout: 60_000,
- include: ['src/**/*.spec.ts'],
- reporters: ['default'],
- coverage: {
-      reportsDirectory: './test-output/vitest/coverage',
-      provider: 'v8' as const,
- },
- },
  +}));
  diff --git a/tsconfig.json b/tsconfig.json
  index 52df2e7..94f7296 100644
  --- a/tsconfig.json
  +++ b/tsconfig.json
  @@ -14,6 +14,9 @@
  },
  {
  "path": "./libs/ui-components"
- },
- {
-      "path": "./tools/lint-checks"
  }
  ],
  "compilerOptions": {}

```

```
