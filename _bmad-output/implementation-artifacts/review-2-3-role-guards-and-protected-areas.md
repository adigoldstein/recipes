# Review: Story 2.3 Role guards and protected areas

Branch `claude/story-2-3-role-guards` (from main at 671ca65). Not committed; for Adi's review.

## What it does

- **Server:** `require_role(Role.EDITOR | Role.ADMIN)` (a FastAPI dependency, like a Nest `@Roles()` guard backed by a
  `RolesGuard`) in `app/core/security.py`: 401 `unauthorized` with no session, 403 `forbidden` with a lower role, and an
  admin satisfies every editor check. The user is re-read from the database on every protected request (role and
  `is_blocked`), so a demotion, a block or a deletion works on the next request. A CSRF dependency covers the whole
  app: any request that is not GET/HEAD/OPTIONS without `X-Requested-With: bite-and-board` gets 403
  `csrf_header_missing`, checked before the role (so a missing header is never a 401).
- **Client:** a 401 interceptor in `libs/data-access` (like an Angular/Nest-style HTTP interceptor); `useCan(role)`;
  the `requireRole(queryClient, role?)` loader guard; in the shell `protectedRoute(queryClient, role, children)`, a
  listener that sends the user to `/login?next=...` with the toast "פג תוקף החיבור", and `createRoutes(queryClient)`.

## Decisions applied (all as approved: "all ok" = the 4 recommendations)

1. **Seam:** `core.security.get_session_user` is a stub (raises if nobody wired it); `create_app()` binds it to
   `auth.service.get_current_user` with `app.dependency_overrides` (a Nest custom provider). `core` imports nothing from
   `auth`; import-linter: 13 contracts kept, no new ignores.
2. **CSRF app-wide:** `FastAPI(dependencies=[Depends(require_csrf_header)])`, including login and logout. The 2.2 tests
   needed no edits: the `client` fixture now sends the header by default (like the SPA) and a new `bare_client` fixture
   does not.
3. **401 to a DOM event:** the interceptor fires on every 401 except a login attempt and dispatches
   `bite-and-board:session-expired` on `window`. `useSessionExpiry()` in `AppLayout` marks the session as a visitor,
   shows the toast, and navigates through the router. Several 401s at once count as one.
4. **Loader guard in data-access:** `requireRole(queryClient, role?)`. `main.tsx` creates the QueryClient once
   (`createAppQueryClient()`) and passes it to both `AppProviders` and `createRoutes(queryClient)`.

Small choices: new error codes `unauthorized`, `forbidden`, `csrf_header_missing` (with `errors.<code>` strings in
he.json); an editor on an admin-only route gets the not-found page inside the shell (a `protectedRoute` error element,
not the full-page root one); a visitor on a guarded route is redirected to `/login?next=...`.

## Things to know

1. **Initial JS (gzip):** before **146.60 KiB** (entry + button chunk + runtime, 3 files), after **145.23 KiB** (the
   bundler now emits one merged entry chunk, so the two numbers are not like for like). Raw entry JS: 477.0 kB before,
   477.9 kB after, so the story adds under 1 kB raw (about 0.35 KiB gzip). Budget 200 KB. The API client is still out of
   the entry chunk (checked: no `authSession` in it). The new lazy chunk `session-api` is 147 bytes (a re-export).
2. **Module-boundary lint rule:** Nx forbids statically importing a library that is imported dynamically anywhere. So the
   shell never does `import('@bite-and-board/data-access')`; it lazily imports its own file
   `apps/web/src/app/session-api.ts`, which holds the static import.
3. **A race found in the real browser and fixed:** `useSessionExpiry` first navigated and then (after the lazy chunk
   loaded) marked the session as a visitor, so the login page could see the stale signed-in cache and bounce straight
   back. It now marks first and navigates after. The unit tests cannot force a slow chunk load: the unit test only checks
   that the cache says "visitor" when the router reaches `/login`, and it also passes with the bug (honest limitation).
   The fix was verified in the browser from a cold page load.
4. The event name is repeated in the shell (`use-session-expiry.ts`) because importing data-access there would pull the
   client into the entry chunk. A spec asserts both names are equal.
5. `routes` (a constant) became `createRoutes(queryClient)`, so six existing web specs now build their own QueryClient,
   and `AppProviders` requires a `queryClient` prop.
6. `createRoutes` does not use its `queryClient` yet (no guarded production route until Story 2.4 adds `/users`), hence
   the `_queryClient` name.
7. `libs/data-access/tsconfig.spec.json` gets the `dom` lib (the new specs use `window`).
8. Nothing in production calls `require_role` yet (Epic 3 adds protected endpoints), so the server side is tested through
   a test-only router in `tests/test_guards.py`.

## Checks run

- `nx run-many -t lint typecheck test build` for all 9 projects: green. Backend: ruff, ruff format, import-linter
  (13 contracts kept), mypy strict, 233 pytest tests (16 new in `test_guards.py`). Frontend: data-access 25 tests (was 5;
  new: 401 interceptor, `useCan`, `requireRole`), web 39 (new `protected-route.spec`: 9).
- Story's last criterion (visitor, editor, admin, blocked user): covered on both server and client, plus demotion and block
  mid-session, forged/expired/garbage cookies, CSRF on login/logout/reads, and the 401 interceptor staying quiet for login,
  200, 400, 403, 404 and 500.
- `nx format:check` passes. `nx run data-access:generate` rerun and the committed output updated (3 new `ErrorCode` values).
- Real browser run against a throwaway database and user (not your dev DB), API on :8000 plus Vite on :4200:
  `POST /api/auth/logout` without the header is 403, with it 204; a real login through the SPA works with the CSRF check
  on; firing the session-expired event from a signed-in page lands on `/login?next=%2F` with the toast "פג תוקף החיבור"
  and a visitor top bar. Servers stopped afterwards.
- Not verified: a real 401 from a real protected endpoint in the browser (none exists until Epic 3), so the browser run
  fired the event by hand; the interceptor itself is unit tested against real `Response` objects.

## Files

New: `apps/recipe-service/tests/test_guards.py`, `apps/web/src/app/protected-route.tsx`, `protected-route.spec.tsx`,
`session-api.ts`, `use-session-expiry.ts`, `libs/data-access/src/guards.ts`, `guards.spec.ts`, `session.spec.tsx`.
Changed: see the diffs below (`openapi.json` and `libs/data-access/src/generated/*` are summarised, not shown).
`sprint-status.yaml` will mark 2.3 done in the commit (after "c p").

## Diffs of changed files

### apps/recipe-service/README.md

```diff
diff --git a/apps/recipe-service/README.md b/apps/recipe-service/README.md
index 88167da..bff9d46 100644
--- a/apps/recipe-service/README.md
+++ b/apps/recipe-service/README.md
@@ -42,6 +42,25 @@ share one bucket. In production start uvicorn with `--proxy-headers` and
 `--forwarded-allow-ips` set to the proxy's address only (not `*`, or the header can be
 spoofed to dodge the limit). That is set up with the container in Story 6.1.
 
+## Guarding routes (AD-6, AD-30)
+
+Protect a route with a dependency, like a Nest `@Roles()` guard:
+
+```python
+user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))]  # or "admin"
+```
+
+No session gives 401 `unauthorized`; a lower role gives 403 `forbidden`; an admin passes
+every editor check. The user comes from the database on each request, so a demotion or a
+block works at once (a blocked or deleted user is a 401).
+
+`app.core` may not import `auth`, so `get_session_user` in `app/core/security.py` is a stub
+that `create_app()` answers with `auth.service.get_current_user` through
+`dependency_overrides`. The CSRF check is a dependency on the whole app: any request that
+is not GET, HEAD or OPTIONS needs `X-Requested-With: bite-and-board`, or it gets 403
+`csrf_header_missing` before any role check. Tests use the `client` fixture (sends the
+header, like the SPA) and `bare_client` (does not).
+
 ## Database and migrations
 
 SQLite lives in `DATA_DIR/app.db`. Every connection turns on `foreign_keys` and WAL.
```

### apps/recipe-service/app/auth/service.py

