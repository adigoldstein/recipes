---
title: Adversarial review: ARCHITECTURE-SPINE (Bite & Board)
reviewed: ../ARCHITECTURE-SPINE.md (draft, rounds 1–4)
date: 2026-10-26
method: For each hole, two units one level down (stories or epics built by different developers or agents) that each follow every AD to the letter but still build incompatibly. Each finding proposes an enforceable AD rule that closes it.
---

# Adversarial Review: Architecture Spine

## Verdict

The spine sets the layering, the contract mechanism (OpenAPI to hey-api) and the security posture well. It does **not** pin down the shapes and owners that cross story boundaries: how amounts and units look on the wire, how tags and photos are created during a recipe save, which module owns `recipe_tag`, who handles a 401 for a public visitor, how errors become Hebrew text, and where meal types come from on a fresh database. Two careful implementers will build different, incompatible things in at least 6 places that are critical or high severity. Fix those with the rules below before the spine is finalized.

Severity counts: **critical 4 · high 9 · medium 8 · low 4**

---

## Critical

### C1. Amount type, precision and "equal to original" are undefined

- **Unit A, recipe form story:** sends `amount: 0.5` as a JS number. The user typed "½", which the form parses to 0.5, and "⅓", which it parses to 0.3333333333333333.
- **Unit B, recipes.service FR-7–9 story:** models `amount: Decimal` (no float drift is the textbook choice). Pydantic v2 **serializes `Decimal` as a JSON string**, so the generated TS type and Zod schema become `string`. Unit A's number fails the Zod check, or the form has to switch to strings. Separately, AD-4 says "if amount and unit equal the original, clear originals". Unit B compares `Decimal("0.333")` with the original `Decimal("0.3333333333333333")`, so they are not equal and reset-to-original silently never clears the hint (FR-9 AC fails, but only for thirds).
- **Unit C, scaling story:** the 100% branch-coverage tests are written against floats. The "nearest ½" and "2 significant decimals" rules then disagree with what the server stored.
- **Proposed AD-19 (Quantities):** `amount` is stored as `NUMERIC` quantized to 3 decimal places, exposed in OpenAPI as a JSON **number** (`float` on the wire, with a custom serializer from `Decimal`), and must be > 0 or `null`. `null` means to-taste. The server quantizes every incoming amount to 3 dp before any comparison or storage, and the FR-7–9 equality check compares the quantized values. The client parses fraction glyphs and `a/b` input with one shared `parseAmount()`.

### C2. Tags in a recipe save: ids only, but new tags have no id yet

AD-4 says PUT/POST carries "tag ids". FR-22 needs inline creation of a new tag, and FR-24 says suggested new tags "are only created if the owner keeps them and saves".

- **Unit A, recipe form story:** creates a tag when the user picks "יצירת תגית '{text}'" by calling `POST /api/tags` right away, then puts the new id in `tag_ids`. If the user cancels the form, an orphan tag is left behind, which breaks FR-24 for imports that reuse the same form.
- **Unit B, import review story:** the draft holds `suggested_tags: ["Party"]` as names. To honour FR-24 it creates the tags on Save, first a loop of `POST /api/tags` and then `POST /api/recipes`. That is two requests and not one transaction: if the recipe save fails with 422, the tags already exist.
- **Unit C, tags.service story:** owns tag creation (AD-7) and rejects a duplicate case-insensitive name with 409. A or B then has to find the existing id itself. FR-22 says "reuses it", but the spine does not say who does the reuse.
- **Proposed AD-7a:** the recipe write schema carries `meal_type_id: UUID` and `tags: list[TagRefIn]`, where `TagRefIn = {id: UUID} | {name: str}`. `recipes.service` resolves each name by calling `tags.service.get_or_create(group="tag", name)` **inside the recipe transaction**, so a tag is created only when a recipe save commits. The UI never calls `POST /api/tags` from the recipe form, only from `/tags`.

### C3. Photos: upload before the recipe exists, key vs URL, imported URL on save

