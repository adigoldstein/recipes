---
name: ביס & סיר
description: Personal Hebrew (RTL) recipe app, mobile-first. Repo/code name "Bite & Board". shadcn/ui + Tailwind; this file defines the brand layer as shadcn theme variables. Direction B, "The Board".
status: final
created: 2026-10-26
updated: 2026-10-26
sources:
  - ../../prds/prd-recipes-2026-10-26/prd.md
  - ../../prds/prd-recipes-2026-10-26/addendum.md
colors:
  # Light (default). Keys map 1:1 to shadcn CSS variables (see "Token mapping").
  background: '#EFEEEA'          # stone countertop
  foreground: '#1E1B18'          # charcoal ink
  card: '#FAF9F6'
  card-foreground: '#1E1B18'
  popover: '#FAF9F6'
  popover-foreground: '#1E1B18'
  primary: '#1E1B18'             # charcoal pill button
  primary-foreground: '#F5E9D8'
  secondary: '#E2E0DA'
  secondary-foreground: '#1E1B18'
  muted: '#E2E0DA'
  muted-foreground: '#5F574F'
  accent: '#E2E0DA'              # shadcn hover/active fill (neutral)
  accent-foreground: '#1E1B18'
  destructive: '#B42318'
  destructive-foreground: '#FFFFFF'
  border: '#D9D6CF'
  input: '#D9D6CF'
  ring: '#1E1B18'
  # Brand extensions (new CSS variables)
  board: '#D6A46A'               # oak cutting board
  board-foreground: '#24190E'
  hint: '#4F3A22'                # original-value hint, on board
  hint-muted: '#5F574F'          # original-value hint, on card/background (edit form)
  flag: '#A1440A'                # import field "needs completing"
  # Dark
  background-dark: '#1A1816'
  foreground-dark: '#F3ECE3'
  card-dark: '#242120'
  card-foreground-dark: '#F3ECE3'
  popover-dark: '#242120'
  popover-foreground-dark: '#F3ECE3'
  primary-dark: '#D6A46A'        # in dark, the pill takes the oak colour
  primary-foreground-dark: '#1A1208'
  secondary-dark: '#2E2A27'
  secondary-foreground-dark: '#F3ECE3'
  muted-dark: '#2E2A27'
  muted-foreground-dark: '#B9ADA0'
  accent-dark: '#2E2A27'
  accent-foreground-dark: '#F3ECE3'
  destructive-dark: '#F97066'
  destructive-foreground-dark: '#1A0705'
  border-dark: '#3A3531'
  input-dark: '#3A3531'
  ring-dark: '#D6A46A'
  board-dark: '#73502E'          # walnut
  board-foreground-dark: '#FBF1E3'
  hint-dark: '#F0D7B6'
  hint-muted-dark: '#B9ADA0'
  flag-dark: '#F5A35C'
typography:
  # One family: Rubik (Google Fonts, Hebrew + Latin). Sizes are mobile-first; `-lg` variants apply from the lg breakpoint.
  display:
    fontFamily: 'Rubik'
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1.0'
    letterSpacing: -0.02em
  display-lg:
    fontFamily: 'Rubik'
    fontSize: 56px
    fontWeight: '800'
    lineHeight: '1.0'
    letterSpacing: -0.02em
  title:
    fontFamily: 'Rubik'
    fontSize: 24px
    fontWeight: '800'
    lineHeight: '1.15'
    letterSpacing: -0.01em
  heading:
    fontFamily: 'Rubik'
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.3'
  body:
    fontFamily: 'Rubik'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.55'
  quantity:
    fontFamily: 'Rubik'
    fontSize: 20px
    fontWeight: '800'
    lineHeight: '1.2'
    fontFeature: 'tnum'
  label:
    fontFamily: 'Rubik'
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
  hint:
    fontFamily: 'Rubik'
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.3'
rounded:
  sm: 8px          # inputs, chips' focus ring offset area
  md: 12px         # cards on stone, dialogs on phone
  lg: 16px         # dialogs, sheets
  board: 24px      # the board slab
  full: 9999px     # every button, chip and stepper