```diff
diff --git a/apps/recipe-service/app/auth/service.py b/apps/recipe-service/app/auth/service.py
index d25ae6b..3535593 100644
--- a/apps/recipe-service/app/auth/service.py
+++ b/apps/recipe-service/app/auth/service.py
@@ -2,12 +2,17 @@
 
 from typing import Annotated
 
-from fastapi import Depends
+from fastapi import Cookie, Depends
 
 from app.auth.schemas import SessionUser
 from app.core.config import Settings, get_settings
 from app.core.errors import AppError, ErrorCode
-from app.core.security import create_session_token, read_session_token
+from app.core.security import (
+    SESSION_COOKIE,
+    CurrentUser,
+    create_session_token,
+    read_session_token,
+)
 from app.users.schemas import UserRead
 from app.users.service import UserService, get_user_service
 
@@ -53,3 +58,14 @@ def get_auth_service(
 ) -> AuthService:
     """Provider, like a Nest injectable: `Depends(get_auth_service)`."""
     return AuthService(users, settings.jwt_secret.get_secret_value())
+
+
+def get_current_user(
+    service: Annotated[AuthService, Depends(get_auth_service)],
+    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
+) -> CurrentUser | None:
+    """Answers `core.security.get_session_user`; `main.py` wires it in."""
+    user = service.current_user(token)
+    if user is None:
+        return None
+    return CurrentUser(id=user.id, email=user.email, name=user.name, role=user.role)
```

### apps/recipe-service/app/core/errors.py

```diff
diff --git a/apps/recipe-service/app/core/errors.py b/apps/recipe-service/app/core/errors.py
index 9d6b493..0ab8f5c 100644
--- a/apps/recipe-service/app/core/errors.py
+++ b/apps/recipe-service/app/core/errors.py
@@ -17,6 +17,9 @@ class ErrorCode(StrEnum):
     PASSWORD_TOO_LONG = "password_too_long"
     INVALID_CREDENTIALS = "invalid_credentials"
     RATE_LIMITED = "rate_limited"
+    UNAUTHORIZED = "unauthorized"
+    FORBIDDEN = "forbidden"
+    CSRF_HEADER_MISSING = "csrf_header_missing"
 
 
 class ErrorResponse(BaseModel):
```

### apps/recipe-service/app/core/security.py

```diff
diff --git a/apps/recipe-service/app/core/security.py b/apps/recipe-service/app/core/security.py
index dac2ae1..8971281 100644
--- a/apps/recipe-service/app/core/security.py
+++ b/apps/recipe-service/app/core/security.py
@@ -1,14 +1,20 @@
-"""Roles, password hashing, session tokens, and (from Story 2.3) `require_role`."""
+"""Roles, password hashing, session tokens, and the request guards (AD-6, AD-30)."""
 
 import uuid
+from collections.abc import Callable
+from dataclasses import dataclass
 from datetime import UTC, datetime, timedelta
 from enum import StrEnum
+from typing import Annotated
 
 import jwt
+from fastapi import Depends, Request
 from pwdlib import PasswordHash
 from pwdlib.exceptions import UnknownHashError
 from pwdlib.hashers.argon2 import Argon2Hasher
 
+from app.core.errors import AppError, ErrorCode
+
 
 class Role(StrEnum):
     """A visitor has no session, so there is no viewer role (AD-30)."""
@@ -73,3 +79,75 @@ def read_session_token(token: str, secret: str) -> uuid.UUID | None:
         return uuid.UUID(claims["sub"])
     except (jwt.InvalidTokenError, ValueError):
         return None
+
+
+# --- Request guards ----------------------------------------------------------
+
+# The CSRF guard: a cross-site form post cannot add a custom header, and a
+# cross-site fetch that does would need a CORS preflight this app never allows (AD-6).
+CSRF_HEADER = "X-Requested-With"
+CSRF_VALUE = "bite-and-board"
+_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
+
+
+def require_csrf_header(request: Request) -> None:
+    """Reject any request that changes something without the CSRF header.
+
+    Registered once on the whole app, so no route can forget it. It runs before the
+    role check, which makes a missing header a 403 and never a 401 (AD-21).
+    """
+    if request.method not in _SAFE_METHODS and (
+        request.headers.get(CSRF_HEADER) != CSRF_VALUE
+    ):
+        raise AppError(
+            403, ErrorCode.CSRF_HEADER_MISSING, f"Missing {CSRF_HEADER} header"
+        )
+
+
+@dataclass(frozen=True)
+class CurrentUser:
+    """Who is making this request, as the database says right now."""
+
+    id: uuid.UUID
+    email: str
+    name: str
+    role: Role
+
+
+def get_session_user() -> CurrentUser | None:
+    """The seam that answers "who does this request's cookie belong to?".
+
+    `core` may not import the feature modules, so it only declares the question.
+    `main.py` answers it with `dependency_overrides`, like a Nest custom provider
+    (`useFactory`). The answer must be looked up fresh: that is what makes a demotion
+    or a block take effect on the next request (AD-30).
+    """
+    raise RuntimeError("get_session_user is not wired; see create_app()")
+
+
+# Admin satisfies every editor-level check.
+_RANK = {Role.EDITOR: 1, Role.ADMIN: 2}
+
+
+def has_role(user_role: Role, required: Role) -> bool:
+    return _RANK[user_role] >= _RANK[required]
+
+
+def require_role(role: Role | str) -> Callable[..., CurrentUser]:
+    """A route dependency, like a Nest `@Roles()` guard: 401 without a session,
+    403 when the role is too low, otherwise the current user.
+
+    Use it as `Depends(require_role(Role.EDITOR))` or `Depends(require_role("admin"))`.
+    """
+    required = Role(role)
+
+    def dependency(
+        user: Annotated[CurrentUser | None, Depends(get_session_user)],
+    ) -> CurrentUser:
+        if user is None:
+            raise AppError(401, ErrorCode.UNAUTHORIZED, "Sign in required")
+        if not has_role(user.role, required):
+            raise AppError(403, ErrorCode.FORBIDDEN, "Not allowed")
+        return user
+
+    return dependency
```

### apps/recipe-service/app/main.py

```diff
diff --git a/apps/recipe-service/app/main.py b/apps/recipe-service/app/main.py
index 408f756..cb2109e 100644
--- a/apps/recipe-service/app/main.py
+++ b/apps/recipe-service/app/main.py
@@ -1,16 +1,18 @@
 from collections.abc import AsyncIterator
 from contextlib import asynccontextmanager
 
-from fastapi import APIRouter, FastAPI
+from fastapi import APIRouter, Depends, FastAPI
 from fastapi.routing import APIRoute
 
 from app.auth.router import router as auth_router
+from app.auth.service import get_current_user
 from app.core.config import get_settings
 from app.core.db import get_engine
 from app.core.errors import register_error_handlers
 from app.core.health import router as health_router
 from app.core.migrate import run_migrations
 from app.core.rate_limit import limiter
+from app.core.security import get_session_user, require_csrf_header
 from app.imports.router import router as imports_router
 from app.photos.router import router as photos_router
 from app.recipes.router import router as recipes_router
@@ -56,7 +58,11 @@ def create_app() -> FastAPI:
         title="Bite & Board Recipe Service",
         generate_unique_id_function=generate_operation_id,
         lifespan=lifespan,
+        # Every route, present and future, gets the CSRF check (AD-6).
+        dependencies=[Depends(require_csrf_header)],
     )
+    # `core` cannot import `auth`, so the guards ask a question that `auth` answers.
+    app.dependency_overrides[get_session_user] = get_current_user
     app.state.limiter = limiter
     register_error_handlers(app)
```

### apps/recipe-service/tests/conftest.py

```diff
diff --git a/apps/recipe-service/tests/conftest.py b/apps/recipe-service/tests/conftest.py
index bc81b9e..de118c2 100644
--- a/apps/recipe-service/tests/conftest.py
+++ b/apps/recipe-service/tests/conftest.py
@@ -17,6 +17,7 @@ os.environ["ENV"] = "dev"
 from app.core.config import Settings, get_settings  # noqa: E402
 from app.core.db import get_engine  # noqa: E402
 from app.core.rate_limit import limiter  # noqa: E402
+from app.core.security import CSRF_HEADER, CSRF_VALUE  # noqa: E402
 from app.main import create_app  # noqa: E402
 
 
@@ -54,7 +55,17 @@ def app() -> FastAPI:
 
 @pytest.fixture
 def client(app: FastAPI) -> Iterator[TestClient]:
-    """Entering the client runs the lifespan, which migrates the temp database."""
+    """Acts like the SPA, which sends the CSRF header on every non-GET call (AD-19).
+
+    Entering the client runs the lifespan, which migrates the temp database.
+    """
+    with TestClient(app, headers={CSRF_HEADER: CSRF_VALUE}) as test_client:
+        yield test_client
+
+
+@pytest.fixture
+def bare_client(app: FastAPI) -> Iterator[TestClient]:
+    """A caller that sends no CSRF header, like a cross-site form post."""
     with TestClient(app) as test_client:
         yield test_client
```

