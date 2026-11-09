import { client } from './generated/client.gen';

export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_VALUE = 'bite-and-board';

/**
 * Sent on `window` when a request that needs a login gets a 401 (AD-21). The app
 * listens for it and sends the user to `/login`. We use an event so this lib does
 * not need the router, and the app does not need to import the API client (AD-11).
 */
export const SESSION_EXPIRED_EVENT = 'bite-and-board:session-expired';

// A 401 from the login request is not an expired session. The login screen shows
// its own errors.
const LOGIN_PATH = '/api/auth/login';

/**
 * Sent on `window` when a write took longer than the client's time limit (AD-43). The
 * server may still have finished it, so the app reloads all data from the server.
 */
export const OUTCOME_UNKNOWN_EVENT = 'bite-and-board:outcome-unknown';

/**
 * How long the client waits for a request before it gives up (AD-43). It is always
 * longer than the server's own time limit, so the server's answer can arrive first.
 */
export const SAFETY_NET_MS = {
  default: 30_000,
  /** Used until we know the AI engine's timeout: 90 seconds plus 5. */
  import: 95_000,
  upload: 120_000,
} as const;

/** Extra time on top of the engine's timeout, so the server's answer arrives first. */
const IMPORT_SLACK_MS = 5_000;

let importNetMs: number = SAFETY_NET_MS.import;

/**
 * Sets the import time limit from the AI engines' timeouts (AD-43): the longest
 * `timeout_s` from `GET /api/imports/providers`, plus 5 seconds. Until then, the
 * default above is used.
 */
export function setImportTimeouts(timeoutsSeconds: readonly number[]) {
  importNetMs =
    timeoutsSeconds.length > 0
      ? Math.max(...timeoutsSeconds) * 1000 + IMPORT_SLACK_MS
      : SAFETY_NET_MS.import;
}

/** How long an import may go without any event before the client gives up (AD-43). */
export function importSafetyNetMs(): number {
  return importNetMs;
}

/** Returns the time limit for a request path. */
export function safetyNetMs(pathname: string): number {
  // Only the imports are slow. Listing the engines is a regular request.
  if (
    pathname.startsWith('/api/imports/') &&
    pathname !== '/api/imports/providers'
  ) {
    return importNetMs;
  }
  if (pathname === '/api/photos') return SAFETY_NET_MS.upload;
  return SAFETY_NET_MS.default;
}

function timeoutResponse(code: string, detail: string): Response {
  return new Response(JSON.stringify({ detail, code }), {
    status: 504,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * `fetch` with a time limit (AD-43). If the time runs out, it returns a 504 with an
 * API error body, so the app handles it like any other error (`errors.<code>`).
 */
export async function fetchWithSafetyNet(
  input: Request | string | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init);
  const { pathname } = new URL(request.url, globalThis.location.origin);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, safetyNetMs(pathname));
  request.signal.addEventListener('abort', () => controller.abort(), {
    once: true,
  });
  try {
    return await globalThis.fetch(
      new Request(request, { signal: controller.signal }),
    );
  } catch (error) {
    if (!timedOut) throw error;
    // An import saves nothing, so it counts as a read.
    const isWrite =
      request.method !== 'GET' && !pathname.startsWith('/api/imports/');
    // The server may have finished the write, so tell the app to reload the data.
    if (isWrite) globalThis.dispatchEvent(new Event(OUTCOME_UNKNOWN_EVENT));
    // A read can simply be tried again. For a write we do not know what happened.
    return isWrite
      ? timeoutResponse(
          'outcome_unknown',
          'The outcome of the request is unknown',
        )
      : timeoutResponse('request_timeout', 'The request took too long');
  } finally {
    clearTimeout(timer);
  }
}

let configured = false;

/**
 * Sets up the generated API client (AD-19): send cookies to the same origin, add the
 * CSRF header to every non-GET request, and handle 401 in one place (AD-21).
 * Calling it more than once is safe.
 */
export function configureClient() {
  if (configured) return;
  configured = true;
  client.setConfig({ credentials: 'same-origin', fetch: fetchWithSafetyNet });
  client.interceptors.request.use((request) => {
    if (request.method !== 'GET') {
      request.headers.set(CSRF_HEADER, CSRF_VALUE);
    }
    return request;
  });
  // A 401 means "log in again". `/auth/session` always returns 200, and a wrong
  // login returns 400, so only requests that need a login can return 401.
  client.interceptors.response.use((response, request) => {
    if (
      response.status === 401 &&
      new URL(request.url, globalThis.location.origin).pathname !== LOGIN_PATH
    ) {
      globalThis.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return response;
  });
}
