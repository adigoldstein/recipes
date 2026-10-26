# Review: Story 1.4 — Theme, RTL and app shell

**Status:** ready for Adi's review. Nothing is committed (baseline `cdb832a180f971303daf09e7481e520822e86919`).
**Spec:** [spec-1-4-theme-rtl-and-app-shell.md](spec-1-4-theme-rtl-and-app-shell.md) · **Deferred:** [deferred-work.md](deferred-work.md) · **Screenshots:** [review-1-4-screenshots/](review-1-4-screenshots/)

## Verification

- `npx nx run-many -t lint typecheck test build --skip-nx-cache` → 23/23 tasks green (7 projects): ui-components 48 tests (incl. WCAG contrast for every token pair, both themes), web 16 (every I/O matrix row except lint), i18n 3, lint-checks 73 (Hebrew-literal rule, i18n boundaries, Tailwind pipeline), recipe-service unchanged and green. `nx format:check` clean.
- Mutation checks: removing `tailwindcss()` from `apps/web/vite.config.mts` fails the new `tailwind.spec.ts`; `<p>שלום</p>` / `'שלום'` / template / attribute fail lint in web and ui-components, pass in spec files.
- Browser (dev server, Vite + recipe-service via proxy): `/` and `/nope` at 375px and 1280px, light and dark — RTL, Rubik, tokens, top bar, pill button, focus ring; titles `ביס & סיר` / `הדף לא נמצא · ביס & סיר`; toggle cycle system → light → dark → system, reload keeps choice; "חזרה לרשימה" focuses the home h1. No console errors.
- 3 parallel reviews (blind, edge-case, verification-gap): 25 findings → 7 patched, 2 deferred, 16 rejected (see the spec's Review Triage Log). Biggest catches: the 50%-alpha focus ring was 2.8–2.9:1 in dark (now solid, ≥ 3:1); 36px `sm` button sizes violated the 44px target (removed); nothing guarded the Tailwind plugin (new spec).
- Orchestrator fix: Prettier had turned "apps/\*, libs/\*" into "apps/\_, libs/\_" in the architecture memlog; restored as code spans.

## Acceptance criteria

| AC                                                                                                       | Result                                      |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `run-many -t lint typecheck test build` green, `format:check` clean                                      | ✅ 23/23                                    |
| `npm run dev`: `/`, `/nope` at 375px + desktop, both themes, RTL/Rubik/tokens/top bar, no console errors | ✅ screenshots in `review-1-4-screenshots/` |
| `libs/ui-components/components.json` points at the lib, `rtl: true`                                      | ✅ radix-nova, css `src/styles/theme.css`   |

## Adi's decisions (2026-10-26)

- **Copy** (`libs/i18n/src/he.json`): not-found message "אופס...העמוד לא נמצא"; error "משהו השתבש" / "אפשר לרענן ולנסות שוב"; theme toggle "צבעים: לפי המכשיר / בהיר / כהה". Specs updated; checks re-run green.
- **Deferred items → Story 1.5 ACs** (`epics.md`, `deferred-work.md` marked resolved): shared `AppProviders` so a broken `main.tsx` bootstrap fails a test; stronger `--input` border token meeting 3:1, contrast-tested, with a Storybook preview for approval.
- **`.claude/launch.json`** stays out of git (added to `.gitignore`).

Notes kept for reference:

- **shadcn workflow:** source uses relative imports (Nx lint requires it inside a project); `components.json` keeps `#` aliases for the CLI, so files from `npx shadcn add` need imports made relative + arbitrary values tokenised (noted in the ui-components README).
- **Lint exemption** covers `*.{spec,test}.{ts,tsx,js,jsx}`, not only `*.spec.tsx`.

## Also in this change (outside Story 1.4)

### AI model playbook (your request)

- `docs/ai-model-playbook.md` — your playbook, sections 1–5, wording unchanged (Prettier formatting only).
- `CLAUDE.md` — new "AI model selection" section above the Nx block.

### Planning: Storybook (your approval, no code yet)

- `epics.md` Story 1.5 — new ACs: `@nx/storybook` (React + Vite) on `libs/ui-components`, preview loads theme CSS, RTL decorator + `DirectionProvider`, light/dark toolbar toggle, addon-a11y, one story per component incl. Button/TopBar/ThemeToggle/Board, `build-storybook` in CI via `nx affected`.
- `epics.md` Story 1.5 also gets the two ACs above (AppProviders, `--input` contrast).
- `epics.md` Story 6.5 — publish the built Storybook (e.g. GitHub Pages) and link it from the README.
- `ARCHITECTURE-SPINE.md` — Testing rule sentence + Stack row "Storybook 10.x" (npm latest 10.6.4 on 2026-10-26; 11 is alpha); `.memlog.md` decision line.
- `ui-component-inventory.md` — every component gets a story; "Rule for new needs" adds the story.
- Note: Prettier re-padded the tables in `epics.md`, the spine and the inventory (whitespace only; `format:check` requires it for touched files).

## Changed files

```text
 .gitignore                                                                  |     3 +
 CLAUDE.md                                                                   |     5 +
 _bmad-output/implementation-artifacts/deferred-work.md                      |    10 +
 _bmad-output/implementation-artifacts/spec-1-4-theme-rtl-and-app-shell.md   |   151 +
 _bmad-output/implementation-artifacts/sprint-status.yaml                    |     4 +-
 .../architecture/architecture-recipes-2026-10-26/.memlog.md                 |     4 +-
 .../architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md      |   108 +-
 _bmad-output/planning-artifacts/epics.md                                    |   202 +-
 _bmad-output/planning-artifacts/ui-component-inventory.md                   |    75 +-
 apps/web/index.html                                                         |    19 +-
 apps/web/src/app/app-layout.tsx                                             |    44 +
 apps/web/src/app/not-found.tsx                                              |    18 +
 apps/web/src/app/page-heading.tsx                                           |    10 +
 apps/web/src/app/placeholder-home.tsx                                       |    13 +-
 apps/web/src/app/route-error.tsx                                            |    12 +-
 apps/web/src/app/router.spec.tsx                                            |    93 +-
 apps/web/src/app/router.tsx                                                 |     5 +
 apps/web/src/app/theme.spec.tsx                                             |   146 +
 apps/web/src/app/theme.tsx                                                  |    82 +
 apps/web/src/main.tsx                                                       |    11 +-
 apps/web/src/styles.css                                                     |     5 +-
 apps/web/src/test-setup.ts                                                  |    36 +
 apps/web/tsconfig.app.json                                                  |    13 +-
 apps/web/tsconfig.spec.json                                                 |     6 +-
 apps/web/vite.config.mts                                                    |     3 +
 docs/ai-model-playbook.md                                                   |    58 +
 eslint.config.mjs                                                           |    43 +-
 libs/i18n/README.md                                                         |     8 +
 libs/i18n/eslint.config.mjs                                                 |     8 +
 libs/i18n/package.json                                                      |    22 +
 libs/i18n/src/he.json                                                       |    25 +
 libs/i18n/src/he.spec.ts                                                    |    34 +
 libs/i18n/src/i18n.ts                                                       |    31 +
 libs/i18n/src/index.ts                                                      |     1 +
 libs/i18n/tsconfig.json                                                     |    13 +
 libs/i18n/tsconfig.lib.json                                                 |    30 +
 libs/i18n/tsconfig.spec.json                                                |    37 +
 libs/i18n/vitest.config.mts                                                 |    18 +
 libs/ui-components/README.md                                                |     7 +-
 libs/ui-components/components.json                                          |    25 +
 libs/ui-components/package.json                                             |     9 +-
 libs/ui-components/src/components/board.spec.tsx                            |    17 +
 libs/ui-components/src/components/board.tsx                                 |    26 +
 libs/ui-components/src/components/theme-toggle.spec.tsx                     |    37 +
 libs/ui-components/src/components/theme-toggle.tsx                          |    35 +
 libs/ui-components/src/components/top-bar.spec.tsx                          |    22 +
 libs/ui-components/src/components/top-bar.tsx                               |    41 +
 libs/ui-components/src/components/ui/button.spec.tsx                        |    28 +
 libs/ui-components/src/components/ui/button.tsx                             |    63 +
 libs/ui-components/src/components/ui/direction.tsx                          |    20 +
 libs/ui-components/src/index.ts                                             |    12 +-
 libs/ui-components/src/lib/utils.ts                                         |    27 +
 libs/ui-components/src/styles/theme-contrast.spec.ts                        |    67 +
 libs/ui-components/src/styles/theme.css                                     |   162 +
 libs/ui-components/tsconfig.lib.json                                        |     3 +-
 libs/ui-components/tsconfig.spec.json                                       |     3 +-
 package-lock.json                                                           | 17183 +++++++++++++++++++++++-----------
 package.json                                                                |    14 +-
 tools/lint-checks/package.json                                              |     1 +
 tools/lint-checks/src/eslint-rules.spec.ts                                  |    48 +
 tools/lint-checks/src/react-compiler.spec.ts                                |     6 +-
 tools/lint-checks/src/tailwind.spec.ts                                      |    26 +
 tsconfig.json                                                               |     3 +
 63 files changed, 13436 insertions(+), 5855 deletions(-)
```

## Diff

`package-lock.json` omitted (adds packages only).

```diff
diff --git a/.gitignore b/.gitignore
index 16f1f81..23baddd 100644
--- a/.gitignore
+++ b/.gitignore
@@ -79,3 +79,6 @@ vitest.config.*.timestamp*

 # Vitest coverage output
 test-output
+
+# Local dev-server config for the Claude desktop preview
+.claude/launch.json
diff --git a/CLAUDE.md b/CLAUDE.md
index 64e4bee..fc6aebf 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -12,6 +12,11 @@
 - No hardcoded values: all UI styling must use design tokens defined via the Tailwind CSS and shadcn/ui configuration (semantic colors like `bg-primary`, the spacing scale, typography tokens). No raw hex/rgb colors, arbitrary pixel values, or inline style values.
 - Single source of truth: every shared component in `libs/ui-components` must consume these tokens so the theme can be adjusted in one place.

+# AI model selection
+
+- See `docs/ai-model-playbook.md`. This project prefers Mode B (cost-effective).
+- Before starting each story, ask Adi which model and effort to use, with a recommendation.
+
 <!-- nx configuration start-->
 <!-- Leave the start & end comments to automatically receive updates. -->

diff --git a/_bmad-output/implementation-artifacts/deferred-work.md b/_bmad-output/implementation-artifacts/deferred-work.md
index 4bd0722..b1d1706 100644
--- a/_bmad-output/implementation-artifacts/deferred-work.md
+++ b/_bmad-output/implementation-artifacts/deferred-work.md
@@ -26,9 +26,19 @@
 - source_spec: `_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md`
   summary: Declare `tailwindcss` explicitly (pinned) in `package.json` when Story 1.4 installs Tailwind.
   evidence: It is present today only as an auto-installed peer of `eslint-plugin-better-tailwindcss` (4.3.3 in the lockfile); lint resolves it through hoisting.
+  resolved: Story 1.4 — `tailwindcss` 4.3.3 and `@tailwindcss/vite` 4.3.3 are pinned in the root `package.json`.
 - source_spec: `_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md`
   summary: Decide how shadcn primitives that ship arbitrary values (e.g. `size-[1.15rem]`, `rounded-[4px]`, `max-h-(--radix-…)`) meet the arbitrary-value ban.
   evidence: Arbitrary variants (`data-[state=open]:`) are allowed, but arbitrary values in generated shadcn components will fail lint in Stories 1.4/1.5; options are token replacements or a scoped exception, which is Adi's call.
+  resolved: Story 1.4 (Adi, 2026-10-26) — arbitrary values in copied shadcn files are replaced with token utilities; the lint ban stays unscoped. Button is the first file done this way; 1.5 follows the same rule.
 - source_spec: `_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md`
   summary: Decide library list loading in Story 1.9 — (a) native `loading="lazy"` images only, (b) plus client-side load-more on scroll via IntersectionObserver, (c) TanStack Virtual; first visible row eager.
   evidence: Adi raised infinite scroll on 2026-10-26; API stays unpaginated (AD-26), so any windowing is client-only. Discuss when 1.9 starts.
+- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-theme-rtl-and-app-shell.md`
+  summary: Cover the real app bootstrap (i18n init, DirectionProvider, ThemeProvider in `main.tsx`) with a test, e.g. by extracting a shared `AppProviders` used by `main.tsx` and the specs.
+  evidence: Specs build their own provider tree and `test-setup.ts` inits i18n globally, so removing `initI18n()` or `ThemeProvider` from `main.tsx` keeps every check green; structure is Adi's call.
+  resolved: Adi (2026-10-26) — scheduled into Story 1.5 as an AC (shared `AppProviders`).
+- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-theme-rtl-and-app-shell.md`
+  summary: Decide how input/control boundaries meet WCAG 1.4.11 (3:1) before Input ships in 1.5 — the DESIGN.md `--border`/`--input` tokens are ~1.25:1 (light) and ~1.46:1 (dark) on the background.
+  evidence: Measured from theme.css; DESIGN.md colours are fixed by the 1.4 spec, so changing them (or using a stronger focus/border treatment for inputs) is a design decision.
+  resolved: Adi (2026-10-26) — scheduled into Story 1.5 as an AC (stronger `--input` border token, contrast-tested, Storybook preview for approval).
diff --git a/_bmad-output/implementation-artifacts/spec-1-4-theme-rtl-and-app-shell.md b/_bmad-output/implementation-artifacts/spec-1-4-theme-rtl-and-app-shell.md
new file mode 100644
index 0000000..905093d
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-1-4-theme-rtl-and-app-shell.md
@@ -0,0 +1,151 @@
+---
+title: 'Story 1.4: Theme, RTL and app shell'
+type: 'feature'
+created: '2026-10-26'
+status: 'done'
+route: 'dispatch'
+review_loop_iteration: 0
+baseline_commit: 'cdb832a180f971303daf09e7481e520822e86919'
+context:
+  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
+  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-recipes-2026-10-26/DESIGN.md'
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** `apps/web` is an unstyled English placeholder (`<html lang="en">`, no Tailwind, no theme, no i18n), so no later screen has the ביס & סיר look, RTL behaviour or copy pipeline to build on.
+
+**Approach:** Install Tailwind 4 and shadcn (Radix base, `--rtl`) into `libs/ui-components` with the DESIGN.md tokens as the single theme; add Rubik, i18next with `he.json`, a theme context (system/light/dark, remembered), and a shell layout (top bar with wordmark + theme toggle, not-found route, focus/title on navigation).
+
+## Boundaries & Constraints
+
+**Always:**
+
+- `<html lang="he" dir="rtl">`; DirectionProvider `rtl` at the root; logical utilities only.
+- Every DESIGN.md colour is a CSS variable in `:root` and `.dark`, registered as Tailwind colours (`bg-board`, `text-hint`, `border-flag`…); radii `sm 8 / md 12 / lg 16 / board 24 / full`; typography roles as Tailwind text tokens. Same colours as DESIGN.md.
+- `libs/ui-components` stays presentational: no i18next, no router, no storage. Strings and links come in as props/children; the app owns ThemeProvider (AD-8) and i18n.
+- Buttons are pills (`rounded-full`), touch targets ≥ 44px (DESIGN.md).
+- No Hebrew string literals in TS/TSX outside `he.json` (specs exempt), enforced by lint.
+- Exact pinned versions for new packages; `tailwindcss` declared explicitly (deferred from 1.3).
+- Copy follows EXPERIENCE.md Voice and Tone; product name "ביס & סיר".
+
+**Never:**
+
+- No other shadcn primitives (1.5), no feature libs (1.9), no account/login UI (Epic 2).
+- No changes to the ESLint arbitrary-value or physical-direction bans themselves.
+
+## I/O & Edge-Case Matrix
+
+| Scenario        | Input / State                | Expected Output / Behavior                                                    | Error Handling                  |
+| --------------- | ---------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
+| First visit     | no stored theme, OS dark     | `.dark` on `<html>` before first paint; toggle shows "system"                 | N/A                             |
+| Cycle           | click toggle ×3              | system → light → dark → system; stored value follows; `system` clears storage | N/A                             |
+| System change   | mode system, OS flips        | theme follows live                                                            | N/A                             |
+| Storage blocked | `localStorage` throws        | theme still works for the session                                             | caught, ignored                 |
+| Unknown route   | `/nope`                      | top bar + h1 "הדף לא נמצא" + link "חזרה לרשימה" to `/`; title updated         | N/A                             |
+| Navigation      | `/nope` → link → `/`         | focus on the new page `h1`; `document.title` changes                          | first load does not steal focus |
+| Thrown error    | loader throws                | root error element in Hebrew                                                  | N/A                             |
+| Hebrew literal  | `<p>שלום</p>` in a component | lint fails                                                                    | N/A                             |
+
+## Decisions (Adi, 2026-10-26: "all your recommendations")
+
+1. shadcn arbitrary values are replaced with token utilities in our copied files; the lint ban stays unscoped.
+2. `he.json`, the i18next init and typed keys live in a new lib `libs/i18n` (tag `type:i18n`, depends on nothing; `type:app` and `type:feature` may import it; `type:ui` may not).
+3. Rubik is self-hosted from `@fontsource/rubik` (400/600/800).
+4. Icons come from `lucide-react`.
+5. Spec kept whole (~2,300 tokens, one goal). New packages stay pinned exactly in `package.json`; CI installs from the lock files.
+
+</frozen-after-approval>
+
+## Code Map
+
+- `apps/web/index.html` -- `lang="en"`, title "Web"; set `lang="he" dir="rtl"`, title "ביס & סיר", tiny inline script adding `.dark` before paint (reads the same storage key as ThemeProvider).
+- `apps/web/src/main.tsx` -- add providers: i18n init, DirectionProvider, ThemeProvider around `RouterProvider`.
+- `apps/web/src/app/router.tsx` -- root route gets `Component: AppLayout`; children: lazy home, `path: '*'` NotFound (inside the layout, so the top bar stays); keep `errorElement`, `HydrateFallback`.
+- `apps/web/src/app/route-error.tsx`, `placeholder-home.tsx` -- English copy → `t()` keys; home `h1` "מתכונים" placeholder until 1.9.
+- `apps/web/src/app/router.spec.tsx` -- update assertions to Hebrew; render through providers.
+- `apps/web/src/styles.css` -- empty; becomes `@import` of the ui-components theme + `@source` for libs.
+- `apps/web/vite.config.mts` -- add `@tailwindcss/vite` before `react()`.
+- `libs/i18n/` (new) -- see Decisions 2.
+- `libs/ui-components/` -- add `components.json` (style radix-nova, rtl true, css → `src/styles/theme.css`), `src/lib/utils.ts` (`cn` = clsx + `extendTailwindMerge` knowing our text/radius tokens, else `text-title` would be dropped against `text-foreground`), `src/components/ui/button.tsx`, `direction.tsx`, plus `TopBar`, `ThemeToggle`, `Board`; export all from `src/index.ts` and `./theme.css` via `package.json` `exports`.
+- `eslint.config.mjs` -- extend the existing `no-restricted-syntax` list (see its comment) with a Hebrew-literal selector; `*.spec.tsx` exempt.
+- `tools/lint-checks/src/eslint-rules.spec.ts` -- add fixtures for the Hebrew rule (fail + spec-file pass).
+- `package.json` -- add (pinned): `tailwindcss` 4.3.3, `@tailwindcss/vite` 4.3.3, `tw-animate-css`, `radix-ui` 1.8.1, `class-variance-authority`, `clsx`, `tailwind-merge`, `i18next`, `react-i18next`, `@fontsource/rubik`, `lucide-react`.
+
+## Tasks & Acceptance
+
+**Execution:**
+
+- [x] `package.json` -- install pinned deps.
+- [x] `libs/ui-components` -- shadcn init/add (button, direction) with `--rtl`; theme CSS from DESIGN.md (hex values, `:root`/`.dark`, `@theme inline` colours, radii, text roles, Rubik); Button adapted to pills/44px with arbitrary values replaced by tokens; TopBar (wordmark + actions slots), ThemeToggle (`value`, `onChange`, labels as props; sun/moon/monitor icon), Board (slab, slot pill `w-11 h-3`, `p-4.5 pt-9`, `rounded-board`).
+- [x] `libs/ui-components/src/**/*.spec.tsx` -- Button, ThemeToggle cycle/labels, TopBar, Board render; `theme-contrast.spec.ts` parses the theme CSS and asserts ≥ 4.5:1 for every text/background pair in both themes (fg/bg, card, popover, primary, secondary, muted-fg on bg/muted, accent, destructive, board-fg/board, hint/board, hint-muted/card, flag/bg) and ≥ 3:1 for ring on bg.
+- [x] `libs/i18n` -- `nx g @nx/js:library` (bundler none, vitest), tag `type:i18n`; `he.json`, i18next init (`lng: 'he'`), `CustomTypeOptions` typed keys; depConstraints: app/feature may depend on `type:i18n`, which depends on nothing; record in ARCHITECTURE-SPINE (AD-2/AD-33) and memlog.
+- [x] `apps/web/src/app/` -- ThemeProvider + `useTheme` (storage key, matchMedia), AppLayout (TopBar, `<Outlet/>`, focus h1 on location change after first load), NotFound page; pages render React 19 `<title>`.
+- [x] `apps/web/src/**/*.spec.tsx` -- every I/O row except the lint one.
+- [x] `eslint.config.mjs` + `tools/lint-checks` -- Hebrew-literal rule and fixtures.
+- [x] `ui-component-inventory.md` -- note Direction added in 1.4; `deferred-work.md` -- mark tailwindcss and arbitrary-value items resolved.
+
+**Acceptance Criteria:**
+
+- Given the repo, when `npx nx run-many -t lint typecheck test build` runs, then all projects pass and `nx format:check` is clean.
+- Given `npm run dev`, when `/` and `/nope` open at 375px and desktop in both themes, then RTL layout, Rubik, tokens and the top bar render with no console errors.
+- Given `libs/ui-components/components.json`, then it points at `libs/ui-components` paths with `rtl: true`.
+
+## Implementation Notes
+
+- PAUSED (usage limit), 2026-10-26. Done so far: pinned deps installed (`shadcn` 4.22.1 as devDep for the CLI and `shadcn/tailwind.css`; lockfile only adds packages, no version changes); `libs/i18n` generated (placeholder files removed, nothing written yet); `libs/ui-components`: `components.json` (radix-nova, rtl, aliases via package.json subpath `imports` `#lib/*`, `#components/*`), `src/lib/utils.ts` (clsx + extendTailwindMerge), tokenised `button.tsx` (pill, h-11/size-11, xs sizes dropped), `direction.tsx`, `theme-toggle.tsx`, `top-bar.tsx` (TopBar + Wordmark), `board.tsx`, `styles/theme.css` (DESIGN tokens, radii, text roles, containers, Rubik), specs incl. `theme-contrast.spec.ts`. Tests ran; `ui-components:lint` and `:typecheck` FAIL, not yet diagnosed.
+- RESUMED 2026-10-26, implementation complete (not yet reviewed, no review file). Lint failures were `#lib/*`/`#components/*` self-imports (Nx wants relative imports inside a project); source now uses relative imports and `components.json` keeps the `#` aliases for the CLI, so `shadcn add` output needs its imports rewritten (noted in the ui-components README). Typecheck failures were a missing `dom` lib in the ui-components tsconfigs. `react-compiler.spec.ts` now checks for the compiler runtime import instead of the memo sentinel (the translated placeholder has no static JSX left). Full `run-many -t lint typecheck test build` green, `format:check` clean; manual check at 375px light/dark and 1280px dark (JS-inspected, pane hidden so no desktop screenshot).
+- Previously left: fix those failures; `libs/i18n` (he.json, init, typed keys, voice/tone test) + depConstraints (`type:i18n`; ban i18next/react-i18next in `type:ui`) + spine/memlog; Hebrew-literal lint rule + lint-checks fixtures; apps/web (index.html, Tailwind vite plugin, styles.css, providers, ThemeProvider, AppLayout, NotFound, specs); inventory/deferred-work updates; full verification, review, review file.
+
+## Spec Change Log
+
+## Review Triage Log
+
+Layers: blind-hunter, edge-case-hunter, verification-gap (all ran). Iteration 0.
+
+| #   | Finding                                                                            | Verdict | Evidence                                                                                                            | Route                           |
+| --- | ---------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
+| 1   | Focus ring rendered at `/50` alpha; contrast test checks opaque ring (blind, edge) | medium  | Blended dark ring on bg 2.93:1, on card 2.82:1 (light 3.21/3.27); spec asks ≥ 3:1                                   | patch                           |
+| 2   | Button `sm`/`icon-sm` are 36px (edge)                                              | medium  | `h-9`/`size-9` contradict "touch targets ≥ 44px"                                                                    | patch                           |
+| 3   | `cn` doesn't merge `max-w-library`/`max-w-detail` (edge)                           | low     | tailwind-merge extend lacks `container`; one-line fix                                                               | patch                           |
+| 4   | Hebrew exemption only `*.spec.ts(x)` (blind, edge)                                 | low     | vitest include also runs `*.test.*`; glob widening is a direct correction                                           | patch                           |
+| 5   | `vi.restoreAllMocks()` inline in pre-paint test (blind, edge, verification)        | low     | failing assertion leaks throwing `getItem` mock                                                                     | patch                           |
+| 6   | Button className-override test relies on trailing space (blind)                    | low     | `not.toContain('bg-primary ')` passes if class is last                                                              | patch                           |
+| 7   | Dropping `tailwindcss()` leaves every check green (verification gap)               | medium  | no test runs the Tailwind pipeline on `styles.css`                                                                  | patch                           |
+| 8   | `main.tsx` provider wiring untested (verification gap)                             | medium  | specs build their own provider tree; fix needs a shared `AppProviders` (structure = Adi's call)                     | defer                           |
+| 9   | Border/input tokens ~1.25:1 (light) vs 3:1 non-text contrast (blind)               | medium  | DESIGN.md colours are frozen ("same colours as DESIGN.md"); Input lands in 1.5                                      | defer                           |
+| 10  | Spec bookkeeping (change log empty, stale notes, sprint status) (blind)            | low     | fix edits this spec; sprint-status synced at present step                                                           | reject                          |
+| 11  | AC2 desktop light + screenshots missing (blind)                                    | low     | orchestrator captured 375 light, 1280 dark; remaining views captured for the review file                            | reject (verification, not code) |
+| 12  | Playbook/CLAUDE.md and Prettier table churn in the diff (blind)                    | false   | playbook/CLAUDE.md included at Adi's request; table changes are whitespace-only formatting forced by `format:check` | reject                          |
+| 13  | Spine stack table lacks exact pins (blind)                                         | low     | exact pins live in `package.json`; spine records majors                                                             | reject                          |
+| 14  | AD-10 / AD-8 references inconsistent (blind)                                       | false   | spine: AD-8 = client state ownership, AD-10 = Hebrew RTL and i18n — both cited correctly                            | reject                          |
+| 15  | Root error element replaces shell, no back link (blind)                            | low     | matches matrix row "root error element in Hebrew"; errors are rare and body says to refresh                         | reject                          |
+| 16  | Hebrew presentation forms U+FB1D–FB4F not matched (blind, edge)                    | low     | not typed in practice                                                                                               | reject                          |
+| 17  | ThemeToggle label states mode, not action; spec label text differs (blind)         | low     | matrix: "toggle shows system"; wording is a copy question for Adi                                                   | reject (raised to Adi)          |
+| 18  | No cross-tab theme sync (blind, edge)                                              | low     | not in matrix; fix adds a listener                                                                                  | reject                          |
+| 19  | `#hooks/*` import map unused; app `@source` scans specs (blind)                    | low     | CLI alias kept for future hooks; a few extra classes in CSS                                                         | reject                          |
+| 20  | No skip link (blind)                                                               | low     | two focusables in top bar today; adds new UI                                                                        | reject                          |
+| 21  | Focus lost if new page has no h1 yet (edge)                                        | false   | data router commits after lazy resolves; navigation spec passes with the lazy home                                  | reject                          |
+| 22  | Same-page navigation re-focuses h1 (edge)                                          | low     | wordmark click on `/` moves focus to h1; harmless                                                                   | reject                          |
+| 23  | Rules don't cover `.mts/.mjs` sources (edge)                                       | low     | app code is ts/tsx only                                                                                             | reject                          |
+| 24  | i18n init failure swallowed (edge)                                                 | false   | bundled resources + `initAsync: false`; init cannot reject                                                          | reject                          |
+| 25  | ThemeToggle props `onValueChange`/`label` vs spec `onChange`/labels (edge)         | low     | only caller is AppLayout; Radix naming                                                                              | reject                          |
+
+## Design Notes
+
+- Theme state: `'system' | 'light' | 'dark'`; storage key `theme`; `system` removes the key. Effective theme toggles `.dark` on `document.documentElement` and `color-scheme`.
+- `document.title`: each page renders `<title>` (React 19 hoists it), e.g. `הדף לא נמצא · ביס & סיר`; home is just `ביס & סיר`. Dynamic titles in 1.10 work the same way.
+- Typography tokens: `text-display`, `text-display-lg`, `text-title`, `text-heading`, `text-body`, `text-quantity` (+ `tabular-nums`), `text-label`, `text-annotation` (DESIGN "hint" type; renamed so it does not clash with the `hint` colour).
+
+## Verification
+
+**Commands:**
+
+- `npx nx run-many -t lint typecheck test build --skip-nx-cache` -- expected: all green
+- `npx nx format:check` -- expected: clean
+
+**Manual checks:**
+
+- `npm run dev`; Browser pane at 375px and desktop, light/dark: `/`, `/nope`, toggle cycle, reload keeps choice; screenshots attached to the review file.
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index 46c4afa..a8e40dc 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -29,7 +29,7 @@
 # - Dev moves story to 'review', then runs code-review (fresh context, different LLM recommended)
 # - Retrospective appends its action items to action_items; the status view surfaces open ones
 generated: 10-26-2026 13:09
-last_updated: 10-26-2026 15:05
+last_updated: 10-26-2026 20:45
 project: recipes
 project_key: NOKEY
 tracking_system: file-system
@@ -39,7 +39,7 @@ development_status:
   1-1-adapt-the-backend-scaffold: done
   1-2-adapt-the-frontend-scaffold-and-shared-libs: done
   1-3-ci-and-quality-gates: done
-  1-4-theme-rtl-and-app-shell: backlog
+  1-4-theme-rtl-and-app-shell: review
   1-5-ui-kit-shadcn-primitives-in-ui-components: backlog
   1-6-recipe-data-model-and-read-api: backlog
   1-7-generated-api-client-pipeline: backlog
diff --git a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md
index 44cc0b3..6e858b4 100644
--- a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md
+++ b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/.memlog.md
@@ -6,7 +6,7 @@ updated: 2026-10-26T11:23
 ---

 - (constraint) Inputs: PRD final (amended 2026-10-26: photos, FR-21 translate, NFR-4 mobile-first, NFR-12 RTL) + addendum; UX DESIGN.md/EXPERIENCE.md final (direction B, shadcn tokens, RTL).
-- (constraint) Existing scaffold [ADOPTED]: Nx 24 integrated (npm workspaces apps/*, libs/*), apps/web React 19 + Vite 8 + Vitest 5 + TS 6 + react-router-dom 6.30, apps/recipe-service FastAPI via @nxlv/python + uv, Python 3.12, deps alembic, sqlmodel, pydantic 2, uvicorn; ruff + pytest; GitHub Actions CI with Nx Cloud running lint test build typecheck e2e.
+- (constraint) Existing scaffold [ADOPTED]: Nx 24 integrated (npm workspaces `apps/*`, `libs/*`), apps/web React 19 + Vite 8 + Vitest 5 + TS 6 + react-router-dom 6.30, apps/recipe-service FastAPI via @nxlv/python + uv, Python 3.12, deps alembic, sqlmodel, pydantic 2, uvicorn; ruff + pytest; GitHub Actions CI with Nx Cloud running lint test build typecheck e2e.
 - (constraint) CLAUDE.md: every architecture decision is Adi's; present options + recommendation. UI tokens only; shared components in libs/ui-components consume tokens.
 - (question) Tags (PRD OQ-6) reopened by Adi: replace fixed category with owner-managed tags (M:N, manage screen, AI suggests existing tags) vs keep category + tags. Pending Adi's A/B; data model must accommodate.
 - (decision) R1 (Adi accepted recommendations): AD backend = modular monolith by feature (recipes, tags, auth, imports, photos), each router->service->repository->models; FastAPI Depends as DI.
@@ -56,3 +56,5 @@ updated: 2026-10-26T11:23
 - (decision) 2026-10-26 (Adi, during Story 1.2 planning): frontend features move to Nx feature libs ('thin app, thick libs', option B). libs/feature-{recipes,auth,users,tags,import}, tag type:feature; app = shell only (router, providers, top bar). Matrix: app->feature/data-access/ui/domain, feature->data-access/ui/domain (feature-to-feature banned), ui->domain, data-access->none, domain->none. Pages are subpath exports of their feature lib for per-page lazy chunks. Each feature lib is created by the first story that needs it. Updated Design Paradigm, AD-2, AD-11, AD-33, conventions, structural seed, capability map.
 - (decision) 2026-10-26 Story 1.2: libs are non-buildable and consumed from source (1a); bannedExternalImports guard type:domain and type:ui (2a). Confirmed by Adi ("go with your recommendation"; 2a confirmed explicitly).
 - (decision) 2026-10-26 (Adi): UI component inventory approved (`_bmad-output/planning-artifacts/ui-component-inventory.md`). Story 1.4 initializes shadcn in libs/ui-components with Button; new Story 1.5 "UI kit" adds the Epic 1-2 primitives (Input, Label, Skeleton, ToggleGroup, DropdownMenu, Sonner, Dialog, AlertDialog, Select, Table); later primitives are added just in time by the story listed. Former stories 1.5-1.10 renumbered to 1.6-1.11.
+- (decision) 2026-10-26 Story 1.4 (Adi, "all your recommendations"): new lib `libs/i18n` (tag `type:i18n`) holds `he.json`, the i18next init and typed keys; depends on nothing; `type:app` and `type:feature` may import it, `type:ui` may not (i18next/react-i18next banned there). Hebrew literals outside `he.json` fail lint (specs exempt). shadcn arbitrary values are replaced with token utilities (ban stays unscoped); Rubik self-hosted from `@fontsource/rubik`; icons from `lucide-react`. Updated AD-2 and AD-33.
+- (decision) 2026-10-26 (Adi approved Storybook): Storybook 10.x on libs/ui-components via @nx/storybook (React + Vite builder); preview loads the theme CSS, global RTL decorator (dir=rtl + DirectionProvider), light/dark toolbar toggle, addon-a11y; one story per primitive/shared component; build-storybook in CI via nx affected (Story 1.5). Built Storybook published (e.g. GitHub Pages) and linked from the README (Story 6.5). Updated Testing rule and Stack.
diff --git a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
index 97d5e93..4cf088e 100644
--- a/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
+++ b/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md
@@ -59,6 +59,7 @@ flowchart LR
   - `apps/web` holds only the shell (router, providers, app-wide layout). It lazy-loads pages from feature libs and may also import `libs/data-access` (the query client provider and the 401 handler), `libs/ui-components` (the shell's own UI) and `libs/recipe-domain`.
   - A feature lib may import `data-access`, `ui-components` and `recipe-domain`, but never another feature lib.
   - `libs/ui-components` imports neither the API nor any global state: props in, callbacks out, design tokens only (DESIGN.md).
+  - `libs/i18n` holds `he.json`, the i18next init and the typed keys. The app and feature libs may import it; it imports no workspace project. `libs/ui-components` may not import it or i18next: strings come in as props (Story 1.4).
   - Every server call goes through `libs/data-access`.
   - Nx module-boundary tags enforce this.

@@ -184,7 +185,7 @@ flowchart LR
 - **Prevents:** flaky shared-state tests, CI calling paid or slow models, and untested business rules.
 - **Rule:**
   - **Backend:** pytest with FastAPI `TestClient` against a fresh temporary SQLite database per test. There are API tests for every endpoint. Unit tests for `recipes.service` give 100% branch coverage on the original-value rules.
-  - **Frontend:** Vitest unit tests (scaling and rounding at 100% branch coverage). React Testing Library and MSW component tests (the recipe form). Playwright e2e for three flows: scale a recipe, edit with the original hint and reset, import with the `fake` provider.
+  - **Frontend:** Vitest unit tests (scaling and rounding at 100% branch coverage). React Testing Library and MSW component tests (the recipe form). Playwright e2e for three flows: scale a recipe, edit with the original hint and reset, import with the `fake` provider. Storybook on `libs/ui-components` documents every shared component in RTL and both themes, with the a11y addon; `build-storybook` runs in CI (Story 1.5).
   - Tests and CI always use `LLM_PROVIDER=fake`.

 ### AD-17 — CI on plain GitHub Actions [ADOPTED]
@@ -359,12 +360,14 @@ flowchart LR
 - **Rule:**
   - **Python:** mypy (strict, with the pydantic plugin) is the `recipe-service:typecheck` target. import-linter contracts for AD-1 and AD-25 run in `lint`.
   - **Rate limit:** slowapi limits login attempts (in memory, which is fine for one container).
-  - **Frontend boundaries:** Nx tags `type:app`, `type:feature`, `type:data-access`, `type:ui` and `type:domain` carry these dependency constraints:
-    - app → feature, data-access, ui, domain
-    - feature → data-access, ui, domain (never another feature)
-    - ui → domain
+  - **Frontend boundaries:** Nx tags `type:app`, `type:feature`, `type:data-access`, `type:ui`, `type:domain` and `type:i18n` carry these dependency constraints:
+    - app → feature, data-access, ui, domain, i18n
+    - feature → data-access, ui, domain, i18n (never another feature)
+    - ui → domain (i18next and react-i18next banned)
     - data-access → nothing
     - domain → nothing
+    - i18n → nothing
+  - **Copy:** ESLint bans Hebrew string literals and JSX text outside `he.json`; spec files are exempt.
   - **Styling:** ESLint rules ban physical-direction utilities, arbitrary Tailwind values, hex/rgb literals outside the theme, and the `style` prop in `libs/ui-components`. They also cover jsx-a11y and the React hooks rules version the compiler needs.
   - **Bundle size:** size-limit checks the initial JS (≤ 200 KB gzip) as `web:size` in CI.
   - **Recipe pages:** recipe-scrapers (JSON-LD) and trafilatura (readable text) parse imported pages.
@@ -381,43 +384,44 @@ flowchart LR

 ## Consistency Conventions

-| Concern | Convention |
-| --- | --- |
-| API paths | `/api/<plural-noun>`, kebab-case. JSON fields are snake_case on the wire, and the generated client uses them as-is. |
-| Timestamps | UTC ISO-8601 (`created_at`, `updated_at`) |
-| Errors | 422 validation; 400 bad input or credentials; 401 no session on a protected call; 403 CSRF or insufficient role; 404 missing; 409 conflict (duplicate tag rename, meal type in use); 413 upload too large; 429 rate limit or import cap; 502/504 provider failure or timeout. Body shape per AD-28 |
-| Python naming | modules `snake_case`; schemas `RecipeCreate / RecipeRead / RecipeUpdate` |
-| TS naming | components `PascalCase.tsx`; hooks `useX`; route modules `libs/feature-<name>/src/routes/<page>.tsx` |
-| Config | env vars only, read once in `app/core/config` (pydantic-settings); no secrets in the repo |
-| Styling | design tokens only (CLAUDE.md, NFR-7) |
+| Concern       | Convention                                                                                                                                                                                                                                                                                         |
+| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| API paths     | `/api/<plural-noun>`, kebab-case. JSON fields are snake_case on the wire, and the generated client uses them as-is.                                                                                                                                                                                |
+| Timestamps    | UTC ISO-8601 (`created_at`, `updated_at`)                                                                                                                                                                                                                                                          |
+| Errors        | 422 validation; 400 bad input or credentials; 401 no session on a protected call; 403 CSRF or insufficient role; 404 missing; 409 conflict (duplicate tag rename, meal type in use); 413 upload too large; 429 rate limit or import cap; 502/504 provider failure or timeout. Body shape per AD-28 |
+| Python naming | modules `snake_case`; schemas `RecipeCreate / RecipeRead / RecipeUpdate`                                                                                                                                                                                                                           |
+| TS naming     | components `PascalCase.tsx`; hooks `useX`; route modules `libs/feature-<name>/src/routes/<page>.tsx`                                                                                                                                                                                               |
+| Config        | env vars only, read once in `app/core/config` (pydantic-settings); no secrets in the repo                                                                                                                                                                                                          |
+| Styling       | design tokens only (CLAUDE.md, NFR-7)                                                                                                                                                                                                                                                              |

 ## Stack

-| Name | Version |
-| --- | --- |
-| Nx | 24.0.0 [ADOPTED] |
-| React / React DOM | 19.x [ADOPTED] |
-| Vite | 8.x [ADOPTED] |
-| TypeScript | ~6.0 [ADOPTED] |
-| Vitest | ~5.0 [ADOPTED] |
-| Python | 3.13 (moved from 3.12 at scaffold) |
-| FastAPI | ≥0.162 [ADOPTED] |
-| SQLModel / Pydantic | ≥0.0.48 / 2.x [ADOPTED] |
-| Alembic | ≥1.20 [ADOPTED] |
-| SQLite | embedded [ADOPTED] |
-| React Router | 8.x (released 2026-06; replaces EOL 6.30) |
-| @tanstack/react-query | 5.x |
-| @hey-api/openapi-ts | 0.99.x (pre-1.0: pin exact) |
-| Zod | 4.x |
-| React Hook Form, i18next / react-i18next, Playwright, MSW | current stable, pinned at scaffold |
-| Tailwind CSS / shadcn/ui | 4.x / current CLI (RTL logical classes) |
-| pwdlib[argon2], PyJWT, httpx, Pillow | current stable, pinned at scaffold |
-| ollama (Python) / Ollama app | 0.6.x / current |
-| google-genai SDK | 2.x; Flash model name in config (`GEMINI_MODEL`, e.g. `gemini-3.8-flash`) |
-| PyJWT | ≥2.13 |
-| mypy, import-linter, slowapi, recipe-scrapers, trafilatura | current stable, pinned at scaffold |
-| size-limit, babel-plugin-react-compiler, eslint-plugin-react-hooks | current stable (hooks ≥7 for compiler rules) |
-| MSW | 3.x |
+| Name                                                               | Version                                                                   |
+| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
+| Nx                                                                 | 24.0.0 [ADOPTED]                                                          |
+| React / React DOM                                                  | 19.x [ADOPTED]                                                            |
+| Vite                                                               | 8.x [ADOPTED]                                                             |
+| TypeScript                                                         | ~6.0 [ADOPTED]                                                            |
+| Vitest                                                             | ~5.0 [ADOPTED]                                                            |
+| Python                                                             | 3.13 (moved from 3.12 at scaffold)                                        |
+| FastAPI                                                            | ≥0.162 [ADOPTED]                                                          |
+| SQLModel / Pydantic                                                | ≥0.0.48 / 2.x [ADOPTED]                                                   |
+| Alembic                                                            | ≥1.20 [ADOPTED]                                                           |
+| SQLite                                                             | embedded [ADOPTED]                                                        |
+| React Router                                                       | 8.x (released 2026-06; replaces EOL 6.30)                                 |
+| @tanstack/react-query                                              | 5.x                                                                       |
+| @hey-api/openapi-ts                                                | 0.99.x (pre-1.0: pin exact)                                               |
+| Zod                                                                | 4.x                                                                       |
+| React Hook Form, i18next / react-i18next, Playwright, MSW          | current stable, pinned at scaffold                                        |
+| Tailwind CSS / shadcn/ui                                           | 4.x / current CLI (RTL logical classes)                                   |
+| pwdlib[argon2], PyJWT, httpx, Pillow                               | current stable, pinned at scaffold                                        |
+| ollama (Python) / Ollama app                                       | 0.6.x / current                                                           |
+| google-genai SDK                                                   | 2.x; Flash model name in config (`GEMINI_MODEL`, e.g. `gemini-3.8-flash`) |
+| PyJWT                                                              | ≥2.13                                                                     |
+| mypy, import-linter, slowapi, recipe-scrapers, trafilatura         | current stable, pinned at scaffold                                        |
+| size-limit, babel-plugin-react-compiler, eslint-plugin-react-hooks | current stable (hooks ≥7 for compiler rules)                              |
+| MSW                                                                | 3.x                                                                       |
+| Storybook (`@nx/storybook`, React + Vite, addon-a11y)              | 10.x (10.6.4 latest on npm, 2026-10-26; pin exact at Story 1.5)           |

 ## Structural Seed

@@ -450,19 +454,19 @@ libs/

 ## Capability → Architecture Map

-| Capability | Lives in | Governed by |
-| --- | --- | --- |
-| F1 library, search, filters | libs/feature-recipes · recipes.router | AD-8, AD-7 |
-| F2–F5 recipe CRUD | recipes module · libs/feature-recipes | AD-1, AD-4, AD-9 |
-| F4 original-value hints | recipes.service | AD-4 |
-| F6 scaling | libs/recipe-domain | AD-31, AD-32 |
-| F8 users, roles, login | auth + users modules · libs/feature-auth, libs/feature-users | AD-6, AD-21, AD-30 |
-| F9 AI import | imports module + providers · libs/feature-import | AD-12, AD-13 |
-| F10 meal types & tags | tags module · libs/feature-tags | AD-7 |
-| Photos | photos module | AD-14 |
-| NFR-6 one-command run | compose + nx dev target | AD-15, AD-18 |
-| NFR-1/2 quality, CI | all projects | AD-16, AD-17 |
-| NFR-12 RTL | web + ui-components | AD-10 |
+| Capability                  | Lives in                                                     | Governed by        |
+| --------------------------- | ------------------------------------------------------------ | ------------------ |
+| F1 library, search, filters | libs/feature-recipes · recipes.router                        | AD-8, AD-7         |
+| F2–F5 recipe CRUD           | recipes module · libs/feature-recipes                        | AD-1, AD-4, AD-9   |
+| F4 original-value hints     | recipes.service                                              | AD-4               |
+| F6 scaling                  | libs/recipe-domain                                           | AD-31, AD-32       |
+| F8 users, roles, login      | auth + users modules · libs/feature-auth, libs/feature-users | AD-6, AD-21, AD-30 |
+| F9 AI import                | imports module + providers · libs/feature-import             | AD-12, AD-13       |
+| F10 meal types & tags       | tags module · libs/feature-tags                              | AD-7               |
+| Photos                      | photos module                                                | AD-14              |
+| NFR-6 one-command run       | compose + nx dev target                                      | AD-15, AD-18       |
+| NFR-1/2 quality, CI         | all projects                                                 | AD-16, AD-17       |
+| NFR-12 RTL                  | web + ui-components                                          | AD-10              |

 ## Open

diff --git a/_bmad-output/planning-artifacts/epics.md b/_bmad-output/planning-artifacts/epics.md
index 3c73597..125daee 100644
--- a/_bmad-output/planning-artifacts/epics.md
+++ b/_bmad-output/planning-artifacts/epics.md
@@ -122,62 +122,63 @@ UX-DR1: Implement the DESIGN.md theme as shadcn CSS variables. Light (`:root`) a
 UX-DR2: Typography. Rubik (400/600/800, Hebrew and Latin) is the only family. The type roles are display (40/56 lg), title 24, heading 18, body 16, quantity 20/800 with tabular figures, label 14/600 and hint 14/600. At most 5 visible sizes.
 UX-DR3: Theme toggle in the top bar: system, light, dark. The choice is remembered per browser, and `.dark` is applied on `<html>`.
 UX-DR4: App shell. One top bar with no sidebar:
-  - the wordmark "ביס & סיר", linking to the library
-  - for signed-in users, "מתכון חדש" and "ייבוא" (on phone, one "+" menu)
-  - the theme toggle
-  - "כניסה", or an account menu with "תגיות וסוגי ארוחה", "משתמשים" (admin only), "החשבון שלי" and "יציאה"
-UX-DR5: RTL foundation:
-  - `<html lang="he" dir="rtl">` and Radix `DirectionProvider`.
-  - Logical utilities only.
-  - Directional icons are mirrored.
-  - Each amount+unit pair is wrapped in `<bdi>`.
-  - `dir="auto"` on user content.
-  - The URL, email and password fields are `dir="ltr"`.
-UX-DR6: Board component. An oak slab with radius 24, padding 18 and 36 at the top for the handle slot (a 44×12 pill in the ground colour, centred 12 px from the top). It is used only for food surfaces.
-UX-DR7: RecipeCard. A board with the slot, a 4:3 photo (14 px corners, cover), then the title, meal type, up to 3 tags and total time. The whole card is the link. Without a photo, the title is larger and there is no placeholder. Hover scales up 2% and press scales down 2%, with no shadow.
-UX-DR8: Board-shaped photo on the detail page and in import review. Board radius with the handle slot cut through the image, 4:3 on phone and 16:9 on desktop. Imported photos show the credit "מקור: {domain}".
-UX-DR9: ServingsStepper. Round 44 px − and + buttons, typing allowed, clamped to 1–100 with a range message. "חזרה ל־{base}" appears only when the value differs from the base. A polite live region announces the servings.
-UX-DR10: IngredientLine. Shows the amount in the quantity role, the unit label (singular or plural), the name and the note. To-taste lines read "לפי הטעם". The hint "במקור …" sits under the line in `hint` colour, scaled, and linked with `aria-describedby`.
-UX-DR11: Library filters:
-  - a pill search field with clear (×), kept in `?q=`, focused with `/` on desktop
-  - a single-select meal-type chip row ("הכל" plus the meal types; horizontal scroll on phone)
-  - a "תגיות" button that opens a sheet (phone) or popover (desktop) of tag checkboxes, with the selected tags shown as removable chips
-  - all state kept in the URL
-UX-DR12: Recipe form:
-  - fields: title, description, meal type select, tag combobox (autocomplete, case-insensitive reuse, "יצירת תגית '{text}'"), servings, prep and cook time, source URL, photo (add, replace, remove, with an upload thumbnail and progress, limits shown beside the field)
-  - ingredient rows (amount as text accepting ½ and ⅓, unit select, name, note; stacked on phone, one row from `sm`) with add, remove and up/down reorder, and Enter in the last row adding a row
-  - hinted rows show "חזרה למקור"
-  - step rows
-  - errors on blur and submit, with focus moving to the first error
-  - an unsaved-changes guard
-UX-DR13: Import dialog. A dialog on desktop and a full page on phone, with tabs "קישור" and "הדבקת טקסט". An engine choice (local or Gemini) remembers the last pick. While running, it shows client-timed phase text, an indeterminate progress bar and Cancel. Errors switch to the paste tab or offer "לנסות שוב עם Gemini".
-UX-DR14: Import review. A banner in `flag` colour ("N שדות דורשים השלמה · המתכון תורגם מאנגלית"). Flagged fields get a 2 px `flag` border and the note "יש להשלים". Suggested tags are shown as chips. The photo panel offers "הסרה" and "החלפה".
-UX-DR15: Confirm dialogs (shadcn AlertDialog) for delete, unsaved changes and tag deletion. They name the object and its usage count, start focus on Cancel, and label the destructive action ("מחיקה").
-UX-DR16: Toasts, one at a time: saved, deleted, deleted-already (404), logged out.
-UX-DR17: States:
-  - skeleton cards (6) and a detail skeleton
-  - empty library for editors (with "מתכון חדש" and "ייבוא מקישור") and for visitors
-  - no results, with "ניקוי החיפוש"
-  - not found, with "חזרה לרשימה"
-  - session expired ("פג תוקף החיבור", returning to the same place, with form data kept)
-  - blocked user
-  - login errors, generic and rate-limited
-  - save failed (values kept)
-UX-DR18: Tags management screen at `/tags`: two lists (meal types, tags) with inline rename and add. Deletes are confirmed and show usage counts. A meal type in use can't be deleted.
-UX-DR19: Users screen at `/users` (admin): a list, add user (email, name, role, starting password), role change, block or unblock, and reset password. The controls on the last admin are disabled with a reason. `/account` lets a user change their own password.
-UX-DR20: Responsive layouts:
-  - library: 1 column below 640, 2 columns from `sm`, 3 from `lg`
-  - detail: one column on phone (photo, header, servings, board, steps); from `lg`, a 400 px sticky start column (servings and board) with the photo and steps beside it
-  - form: up to about 860 px wide
-  - import review: from `lg`, the photo panel sits beside the fields
-UX-DR21: Accessibility behaviours:
-  - focus moves to the `h1` and `document.title` updates on route change
-  - visible focus through `ring`
-  - touch targets at least 44 px
-  - reduced motion drops everything except opacity
-  - labelled fields, with errors linked through `aria-describedby`
-UX-DR22: Kitchen mode. The detail page requests a screen wake lock and ignores failure.
-UX-DR23: All UI copy follows the Voice and Tone rules: Hebrew, gender-neutral infinitives, no exclamation marks or emoji, and every string comes from `he.json`.
+
+- the wordmark "ביס & סיר", linking to the library
+- for signed-in users, "מתכון חדש" and "ייבוא" (on phone, one "+" menu)
+- the theme toggle
+- "כניסה", or an account menu with "תגיות וסוגי ארוחה", "משתמשים" (admin only), "החשבון שלי" and "יציאה"
+  UX-DR5: RTL foundation:
+- `<html lang="he" dir="rtl">` and Radix `DirectionProvider`.
+- Logical utilities only.
+- Directional icons are mirrored.
+- Each amount+unit pair is wrapped in `<bdi>`.
+- `dir="auto"` on user content.
+- The URL, email and password fields are `dir="ltr"`.
+  UX-DR6: Board component. An oak slab with radius 24, padding 18 and 36 at the top for the handle slot (a 44×12 pill in the ground colour, centred 12 px from the top). It is used only for food surfaces.
+  UX-DR7: RecipeCard. A board with the slot, a 4:3 photo (14 px corners, cover), then the title, meal type, up to 3 tags and total time. The whole card is the link. Without a photo, the title is larger and there is no placeholder. Hover scales up 2% and press scales down 2%, with no shadow.
+  UX-DR8: Board-shaped photo on the detail page and in import review. Board radius with the handle slot cut through the image, 4:3 on phone and 16:9 on desktop. Imported photos show the credit "מקור: {domain}".
+  UX-DR9: ServingsStepper. Round 44 px − and + buttons, typing allowed, clamped to 1–100 with a range message. "חזרה ל־{base}" appears only when the value differs from the base. A polite live region announces the servings.
+  UX-DR10: IngredientLine. Shows the amount in the quantity role, the unit label (singular or plural), the name and the note. To-taste lines read "לפי הטעם". The hint "במקור …" sits under the line in `hint` colour, scaled, and linked with `aria-describedby`.
+  UX-DR11: Library filters:
+- a pill search field with clear (×), kept in `?q=`, focused with `/` on desktop
+- a single-select meal-type chip row ("הכל" plus the meal types; horizontal scroll on phone)
+- a "תגיות" button that opens a sheet (phone) or popover (desktop) of tag checkboxes, with the selected tags shown as removable chips
+- all state kept in the URL
+  UX-DR12: Recipe form:
+- fields: title, description, meal type select, tag combobox (autocomplete, case-insensitive reuse, "יצירת תגית '{text}'"), servings, prep and cook time, source URL, photo (add, replace, remove, with an upload thumbnail and progress, limits shown beside the field)
+- ingredient rows (amount as text accepting ½ and ⅓, unit select, name, note; stacked on phone, one row from `sm`) with add, remove and up/down reorder, and Enter in the last row adding a row
+- hinted rows show "חזרה למקור"
+- step rows
+- errors on blur and submit, with focus moving to the first error
+- an unsaved-changes guard
+  UX-DR13: Import dialog. A dialog on desktop and a full page on phone, with tabs "קישור" and "הדבקת טקסט". An engine choice (local or Gemini) remembers the last pick. While running, it shows client-timed phase text, an indeterminate progress bar and Cancel. Errors switch to the paste tab or offer "לנסות שוב עם Gemini".
+  UX-DR14: Import review. A banner in `flag` colour ("N שדות דורשים השלמה · המתכון תורגם מאנגלית"). Flagged fields get a 2 px `flag` border and the note "יש להשלים". Suggested tags are shown as chips. The photo panel offers "הסרה" and "החלפה".
+  UX-DR15: Confirm dialogs (shadcn AlertDialog) for delete, unsaved changes and tag deletion. They name the object and its usage count, start focus on Cancel, and label the destructive action ("מחיקה").
+  UX-DR16: Toasts, one at a time: saved, deleted, deleted-already (404), logged out.
+  UX-DR17: States:
+- skeleton cards (6) and a detail skeleton
+- empty library for editors (with "מתכון חדש" and "ייבוא מקישור") and for visitors
+- no results, with "ניקוי החיפוש"
+- not found, with "חזרה לרשימה"
+- session expired ("פג תוקף החיבור", returning to the same place, with form data kept)
+- blocked user
+- login errors, generic and rate-limited
+- save failed (values kept)
+  UX-DR18: Tags management screen at `/tags`: two lists (meal types, tags) with inline rename and add. Deletes are confirmed and show usage counts. A meal type in use can't be deleted.
+  UX-DR19: Users screen at `/users` (admin): a list, add user (email, name, role, starting password), role change, block or unblock, and reset password. The controls on the last admin are disabled with a reason. `/account` lets a user change their own password.
+  UX-DR20: Responsive layouts:
+- library: 1 column below 640, 2 columns from `sm`, 3 from `lg`
+- detail: one column on phone (photo, header, servings, board, steps); from `lg`, a 400 px sticky start column (servings and board) with the photo and steps beside it
+- form: up to about 860 px wide
+- import review: from `lg`, the photo panel sits beside the fields
+  UX-DR21: Accessibility behaviours:
+- focus moves to the `h1` and `document.title` updates on route change
+- visible focus through `ring`
+- touch targets at least 44 px
+- reduced motion drops everything except opacity
+- labelled fields, with errors linked through `aria-describedby`
+  UX-DR22: Kitchen mode. The detail page requests a screen wake lock and ignores failure.
+  UX-DR23: All UI copy follows the Voice and Tone rules: Hebrew, gender-neutral infinitives, no exclamation marks or emoji, and every string comes from `he.json`.

 ### FR Coverage Map

@@ -214,26 +215,32 @@ FR27: Epic 2 - Change your own password
 > Approved by Adi 2026-10-26: Q1 A (auth before editing), Q2 A (tags as their own epic), Q3 A (the LLM spike opens Epic 5; all AI work stays together), Q4 A (final "ready to show" epic).

 ### Epic 1: Browse and cook from the phone
+
 Anyone can open ביס & סיר on a phone or desktop (Hebrew, RTL, light or dark), browse the seeded recipes, search them, filter by meal type, open a recipe and scale it live, with the screen staying awake in the kitchen. The groundwork comes first: adapting the scaffold, the shared libs, the OpenAPI pipeline, the database with its migrations and Hebrew meal types, the theme, the app shell, seed data and CI.
 **FRs covered:** FR1, FR2, FR3 (meal type), FR5, FR11, FR12

 ### Epic 2: Accounts, login and roles
+
 Adi bootstraps the admin account, and users log in and out. Visitors read, editors change content, and the admin also manages users on the Users screen (add, change role, block, reset password). Everyone can change their own password.
 **FRs covered:** FR13, FR14, FR15, FR16, FR25, FR26, FR27

 ### Epic 3: Create, edit and delete recipes
+
 Editors create recipes in the full form: ingredient and step rows, fractions, validation, and an unsaved-changes guard. They pick the meal type and tags (creating new tags inline) and add a photo. Editing keeps "originally …" hints, with reset to original, and recipes can be deleted after a confirmation.
 **FRs covered:** FR4, FR6, FR7, FR8, FR9, FR10, FR22

 ### Epic 4: Organise with meal types and tags
+
 Editors manage meal types and tags (add, rename, delete, with usage counts), and everyone can filter the library by tags.
 **FRs covered:** FR3 (tags), FR23

 ### Epic 5: AI import
+
 Editors import a recipe from a link or from pasted text with Ollama (local) or Gemini. They get a Hebrew draft with a suggested meal type, tags and photo, review the flagged fields, and save. Progress, cancel and per-engine timeouts make slow local runs usable. Story 5.1 is the spike that compares Ollama and Gemini and confirms the default engine.
 **FRs covered:** FR17, FR18, FR19, FR20, FR21, FR24

 ### Epic 6: Ready to show
+
 The app runs as one production container (`docker compose up`) with backups, structured logging and an env template. Performance budgets (bundle size, Lighthouse) and the Playwright e2e flows run in CI. A README explains the app and its architecture for recruiters.
 **NFRs completed:** NFR3, NFR6, NFR9, NFR11 (NFR1, 2, 4, 5, 7, 8, 10 and 12 are met inside every epic's stories)

@@ -289,13 +296,14 @@ So that the repo is always green and interview-ready (NFR-1).
 **And** the old Nx Cloud `start-ci-run` / `fix-ci` steps are removed
 **And** `recipe-service:typecheck` runs mypy in strict mode with the pydantic plugin, and `recipe-service:lint` runs ruff plus the import-linter contracts for AD-1
 **And** the web ESLint config bans:
-  - physical-direction Tailwind utilities (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left/right`)
-  - arbitrary values
-  - hex/rgb literals outside the theme file
-  - the `style` prop in `libs/ui-components`
-**And** the web ESLint config also enables jsx-a11y and the version of the React hooks rules that the compiler needs (AD-33)
-**And** a deliberately broken line (e.g. `className="ml-2"`) makes CI fail, and reverting it makes CI pass
-**And** the React Compiler is enabled through `babel-plugin-react-compiler` in the Vite config
+
+- physical-direction Tailwind utilities (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left/right`)
+- arbitrary values
+- hex/rgb literals outside the theme file
+- the `style` prop in `libs/ui-components`
+  **And** the web ESLint config also enables jsx-a11y and the version of the React hooks rules that the compiler needs (AD-33)
+  **And** a deliberately broken line (e.g. `className="ml-2"`) makes CI fail, and reverting it makes CI pass
+  **And** the React Compiler is enabled through `babel-plugin-react-compiler` in the Vite config

 ### Story 1.4: Theme, RTL and app shell

@@ -331,6 +339,13 @@ So that every screen uses the same accessible, token-driven building blocks.
 **And** each primitive renders correctly in RTL (logical utilities, Radix `DirectionProvider`) in light and dark
 **And** each primitive has a small component test: it renders, it is keyboard operable where interactive, and the dialogs trap and restore focus
 **And** none imports data-access, TanStack Query or the router (AD-2 lint)
+**And** Storybook is set up on `libs/ui-components` with `@nx/storybook` (React + Vite builder)
+**And** the Storybook preview loads the theme CSS (tokens and Rubik), a global decorator sets `dir="rtl"` and wraps stories in `DirectionProvider`, and a toolbar toggle switches light and dark
+**And** `@storybook/addon-a11y` is enabled
+**And** every primitive and shared component has a story showing RTL in both themes, including Story 1.4's Button, TopBar, ThemeToggle and Board
+**And** a `build-storybook` target runs in CI through `nx affected`
+**And** the app's provider tree (i18n init, `DirectionProvider`, `ThemeProvider`) lives in one shared `AppProviders` used by both `main.tsx` and the specs, so a broken bootstrap fails a test
+**And** input and control boundaries meet WCAG 1.4.11 (≥ 3:1) in both themes through a stronger `--input` border token, checked in `theme-contrast.spec.ts` and shown in a Storybook preview for Adi to approve
 **And** `nx run-many -t lint test build` passes

 ### Story 1.6: Recipe data model and read API
@@ -344,23 +359,25 @@ So that the app has real data to show.
 **Given** a fresh database
 **When** the app starts
 **Then** Alembic migrations (batch mode) run automatically and create `recipe`, `ingredient`, `step`, `tag` and `recipe_tag` (AD-5, AD-24), with:
-  - UUID ids
-  - UTC timestamps
-  - nullable `created_by`/`updated_by` UUID columns (their foreign key to `user` is added in Story 2.1, when that table exists)
-  - `ON DELETE CASCADE` on child rows
-**And** every connection has `PRAGMA foreign_keys=ON` and WAL enabled
-**And** a data migration inserts the default meal types with fixed UUIDs and Hebrew names (בוקר, בראנץ', צהריים, ערב, קינוח, תוספת, משקה, אחר)
-**And** a failed migration exits the app non-zero
+
+- UUID ids
+- UTC timestamps
+- nullable `created_by`/`updated_by` UUID columns (their foreign key to `user` is added in Story 2.1, when that table exists)
+- `ON DELETE CASCADE` on child rows
+  **And** every connection has `PRAGMA foreign_keys=ON` and WAL enabled
+  **And** a data migration inserts the default meal types with fixed UUIDs and Hebrew names (בוקר, בראנץ', צהריים, ערב, קינוח, תוספת, משקה, אחר)
+  **And** a failed migration exits the app non-zero

 **Given** recipes exist
 **When** `GET /api/recipes` is called
 **Then** it returns all `RecipeSummary` items, unpaginated, sorted by `created_at desc, id` (AD-26). Each summary has: id, title, meal_type `{id,name}`, tags `[{id,name}]`, total_minutes or null, photo or null, and created_at
 **And** `GET /api/recipes/{id}` returns the full `RecipeRead` (AD-20, AD-31), with:
-  - ordered ingredients: `amount` as a JSON number or null, `unit` from the `Unit` enum or null, name, note, and `original` or null
-  - ordered steps
-**And** an unknown id returns 404 `{detail, code: "recipe_not_found"}` (AD-28)
-**And** operation IDs follow `{tag}_{function}`, enforced by a test (AD-19)
-**And** API tests cover both endpoints against a temporary database migrated with `alembic upgrade head`
+
+- ordered ingredients: `amount` as a JSON number or null, `unit` from the `Unit` enum or null, name, note, and `original` or null
+- ordered steps
+  **And** an unknown id returns 404 `{detail, code: "recipe_not_found"}` (AD-28)
+  **And** operation IDs follow `{tag}_{function}`, enforced by a test (AD-19)
+  **And** API tests cover both endpoints against a temporary database migrated with `alembic upgrade head`

 ### Story 1.7: Generated API client pipeline

@@ -429,15 +446,16 @@ So that I can cook from it (FR5).
 **When** I open `/recipes/:id`
 **Then** I see the meal type, prep and cook time, the title in display style, the ingredient board, numbered steps, and the source link if there is one (UX-DR6, UX-DR10)
 **And** each `IngredientLine` shows:
-  - the amount in quantity style, wrapped in `<bdi>`
-  - the singular or plural Hebrew unit label from `he.json`
-  - the name and the note
-  - for to-taste lines, "מלח — לפי הטעם"
-**And** the layout is one column on phone. From `lg`, the ingredient board sits in a sticky start column with the steps beside it (UX-DR20)
-**And** `IngredientLine` already renders an `original` hint when the API sends one, so Epic 3 needs no layout change
-**And** an unknown id shows "המתכון לא נמצא" with a "חזרה לרשימה" link
-**And** a skeleton shows while loading, and the page renders in under 500 ms locally (NFR-3)
-**And** the route is lazy-loaded in its own chunk (AD-11)
+
+- the amount in quantity style, wrapped in `<bdi>`
+- the singular or plural Hebrew unit label from `he.json`
+- the name and the note
+- for to-taste lines, "מלח — לפי הטעם"
+  **And** the layout is one column on phone. From `lg`, the ingredient board sits in a sticky start column with the steps beside it (UX-DR20)
+  **And** `IngredientLine` already renders an `original` hint when the API sends one, so Epic 3 needs no layout change
+  **And** an unknown id shows "המתכון לא נמצא" with a "חזרה לרשימה" link
+  **And** a skeleton shows while loading, and the page renders in under 500 ms locally (NFR-3)
+  **And** the route is lazy-loaded in its own chunk (AD-11)

 ### Story 1.11: Live serving scaling and kitchen mode

@@ -451,13 +469,14 @@ So that I can cook for any group without doing the maths (FR11).
 **When** I tap + until the servings read 10
 **Then** every amount is multiplied by 10/4 immediately, with no server call, and to-taste ingredients never change
 **And** rounding follows FR11:
-  - whole numbers have no decimals ("5", not "5.000")
-  - other numbers have at most 2 decimals
-  - countable units (unit, clove, slice, can, package) round to the nearest ½
-**And** the `ServingsStepper` has 44 px − and + buttons and a typeable value clamped to 1–100 with a range message. A polite live region announces the new servings count (UX-DR9)
-**And** "חזרה ל־4" appears only when the value differs from the base, and it restores the base. A reload also returns to the base
-**And** `scaleAmount` and `formatAmount` live in `libs/recipe-domain` with 100% branch coverage. `IngredientLine` uses them for both the amount and any original hint (AD-32, NFR-2)
-**And** while the detail page is open it requests a screen wake lock, and silently ignores a refusal (UX-DR22)
+
+- whole numbers have no decimals ("5", not "5.000")
+- other numbers have at most 2 decimals
+- countable units (unit, clove, slice, can, package) round to the nearest ½
+  **And** the `ServingsStepper` has 44 px − and + buttons and a typeable value clamped to 1–100 with a range message. A polite live region announces the new servings count (UX-DR9)
+  **And** "חזרה ל־4" appears only when the value differs from the base, and it restores the base. A reload also returns to the base
+  **And** `scaleAmount` and `formatAmount` live in `libs/recipe-domain` with 100% branch coverage. `IngredientLine` uses them for both the amount and any original hint (AD-32, NFR-2)
+  **And** while the detail page is open it requests a screen wake lock, and silently ignores a refusal (UX-DR22)

 ## Epic 2: Accounts, login and roles

@@ -894,4 +913,5 @@ So that a reviewer can follow the project quickly (NFR9).
 **Then** it explains what ביס & סיר is (with screenshots), how to run it (`npm run dev` and `docker compose up`), the env settings, and how to create the admin and seed the data
 **And** it shows the architecture at a glance (a diagram plus the key decisions) and links to `ARCHITECTURE-SPINE.md`, the PRD and the UX docs
 **And** it lists the quality gates (CI, tests, budgets) and the tech stack with the reasons behind each choice
+**And** the built Storybook of `libs/ui-components` is published (e.g. GitHub Pages) and the README links to it
 **And** a reader new to the project can follow the architecture in under 10 minutes
diff --git a/_bmad-output/planning-artifacts/ui-component-inventory.md b/_bmad-output/planning-artifacts/ui-component-inventory.md
index dd99b11..eefc796 100644
--- a/_bmad-output/planning-artifacts/ui-component-inventory.md
+++ b/_bmad-output/planning-artifacts/ui-component-inventory.md
@@ -5,51 +5,54 @@ Sources: `ux-designs/ux-recipes-2026-10-26/DESIGN.md` (Components, Brand & Style

 All components live in `libs/ui-components` (tag `type:ui`): presentational, tokens only, RTL-safe (logical utilities), no data fetching. Feature libs compose them into containers.

+Every component in this inventory gets a Storybook story (RTL, light and dark) in `libs/ui-components`, written by the story that builds it. Story 1.5 sets up Storybook and adds stories for the 1.4 components (Button, TopBar, ThemeToggle, Board).
+
 ## shadcn/ui primitives

 Used as shadcn ships them, styled only through the theme variables (DESIGN.md).

-| Primitive | Used for | Screens | Added by |
-|---|---|---|---|
-| Button | every action; primary pill, icon buttons | all | 1.4 (shadcn init + Button for the theme toggle) |
-| Input | search field, login, forms | library, login, users, recipe form | **UI kit story** |
-| Label | form fields | login, users, account, recipe form | **UI kit story** |
-| Skeleton | loading cards and detail | library, detail | **UI kit story** |
-| ToggleGroup (single) | meal-type chip row ("הכל" + meal types) | library | **UI kit story** |
-| DropdownMenu | account menu (name, משתמשים, תגיות, יציאה) | top bar | **UI kit story** |
-| Sonner (Toast) | saved / deleted / logged out / password updated | global | **UI kit story** |
-| Dialog | add user; import dialog on desktop | users, import | **UI kit story** |
-| AlertDialog | confirms: block/reset user, delete recipe, unsaved changes, delete tag | users, recipe, tags | **UI kit story** |
-| Select | user role; meal type; ingredient unit | users, recipe form | **UI kit story** |
-| Table | users list | users | **UI kit story** |
-| Textarea | recipe description, steps; pasted import text | recipe form, import | 3.1 (just in time) |
-| Popover + Command | tag combobox with "יצירת תגית '{text}'" | recipe form, import review | 3.3 (just in time) |
-| Sheet + Checkbox | tag filter (sheet on phone, popover on desktop) | library | 4.2 (just in time) |
-| Tabs | import: "קישור" / "הדבקת טקסט" | import | 5.2 (just in time) |
+| Primitive                     | Used for                                                               | Screens                            | Added by                                        |
+| ----------------------------- | ---------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------- |
+| Button                        | every action; primary pill, icon buttons                               | all                                | 1.4 (shadcn init + Button for the theme toggle) |
+| Direction (DirectionProvider) | RTL for every Radix primitive; set once at the app root                | all                                | 1.4 (added with `shadcn init --rtl`)            |
+| Input                         | search field, login, forms                                             | library, login, users, recipe form | **UI kit story**                                |
+| Label                         | form fields                                                            | login, users, account, recipe form | **UI kit story**                                |
+| Skeleton                      | loading cards and detail                                               | library, detail                    | **UI kit story**                                |
+| ToggleGroup (single)          | meal-type chip row ("הכל" + meal types)                                | library                            | **UI kit story**                                |
+| DropdownMenu                  | account menu (name, משתמשים, תגיות, יציאה)                             | top bar                            | **UI kit story**                                |
+| Sonner (Toast)                | saved / deleted / logged out / password updated                        | global                             | **UI kit story**                                |
+| Dialog                        | add user; import dialog on desktop                                     | users, import                      | **UI kit story**                                |
+| AlertDialog                   | confirms: block/reset user, delete recipe, unsaved changes, delete tag | users, recipe, tags                | **UI kit story**                                |
+| Select                        | user role; meal type; ingredient unit                                  | users, recipe form                 | **UI kit story**                                |
+| Table                         | users list                                                             | users                              | **UI kit story**                                |
+| Textarea                      | recipe description, steps; pasted import text                          | recipe form, import                | 3.1 (just in time)                              |
+| Popover + Command             | tag combobox with "יצירת תגית '{text}'"                                | recipe form, import review         | 3.3 (just in time)                              |
+| Sheet + Checkbox              | tag filter (sheet on phone, popover on desktop)                        | library                            | 4.2 (just in time)                              |
+| Tabs                          | import: "קישור" / "הדבקת טקסט"                                         | import                             | 5.2 (just in time)                              |

 ## Custom shared components (brand and composites)

 Built by the story that first renders them, in `libs/ui-components`.

-| Component | Composed of | Added by |
-|---|---|---|
-| TopBar (wordmark, slot for actions) | Button | 1.4 |
-| ThemeToggle (system → light → dark) | Button | 1.4 |
-| Board (oak slab, radius 24, handle slot) | — | 1.4 |
-| RecipeCard (board-shaped card, lazy photo) | Board | 1.9 (library) |
-| SearchField (with clear ×) | Input, Button | 1.9 |
-| MealTypeFilter (chip row) | ToggleGroup | 1.9 |
-| EmptyState / NoResults | Button | 1.9 |
-| BoardPhoto (photo masked as a board) | Board | 1.10 (detail) |
-| IngredientLine (amount + unit in `<bdi>`, to-taste, hint) | — | 1.10 |
-| ServingsStepper (44 px, typeable, clamped, live region) | Button, Input | 1.11 |
-| IngredientRowEditor / StepListEditor | Input, Select, Button | 3.1–3.2 |
-| TagChip (removable) | Button | 3.3 |
-| TagCombobox | Popover, Command, TagChip | 3.3 |
-| PhotoField (add / replace / remove / restore) | Button | 3.7 |
-| TagFilter | Sheet, Popover, Checkbox, TagChip | 4.2 |
-| FlaggedField ("יש להשלים") | Input | 5.3 |
+| Component                                                 | Composed of                       | Added by      |
+| --------------------------------------------------------- | --------------------------------- | ------------- |
+| TopBar (wordmark, slot for actions)                       | Button                            | 1.4           |
+| ThemeToggle (system → light → dark)                       | Button                            | 1.4           |
+| Board (oak slab, radius 24, handle slot)                  | —                                 | 1.4           |
+| RecipeCard (board-shaped card, lazy photo)                | Board                             | 1.9 (library) |
+| SearchField (with clear ×)                                | Input, Button                     | 1.9           |
+| MealTypeFilter (chip row)                                 | ToggleGroup                       | 1.9           |
+| EmptyState / NoResults                                    | Button                            | 1.9           |
+| BoardPhoto (photo masked as a board)                      | Board                             | 1.10 (detail) |
+| IngredientLine (amount + unit in `<bdi>`, to-taste, hint) | —                                 | 1.10          |
+| ServingsStepper (44 px, typeable, clamped, live region)   | Button, Input                     | 1.11          |
+| IngredientRowEditor / StepListEditor                      | Input, Select, Button             | 3.1–3.2       |
+| TagChip (removable)                                       | Button                            | 3.3           |
+| TagCombobox                                               | Popover, Command, TagChip         | 3.3           |
+| PhotoField (add / replace / remove / restore)             | Button                            | 3.7           |
+| TagFilter                                                 | Sheet, Popover, Checkbox, TagChip | 4.2           |
+| FlaggedField ("יש להשלים")                                | Input                             | 5.3           |

 ## Rule for new needs

-A primitive that isn't listed here is added with `shadcn add` by the story that first needs it, and that story adds a row here.
+A primitive that isn't listed here is added with `shadcn add` by the story that first needs it, and that story adds a row here and a Storybook story for it.
diff --git a/apps/web/index.html b/apps/web/index.html
index c611d01..120b8fe 100644
--- a/apps/web/index.html
+++ b/apps/web/index.html
@@ -1,12 +1,27 @@
 <!doctype html>
-<html lang="en">
+<html lang="he" dir="rtl">
   <head>
     <meta charset="utf-8" />
-    <title>Web</title>
+    <title>ביס & סיר</title>
     <base href="/" />

     <meta name="viewport" content="width=device-width, initial-scale=1" />
     <link rel="icon" type="image/x-icon" href="/favicon.ico" />
+    <!-- Applies the dark theme before first paint; same storage key and rule as ThemeProvider (src/app/theme.tsx). -->
+    <script id="theme-init">
+      (function () {
+        var mode = null;
+        try {
+          mode = window.localStorage.getItem('theme');
+        } catch (e) {}
+        var dark =
+          mode === 'dark' ||
+          (mode !== 'light' &&
+            typeof window.matchMedia === 'function' &&
+            window.matchMedia('(prefers-color-scheme: dark)').matches);
+        if (dark) document.documentElement.classList.add('dark');
+      })();
+    </script>
     <link rel="stylesheet" href="/src/styles.css" />
   </head>
   <body>
diff --git a/apps/web/src/app/app-layout.tsx b/apps/web/src/app/app-layout.tsx
new file mode 100644
index 0000000..e3c9424
--- /dev/null
+++ b/apps/web/src/app/app-layout.tsx
@@ -0,0 +1,44 @@
+import { useEffect, useRef } from 'react';
+import { useTranslation } from 'react-i18next';
+import { Link, Outlet, useLocation } from 'react-router';
+import { ThemeToggle, TopBar, Wordmark } from '@bite-and-board/ui-components';
+import { useTheme } from './theme';
+
+/** The shell around every page: top bar, then the page in `<main>`. */
+export function AppLayout() {
+  const { t } = useTranslation();
+  const { mode, setMode } = useTheme();
+  const location = useLocation();
+  const main = useRef<HTMLElement>(null);
+  const shownKey = useRef(location.key);
+
+  // After a navigation (not the first load), move focus to the new page's h1
+  // so screen readers announce it and keyboard users start at the content.
+  useEffect(() => {
+    if (shownKey.current === location.key) return;
+    shownKey.current = location.key;
+    main.current?.querySelector('h1')?.focus();
+  }, [location.key]);
+
+  return (
+    <div className="min-h-dvh bg-background text-foreground">
+      <TopBar
+        brand={
+          <Wordmark asChild>
+            <Link to="/">{t('app.name')}</Link>
+          </Wordmark>
+        }
+        actions={
+          <ThemeToggle
+            value={mode}
+            onValueChange={setMode}
+            label={t(`theme.toggle.${mode}`)}
+          />
+        }
+      />
+      <main ref={main} className="mx-auto max-w-library px-4 pb-12 lg:px-8">
+        <Outlet />
+      </main>
+    </div>
+  );
+}
diff --git a/apps/web/src/app/not-found.tsx b/apps/web/src/app/not-found.tsx
new file mode 100644
index 0000000..fb392e3
--- /dev/null
+++ b/apps/web/src/app/not-found.tsx
@@ -0,0 +1,18 @@
+import { useTranslation } from 'react-i18next';
+import { Link } from 'react-router';
+import { Button } from '@bite-and-board/ui-components';
+import { PageHeading } from './page-heading';
+
+export function NotFound() {
+  const { t } = useTranslation();
+  return (
+    <>
+      <title>{t('app.pageTitle', { page: t('notFound.title') })}</title>
+      <PageHeading>{t('notFound.title')}</PageHeading>
+      <p className="pb-8 text-muted-foreground">{t('notFound.body')}</p>
+      <Button asChild>
+        <Link to="/">{t('notFound.back')}</Link>
+      </Button>
+    </>
+  );
+}
diff --git a/apps/web/src/app/page-heading.tsx b/apps/web/src/app/page-heading.tsx
new file mode 100644
index 0000000..549ad7f
--- /dev/null
+++ b/apps/web/src/app/page-heading.tsx
@@ -0,0 +1,10 @@
+import type { ReactNode } from 'react';
+
+/** A page's h1; focusable so the layout can move focus to it on navigation. */
+export function PageHeading({ children }: { children: ReactNode }) {
+  return (
+    <h1 tabIndex={-1} className="pt-8 pb-3 text-title outline-none">
+      {children}
+    </h1>
+  );
+}
diff --git a/apps/web/src/app/placeholder-home.tsx b/apps/web/src/app/placeholder-home.tsx
index ba63ad3..6256fbd 100644
--- a/apps/web/src/app/placeholder-home.tsx
+++ b/apps/web/src/app/placeholder-home.tsx
@@ -1,8 +1,13 @@
-// Stands in for the recipe library page until it lands in its feature lib.
+import { useTranslation } from 'react-i18next';
+import { PageHeading } from './page-heading';
+
+// Stands in for the recipe library page until it lands in its feature lib (1.9).
 export function PlaceholderHome() {
+  const { t } = useTranslation();
   return (
-    <main>
-      <h1>Bite &amp; Board</h1>
-    </main>
+    <>
+      <title>{t('app.name')}</title>
+      <PageHeading>{t('home.title')}</PageHeading>
+    </>
   );
 }
diff --git a/apps/web/src/app/route-error.tsx b/apps/web/src/app/route-error.tsx
index 7d30276..ad69a26 100644
--- a/apps/web/src/app/route-error.tsx
+++ b/apps/web/src/app/route-error.tsx
@@ -1,12 +1,20 @@
+import { useTranslation } from 'react-i18next';
 import { isRouteErrorResponse, useRouteError } from 'react-router';

+/** Root error element: replaces the whole shell when a route throws. */
 export function RouteError() {
+  const { t } = useTranslation();
   const error = useRouteError();
   const notFound = isRouteErrorResponse(error) && error.status === 404;
+  const title = notFound ? t('notFound.title') : t('error.title');

   return (
-    <main>
-      <h1>{notFound ? 'Page not found' : 'Something went wrong'}</h1>
+    <main className="mx-auto min-h-dvh max-w-library bg-background px-4 pt-8 text-foreground lg:px-8">
+      <title>{t('app.pageTitle', { page: title })}</title>
+      <h1 className="pb-3 text-title">{title}</h1>
+      <p className="text-muted-foreground">
+        {notFound ? t('notFound.body') : t('error.body')}
+      </p>
     </main>
   );
 }
diff --git a/apps/web/src/app/router.spec.tsx b/apps/web/src/app/router.spec.tsx
index c394c2a..060c52d 100644
--- a/apps/web/src/app/router.spec.tsx
+++ b/apps/web/src/app/router.spec.tsx
@@ -1,26 +1,62 @@
-import { render, screen } from '@testing-library/react';
-import { createMemoryRouter, RouterProvider } from 'react-router';
+import {
+  fireEvent,
+  render,
+  screen,
+  waitFor,
+  within,
+} from '@testing-library/react';
+import { createMemoryRouter, data, RouterProvider } from 'react-router';
+import { DirectionProvider } from '@bite-and-board/ui-components';
 import { RouteError } from './route-error';
 import { routes } from './router';
+import { ThemeProvider } from './theme';

-function renderAt(path: string) {
-  const router = createMemoryRouter(routes, { initialEntries: [path] });
-  render(<RouterProvider router={router} />);
+function renderApp(path: string, appRoutes = routes) {
+  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
+  render(
+    <DirectionProvider dir="rtl">
+      <ThemeProvider>
+        <RouterProvider router={router} />
+      </ThemeProvider>
+    </DirectionProvider>,
+  );
 }

 describe('routes', () => {
-  it('renders the lazy home page at /', async () => {
-    renderAt('/');
+  it('renders the shell and the lazy home page at /', async () => {
+    renderApp('/');
+    const heading = await screen.findByRole('heading', { name: 'מתכונים' });
+    const banner = screen.getByRole('banner');
     expect(
-      await screen.findByRole('heading', { name: 'Bite & Board' }),
-    ).toBeTruthy();
+      within(banner)
+        .getByRole('link', { name: 'ביס & סיר' })
+        .getAttribute('href'),
+    ).toBe('/');
+    expect(document.title).toBe('ביס & סיר');
+    // The first load does not move focus.
+    expect(document.activeElement).not.toBe(heading);
   });

-  it('renders the not-found error for an unknown path', async () => {
-    renderAt('/nope');
+  it('renders the not-found page inside the shell for an unknown path', async () => {
+    renderApp('/nope');
+    const heading = await screen.findByRole('heading', {
+      level: 1,
+      name: 'הדף לא נמצא',
+    });
+    expect(screen.getByRole('banner')).toBeTruthy();
     expect(
-      await screen.findByRole('heading', { name: 'Page not found' }),
-    ).toBeTruthy();
+      screen.getByRole('link', { name: 'חזרה לרשימה' }).getAttribute('href'),
+    ).toBe('/');
+    expect(document.title).toBe('הדף לא נמצא · ביס & סיר');
+    expect(document.activeElement).not.toBe(heading);
+  });
+
+  it('moves focus to the new h1 and updates the title on navigation', async () => {
+    renderApp('/nope');
+    fireEvent.click(await screen.findByRole('link', { name: 'חזרה לרשימה' }));
+    const heading = await screen.findByRole('heading', { name: 'מתכונים' });
+    await waitFor(() => expect(document.activeElement).toBe(heading));
+    expect(document.title).toBe('ביס & סיר');
   });
 });

@@ -29,21 +65,36 @@ describe('RouteError', () => {
     vi.restoreAllMocks();
   });

-  it('renders a generic message when a route throws', async () => {
-    // The router logs the thrown error; keep the test output clean.
-    vi.spyOn(console, 'error').mockImplementation(() => undefined);
-    const router = createMemoryRouter([
+  function throwingRoutes(error: unknown) {
+    return [
       {
         path: '/',
+        Component: () => null,
+        HydrateFallback: () => null,
         errorElement: <RouteError />,
         loader: () => {
-          throw new Error('boom');
+          throw error;
         },
       },
-    ]);
-    render(<RouterProvider router={router} />);
+    ];
+  }
+
+  it('renders a Hebrew message when a loader throws', async () => {
+    // The router logs the thrown error; keep the test output clean.
+    vi.spyOn(console, 'error').mockImplementation(() => undefined);
+    renderApp('/', throwingRoutes(new Error('boom')));
+    expect(
+      await screen.findByRole('heading', { name: 'משהו השתבש' }),
+    ).toBeTruthy();
+    expect(screen.getByText('אפשר לרענן ולנסות שוב')).toBeTruthy();
+    expect(document.title).toBe('משהו השתבש · ביס & סיר');
+  });
+
+  it('renders the not-found copy for a thrown 404', async () => {
+    vi.spyOn(console, 'error').mockImplementation(() => undefined);
+    renderApp('/', throwingRoutes(data(null, { status: 404 })));
     expect(
-      await screen.findByRole('heading', { name: 'Something went wrong' }),
+      await screen.findByRole('heading', { name: 'הדף לא נמצא' }),
     ).toBeTruthy();
   });
 });
diff --git a/apps/web/src/app/router.tsx b/apps/web/src/app/router.tsx
index cd1296b..7b73986 100644
--- a/apps/web/src/app/router.tsx
+++ b/apps/web/src/app/router.tsx
@@ -1,9 +1,12 @@
 import type { RouteObject } from 'react-router';
+import { AppLayout } from './app-layout';
+import { NotFound } from './not-found';
 import { RouteError } from './route-error';

 export const routes: RouteObject[] = [
   {
     path: '/',
+    Component: AppLayout,
     errorElement: <RouteError />,
     // Rendered while the first lazy page chunk loads; the app shell replaces it.
     HydrateFallback: () => null,
@@ -14,6 +17,8 @@ export const routes: RouteObject[] = [
           Component: (await import('./placeholder-home')).PlaceholderHome,
         }),
       },
+      // Inside the layout, so the top bar stays on unknown paths.
+      { path: '*', Component: NotFound },
     ],
   },
 ];
diff --git a/apps/web/src/app/theme.spec.tsx b/apps/web/src/app/theme.spec.tsx
new file mode 100644
index 0000000..0e7fe24
--- /dev/null
+++ b/apps/web/src/app/theme.spec.tsx
@@ -0,0 +1,146 @@
+import { readFileSync } from 'node:fs';
+import { join } from 'node:path';
+import { act, fireEvent, render, screen } from '@testing-library/react';
+import { createMemoryRouter, RouterProvider } from 'react-router';
+import { setSystemDark } from '../test-setup';
+import { routes } from './router';
+import { THEME_STORAGE_KEY, ThemeProvider } from './theme';
+
+const LABELS = {
+  system: 'צבעים: לפי המכשיר',
+  light: 'צבעים: בהיר',
+  dark: 'צבעים: כהה',
+};
+
+const isDark = () => document.documentElement.classList.contains('dark');
+
+async function renderApp() {
+  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
+  render(
+    <ThemeProvider>
+      <RouterProvider router={router} />
+    </ThemeProvider>,
+  );
+  await screen.findByRole('heading', { name: 'מתכונים' });
+}
+
+const toggle = () => screen.getByRole('button', { name: /^צבעים:/ });
+
+describe('pre-paint script in index.html', () => {
+  const html = readFileSync(
+    join(import.meta.dirname, '../../index.html'),
+    'utf8',
+  );
+  const script = /<script id="theme-init">([\s\S]*?)<\/script>/.exec(html)?.[1];
+  // Runs the inline script the way the browser does before first paint.
+  // eslint-disable-next-line no-new-func -- the code under test is that script
+  const run = () => new Function(script ?? '')();
+
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  it('reads the ThemeProvider storage key', () => {
+    expect(script).toContain(`'${THEME_STORAGE_KEY}'`);
+  });
+
+  it('applies dark from the OS on a first visit', () => {
+    setSystemDark(true);
+    run();
+    expect(isDark()).toBe(true);
+  });
+
+  it('lets a stored light choice win over a dark OS', () => {
+    setSystemDark(true);
+    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
+    run();
+    expect(isDark()).toBe(false);
+  });
+
+  it('applies a stored dark choice', () => {
+    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
+    run();
+    expect(isDark()).toBe(true);
+  });
+
+  it('falls back to the OS when storage is blocked', () => {
+    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
+      throw new Error('blocked');
+    });
+    setSystemDark(true);
+    expect(run).not.toThrow();
+    expect(isDark()).toBe(true);
+  });
+});
+
+describe('ThemeProvider', () => {
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  it('follows a dark OS on a first visit and shows "system"', async () => {
+    setSystemDark(true);
+    await renderApp();
+    expect(isDark()).toBe(true);
+    expect(toggle().getAttribute('aria-label')).toBe(LABELS.system);
+  });
+
+  it('cycles system → light → dark → system and remembers the choice', async () => {
+    setSystemDark(true);
+    await renderApp();
+
+    fireEvent.click(toggle());
+    expect(toggle().getAttribute('aria-label')).toBe(LABELS.light);
+    expect(isDark()).toBe(false);
+    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
+
+    fireEvent.click(toggle());
+    expect(toggle().getAttribute('aria-label')).toBe(LABELS.dark);
+    expect(isDark()).toBe(true);
+    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
+
+    fireEvent.click(toggle());
+    expect(toggle().getAttribute('aria-label')).toBe(LABELS.system);
+    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
+  });
+
+  it('restores a remembered choice', async () => {
+    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
+    await renderApp();
+    expect(toggle().getAttribute('aria-label')).toBe(LABELS.dark);
+    expect(isDark()).toBe(true);
+  });
+
+  it('follows the OS live in system mode', async () => {
+    await renderApp();
+    expect(isDark()).toBe(false);
+    act(() => setSystemDark(true));
+    expect(isDark()).toBe(true);
+    act(() => setSystemDark(false));
+    expect(isDark()).toBe(false);
+  });
+
+  it('ignores the OS once a mode is chosen', async () => {
+    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
+    await renderApp();
+    act(() => setSystemDark(true));
+    expect(isDark()).toBe(false);
+  });
+
+  it('still works for the session when storage is blocked', async () => {
+    const blocked = () => {
+      throw new Error('blocked');
+    };
+    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
+    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
+    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
+    await renderApp();
+
+    fireEvent.click(toggle());
+    fireEvent.click(toggle());
+    expect(toggle().getAttribute('aria-label')).toBe(LABELS.dark);
+    expect(isDark()).toBe(true);
+    fireEvent.click(toggle());
+    expect(toggle().getAttribute('aria-label')).toBe(LABELS.system);
+  });
+});
diff --git a/apps/web/src/app/theme.tsx b/apps/web/src/app/theme.tsx
new file mode 100644
index 0000000..c0b4c54
--- /dev/null
+++ b/apps/web/src/app/theme.tsx
@@ -0,0 +1,82 @@
+import {
+  createContext,
+  use,
+  useLayoutEffect,
+  useState,
+  useSyncExternalStore,
+  type ReactNode,
+} from 'react';
+import type { ThemeMode } from '@bite-and-board/ui-components';
+
+/** Read by the pre-paint script in index.html too; keep both in sync. */
+export const THEME_STORAGE_KEY = 'theme';
+
+const DARK_QUERY = '(prefers-color-scheme: dark)';
+
+function readStoredMode(): ThemeMode {
+  try {
+    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
+    return stored === 'light' || stored === 'dark' ? stored : 'system';
+  } catch {
+    return 'system';
+  }
+}
+
+function storeMode(mode: ThemeMode) {
+  try {
+    if (mode === 'system') {
+      window.localStorage.removeItem(THEME_STORAGE_KEY);
+    } else {
+      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
+    }
+  } catch {
+    // Storage blocked: the choice lasts for this session only.
+  }
+}
+
+const hasMatchMedia = () => typeof window.matchMedia === 'function';
+
+function subscribeToSystemTheme(onChange: () => void) {
+  if (!hasMatchMedia()) return () => undefined;
+  const query = window.matchMedia(DARK_QUERY);
+  query.addEventListener('change', onChange);
+  return () => query.removeEventListener('change', onChange);
+}
+
+const systemPrefersDark = () =>
+  hasMatchMedia() && window.matchMedia(DARK_QUERY).matches;
+
+interface ThemeContextValue {
+  mode: ThemeMode;
+  setMode: (mode: ThemeMode) => void;
+}
+
+const ThemeContext = createContext<ThemeContextValue | null>(null);
+
+/** Owns the theme mode (AD-8): remembered per browser, `system` follows the OS live. */
+export function ThemeProvider({ children }: { children: ReactNode }) {
+  const [mode, setModeState] = useState(readStoredMode);
+  const systemDark = useSyncExternalStore(
+    subscribeToSystemTheme,
+    systemPrefersDark,
+  );
+  const dark = mode === 'dark' || (mode === 'system' && systemDark);
+
+  // Layout effect: the class flips before the browser paints the new theme.
+  useLayoutEffect(() => {
+    document.documentElement.classList.toggle('dark', dark);
+  }, [dark]);
+
+  const setMode = (next: ThemeMode) => {
+    setModeState(next);
+    storeMode(next);
+  };
+
+  return <ThemeContext value={{ mode, setMode }}>{children}</ThemeContext>;
+}
+
+export function useTheme(): ThemeContextValue {
+  const context = use(ThemeContext);
+  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
+  return context;
+}
diff --git a/apps/web/src/main.tsx b/apps/web/src/main.tsx
index de20716..db22a06 100644
--- a/apps/web/src/main.tsx
+++ b/apps/web/src/main.tsx
@@ -2,7 +2,12 @@ import { StrictMode } from 'react';
 import * as ReactDOM from 'react-dom/client';
 import { createBrowserRouter } from 'react-router';
 import { RouterProvider } from 'react-router/dom';
+import { initI18n } from '@bite-and-board/i18n';
+import { DirectionProvider } from '@bite-and-board/ui-components';
 import { routes } from './app/router';
+import { ThemeProvider } from './app/theme';
+
+initI18n();

 const router = createBrowserRouter(routes);

@@ -12,6 +17,10 @@ const root = ReactDOM.createRoot(

 root.render(
   <StrictMode>
-    <RouterProvider router={router} />
+    <DirectionProvider dir="rtl">
+      <ThemeProvider>
+        <RouterProvider router={router} />
+      </ThemeProvider>
+    </DirectionProvider>
   </StrictMode>,
 );
diff --git a/apps/web/src/styles.css b/apps/web/src/styles.css
index 90d4ee0..572678f 100644
--- a/apps/web/src/styles.css
+++ b/apps/web/src/styles.css
@@ -1 +1,4 @@
-/* You can add global styles to this file, and also import other style files */
+/* The theme (tokens, Rubik, base styles) lives in ui-components; the app only adds sources. */
+@import '@bite-and-board/ui-components/theme.css';
+
+@source '../../../libs';
diff --git a/apps/web/src/test-setup.ts b/apps/web/src/test-setup.ts
new file mode 100644
index 0000000..dac9902
--- /dev/null
+++ b/apps/web/src/test-setup.ts
@@ -0,0 +1,36 @@
+import { initI18n } from '@bite-and-board/i18n';
+
+initI18n();
+
+type Listener = (event: MediaQueryListEvent) => void;
+
+const listeners = new Set<Listener>();
+let systemDark = false;
+
+/** Sets the OS colour scheme jsdom reports, notifying live listeners. */
+export function setSystemDark(dark: boolean) {
+  systemDark = dark;
+  for (const listener of listeners) {
+    listener({ matches: dark } as MediaQueryListEvent);
+  }
+}
+
+// jsdom has no matchMedia; this fake answers the dark-scheme query only.
+window.matchMedia = (query: string) =>
+  ({
+    media: query,
+    get matches() {
+      return query === '(prefers-color-scheme: dark)' && systemDark;
+    },
+    addEventListener: (_: string, listener: Listener) =>
+      listeners.add(listener),
+    removeEventListener: (_: string, listener: Listener) =>
+      listeners.delete(listener),
+  }) as unknown as MediaQueryList;
+
+afterEach(() => {
+  systemDark = false;
+  listeners.clear();
+  window.localStorage.clear();
+  document.documentElement.className = '';
+});
diff --git a/apps/web/tsconfig.app.json b/apps/web/tsconfig.app.json
index c571334..08ddb87 100644
--- a/apps/web/tsconfig.app.json
+++ b/apps/web/tsconfig.app.json
@@ -32,7 +32,16 @@
     "vitest.config.mts",
     "eslint.config.js",
     "eslint.config.cjs",
-    "eslint.config.mjs"
+    "eslint.config.mjs",
+    "src/test-setup.ts"
   ],
-  "include": ["src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"]
+  "include": ["src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"],
+  "references": [
+    {
+      "path": "../../libs/i18n/tsconfig.lib.json"
+    },
+    {
+      "path": "../../libs/ui-components/tsconfig.lib.json"
+    }
+  ]
 }