AD-4 says the aggregate holds a `photo_key`. AD-14 says imported photos are downloaded "on save", and only `photos.service` writes them.

- **Unit A, photo upload in the new-recipe form:** there is no recipe id yet, so it adds `POST /api/photos` (multipart), which returns `{photo_key}`, and sends the key in `POST /api/recipes`. Nothing ever cleans up a key whose recipe save was abandoned.
- **Unit B, photo upload in the edit form:** implements `PUT /api/recipes/{id}/photo`, a second write path for `photo_key` outside the AD-4 whole-aggregate PUT. Now two writers own the same field. A full-aggregate PUT built from a form loaded before the upload can null the key out again.
- **Unit C, import review save:** the draft holds `photo_url: "https://site/img.jpg"`, which is not a key. To download "on save" it adds `photo_source_url` to `RecipeCreate`, and `recipes.service` fetches it. Two problems follow. **That public field is an SSRF vector** unless it goes through the AD-13 safe fetcher, which belongs to `imports`. And a network fetch now runs inside the DB transaction.
- **Unit D, recipe card and detail:** builds `/media/${photo_key}` on the client, while the photos story stores files as `{key}/1600.webp` and `{key}/600.webp`. The card loads the full 1600 px image or a 404, and the SPA fallback may answer `/media/*` 404s with `index.html`.
- **Unit E, recipe delete (FR-10):** deletes the DB row. The file is left behind because no AD says `recipes.service` must ask `photos.service` to release it.
- **Proposed AD-14a:** photos are uploaded first with `POST /api/photos` (owner, multipart; it also accepts `{source_url}` for imports, and that path uses the AD-13 safe fetcher). The upload returns an **unattached** `photo_key`. The recipe aggregate is the only way to attach or detach a key. `recipes.service` calls `photos.service.attach/release` after commit, and keys left unattached for more than 24 h are swept at startup. Read schemas expose `photo: {url, thumb_url, credit_domain} | null`, built by the server, and the client never builds `/media` paths. The SPA fallback excludes `/api/*` and `/media/*`.
- **Also:** the upload type and size limits the form must display (FR-4 AC) are not in the spine. Put them in config and expose them in OpenAPI (for example on `GET /api/photos/limits`) so the client and server do not hard-code them separately.

### C4. Global 401 → redirect conflicts with public browsing and the session probe

AD-6 says "the client handles a 401 in one place by redirecting to `/login?next=…`". With httpOnly cookies, the SPA can only learn whether the owner is logged in by asking the server.

- **Unit A, auth context story:** calls `GET /api/auth/me` on boot, which returns 401 when there is no cookie, the natural `require_owner` dependency. **Every anonymous visitor is redirected to `/login` on page load**, breaking FR-16 and UJ-6.
- **Unit B, login page story:** a wrong password returns 401 (the natural status), the global handler redirects to `/login?next=/login`, and the "Invalid email or password" message never shows.
- **Unit C, edit form story:** the 401 handler uses `window.location.assign`, so the in-memory form data that EXPERIENCE.md promises to keep across the login jump is lost. Another implementer uses `router.navigate` and keeps it, so the behaviour differs between forms.
- **Missing:** a logout endpoint. JS cannot clear an httpOnly cookie (FR-15). The spine also does not say whether `POST /api/auth/login` needs the `X-Requested-With` header, or whether a missing header is 401 or 403.
- **Proposed AD-6a:** `GET /api/auth/session` is public and always returns 200 `{owner: {email} | null}`. `POST /api/auth/login` returns 400 `invalid_credentials` (not 401) and 429 when rate-limited. `POST /api/auth/logout` clears the cookie. The redirect-on-401 interceptor lives in the single hey-api client config in `libs/data-access`, fires only for mutations and owner-only routes, and navigates through the router. A missing CSRF header returns 403 `csrf_header_missing`, never 401.

---

## High

### H1. Units: Hebrew labels vs English codes, and which units are "countable"

