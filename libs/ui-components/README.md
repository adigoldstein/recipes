# ui-components

Presentational React components: props in, callbacks out, design tokens only.

- Tag `type:ui`: may import `recipe-domain` only, and lint bans TanStack Query, the generated API client, React Router and i18next (copy comes in as props).

Run `npx nx test ui-components`.

## Theme and shadcn

- `src/styles/theme.css` is the single theme (DESIGN.md tokens, radii, type roles, Rubik); apps import it as `@bite-and-board/ui-components/theme.css`.
- `components.json` targets this lib (`radix-nova`, `rtl: true`). Files added with `npx shadcn add` need two edits before lint passes: `#lib/...` / `#components/...` imports become relative imports, and arbitrary values (`size-[...]`) become token utilities.
