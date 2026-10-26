---
title: 'Story 1.5: UI kit: shadcn primitives in ui-components'
type: 'feature'
created: '2026-10-26'
status: 'draft'
route: 'dispatch'
baseline_commit: '15ca06c'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ui-component-inventory.md'
  - '{project-root}/_bmad-output/implementation-artifacts/deferred-work.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `libs/ui-components` has only Button, TopBar, ThemeToggle and Board. Epics 1-2 need ten more primitives, no Storybook documents the kit, `main.tsx`'s provider tree is untested, and input borders (`--input`, 1.25:1) fail WCAG 1.4.11.

**Approach:** Add the ten primitives with the shadcn CLI (tokens only), set up Storybook 10 on `libs/ui-components` (theme CSS, RTL decorator, light/dark toggle, a11y), extract a shared `AppProviders`, and add a stronger `--input` token with a contrast test and a Storybook preview for Adi's approval.

## Boundaries & Constraints

**Always:**

- ACs of Story 1.5 in `epics.md` are the contract.
- Tokens only; logical utilities only; no arbitrary values (ESLint already enforces).
- `libs/ui-components` stays presentational: no i18next, router, TanStack Query, storage, or app theme context (AD-2).
- Exact pinned versions for new packages (Storybook 10.6.4).
- Generated shadcn files get their imports rewritten to relative paths (see ui-components README).

**Never:**

- No commit or push before Adi approves the review file.
- The Input does not ship before Adi approves the `--input` preview.
- No primitives beyond the ten (Textarea, Tabs, etc. are just-in-time in later stories).

</frozen-after-approval>

## Plan (awaiting Adi)

1. Packages: `@nx/storybook`, `storybook`, `@storybook/react-vite`, `@storybook/addon-a11y` (10.6.4 exact), `sonner`.
2. Primitives via `shadcn add`: input, label, skeleton, toggle-group, dropdown-menu, sonner, dialog, alert-dialog, select, table. Tokenise arbitrary values, rewrite imports.
3. Specs: render, keyboard operability, dialog focus trap and restore.
4. Storybook: `.storybook/` (preview with theme CSS, RTL + DirectionProvider decorator, light/dark toolbar, a11y), one `*.stories.tsx` per component (14 total incl. Button, TopBar, ThemeToggle, Board), `build-storybook` in CI via `nx affected`.
5. `AppProviders` shared by `main.tsx` and specs, plus a bootstrap test.
6. `--input` token: stronger value in both themes, assertions in `theme-contrast.spec.ts`, Storybook "Input border" preview for approval.
7. Docs: inventory, deferred-work, README, spine/memlog.

## Open choices (Adi)

- **AppProviders location:** `apps/web/src/app/app-providers.tsx` (recommended; it needs i18n and ThemeProvider, which `type:ui` may not import) vs a new `libs/app-shell`.
- **Sonner theme:** `Toaster` takes a `theme` prop passed by the app (recommended; keeps ui-components free of app theme context) vs adding `next-themes`.
- **`--input` values:** light `#857f75` (3.42:1 on background, 3.77:1 on card), dark `#7a726a` (3.75:1 on background, 3.38:1 on card). `--border` stays subtle.

## Spec Change Log

## Verification

- `npx nx run-many -t lint typecheck test build build-storybook --skip-nx-cache` -- all green
- `npx nx format:check` -- clean
