# Review: Story 3.7b Recipe photos: the form's upload, replace and remove

Working tree on branch `claude/story-3-7b-form-photo-upload` (cut from `main` at b19b09f). Not committed; for Adi's review. The uncommitted
`sprint-status.yaml` carries 3-7a `done` and 3-7b `in-progress`. Commit trailer on "c p":
`Claude-Session: https://claude.ai/code/session_01Uibg2JgePptwJLiUbinmzh`.

## What it does

Frontend only; the backend from 3.7a is unchanged.

- **`uploadPhoto(file, {onProgress, signal})`** (`libs/data-access/src/upload-photo.ts`, exported from the lib) sends one image to
  `POST /api/photos` and resolves with the unattached `photo_key`. It uses `XMLHttpRequest`, because `fetch` cannot report upload progress.
  It follows the same rules as every other call: the client's base URL, the CSRF header, and the one session-expired event on a 401. A
  failure rejects with the API's error body, so `getErrorCode` reads it; a network or non-JSON failure rejects with a plain `Error`; an
  abort rejects with an `AbortError`.
- **`PhotoField`** (`libs/ui-components`, with spec and stories): the presentational field. Before there is a photo it offers
  "הוספת תמונה"; with one it shows the thumbnail (4:3) with "החלפה" and "הסרה". While uploading it shows the picture at lower opacity and a
  native `<progress>` bar with an accessible name and the percentage, and locks its buttons. The limits are the field's hint. A removed
  saved photo offers "החזרת התמונה" (only when the owner passes `onRestore`). The real file input is out of the tab order and hidden from
  screen readers, so the buttons are the control; `accept` is `image/jpeg,image/png,image/webp` with no `capture`. Tokens only, no inline
  style values.
- **`usePhotoUpload`** (`libs/feature-recipes/src/form`): picking a file checks it against the server's limits first (type and size, with
  the server's own Hebrew messages), then previews it with an object URL and uploads at once. On success the key goes into the form
  (`photoKey`, marked dirty); on a failure the previous picture comes back and the Hebrew message shows (the API's message for a code it
  knows, otherwise "העלאת התמונה לא הצליחה. אפשר לנסות שוב"). A second pick or leaving the form aborts an upload in flight and frees the
  preview.
- **Form values** (`recipe-form-values.ts`): two new fields. `photoKey` is tri-state, exactly as the API takes it: left out keeps the saved
  photo, `null` removes it, a key attaches an uploaded one. `toWritePayload` adds `photo_key` only when it changed. `photoPreview` is only
  what the form shows (the saved thumbnail, or the chosen file's preview) and is never sent. A removed photo that was never saved goes back
  to "left out", so removing a picture just chosen does not make the new-recipe form look changed.
- **`RecipeForm`**: the field sits after "קישור למקור" and before the tags. Its limits text comes from `GET /api/photos/limits`
  ("JPEG, PNG או WebP, עד 10 מ״ב"; without the answer it says just the types). While an upload runs, Save is disabled and a status line
  ("מחכים לסיום העלאת התמונה") shows next to it. Any change to the photo marks the form dirty, so the unsaved-changes guard covers it.
- **Detail page order** (approved with this story): back and edit row, tags and times, title, description, then the photo with its
  credit. The title now comes before the photo, as on the cards. `DESIGN.md` and `EXPERIENCE.md` say so.
- **he.json:** `recipeForm.photo.*`. **Tests:** see below.

## Decisions as agreed

Field after "קישור למקור" and before the tags; no cropping; "הסרה" without a confirm dialog (it takes effect on save, and the guard covers
it); "החלפה" when another file is chosen while one is shown; upload on pick and attach on save (AD-27); `accept` with the three types and no
camera; limits from `GET /api/photos/limits`; `photo_key` sent only when it changed; Adi's real `.env` untouched.

## Things to know

1. **I added "החזרת התמונה" (undo a removal until save).** It was not in the five recommendations, but `EXPERIENCE.md` already specifies
   it ("a removed photo is dropped on Save, and 'החזרת התמונה' is available until then"). It shows only after removing a saved photo. It is
   small and easy to take out if Adi would rather not have it.
2. **An abandoned upload leaves its files on the server until the next start.** Picking a file uploads at once (AD-27); if the form is left
   without saving, the files stay unattached and the startup sweep removes them after 24 h. The guard's dialog is the only warning.
3. **Progress is real but fast locally.** A local upload ends in a blink, so only 0 and 100 were seen in the browser. The bar follows
   `XMLHttpRequest` upload events, covered by unit tests; on a phone over mobile data it will move.
4. **Uploading needs the page to stay open.** Leaving the form (after the guard) aborts an upload in flight.
5. **Memory and size are the server's limits** (10 MB, 40 MP, from 3.7a); the form checks the size and type first so a wrong file is refused
   without a trip. A renamed text file passes the client check and is refused by the server (its content is checked there).
6. **Test-environment note:** jsdom's `File` cannot be parsed by Node's multipart reader, so the form tests read the upload body as text.
   This is a test detail, not an app behaviour.
7. **Not verified:** a real phone's file picker or camera, a screen reader pass, HEIC from an iPhone (Safari normally converts it to JPEG
   because of the `accept` list), and an upload that takes seconds over a slow network.

