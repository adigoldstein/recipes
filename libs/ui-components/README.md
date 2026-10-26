# ui-components

Presentational React components: props in, callbacks out, design tokens only.

- Tag `type:ui`: may import `recipe-domain` only, and lint bans TanStack Query, the generated API client, React Router and i18next (copy comes in as props).

Run `npx nx test ui-components`.

## Theme and shadcn

- `src/styles/theme.css` is the single theme (DESIGN.md tokens, radii, type roles, Rubik); apps import it as `@bite-and-board/ui-components/theme.css`.
- Storybook: `npx nx storybook ui-components` serves it, `npx nx build-storybook ui-components` builds it (CI runs the build). The preview loads `theme.css`, sets `dir="rtl"` with the Radix `DirectionProvider`, and has a Light/Dark toolbar toggle; `@storybook/addon-a11y` is on. Every component has a story (groups in `*.stories.tsx` next to the components).
- `components.json` targets this lib (`radix-nova`, `rtl: true`). `shadcn add` asks before overwriting `button.tsx` (our tokenised copy) and the prompt blocks non-interactive runs: move `button.tsx` aside while adding, then put it back. Files added with `npx shadcn add` need three edits before lint passes: the CLI also writes a bogus `cn` import and extra dependencies (`cn`, `next-themes`) into this `package.json`, so check both; `#lib/...` / `#components/...` imports become relative imports, and arbitrary values (`size-[...]`) become token utilities.
