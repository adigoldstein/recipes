- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-adapt-the-backend-scaffold.md`
  summary: Validate `LLM_PROVIDERS` (known names, non-empty, `fake` refused unless dev/test, gemini requires `GEMINI_API_KEY`).
  evidence: Settings accepts any list today; no consumer exists until the provider registry story (Epic 5).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-adapt-the-backend-scaffold.md`
  summary: Validate `APP_TIMEZONE` with `ZoneInfo` at load and add the `tzdata` dependency (needed on Windows).
  evidence: Plain `str` today; the daily import cap story is the first consumer.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-adapt-the-backend-scaffold.md`
  summary: Decide a minimum length for `JWT_SECRET` in production.
  evidence: Only blank values are rejected; security policy choice for Adi, natural home Story 2.x.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-adapt-the-backend-scaffold.md`
  summary: Give framework errors (404/405/HTTPException) the `{detail, code}` shape and publish `ErrorResponse` in OpenAPI.
  evidence: FastAPI default bodies lack `code`; AD-28 client mapping lands in Story 1.7.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-adapt-the-backend-scaffold.md`
  summary: Dispose the SQLite engine on app shutdown (lifespan).
  evidence: Engine is cached without a shutdown hook; Story 1.6 adds DB/lifespan.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md`
  summary: Add an automated lint fixture test (ESLint Node API) proving each Nx boundary rule fails a forbidden import (ui → data-access, ui → react-router, domain → react, feature → feature), and re-check the `@tanstack/*`/`@hey-api/*` bans once Story 1.7 installs them.
  evidence: Rules were verified with throwaway probes only; removing a constraint keeps `nx lint` green because no file violates it yet. Natural home Story 1.3.
  resolved: Story 1.3 — `tools/lint-checks/src/eslint-rules.spec.ts` lints fixtures for ui → data-access, ui → react-router and domain → react; feature → feature is asserted on the resolved config until a feature lib exists. The `@tanstack/*`/`@hey-api/*` bans still need a re-check when 1.7 installs them.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md`
  summary: Cover the real app boot (`main.tsx` + `react-router/dom`) and the Vite `/api`, `/media` proxy with an automated check.
  evidence: Only manual runs today; no e2e harness until Story 6.3 (Playwright), app-shell tests from 1.4.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md`
  summary: Re-check the `@tanstack/*`, `@hey-api/*` and `react-router-*` boundary bans with lint fixtures once those packages are installed.
  evidence: Nx only enforces `bannedExternalImports` for packages in the project graph; none of them is installed yet, so the fixtures cannot exercise them (Story 1.7 installs TanStack Query and hey-api).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md`
  summary: Declare `tailwindcss` explicitly (pinned) in `package.json` when Story 1.4 installs Tailwind.
  evidence: It is present today only as an auto-installed peer of `eslint-plugin-better-tailwindcss` (4.3.3 in the lockfile); lint resolves it through hoisting.
  resolved: Story 1.4 — `tailwindcss` 4.3.3 and `@tailwindcss/vite` 4.3.3 are pinned in the root `package.json`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md`
  summary: Decide how shadcn primitives that ship arbitrary values (e.g. `size-[1.15rem]`, `rounded-[4px]`, `max-h-(--radix-…)`) meet the arbitrary-value ban.
  evidence: Arbitrary variants (`data-[state=open]:`) are allowed, but arbitrary values in generated shadcn components will fail lint in Stories 1.4/1.5; options are token replacements or a scoped exception, which is Adi's call.
  resolved: Story 1.4 (Adi, 2026-10-26) — arbitrary values in copied shadcn files are replaced with token utilities; the lint ban stays unscoped. Button is the first file done this way; 1.5 follows the same rule.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-ci-and-quality-gates.md`
  summary: Decide library list loading in Story 1.9 — (a) native `loading="lazy"` images only, (b) plus client-side load-more on scroll via IntersectionObserver, (c) TanStack Virtual; first visible row eager.
  evidence: Adi raised infinite scroll on 2026-10-26; API stays unpaginated (AD-26), so any windowing is client-only. Discuss when 1.9 starts.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-theme-rtl-and-app-shell.md`
  summary: Cover the real app bootstrap (i18n init, DirectionProvider, ThemeProvider in `main.tsx`) with a test, e.g. by extracting a shared `AppProviders` used by `main.tsx` and the specs.
  evidence: Specs build their own provider tree and `test-setup.ts` inits i18n globally, so removing `initI18n()` or `ThemeProvider` from `main.tsx` keeps every check green; structure is Adi's call.
  resolved: Adi (2026-10-26) — scheduled into Story 1.5 as an AC (shared `AppProviders`). Done in Story 1.5: `apps/web/src/app/app-providers.tsx`, plus `main.spec.tsx`, which mounts the real `main.tsx`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-theme-rtl-and-app-shell.md`
  summary: Decide how input/control boundaries meet WCAG 1.4.11 (3:1) before Input ships in 1.5 — the DESIGN.md `--border`/`--input` tokens are ~1.25:1 (light) and ~1.46:1 (dark) on the background.
  evidence: Measured from theme.css; DESIGN.md colours are fixed by the 1.4 spec, so changing them (or using a stronger focus/border treatment for inputs) is a design decision.
  resolved: Adi (2026-10-26) — scheduled into Story 1.5 as an AC (stronger `--input` border token, contrast-tested, Storybook preview for approval). Done in Story 1.5: `--input` light `#857f75`, dark `#7a726a`; `theme-contrast.spec.ts` checks 3:1 on background, card and popover; preview story "Foundations / Input border (for approval)".
- source_spec: `_bmad-output/planning-artifacts/brainstorm-quick-wins.md`
  summary: Search the library by ingredient names, not only titles (needs ingredient names in `RecipeSummary`, or a server-side search).
  evidence: Adi (2026-10-26) wants it as a future feature, not now; it changes the summary shape (Story 1.6) and the filter function (Story 1.9), so decide it together with a larger-library plan.
- source_spec: `_bmad-output/planning-artifacts/brainstorm-quick-wins.md`
  summary: Open Graph link previews (title and photo when a recipe link is shared in WhatsApp), which needs server-set meta tags per recipe page in the production container.
  evidence: Adi (2026-10-26) put it in the future; the SPA serves one HTML shell today, so it is a Story 6.x decision.