### apps/recipe-service/tests/test_openapi_export.py

```diff
diff --git a/apps/recipe-service/tests/test_openapi_export.py b/apps/recipe-service/tests/test_openapi_export.py
index f8cc1ce..dbea21b 100644
--- a/apps/recipe-service/tests/test_openapi_export.py
+++ b/apps/recipe-service/tests/test_openapi_export.py
@@ -27,6 +27,9 @@ def test_export_writes_stable_sorted_json(tmp_path: Path) -> None:
         "password_too_long",
         "invalid_credentials",
         "rate_limited",
+        "unauthorized",
+        "forbidden",
+        "csrf_header_missing",
     ]
```

### apps/web/src/app/account-slot.spec.tsx

```diff
diff --git a/apps/web/src/app/account-slot.spec.tsx b/apps/web/src/app/account-slot.spec.tsx
index a75a3db..bd61454 100644
--- a/apps/web/src/app/account-slot.spec.tsx
+++ b/apps/web/src/app/account-slot.spec.tsx
@@ -3,8 +3,8 @@ import { HttpResponse, http } from 'msw';
 import { setupServer } from 'msw/node';
 import { createMemoryRouter, RouterProvider } from 'react-router';
 import { client } from '@bite-and-board/data-access';
-import { AppProviders } from './app-providers';
-import { routes } from './router';
+import { AppProviders, createAppQueryClient } from './app-providers';
+import { createRoutes } from './router';
 
 const server = setupServer(
   http.get('*/api/recipes', () => HttpResponse.json([])),
@@ -20,9 +20,12 @@ afterEach(() => server.resetHandlers());
 afterAll(() => server.close());
 
 function renderApp(path: string) {
-  const router = createMemoryRouter(routes, { initialEntries: [path] });
+  const queryClient = createAppQueryClient();
+  const router = createMemoryRouter(createRoutes(queryClient), {
+    initialEntries: [path],
+  });
   render(
-    <AppProviders>
+    <AppProviders queryClient={queryClient}>
       <RouterProvider router={router} />
     </AppProviders>,
   );
```

### apps/web/src/app/app-layout.tsx

```diff
diff --git a/apps/web/src/app/app-layout.tsx b/apps/web/src/app/app-layout.tsx
index 7604eea..547f565 100644
--- a/apps/web/src/app/app-layout.tsx
+++ b/apps/web/src/app/app-layout.tsx
@@ -2,6 +2,7 @@ import { lazy, Suspense, useEffect, useRef } from 'react';
 import { useTranslation } from 'react-i18next';
 import { Link, Outlet, useLocation } from 'react-router';
 import { ThemeToggle, TopBar, Wordmark } from '@bite-and-board/ui-components';
+import { useSessionExpiry } from './use-session-expiry';
 import { useTheme } from './theme';
 
 // Its own chunk: the account menu reads the session through the API client, which
@@ -19,6 +20,8 @@ export function AppLayout() {
   const main = useRef<HTMLElement>(null);
   const shownPath = useRef(location.pathname);
 
+  useSessionExpiry();
+
   // After a navigation to another page (not the first load), move focus to the
   // new page's h1 so screen readers announce it and keyboard users start at the
   // content. Only the path counts: a page that keeps its state in the query
```

### apps/web/src/app/app-providers.tsx

```diff
diff --git a/apps/web/src/app/app-providers.tsx b/apps/web/src/app/app-providers.tsx
index 46998a4..a877c0d 100644
--- a/apps/web/src/app/app-providers.tsx
+++ b/apps/web/src/app/app-providers.tsx
@@ -1,5 +1,5 @@
 import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
-import { useState, type ReactNode } from 'react';
+import type { ReactNode } from 'react';
 import { useTranslation } from 'react-i18next';
 import { initI18n } from '@bite-and-board/i18n';
 import { DirectionProvider, Toaster } from '@bite-and-board/ui-components';
@@ -15,28 +15,37 @@ function AppToaster() {
   return <Toaster theme={mode} customAriaLabel={t('toast.region')} />;
 }
 
+/**
+ * The one server cache. `main.tsx` creates it once and hands it to both the
+ * providers and the route table, so route loaders and components share one session.
+ */
+export function createAppQueryClient() {
+  return new QueryClient({
+    defaultOptions: {
+      queries: {
+        // An API error body with a `code` is a final answer ("recipe not
+        // found"); only network and server failures are worth retrying. This
+        // reads the code by hand: importing data-access here would pull the
+        // whole API client into the initial chunk.
+        retry: (failures, error) =>
+          (error as { code?: unknown } | null)?.code === undefined &&
+          failures < 3,
+      },
+    },
+  });
+}
+
 /**
  * The one provider tree (server cache, i18n, RTL, theme, toasts). `main.tsx` and the specs
  * both render through it, so a missing provider fails a test.
  */
-export function AppProviders({ children }: { children: ReactNode }) {
-  // One cache per mounted app; state keeps it stable across renders.
-  const [queryClient] = useState(
-    () =>
-      new QueryClient({
-        defaultOptions: {
-          queries: {
-            // An API error body with a `code` is a final answer ("recipe not
-            // found"); only network and server failures are worth retrying. This
-            // reads the code by hand: importing data-access here would pull the
-            // whole API client into the initial chunk.
-            retry: (failures, error) =>
-              (error as { code?: unknown } | null)?.code === undefined &&
-              failures < 3,
-          },
-        },
-      }),
-  );
+export function AppProviders({
+  queryClient,
+  children,
+}: {
+  queryClient: QueryClient;
+  children: ReactNode;
+}) {
   return (
     <QueryClientProvider client={queryClient}>
       <DirectionProvider dir="rtl">
```

### apps/web/src/app/library-focus.spec.tsx

```diff
diff --git a/apps/web/src/app/library-focus.spec.tsx b/apps/web/src/app/library-focus.spec.tsx
index 27d557b..b52d8e6 100644
--- a/apps/web/src/app/library-focus.spec.tsx
+++ b/apps/web/src/app/library-focus.spec.tsx
@@ -4,8 +4,8 @@ import { HttpResponse, http } from 'msw';
 import { setupServer } from 'msw/node';
 import { createMemoryRouter, RouterProvider } from 'react-router';
 import { client } from '@bite-and-board/data-access';
-import { AppProviders } from './app-providers';
-import { routes } from './router';
+import { AppProviders, createAppQueryClient } from './app-providers';
+import { createRoutes } from './router';
 
 const server = setupServer(
   http.get('*/api/recipes', () =>
@@ -36,9 +36,12 @@ afterAll(() => server.close());
 // The shell must not treat that as a new page and pull focus away.
 describe('the library inside the app shell', () => {
   it('keeps focus in the search field while typing', async () => {
-    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
+    const queryClient = createAppQueryClient();
+    const router = createMemoryRouter(createRoutes(queryClient), {
+      initialEntries: ['/'],
+    });
     render(
-      <AppProviders>
+      <AppProviders queryClient={queryClient}>
         <RouterProvider router={router} />
       </AppProviders>,
     );
@@ -55,9 +58,12 @@ describe('the library inside the app shell', () => {
   });
 
   it('still moves focus to the heading when the page changes', async () => {
-    const router = createMemoryRouter(routes, { initialEntries: ['/nope'] });
+    const queryClient = createAppQueryClient();
+    const router = createMemoryRouter(createRoutes(queryClient), {
+      initialEntries: ['/nope'],
+    });
     render(
-      <AppProviders>
+      <AppProviders queryClient={queryClient}>
         <RouterProvider router={router} />
       </AppProviders>,
     );
```

### apps/web/src/app/recipe-detail-shell.spec.tsx

