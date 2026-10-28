# Review: Story 2.4 Users screen: list and add users

Working tree on `main` at b1d5682. Not committed; for Adi's review. Branch to use on "c p": `claude/story-2-4-users-screen`.

## What it does

- **Server:** `GET /api/users` (admin only) returns a plain array of `UserRead`, oldest account first.
  `POST /api/users` (admin only) takes the flat body `{email, name, role, password}` and returns 201 with the new `UserRead`.
  It reuses `UserService.create_user`, so a duplicate email (compared without case) is 409 `email_taken` and a
  password under 8 characters is 422 `password_too_short`. The new user can log in straight away (tested).
  Both routes sit behind one `require_role(Role.ADMIN)` on the router. No password or hash is ever returned.
- **Client:** new `libs/feature-users` (`type:feature`) with the lazy subpath `./users`. `/users` is wrapped in
  `protectedRoute(queryClient, 'admin', ...)`, so a visitor goes to `/login?next=%2Fusers` and an editor sees the
  not-found page inside the shell. The page is a stacked `<ul>` of rows (name, role, email in LTR, a "חסום" label
  when blocked). "הוספת משתמש" opens a Dialog on the same page. The account menu shows "משתמשים" only to an admin
  (`useCan('admin')`, absent for others, not disabled).

## Decisions applied (all as approved: "all ok" = the 3 recommendations)

D1 Dialog on the same page for "הוספת משתמש". D2 single stacked `<ul>` list. D3 flat POST body, plain-array GET,
no pagination, password confirmation checked on the client only.

Small choices: the form is mounted only while the dialog is open, so it always opens empty. A taken email shows on
the email field, a server-rejected password on the password field, any other error in a `role="alert"` line under
the form. After a create the list query is invalidated (no optimistic update) and a toast says "<name> נוסף". The
role select defaults to עורך. Email and password fields are `dir="ltr"`, labelled, `autoComplete="off"`/`new-password`.
The email in each row is wrapped in `<bdi dir="ltr">`, so it aligns to the start (right) of the row in RTL but
still reads left to right.

## Things to know