- **Unit A, the LlmProvider/DraftRecipe story:** the draft is "Hebrew-translated with units mapped to the app list", so the prompt returns `unit: "כפית"`.
- **Unit B, the RecipeCreate schema:** `unit: Literal["g","kg",…]`, the PRD codes. A's draft fails validation, or A's adapter adds an ad-hoc Hebrew→code map.
- **Unit C, scaling:** "unit-type ingredients to the nearest ½" is implemented as `unit === "unit"` only. Another implementer includes `clove`, `slice`, `can` and `package`, so "1.25 cloves" shows as 1.25 in one and 1 in the other.
- **Proposed AD-20 (Units):** `Unit` is one Python `StrEnum` of the PRD's English codes, published as an OpenAPI enum and used by `RecipeCreate`, `RecipeRead` **and** `DraftRecipe`. Hebrew appears only as `he.json` keys `units.<code>_one/_other`. The countable set (`unit, clove, slice, can, package`) is a constant defined once beside the enum and mirrored by the generated TS, never retyped by hand.

### H2. `recipe_tag` has two owners, and recipes ↔ tags form a dependency cycle

AD-1 says modules talk only through services. AD-7 says `recipes.service` enforces the meal-type rules, while `tags.service` deletes tags, detaches them, and checks whether a meal type is in use.

- **Unit A, the recipes module:** puts `recipe_tag` in `recipes/models.py` and writes it from `recipes.repository`. To check `group == meal_type` it calls `tags.service`.
- **Unit B, the tags module:** needs the "used by N recipes" count and the detach-on-delete step, so it calls `recipes.service.count_by_tag()` and `recipes.service.detach_tag()`. Now `recipes.service` imports `tags.service` and the reverse, a circular import. Or B queries `recipe_tag` from `tags.repository`, which breaks AD-1.
- **Proposed AD-7b:** `recipe_tag` belongs to the **tags** module. `recipes.service` depends on `tags.service` (`validate_for_recipe`, `set_recipe_tags`, `tags_for_recipes`), and `tags` never imports `recipes`. The module dependency graph is the DAG `imports → tags`, `recipes → tags, photos`, `imports ✗ recipes`, enforced by an import-linter contract in CI.

### H3. Ingredient identity on PUT, and to-taste originals

- **Unit A, the recipes repository:** implements "PUT replaces the full aggregate" as delete-all-then-insert. The ingredient ids change and `original_*` is lost, because the service only sees new ingredients.
- **Unit B, the recipes service:** matches by `id`. A client that sends an id belonging to _another_ recipe is not rejected, and that ingredient's original fields get copied.
- **Edge case, to-taste:** cumin goes from 1 tsp to null (to-taste). The service stores `original_amount = 1, original_unit = tsp`, which is fine. Salt goes from null (to-taste) to 2 tsp. The original is `(null, null)`, which looks the same as "no original", so the hint is lost. A third implementer adds a `has_original` flag, and the two read shapes now differ.
- **Proposed AD-4a:** the PUT diff matches by ingredient `id` and updates rows in place. An `id` that does not belong to the recipe returns 422. An omitted id means delete, and a row without an id is an insert. An original is represented by an explicit `original: {amount, unit} | null` object on `IngredientRead`, so `{amount: null, unit: null}` means "originally to taste". The order of `ingredients[]` and `steps[]` in the array is the only ordering, and `position` never appears on the wire.

### H4. Library: server-side vs client-side search and filters, list shape, and URL params

- **Unit A, the `recipes.router` list story:** `GET /api/recipes?q=&meal=&tags=` filters in SQL and returns `{items, total, page}` with a default page size of 20.
- **Unit B, the library page story:** reads "search < 100 ms per keystroke" and "no infinite scroll, render one list". It fetches once and filters with `useDeferredValue` on the client, assuming the response is a bare array that contains everything. With A's server, B only ever sees the first 20 recipes.
- **URL params:** `?meal=` holds a UUID in A and a meal-type **name** in B (readable URLs). After a rename (FR-23), B's bookmarked or back-navigated URL matches nothing. `?tags=` could be comma-separated or repeated.
- **Proposed AD-8a:** `GET /api/recipes` returns **all** recipe summaries, unpaginated (A-1: at most a few hundred), as `RecipeSummary[]` sorted by `created_at desc, id`. Search and filtering run on the client over the cached list. URL params hold ids: `?meal=<uuid>&tags=<uuid>,<uuid>&q=<text>`. Unknown ids are dropped silently.