```diff
diff --git a/apps/web/src/app/recipe-detail-shell.spec.tsx b/apps/web/src/app/recipe-detail-shell.spec.tsx
index 40f7fe6..c9e9a7d 100644
--- a/apps/web/src/app/recipe-detail-shell.spec.tsx
+++ b/apps/web/src/app/recipe-detail-shell.spec.tsx
@@ -4,8 +4,8 @@ import { HttpResponse, http } from 'msw';
 import { setupServer } from 'msw/node';
 import { createMemoryRouter, RouterProvider } from 'react-router';
 import { client } from '@bite-and-board/data-access';
-import { AppProviders } from './app-providers';
-import { routes } from './router';
+import { AppProviders, createAppQueryClient } from './app-providers';
+import { createRoutes } from './router';
 
 const RECIPE = {
   id: 'r1',
@@ -70,9 +70,12 @@ afterEach(() => {
 afterAll(() => server.close());
 
 function renderApp(path: string) {
-  const router = createMemoryRouter(routes, { initialEntries: [path] });
+  const queryClient = createAppQueryClient();
+  const router = createMemoryRouter(createRoutes(queryClient), {
+    initialEntries: [path],
+  });
   render(
-    <AppProviders>
+    <AppProviders queryClient={queryClient}>
       <RouterProvider router={router} />
     </AppProviders>,
   );
```

### apps/web/src/app/router.spec.tsx

```diff
diff --git a/apps/web/src/app/router.spec.tsx b/apps/web/src/app/router.spec.tsx
index b065c7d..87fb707 100644
--- a/apps/web/src/app/router.spec.tsx
+++ b/apps/web/src/app/router.spec.tsx
@@ -5,15 +5,23 @@ import {
   waitFor,
   within,
 } from '@testing-library/react';
-import { createMemoryRouter, data, RouterProvider } from 'react-router';
-import { AppProviders } from './app-providers';
+import {
+  createMemoryRouter,
+  data,
+  RouterProvider,
+  type RouteObject,
+} from 'react-router';
+import { AppProviders, createAppQueryClient } from './app-providers';
 import { RouteError } from './route-error';
-import { routes } from './router';
+import { createRoutes } from './router';
 
-function renderApp(path: string, appRoutes = routes) {
-  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
+function renderApp(path: string, appRoutes?: RouteObject[]) {
+  const queryClient = createAppQueryClient();
+  const router = createMemoryRouter(appRoutes ?? createRoutes(queryClient), {
+    initialEntries: [path],
+  });
   render(
-    <AppProviders>
+    <AppProviders queryClient={queryClient}>
       <RouterProvider router={router} />
     </AppProviders>,
   );
```

### apps/web/src/app/router.tsx

```diff
diff --git a/apps/web/src/app/router.tsx b/apps/web/src/app/router.tsx
index f12e373..cc53c36 100644
--- a/apps/web/src/app/router.tsx
+++ b/apps/web/src/app/router.tsx
@@ -1,31 +1,35 @@
+import type { QueryClient } from '@tanstack/react-query';
 import type { RouteObject } from 'react-router';
 import { AppLayout } from './app-layout';
 import { NotFound } from './not-found';
 import { RouteError } from './route-error';
 
-export const routes: RouteObject[] = [
-  {
-    path: '/',
-    Component: AppLayout,
-    errorElement: <RouteError />,
-    // Rendered while the first lazy page chunk loads; the app shell replaces it.
-    HydrateFallback: () => null,
-    children: [
-      {
-        index: true,
-        // The page is its own chunk, loaded when the route first matches (AD-11).
-        lazy: () => import('@bite-and-board/feature-recipes/library'),
-      },
-      {
-        path: 'recipes/:id',
-        lazy: () => import('@bite-and-board/feature-recipes/recipe-detail'),
-      },
-      // Inside the layout, so the top bar stays on unknown paths.
-      {
-        path: 'login',
-        lazy: () => import('@bite-and-board/feature-auth/login'),
-      },
-      { path: '*', Component: NotFound },
-    ],
-  },
-];
+/** The route table. Guarded areas are built with `protectedRoute` (Story 2.4 adds `/users`). */
+export function createRoutes(_queryClient: QueryClient): RouteObject[] {
+  return [
+    {
+      path: '/',
+      Component: AppLayout,
+      errorElement: <RouteError />,
+      // Rendered while the first lazy page chunk loads; the app shell replaces it.
+      HydrateFallback: () => null,
+      children: [
+        {
+          index: true,
+          // The page is its own chunk, loaded when the route first matches (AD-11).
+          lazy: () => import('@bite-and-board/feature-recipes/library'),
+        },
+        {
+          path: 'recipes/:id',
+          lazy: () => import('@bite-and-board/feature-recipes/recipe-detail'),
+        },
+        // Inside the layout, so the top bar stays on unknown paths.
+        {
+          path: 'login',
+          lazy: () => import('@bite-and-board/feature-auth/login'),
+        },
+        { path: '*', Component: NotFound },
+      ],
+    },
+  ];
+}
```

### apps/web/src/app/theme.spec.tsx

```diff
diff --git a/apps/web/src/app/theme.spec.tsx b/apps/web/src/app/theme.spec.tsx
index f25c569..4430669 100644
--- a/apps/web/src/app/theme.spec.tsx
+++ b/apps/web/src/app/theme.spec.tsx
@@ -3,8 +3,8 @@ import { join } from 'node:path';
 import { act, fireEvent, render, screen } from '@testing-library/react';
 import { createMemoryRouter, RouterProvider } from 'react-router';
 import { setSystemDark } from '../test-setup';
-import { routes } from './router';
-import { AppProviders } from './app-providers';
+import { createRoutes } from './router';
+import { AppProviders, createAppQueryClient } from './app-providers';
 import { THEME_STORAGE_KEY } from './theme';
 
 const LABELS = {
@@ -16,9 +16,12 @@ const LABELS = {
 const isDark = () => document.documentElement.classList.contains('dark');
 
 async function renderApp() {
-  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
+  const queryClient = createAppQueryClient();
+  const router = createMemoryRouter(createRoutes(queryClient), {
+    initialEntries: ['/'],
+  });
   render(
-    <AppProviders>
+    <AppProviders queryClient={queryClient}>
       <RouterProvider router={router} />
     </AppProviders>,
   );
```

### apps/web/src/app/use-api-error-message.spec.tsx

```diff
diff --git a/apps/web/src/app/use-api-error-message.spec.tsx b/apps/web/src/app/use-api-error-message.spec.tsx
index 7390920..ca2befc 100644
--- a/apps/web/src/app/use-api-error-message.spec.tsx
+++ b/apps/web/src/app/use-api-error-message.spec.tsx
@@ -1,11 +1,12 @@
 import { renderHook } from '@testing-library/react';
 import { useQueryClient } from '@tanstack/react-query';
 import type { ReactNode } from 'react';
-import { AppProviders } from './app-providers';
+import { AppProviders, createAppQueryClient } from './app-providers';
 import { useApiErrorMessage } from './use-api-error-message';
 
+const queryClient = createAppQueryClient();
 const wrapper = ({ children }: { children: ReactNode }) => (
-  <AppProviders>{children}</AppProviders>
+  <AppProviders queryClient={queryClient}>{children}</AppProviders>
 );
 
 describe('useApiErrorMessage', () => {
```

### apps/web/src/main.tsx

```diff
diff --git a/apps/web/src/main.tsx b/apps/web/src/main.tsx
index 530687b..3ae103d 100644
--- a/apps/web/src/main.tsx
+++ b/apps/web/src/main.tsx
@@ -2,10 +2,11 @@ import { StrictMode } from 'react';
 import * as ReactDOM from 'react-dom/client';
 import { createBrowserRouter } from 'react-router';
 import { RouterProvider } from 'react-router/dom';
-import { AppProviders } from './app/app-providers';
-import { routes } from './app/router';
+import { AppProviders, createAppQueryClient } from './app/app-providers';
+import { createRoutes } from './app/router';
 
-const router = createBrowserRouter(routes);
+const queryClient = createAppQueryClient();
+const router = createBrowserRouter(createRoutes(queryClient));
 
 const root = ReactDOM.createRoot(
   document.getElementById('root') as HTMLElement,
@@ -13,7 +14,7 @@ const root = ReactDOM.createRoot(
 
 root.render(
   <StrictMode>
-    <AppProviders>
+    <AppProviders queryClient={queryClient}>
       <RouterProvider router={router} />
     </AppProviders>
   </StrictMode>,
```