diff --git a/apps/web/tsconfig.spec.json b/apps/web/tsconfig.spec.json
index 8f721f6..79758b4 100644
--- a/apps/web/tsconfig.spec.json
+++ b/apps/web/tsconfig.spec.json
@@ -13,7 +13,8 @@
     ],
     "jsx": "react-jsx",
     "module": "esnext",
-    "moduleResolution": "bundler"
+    "moduleResolution": "bundler",
+    "lib": ["es2022", "dom", "dom.iterable"]
   },
   "include": [
     "vite.config.ts",
@@ -28,7 +29,8 @@
     "src/**/*.spec.js",
     "src/**/*.test.jsx",
     "src/**/*.spec.jsx",
-    "src/**/*.d.ts"
+    "src/**/*.d.ts",
+    "src/test-setup.ts"
   ],
   "references": [
     {
diff --git a/apps/web/vite.config.mts b/apps/web/vite.config.mts
index db625c7..2f4732f 100644
--- a/apps/web/vite.config.mts
+++ b/apps/web/vite.config.mts
@@ -1,6 +1,7 @@
 /// <reference types='vitest' />
 import { defineConfig } from 'vite';
 import babel from '@rolldown/plugin-babel';
+import tailwindcss from '@tailwindcss/vite';
 import react, { reactCompilerPreset } from '@vitejs/plugin-react';
 import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

@@ -21,6 +22,7 @@ export default defineConfig(() => ({
     host: 'localhost',
   },
   plugins: [
+    tailwindcss(),
     react(),
     babel({ presets: [reactCompilerPreset()] }),
     nxReadySignal(),
@@ -42,6 +44,7 @@ export default defineConfig(() => ({
     watch: false,
     globals: true,
     environment: 'jsdom',
+    setupFiles: ['./src/test-setup.ts'],
     include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
     reporters: ['default'],
     coverage: {
diff --git a/docs/ai-model-playbook.md b/docs/ai-model-playbook.md
new file mode 100644
index 0000000..1db32f2
--- /dev/null
+++ b/docs/ai-model-playbook.md
@@ -0,0 +1,58 @@
+# Engineering Playbook: AI Model Selection & Workflow Guidelines
+
+## 1. Executive Summary & Project Kickoff Protocol
+
+This playbook governs AI model routing across engineering projects. Before starting work on any project or major task, the developer will consult with Claude to select the appropriate Operational Mode based on project deadlines, quality requirements, and token/budget constraints.
+
+### Kickoff Prompt Pattern for Developer:
+
+> "We are starting [Project/Task Name]. Here are my current constraints: [Deadline / Token limits / Quality priority]. Based on our AI Model Playbook, which Operational Mode should we run for this session, and which models/effort levels should we assign to the sub-tasks?"
+
+---
+
+## 2. Operational Modes
+
+### Mode A: Performance-First Mode
+
+_Target: Maximum code accuracy, deep reasoning, zero-compromise execution, and minimal iteration loops._
+
+- **Primary Engine (Opus 5.5):** Default for all agentic coding, multi-file refactoring, complex bug diagnostics, and core system design.
+- **Fast Execution (Sonnet 5.5):** Used for standard UI feature additions, routine API routes, and targeted PR reviews where rapid response is required.
+- **Automated High-Volume (Haiku 5.5):** Used for deterministic routing, extraction, schema mapping, and subagents.
+- **Ultimate Escalation (Fable 5.1):** Reserved strictly for extraordinary reasoning edge cases where Opus 5.5 (even with High Effort) fails to resolve the issue.
+
+### Mode B: Cost & Token Efficiency Mode
+
+_Target: Token budget preservation, rate-limit avoidance, and maximum cost-per-task efficiency._
+
+- **Primary Engine (Sonnet 5.5):** Default for day-to-day feature implementation, standard coding, and primary debugging. Saves 50% on token costs compared to Opus.
+- **High-Volume & Micro-tasks (Haiku 5.5):** Aggressively assigned for simple presentational UI components, i18n dictionaries (`he.json`), boilerplate, seed data, and unit test skeletons (20x cheaper than Sonnet).
+- **Escalation Engine (Opus 5.5):** Used ONLY when Sonnet 5.5 fails after two consecutive iterations on the same bug or for high-risk initial database/architecture setup.
+- **Frozen (Fable 5.1):** Frozen. Used only in critical blocking production emergencies.
+
+---
+
+## 3. Official Model Specifications Reference
+
+| Model          | Primary Role                                          | Official Cost (MTok)       | Speed / Latency  |
+| :------------- | :---------------------------------------------------- | :------------------------- | :--------------- |
+| **Haiku 5.5**  | High-volume tasks, extraction, subagents, routing     | $0.10 input / $0.50 output | Lowest (Fastest) |
+| **Sonnet 5.5** | Fast day-to-day coding, feature work, tool use        | $2.00 input / $10.00 out   | Fast             |
+| **Opus 5.5**   | Agentic coding, multi-file refactoring, system design | $4.00 input / $20.00 out   | Moderate         |
+| **Fable 5.1**  | Deepest reasoning escalation & long-horizon research  | $10.00 input / $50.00 out  | Slower           |
+
+---
+
+## 4. Thinking Effort Parameter Guidelines
+
+- **Effort: Medium (Default Baseline):** Standard operational level for 90% of development work. Ensures adequate reasoning without runaway token generation.
+- **Effort: High:** Enable when executing cross-system refactoring, deep async deadlock debugging, or complex architectural planning.
+- **Effort: Low:** Enable for rapid boilerplate, UI styling, translation keys, or simple unit test expansion.
+
+---
+
+## 5. Practical Developer Guidelines
+
+1. **Context Cleanliness:** Run `/clear` between distinct stories or epics to maintain a clean context window and prevent token degradation.
+2. **Use Diffs:** Pass `git diff` outputs instead of full file contents when requesting code reviews or targeted bug fixes.
+3. **Trigger-Based Escalation:** Do not jump directly to higher models unless the lower model fails a 2-iteration loop or the task explicitly demands higher reasoning.
diff --git a/eslint.config.mjs b/eslint.config.mjs
index f442281..860fd40 100644
--- a/eslint.config.mjs
+++ b/eslint.config.mjs
@@ -41,6 +41,21 @@ const HEX_COLOUR = String.raw`/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$|(^|[^\
 const FUNCTIONAL_COLOUR = String.raw`/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i`;
 const COLOUR_MESSAGE =
   'Colour literals belong in the theme; use a design token class instead.';
+const COLOUR_SYNTAX = [HEX_COLOUR, FUNCTIONAL_COLOUR].flatMap((regex) => [
+  { selector: `Literal[value=${regex}]`, message: COLOUR_MESSAGE },
+  { selector: `TemplateElement[value.raw=${regex}]`, message: COLOUR_MESSAGE },
+]);
+
+// Hebrew copy lives only in libs/i18n `he.json` (AD-10); specs may assert on it.
+const HEBREW = String.raw`/[֐-׿]/`;
+const HEBREW_MESSAGE =
+  'Hebrew copy belongs in libs/i18n he.json: use a t() key, or take the string as a prop.';
+const HEBREW_SYNTAX = [
+  `Literal[value=${HEBREW}]`,
+  `TemplateElement[value.raw=${HEBREW}]`,
+  `JSXText[value=${HEBREW}]`,
+].map((selector) => ({ selector, message: HEBREW_MESSAGE }));
+const SPEC_FILES = ['**/*.{spec,test}.{ts,tsx,js,jsx}'];

 export default [
   ...nx.configs['flat/base'],
@@ -70,6 +85,7 @@ export default [
                 'type:data-access',
                 'type:ui',
                 'type:domain',
+                'type:i18n',
               ],
             },
             {
@@ -78,20 +94,29 @@ export default [
                 'type:data-access',
                 'type:ui',
                 'type:domain',
+                'type:i18n',
               ],
             },
             {
               sourceTag: 'type:ui',
               onlyDependOnLibsWithTags: ['type:domain'],
-              // Presentational only: no server state, API client or routing.
+              // Presentational only: no server state, API client, routing or i18n
+              // (strings come in as props).
               bannedExternalImports: [
                 '@tanstack/*',
                 '@hey-api/*',
                 'react-router',
                 'react-router/*',
                 'react-router-*',
+                'i18next',
+                'react-i18next',
               ],
             },
+            {
+              // he.json, the i18next init and typed keys (AD-10).
+              sourceTag: 'type:i18n',
+              onlyDependOnLibsWithTags: [],
+            },
             {
               // Workspace tooling (lint fixture tests) imports no project code.
               sourceTag: 'type:tooling',
@@ -129,18 +154,14 @@ export default [
         },
       ],
       // A later block that sets `no-restricted-syntax` replaces this list: extend it instead.
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
+      'no-restricted-syntax': ['error', ...COLOUR_SYNTAX, ...HEBREW_SYNTAX],
     },
   },
+  {
+    files: SPEC_FILES,
+    // Same list minus the Hebrew ban: tests query by the Hebrew the user sees.
+    rules: { 'no-restricted-syntax': ['error', ...COLOUR_SYNTAX] },
+  },
   {
     files: ['**/*.tsx', '**/*.jsx'],
     // Same plugin object Nx's react config registers; flatConfigs carries a copy ESLint rejects.
diff --git a/libs/i18n/README.md b/libs/i18n/README.md
new file mode 100644
index 0000000..f5c0f86
--- /dev/null
+++ b/libs/i18n/README.md
@@ -0,0 +1,8 @@
+# i18n
+
+All UI copy: `he.json`, the i18next init (`initI18n`) and the typed keys (`CustomTypeOptions`).
+
+- Tag `type:i18n`: imports no workspace project. `type:app` and `type:feature` may import it; `type:ui` may not (components take strings as props).
+- Copy follows EXPERIENCE.md "Voice and Tone"; a spec checks the basics.
+
+Run `npx nx test i18n`.
diff --git a/libs/i18n/eslint.config.mjs b/libs/i18n/eslint.config.mjs
new file mode 100644
index 0000000..0232736
--- /dev/null
+++ b/libs/i18n/eslint.config.mjs
@@ -0,0 +1,8 @@
+import baseConfig from '../../eslint.config.mjs';
+
+export default [
+  ...baseConfig,
+  {
+    ignores: ['**/out-tsc'],
+  },
+];
diff --git a/libs/i18n/package.json b/libs/i18n/package.json
new file mode 100644
index 0000000..282d2a3
--- /dev/null
+++ b/libs/i18n/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "@bite-and-board/i18n",
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
+    "name": "i18n",
+    "tags": [
+      "type:i18n"
+    ]
+  }
+}
diff --git a/libs/i18n/src/he.json b/libs/i18n/src/he.json
new file mode 100644
index 0000000..630b4f9
--- /dev/null
+++ b/libs/i18n/src/he.json
@@ -0,0 +1,25 @@
+{
+  "app": {
+    "name": "ביס & סיר",
+    "pageTitle": "{{page}} · ביס & סיר"
+  },
+  "theme": {
+    "toggle": {
+      "system": "צבעים: לפי המכשיר",
+      "light": "צבעים: בהיר",
+      "dark": "צבעים: כהה"
+    }
+  },
+  "home": {
+    "title": "מתכונים"
+  },
+  "notFound": {
+    "title": "הדף לא נמצא",
+    "body": "אופס...העמוד לא נמצא",
+    "back": "חזרה לרשימה"
+  },
+  "error": {
+    "title": "משהו השתבש",
+    "body": "אפשר לרענן ולנסות שוב"
+  }
+}
diff --git a/libs/i18n/src/he.spec.ts b/libs/i18n/src/he.spec.ts
new file mode 100644
index 0000000..2748529
--- /dev/null
+++ b/libs/i18n/src/he.spec.ts
@@ -0,0 +1,34 @@
+import { initI18n } from './i18n';
+import he from './he.json';
+
+function values(node: unknown): string[] {
+  return typeof node === 'string'
+    ? [node]
+    : Object.values(node as Record<string, unknown>).flatMap(values);
+}
+
+describe('he.json', () => {
+  const strings = values(he);
+
+  it('names the product ביס & סיר', () => {
+    expect(he.app.name).toBe('ביס & סיר');
+  });
+
+  it('follows the voice: no exclamation marks or emoji', () => {
+    for (const text of strings) {
+      expect(text).not.toMatch(/!|\p{Extended_Pictographic}/u);
+    }
+  });
+});
+
+describe('initI18n', () => {
+  it('translates in Hebrew without escaping interpolated values', () => {
+    const i18n = initI18n();
+    expect(i18n.language).toBe('he');
+    expect(i18n.t('notFound.back')).toBe('חזרה לרשימה');
+    expect(i18n.t('app.pageTitle', { page: 'א & ב' })).toBe(
+      'א & ב · ביס & סיר',
+    );
+    expect(initI18n()).toBe(i18n);
+  });
+});
diff --git a/libs/i18n/src/i18n.ts b/libs/i18n/src/i18n.ts
new file mode 100644
index 0000000..6b90a0a
--- /dev/null
+++ b/libs/i18n/src/i18n.ts
@@ -0,0 +1,31 @@
+import i18next from 'i18next';
+import { initReactI18next } from 'react-i18next';
+import he from './he.json';
+
+export const defaultNS = 'translation';
+
+export const resources = { he: { [defaultNS]: he } } as const;
+
+declare module 'i18next' {
+  interface CustomTypeOptions {
+    defaultNS: typeof defaultNS;
+    resources: (typeof resources)['he'];
+  }
+}
+
+/** Starts i18next with the bundled Hebrew strings; safe to call more than once. */
+export function initI18n() {
+  if (!i18next.isInitialized) {
+    void i18next.use(initReactI18next).init({
+      lng: 'he',
+      fallbackLng: 'he',
+      defaultNS,
+      resources,
+      // Resources are bundled, so init finishes synchronously.
+      initAsync: false,
+      // React escapes on render; escaping here would print `&amp;`.
+      interpolation: { escapeValue: false },
+    });
+  }
+  return i18next;
+}
diff --git a/libs/i18n/src/index.ts b/libs/i18n/src/index.ts
new file mode 100644
index 0000000..238fece
--- /dev/null
+++ b/libs/i18n/src/index.ts
@@ -0,0 +1 @@
+export { defaultNS, initI18n, resources } from './i18n';
diff --git a/libs/i18n/tsconfig.json b/libs/i18n/tsconfig.json
new file mode 100644
index 0000000..62ebbd9
--- /dev/null
+++ b/libs/i18n/tsconfig.json
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
diff --git a/libs/i18n/tsconfig.lib.json b/libs/i18n/tsconfig.lib.json
new file mode 100644
index 0000000..8d71e76
--- /dev/null
+++ b/libs/i18n/tsconfig.lib.json
@@ -0,0 +1,30 @@
+{
+  "extends": "../../tsconfig.base.json",
+  "compilerOptions": {
+    "rootDir": "src",
+    "outDir": "dist",
+    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
+    "emitDeclarationOnly": true,
+    "forceConsistentCasingInFileNames": true,
+    "types": [],
+    "module": "esnext",
+    "moduleResolution": "bundler",
+    "resolveJsonModule": true
+  },
+  "include": ["src/**/*.ts", "src/**/*.json"],
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
diff --git a/libs/i18n/tsconfig.spec.json b/libs/i18n/tsconfig.spec.json
new file mode 100644
index 0000000..1a18915
--- /dev/null
+++ b/libs/i18n/tsconfig.spec.json
@@ -0,0 +1,37 @@
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
+    "forceConsistentCasingInFileNames": true,
+    "module": "esnext",
+    "moduleResolution": "bundler",
+    "resolveJsonModule": true
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
diff --git a/libs/i18n/vitest.config.mts b/libs/i18n/vitest.config.mts
new file mode 100644
index 0000000..d6d430d
--- /dev/null
+++ b/libs/i18n/vitest.config.mts
@@ -0,0 +1,18 @@
+import { defineConfig } from 'vitest/config';
+
+export default defineConfig(() => ({
+  root: import.meta.dirname,
+  cacheDir: '../../node_modules/.vite/libs/i18n',
+  test: {
+    name: 'i18n',
+    watch: false,
+    globals: true,
+    environment: 'node',
+    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
+    reporters: ['default'],
+    coverage: {
+      reportsDirectory: './test-output/vitest/coverage',
+      provider: 'v8' as const,
+    },
+  },
+}));
diff --git a/libs/ui-components/README.md b/libs/ui-components/README.md
index e95777b..aef5979 100644
--- a/libs/ui-components/README.md
+++ b/libs/ui-components/README.md
@@ -2,6 +2,11 @@

 Presentational React components: props in, callbacks out, design tokens only.

-- Tag `type:ui`: may import `recipe-domain` only, and lint bans TanStack Query, the generated API client and React Router.
+- Tag `type:ui`: may import `recipe-domain` only, and lint bans TanStack Query, the generated API client, React Router and i18next (copy comes in as props).

 Run `npx nx test ui-components`.
+
+## Theme and shadcn
+
+- `src/styles/theme.css` is the single theme (DESIGN.md tokens, radii, type roles, Rubik); apps import it as `@bite-and-board/ui-components/theme.css`.
+- `components.json` targets this lib (`radix-nova`, `rtl: true`). Files added with `npx shadcn add` need two edits before lint passes: `#lib/...` / `#components/...` imports become relative imports, and arbitrary values (`size-[...]`) become token utilities.
diff --git a/libs/ui-components/components.json b/libs/ui-components/components.json
new file mode 100644
index 0000000..0dc2b5e
--- /dev/null
+++ b/libs/ui-components/components.json
@@ -0,0 +1,25 @@
+{
+  "$schema": "https://ui.shadcn.com/schema.json",
+  "style": "radix-nova",
+  "rsc": false,
+  "tsx": true,
+  "tailwind": {
+    "config": "",
+    "css": "src/styles/theme.css",
+    "baseColor": "neutral",
+    "cssVariables": true,
+    "prefix": ""
+  },
+  "iconLibrary": "lucide",
+  "rtl": true,
+  "aliases": {
+    "components": "#components",
+    "utils": "#lib/utils",
+    "ui": "#components/ui",
+    "lib": "#lib",
+    "hooks": "#hooks"
+  },
+  "menuColor": "default",
+  "menuAccent": "subtle",
+  "registries": {}
+}
diff --git a/libs/ui-components/package.json b/libs/ui-components/package.json
index bcd5fd4..7c53c52 100644
--- a/libs/ui-components/package.json
+++ b/libs/ui-components/package.json
@@ -11,7 +11,14 @@
       "import": "./src/index.ts",
       "default": "./src/index.ts"
     },
-    "./package.json": "./package.json"
+    "./package.json": "./package.json",
+    "./theme.css": "./src/styles/theme.css"
+  },
+  "imports": {
+    "#components/ui/*": "./src/components/ui/*.tsx",
+    "#components/*": "./src/components/*.tsx",
+    "#lib/*": "./src/lib/*.ts",
+    "#hooks/*": "./src/hooks/*.ts"
   },
   "nx": {
     "name": "ui-components",
diff --git a/libs/ui-components/src/components/board.spec.tsx b/libs/ui-components/src/components/board.spec.tsx
new file mode 100644
index 0000000..3ca96ed
--- /dev/null
+++ b/libs/ui-components/src/components/board.spec.tsx
@@ -0,0 +1,17 @@
+import { render, screen } from '@testing-library/react';
+import { Board } from './board';
+
+describe('Board', () => {
+  it('renders its content on the oak slab with a decorative handle slot', () => {
+    const { container } = render(
+      <Board aria-label="מצרכים">
+        <p>2 כפיות כמון</p>
+      </Board>,
+    );
+    const board = screen.getByLabelText('מצרכים');
+    expect(board.className).toContain('bg-board');
+    expect(board.className).toContain('rounded-board');
+    expect(screen.getByText('2 כפיות כמון')).toBeTruthy();
+    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
+  });
+});
diff --git a/libs/ui-components/src/components/board.tsx b/libs/ui-components/src/components/board.tsx
new file mode 100644
index 0000000..4bf7fc6
--- /dev/null
+++ b/libs/ui-components/src/components/board.tsx
@@ -0,0 +1,26 @@
+import type * as React from 'react';
+import { cn } from '../lib/utils';
+
+/** The oak cutting-board slab with its handle slot; food surfaces only (DESIGN.md). */
+export function Board({
+  className,
+  children,
+  ...props
+}: React.ComponentProps<'div'>) {
+  return (
+    <div
+      data-slot="board"
+      className={cn(
+        'relative rounded-board bg-board p-4.5 pt-9 text-board-foreground',
+        className,
+      )}
+      {...props}
+    >
+      <span
+        aria-hidden="true"
+        className="absolute inset-x-0 top-3 mx-auto h-3 w-11 rounded-full bg-background"
+      />
+      {children}
+    </div>
+  );
+}
diff --git a/libs/ui-components/src/components/theme-toggle.spec.tsx b/libs/ui-components/src/components/theme-toggle.spec.tsx
new file mode 100644
index 0000000..bc52d76
--- /dev/null
+++ b/libs/ui-components/src/components/theme-toggle.spec.tsx
@@ -0,0 +1,37 @@
+import { fireEvent, render, screen } from '@testing-library/react';
+import { nextThemeMode, ThemeToggle } from './theme-toggle';
+
+describe('nextThemeMode', () => {
+  it('cycles system → light → dark → system', () => {
+    expect(nextThemeMode('system')).toBe('light');
+    expect(nextThemeMode('light')).toBe('dark');
+    expect(nextThemeMode('dark')).toBe('system');
+  });
+});
+
+describe('ThemeToggle', () => {
+  it('is a labelled button that asks for the next mode', () => {
+    const onValueChange = vi.fn();
+    render(
+      <ThemeToggle
+        value="light"
+        onValueChange={onValueChange}
+        label="ערכת נושא: בהירה"
+      />,
+    );
+    fireEvent.click(screen.getByRole('button', { name: 'ערכת נושא: בהירה' }));
+    expect(onValueChange).toHaveBeenCalledWith('dark');
+  });
+
+  it('shows a different icon for each mode', () => {
+    const icons = (['system', 'light', 'dark'] as const).map((mode) => {
+      const { container, unmount } = render(
+        <ThemeToggle value={mode} onValueChange={vi.fn()} label={mode} />,
+      );
+      const svgClass = container.querySelector('svg')?.getAttribute('class');
+      unmount();
+      return svgClass;
+    });
+    expect(new Set(icons).size).toBe(3);
+  });
+});
diff --git a/libs/ui-components/src/components/theme-toggle.tsx b/libs/ui-components/src/components/theme-toggle.tsx
new file mode 100644
index 0000000..3864400
--- /dev/null
+++ b/libs/ui-components/src/components/theme-toggle.tsx
@@ -0,0 +1,35 @@
+import { Monitor, Moon, Sun } from 'lucide-react';
+import { Button } from './ui/button';
+
+export type ThemeMode = 'system' | 'light' | 'dark';
+
+const ORDER: readonly ThemeMode[] = ['system', 'light', 'dark'];
+
+const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;
+
+export function nextThemeMode(mode: ThemeMode): ThemeMode {
+  return ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
+}
+
+export interface ThemeToggleProps {
+  value: ThemeMode;
+  onValueChange: (mode: ThemeMode) => void;
+  /** Accessible name; it should say which mode is active. */
+  label: string;
+}
+
+/** Icon button that cycles system → light → dark and shows the active mode. */
+export function ThemeToggle({ value, onValueChange, label }: ThemeToggleProps) {
+  const Icon = ICONS[value];
+  return (
+    <Button
+      variant="ghost"
+      size="icon"
+      aria-label={label}
+      title={label}
+      onClick={() => onValueChange(nextThemeMode(value))}
+    >
+      <Icon aria-hidden="true" />
+    </Button>
+  );
+}
diff --git a/libs/ui-components/src/components/top-bar.spec.tsx b/libs/ui-components/src/components/top-bar.spec.tsx
new file mode 100644
index 0000000..38dba1b
--- /dev/null
+++ b/libs/ui-components/src/components/top-bar.spec.tsx
@@ -0,0 +1,22 @@
+import { render, screen, within } from '@testing-library/react';
+import { TopBar, Wordmark } from './top-bar';
+
+describe('TopBar', () => {
+  it('renders the brand and the actions inside the banner', () => {
+    render(
+      <TopBar
+        brand={
+          <Wordmark asChild>
+            <a href="/">ביס &amp; סיר</a>
+          </Wordmark>
+        }
+        actions={<button type="button">פעולה</button>}
+      />,
+    );
+    const banner = screen.getByRole('banner');
+    const wordmark = within(banner).getByRole('link', { name: 'ביס & סיר' });
+    expect(wordmark.getAttribute('href')).toBe('/');
+    expect(wordmark.className).toContain('text-title');
+    expect(within(banner).getByRole('button', { name: 'פעולה' })).toBeTruthy();
+  });
+});
diff --git a/libs/ui-components/src/components/top-bar.tsx b/libs/ui-components/src/components/top-bar.tsx
new file mode 100644
index 0000000..ebe42b1
--- /dev/null
+++ b/libs/ui-components/src/components/top-bar.tsx
@@ -0,0 +1,41 @@
+import type * as React from 'react';
+import { Slot } from 'radix-ui';
+import { cn } from '../lib/utils';
+
+export interface TopBarProps {
+  /** The wordmark, usually a router link wrapped in `Wordmark`. */
+  brand: React.ReactNode;
+  /** Trailing controls (theme toggle, account menu). */
+  actions?: React.ReactNode;
+  className?: string;
+}
+
+/** The app's only navigation bar: wordmark at the start, actions at the end. */
+export function TopBar({ brand, actions, className }: TopBarProps) {
+  return (
+    <header className={cn('bg-background', className)}>
+      <div className="mx-auto flex h-16 max-w-library items-center justify-between gap-3 px-4 lg:px-8">
+        {brand}
+        <div className="flex items-center gap-2">{actions}</div>
+      </div>
+    </header>
+  );
+}
+
+/** The ביס & סיר wordmark styling; `asChild` lets a router link carry it. */
+export function Wordmark({
+  asChild = false,
+  className,
+  ...props
+}: React.ComponentProps<'a'> & { asChild?: boolean }) {
+  const Comp = asChild ? Slot.Root : 'a';
+  return (
+    <Comp
+      className={cn(
+        'rounded-sm text-title text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring',
+        className,
+      )}
+      {...props}
+    />
+  );
+}
diff --git a/libs/ui-components/src/components/ui/button.spec.tsx b/libs/ui-components/src/components/ui/button.spec.tsx
new file mode 100644
index 0000000..4c2c677
--- /dev/null
+++ b/libs/ui-components/src/components/ui/button.spec.tsx
@@ -0,0 +1,28 @@
+import { render, screen } from '@testing-library/react';
+import { Button } from './button';
+
+describe('Button', () => {
+  it('renders a pill button that meets the 44px touch target', () => {
+    render(<Button>שמירה</Button>);
+    const button = screen.getByRole('button', { name: 'שמירה' });
+    expect(button.className).toContain('rounded-full');
+    expect(button.className).toContain('h-11');
+  });
+
+  it('renders its child element with asChild', () => {
+    render(
+      <Button asChild>
+        <a href="/">חזרה לרשימה</a>
+      </Button>,
+    );
+    const link = screen.getByRole('link', { name: 'חזרה לרשימה' });
+    expect(link.getAttribute('data-slot')).toBe('button');
+  });
+
+  it('lets a caller className win over the variant', () => {
+    render(<Button className="bg-secondary">x</Button>);
+    const { classList } = screen.getByRole('button');
+    expect(classList.contains('bg-secondary')).toBe(true);
+    expect(classList.contains('bg-primary')).toBe(false);
+  });
+});
diff --git a/libs/ui-components/src/components/ui/button.tsx b/libs/ui-components/src/components/ui/button.tsx
new file mode 100644
index 0000000..592fa7b
--- /dev/null
+++ b/libs/ui-components/src/components/ui/button.tsx
@@ -0,0 +1,63 @@
+import * as React from 'react';
+import { cva, type VariantProps } from 'class-variance-authority';
+import { Slot } from 'radix-ui';
+import { cn } from '../../lib/utils';
+
+// shadcn Button (radix-nova). Deviations: every button is a pill, the default and
+// icon sizes meet the 44px touch target, and shadcn's arbitrary values are
+// replaced with theme tokens.
+const buttonVariants = cva(
+  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-label whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
+  {
+    variants: {
+      variant: {
+        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
+        outline:
+          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
+        secondary:
+          'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
+        ghost:
+          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
+        destructive:
+          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
+        link: 'text-primary underline-offset-4 hover:underline',
+      },
+      size: {
+        default:
+          'h-11 gap-1.5 px-5 has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4',
+        lg: 'h-12 gap-1.5 px-6 has-data-[icon=inline-end]:pe-5 has-data-[icon=inline-start]:ps-5',
+        icon: 'size-11',
+        'icon-lg': 'size-12',
+      },
+    },
+    defaultVariants: {
+      variant: 'default',
+      size: 'default',
+    },
+  },
+);
+
+function Button({
+  className,
+  variant = 'default',
+  size = 'default',
+  asChild = false,
+  ...props
+}: React.ComponentProps<'button'> &
+  VariantProps<typeof buttonVariants> & {
+    asChild?: boolean;
+  }) {
+  const Comp = asChild ? Slot.Root : 'button';
+
+  return (
+    <Comp
+      data-slot="button"
+      data-variant={variant}
+      data-size={size}
+      className={cn(buttonVariants({ variant, size, className }))}
+      {...props}
+    />
+  );
+}
+
+export { Button, buttonVariants };
diff --git a/libs/ui-components/src/components/ui/direction.tsx b/libs/ui-components/src/components/ui/direction.tsx
new file mode 100644
index 0000000..af924b8
--- /dev/null
+++ b/libs/ui-components/src/components/ui/direction.tsx
@@ -0,0 +1,20 @@
+import * as React from 'react';
+import { Direction } from 'radix-ui';
+
+function DirectionProvider({
+  dir,
+  direction,
+  children,
+}: React.ComponentProps<typeof Direction.DirectionProvider> & {
+  direction?: React.ComponentProps<typeof Direction.DirectionProvider>['dir'];
+}) {
+  return (
+    <Direction.DirectionProvider dir={direction ?? dir}>
+      {children}
+    </Direction.DirectionProvider>
+  );
+}
+
+const useDirection = Direction.useDirection;
+
+export { DirectionProvider, useDirection };
diff --git a/libs/ui-components/src/index.ts b/libs/ui-components/src/index.ts
index cb0ff5c..66531c3 100644
--- a/libs/ui-components/src/index.ts
+++ b/libs/ui-components/src/index.ts
@@ -1 +1,11 @@
-export {};
+export { cn } from './lib/utils';
+export { Button, buttonVariants } from './components/ui/button';
+export { DirectionProvider, useDirection } from './components/ui/direction';
+export { Board } from './components/board';
+export {
+  ThemeToggle,
+  nextThemeMode,
+  type ThemeMode,
+  type ThemeToggleProps,
+} from './components/theme-toggle';
+export { TopBar, Wordmark, type TopBarProps } from './components/top-bar';
diff --git a/libs/ui-components/src/lib/utils.ts b/libs/ui-components/src/lib/utils.ts
new file mode 100644
index 0000000..41a11c8
--- /dev/null
+++ b/libs/ui-components/src/lib/utils.ts
@@ -0,0 +1,27 @@
+import { clsx, type ClassValue } from 'clsx';
+import { extendTailwindMerge } from 'tailwind-merge';
+
+// tailwind-merge only knows Tailwind's default scales; without these, a theme
+// size like `text-title` would be read as a colour and drop `text-foreground`.
+const twMerge = extendTailwindMerge({
+  extend: {
+    theme: {
+      text: [
+        'display',
+        'display-lg',
+        'title',
+        'heading',
+        'body',
+        'quantity',
+        'label',
+        'annotation',
+      ],
+      radius: ['board'],
+      container: ['library', 'detail'],
+    },
+  },
+});
+
+export function cn(...inputs: ClassValue[]) {
+  return twMerge(clsx(inputs));
+}
diff --git a/libs/ui-components/src/styles/theme-contrast.spec.ts b/libs/ui-components/src/styles/theme-contrast.spec.ts
new file mode 100644
index 0000000..66cbd30
--- /dev/null
+++ b/libs/ui-components/src/styles/theme-contrast.spec.ts
@@ -0,0 +1,67 @@
+import { readFileSync } from 'node:fs';
+import { join } from 'node:path';
+
+const css = readFileSync(join(import.meta.dirname, 'theme.css'), 'utf8');
+
+function tokens(selector: string): Record<string, string> {
+  const start = css.indexOf(`${selector} {`);
+  const block = css.slice(start, css.indexOf('}', start));
+  return Object.fromEntries(
+    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(([, n, v]) => [
+      n,
+      v,
+    ]),
+  );
+}
+
+function luminance(hex: string): number {
+  const [r, g, b] = [1, 3, 5].map((i) => {
+    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
+    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
+  });
+  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
+}
+
+function contrast(a: string, b: string): number {
+  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
+  return (hi + 0.05) / (lo + 0.05);
+}
+
+// Every text-on-surface pair the UI uses (DESIGN.md Colors).
+const TEXT_PAIRS: [text: string, surface: string][] = [
+  ['foreground', 'background'],
+  ['card-foreground', 'card'],
+  ['popover-foreground', 'popover'],
+  ['primary-foreground', 'primary'],
+  ['secondary-foreground', 'secondary'],
+  ['muted-foreground', 'background'],
+  ['muted-foreground', 'muted'],
+  ['muted-foreground', 'card'],
+  ['accent-foreground', 'accent'],
+  ['destructive-foreground', 'destructive'],
+  ['destructive', 'background'],
+  ['board-foreground', 'board'],
+  ['hint', 'board'],
+  ['hint-muted', 'card'],
+  ['hint-muted', 'background'],
+  ['flag', 'background'],
+  ['flag', 'card'],
+  ['primary', 'background'],
+];
+
+describe.each([':root', '.dark'])('theme %s', (selector) => {
+  const theme = tokens(selector);
+
+  it('defines every DESIGN.md colour token', () => {
+    expect(Object.keys(theme)).toHaveLength(24);
+  });
+
+  it.each(TEXT_PAIRS)('%s on %s meets WCAG AA (4.5:1)', (text, surface) => {
+    expect(contrast(theme[text], theme[surface])).toBeGreaterThanOrEqual(4.5);
+  });
+
+  it('focus ring is visible on the page and card (3:1)', () => {
+    expect(contrast(theme.ring, theme.background)).toBeGreaterThanOrEqual(3);
+    expect(contrast(theme.ring, theme.card)).toBeGreaterThanOrEqual(3);
+  });
+});
diff --git a/libs/ui-components/src/styles/theme.css b/libs/ui-components/src/styles/theme.css
new file mode 100644
index 0000000..c983652
--- /dev/null
+++ b/libs/ui-components/src/styles/theme.css
@@ -0,0 +1,162 @@
+/*
+ * The ביס & סיר theme: the one place colours, radii and type are defined
+ * (DESIGN.md, direction B "The Board"). Components use only the Tailwind
+ * classes generated from these tokens.
+ */
+@import 'tailwindcss';
+@import 'tw-animate-css';
+@import 'shadcn/tailwind.css';
+@import '@fontsource/rubik/400.css';
+@import '@fontsource/rubik/600.css';
+@import '@fontsource/rubik/800.css';
+
+@source '../';
+
+@custom-variant dark (&:is(.dark *));
+
+:root {
+  --background: #efeeea;
+  --foreground: #1e1b18;
+  --card: #faf9f6;
+  --card-foreground: #1e1b18;
+  --popover: #faf9f6;
+  --popover-foreground: #1e1b18;
+  --primary: #1e1b18;
+  --primary-foreground: #f5e9d8;
+  --secondary: #e2e0da;
+  --secondary-foreground: #1e1b18;
+  --muted: #e2e0da;
+  --muted-foreground: #5f574f;
+  --accent: #e2e0da;
+  --accent-foreground: #1e1b18;
+  --destructive: #b42318;
+  --destructive-foreground: #ffffff;
+  --border: #d9d6cf;
+  --input: #d9d6cf;
+  --ring: #1e1b18;
+  --board: #d6a46a;
+  --board-foreground: #24190e;
+  --hint: #4f3a22;
+  --hint-muted: #5f574f;
+  --flag: #a1440a;
+  color-scheme: light;
+}
+
+.dark {
+  --background: #1a1816;
+  --foreground: #f3ece3;
+  --card: #242120;
+  --card-foreground: #f3ece3;
+  --popover: #242120;
+  --popover-foreground: #f3ece3;
+  --primary: #d6a46a;
+  --primary-foreground: #1a1208;
+  --secondary: #2e2a27;
+  --secondary-foreground: #f3ece3;
+  --muted: #2e2a27;
+  --muted-foreground: #b9ada0;
+  --accent: #2e2a27;
+  --accent-foreground: #f3ece3;
+  --destructive: #f97066;
+  --destructive-foreground: #1a0705;
+  --border: #3a3531;
+  --input: #3a3531;
+  --ring: #d6a46a;
+  --board: #73502e;
+  --board-foreground: #fbf1e3;
+  --hint: #f0d7b6;
+  --hint-muted: #b9ada0;
+  --flag: #f5a35c;
+  color-scheme: dark;
+}
+
+@theme inline {
+  --color-background: var(--background);
+  --color-foreground: var(--foreground);
+  --color-card: var(--card);
+  --color-card-foreground: var(--card-foreground);
+  --color-popover: var(--popover);
+  --color-popover-foreground: var(--popover-foreground);
+  --color-primary: var(--primary);
+  --color-primary-foreground: var(--primary-foreground);
+  --color-secondary: var(--secondary);
+  --color-secondary-foreground: var(--secondary-foreground);
+  --color-muted: var(--muted);
+  --color-muted-foreground: var(--muted-foreground);
+  --color-accent: var(--accent);
+  --color-accent-foreground: var(--accent-foreground);
+  --color-destructive: var(--destructive);
+  --color-destructive-foreground: var(--destructive-foreground);
+  --color-border: var(--border);
+  --color-input: var(--input);
+  --color-ring: var(--ring);
+  --color-board: var(--board);
+  --color-board-foreground: var(--board-foreground);
+  --color-hint: var(--hint);
+  --color-hint-muted: var(--hint-muted);
+  --color-flag: var(--flag);
+}
+
+@theme {
+  --font-sans: 'Rubik', system-ui, sans-serif;
+  --font-heading: var(--font-sans);
+
+  --radius-sm: 0.5rem;
+  --radius-md: 0.75rem;
+  --radius-lg: 1rem;
+  --radius-board: 1.5rem;
+
+  /* Content widths (DESIGN.md Layout): library 1200px, detail ~1040px. */
+  --container-library: 75rem;
+  --container-detail: 65rem;
+
+  /* Typography roles; `-lg` sizes are applied with the `lg:` variant. */
+  --text-display: 2.5rem;
+  --text-display--line-height: 1;
+  --text-display--letter-spacing: -0.02em;
+  --text-display--font-weight: 800;
+  --text-display-lg: 3.5rem;
+  --text-display-lg--line-height: 1;
+  --text-display-lg--letter-spacing: -0.02em;
+  --text-display-lg--font-weight: 800;
+  --text-title: 1.5rem;
+  --text-title--line-height: 1.15;
+  --text-title--letter-spacing: -0.01em;
+  --text-title--font-weight: 800;
+  --text-heading: 1.125rem;
+  --text-heading--line-height: 1.3;
+  --text-heading--font-weight: 600;
+  --text-body: 1rem;
+  --text-body--line-height: 1.55;
+  --text-body--font-weight: 400;
+  --text-quantity: 1.25rem;
+  --text-quantity--line-height: 1.2;
+  --text-quantity--font-weight: 800;
+  --text-label: 0.875rem;
+  --text-label--line-height: 1.4;
+  --text-label--font-weight: 600;
+  /* DESIGN.md's "hint" type role; named apart from the `hint` colour. */
+  --text-annotation: 0.875rem;
+  --text-annotation--line-height: 1.3;
+  --text-annotation--font-weight: 600;
+}
+
+@layer base {
+  * {
+    @apply border-border outline-ring;
+  }
+  html {
+    @apply font-sans;
+  }
+  body {
+    @apply bg-background text-body text-foreground;
+  }
+  @media (prefers-reduced-motion: reduce) {
+    *,
+    *::before,
+    *::after {
+      transition-property: opacity !important;
+      animation: none !important;
+    }
+  }
+}
diff --git a/libs/ui-components/tsconfig.lib.json b/libs/ui-components/tsconfig.lib.json
index 7c58263..c9b3659 100644
--- a/libs/ui-components/tsconfig.lib.json
+++ b/libs/ui-components/tsconfig.lib.json
@@ -11,7 +11,8 @@
     "jsx": "react-jsx",
     "module": "esnext",
     "moduleResolution": "bundler",
-    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo"
+    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
+    "lib": ["es2022", "dom", "dom.iterable"]
   },
   "exclude": [
     "out-tsc",
diff --git a/libs/ui-components/tsconfig.spec.json b/libs/ui-components/tsconfig.spec.json
index 60ca21b..fceeed2 100644
--- a/libs/ui-components/tsconfig.spec.json
+++ b/libs/ui-components/tsconfig.spec.json
@@ -11,7 +11,8 @@
     ],
     "jsx": "react-jsx",
     "module": "esnext",
-    "moduleResolution": "bundler"
+    "moduleResolution": "bundler",
+    "lib": ["es2022", "dom", "dom.iterable"]
   },
   "include": [
     "vite.config.ts",
diff --git a/package.json b/package.json
index 9ceacfb..f65fba1 100644
--- a/package.json
+++ b/package.json
@@ -25,6 +25,7 @@
     "@swc/cli": "~0.8.1",
     "@swc/core": "1.15.8",
     "@swc/helpers": "0.5.18",
+    "@tailwindcss/vite": "4.3.3",
     "@testing-library/dom": "10.4.0",
     "@testing-library/react": "16.3.0",
     "@types/node": "^24.0.0",
@@ -45,7 +46,10 @@
     "jsdom": "^27.1.0",
     "nx": "24.0.0",
     "prettier": "^3.8.1",
+    "shadcn": "4.22.1",
+    "tailwindcss": "4.3.3",
     "tslib": "^2.3.0",
+    "tw-animate-css": "1.4.0",
     "typescript": "~6.0.3",
     "typescript-eslint": "^8.58.0",
     "vite": "^8.0.0",
@@ -58,8 +62,16 @@
   ],
   "packageManager": "npm@12.1.0",
   "dependencies": {
+    "@fontsource/rubik": "5.3.0",
+    "class-variance-authority": "0.7.1",
+    "clsx": "2.1.1",
+    "i18next": "26.5.11",
+    "lucide-react": "1.61.0",
+    "radix-ui": "1.8.1",
     "react": "^19.2.7",
     "react-dom": "^19.2.7",
-    "react-router": "8.5.0"
+    "react-i18next": "17.1.9",
+    "react-router": "8.5.0",
+    "tailwind-merge": "3.7.0"
   }
 }
diff --git a/tools/lint-checks/package.json b/tools/lint-checks/package.json
index ae4a7b9..907e535 100644
--- a/tools/lint-checks/package.json
+++ b/tools/lint-checks/package.json
@@ -23,6 +23,7 @@
       "ui-components",
       "data-access",
       "recipe-domain",
+      "i18n",
       "recipe-service"
     ],
     "targets": {
diff --git a/tools/lint-checks/src/eslint-rules.spec.ts b/tools/lint-checks/src/eslint-rules.spec.ts
index 6638a8c..ff24bdc 100644
--- a/tools/lint-checks/src/eslint-rules.spec.ts
+++ b/tools/lint-checks/src/eslint-rules.spec.ts
@@ -123,6 +123,48 @@ describe('colour literals', () => {
   );
 });

+describe('Hebrew literals', () => {
+  const HEBREW_RULE = ['no-restricted-syntax'];
+
+  it.each([
+    ['JSX text', 'export const A = () => <p>שלום</p>;\n'],
+    ['an attribute', 'export const A = () => <p aria-label="שלום" />;\n'],
+    ['a string', "export const s = 'שלום';\n"],
+    ['a template literal', 'export const s = (n: number) => `${n} מנות`;\n'],
+  ])('rejects Hebrew in %s outside he.json', async (_, code) => {
+    expect(rulesOf(await lint('apps/web', code))).toEqual(HEBREW_RULE);
+    expect(rulesOf(await lint('libs/ui-components', code))).toEqual(
+      HEBREW_RULE,
+    );
+  });
+
+  it('allows Hebrew in spec files, which assert on the rendered copy', async () => {
+    const messages = await lint(
+      'apps/web',
+      "export const A = () => <p>שלום</p>;\nexport const s = 'שלום';\n",
+      'src/fixture.spec.tsx',
+    );
+    expect(messages).toEqual([]);
+  });
+
+  it('keeps colour literals banned in spec files', async () => {
+    const messages = await lint(
+      'apps/web',
+      "export const c = '#ff0000';\n",
+      'src/fixture.spec.ts',
+    );
+    expect(rulesOf(messages)).toEqual(['no-restricted-syntax']);
+  });
+
+  it('accepts translated copy', async () => {
+    const messages = await lint(
+      'apps/web',
+      "declare function t(key: string): string;\nexport const A = () => <p>{t('home.title')}</p>;\n",
+    );
+    expect(messages).toEqual([]);
+  });
+});
+
 describe('style prop', () => {
   const code =
     'import type { FC } from "react";\nexport const A = ({ C }: { C: FC<{ style?: object }> }) => <><div style={{}} /><C style={{}} /></>;\n';
@@ -174,6 +216,10 @@ describe('module boundaries', () => {
   it.each([
     ['libs/ui-components', '@bite-and-board/data-access'],
     ['libs/ui-components', 'react-router'],
+    ['libs/ui-components', '@bite-and-board/i18n'],
+    ['libs/ui-components', 'react-i18next'],
+    ['libs/ui-components', 'i18next'],
+    ['libs/i18n', '@bite-and-board/recipe-domain'],
     ['libs/recipe-domain', 'react'],
   ])('%s may not import %s', async (project, target) => {
     const messages = await lint(
@@ -187,6 +233,7 @@ describe('module boundaries', () => {
   it.each([
     ['libs/ui-components', '@bite-and-board/recipe-domain'],
     ['apps/web', '@bite-and-board/ui-components'],
+    ['apps/web', '@bite-and-board/i18n'],
   ])('%s may import %s', async (project, target) => {
     const messages = await lint(
       project,
@@ -210,6 +257,7 @@ describe('module boundaries', () => {
       'type:data-access',
       'type:ui',
       'type:domain',
+      'type:i18n',
     ]);
   });
 });
diff --git a/tools/lint-checks/src/react-compiler.spec.ts b/tools/lint-checks/src/react-compiler.spec.ts
index d8b9ef4..010aa60 100644
--- a/tools/lint-checks/src/react-compiler.spec.ts
+++ b/tools/lint-checks/src/react-compiler.spec.ts
@@ -3,8 +3,8 @@ import { createServer } from 'vite';

 const WORKSPACE = join(import.meta.dirname, '../../..');

-// The memo cache sentinel only appears in components the React Compiler rewrote.
-const COMPILED = 'react.memo_cache_sentinel';
+// Only components the React Compiler rewrote import its memo-cache runtime.
+const COMPILED = /react[/_]compiler-runtime/;

 it('compiles app components with the React Compiler', async () => {
   const root = join(WORKSPACE, 'apps/web');
@@ -18,7 +18,7 @@ it('compiles app components with the React Compiler', async () => {
     const result = await server.transformRequest(
       '/src/app/placeholder-home.tsx',
     );
-    expect(result?.code).toContain(COMPILED);
+    expect(result?.code).toMatch(COMPILED);
   } finally {
     await server.close();
   }
diff --git a/tools/lint-checks/src/tailwind.spec.ts b/tools/lint-checks/src/tailwind.spec.ts
new file mode 100644
index 0000000..c5694c9
--- /dev/null
+++ b/tools/lint-checks/src/tailwind.spec.ts
@@ -0,0 +1,26 @@
+import { join } from 'node:path';
+import { createServer } from 'vite';
+
+const WORKSPACE = join(import.meta.dirname, '../../..');
+
+// Without the Tailwind Vite plugin the app ships unstyled while every other check stays green.
+it('generates the theme tokens and utilities for the app stylesheet', async () => {
+  const root = join(WORKSPACE, 'apps/web');
+  const server = await createServer({
+    configFile: join(root, 'vite.config.mts'),
+    root,
+    logLevel: 'silent',
+    server: { middlewareMode: true, hmr: false },
+  });
+  try {
+    const result = await server.transformRequest('/src/styles.css');
+    const code = result?.code ?? '';
+    for (const utility of ['.bg-board', '.text-title', '.rounded-full']) {
+      expect(code).toContain(utility);
+    }
+    expect(code).toMatch(/:root\s*\{[^}]*--board:/);
+    expect(code).toMatch(/\.dark\s*\{[^}]*--board:/);
+  } finally {
+    await server.close();
+  }
+});
diff --git a/tsconfig.json b/tsconfig.json
index 94f7296..d74ef07 100644
--- a/tsconfig.json
+++ b/tsconfig.json
@@ -17,6 +17,9 @@
     },
     {
       "path": "./tools/lint-checks"
+    },
+    {
+      "path": "./libs/i18n"
     }
   ],
   "compilerOptions": {}
```
