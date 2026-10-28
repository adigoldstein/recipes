# Review: Story 2.5 Change role, block, reset password

Working tree on `main` at 716a5e7. Not committed; for Adi's review. Branch to use on "c p": `claude/story-2-5-manage-users`.

## What it does

- **Server:** `PATCH /api/users/{user_id}` (admin only). The body is any of `role`, `is_blocked`, `password` (at least one, no
  `null`, no other fields). It returns the updated `UserRead`, or 404 `user_not_found`, 409 `last_admin`, 422 for a bad
  password (`password_too_short`/`password_too_long`) or a bad body.
- **Sessions:** the `user` table gets `session_version` (default 0). The session JWT now carries it (`sv`), and every request
  compares it with the database. A password reset bumps it, and so does blocking, so **all of that user's cookies stop
  working at once**, and unblocking later cannot bring an old cookie back to life. A token without `sv` counts as 0, so nobody
  is signed out by the upgrade.
- **Blocked login:** a blocked account with the **right** password gets 403 `account_blocked`; the login page shows
  "החשבון חסום. יש לפנות למנהל.". A wrong password still gets the generic 400, so the blocked state is only revealed to
  someone who knows the password. A user blocked mid-session takes the existing 401 path ("פג תוקף החיבור" and a trip to
  `/login`).
- **Last admin:** demoting or blocking the last active admin (role admin, not blocked) is 409 `last_admin`. The check runs
  after the write but before the commit, inside one transaction: the write takes SQLite's single write lock, so two admins
  acting at the same moment cannot both succeed. The UI disables those two menu items with "חייב להישאר מנהל אחד לפחות".
- **UI:** each row on `/users` has a "⋮" menu (`DropdownMenu`): "הפיכה למנהל"/"הפיכה לעורך", "חסימה"/"ביטול חסימה" and
  "איפוס סיסמה". Role and block open a `ConfirmDialog` that names the user; reset opens a small form (new password and
  confirmation, 8+ characters). The signed-in admin's own row has no reset (they use "החשבון שלי" from Story 2.6).

## Decisions applied (Adi: "ok" = all 4 recommendations)

D1 `session_version` column (Alembic 0003), carried in the token, bumped on reset and on block. D2 403 `account_blocked`
only after a correct password. D3 last-admin rule only (no extra self-protection), reset hidden on one's own row, and an
admin may demote or block themselves while another active admin exists. D4 "⋮" menu per row plus a presentational
`ConfirmDialog` in `ui-components`.

Small choices:
- **Self change:** if the admin steps down or blocks themselves, the page drops the cached list, re-reads the session and
  goes to `/` (otherwise the list would fail with a 403/401 under them).
- **Several fields in one PATCH** apply together and are checked together (demote + block in one request is still refused for
  the last admin). The UI sends one change at a time.
- **CLI reset** (`create-admin --reset-password`) now also bumps `session_version`, so a reset from the command line ends
  the old sessions too.
- **`ConfirmDialog` does not close itself.** The bare `AlertDialogAction` closes on click, which would hide a refusal; the
  dialog stays open until the owner closes it, shows the error in a `role="alert"` line, and cannot be dismissed while the
  request runs.
- The dialogs are mounted only while open, so each opening starts with no old error and an empty form.

## Things to know

1. **The migration does not rebuild the `user` table.** Alembic's batch mode copies a table through reflection, and SQLite
   reflection skips the expression index `uq_user_lower_email` (`lower(email)`): a rebuild would silently drop the
   case-insensitive uniqueness. Migration 0003 uses plain `ALTER TABLE ... ADD COLUMN` and `DROP COLUMN`. Nothing else
   rebuilds, so `migration_transaction` was not needed, but it still wraps every migration run. A test checks the index
   survives upgrade and downgrade, and another that existing users keep their data and start at version 0.
2. **Initial JS (gzip, entry + modulepreloads from `apps/web/dist/index.html`):** before **152,061 B (148.5 KiB)**, after
   **153,283 B (149.7 KiB)**, so +1.2 KiB; budget 200 KB. The lazy `users-*.js` chunk went from 43.8 KB to 59.1 KB raw (the
   confirm and reset dialogs, the menu). Rollup moved the shared Radix dropdown-menu code (used by the account menu and now
   the users page) into the shared `button-*.js` chunk, which is what grew the preload. `data-access` and the alert dialog
   stay out of the entry.
3. **Windows line endings:** a few edits of mine first wrote CRLF; every changed file is LF again (`git diff --check` clean,
   `nx format:check` exit 0).
4. **Not changed on purpose:** `invalidationMap` in `data-access` is still empty, so `useUpdateUser` invalidates
   `usersListUsersQueryKey()` directly, like the add dialog (note from 2.4 still stands).
5. **Open for 2.6:** "החשבון שלי" will change the user's own password. It should re-issue the cookie with the new
   `session_version` so the user stays signed in (the story says the session stays valid); the building blocks
   (`create_session_token(..., session_version=)`) are already there.