### H5. Server error text is English, the UI is Hebrew

AD-9 fixes the error shape as `{detail: string}` and the 422 `detail[].msg`. AD-10 says every UI string is an i18next key.

- **Unit A, login:** shows `detail` straight from the server ("Invalid email or password"), which puts English in a Hebrew UI.
- **Unit B, tag management:** must show "used by 7 recipes" when deleting a meal type that is still in use (FR-23), but `{detail: string}` has no field for the count. B parses it from the English sentence with a regex.
- **Unit C, the form helper:** maps 422 `msg` ("String should have at least 1 character") onto the field, again in English. Another form maps `type` to an i18n key. The generated Zod schemas also produce English client-side messages.
- **Proposed AD-9a:** every non-422 error is `{detail: string, code: ErrorCode, params?: object}`, where `ErrorCode` is a `StrEnum` published in OpenAPI and rendered on the client only as `errors.<code>` in `he.json`. 422 field errors are mapped by `loc` + `type` to i18n keys. The client never renders server `detail` or `msg` text. A global Zod error map turns client validation errors into the same keys.

### H6. Import timeouts: the client's 60 s vs ollama's 180 s, and the import error taxonomy

- **Unit A, the import dialog:** follows EXPERIENCE.md, "Hard timeout at 60s", so it aborts at 60 s. With the default `ollama` provider (180 s, AD-12), every slow CPU import is cancelled by the client while the server keeps running the model, and the request still counts against the daily cap.
- **Unit B, the imports router:** returns 422 for "no recipe found", which AD-9's shared helper then tries to map onto fields. It returns 502 for a fetch failure and 504 for a timeout. Unit A expects distinguishable codes so it can pick between the "switch to paste tab", "try again" and "retry with Gemini" states.
- **Proposed AD-12a:** `GET /api/imports/providers` (owner) returns `[{name, timeout_s}]`, and the client abort timer is `timeout_s + 5`. Import failures use AD-9a codes: `fetch_blocked`, `fetch_failed`, `fetch_too_large`, `no_recipe_found`, `llm_timeout`, `llm_unavailable`, `llm_quota`, `llm_invalid_output`, `import_cap_reached`, with status 4xx/5xx but **never 422**. Cancelling releases the cap slot on a best-effort basis. The Vite proxy and uvicorn timeouts are set above the largest provider timeout.

### H7. Hand-off from draft to form, and the DraftRecipe shape

- **Unit A, the import dialog:** navigates to `/recipes/new?draft=<base64 JSON>`, which is what EXPERIENCE.md's route table literally says. A 5 KB Hebrew draft goes into the URL and the history, and a reload replays it.
- **Unit B, the recipe form:** expects the draft in router `location.state`, typed as `RecipeCreate`. The draft actually has nullable `servings` and `meal_type`, tag **names**, a photo **URL**, and no ids, so `RecipeCreate` Zod rejects it before the form can show the "יש להשלים" flags.
- **Unit C, the draft flags:** Unit C computes "needs completing" as `value == null` on the client. The provider story returns `missing_fields: [...]` from the server. The two disagree on whether an empty-string description counts as missing.
- **Proposed AD-12b:** `DraftRecipe` is its own OpenAPI schema: every field is nullable, `meal_type_id` holds the suggested id (existing types only), `tags` are `TagRefIn` (C2), there is `photo_source_url`, and there is `missing_fields: list[str]` (the server is authoritative). It travels to the form only in router `location.state` (never in the URL), and one `draftToFormValues()` function in `apps/web` maps it. A reload of `/recipes/new` with no state shows an empty form.

