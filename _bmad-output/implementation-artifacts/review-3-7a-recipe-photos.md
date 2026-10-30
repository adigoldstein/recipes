# Review: Story 3.7a Recipe photos: storage, upload API and display

Working tree on branch `claude/story-3-7a-recipe-photos` (cut from `main` at 1513c22). Not committed; for Adi's review. The
uncommitted `sprint-status.yaml` carries 3-6 `done`, 3-5 moved to 7-5, 3-7a `in-progress` and 3-7b `backlog`; `epics.md` has Story 3.7
split into 3.7a and 3.7b. Commit trailer on "c p": `Claude-Session: https://claude.ai/code/session_01Uibg2JgePptwJLiUbinmzh`.

## What it does

**Backend (`apps/recipe-service`)**

- **`POST /api/photos`** (editor; multipart `file`) returns `{photo_key}` (201). `photos.service.store` does the work:
  1. 413 `photo_too_large` over 10 MB; the type is read from the file itself (Pillow), never from its name or declared type, and only
     JPEG, PNG and WebP pass (415 `photo_unsupported_type`, which also covers a truncated or corrupt file);
  2. the size in the header is checked before any pixel is decoded: over 40 MP is 413 `photo_dimensions_too_large`, and Pillow's own
     decompression-bomb error maps to the same code;
  3. EXIF orientation is applied, then the picture is rebuilt from pixels only, so every trace of metadata (GPS, camera make, ...) is
     gone; transparency is kept (RGBA) and everything else is RGB;
  4. saved as WebP, quality 80: at most 1600 px on the long side plus a 600 px thumbnail, never enlarged, aspect ratio kept.
- **`GET /api/photos/limits`** (editor) returns `{max_bytes, content_types}` so 3.7b's form can show the limits beside the field. They come
  from `PHOTO_MAX_BYTES` and `PHOTO_MAX_PIXELS` in `Settings` (in `.env.example`).
  Both are listed with their defaults and a comment in `apps/recipe-service/.env.example` (10 MB and 40 MP). Adi's own, untracked `.env` was
  made before them, so it has no such lines; the defaults apply, and adding them there is optional. A new config test checks that `.env.example`
  lists every setting.
- **`PhotoStorage` port** (`photos/storage.py`) with a local-disk adapter: files `media/photos/{key}.webp` and `{key}-thumb.webp` under
  the data volume, written beside the target and renamed so a reader never sees half a file. The key is a random UUID in hex.
- **`/media/*`** is a separate mount (`MediaFiles`) that serves `data_dir/media` only (never the database), with
  `Cache-Control: public, max-age=31536000, immutable` since a key's bytes never change. It is its own mount, so no page fallback can
  answer it.
- **Recipe side** (migration `0004`, `photo_key` and `photo_credit_domain`, nullable): `RecipeCreate` and `RecipeUpdate` take
  `photo_key` (32-hex pattern, 422 otherwise). It is **tri-state on update**: left out keeps the photo, `null` removes it, a key sets
  it. An unknown key is 404 `photo_not_found` and nothing is saved. After the commit, `photos.service.release` deletes the files of a
  replaced or removed photo, and `delete_recipe` (3.6) releases the photo too. A failed save keeps the old files. A replaced photo drops
  its credit domain.
- **Startup sweep**: `lifespan` calls `sweep_unattached_photos`, which deletes photo files older than 24 h that no recipe holds. It scans
  the folder and file times, so there is no photos table and no scheduler.
- **Read schemas** return `photo: {url, thumb_url, credit_domain} | null` in `RecipeRead` and `RecipeSummary`, built by the server.
- **Seed**: `shakshuka.jpg`, `cake.jpg` and `chicken.jpg` (from the UX mockups) are in `app/seed_photos/` with `CREDITS.md`, and
  attach to "שקשוקה", "עוגת שוקולד" and "חזה עוף על האש" with credit domain `commons.wikimedia.org`. `run_seed(service, photos)` does it
  only for recipes it creates, so a re-run adds nothing.
- **Dependencies** (approved): `pillow>=13.0.0` and `python-multipart>=0.0.32` in `pyproject.toml` and `uv.lock`.
- **Errors** (`ErrorCode`): `photo_not_found`, `photo_too_large`, `photo_dimensions_too_large`, `photo_unsupported_type`, each with a Hebrew
  message in `he.json`.

**Frontend**

- **`RecipePhoto`** (`libs/ui-components`, with spec and story): a `figure` with the board's radius, the handle slot cut through the
  picture, `aspect-4/3` on a phone and `lg:aspect-video`, `object-cover`, width/height set, `fetchpriority="high"` and no lazy loading
  (it is the top of the page), and a caption line for the credit. Tokens only.
- **Detail page**: the photo sits between the back/edit row and the tags, with alt "תמונה של {title}" and the credit "מקור: {domain}"
  when there is one. A recipe without a photo looks exactly as before (no placeholder).
