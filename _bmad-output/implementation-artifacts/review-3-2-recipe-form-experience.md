# Review: Story 3.2 Recipe form experience

Working tree on branch `claude/story-3-2-form-experience` (cut from `main` at fc03193). Not committed; for Adi's review. Commit
trailer on "c p": `Claude-Session: https://claude.ai/code/session_01Uibg2JgePptwJLiUbinmzh`.

## What it does

- **`parseAmount`** (`libs/recipe-domain/src/parse-amount.ts`, unit-tested): accepts `1.5`, `1,5`, `.5`, `½ ⅓ ⅔ ¼ ¾ ⅛ ⅜ ⅝ ⅞`, `1 ½`, `1½`,
  `1/3`, `1 1/2`. Rounds to 3 decimals like the server. Returns null for anything else (and for `1/0`). `0` parses, so the write schema
  gives its own "greater than 0" message. The form uses it in `toWritePayload` and in the "is this a number" check; the error text is now
  "יש להזין מספר, למשל 1.5, ½ או 1/3".
- **Rows:** ingredients and steps have up/down buttons (`RowActions`, `useFieldArray.move`) next to remove. The first row's up and the
  last row's down are disabled; when a move leaves the pressed button disabled, focus goes to its partner. Enter in an ingredient text
  box never submits the form; in the last row it adds a row and focuses its amount, but only when the name is filled.
- **Layout:** the ingredient grid is `grid-cols-2 sm:grid-cols-12`: amount, unit, name, note, actions (2/2/3/2/3). On phone, amount and unit
  sit over name and note (as in 3.1). Steps have their buttons in a column beside the textarea.
- **Error timing:** `mode: 'onTouched'`: a field's error shows when it is first left, then follows the typing until it clears; submit
  validates all and focuses the first error (React Hook Form's default; now tested for ingredient fields).
- **Unsaved-changes guard** (`use-unsaved-changes-guard.ts`): `useBlocker` (path changes: links, BackLink, browser back) opens a
  `ConfirmDialog` "לצאת בלי לשמור?" (לצאת / להישאר); a `beforeunload` listener covers closing or reloading the tab (the browser's own
  text). The guard is on only while `isDirty`, and is switched off for the save's own navigation (and back on if the save fails).
- **Retry toast:** a failure with no error code and no field issue (network, 5xx) shows `toast.error` "השמירה לא הצליחה…" with
  "לנסות שוב", which submits again. The inline message under the button stays. Coded errors (404 `tag_not_found`, ...) get no toast.

## Decisions applied (Adi: "forget about the drag and drop. Continue.")

D1 extended `parseAmount`. D2 up/down buttons + Enter (no drag and drop). D3 error timing. D4 guard and retry toast. Effort medium.

## Things to know

1. **Error timing is `onTouched`, not `onBlur` + `reValidateMode: 'onChange'` as planned.** In React Hook Form `reValidateMode` only
   applies after a submit, so with `onBlur` an error stayed after the user fixed the field until the next blur. `onTouched` is the
   alternative named in the plan; same first-blur behaviour, and it clears while typing.
2. **How a 5xx is recognised:** the client throws the response body, so there is no status. The API only gives a `code` to 4xx errors, so
   "no code and no 422 issues" means network or server failure. If the API ever gives 5xx a code, this check needs the status.
3. **While a save is in flight the guard is off** (so the success navigation passes). Leaving in that moment does not ask. The submit
   button is disabled meanwhile.
4. **Unit select is 2 columns from `sm`** (was 3) to make room for the three action buttons; checked at 1100 px, one line.
5. **Tests:** sonner keeps toasts in a module-level store, so `recipe-new.spec.tsx` dismisses them after each test, and
   `testing/setup.ts` stubs `setPointerCapture` (jsdom lacks it; sonner calls it when a toast is pressed).
6. **Initial JS (gzip, entry + modulepreload):** 120,566 + 32,242 = **152,808 B (149.2 KiB)**, +355 B from 3.1 (the new `he.json` strings
   and `parseAmount`). Budget 200 KB. `recipe-new` chunk: 9,771 B gzip (was 7,619 B), lazy.
7. **Not verified:** a real 5xx / network failure in the browser (covered by the component tests with a 500 and a network error); a real
   touch device; screen-reader pass.

## Checks run

- `npm run verify` (lint, typecheck, test, build): 32 tasks succeeded. `nx format:check`: clean.
- New tests: `parse-amount.spec.ts` (15 accepted, 10 rejected); in `recipe-new.spec.tsx`: fractions sent as numbers, error on leaving an
  amount, required error on first blur, first error in a list row focused on submit, ingredient reorder with keyboard and focus, step
  reorder, Enter adds a row (only last row, only with a name, never submits), guard (pristine, stay, leave, browser back,
  `beforeunload`, no prompt after save), retry toast with a 500 then retry, no toast for a coded error.
- **Browser check, scratch DB** (`…/scratchpad/scratchdb`, my own API on :8001 and a static server of `apps/web/dist` on :4301 proxying to it;
  Adi's :8000 and :4200 were not touched and still run): at 375 px, Enter added row 2 and focused its amount, "1 ½" accepted, the leave
  dialog opened over a dirty form with the stay button focused; at 1100 px the ingredient row is one line. Both servers stopped afterwards.

## Files

`libs/recipe-domain/src/{parse-amount.ts,parse-amount.spec.ts,index.ts}`;
`libs/feature-recipes/src/form/{recipe-form.tsx,recipe-form-values.ts,recipe-form-validation.ts,row-actions.tsx (new),use-unsaved-changes-guard.ts (new)}`;
`libs/feature-recipes/src/routes/recipe-new.spec.tsx`, `src/testing/setup.ts`; `libs/i18n/src/he.json`;
`_bmad-output/implementation-artifacts/sprint-status.yaml` (3-2: review), this file.

## After review: login error screen, error page back button

- **"משהו השתבש" on /login:** reproduced on Adi's dev server (:4200, read-only: I only opened the page): the console shows
  `504 Outdated Optimize Dep` for `react-hook-form` and `@hookform/resolvers/zod`, the two packages the lazy login chunk loads. It is
  Vite's dependency-optimizer cache in the running dev server going stale, not app code: the same page loads fine on a fresh dev server
  (:4202, own cache) and in the production build, directly, by link, via the `/recipes/new` guard redirect, and via the session-expiry path.
  Main is not affected by any code bug. **Fix: restart `npm run dev:web` (or `nx serve web --force`) and hard-refresh the tab.** I did not
  touch Adi's servers or cache. A unit test cannot catch a dev-server cache problem; `account-slot.spec.tsx` already renders the lazy
  `/login` inside the real router.
- **Error page and not-found page** now have the shared `BackLink` ("חזרה לרשימה", link to `/`), and the error page keeps a "רענון הדף"
  button (`error.refresh`; not shown for a thrown 404). They link to `/` rather than use `useBackNavigation`: that hook lives in
  `data-access` (AD-11 keeps it out of the entry) and "one step back" from a failed page returns to the failure. Tests in `router.spec.tsx`.
- **Found while checking: session expiry vs the guard.** When a 401 sends a dirty form to `/login?next=…` the guard now asks "לצאת בלי
  לשמור?". "לצאת" goes to login as before. "להישאר" leaves the user on the form with the session gone and no new redirect
  (`use-session-expiry` marks it handled). Not changed; needs Adi's call (let the expiry redirect bypass the guard, or keep the question).
