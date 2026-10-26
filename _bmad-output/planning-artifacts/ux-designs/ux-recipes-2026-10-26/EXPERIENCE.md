---
title: Bite & Board - Experience
status: final
created: 2026-10-26
updated: 2026-10-26
design: ./DESIGN.md
sources:
  - ../../prds/prd-recipes-2026-10-26/prd.md
  - ../../prds/prd-recipes-2026-10-26/addendum.md
---

# Bite & Board — Experience Spine

> Final (fast path, approved by Adi 2026-10-26). Items still marked `[ASSUMPTION]` are defaults that can be revisited during build. Token names such as `{colors.primary}` refer to `DESIGN.md` (direction B, "The Board").
>
> Composition reference: [`mockups/key-screens.html`](mockups/key-screens.html) (library, recipe detail, import review; phone + desktop, light/dark) and [`mockups/directions.html`](mockups/directions.html) (the A/B/C direction study). The spines win where they disagree with a mockup.

## Foundation

- **Form factor.** **Mobile-first** responsive web (Adi, 2026-10-26). Every screen is designed at 375px first (the phone at the kitchen counter), then enhanced for tablet and desktop (PRD NFR-4). It is not a native app.
- **UI system.** shadcn/ui (Radix primitives) on React + Vite + Tailwind. Components are styled only through tokens (NFR-7). This spine specifies the behavioural differences from shadcn; anything not listed uses shadcn's default behaviour.
- **Language and direction.** The UI is in Hebrew and right to left: `<html lang="he" dir="rtl">`. See *Right-to-left & Hebrew* below. This is now in the PRD as NFR-12.
- **Three access levels on one surface.** The **visitor** (anonymous; a recruiter, a friend) can browse, search, view and scale. An **editor** (signed in, account created by Adi) also sees create, edit, reset, delete, import, photo upload and tag management. The **admin** (Adi) also sees *Users*. Controls a role can't use are *absent*, not disabled (FR-16). "Owner" below means any signed-in user (editor or admin).
- **Visual identity.** `DESIGN.md`. Where the two documents conflict, the spines win over any mockup.

## Information Architecture

| Surface | Route [ASSUMPTION] | Reached from | Who | Purpose | PRD |
|---|---|---|---|---|---|
| Library | `/` | App open, the brand link | All | Recipe cards, search, meal-type and tag filters | FR-1–3 |
| Recipe detail | `/recipes/:id` | Library card | All | Full recipe, serving scaling, original-value hints, source link | FR-5, FR-8, FR-11 |
| New recipe | `/recipes/new` | "מתכון חדש" in the top bar and the empty state | Owner | Recipe form | FR-4 |
| Edit recipe | `/recipes/:id/edit` | "עריכה" on the detail page | Owner | The same form, prefilled, with hints and reset | FR-6–9 |
| Import | `/import` (dialog over the library on desktop, full page on phone) [ASSUMPTION] | "ייבוא" in the top bar | Owner | URL tab, pasted-text tab, progress | FR-17, 18, 20 |
| Meal types & tags | `/tags` | Account menu | Owner | Add, rename, delete meal types and tags | FR-22–24 |
| Users | `/users` | Account menu | Admin | List users; add user (email, name, role, starting password); change role; block/unblock; reset password | FR-25–26 |
| My account | `/account` | Account menu | Owner | Change own password | FR-27 |
| Import review | `/recipes/new` (draft passed in router state, never in the URL; AD-22) | Successful import | Owner | Recipe form prefilled from the draft, unfilled fields flagged | FR-19 |
| Log in | `/login?next=…` | "כניסה" in the top bar, an expired session, a direct edit URL | All | Email and password | FR-14 |
| Not found | any unknown route or id | Bad link | All | Message and a link back to the library | FR-5 |

