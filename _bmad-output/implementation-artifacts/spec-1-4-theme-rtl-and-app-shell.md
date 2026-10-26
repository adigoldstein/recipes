---
title: 'Story 1.4: Theme, RTL and app shell'
type: 'feature'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'cdb832a180f971303daf09e7481e520822e86919'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-recipes-2026-10-26/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/web` is an unstyled English placeholder (`<html lang="en">`, no Tailwind, no theme, no i18n), so no later screen has the ביס & סיר look, RTL behaviour or copy pipeline to build on.

**Approach:** Install Tailwind 4 and shadcn (Radix base, `--rtl`) into `libs/ui-components` with the DESIGN.md tokens as the single theme; add Rubik, i18next with `he.json`, a theme context (system/light/dark, remembered), and a shell layout (top bar with wordmark + theme toggle, not-found route, focus/title on navigation).

## Boundaries & Constraints

**Always:**

- `<html lang="he" dir="rtl">`; DirectionProvider `rtl` at the root; logical utilities only.
- Every DESIGN.md colour is a CSS variable in `:root` and `.dark`, registered as Tailwind colours (`bg-board`, `text-hint`, `border-flag`…); radii `sm 8 / md 12 / lg 16 / board 24 / full`; typography roles as Tailwind text tokens. Same colours as DESIGN.md.
- `libs/ui-components` stays presentational: no i18next, no router, no storage. Strings and links come in as props/children; the app owns ThemeProvider (AD-8) and i18n.
- Buttons are pills (`rounded-full`), touch targets ≥ 44px (DESIGN.md).
- No Hebrew string literals in TS/TSX outside `he.json` (specs exempt), enforced by lint.
- Exact pinned versions for new packages; `tailwindcss` declared explicitly (deferred from 1.3).
- Copy follows EXPERIENCE.md Voice and Tone; product name "ביס & סיר".

**Never:**

- No other shadcn primitives (1.5), no feature libs (1.9), no account/login UI (Epic 2).
- No changes to the ESLint arbitrary-value or physical-direction bans themselves.

## I/O & Edge-Case Matrix

| Scenario        | Input / State                | Expected Output / Behavior                                                    | Error Handling                  |
| --------------- | ---------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| First visit     | no stored theme, OS dark     | `.dark` on `<html>` before first paint; toggle shows "system"                 | N/A                             |
| Cycle           | click toggle ×3              | system → light → dark → system; stored value follows; `system` clears storage | N/A                             |
| System change   | mode system, OS flips        | theme follows live                                                            | N/A                             |
| Storage blocked | `localStorage` throws        | theme still works for the session                                             | caught, ignored                 |
| Unknown route   | `/nope`                      | top bar + h1 "הדף לא נמצא" + link "חזרה לרשימה" to `/`; title updated         | N/A                             |
| Navigation      | `/nope` → link → `/`         | focus on the new page `h1`; `document.title` changes                          | first load does not steal focus |
| Thrown error    | loader throws                | root error element in Hebrew                                                  | N/A                             |
| Hebrew literal  | `<p>שלום</p>` in a component | lint fails                                                                    | N/A                             |

## Decisions (Adi, 2026-10-26: "all your recommendations")

1. shadcn arbitrary values are replaced with token utilities in our copied files; the lint ban stays unscoped.
2. `he.json`, the i18next init and typed keys live in a new lib `libs/i18n` (tag `type:i18n`, depends on nothing; `type:app` and `type:feature` may import it; `type:ui` may not).
3. Rubik is self-hosted from `@fontsource/rubik` (400/600/800).
4. Icons come from `lucide-react`.
5. Spec kept whole (~2,300 tokens, one goal). New packages stay pinned exactly in `package.json`; CI installs from the lock files.

</frozen-after-approval>

## Code Map

- `apps/web/index.html` -- `lang="en"`, title "Web"; set `lang="he" dir="rtl"`, title "ביס & סיר", tiny inline script adding `.dark` before paint (reads the same storage key as ThemeProvider).
- `apps/web/src/main.tsx` -- add providers: i18n init, DirectionProvider, ThemeProvider around `RouterProvider`.
- `apps/web/src/app/router.tsx` -- root route gets `Component: AppLayout`; children: lazy home, `path: '*'` NotFound (inside the layout, so the top bar stays); keep `errorElement`, `HydrateFallback`.
- `apps/web/src/app/route-error.tsx`, `placeholder-home.tsx` -- English copy → `t()` keys; home `h1` "מתכונים" placeholder until 1.9.
- `apps/web/src/app/router.spec.tsx` -- update assertions to Hebrew; render through providers.
- `apps/web/src/styles.css` -- empty; becomes `@import` of the ui-components theme + `@source` for libs.
- `apps/web/vite.config.mts` -- add `@tailwindcss/vite` before `react()`.
- `libs/i18n/` (new) -- see Decisions 2.
- `libs/ui-components/` -- add `components.json` (style radix-nova, rtl true, css → `src/styles/theme.css`), `src/lib/utils.ts` (`cn` = clsx + `extendTailwindMerge` knowing our text/radius tokens, else `text-title` would be dropped against `text-foreground`), `src/components/ui/button.tsx`, `direction.tsx`, plus `TopBar`, `ThemeToggle`, `Board`; export all from `src/index.ts` and `./theme.css` via `package.json` `exports`.
- `eslint.config.mjs` -- extend the existing `no-restricted-syntax` list (see its comment) with a Hebrew-literal selector; `*.spec.tsx` exempt.
- `tools/lint-checks/src/eslint-rules.spec.ts` -- add fixtures for the Hebrew rule (fail + spec-file pass).
- `package.json` -- add (pinned): `tailwindcss` 4.3.3, `@tailwindcss/vite` 4.3.3, `tw-animate-css`, `radix-ui` 1.8.1, `class-variance-authority`, `clsx`, `tailwind-merge`, `i18next`, `react-i18next`, `@fontsource/rubik`, `lucide-react`.

## Tasks & Acceptance

**Execution:**

- [x] `package.json` -- install pinned deps.
- [x] `libs/ui-components` -- shadcn init/add (button, direction) with `--rtl`; theme CSS from DESIGN.md (hex values, `:root`/`.dark`, `@theme inline` colours, radii, text roles, Rubik); Button adapted to pills/44px with arbitrary values replaced by tokens; TopBar (wordmark + actions slots), ThemeToggle (`value`, `onChange`, labels as props; sun/moon/monitor icon), Board (slab, slot pill `w-11 h-3`, `p-4.5 pt-9`, `rounded-board`).
- [x] `libs/ui-components/src/**/*.spec.tsx` -- Button, ThemeToggle cycle/labels, TopBar, Board render; `theme-contrast.spec.ts` parses the theme CSS and asserts ≥ 4.5:1 for every text/background pair in both themes (fg/bg, card, popover, primary, secondary, muted-fg on bg/muted, accent, destructive, board-fg/board, hint/board, hint-muted/card, flag/bg) and ≥ 3:1 for ring on bg.
- [x] `libs/i18n` -- `nx g @nx/js:library` (bundler none, vitest), tag `type:i18n`; `he.json`, i18next init (`lng: 'he'`), `CustomTypeOptions` typed keys; depConstraints: app/feature may depend on `type:i18n`, which depends on nothing; record in ARCHITECTURE-SPINE (AD-2/AD-33) and memlog.
- [x] `apps/web/src/app/` -- ThemeProvider + `useTheme` (storage key, matchMedia), AppLayout (TopBar, `<Outlet/>`, focus h1 on location change after first load), NotFound page; pages render React 19 `<title>`.
- [x] `apps/web/src/**/*.spec.tsx` -- every I/O row except the lint one.
- [x] `eslint.config.mjs` + `tools/lint-checks` -- Hebrew-literal rule and fixtures.
- [x] `ui-component-inventory.md` -- note Direction added in 1.4; `deferred-work.md` -- mark tailwindcss and arbitrary-value items resolved.

**Acceptance Criteria:**

- Given the repo, when `npx nx run-many -t lint typecheck test build` runs, then all projects pass and `nx format:check` is clean.
- Given `npm run dev`, when `/` and `/nope` open at 375px and desktop in both themes, then RTL layout, Rubik, tokens and the top bar render with no console errors.
- Given `libs/ui-components/components.json`, then it points at `libs/ui-components` paths with `rtl: true`.

## Implementation Notes

- PAUSED (usage limit), 2026-10-26. Done so far: pinned deps installed (`shadcn` 4.22.1 as devDep for the CLI and `shadcn/tailwind.css`; lockfile only adds packages, no version changes); `libs/i18n` generated (placeholder files removed, nothing written yet); `libs/ui-components`: `components.json` (radix-nova, rtl, aliases via package.json subpath `imports` `#lib/*`, `#components/*`), `src/lib/utils.ts` (clsx + extendTailwindMerge), tokenised `button.tsx` (pill, h-11/size-11, xs sizes dropped), `direction.tsx`, `theme-toggle.tsx`, `top-bar.tsx` (TopBar + Wordmark), `board.tsx`, `styles/theme.css` (DESIGN tokens, radii, text roles, containers, Rubik), specs incl. `theme-contrast.spec.ts`. Tests ran; `ui-components:lint` and `:typecheck` FAIL, not yet diagnosed.
- RESUMED 2026-10-26, implementation complete (not yet reviewed, no review file). Lint failures were `#lib/*`/`#components/*` self-imports (Nx wants relative imports inside a project); source now uses relative imports and `components.json` keeps the `#` aliases for the CLI, so `shadcn add` output needs its imports rewritten (noted in the ui-components README). Typecheck failures were a missing `dom` lib in the ui-components tsconfigs. `react-compiler.spec.ts` now checks for the compiler runtime import instead of the memo sentinel (the translated placeholder has no static JSX left). Full `run-many -t lint typecheck test build` green, `format:check` clean; manual check at 375px light/dark and 1280px dark (JS-inspected, pane hidden so no desktop screenshot).
- Previously left: fix those failures; `libs/i18n` (he.json, init, typed keys, voice/tone test) + depConstraints (`type:i18n`; ban i18next/react-i18next in `type:ui`) + spine/memlog; Hebrew-literal lint rule + lint-checks fixtures; apps/web (index.html, Tailwind vite plugin, styles.css, providers, ThemeProvider, AppLayout, NotFound, specs); inventory/deferred-work updates; full verification, review, review file.