1. **No import-linter change was needed** (the coordinator's brief expected one). The router lives inside
   `app.users` and imports only `users.service`, `users.schemas` and `core.security`. `lint-imports`: 13 contracts
   kept, 0 broken.
2. **Initial JS (gzip, entry + modulepreloads from `apps/web/dist/index.html`):** before **148,155 B (144.7 KiB)**,
   after **151,603 B (148.0 KiB)**, so +3.4 KiB. Where it comes from: `protectedRoute` is now used by `createRoutes`
   so it is no longer tree-shaken out of the entry, the new `users` and `auth.menu.users` strings in `he.json`, and
   the bundler now splits the entry into three files (index, `query`, `button`), which gzip slightly worse than one.
   `data-access` itself stays out of the entry (the generated client is in the lazy `src-*.js` chunk), and the new
   lazy `users-*.js` chunk is 43.8 KB raw. Budget is 200 KB.
3. **One bug found by a test and fixed:** the error-message hook ignored the error's `params`, so
   `errors.password_too_short` (`{{min}}`) would have shown the raw placeholder for a server-rejected password.
   `libs/data-access` gets a small `getErrorParams()` next to `getErrorCode()` (with unit tests), and the new
   `feature-users/src/shared/use-error-message.ts` uses it. The two older copies of that hook in `feature-auth` and
   `feature-recipes` are unchanged (they never show a message with params). A shared version is worth doing later.
4. `libs/feature-users` was created by hand from the `feature-auth` config (same tsconfigs, eslint, vite config,
   test harness), then registered in the root `tsconfig.json`, `apps/web/tsconfig.app.json` and `package-lock.json`
   (via `npm install --offline`; only the two workspace entries were added).
5. Windows note: files I generated were normalised to LF where they had become CRLF (`tsconfig.json`,
   `apps/web/tsconfig.app.json`, `package-lock.json`); `nx format:check` passes. The working tree still shows the
   many CRLF-only "modified" files that were there before this story; none of them is in this change.
6. 2.5 hand-off: rows are a `<ul>` so a per-row action menu (role, block, reset password) drops in. `invalidationMap`
   in `data-access` is still empty; the add dialog invalidates `usersListUsersQueryKey()` directly (AD-19 says that
   map is the one place for this, so it may be worth moving once more writes exist).

## Checks run

- `npm run verify` (lint, typecheck, test, build for all projects): green. Backend: ruff, ruff format,
  import-linter, mypy strict, 247 pytest tests, `app/users/*` at 100% line and branch coverage. New API tests in
  `tests/test_users_api.py` (14 cases): visitor 401, editor 403, blocked admin 401, missing CSRF header 403, list
  order and shape (no password data), create + log in as the new user, create another admin, 409 for the same email
  and for a different-case email, 422 for a short password, 422 for invalid bodies. Frontend: `feature-users` 11
  tests, `feature-auth` account menu +2, `web` `users-route.spec` 3 (admin sees it, editor gets not-found inside the
  shell, visitor goes to `/login?next=%2Fusers`), `data-access` `getErrorParams` +2.
- `nx format:check` passes. `nx run data-access:generate` rerun: `usersListUsers*`, `usersCreateUser*` and
  `UserCreateRequest` appear; `ErrorResponse` is documented for the 409.
- Real browser run (Browser pane at 375 px) against a throwaway database and throwaway admin, not your dev DB:
  login -> `/users` lists two users (one blocked, with a long email that wraps) -> no horizontal overflow
  (`scrollWidth` 375) -> dialog fits at 375 px -> a same-email-different-case submit shows "כבר קיים משתמש עם
  האימייל הזה" on the email field and the dialog stays open -> a new email creates the user, closes the dialog,
  and the row appears. The scratch API and dev server were stopped afterwards.
- Not verified: keyboard-only walkthrough and a screen reader pass of the dialog (the primitives are Radix, and the
  tests check labels, `aria-invalid` and `aria-describedby`), the role select in a real browser (covered in jsdom).

## Files

New: `apps/recipe-service/tests/test_users_api.py`, `apps/web/src/app/users-route.spec.tsx`, the whole
`libs/feature-users/` library (`routes/users.tsx`, `users/add-user-dialog.tsx`, `shared/use-error-message.ts`,
`routes/users.spec.tsx`, `testing/*`, configs).
Changed: `apps/recipe-service/app/users/{router,schemas,service,repository}.py`, `apps/web/src/app/router.tsx`,
`apps/web/tsconfig.app.json`, `tsconfig.json`, `package-lock.json`, `libs/data-access/src/{errors,errors.spec,index}.ts`,
`libs/data-access/openapi.json` and `src/generated/*` (regenerated, not read line by line),
`libs/feature-auth/src/routes/account-menu{,.spec}.tsx`, `libs/i18n/src/he.json`.
`sprint-status.yaml` is marked done in the commit, not before.

## Backend code

```python
# app/users/router.py (whole file)
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.errors import ErrorResponse
from app.core.security import Role, require_role
from app.users.schemas import UserCreate, UserCreateRequest, UserRead
from app.users.service import UserService, get_user_service

# Every route here is admin only (AD-30); the dependency also yields the caller.
router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_role(Role.ADMIN))],
)

ServiceDep = Annotated[UserService, Depends(get_user_service)]


@router.get("")
def list_users(service: ServiceDep) -> list[UserRead]:
    return service.list_users()


@router.post("", status_code=201, responses={409: {"model": ErrorResponse}})
def create_user(body: UserCreateRequest, service: ServiceDep) -> UserRead:
    account = UserCreate(email=body.email, name=body.name, role=body.role)
    return service.create_user(account, body.password)
```

```python
# app/users/schemas.py (added)
class UserCreateRequest(UserCreate):
    """The body of `POST /api/users`: an account plus its starting password.

    The confirmation field of the form is checked in the browser only; the server
    just enforces the password policy (FR-13).
    """

    password: str
```

```python
# app/users/repository.py (added)
    def list_all(self) -> list[User]:
        """Every user, oldest account first."""
        statement = select(User).order_by(col(User.created_at), col(User.email))
        return list(self._session.exec(statement).all())

# app/users/service.py (added)
    def list_users(self) -> list[UserRead]:
        """All users, oldest account first. There are only a handful (FR-25)."""
        return [_read(user) for user in self._repository.list_all()]
```

## Frontend code

```tsx
// apps/web/src/app/router.tsx (added inside the layout's children, before the "*" route)
        // Admin only: an editor sees the not-found page, a visitor goes to /login.
        protectedRoute(queryClient, 'admin', [
          {
            path: 'users',
            lazy: () => import('@bite-and-board/feature-users/users'),
          },
        ]),
```

```tsx
// libs/feature-auth/src/routes/account-menu.tsx (added)
  const isAdmin = useCan('admin');
  ...
          {isAdmin ? (
            <DropdownMenuItem asChild>
              <Link to="/users">{t('auth.menu.users')}</Link>
            </DropdownMenuItem>
          ) : null}
```

```ts
// libs/data-access/src/errors.ts (added)
export function getErrorParams(error: unknown): Record<string, string | number> {
  if (typeof error !== 'object' || error === null) return {};
  const { params } = error as { params?: unknown };
  return typeof params === 'object' && params !== null
    ? (params as Record<string, string | number>)
    : {};
}
```

The two new feature files are in the repo: `libs/feature-users/src/routes/users.tsx` (page, list, loading,
error with retry) and `libs/feature-users/src/users/add-user-dialog.tsx` (dialog, form, validation, error routing).