**Navigation.** There is one top bar and no sidebar, because there are only two primary destinations. The top bar holds the wordmark (links to the library), plus "מתכון חדש" and "ייבוא" for signed-in users, the theme toggle, and "כניסה" for visitors or an account menu (the user's name) for signed-in users. The account menu holds "תגיות וסוגי ארוחה", "משתמשים" (admin only), "החשבון שלי" and "יציאה". On phone, the owner actions collapse into one "+" menu with two items: new recipe and import [ASSUMPTION].

**Delete** has no route of its own. It is a confirm dialog on the detail page (FR-10).

**Closure check.** Every PRD need has a surface above, and every surface is reached by a flow in *Key Flows*.

## Voice and Tone

Hebrew, short, warm, plain, addressed to one cook. Use the imperative for actions. No exclamation marks, emoji or praise. Error messages say what happened and what to do next.

| Do | Don't |
|---|---|
| "שמירה" (Save) | "שמור את המתכון עכשיו!" |
| "במקור 1 כפית" (originally 1 tsp) | "ערך מקורי: 1.000 כפית" |
| "אין מתכונים בשם הזה. ניקוי החיפוש" | "אופס! לא נמצאו תוצאות 😕" |
| "האתר חסם את הייבוא. אפשר להעתיק את טקסט המתכון ולהדביק אותו בלשונית 'הדבקת טקסט'." | "שגיאה 403" |
| "המתכון 'שקשוקה' יימחק לצמיתות." | "האם אתה בטוח?" |
| Gender-neutral infinitive forms ("עריכה", "ייבוא", "חזרה לרשימה") | "ערוך / ערכי" |

**Name.** In the app the product is called **"ביס & סיר"**: the wordmark, `document.title` and empty states all use it (Adi, 2026-10-26). "Bite & Board" remains the repository and code name only.

## Right-to-left & Hebrew

The PRD did not cover this; it is a new concern and it applies to every surface.

- `dir="rtl"` on `<html>`, with Radix `DirectionProvider dir="rtl"`, so menus, selects, sheets and tabs open and arrow-key in the right direction.
- Layout uses only logical properties: Tailwind `ms-/me-/ps-/pe-/start-/end-/text-start`. `ml-/mr-/left-/right-` are banned (a lint rule can enforce this) [ASSUMPTION].
- Directional icons are mirrored: back, next, chevrons and the reorder drag handle direction. Non-directional icons (plus, search, clock) are not mirrored.
- **Numbers and units.** Each amount + unit pair is wrapped in `<bdi>` so that mixed runs such as "1.5 כפיות" or "200 g" never reorder. Amounts use Western digits with tabular figures. The Hebrew unit labels are fixed in an i18n map (כפית/כפיות, כף/כפות, כוס/כוסות, גרם, ק״ג, מ״ל, ליטר, יח׳, קורט, שן/שיניים, פרוסה/פרוסות, קופסה/קופסאות, חבילה/חבילות), with singular and plural forms.
- **Imports arrive in Hebrew.** A recipe imported from an English (or other-language) page or text is translated to Hebrew in the draft. Amounts and units are kept, and the source URL is stored (PRD FR-21). The review banner says so: "המתכון תורגם מאנגלית".
- **Hand-typed content may still be in any language.** The title, ingredient names and steps get `dir="auto"`.
- Forms: the URL input and the email field are `dir="ltr"`. The password field is `dir="ltr"`.
- All UI strings come from one resource file per language. Which library to use is an architecture decision (OQ-UX-3).

## Component Patterns

Behavioural only. The visual specs are in `DESIGN.md.Components`.

| Component | Where | Behaviour |
|---|---|---|
| Recipe card | Library | The whole card is one link to the detail page. It shows the photo (if any), title, meal type, up to 3 tags and total time (prep + cook). When neither time is known, the time is omitted rather than shown as "0". A card without a photo shows a larger title on the board and no placeholder image. Photos are lazy-loaded (NFR-11). |
| Recipe photo | Detail, form, import review | One optional photo per recipe. It comes from an import (schema.org `Recipe.image`, then `og:image`) or a manual upload in the form. In the form: "הוספת תמונה" / "החלפה" / "הסרה". A removed photo is dropped on Save, and "החזרת התמונה" is available until then. An imported photo shows the source domain as credit on the detail page. Storage, resizing and format are architecture decisions (OQ-UX-6). |
| Search field | Library | Filters as you type, with no submit. Matching is a case-insensitive substring on the title. Input stays responsive (deferred filtering). Includes a clear (×) control. The value is kept in the URL query (`?q=`) so it survives navigating back (FR-3). |
| Meal-type filter | Library | A single-select chip row with "הכל" plus the owner's meal types. On phone it scrolls horizontally inside its own row. Stored in the URL (`?meal=`). Combines with search and tags. |
| Tag filter | Library | A "תגיות" button opens a sheet (phone) or popover (desktop) of tag checkboxes. The selected tags show as removable chips under the search; a recipe must have all of them. Stored in the URL (`?tags=`). |
| Meal type + tag input | Form | The meal type is a required single select. On create it is preselected from a suggestion [ASSUMPTION: by time of day: morning→בוקר, evening→ערב]. Tags use a combobox that autocompletes existing tags (case-insensitive) and offers "יצירת תגית '{text}'" for a new one. Chosen tags are removable chips. |
| Manage meal types & tags | `/tags` (owner) | Two lists with inline rename and add. Deleting a tag asks for confirmation and states how many recipes use it. A meal type that is in use cannot be deleted, and the message says how many recipes use it (FR-23). Reached from the account menu. |
| Servings stepper | Detail | − / value / + plus direct typing, clamped to 1–100. Every amount updates on each change, with no network call. A "חזרה ל־{base}" link appears only when the value differs from the base. Not persisted: a reload returns to the base (FR-11). |
| Ingredient line | Detail, form | Shows amount, unit, name and note. A to-taste line reads "מלח — לפי הטעם" and never scales. When an original exists, a hint line "במקור {amount} {unit}" sits under it, visually secondary (`{colors.hint}`), scaled by the same ratio, and announced to screen readers as part of the line. |
| Reset to original | Edit form | A small text action on hinted rows only: "חזרה למקור". It restores the amount and unit in the form. The hint stays until Save, and after Save the row is indistinguishable from an unedited one (FR-9). It can be undone before Save by retyping. |
| Ingredient / step list editor | Form | Add a row (Enter in the last row adds a new one), remove a row, and reorder with up/down buttons (keyboard accessible). Drag reordering is optional on desktop [ASSUMPTION]. At least one row is enforced. |
| Recipe form | New, edit, import review | Inline field errors appear on blur and on submit. On a failed submit, focus moves to the first error. Server 422 field errors map onto the same fields. If the user leaves with unsaved changes, a confirm dialog appears (also on browser back, via a route blocker). |
| Import dialog | Import | Two tabs: "קישור" (URL) and "הדבקת טקסט" (paste text). While running it shows progress text that changes by phase (fetching, reading, organising) and a Cancel button. Time limit per AI engine from `GET /api/imports/providers` (about 180 s local, 60 s Gemini; AD-22). On success it routes to import review. |
| Draft flag | Import review | Fields the import couldn't fill are marked "יש להשלים" (needs completing), with the field framed in `{colors.flag}`, and a summary at the top: "3 שדות דורשים השלמה". Ingredients it couldn't quantify become to-taste. Unmappable units leave the unit empty, with the original text in the note. |
| Confirm dialog | Delete, unsaved changes | shadcn `AlertDialog`. It names the recipe, and the destructive button states the action ("מחיקה"). Focus starts on Cancel. |
| Theme toggle | Top bar | Cycles system → light → dark [ASSUMPTION]. The choice is remembered per browser. |
| Toast | Global | Non-blocking messages: saved, deleted, delete-404 ("המתכון כבר נמחק"), logged out. One at a time. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Loading (first load) | Library | Skeleton cards in the card layout (6). No spinner. |
| Loading | Detail | A skeleton of the title and the ingredient lines. |
| Empty library, owner | Library | Headline "עוד אין כאן מתכונים", one sentence, primary "מתכון חדש" and secondary "ייבוא מקישור". |
| Empty library, visitor | Library | "עוד אין כאן מתכונים" with no actions. |
| No search results | Library | "לא נמצאו מתכונים ל־'{q}'" with a "ניקוי החיפוש" action (it also clears the filter when one is set). |
| Not found | Detail and unknown routes | "המתכון לא נמצא" with "חזרה לרשימה". |
| Photo upload | Form | An inline thumbnail with upload progress. A wrong type or too large a file is rejected with the allowed limits shown beside the field (limits set in architecture). |
| No photo | Detail | The photo slot is omitted. The title opens the page. |
| Import running | Import | Phase text, an indeterminate progress bar, and Cancel. The rest of the app is still usable on desktop [ASSUMPTION]. |
| Import fetch failed | Import / URL tab | A message suggesting the paste tab, with a one-click switch that keeps the dialog open (FR-17). |
| Import no recipe | Import / text tab | "לא נמצא מתכון בטקסט הזה". The text is kept so it can be fixed. |
| Import LLM error or timeout | Import | A readable reason (service unavailable, quota, too slow) and "לנסות שוב". Nothing is saved. |
| Blocked user | Any action | The session ends and the next request sends them to login with "החשבון חסום. יש לפנות למנהל." |
| Editor opens `/users` | Users | A not-found page (the screen doesn't exist for them). |
| Last admin | Users | The role and block controls on the last active admin are disabled with the reason "חייב להישאר מנהל אחד לפחות". |
| Session expired | Any owner action | The next protected action goes to `/login?next=…`, with a short note "פג תוקף החיבור". After login the user returns to the same place. Unsaved form data is kept in memory across this jump [ASSUMPTION]. |
| Login failed | Log in | "אימייל או סיסמה שגויים" (generic, FR-14). Rate limited: "יותר מדי ניסיונות. אפשר לנסות שוב בעוד דקה." |
| Save failed (network / 5xx) | Form | A toast, and the form keeps every value. Save can be retried. |
| Offline | Global | Out of scope for the MVP. A failed request shows the generic save or load error. |

## Interaction Primitives

- Mouse and touch first. Every action is also reachable by keyboard in reading order (right to left).
- `/` focuses library search on desktop [ASSUMPTION]. `Esc` closes the topmost dialog or sheet. `Enter` in the last ingredient row adds a row.
- Touch targets are at least 44×44px. This matters most for the servings stepper, which is used with wet hands.
- Kitchen mode: the detail page requests a screen wake lock while open, so the phone doesn't sleep mid-recipe. It is silent, and failure is ignored [ASSUMPTION].
- Banned: hover-only controls, infinite scroll (a few hundred recipes render in one list), nested dialogs, and auto-saving forms (save is always explicit).

## Accessibility Floor

Behavioural. Contrast lives in `DESIGN.md`.

- WCAG 2.2 AA (NFR-5). Visible focus on every control via `{colors.ring}`.
- `lang="he"` on the root. `dir="auto"` / `lang` on user content that may be in another language.
- The original-value hint is linked to its amount (`aria-describedby`), so a screen reader reads "2 כפיות כמון, במקור 1 כפית".
- Scaled amounts update in place. A polite live region announces the new servings count, not every line.
- Form fields have visible labels. Errors are linked with `aria-describedby` and announced on submit.
- Route changes move focus to the page `h1` and update `document.title`.
- `prefers-reduced-motion` removes all transitions except opacity.

## Responsive & Platform

| Width | Library | Detail | Form |
|---|---|---|---|
| < 640px (phone) | One-column card list. The filter chips scroll horizontally. | Single column. Servings sit above the ingredients. Ingredients come before the steps. | Single column. The ingredient row stacks amount/unit over name/note. |
| 640–1023px | Two-column cards. | Single column, wider measure. | Amount, unit, name and note on one row. |
| ≥ 1024px | Three-column cards [ASSUMPTION]. | Two columns: ingredients plus servings in a sticky column at the start (right side), steps in the other column. | As above, max width about 860px. |

## Key Flows

The protagonist is Adi throughout, matching the PRD journeys UJ-1 to UJ-7.

### Flow 1 — Cooking for a crowd (UJ-3: Adi, Friday afternoon, phone propped against the flour jar)

1. Adi opens Bite & Board on the phone and types "לזניה" in the search box. One card remains.
2. Adi taps it. The detail page shows base servings of 4, and the screen stays awake.
3. Adi taps + six times. The servings read 10, and every amount changes in place: eggs read **5**, not 5.000. The "במקור" hint under the edited béchamel milk scales with the rest.
4. "מלח — לפי הטעם" stays exactly as it was.
5. **Climax:** Adi shops and cooks from that one screen without doing any arithmetic. After a reload it returns to 4, and the saved recipe never changed.

Failure: Adi types 0 or 150 → the value is clamped to 1 or 100, and a brief message under the stepper gives the allowed range.

### Flow 2 — Making it personal (UJ-2)

1. On the shakshuka detail page Adi taps "עריכה". The form opens prefilled.
2. Adi changes cumin from 1 to 2 כפיות and salt from 1 to ½ כפית, then taps "שמירה".
3. Back on the detail page, cumin reads "2 כפיות" with "במקור 1 כפית" under it.
4. Months later, in edit, Adi taps "חזרה למקור" on cumin, and the field returns to 1 כפית.
5. **Climax:** After saving, the cumin line is plain again: no hint, as if it had never been edited.

### Flow 3 — Importing from the web (UJ-7)

1. Adi copies a focaccia URL, taps "ייבוא" and pastes it into the "קישור" tab.
2. A progress message appears ("קוראים את הדף…") with a cancel button. A few seconds later the form opens prefilled. The top of the form says "שדה אחד דורש השלמה", and the meal type is pre-picked; the tag "מאפים" is suggested.
3. Adi picks "מאפים" and taps "שמירה".
4. A second site blocks the fetch, and the message offers "הדבקת טקסט". Adi pastes the copied recipe text into that tab and gets the same prefilled form.
5. **Climax:** Two recipes from two sites, saved in under a minute each, with nothing typed by hand except one new tag.

### Flow 4 — Visitor, editor and admin (UJ-6)

1. A recruiter opens the app from Adi's CV and sees the library with no "+" and no "ייבוא".
2. They open a recipe and scale it to 6. It works, and there is no edit or delete control.
3. Adi taps "כניסה", logs in, and the editing controls appear in the same place, without a reload.
4. Adi opens "משתמשים", adds their partner as an editor with a starting password, and the partner logs in on their own phone and adds a recipe; its detail page shows who added it.
5. **Climax:** One app, three experiences, with no "permission denied" walls anywhere.

### Flow 5 — Finding and cleaning up (UJ-4, UJ-5)

1. With 60 recipes, Adi types "עוף", then taps the "ארוחת ערב" chip. The list narrows as each key is typed.
2. Adi opens a recipe, goes back, and the query and chip are still set.
3. In a recipe Adi didn't like, Adi taps "מחיקה". The dialog names it: "המתכון 'פשטידת תרד' יימחק לצמיתות." Adi confirms.
4. **Climax:** Adi lands back on the same filtered list, one card shorter, and a toast says "המתכון נמחק".

Saving a new recipe by hand (UJ-1) follows Flow 2's form, starting empty from "מתכון חדש".

## Open Questions

| # | Question | Blocks |
|---|---|---|
| OQ-UX-3 | i18n approach: resource files via a library (e.g. react-i18next, recommended) vs. hard-coded Hebrew strings. This is an architecture decision for Adi. | Architecture step |
| OQ-UX-6 | Photo storage. Proposed default for the architecture step: storage behind an interface (local disk volume next to SQLite first, S3-compatible later), resized and compressed to WebP on upload. | Architecture step |

Resolved 2026-10-26 (Adi): imports are translated to Hebrew; one optional photo per recipe from import or upload; PRD amended (FR-21, NFR-4 mobile-first, NFR-12 Hebrew RTL, photo ACs).