### H8. Seed vs migrations: where meal types come from, and how the seed writes originals

- **Unit A, the seed story (FR-12):** the seed inserts the 8 meal types and the demo recipes. A fresh database without the seed has no meal types, so the recipe form cannot satisfy "exactly one meal_type" and the user cannot create a recipe at all.
- **Unit B, a migration story:** adds the meal types in an Alembic data migration with **English** names ("Breakfast"). Unit A's seed inserts "ארוחת בוקר", so the database ends up with 16 meal types, because uniqueness is per `(group, lower(name))`.
- **Unit C, seed recipes with an original hint:** FR-12 needs one ingredient with a hint. AD-4 says only `recipes.service` sets originals, and only when an existing ingredient is updated. The seed writes `original_amount` directly through the repository, which breaks AD-1 and AD-4. Or it does a create followed by an update through the service, which no rule describes.
- **Proposed AD-18a:** the default meal types are inserted by an Alembic data migration with fixed UUIDs and **Hebrew** names. The seed (`nx run recipe-service:seed`) creates demo data only through services (create, then update, for the hinted ingredient), skips any recipe whose title already exists, and never creates meal types.

### H9. Generated hook names depend on FastAPI's default operationId

- **Unit A, the recipes router story:** leaves FastAPI's default `operationId` (`list_recipes_api_recipes_get`), so the hooks are `listRecipesApiRecipesGetOptions`.
- **Unit B, the tags router story:** sets `operation_id="listTags"` by hand. The naming is inconsistent, and if Unit A later renames a path parameter, the hook names change and every consumer breaks. The AD-3 drift check passes because regeneration is consistent with itself.
- **Proposed AD-3a:** `FastAPI(generate_unique_id_function=lambda r: f"{r.tags[0]}_{r.name}")`, and every router declares `tags=[<module>]`. Route function names are `verb_noun` (`list_recipes`, `update_recipe`). A test asserts that every operationId is unique and matches `^[a-z]+_[a-z_]+$`.

---

## Medium

### M1. Query keys and cache invalidation

- **Unit A, the recipe save mutation:** invalidates `['recipes']`, a key written by hand.
- **Unit B:** uses the generated `listRecipesQueryKey()`, which looks like `[{_id: 'recipes_list_recipes', …}]`. A's invalidation matches nothing, so the stale library survives the save.
- **Unit C, tag rename (FR-23):** invalidates only the tags query. The recipe cards and the detail page keep the old tag name, because they embed tag names.
- **Proposed AD-8b:** invalidation uses only the generated `*QueryKey()` helpers, through one `invalidate.ts` map in `libs/data-access`: a recipe write invalidates the list and that recipe's detail; a tag or meal-type write invalidates tags, the list and all details; login and logout invalidate the session. Hand-written query keys are banned by lint.

### M2. Scaling and formatting live in two places (and ui-components can't import data-access)

- **Unit A:** puts `scale()` and `formatAmount()` in `libs/data-access`, as the capability map says.
- **Unit B, the presentational `IngredientLine` in `libs/ui-components`:** needs formatted amounts and the plural unit labels. AD-2 forbids it from importing data-access, so it re-implements rounding. The two now drift: the hint is scaled in one and not the other.
- **Proposed AD-2a:** scaling, rounding, `parseAmount` and the countable-unit logic live in one pure lib, `libs/recipe-domain` (no React, no IO, tagged `type:domain`), which both containers and ui-components may import. Alternatively ui-components receives only preformatted strings. Pick one; the review recommends the pure lib. The server never scales.

### M3. Read vs write schemas, and client-sent originals

- **Unit A:** reuses one SQLModel class for read and write, so the generated `RecipeUpdate` includes `original_amount`. The form round-trips it, and the server silently ignores it.
- **Unit B:** uses `extra="forbid"`, so Unit A's form gets a 422 on every save.
- **Proposed rule (in AD-4):** the API schemas are plain Pydantic `RecipeCreate/RecipeUpdate/RecipeRead`, never SQLModel table classes. Write schemas use `extra="forbid"` and have no `original*` fields. Read schemas embed `meal_type: TagRef{id,name}` and `tags: TagRef[]`.