6. Not verified: a screen-reader and keyboard-only pass of the new dialogs and menu (the primitives are Radix, and the
   tests check roles, labels, `aria-disabled` and `aria-describedby`), and a real two-browser block while the blocked user is
   mid-session (covered by API tests with two clients).

## Checks run

- Backend (`nx run-many -t lint typecheck test -p recipe-service`): ruff, ruff format, import-linter (13 contracts kept),
  mypy strict, **295 pytest tests**. New: `tests/test_users_update_api.py` (≈40 cases): visitor 401, editor 403, missing CSRF
  header 403, promote/demote, a demotion shows on that user's next request, blocking ends the session, an old cookie stays
  dead after unblock, no version bump for a repeat block, blocked login 403 with the right password and 400 with a wrong one,
  unblock logs in again, password reset ends every session and only the new password works, 8-128 length rules (empty, short,
  129), a blocked user's password can be reset, combined changes, invalid bodies (empty, bad role, nulls, unknown field), 404,
  malformed id 422, **last-admin** (demote, block, both together, with a password in the same request, a blocked admin does
  not count, editors do not count, allowed while another admin is active, two admins cannot remove each other). Also
  `test_security.py` (version round trip, missing `sv` = 0, malformed `sv` rejected) and `test_migrations.py` (data kept,
  index kept both ways) and `test_users.py` (the CLI reset ends old sessions).
- Frontend: `ConfirmDialog` 8 tests; `feature-users` 32 tests (21 new in `user-actions.spec.tsx`: menu per row, wording per
  state, no reset on own row, last-admin disabled with the message, a blocked admin is not counted, each confirm flow with
  the exact PATCH body and CSRF header, cancel sends nothing, a refusal stays in the dialog, an old error is forgotten, a
  self step-down goes home, reset form validation, server-rejected password on its field); `feature-auth` +1 (blocked
  message on the login page). `nx run-many -t lint typecheck test build` for all non-Python projects: green.
  `nx run ui-components:build-storybook`: builds (new `UI kit/ConfirmDialog` story: default, destructive, with error).
- `nx run data-access:generate` rerun: `usersUpdateUser*`, `UserUpdate`, and the two new `ErrorCode` values appear.
- **Real browser run** (Browser pane at 375 px) against a throwaway database and throwaway users, not your dev DB: log in as
  admin -> `/users` lists three users with "⋮" menus, no overflow -> the admin's own menu (the only active admin) shows
  "חייב להישאר מנהל אחד לפחות", with role and block disabled and no reset -> Dana's menu -> "חסימה" -> the confirm dialog
  "לחסום את Dana?" -> confirm -> the row gets the "חסום" label and the toast "Dana נחסם" -> logging in as Dana shows
  "החשבון חסום. יש לפנות למנהל." on the login page. The scratch API and dev server were stopped afterwards.

## Addendum: back button on the Users page (Adi's rule: every page except the library has one)

- **Shared, not copied.** The back button from the recipe detail page (Story 1.10) moved into `libs/ui-components` as
  `BackLink` (props: `label`, and a `link(children)` render function, the same pattern as `RecipeCard`'s `link`, because
  that lib may not import the router). The history rule moved into `libs/data-access` as
  `useBackNavigation()` (returns `{cameFromApp, onBack}`): after an in-app visit one step back in history returns to the page
  the admin came from, and on a direct visit or a reload the link goes to `/` (the library). Both the recipe detail page and
  the Users page use them, so the detail page's markup and behaviour are unchanged (its existing back tests still pass).
- **Users page:** a ghost "חזרה למתכונים" button above the title (new key `users.back`), arrow pointing to the start of the
  line, 44 px high, logical classes only. Top padding went from `pt-8` to `pt-4` to match the detail page's rhythm.
- **Tests:** `back-link.spec.tsx` (2), `data-access/navigation.spec.tsx` (2: in-app goes back, direct visit follows the link),
  `users.spec.tsx` (+2: direct visit links to `/`, in-app visit returns to the previous page). `BackLink` also has a
  Storybook story (`Shell/BackLink`).
- **Results:** `lint typecheck test build` for all non-Python projects green (feature-users 34 tests, data-access 29,
  feature-recipes 114, ui-components 22 + the new ones in its count), `nx format:check` exit 0, `build-storybook` builds.
  **Initial JS gzip 153,086 B (149.5 KiB)**, down from 153,283 B before this change (chunks were re-split, total flat).
- **Not browser-checked this time:** ports 4200 and 8000 were already taken by another server (your own dev servers), so I
  did not start a second stack that would have proxied to your real database. The behaviour is covered by the component and
  hook tests above.
