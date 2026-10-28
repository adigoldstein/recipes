# Spec: Story 1.11 Live serving scaling

Source: `planning-artifacts/epics.md` (Story 1.11, split on 2026-10-28; kitchen-mode extras moved to optional Story 7.1), FR-11, AD-32, UX-DR9.
Status: DONE.

## Goal

On the detail page the cook changes the servings (1-100) and every amount updates instantly on the client. To-taste lines never change.

## Decisions (Adi, via coordinator: "y" to all recommendations)

- D1 `scaleAmount(amount, unit, baseServings, servings)` in `libs/recipe-domain`: pure, 100% branch coverage. Countable units (unit, clove, slice, can, package; duplicated from the backend set because domain cannot import data-access) round to the nearest kitchen fraction (¼ ⅓ ½ ⅔ ¾ plus a whole part; changed from ½ at Adi's request), others to 2 decimals. At the base servings the stored amount is returned as is.
- D2 A positive amount never rounds to zero: the smallest result is ¼ (countable) or 0.01 (others).
- D3 The amount, the FR-7 original hint and the converted source value ("8 oz (227 גרם)") all scale, so the pair stays consistent.
- D4 `ServingsStepper` in `libs/ui-components` (presentational, strings via props): 44 px buttons, typeable field with a local draft, valid values apply immediately, invalid or empty shows the range message and reverts on blur/Enter; polite `role="status"` announcement; reset button only when different from base.
- D5 It sits in the sticky start column above the ingredient board. Servings are remembered per recipe on this device (`localStorage`, key `bb:servings:<id>`) by `useServings`, a thin wrapper on the new generic `useStoredState` (`libs/feature-recipes/src/shared`: storage local|session, parse/serialize/isDefault, every access in try/catch, an invalid value falls back, saving the default removes the key). `useCookingChecks` is now a wrapper on it too (same key and format); "חזרה ל־N" resets and forgets. No new libraries; the stepper ships in the lazy detail chunk, not the entry chunk.

## Tests

- domain: `scaleAmount` (100% branches). ui: `ServingsStepper` spec + story. feature (Vitest + MSW): scaling with no request, to-taste untouched, source scaling, reset, typed value and range message. web: one test with the real `AppLayout`.
- Initial JS: 157.6 KB gzip (budget 200 KB).