### libs/data-access/README.md

```diff
diff --git a/libs/data-access/README.md b/libs/data-access/README.md
index ca23754..b9b7a1c 100644
--- a/libs/data-access/README.md
+++ b/libs/data-access/README.md
@@ -14,6 +14,12 @@ npx nx run data-access:generate
 
 This first runs `recipe-service:openapi` (writes `openapi.json` from the FastAPI app, no server and no database), then hey-api writes types, fetch client, TanStack Query hooks and Zod schemas into `src/generated`. Run it after any change to a router or schema, and commit the result. CI runs it again and fails on `git diff --exit-code` if the committed output is stale.
 
-Hand-written parts: `client.ts` (credentials and the `X-Requested-With: bite-and-board` header on non-GET, configured once on import), `errors.ts` (`getErrorCode`), `invalidation.ts` (the query-invalidation map, empty until Epic 3).
+Hand-written parts: `client.ts` (credentials and the `X-Requested-With: bite-and-board` header on non-GET, and the 401 interceptor, configured once on import), `errors.ts` (`getErrorCode`), `session.ts` (`useSession`, `useCan(role)`), `guards.ts` (`requireRole`, a route loader), `invalidation.ts` (the query-invalidation map, empty until Epic 3).
+
+## Sessions and guards (AD-21)
+
+- The 401 interceptor fires on every 401 except a login attempt (only calls that need a session ever answer 401). It dispatches `SESSION_EXPIRED_EVENT` on `window`; the app shell listens, navigates to `/login?next=…` and shows "פג תוקף החיבור". An event keeps this lib free of the router and the shell free of the API client.
+- `useCan('editor' | 'admin')` is how components decide whether to render a control. Controls a role cannot use are left out, not disabled.
+- `requireRole(queryClient, role?)` is a loader for a group of pages. A visitor goes to `/login?next=…`; a signed-in user below `role` gets a 404. In the web app, build the group with `protectedRoute(queryClient, role, children)`.
 
 Run `npx nx test data-access`.
```

### libs/data-access/openapi.json

(generated; 3 new `ErrorCode` values: `unauthorized`, `forbidden`, `csrf_header_missing`)

### libs/data-access/src/client.spec.ts

```diff
diff --git a/libs/data-access/src/client.spec.ts b/libs/data-access/src/client.spec.ts
index cdb3692..0671927 100644
--- a/libs/data-access/src/client.spec.ts
+++ b/libs/data-access/src/client.spec.ts
@@ -1,5 +1,10 @@
 import { client } from './generated/client.gen';
-import { CSRF_HEADER, CSRF_VALUE, configureClient } from './client';
+import {
+  CSRF_HEADER,
+  CSRF_VALUE,
+  SESSION_EXPIRED_EVENT,
+  configureClient,
+} from './client';
 
 describe('configureClient', () => {
   it('sends same-origin credentials and the CSRF header only on non-GET', async () => {
@@ -25,3 +30,50 @@ describe('configureClient', () => {
     expect(client.getConfig().credentials).toBe('same-origin');
   });
 });
+
+describe('the 401 interceptor', () => {
+  function answerWith(status: number) {
+    configureClient();
+    client.setConfig({
+      fetch: async () =>
+        new Response('{}', {
+          status,
+          headers: { 'Content-Type': 'application/json' },
+        }),
+    });
+  }
+
+  function countExpiries() {
+    const handler = vi.fn();
+    globalThis.addEventListener(SESSION_EXPIRED_EVENT, handler);
+    return {
+      handler,
+      stop: () =>
+        globalThis.removeEventListener(SESSION_EXPIRED_EVENT, handler),
+    };
+  }
+
+  it('announces an expired session on a 401 from a protected call', async () => {
+    answerWith(401);
+    const { handler, stop } = countExpiries();
+    await client.post({ url: '/api/recipes', baseUrl: 'http://test' });
+    stop();
+    expect(handler).toHaveBeenCalledTimes(1);
+  });
+
+  it('stays quiet for a login attempt, even a 401', async () => {
+    answerWith(401);
+    const { handler, stop } = countExpiries();
+    await client.post({ url: '/api/auth/login', baseUrl: 'http://test' });
+    stop();
+    expect(handler).not.toHaveBeenCalled();
+  });
+
+  it.each([200, 400, 403, 404, 500])('stays quiet for a %i', async (status) => {
+    answerWith(status);
+    const { handler, stop } = countExpiries();
+    await client.post({ url: '/api/recipes', baseUrl: 'http://test' });
+    stop();
+    expect(handler).not.toHaveBeenCalled();
+  });
+});
```

### libs/data-access/src/client.ts

```diff
diff --git a/libs/data-access/src/client.ts b/libs/data-access/src/client.ts
index afb8bd0..451e413 100644
--- a/libs/data-access/src/client.ts
+++ b/libs/data-access/src/client.ts
@@ -3,11 +3,22 @@ import { client } from './generated/client.gen';
 export const CSRF_HEADER = 'X-Requested-With';
 export const CSRF_VALUE = 'bite-and-board';
 
+/**
+ * Fired on `window` when a call that needs a session gets a 401 (AD-21). The app
+ * shell listens for it and sends the user to `/login`. An event keeps this lib free
+ * of the router, and keeps the shell from importing the API client (AD-11).
+ */
+export const SESSION_EXPIRED_EVENT = 'bite-and-board:session-expired';
+
+// A login attempt is never an expired session: the login screen shows its own errors.
+const LOGIN_PATH = '/api/auth/login';
+
 let configured = false;
 
 /**
- * Configures the one generated client (AD-19): same-origin cookies, and the
- * CSRF header on every non-GET request. Safe to call more than once.
+ * Configures the one generated client (AD-19): same-origin cookies, the CSRF
+ * header on every non-GET request, and the single 401 interceptor (AD-21).
+ * Safe to call more than once.
  */
 export function configureClient() {
   if (configured) return;
@@ -19,4 +30,15 @@ export function configureClient() {
     }
     return request;
   });
+  // Only calls that require a session ever answer 401: `/auth/session` is public
+  // (always 200) and a bad login is a 400, so any other 401 means "sign in again".
+  client.interceptors.response.use((response, request) => {
+    if (
+      response.status === 401 &&
+      new URL(request.url, globalThis.location.origin).pathname !== LOGIN_PATH
+    ) {
+      globalThis.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
+    }
+    return response;
+  });
 }
```

### libs/data-access/src/generated/types.gen.ts

(generated; 3 new `ErrorCode` values: `unauthorized`, `forbidden`, `csrf_header_missing`)

### libs/data-access/src/generated/zod.gen.ts

(generated; 3 new `ErrorCode` values: `unauthorized`, `forbidden`, `csrf_header_missing`)

### libs/data-access/src/index.ts

```diff
diff --git a/libs/data-access/src/index.ts b/libs/data-access/src/index.ts
index 6792e4e..2f58e53 100644
--- a/libs/data-access/src/index.ts
+++ b/libs/data-access/src/index.ts
@@ -7,7 +7,13 @@ export * from './generated/@tanstack/react-query.gen';
 export * as schemas from './generated/zod.gen';
 // The configured client instance, for tests that point it at a mock server.
 export { client } from './generated/client.gen';
-export { CSRF_HEADER, CSRF_VALUE, configureClient } from './client';
+export {
+  CSRF_HEADER,
+  CSRF_VALUE,
+  SESSION_EXPIRED_EVENT,
+  configureClient,
+} from './client';
 export { getErrorCode } from './errors';
-export { useSession } from './session';
+export { requireRole } from './guards';
+export { roleAtLeast, useCan, useSession } from './session';
 export { invalidationMap, type Invalidator } from './invalidation';
```

### libs/data-access/src/session.ts