- **Login page too (Adi said yes):** `/login` now has the same `BackLink` (new key `auth.login.back` = "חזרה למתכונים", top padding `pt-4`, then the title). With `?next=` it still goes one step back in history after an in-app visit and falls back to `/` on a direct visit. Two new tests in `login.spec.tsx` (direct visit with `?next=` links to `/`; in-app visit returns to the previous page). `feature-auth` has 34 tests; `lint typecheck test build` green, `format:check` exit 0, initial JS **153,230 B gzip (149.6 KiB)**, +0.1 KiB. The not-found and error pages already have their own "חזרה לרשימה" button, so no page is left without a way back.
- **Logout toast (Adi asked):** a successful "יציאה" from the account menu now shows the success toast "התנתקת בהצלחה" (new key `auth.logoutDone`, same `toast` and shell `Toaster` as the session-expired toast). Only that menu logs out on purpose, so a session-expired 401 and a self-demote/self-block redirect do not show it, and a failed logout shows nothing, as before. Two new tests in `account-menu.spec.tsx` (toast on success, none on a 403 failure, using a spy because sonner's toast state is global); `feature-auth` has 36 tests. Files: `libs/feature-auth/src/routes/account-menu.tsx`, `account-menu.spec.tsx`, `libs/i18n/src/he.json`. Initial JS **153,252 B gzip (149.7 KiB)**, +0.02 KiB.
- **Planning docs:** new optional Story 7.2 "Edit user details" (admin edits name and email from the ⋮ menu) added to
  `epics.md` under Epic 7 and to `sprint-status.yaml` as `backlog`.

## Explained with Nest/Angular analogies

- **`PATCH /api/users/{id}` + `UserUpdate`** are a Nest controller method with an `@Body()` DTO validated by
  `class-validator` (`@IsOptional()` on each field, plus a custom check that something was sent). `extra="forbid"` is
  `whitelist` + `forbidNonWhitelisted`. `Depends(require_role(Role.ADMIN))` on the router is `@UseGuards(RolesGuard)` with
  `@Roles('admin')` on the whole controller.
- **`UserService.update_user`** is the provider. It loads the entity, applies the changes, and enforces the invariant ("one
  active admin must remain") in the service, not the controller. Doing the write and then checking before `commit()` is
  like a TypeORM transaction that throws and rolls back when the post-condition fails.
- **`session_version`** is a "token generation" field, like keeping `tokenVersion` on the user in a Nest `JwtStrategy` and
  returning `null` from `validate()` when the payload's version differs. `get_active_user` is that `validate()`.
- **`account_blocked`** is a Nest `ForbiddenException` with an error code, thrown by the auth service only after the
  password check passed, so it leaks nothing to someone who does not know the password.
- **The migration** is a TypeORM migration with `ALTER TABLE ... ADD COLUMN`. The reason for avoiding Alembic batch mode is
  the same as TypeORM's `synchronize` dropping an index it cannot see in the entity metadata.
- **`ConfirmDialog`** is a dumb Angular component (`@Input()`s and `@Output()`s only, no services), like the presentational
  components in `libs/ui-components`. `UserActions` is the smart parent: it owns the "which dialog is open" state and calls
  the API.
- **`useUpdateUser`** is an Angular service method wrapped for the template: a `HttpClient.patch(...)` plus a `tap()` that
  refreshes the list. `useMutation` gives you `isPending`/`error` the way an `async` pipe plus a loading flag would.
- **`usersUpdateUserMutation`** (generated) is the typed client method, like an OpenAPI-generated Angular service
  (`UsersService.updateUser()`); nobody writes the URL by hand (AD-3).

## Files

New: `apps/recipe-service/app/migrations/versions/20261028_0003_user_session_version.py`,
`apps/recipe-service/tests/test_users_update_api.py`, `libs/ui-components/src/components/confirm-dialog.{tsx,spec.tsx,stories.tsx}`,
`libs/feature-users/src/users/{user-actions,reset-password-dialog,use-update-user,field}.ts(x)`,
`libs/feature-users/src/routes/user-actions.spec.tsx`.
Changed: `apps/recipe-service/app/{auth/service,core/errors,core/security}.py`,
`apps/recipe-service/app/users/{models,repository,router,schemas,service}.py`, the tests
`test_auth_api.py`, `test_migrations.py`, `test_openapi_export.py`, `test_security.py`, `libs/data-access/openapi.json` and
`libs/data-access/src/generated/*` (regenerated), `libs/feature-auth/src/routes/login.spec.tsx`,
`libs/feature-users/src/routes/{users.tsx,users.spec.tsx}`, `libs/feature-users/src/testing/render-users.tsx`,
`libs/feature-users/src/users/add-user-dialog.tsx` (the `Field` helper moved to `field.tsx`), `libs/i18n/src/he.json`,
`libs/ui-components/src/index.ts`. Back button: new `libs/ui-components/src/components/back-link.{tsx,spec.tsx,stories.tsx}`, `libs/data-access/src/navigation{.ts,.spec.tsx}`; changed `libs/data-access/src/index.ts`, `libs/feature-recipes/src/routes/recipe-detail.tsx`, `libs/feature-users/src/routes/users.tsx`, and for the login page `libs/feature-auth/src/routes/{login.tsx,login.spec.tsx}`. Planning: `epics.md` (Story 7.2), `sprint-status.yaml`.
Not yet touched (on "c p"): `sprint-status.yaml` (2-5 to done; 7-2 is already added as backlog) and the commit.
