# Spec: Story 1.9 Recipe library with search and tag filter

Source: `planning-artifacts/epics.md` (Story 1.9), ARCHITECTURE-SPINE AD-2, AD-8, AD-11, AD-19, AD-26, AD-32, AD-33; EXPERIENCE.md (Component Patterns, States); UX-DR6, 7, 11, 17, 20.
Status: DRAFT. Open decisions D1-D8 below are with Adi (via coordinator); nothing is implemented yet except the backend tests.

## Goal

`/` shows the recipe library: cards newest first, search by title, pinned-tag chips (AND), a "עד 30 דקות" chip, all kept in the URL. The page lives in a new `libs/feature-recipes` and replaces the placeholder home route.

## Split of work

- **Adi writes** `GET /api/tags` (learning exercise): `TagRead` schema, repository `list_all`, service `list_tags`, router `list_tags`. Guide: `guide-1-9-tags-endpoint.md`.
- **Claude writes** (done): `apps/recipe-service/tests/test_tags_api.py` (8 tests, red until Adi's endpoint exists; verified green against a throwaway reference implementation that was reverted).
- **Claude writes** (after D1-D8 are answered): everything on the frontend.
- **Regenerate** after Adi's endpoint: `nx run data-access:generate` (creates `tagsListTagsOptions`, `TagRead` type and Zod schema).

## Design (proposed, see decisions)

### `libs/recipe-domain` (type:domain, 100% coverage)

`filterRecipes(recipes, { query, tagIds, fastOnly })`, pure, generic over a structural type `{ title: string; tags: { id: string }[]; total_minutes: number | null }` (the domain lib cannot import the generated API types).

- query: trimmed, case-insensitive substring on the title (`toLocaleLowerCase('he')`); empty query matches all.
- tagIds: a recipe must have every id (AND); empty list matches all.
- fastOnly: `total_minutes !== null && total_minutes <= 30`; `FAST_MINUTES = 30` exported.
- Order of the input is kept (the API already sorts newest first).
- Performance test: 200 recipes filter in under 100 ms (NFR-3).

### `libs/ui-components` (type:ui, props in, callbacks out, no i18n)

Per the approved inventory, each with a Storybook story (RTL, light/dark) and a spec:

- `RecipeCard`: a `Board` with the slot, a 4:3 lazy photo when there is one, title (larger without a photo), up to 2 tags plus "+N", total time; the whole card is one link (render as the given link element); hover scale 1.02, press 0.98, no shadow; reduced motion keeps opacity only.
- `RecipeCardSkeleton`: board-shaped skeleton.
- `SearchField`: pill `Input` with a clear (x) button and a label.
- `TagFilter`: `ToggleGroup type="multiple"` chip row, horizontal scroll, "הכל" + pinned tags + the fast chip; "הכל" pressed when nothing is selected.
- `EmptyState`: heading, body, optional action; used for both "no recipes" and "no results".
- Rename the `MealTypeChips` story in `forms.stories.tsx` to a flat-tag demo (`TagChips`, tag names, no "סוג ארוחה").

### `libs/feature-recipes` (type:feature)

- Subpath export `@bite-and-board/feature-recipes/library` -> `src/routes/library.tsx` (exports `Component`).
- `LibraryPage` (container): `useQuery(recipesListRecipesOptions())` and `useQuery(tagsListTagsOptions())`; URL state via `useSearchParams`; `useDeferredValue` on `q`; renders skeleton x6 / empty state / no-results / grid.
- `apps/web` router: the index route lazy-imports `@bite-and-board/feature-recipes/library` and `placeholder-home.tsx` is deleted; `home.title` is kept as the h1.
- Copy keys added to `he.json` under `library.*`.

### Tests

- Vitest + Testing Library + MSW for the container (search, chips, fast chip, AND, URL kept after navigating to a recipe and back, skeleton, empty, no-results, "ניקוי החיפוש" clears both).
- Unit tests for the domain filter and the URL parse/serialize helpers.
- Backend: `tests/test_tags_api.py`.

## Decisions (D1-D8)

See the plan message to the coordinator; answers are recorded here once received.

## Checks

`nx run-many -t lint typecheck test build build-storybook`, recipe-service lint/typecheck/test, `nx format:check`, `nx run data-access:generate` + `git diff --exit-code`, initial JS gzip size against the 200 KB budget (the `web:size` target does not exist yet; it is Story 6.4, so the size is measured by hand from the build output).
