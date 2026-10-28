# Review: Story 2.6 My account: change my password

Working tree on branch `claude/story-2-6-my-account` (cut from `main` at 6c47b87). Not committed; for Adi's review. Commit
trailer on "c p": `Claude-Session: https://claude.ai/code/session_01Uibg2JgePptwJLiUbinmzh`.

## What it does

- **Server:** `POST /api/auth/password` with `{current_password, new_password}`. Any signed-in user (editor or admin) can call
  it (`require_role("editor")`, which an admin also satisfies); it only ever changes the caller's own password. It returns
  200 `SessionResponse` and sets a **new session cookie** with the same attributes as login (httpOnly, SameSite=Lax, 7 days).
  Errors: 401 for a visitor (or a blocked user), 403 without the CSRF header, 400 `invalid_credentials` for a wrong current
  password, 422 `password_too_short` / `password_too_long` for the new one (the same policy and codes as the admin reset),
  429 after 5 tries a minute (reuses `LOGIN_LIMIT`, so a stolen session cannot be used to guess the current password).
- **Sessions:** `UserService.change_own_password` verifies the current password, applies the policy, stores the new hash and
  bumps `session_version`. `AuthService.change_password` signs a token with the new version. The old cookie stops matching, so
  **other devices are signed out on their next request, and this device stays signed in** because the response replaced its
  cookie.
- **UI:** `/account` ("החשבון שלי"), a lazy chunk exported from `libs/feature-auth` as `./account`, behind
  `protectedRoute(queryClient, 'editor', …)` (a visitor goes to `/login?next=/account`). It has the shared `BackLink` with
  `useBackNavigation`, the user's name and email, and a "שינוי סיסמה" section: current, new and confirm (all `dir="ltr"`,
  correct `autocomplete`). Wrong current password shows on that field ("הסיסמה הנוכחית שגויה"; the generic login message
  would be wrong here). A short new password and a mismatch are rejected on the client; the server's policy errors land on the
  new-password field; other errors (rate limit, network) go to a live `role="alert"` line. On success: toast "הסיסמה עודכנה",
  the returned session is put in the session query cache, and the form is cleared.
- **Menu:** the account menu has "החשבון שלי" for every signed-in user, above "משתמשים" and "יציאה".
- **Layout for later:** the page is a column of `<section>`s, so Story 7.2's "פרטים אישיים" can be added under the password
  section. Nothing extra was built.

## Decisions applied (Adi: "בסדר, תתחיל")

D1 200 + `SessionResponse` + new cookie. D2 any signed-in user (client `editor` guard, server must-be-signed-in). D3 reuse the
login rate limit. D4 page in `feature-auth`, menu item for everyone, **no** "new must differ from current" rule.

## Planning edits made in this session (not code)

- `epics.md`: new **Story 7.3 Data caching tuning (REQUIRED)** at the end of Epic 7 (3 criteria), and the Epic 7 intro says it
  must not be cut with the rest. Story 7.2 widened so a user can edit their own name and email from "החשבון שלי" (own email
  needs the current password); it stays optional and 2.6 stays password-only.
- `sprint-status.yaml`: `7-3-data-caching-tuning: backlog`, and the 7.2 comment updated.

## Things to know

1. **Password policy status is 422, not 400.** The plan said 400 for a short password; the existing policy (shared with the
   admin reset) raises 422, and I kept it so both flows give the same code. 400 is only the wrong current password.
2. **Initial JS (gzip, entry + modulepreloads from `apps/web/dist/index.html`):** 84,115 + 36,781 + 32,095 = **152,991 B
   (149.4 KiB)**; the last review recorded 149.7 KiB, so no growth. Budget 200 KB. The page is its own `account-*.js` chunk.
   (The generated SDK already lived in the entry, so the new generated function adds a few bytes at most.)
3. **Regenerated client:** `libs/data-access/openapi.json` and `src/generated/**` via `nx run data-access:generate`
   (`authChangePassword`, `authChangePasswordMutation`, the zod schema).
4. **Line endings:** Python and some tooling on this Windows machine wrote CRLF; every file I touched is LF again
   (`git diff --check` clean). `git status` may still list a few `apps/web/src/app/*` files as modified after a prettier run;
   `git diff` shows no content change for them (only router.tsx and users-route.spec.tsx really changed).
5. **No new state in `invalidationMap`:** the mutation only sets the session query data, like login.
6. Not verified: a screen-reader and keyboard-only pass (labels, `aria-invalid`, `aria-describedby` and the live line are
   covered by tests), and the two-device case in a real second browser (covered by an API test with the old and new cookie).

## Checks run

- `npm run verify` (lint, typecheck, test, build): **32 of 32 tasks succeeded**. `nx format:check`: exit 0.
- Backend: **307 pytest tests** (295 before; 12 new in `tests/test_auth_password.py`): success keeps the session, cookie
  attributes, old cookie dead and new cookie alive, new password logs in and old one does not, wrong current 400 and nothing
  changed, short and too-long new password 422, admin can use it, visitor 401, missing CSRF 403, blocked user 401, 6th attempt
  429, unknown user id 404 at the service. ruff, ruff format, mypy strict and import-linter pass.
- Frontend: `account.spec.tsx` (9 tests: fields and title, back link, success with toast and cache, wrong current on its
  field, short password without a request, mismatch, required fields, server policy error on the new field, rate limit in the
  live line), 1 new menu test, 2 new route tests in `apps/web` (editor sees the page, visitor goes to `/login?next=%2Faccount`).
- **Browser check at 375 px** (own dev server on ports 4200/8000 with a scratch database in the session's scratchpad, never
  `apps/recipe-service/data`): logged in as a test editor, opened `/account`, wrong current password showed the field error,
  the right one showed the toast and cleared the form, a reload was still signed in, no horizontal scroll, and the API then
  accepted the new password and refused the old one. Servers stopped afterwards.