spacing:
  # Tailwind's 4px scale is inherited unchanged; these are the named roles.
  margin-mobile: 16px
  margin-desktop: 32px
  gutter: 16px
  stack: 12px      # gap between items inside a section
  section: 32px    # gap between sections on phone
  section-lg: 48px
  board-pad: 18px
  board-slot-top: 36px   # board top padding that leaves room for the handle slot
  touch: 44px      # minimum touch target
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.full}'
    height: 44px
  button-secondary:
    background: '{colors.secondary}'
    foreground: '{colors.secondary-foreground}'
    radius: '{rounded.full}'
  board:
    background: '{colors.board}'
    foreground: '{colors.board-foreground}'
    radius: '{rounded.board}'
    padding: '{spacing.board-pad}'
    slot: 'pill 44×12px, filled {colors.background}, centred 12px from the top edge'
  recipe-card:
    background: '{colors.board}'
    foreground: '{colors.board-foreground}'
    radius: '{rounded.board}'
  servings-stepper:
    button-background: '{colors.primary}'
    button-foreground: '{colors.primary-foreground}'
    value: '{typography.quantity}'
    radius: '{rounded.full}'
  ingredient-quantity:
    typography: '{typography.quantity}'
  original-hint:
    typography: '{typography.hint}'
    color-on-board: '{colors.hint}'
    color-on-surface: '{colors.hint-muted}'
  filter-chip:
    background: '{colors.secondary}'
    background-selected: '{colors.primary}'
    foreground-selected: '{colors.primary-foreground}'
    radius: '{rounded.full}'
  input:
    background: '{colors.card}'
    border: '{colors.input}'
    radius: '{rounded.sm}'
  input-flagged:
    border: '{colors.flag}'
    note: '{colors.flag}'
---

## Brand & Style

> Visual reference: [`mockups/key-screens.html`](mockups/key-screens.html). The sample food photos in `mockups/assets/` are CC-licensed and credited (`mockups/assets/credits.json`). Where this file and a mockup disagree, this file wins.


**ביס & סיר** ("bite & pot") is Adi's own kitchen in an app. It is a personal recipe box used on the phone at the counter, and it also works as a portfolio piece that a recruiter browses on desktop. The visual idea is **the cutting board**. The thing you actually cook on becomes the surface that holds what you cook with. The recipe's ingredients sit on a solid oak slab with a handle slot, on a stone-grey countertop. Everything else stays plain and gets out of the way.

The posture is bold, warm and plain-spoken: heavy Hebrew type at large sizes, solid fields of colour, pill-shaped buttons. There are no gradients, no glows, no illustrations and no emoji. The single motif carries the personality, so it stays recognisable without becoming a costume.

Built on **shadcn/ui**. This file defines the theme variables and three brand components: board, recipe card and servings stepper. Every other component (Dialog, AlertDialog, Sheet, Tabs, Select, Toast, Input, Textarea, DropdownMenu, Skeleton) is used as shadcn ships it, styled only through these variables.

**Mobile-first.** Every component and screen is designed at 375px first and enhanced with `sm`/`md`/`lg` breakpoints (Tailwind's own mobile-first model). Desktop is an enhancement, not the reference.

## Colors

One ground, one ink, one material:

- **Stone (`background`)**: the countertop. Every page ground. A slightly warm grey, not cream.
- **Charcoal (`foreground`, `primary`)**: all running text, and the fill of every primary pill button. In light mode, the "action" colour is ink, not a hue.
- **Oak (`board`)**: the only saturated colour, and it marks *the food*. It is used for the ingredient board on the detail page and the recipe cards in the library. Food photos supply the rest of the colour. It is never used for chrome, nav, links or errors. In dark mode the board becomes walnut (`board-dark`), and oak moves to the primary button so the action stays visible.
- **Hint brown (`hint`)**: the original-value hint on the board. It contrasts with the board at 4.8:1 (light) and 5.2:1 (dark). On plain surfaces (the edit form) the hint uses `hint-muted`.
- **Flag (`flag`)**: burnt orange, used only for the import-review "needs completing" fields. Not used for errors; errors use `destructive`.
- **Neutral steps** (`card`, `secondary`, `muted`, `border`) separate surfaces by tone. Borders appear on inputs only, where they are a form convention.

Measured contrast (WCAG): foreground on background 14.8 / 15.1 (light/dark); muted-foreground on background 6.1 / 8.1; board-foreground on board 7.7 / 6.5; hint on board 4.8 / 5.2; flag on background 5.4 / 8.7; primary-foreground on primary 14.3 / 8.3. All pass AA for body text.

## Typography

One family: **Rubik** (Google Fonts) for everything, Hebrew and Latin. Its rounded terminals echo the board's corners, and it holds up at 800 weight in Hebrew. It loads weights 400, 600 and 800 only, with `font-display: swap` and a `system-ui` fallback.

- `display`: the recipe title on the detail page (40px phone, 56px `lg`). One per screen.
- `title`: page titles (library, form) and the recipe card title.
- `heading`: section heads inside a page ("מצרכים", "אופן ההכנה").
- `body`: steps, descriptions, form text. Minimum 16px, so iOS does not zoom on input focus.
- `quantity`: every ingredient amount and the servings value. Uses tabular figures so amounts line up as they scale.
- `label` / `hint`: form labels, meta (tags, time) and the original-value hint.

Five visible sizes at most. No uppercase or letter-spaced labels (Hebrew has no case anyway). Numbers and units are wrapped for bidi isolation (see EXPERIENCE.md, *Right-to-left & Hebrew*).

## Layout & Spacing

Tailwind's 4px spacing scale, unchanged. Mobile-first:

- **Phone (base):** a single column with 16px (`margin-mobile`) side gutters. Sections are 32px apart, items inside a section 12px apart.
- **`sm` 640px:** library cards go to 2 columns.
- **`lg` 1024px:** 32px gutters. Content max width is 1200px for the library and about 1040px for the detail page. The library has 3 columns. On detail, the ingredient board plus servings becomes a sticky column at the inline-start edge (the right side in RTL), with steps in the other column.

All horizontal spacing uses logical utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) so the layout mirrors with `dir`.