```diff
diff --git a/libs/data-access/src/session.ts b/libs/data-access/src/session.ts
index 299ff0b..c12b252 100644
--- a/libs/data-access/src/session.ts
+++ b/libs/data-access/src/session.ts
@@ -1,5 +1,14 @@
 import { useQuery } from '@tanstack/react-query';
 import { authSessionOptions } from './generated/@tanstack/react-query.gen';
+import type { Role } from './generated/types.gen';
+
+// Admin satisfies every editor-level check, as on the server (AD-30).
+const RANK: Record<Role, number> = { editor: 1, admin: 2 };
+
+/** Whether someone with `held` may do what `required` allows. */
+export function roleAtLeast(held: Role, required: Role): boolean {
+  return RANK[held] >= RANK[required];
+}
 
 /**
  * Who is signed in (AD-21). The query cache is the auth state: login sets it,
@@ -8,8 +17,18 @@ import { authSessionOptions } from './generated/@tanstack/react-query.gen';
  *
  * It never goes stale by itself: the cookie is `httpOnly`, so the client cannot
  * see it expire. An expired or revoked session shows up as a 401 on the next
- * protected request (Story 2.3).
+ * protected request, which the 401 interceptor turns into a trip to `/login`.
  */
 export function useSession() {
   return useQuery({ ...authSessionOptions(), staleTime: Infinity });
 }
+
+/**
+ * Whether the signed-in user may use controls that need `role`. A visitor, and
+ * the moment before the first answer, both say no. Hide controls with this
+ * instead of disabling them (FR-16); the server stays the authority (AD-30).
+ */
+export function useCan(role: Role): boolean {
+  const user = useSession().data?.user;
+  return user ? roleAtLeast(user.role, role) : false;
+}
```

### libs/data-access/tsconfig.spec.json

```diff
diff --git a/libs/data-access/tsconfig.spec.json b/libs/data-access/tsconfig.spec.json
index 60ca21b..03f06f8 100644
--- a/libs/data-access/tsconfig.spec.json
+++ b/libs/data-access/tsconfig.spec.json
@@ -9,6 +9,7 @@
       "node",
       "vitest"
     ],
+    "lib": ["es2022", "dom", "dom.iterable"],
     "jsx": "react-jsx",
     "module": "esnext",
     "moduleResolution": "bundler"
```

### libs/i18n/src/he.json

```diff
diff --git a/libs/i18n/src/he.json b/libs/i18n/src/he.json
index 66affd4..b45fe40 100644
--- a/libs/i18n/src/he.json
+++ b/libs/i18n/src/he.json
@@ -60,7 +60,8 @@
     "menu": {
       "login": "כניסה",
       "logout": "יציאה"
-    }
+    },
+    "sessionExpired": "פג תוקף החיבור"
   },
   "notFound": {
     "title": "הדף לא נמצא",
@@ -80,6 +81,9 @@
     "password_too_long": "הסיסמה יכולה להכיל עד {{max}} תווים",
     "invalid_credentials": "אימייל או סיסמה שגויים",
     "rate_limited": "יותר מדי ניסיונות. אפשר לנסות שוב בעוד דקה.",
+    "unauthorized": "יש להתחבר כדי להמשיך",
+    "forbidden": "אין הרשאה לפעולה הזאת",
+    "csrf_header_missing": "הבקשה נדחתה. אפשר לרענן את הדף ולנסות שוב",
     "unknown": "משהו השתבש, אפשר לנסות שוב"
   },
   "units": {
```

## New files

### apps/recipe-service/tests/test_guards.py

```python
"""`require_role` and the CSRF guard, via a test-only protected router (AD-6, AD-30)."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient
from httpx import Response
from sqlmodel import Session

from app.core.security import (
    CSRF_HEADER,
    SESSION_COOKIE,
    CurrentUser,
    Role,
    create_session_token,
    get_session_user,
    has_role,
    require_role,
)
from tests.conftest import TEST_SECRET
from tests.factories import add_user

PASSWORD = "correct horse"
LOGIN = "/api/auth/login"
EDITOR_AREA = "/api/guarded/editor"
ADMIN_AREA = "/api/guarded/admin"

# Counts how many times a protected mutation actually ran.
_writes: list[str] = []


def _guarded_router() -> APIRouter:
    router = APIRouter(prefix="/guarded", tags=["guarded"])

    @router.get("/editor")
    def get_editor_area(
        user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
    ) -> dict[str, str]:
        return {"email": user.email, "role": user.role}

    @router.post("/editor")
    def post_editor_area(
        user: Annotated[CurrentUser, Depends(require_role("editor"))],
    ) -> dict[str, str]:
        _writes.append(user.email)
        return {"ok": "yes"}

    @router.get("/admin")
    def get_admin_area(
        user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
    ) -> dict[str, str]:
        return {"email": user.email}

    return router


@pytest.fixture
def app(app: FastAPI) -> FastAPI:
    """The real app plus the test-only protected routes."""
    _writes.clear()
    app.include_router(_guarded_router(), prefix="/api")
    return app


def _sign_in(client: TestClient, email: str) -> None:
    response = client.post(LOGIN, json={"email": email, "password": PASSWORD})
    assert response.status_code == 200


def _body(response: Response) -> dict[str, object]:
    body: dict[str, object] = response.json()
    return body


# --- 401 / 403 ---------------------------------------------------------------


def test_a_visitor_gets_401_and_nothing_changes(client: TestClient) -> None:
    response = client.post(EDITOR_AREA)
    assert response.status_code == 401
    assert _body(response)["code"] == "unauthorized"
    assert _writes == []
    assert client.get(ADMIN_AREA).status_code == 401


def test_an_editor_may_use_editor_routes_but_not_admin_routes(
    client: TestClient, session: Session
) -> None:
    add_user(session, email="ed@example.com", role=Role.EDITOR)
    _sign_in(client, "ed@example.com")

    assert client.get(EDITOR_AREA).json() == {
        "email": "ed@example.com",
        "role": "editor",
    }
    assert client.post(EDITOR_AREA).status_code == 200
    assert _writes == ["ed@example.com"]

    forbidden = client.get(ADMIN_AREA)
    assert forbidden.status_code == 403
    assert _body(forbidden)["code"] == "forbidden"


def test_an_admin_satisfies_editor_and_admin_routes(
    client: TestClient, session: Session
) -> None:
    add_user(session, email="boss@example.com", role=Role.ADMIN)
    _sign_in(client, "boss@example.com")
    assert client.get(EDITOR_AREA).status_code == 200
    assert client.post(EDITOR_AREA).status_code == 200
    assert client.get(ADMIN_AREA).status_code == 200


def test_a_forged_expired_or_orphaned_cookie_is_401(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, role=Role.ADMIN)
    expired = create_session_token(
        user.id, TEST_SECRET, now=datetime.now(UTC) - timedelta(days=8)
    )
    forged = jwt.encode(
        {"sub": str(user.id), "exp": datetime.now(UTC) + timedelta(days=1)},
        "another-secret-another-secret-another",
        algorithm="HS256",
    )
    for token in (expired, forged, "garbage"):
        client.cookies.set(SESSION_COOKIE, token)
        assert client.get(ADMIN_AREA).status_code == 401


# --- the database decides on every request (AD-30) ---------------------------


def test_a_demotion_takes_effect_on_the_next_request(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, role=Role.ADMIN)
    _sign_in(client, user.email)
    assert client.get(ADMIN_AREA).status_code == 200

    user.role = Role.EDITOR
    session.add(user)
    session.commit()

    assert client.get(ADMIN_AREA).status_code == 403
    assert client.get(EDITOR_AREA).status_code == 200


def test_a_block_takes_effect_on_the_next_request(
    client: TestClient, session: Session
) -> None:
    user = add_user(session, role=Role.EDITOR)
    _sign_in(client, user.email)
    assert client.post(EDITOR_AREA).status_code == 200

    user.is_blocked = True
    session.add(user)
    session.commit()

    blocked = client.post(EDITOR_AREA)
    assert blocked.status_code == 401
    assert _writes == [user.email]


def test_a_deleted_user_is_401(client: TestClient, session: Session) -> None:
    user = add_user(session, role=Role.EDITOR)
    _sign_in(client, user.email)
    session.delete(user)
    session.commit()
    assert client.get(EDITOR_AREA).status_code == 401


# --- CSRF (AD-6, AD-21) ------------------------------------------------------


def test_a_mutation_without_the_header_is_403_even_for_a_visitor(
    bare_client: TestClient,
) -> None:
    response = bare_client.post(EDITOR_AREA)
    assert response.status_code == 403
    assert _body(response)["code"] == "csrf_header_missing"
    assert _writes == []


def test_a_wrong_header_value_is_403(bare_client: TestClient) -> None:
    response = bare_client.post(EDITOR_AREA, headers={CSRF_HEADER: "fetch"})
    assert response.status_code == 403
    assert _body(response)["code"] == "csrf_header_missing"


def test_a_signed_in_editor_without_the_header_changes_nothing(
    client: TestClient, bare_client: TestClient, session: Session
) -> None:
    add_user(session, role=Role.EDITOR)
    _sign_in(client, "adi@example.com")
    bare_client.cookies.set(SESSION_COOKIE, client.cookies[SESSION_COOKIE])
    assert bare_client.post(EDITOR_AREA).status_code == 403
    assert _writes == []


@pytest.mark.parametrize("path", ["/api/auth/login", "/api/auth/logout"])
def test_login_and_logout_need_the_header_too(
    bare_client: TestClient, path: str
) -> None:
    response = bare_client.post(path, json={"email": "a@b.co", "password": "x"})
    assert response.status_code == 403
    assert _body(response)["code"] == "csrf_header_missing"


def test_reads_never_need_the_header(bare_client: TestClient) -> None:
    assert bare_client.get("/api/auth/session").status_code == 200
    assert bare_client.get("/api/tags").status_code == 200
    assert bare_client.get(ADMIN_AREA).status_code == 401  # not 403


# --- the seam ----------------------------------------------------------------


def test_main_wires_the_current_user_provider(app: FastAPI) -> None:
    assert get_session_user in app.dependency_overrides


def test_the_unwired_seam_fails_loudly() -> None:
    with pytest.raises(RuntimeError, match="not wired"):
        get_session_user()


def test_has_role_ranks_admin_above_editor() -> None:
    assert has_role(Role.ADMIN, Role.EDITOR)
    assert has_role(Role.ADMIN, Role.ADMIN)
    assert has_role(Role.EDITOR, Role.EDITOR)
    assert not has_role(Role.EDITOR, Role.ADMIN)
```

