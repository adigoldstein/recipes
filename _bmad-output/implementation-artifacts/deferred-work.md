- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-adapt-the-backend-scaffold.md`
  summary: Validate `LLM_PROVIDERS` (known names, non-empty, `fake` refused unless dev/test, gemini requires `GEMINI_API_KEY`).
  evidence: Settings accepts any list today; no consumer exists until the provider registry story (Epic 5).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-adapt-the-backend-scaffold.md`
  summary: Validate `APP_TIMEZONE` with `ZoneInfo` at load and add the `tzdata` dependency (needed on Windows).
  evidence: Plain `str` today; the daily import cap story is the first consumer.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-adapt-the-backend-scaffold.md`
  summary: Decide a minimum length for `JWT_SECRET` in production.
  evidence: Only blank values are rejected; security policy choice for Adi, natural home Story 2.x.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-adapt-the-backend-scaffold.md`
  summary: Give framework errors (404/405/HTTPException) the `{detail, code}` shape and publish `ErrorResponse` in OpenAPI.
  evidence: FastAPI default bodies lack `code`; AD-28 client mapping lands in Story 1.7.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-adapt-the-backend-scaffold.md`
  summary: Dispose the SQLite engine on app shutdown (lifespan).
  evidence: Engine is cached without a shutdown hook; Story 1.6 adds DB/lifespan.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md`
  summary: Add an automated lint fixture test (ESLint Node API) proving each Nx boundary rule fails a forbidden import (ui → data-access, ui → react-router, domain → react, feature → feature), and re-check the `@tanstack/*`/`@hey-api/*` bans once Story 1.7 installs them.
  evidence: Rules were verified with throwaway probes only; removing a constraint keeps `nx lint` green because no file violates it yet. Natural home Story 1.3.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-adapt-the-frontend-scaffold-and-shared-libs.md`
  summary: Cover the real app boot (`main.tsx` + `react-router/dom`) and the Vite `/api`, `/media` proxy with an automated check.
  evidence: Only manual runs today; no e2e harness until Story 6.3 (Playwright), app-shell tests from 1.4.
