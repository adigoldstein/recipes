# Quick wins for Bite & Board

Brainstorm of small, no-fuss features, 2026-10-26 (Mary, BMAD brainstorming, "ideate for me" stance; raw log in `_bmad-output/brainstorming/brainstorm-quick-wins-2026-10-26/.memlog.md`).

**Filter used:** MVP-friendly (fits an existing story or one tiny new one), no new service or library decisions, mostly client-side, no schema change unless stated. Effort: **S** = under a day, **M** = a day or two.

## The ideas

| #   | Idea                                                                                                                         | Value                                                                           | Effort | Folds into                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| 1   | **Keep the screen awake** while cooking (Wake Lock API) in kitchen mode, released on leave                                   | High: phone no longer locks with messy hands                                    | S      | 1.11 (kitchen mode)                                           |
| 2   | **Tick off ingredients and steps** while cooking, remembered per browser (localStorage), with a "ניקוי" reset                | High: you never lose your place                                                 | S      | 1.10 / 1.11                                                   |
| 3   | **Share or copy as text** (Web Share API, copy fallback): title, ingredients at the current servings, steps, link            | High: WhatsApp is how Hebrew-speaking cooks share                               | S      | 1.10                                                          |
| 4   | **Pretty fractions on display**: ½, ¼, ¾ instead of 0.5, 0.25, 0.75 (the form already accepts ½)                            | Medium-high: reads like a real recipe                                           | S      | 1.11 (`formatAmount` in `recipe-domain`)                      |
| 5   | **Duplicate a recipe** ("שכפול") to make a variation, opens the create form prefilled, nothing saved until Save             | High for editors: variations are common                                         | S      | New small Story 3.8 (reuses `toFormValues`, like import)      |
| 6   | **Quick scale buttons** ×½ and ×2 beside the servings stepper                                                                | Medium: halving or doubling is the common case                                  | S      | 1.11                                                          |
| 7   | **Sort the library**: newest, quickest, A–Z (client-side on summaries)                                                       | Medium                                                                          | S      | 1.9                                                           |
| 8   | **"Up to 30 minutes" quick chip** in the library (`total_minutes` is already in the summary)                                 | Medium: answers "what can I make fast"                                          | S      | 1.9                                                           |
| 9   | **Random "what should I cook?"** button, respects the current filter                                                         | Fun, good in demos                                                              | S      | 1.9                                                           |
| 10  | **Favourites heart per browser** plus a favourites chip (no account needed)                                                  | Medium                                                                          | S      | 1.9 (new chip); a later account-based version could follow    |
| 11  | **Meal-type icon placeholder** when a recipe has no photo, so cards look finished                                            | Medium: the library looks good from day one                                     | S      | 1.9 / 1.8 (seed data)                                         |
| 12  | **Print-friendly stylesheet** for the detail page                                                                            | Low-medium: printing a recipe for the fridge                                    | S      | 1.10                                                          |
| 13  | **Search also matches ingredient names**, not only titles                                                                    | High once there are many recipes; needs ingredient names in `RecipeSummary`     | M      | 1.6 summary + 1.9 (changes the summary shape, so decide first) |
| 14  | **Link previews (Open Graph)** so a shared link shows title and photo in WhatsApp; also good for the recruiter-facing README | Medium-high for a public portfolio; the SPA needs server-set meta tags per page | M      | 6.x (production container) or 6.5                             |

Also floated and dropped as not quick: step timers from times in the text ("20 דקות", M and fuzzy parsing), a one-step-at-a-time cooking view, offline/PWA caching, photo OCR import, nutrition numbers.

## Top 5 recommendation

1. **Screen awake in kitchen mode (#1)**: the single biggest "kitchen" benefit for the least code.
2. **Tick off ingredients and steps (#2)**: pairs with #1 so the cooking flow feels finished.
3. **Share or copy as text (#3)**: fits how recipes are actually shared, and gives recruiters something to try.
4. **Pretty fractions (#4)**: small code in one pure function that is already 100%-branch-tested, big polish.
5. **Duplicate a recipe (#5)**: the most useful editor shortcut, and it reuses the form-prefill path we already build for import.

Next in line if there is room: #8 quick chip and #6 quick scale buttons.

## Decisions (Adi, 2026-10-26)

Folded into `epics.md`:

- #1 screen awake: already in Story 1.11 (UX-DR22), nothing to add.
- #2 tick-off: Story 1.10.
- #3 share or copy as text: Story 1.11.
- #4 pretty fractions: Story 1.11 (`formatAmount`).
- #8 "עד 30 דקות" chip: Story 1.9.
- #5 duplicate: new stretch Story 3.8 (can be cut; noted in `sprint-status.yaml`).
- #13 ingredient search and #14 Open Graph previews: future, recorded in `deferred-work.md`.
- Kept only in this file: #6, #7, #9, #10, #11, #12.

## Notes for planning

- #1, #2, #3, #4, #6 to #12 touch no API or schema. Only #13 (summary shape) and #14 (server-side meta tags) need a decision beforehand; I'd leave both until after the MVP stories unless Adi wants them.
- Every idea above needs a Storybook story and tokens only (Story 1.5 rules), RTL and both themes.
- None of this has been added to `epics.md`; say which to fold in and I'll update the acceptance criteria.
