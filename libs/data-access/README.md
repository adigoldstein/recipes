# data-access

The only way the web app talks to the API: the hey-api generated client, TanStack Query hooks, Zod schemas and query keys.

- Tag `type:data-access`: imports no other workspace lib.

## Generated client (AD-3, AD-19)

`openapi.json` and `src/generated` are generated and committed. Never edit them by hand.

```bash
npx nx run data-access:generate
```

This first runs `recipe-service:openapi` (writes `openapi.json` from the FastAPI app, no server and no database), then hey-api writes types, fetch client, TanStack Query hooks and Zod schemas into `src/generated`. Run it after any change to a router or schema, and commit the result. CI runs it again and fails on `git diff --exit-code` if the committed output is stale.

Hand-written parts: `client.ts` (credentials and the `X-Requested-With: bite-and-board` header on non-GET, and the 401 interceptor, configured once on import), `errors.ts` (`getErrorCode`), `session.ts` (`useSession`, `useCan(role)`), `guards.ts` (`requireRole`, a route loader), `invalidation.ts` (the query-invalidation map, empty until Epic 3).

## Sessions and guards (AD-21)

- The 401 interceptor fires on every 401 except a login attempt (only calls that need a session ever answer 401). It dispatches `SESSION_EXPIRED_EVENT` on `window`; the app shell listens, navigates to `/login?next=…` and shows "פג תוקף החיבור". An event keeps this lib free of the router and the shell free of the API client.
- `useCan('editor' | 'admin')` is how components decide whether to render a control. Controls a role cannot use are left out, not disabled.
- `requireRole(queryClient, role?)` is a loader for a group of pages. A visitor goes to `/login?next=…`; a signed-in user below `role` gets a 404. In the web app, build the group with `protectedRoute(queryClient, role, children)`.

Run `npx nx test data-access`.