### apps/web/src/app/protected-route.spec.tsx

```tsx
import { act, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import {
  authSessionQueryKey,
  client,
  SESSION_EXPIRED_EVENT as DATA_ACCESS_EVENT,
  useCan,
  type SessionUser,
} from '@bite-and-board/data-access';
import { AppLayout } from './app-layout';
import { AppProviders, createAppQueryClient } from './app-providers';
import { NotFound } from './not-found';
import { protectedRoute } from './protected-route';
import { SESSION_EXPIRED_EVENT } from './use-session-expiry';

const EDITOR: SessionUser = {
  id: 'u1',
  email: 'ed@example.com',
  name: 'Ed',
  role: 'editor',
};
const ADMIN: SessionUser = { ...EDITOR, name: 'Boss', role: 'admin' };

// What `GET /api/auth/session` answers; a blocked user is a visitor to it.
let sessionUser: SessionUser | null = null;
const server = setupServer(
  http.get('*/api/auth/session', () =>
    HttpResponse.json({ user: sessionUser }),
  ),
  http.get('*/api/recipes', () => HttpResponse.json([])),
  http.get('*/api/tags', () => HttpResponse.json([])),
);

beforeAll(() => {
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  sessionUser = null;
});
afterAll(() => server.close());

// A page whose controls depend on the role: absent, not disabled.
function Area({ title }: { title: string }) {
  const canEdit = useCan('editor');
  const canManage = useCan('admin');
  return (
    <>
      <h1>{title}</h1>
      {canEdit ? <button>עריכה</button> : null}
      {canManage ? <button>ניהול</button> : null}
    </>
  );
}

// Stands in for a real protected call, such as saving a recipe.
function SaveButton() {
  return (
    <button onClick={() => void client.post({ url: '/api/recipes' })}>
      שמירה
    </button>
  );
}

function renderTestApp(path: string) {
  const queryClient = createAppQueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: AppLayout,
        HydrateFallback: () => null,
        children: [
          protectedRoute(queryClient, undefined, [
            {
              path: 'area',
              element: (
                <>
                  <Area title="אזור מוגן" />
                  <SaveButton />
                </>
              ),
            },
          ]),
          protectedRoute(queryClient, 'admin', [
            { path: 'admin-area', element: <Area title="אזור מנהל" /> },
          ]),
          {
            path: 'login',
            lazy: () => import('@bite-and-board/feature-auth/login'),
          },
          { path: '*', Component: NotFound },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, queryClient };
}

describe('protected routes', () => {
  it('sends a visitor to /login with the page they wanted', async () => {
    const { router } = renderTestApp('/area?tab=1');
    await screen.findByRole('heading', { level: 1, name: 'כניסה' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      `?next=${encodeURIComponent('/area?tab=1')}`,
    );
  });

  it('shows an editor the signed-in page with editor controls only', async () => {
    sessionUser = EDITOR;
    renderTestApp('/area');
    await screen.findByRole('heading', { name: 'אזור מוגן' });
    expect(await screen.findByRole('button', { name: 'עריכה' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'ניהול' })).toBeNull();
  });

  it('shows an admin every control', async () => {
    sessionUser = ADMIN;
    renderTestApp('/area');
    expect(await screen.findByRole('button', { name: 'עריכה' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'ניהול' })).toBeTruthy();
  });

  it('lets an admin into the admin-only area', async () => {
    sessionUser = ADMIN;
    renderTestApp('/admin-area');
    expect(
      await screen.findByRole('heading', { name: 'אזור מנהל' }),
    ).toBeTruthy();
  });

  it('shows an editor the not-found page, inside the shell, for an admin-only area', async () => {
    sessionUser = EDITOR;
    renderTestApp('/admin-area');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'הדף לא נמצא' }),
    ).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'אזור מנהל' })).toBeNull();
  });

  it('treats a blocked user, whom the session reports as nobody, as a visitor', async () => {
    sessionUser = null; // the server answers `user: null` for a blocked account
    const { router } = renderTestApp('/admin-area');
    await screen.findByRole('heading', { level: 1, name: 'כניסה' });
    expect(router.state.location.pathname).toBe('/login');
  });
});

describe('an expired session', () => {
  it('uses the same event name as data-access', () => {
    expect(SESSION_EXPIRED_EVENT).toBe(DATA_ACCESS_EVENT);
  });

  it('goes to /login?next=… with a message, without leaving the app', async () => {
    sessionUser = EDITOR;
    // The server has blocked the account since the page loaded.
    server.use(
      http.post('*/api/recipes', () =>
        HttpResponse.json(
          { detail: 'Sign in required', code: 'unauthorized' },
          { status: 401 },
        ),
      ),
    );
    const { router, queryClient } = renderTestApp('/area');
    // What the cache says about the user when the router first reaches /login.
    let seenAtLogin: unknown = 'not reached';
    router.subscribe((state) => {
      if (
        state.location.pathname === '/login' &&
        seenAtLogin === 'not reached'
      ) {
        seenAtLogin = queryClient.getQueryData<{ user: unknown }>(
          authSessionQueryKey(),
        )?.user;
      }
    });
    const save = await screen.findByRole('button', { name: 'שמירה' });
    sessionUser = null;
    await act(async () => save.click());

    await screen.findByRole('heading', { level: 1, name: 'כניסה' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      `?next=${encodeURIComponent('/area')}`,
    );
    // The login page sends a signed-in user straight on, so the cache must already
    // say "visitor" when it appears, or it would bounce back to the page.
    expect(seenAtLogin).toBeNull();
    expect(await screen.findByText('פג תוקף החיבור')).toBeTruthy();
    // The shell now shows a visitor.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Ed' })).toBeNull(),
    );
  });

  it('counts several 401s at once as one trip to /login', async () => {
    sessionUser = EDITOR;
    server.use(
      http.post('*/api/recipes', () =>
        HttpResponse.json(
          { detail: 'Sign in required', code: 'unauthorized' },
          { status: 401 },
        ),
      ),
    );
    renderTestApp('/area');
    const save = await screen.findByRole('button', { name: 'שמירה' });
    sessionUser = null;
    await act(async () => {
      save.click();
      save.click();
    });
    await screen.findByRole('heading', { level: 1, name: 'כניסה' });
    await screen.findByText('פג תוקף החיבור');
    expect(document.querySelectorAll('[data-title]')).toHaveLength(1);
  });
});
```

### apps/web/src/app/protected-route.tsx