## Elevation & Depth

Flat. Surfaces are separated by tone (stone → card → board), never by a resting shadow. Only things that truly float get shadcn's shadow: popovers, dropdowns, dialogs, sheets and toasts. Nothing else has a shadow, a glow or a blur.

## Shapes

Two shape families, decided once:

- **Fully round** (`rounded.full`) for everything you press: buttons, chips, the stepper.
- **The board** (`rounded.board`, 24px) for the food surfaces: the ingredient board and the recipe cards. It has a **handle slot**: a 44×12px pill cut-out filled with the ground colour, centred near the top edge. The slot appears on the detail-page board, on each library card and on board-shaped photos, and nowhere else.

Inputs use `rounded.sm` (8px) and dialogs `rounded.lg` (16px), so the form doesn't compete with the board.

## Components

- **Board.** `{colors.board}` slab, `{rounded.board}`, padding `{spacing.board-pad}` with `{spacing.board-slot-top}` on top for the slot. It holds the ingredient list on the detail page. Lines are separated by 8px of space, with no rules. Amounts use `{typography.quantity}`, names use `body`, notes use `label` in `board-foreground` at reduced emphasis, and the hint sits under its line in `{colors.hint}`.
- **Recipe card.** A smaller board: slot, then the photo (4:3, `rounded.md`-ish 14px inset corners, `object-fit: cover`), then the title in `title` and up to 2 tags plus "+N" and the total time in `label`. The whole card is the link. Without a photo, the title is set larger and there is no placeholder art. Hover is a 2% scale up and press a 2% scale down, with no shadow.
- **Board-shaped photo.** On the detail page and in import review, the photo itself is masked as a board: `rounded.board` corners and the handle slot cut through the image near its top edge. It is 4:3 on phone and 16:9 on desktop. Photos are never filtered or tinted.
- **Photo credit.** Imported photos show "מקור: {domain}" under the steps, in `muted-foreground`.
- **Servings stepper.** Two 44px round `primary` buttons (− and +) around the value in `quantity`. On the detail page it sits directly above the board. The "חזרה ל־4" reset is a text button in `muted-foreground`.
- **Primary button.** A `primary` pill, 44px tall, label in `label` weight 600. One per screen.
- **Filter chips (pinned tags).** `secondary` pills. The selected chips are filled `primary` (several can be selected). They scroll in a single row, ending with an "עוד תגיות" button. Tag chips in the form and under the search carry a remove (×) control.
- **Ingredient row (form).** shadcn inputs for amount, unit (Select), name and note. On phone the row stacks amount and unit over name and note. A hinted row shows the hint under it in `hint-muted` and a "חזרה למקור" text button.
- **Flagged field (import review).** The input border and a note in `{colors.flag}` read "יש להשלים". A summary line at the top of the form is also in `flag`.
- **Theme toggle.** An icon button in the top bar: sun, moon, or the system setting.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use oak (`board`) only on food surfaces: the ingredient board and the recipe cards | Use oak for nav, links, badges or decoration |
| Keep forms, login and dialogs plain shadcn on stone and card | Put the board motif on forms or the login page |
| Use pill buttons everywhere you press | Mix square and soft-radius buttons |
| Use one family (Rubik) in three weights | Add a second display face |
| Separate surfaces by tone | Use resting shadows, gradients, glows or blur |
| Use logical spacing (`ps-`/`pe-`/`start-`/`end-`) | Use `pl-`/`pr-`/`left-`/`right-` |
| Design at 375px first, then add breakpoints | Design desktop first and squeeze down |

## Token mapping (implementation note)

The keys in `colors` map to shadcn's CSS variables in the global stylesheet. `:root` holds the light values, and `.dark` holds the `*-dark` values (`--background`, `--foreground`, `--primary`, and so on). The brand extensions become `--board`, `--board-foreground`, `--hint`, `--hint-muted` and `--flag`, and are registered in the Tailwind theme so classes such as `bg-board`, `text-hint` and `border-flag` exist. Radii map to `--radius` plus a `--radius-board` extension. Whether values are written as hex or converted to OKLCH (the current shadcn default) is left to implementation, as long as they stay the same colours.