### M4. FakeLlmProvider contract vs the SSRF guard in e2e

- **Unit A, the Playwright "import with fake" test:** imports `http://localhost:4173/fixtures/focaccia.html`. The AD-13 fetcher rejects loopback, so the test cannot pass in CI.
- **Unit B, the backend tests:** the fake returns one hard-coded draft whatever the input. No test can then reach `no_recipe_found` or `llm_timeout`, and the import dialog's error states (EXPERIENCE) go untested.
- **Proposed AD-16a:** when `LLM_PROVIDER=fake`, the fake also replaces the fetcher (an injected `PageFetcher` port), and it is deterministic by input: `fake://<fixture>` URLs and text that starts with `FAKE:<scenario>` select fixture drafts or error codes from `imports/providers/fake_fixtures/`. The `fake` provider refuses to start when `ENV=production`.

### M5. SQLite foreign keys are off by default

- **Unit A, tag delete (AD-7, "detaches from all recipes"):** relies on `ON DELETE CASCADE` in the migration.
- **Unit B, recipe delete:** relies on the cascade for ingredients and steps. SQLite ignores both unless `PRAGMA foreign_keys=ON` is set **per connection**. Tests pass or fail depending on whether a fixture set the pragma.
- **Proposed rule (in AD-18):** `app/core/db` sets `PRAGMA foreign_keys=ON` (and WAL) on every connection through an engine `connect` event. Alembic uses `render_as_batch=True`. The test fixture runs `alembic upgrade head`, not `create_all`, so migrations are exercised by every test run.

### M6. Timestamps: SQLite returns naive datetimes

- **Unit A, the models:** use `datetime.utcnow()`. SQLite returns naive values and the JSON has no `Z`.
- **Unit B, the card or detail page:** passes the value to `new Date()`, which treats it as local Israel time and shifts it by 2–3 h.
- **Daily import cap:** the "daily" cap (AD-13) resets at UTC midnight in one implementation and at local midnight in another.
- **Proposed rule (Conventions):** a shared `UtcDateTime` type stores UTC and always serializes as `…Z`. The daily import cap resets at 00:00 in `APP_TIMEZONE` (default `Asia/Jerusalem`) from config.

### M7. CSRF header and credentials on the generated client (including multipart)

- **Unit A:** adds `X-Requested-With` in a fetch wrapper for JSON mutations.
- **Unit B:** the photo upload uses the generated multipart call, or a raw `fetch` (AD-2 forbids it, but it is tempting for progress events), and leaves the header off, so it gets a 401 or 403. Upload _progress_ (EXPERIENCE) is not possible with `fetch` at all.
- **Proposed rule (in AD-6):** one `client.setConfig` in `libs/data-access` sets `credentials: 'same-origin'` and the CSRF header for every non-GET request. Photo upload goes through one data-access `uploadPhoto()` that uses XHR for progress and is the single sanctioned exception to "generated client only".

### M8. Form model vs wire model (RHF `useFieldArray` and the `id` key)

- **Unit A:** feeds `RecipeRead` straight into `useForm`. `useFieldArray` puts its own generated `id` on each row in `fields`. A developer who renders `fields[i].id` into a hidden input, or spreads `fields` into the payload, sends random ids, which by AD-4a means "delete and insert", so originals are lost.
- **Unit B:** uses string inputs for amount (needed for "½"), while the generated Zod expects numbers.
- **Proposed rule (in AD-9):** the form has its own `RecipeFormValues` type (amount as string, `ingredient_id` instead of `id`). Exactly two pure functions, `toFormValues(RecipeRead | DraftRecipe)` and `toWritePayload(values)`, convert between them, and `toWritePayload` is validated with the generated write Zod before sending.

---