```tsx
import type { QueryClient } from '@tanstack/react-query';
import {
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import type { Role } from '@bite-and-board/data-access';
import { NotFound } from './not-found';

// The guard is imported when it first runs, so the API client stays out of the
// first load (AD-11); by the time someone opens a guarded page it is needed anyway.
function guard(queryClient: QueryClient, role?: Role) {
  return async (args: LoaderFunctionArgs) => {
    const { requireRole } = await import('./session-api');
    return requireRole(queryClient, role)(args);
  };
}

/** Shows the not-found page inside the shell; any other error goes up to the root. */
function ProtectedError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  throw error;
}

/**
 * A group of pages for signed-in users (FR-16): visitors go to `/login?next=…`,
 * and with `role` set, anyone below it sees the not-found page. The routes are
 * only reachable after the guard runs, so their own loaders can trust the session.
 */
export function protectedRoute(
  queryClient: QueryClient,
  role: Role | undefined,
  children: RouteObject[],
): RouteObject {
  return {
    loader: guard(queryClient, role),
    errorElement: <ProtectedError />,
    children,
  };
}
```

### apps/web/src/app/session-api.ts

```ts
import type { QueryClient } from '@tanstack/react-query';
import { authSessionQueryKey, requireRole } from '@bite-and-board/data-access';

// The shell's only door to the API client. Everything imports this file lazily,
// so the client stays out of the first load (AD-11); importing data-access from
// the lazy chunk's own file also keeps the module-boundary lint rule happy.
export { requireRole };

/** Marks the session query as a visitor at once, then confirms with the server. */
export function markSignedOut(queryClient: QueryClient) {
  queryClient.setQueryData(authSessionQueryKey(), { user: null });
  void queryClient.invalidateQueries({ queryKey: authSessionQueryKey() });
}
```

### apps/web/src/app/use-session-expiry.ts

```ts
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { toast } from '@bite-and-board/ui-components';

// Must match `SESSION_EXPIRED_EVENT` in data-access (a spec checks it). It is
// repeated here because importing data-access would put the API client in the
// first load (AD-11).
export const SESSION_EXPIRED_EVENT = 'bite-and-board:session-expired';

/**
 * When a protected call answers 401 (the session expired, or the account was
 * blocked), send the user to `/login?next=…`, say why, and forget the signed-in
 * state. It navigates through the router, so a form's in-memory state survives
 * (AD-21). Several calls failing at once count as one.
 */
export function useSessionExpiry() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const path = `${location.pathname}${location.search}`;
  // Set by the first 401 and held until the user leaves /login again, so the
  // calls that fail together do not each toast and navigate.
  const handled = useRef(false);

  useEffect(() => {
    if (location.pathname !== '/login') handled.current = false;
  }, [location.pathname]);

  useEffect(() => {
    const onExpired = async () => {
      if (handled.current || location.pathname === '/login') return;
      handled.current = true;
      try {
        // Marked signed out before navigating: the login page sends a signed-in
        // user straight on, so it must not see the stale session.
        const { markSignedOut } = await import('./session-api');
        markSignedOut(queryClient);
      } catch {
        // The chunk could not load (offline): still go to the login page.
      }
      toast.error(t('auth.sessionExpired'));
      void navigate(`/login?next=${encodeURIComponent(path)}`);
    };
    const listener = () => void onExpired();
    globalThis.addEventListener(SESSION_EXPIRED_EVENT, listener);
    return () =>
      globalThis.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  }, [location.pathname, navigate, path, queryClient, t]);
}
```

### libs/data-access/src/guards.spec.ts

```ts
import { QueryClient } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { client } from './generated/client.gen';
import type { Role, SessionUser } from './generated/types.gen';
import { requireRole } from './guards';

const server = setupServer();
beforeAll(() => {
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function serveSession(role: Role | null) {
  const user: SessionUser | null = role
    ? { id: 'u1', email: 'a@b.co', name: 'Adi', role }
    : null;
  server.use(http.get('*/api/auth/session', () => HttpResponse.json({ user })));
}

async function runGuard(
  role: Role | undefined,
  url = 'http://test/secret?a=1',
) {
  const loader = requireRole(new QueryClient(), role);
  try {
    return await loader({ request: new Request(url) });
  } catch (thrown) {
    return thrown;
  }
}

describe('requireRole', () => {
  it('sends a visitor to /login with the page they wanted', async () => {
    serveSession(null);
    const result = await runGuard(undefined);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get('Location')).toBe(
      '/login?next=%2Fsecret%3Fa%3D1',
    );
  });

  it('lets any signed-in user through when no role is asked', async () => {
    serveSession('editor');
    expect(await runGuard(undefined)).toBeNull();
  });

  it('lets an editor into editor areas and an admin into both', async () => {
    serveSession('editor');
    expect(await runGuard('editor')).toBeNull();
    serveSession('admin');
    expect(await runGuard('editor')).toBeNull();
    expect(await runGuard('admin')).toBeNull();
  });

  it('answers an editor on an admin area with not-found', async () => {
    serveSession('editor');
    const result = (await runGuard('admin')) as {
      type: string;
      init: { status: number };
    };
    expect(result.type).toBe('DataWithResponseInit');
    expect(result.init.status).toBe(404);
  });

  it('reuses the cached session instead of asking again', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/auth/session', () => {
        calls += 1;
        return HttpResponse.json({
          user: { id: 'u1', email: 'a@b.co', name: 'Adi', role: 'admin' },
        });
      }),
    );
    const loader = requireRole(new QueryClient(), 'admin');
    await loader({ request: new Request('http://test/x') });
    await loader({ request: new Request('http://test/x') });
    expect(calls).toBe(1);
  });
});
```

### libs/data-access/src/guards.ts

```ts
import type { QueryClient } from '@tanstack/react-query';
import { data, redirect } from 'react-router';
import { authSessionOptions } from './generated/@tanstack/react-query.gen';
import type { Role } from './generated/types.gen';
import { roleAtLeast } from './session';

/**
 * A route loader that guards a signed-in area, like a Nest `@Roles()` guard.
 * A visitor is sent to `/login?next=…`; a signed-in user without `role` gets a
 * 404, so an editor never learns that an admin screen exists. Without `role` any
 * signed-in user passes. It reads the session from the cache the page already
 * shares, so a guarded click costs no extra request after the first.
 */
export function requireRole(queryClient: QueryClient, role?: Role) {
  return async ({ request }: { request: Request }) => {
    const { user } = await queryClient.ensureQueryData({
      ...authSessionOptions(),
      staleTime: Infinity,
    });
    if (!user) {
      const { pathname, search } = new URL(request.url);
      throw redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
    }
    if (role && !roleAtLeast(user.role, role)) {
      throw data(null, { status: 404 });
    }
    return null;
  };
}
```

### libs/data-access/src/session.spec.tsx

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { client } from './generated/client.gen';
import type { Role, SessionUser } from './generated/types.gen';
import { roleAtLeast, useCan } from './session';

const server = setupServer();
beforeAll(() => {
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function serveSession(role: Role | null) {
  const user: SessionUser | null = role
    ? { id: 'u1', email: 'a@b.co', name: 'Adi', role }
    : null;
  server.use(http.get('*/api/auth/session', () => HttpResponse.json({ user })));
}

function renderCan(role: Role) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCan(role), { wrapper });
}

describe('roleAtLeast', () => {
  it.each([
    ['admin', 'admin', true],
    ['admin', 'editor', true],
    ['editor', 'editor', true],
    ['editor', 'admin', false],
  ] as const)('%s holding %s is %s', (held, required, expected) => {
    expect(roleAtLeast(held, required)).toBe(expected);
  });
});

describe('useCan', () => {
  it('says no to a visitor, and before the first answer', async () => {
    serveSession(null);
    const { result } = renderCan('editor');
    expect(result.current).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBe(false);
  });

  it('lets an editor use editor controls only', async () => {
    serveSession('editor');
    const editor = renderCan('editor');
    const admin = renderCan('admin');
    await waitFor(() => expect(editor.result.current).toBe(true));
    expect(admin.result.current).toBe(false);
  });

  it('lets an admin use both', async () => {
    serveSession('admin');
    const editor = renderCan('editor');
    const admin = renderCan('admin');
    await waitFor(() => expect(editor.result.current).toBe(true));
    await waitFor(() => expect(admin.result.current).toBe(true));
  });
});
```
