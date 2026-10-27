---
title: 'Story 1.7: Generated API client pipeline'
type: 'feature'
created: '2026-10-27'
status: 'done'
route: 'dispatch'
baseline_commit: 'faefd07'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-recipes-2026-10-26/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-6-recipe-data-model-and-read-api.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The web app has no typed way to call the API. `libs/data-access` is empty (`export {}`), there is no committed OpenAPI file, and nothing stops the frontend from drifting from the backend.

**Approach:** Export the OpenAPI schema from the FastAPI app without running the server, generate types, fetch client, TanStack Query hooks and Zod schemas with hey-api into `libs/data-access/src/generated`, configure the client once, add one `QueryClient` provider and an empty invalidation map, add an `ErrorCode` → Hebrew message path, and make CI fail on a stale generated client.

## Boundaries & Constraints

**Always:**

- ACs of Story 1.7 in `epics.md` are the contract; AD-3, AD-19 and AD-28 govern the shape.
- `nx run data-access:generate` depends on `recipe-service:openapi`, which writes `libs/data-access/openapi.json` (committed). Generation must work offline and without a database.
- Client config in one place: `credentials: 'same-origin'`, header `X-Requested-With: bite-and-board` on every non-GET request.
- One `QueryClient` provider in `AppProviders`; `libs/data-access` exports an empty query-invalidation map (typed so Epic 3 only adds entries, using generated `*QueryKey()` helpers).
- A non-422 API error reaches the UI as an `ErrorCode`; the UI renders `errors.<code>` from `he.json`, generic message for unknown codes. `libs/data-access` imports no workspace lib (the Hebrew text lives in the app).
- Generated output is never hand-edited, excluded from lint and Prettier, and covered by the drift check.
- Design tokens only and RTL logical classes for any UI touched.

**Never:**

- No commit or push before Adi approves the review file.
- No new API endpoints and no backend model changes.
- No feature screens (Epic 3), no 422 → field mapping helper (arrives with the first form, Story 3.1).
- No dependency or version added without Adi's approval (see Decisions).

</frozen-after-approval>

## Plan

1. **Export (backend):** `python -m app.openapi_export <path>` builds `create_app().openapi()` and writes stable, sorted JSON (no server, no lifespan, dummy `JWT_SECRET` only if unset). Nx target `recipe-service:openapi` runs it with output `libs/data-access/openapi.json`.
2. **Generate (lib):** `libs/data-access/openapi-ts.config.ts` with the hey-api plugins (typescript, sdk, fetch client, `@tanstack/react-query`, zod). Target `data-access:generate` (dependsOn `recipe-service:openapi`), output `src/generated`.
3. **Client config:** `src/client.ts` runs `client.setConfig` once (credentials, header on non-GET via a request interceptor), imported by the lib entry so any consumer is configured.
4. **Errors:** `src/errors.ts` exports `getErrorCode(error)` (reads `{code}` against the generated `ErrorCode`), plus `he.json` keys `errors.recipe_not_found` and `errors.unknown`; the app's `useApiErrorMessage()` maps code → text.
5. **Cache:** `src/invalidation.ts` empty map; `QueryClientProvider` in `AppProviders`.
6. **CI:** step after `npm ci`: `nx run data-access:generate` then `git diff --exit-code`.
7. **Tests:** header/credentials only on right requests, `getErrorCode` (known, unknown, non-API error), `useApiErrorMessage` fallback, `AppProviders` provides a `QueryClient`, a sanity check that the generated recipe hooks exist.
8. **Docs:** data-access README (commands, "never edit generated"), recipe-service README (`openapi` target).
9. **Verify:** lint, typecheck, test, build, `format:check`, `nx affected`; review file.

## Decisions (Adi to confirm)

See the plan message: OpenAPI export script, location of the `generate` target, library versions, where error mapping lives, and Prettier/ESLint handling of generated files.
