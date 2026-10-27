# data-access

The only way the web app talks to the API: the hey-api generated client, TanStack Query hooks, Zod schemas and query keys.

- Tag `type:data-access`: imports no other workspace lib.

## Generated client (AD-3, AD-19)

`openapi.json` and `src/generated` are generated and committed. Never edit them by hand.

```bash
npx nx run data-access:generate
```

This first runs `recipe-service:openapi` (writes `openapi.json` from the FastAPI app, no server and no database), then hey-api writes types, fetch client, TanStack Query hooks and Zod schemas into `src/generated`. Run it after any change to a router or schema, and commit the result. CI runs it again and fails on `git diff --exit-code` if the committed output is stale.

Hand-written parts: `client.ts` (credentials and the `X-Requested-With: bite-and-board` header on non-GET, configured once on import), `errors.ts` (`getErrorCode`), `invalidation.ts` (the query-invalidation map, empty until Epic 3).

Run `npx nx test data-access`.