- **Cards**: they already used `photo.thumb_url` and `alt=""` (the title is beside the picture); they now also set width 600 and height
  450. **On a card with a photo the title now comes first and the photo below it** (Adi's call on 2026-10-30, a deliberate departure from
  UX-DR7's "photo, then title"). Title sizes are unchanged (smaller `text-title` with a photo, larger `text-display` without), the tags and
  time stay last, and equal-height cards are kept. `epics.md` (UX-DR7), `DESIGN.md` and `EXPERIENCE.md` were updated to say so.
- **API client**: regenerated (`photosUploadPhoto`, `photosGetLimits`, `photo_key` on the write types).

## Decisions as agreed

`/media/photos/{key}.webp` and `-thumb.webp`; limits in `Settings` and published through `GET /api/photos/limits`; upload then attach on
save with no photos table and a startup sweep; `photo_key` tri-state; WebP at quality about 80; JPEG, PNG and WebP only (no HEIC); credit
shown in the UI plus `CREDITS.md`; only the three matching sample photos.

## Things to know

1. **The browser keeps `/media` files for a year (`immutable`).** That is right for keys that never change, but it means that in a browser
   that already fetched a photo, the old URL still shows after the file is deleted on the server. Nothing in the app links to a removed
   key. I saw this while testing replace/remove from one page and confirmed the files were gone on the server and the volume.
2. **The photo is deleted after the commit, and a failure to delete does not fail the save** (it is logged, and the startup sweep removes
   the file once it is unattached for a day).
3. **Re-encoding drops the ICC colour profile** (only EXIF-style metadata was asked to go, but Pillow does not carry the profile into
   the new file). Wide-gamut phone photos may look slightly less saturated.
4. **Animated images**: a GIF is refused; an animated WebP or PNG would be saved as its first frame.
5. **Memory**: an upload up to 10 MB and 40 MP is decoded in memory (about 160 MB for a 40 MP RGBA picture). That is fine for one editor at
   a time; lower `PHOTO_MAX_PIXELS` if the host is small.
6. **The SPA fallback does not exist yet** (Epic 6), so "never answered by the SPA fallback" is true by construction for now (it is its
   own mount). When Epic 6 adds the fallback, `/media` and `/api` must stay ahead of it.
7. **The detail page is not changed by the card decision:** there the photo comes first and the title after it (back/edit row, photo with
   credit, tags and times, title, description). Adi can decide separately whether it should follow the cards.
8. **Not verified:** a real phone, a screen-reader pass, a real EXIF-rotated phone photo end to end in the browser (the pipeline is tested
   with generated pictures), and the credits wording by a lawyer.
9. **3.7b is not here:** the form still has no photo field, so editors cannot attach a photo from the UI yet, only through the API (and the
   seed). Editing a recipe in the current form keeps its photo (verified in the browser).

## Checks run

- `npm run verify` (lint, typecheck, test, build on all projects): 32/32 tasks succeeded. `npx nx format:check`: clean.
- Backend: 424 pytest tests pass (from 373). New: `test_photos_service.py` (the image pipeline: formats, EXIF orientation applied, EXIF and
  GPS stripped, big and tall pictures capped, no enlarging, byte limit, pixel guard and decompression bomb, type read from content,
  truncated file, sweep by age), `test_photos_api.py` (upload, access and CSRF, limits, `/media` serving, headers and unknown or
  traversal paths, create/update tri-state, replace, remove, same key, unknown key, failed save, credit dropped, delete releases files,
  startup sweep), seed tests (photos and credit, second run adds none). Images are generated in memory, so no binary fixtures.
- Frontend: `RecipePhoto` (alt, size, 4:3 and 16:9 classes, handle slot hidden from screen readers, credit only when present), detail
  page (photo and credit above the title, no credit, no photo and no placeholder), card width and height.
- **Initial JS (gzip, entry + modulepreload):** 155,268 B (151.6 KiB), +148 B against 3.6's 155,120 B. Budget 200 KB. There is still no
  `web:size` Nx target, so I summed the gzip sizes by hand. `RecipePhoto` and the photo code are in the lazy `recipe-detail` chunk
  (8,445 B gzip).
- **Browser (scratch DB in the session scratchpad, seeded with photos, one test editor; servers stopped afterwards):**
  - Desktop (1024 px): three library cards show their thumbnails (600 x 450, and the portrait chicken photo cropped by `object-cover`);
    the shakshuka page shows the 16:9 photo with the handle slot, alt "תמונה של שקשוקה" and "מקור: commons.wikimedia.org".
  - Editing "שקשוקה" through the current form (title only) kept the photo and its credit.
  - Through the API from the page: upload (3000 x 2000 JPEG) gave 201 with a 32-character key; attach gave a 1600 x 1067 photo and a
    600 x 400 thumbnail; replace gave the new 800 x 1200 photo; remove gave `photo: null`; a text file named `.jpg` was 415
    `photo_unsupported_type`. The folder held only the six seed files at the end, so replaced and removed files were deleted.
  - 375 px: the detail photo is 343 x 257 (4:3), the cards' images are 307 x 230, and there is no horizontal scroll.
  - Card order (checked on the dev client with the three photo cards against cards without one): the title is above the photo on every photo
    card (24 px on cards with a photo, 40 px without), rows stay equal in height, the image keeps width and height, `loading="lazy"` and
    `alt=""`. At 375 px "שקשוקה" shows title, photo, then the tags and time.

## Not in this story

The form's upload, replace and remove UI (3.7b), photos on import (Epic 5), the SPA fallback (Epic 6), HEIC support, a photo
credit shown with author and licence in the UI (only the domain, plus `CREDITS.md`).