## Low

### L1. Tag name normalization

`lower(name)` uniqueness does not trim or collapse whitespace, and does not NFC-normalize Hebrew (niqqud, composed vs decomposed forms). As a result "BBQ " and "BBQ" become two tags from two different entry paths: the form combobox and the import. **Rule:** `tags.service` normalizes names (NFC, trim, collapse whitespace, max 40 chars) before every compare or store.

### L2. Rate limiter state and key

A 5/min in-memory limiter keyed by client IP sees every request as `127.0.0.1` behind the Vite proxy or a prod proxy, and resets between tests inconsistently. **Rule:** limit by IP taken from `X-Forwarded-For` only when the request comes from a configured trusted proxy, store the state in-process (single container), and have a pytest fixture reset it.

### L3. Concurrent edits (two tabs)

AD-4's whole-aggregate PUT means the last write wins with no warning. **Rule:** accept this explicitly for the MVP, or add an `updated_at` precondition that returns 409 `stale_recipe`. State the choice either way.

### L4. Provider names on the wire

"Retry with Gemini" sends `provider: "gemini"`. Because providers are enabled from config, this cannot be an OpenAPI enum, and an unknown name gets 422 in one implementation and 400 in another. **Rule:** an unknown or disabled provider returns 400 `provider_unavailable` (AD-9a).

---

## Proposed rule index

| New / tightened AD                                                                                                                            | Closes |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AD-19 Quantities (3-dp NUMERIC, JSON number, quantized equality, shared `parseAmount`)                                                        | C1     |
| AD-7a Recipe write carries `TagRefIn` (id or name); tags are created in the recipe transaction                                                | C2     |
| AD-14a Photo upload returns an unattached key; the aggregate is the only attach path; server-built URLs; safe fetch for `source_url`; sweeper | C3     |
| AD-6a Public `/auth/session`, login 400 (not 401), logout endpoint, scoped 401 interceptor, 403 for CSRF                                      | C4     |
| AD-20 `Unit` StrEnum of English codes everywhere; Hebrew only in i18n; one countable set                                                      | H1     |
| AD-7b `recipe_tag` owned by tags; module DAG enforced by import-linter                                                                        | H2     |
| AD-4a Id-matched diff, foreign ids rejected, explicit `original` object, array order authoritative                                            | H3     |
| AD-8a Unpaginated summary list, client-side filtering, id-based URL params                                                                    | H4     |
| AD-9a `{detail, code, params}` with an `ErrorCode` enum; client renders only i18n keys; Zod error map                                         | H5     |
| AD-12a Provider timeouts from the server drive the client abort; import error codes, never 422                                                | H6     |
| AD-12b `DraftRecipe` schema with `missing_fields`; passed via router state only                                                               | H7     |
| AD-18a Meal types from a Hebrew data migration; seed goes through services                                                                    | H8     |
| AD-3a `generate_unique_id_function` = `{tag}_{func}`; naming test                                                                             | H9     |
| AD-8b Generated query keys only, plus one invalidation map                                                                                    | M1     |
| AD-2a `libs/recipe-domain` pure lib for scale, format and parse                                                                               | M2     |
| AD-4 additions: separate Pydantic API schemas, `extra="forbid"`                                                                               | M3     |
| AD-16a Deterministic fake plus fake fetcher; scenario fixtures; prod guard                                                                    | M4     |
| AD-18 additions: FK pragma, batch mode, tests via `alembic upgrade`                                                                           | M5     |
| Conventions: `UtcDateTime` with `Z`; `APP_TIMEZONE` for the daily cap                                                                         | M6     |
| AD-6 additions: one client config; `uploadPhoto()` exception                                                                                  | M7     |
| AD-9 additions: `RecipeFormValues` plus two mapping functions                                                                                 | M8     |

Note: AD-2a (a new lib), AD-7b (module ownership) and AD-8a (client-side filtering, no pagination) are architecture decisions. Under CLAUDE.md, Adi has to agree to them before they are adopted.