## Spec Change Log

## Review Triage Log

Layers: blind-hunter, edge-case-hunter, verification-gap (all ran). Iteration 0.

| #   | Finding                                                                            | Verdict | Evidence                                                                                                            | Route                           |
| --- | ---------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | Focus ring rendered at `/50` alpha; contrast test checks opaque ring (blind, edge) | medium  | Blended dark ring on bg 2.93:1, on card 2.82:1 (light 3.21/3.27); spec asks ≥ 3:1                                   | patch                           |
| 2   | Button `sm`/`icon-sm` are 36px (edge)                                              | medium  | `h-9`/`size-9` contradict "touch targets ≥ 44px"                                                                    | patch                           |
| 3   | `cn` doesn't merge `max-w-library`/`max-w-detail` (edge)                           | low     | tailwind-merge extend lacks `container`; one-line fix                                                               | patch                           |
| 4   | Hebrew exemption only `*.spec.ts(x)` (blind, edge)                                 | low     | vitest include also runs `*.test.*`; glob widening is a direct correction                                           | patch                           |
| 5   | `vi.restoreAllMocks()` inline in pre-paint test (blind, edge, verification)        | low     | failing assertion leaks throwing `getItem` mock                                                                     | patch                           |
| 6   | Button className-override test relies on trailing space (blind)                    | low     | `not.toContain('bg-primary ')` passes if class is last                                                              | patch                           |
| 7   | Dropping `tailwindcss()` leaves every check green (verification gap)               | medium  | no test runs the Tailwind pipeline on `styles.css`                                                                  | patch                           |
| 8   | `main.tsx` provider wiring untested (verification gap)                             | medium  | specs build their own provider tree; fix needs a shared `AppProviders` (structure = Adi's call)                     | defer                           |
| 9   | Border/input tokens ~1.25:1 (light) vs 3:1 non-text contrast (blind)               | medium  | DESIGN.md colours are frozen ("same colours as DESIGN.md"); Input lands in 1.5                                      | defer                           |
| 10  | Spec bookkeeping (change log empty, stale notes, sprint status) (blind)            | low     | fix edits this spec; sprint-status synced at present step                                                           | reject                          |
| 11  | AC2 desktop light + screenshots missing (blind)                                    | low     | orchestrator captured 375 light, 1280 dark; remaining views captured for the review file                            | reject (verification, not code) |
| 12  | Playbook/CLAUDE.md and Prettier table churn in the diff (blind)                    | false   | playbook/CLAUDE.md included at Adi's request; table changes are whitespace-only formatting forced by `format:check` | reject                          |
| 13  | Spine stack table lacks exact pins (blind)                                         | low     | exact pins live in `package.json`; spine records majors                                                             | reject                          |
| 14  | AD-10 / AD-8 references inconsistent (blind)                                       | false   | spine: AD-8 = client state ownership, AD-10 = Hebrew RTL and i18n — both cited correctly                            | reject                          |
| 15  | Root error element replaces shell, no back link (blind)                            | low     | matches matrix row "root error element in Hebrew"; errors are rare and body says to refresh                         | reject                          |
| 16  | Hebrew presentation forms U+FB1D–FB4F not matched (blind, edge)                    | low     | not typed in practice                                                                                               | reject                          |
| 17  | ThemeToggle label states mode, not action; spec label text differs (blind)         | low     | matrix: "toggle shows system"; wording is a copy question for Adi                                                   | reject (raised to Adi)          |
| 18  | No cross-tab theme sync (blind, edge)                                              | low     | not in matrix; fix adds a listener                                                                                  | reject                          |
| 19  | `#hooks/*` import map unused; app `@source` scans specs (blind)                    | low     | CLI alias kept for future hooks; a few extra classes in CSS                                                         | reject                          |
| 20  | No skip link (blind)                                                               | low     | two focusables in top bar today; adds new UI                                                                        | reject                          |
| 21  | Focus lost if new page has no h1 yet (edge)                                        | false   | data router commits after lazy resolves; navigation spec passes with the lazy home                                  | reject                          |
| 22  | Same-page navigation re-focuses h1 (edge)                                          | low     | wordmark click on `/` moves focus to h1; harmless                                                                   | reject                          |
| 23  | Rules don't cover `.mts/.mjs` sources (edge)                                       | low     | app code is ts/tsx only                                                                                             | reject                          |
| 24  | i18n init failure swallowed (edge)                                                 | false   | bundled resources + `initAsync: false`; init cannot reject                                                          | reject                          |
| 25  | ThemeToggle props `onValueChange`/`label` vs spec `onChange`/labels (edge)         | low     | only caller is AppLayout; Radix naming                                                                              | reject                          |

## Design Notes

- Theme state: `'system' | 'light' | 'dark'`; storage key `theme`; `system` removes the key. Effective theme toggles `.dark` on `document.documentElement` and `color-scheme`.
- `document.title`: each page renders `<title>` (React 19 hoists it), e.g. `הדף לא נמצא · ביס & סיר`; home is just `ביס & סיר`. Dynamic titles in 1.10 work the same way.
- Typography tokens: `text-display`, `text-display-lg`, `text-title`, `text-heading`, `text-body`, `text-quantity` (+ `tabular-nums`), `text-label`, `text-annotation` (DESIGN "hint" type; renamed so it does not clash with the `hint` colour).

## Verification

**Commands:**

- `npx nx run-many -t lint typecheck test build --skip-nx-cache` -- expected: all green
- `npx nx format:check` -- expected: clean

**Manual checks:**

- `npm run dev`; Browser pane at 375px and desktop, light/dark: `/`, `/nope`, toggle cycle, reload keeps choice; screenshots attached to the review file.