## Checks run

- `npm run verify` (lint, typecheck, test, build, all projects): 32/32 tasks succeeded (run with `--parallel=2`, because `web:test`'s
  5 s timeout can trip when everything runs at once on this machine). `npx nx format:check`: clean.
- New tests: `upload-photo.spec.ts` (9: the multipart request and CSRF header, progress, errors, 401, network failure, abort),
  `photo-field.spec.tsx` (the field's states, accessibility attributes, restore), `recipe-photo.spec.tsx` (20: the new form and the edit
  form, upload and save, no photo sent when untouched, replace, remove, restore, wrong type, too large, server refusals, network failure,
  Save locked while uploading, the unsaved-changes guard), the detail page (title before photo), and the form-values mapping.
- **Initial JS (gzip, entry + modulepreload):** 155,381 B (151.7 KiB), +113 B against 3.7a's 155,268 B. Budget 200 KB. There is still no
  `web:size` Nx target, so I summed the gzip sizes by hand. `uploadPhoto` lives in the lazy data-access chunk; the form chunk grew to 19,221 B
  gzip.
- **Browser (scratch DB in the session scratchpad, seeded, one test editor; servers stopped afterwards):**
  - The new-recipe form shows the photo field after "קישור למקור" and before the tags, with "JPEG, PNG או WebP, עד 10 מ״ב" from the server,
    `accept` set to the three types and no `capture`.
  - Picking a 4 MB JPEG showed the thumbnail with "החלפה" and "הסרה"; after filling the required fields and saving, the detail page showed the
    title and then the photo, with alt "תמונה של עוגה לבדיקה".
  - A text file named `.jpg` got "אפשר להעלות תמונה בפורמט JPEG, PNG או WebP" from the server (415); a `.txt` and an 11 MB file were refused in
    the form with "אפשר להעלות…" and "התמונה גדולה מדי…". The previous picture stayed each time.
  - Edit: replacing with a PNG saved a new key and the old file returned 404; remove showed "הוספת תמונה" and "החזרת התמונה" with no dialog,
    restore brought the picture back, and remove then save gave `photo: null` and a 404 for the old file.
  - Cancel: after choosing a photo, "חזרה למתכונים" opened "לצאת בלי לשמור?" with focus on "להישאר"; leaving created no recipe.
  - 375 px: no horizontal scroll, both buttons are 44 px high, and the thumbnail is 320 x 240.

## Not in this story

Cropping or rotating in the form, drag and drop, several photos per recipe, photos from an import (Epic 5), HEIC support, and a progress
view for very slow connections beyond the bar.
