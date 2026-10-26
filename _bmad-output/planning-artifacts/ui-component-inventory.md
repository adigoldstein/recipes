# UI Component Inventory — Bite & Board

Status: approved by Adi (2026-10-26). Story 1.5 builds the "UI kit" rows; the other rows are built by the story listed.
Sources: `ux-designs/ux-recipes-2026-10-26/DESIGN.md` (Components, Brand & Style), `EXPERIENCE.md` (Component Patterns), `epics.md`.

All components live in `libs/ui-components` (tag `type:ui`): presentational, tokens only, RTL-safe (logical utilities), no data fetching. Feature libs compose them into containers.

## shadcn/ui primitives

Used as shadcn ships them, styled only through the theme variables (DESIGN.md).

| Primitive | Used for | Screens | Added by |
|---|---|---|---|
| Button | every action; primary pill, icon buttons | all | 1.4 (shadcn init + Button for the theme toggle) |
| Input | search field, login, forms | library, login, users, recipe form | **UI kit story** |
| Label | form fields | login, users, account, recipe form | **UI kit story** |
| Skeleton | loading cards and detail | library, detail | **UI kit story** |
| ToggleGroup (single) | meal-type chip row ("הכל" + meal types) | library | **UI kit story** |
| DropdownMenu | account menu (name, משתמשים, תגיות, יציאה) | top bar | **UI kit story** |
| Sonner (Toast) | saved / deleted / logged out / password updated | global | **UI kit story** |
| Dialog | add user; import dialog on desktop | users, import | **UI kit story** |
| AlertDialog | confirms: block/reset user, delete recipe, unsaved changes, delete tag | users, recipe, tags | **UI kit story** |
| Select | user role; meal type; ingredient unit | users, recipe form | **UI kit story** |
| Table | users list | users | **UI kit story** |
| Textarea | recipe description, steps; pasted import text | recipe form, import | 3.1 (just in time) |
| Popover + Command | tag combobox with "יצירת תגית '{text}'" | recipe form, import review | 3.3 (just in time) |
| Sheet + Checkbox | tag filter (sheet on phone, popover on desktop) | library | 4.2 (just in time) |
| Tabs | import: "קישור" / "הדבקת טקסט" | import | 5.2 (just in time) |

## Custom shared components (brand and composites)

Built by the story that first renders them, in `libs/ui-components`.

| Component | Composed of | Added by |
|---|---|---|
| TopBar (wordmark, slot for actions) | Button | 1.4 |
| ThemeToggle (system → light → dark) | Button | 1.4 |
| Board (oak slab, radius 24, handle slot) | — | 1.4 |
| RecipeCard (board-shaped card, lazy photo) | Board | 1.9 (library) |
| SearchField (with clear ×) | Input, Button | 1.9 |
| MealTypeFilter (chip row) | ToggleGroup | 1.9 |
| EmptyState / NoResults | Button | 1.9 |
| BoardPhoto (photo masked as a board) | Board | 1.10 (detail) |
| IngredientLine (amount + unit in `<bdi>`, to-taste, hint) | — | 1.10 |
| ServingsStepper (44 px, typeable, clamped, live region) | Button, Input | 1.11 |
| IngredientRowEditor / StepListEditor | Input, Select, Button | 3.1–3.2 |
| TagChip (removable) | Button | 3.3 |
| TagCombobox | Popover, Command, TagChip | 3.3 |
| PhotoField (add / replace / remove / restore) | Button | 3.7 |
| TagFilter | Sheet, Popover, Checkbox, TagChip | 4.2 |
| FlaggedField ("יש להשלים") | Input | 5.3 |

## Rule for new needs

A primitive that isn't listed here is added with `shadcn add` by the story that first needs it, and that story adds a row here.
