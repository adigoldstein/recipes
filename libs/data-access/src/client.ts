import { client } from './generated/client.gen';

export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_VALUE = 'bite-and-board';

/**
 * Fired on `window` when a call that needs a session gets a 401 (AD-21). The app
 * shell listens for it and sends the user to `/login`. An event keeps this lib free
 * of the router, and keeps the shell from importing the API client (AD-11).
 */
export const SESSION_EXPIRED_EVENT = 'bite-and-board:session-expired';

// A login attempt is never an expired session: the login screen shows its own errors.
const LOGIN_PATH = '/api/auth/login';

/**
 * Fired on `window` when a write ran past the client's time limit (AD-43). The server
 * may still have finished it, so the app shell refetches everything from the server.
 */
export const OUTCOME_UNKNOWN_EVENT = 'bite-and-board:outcome-unknown';

/**
 * How long the client waits before it gives up on a call (AD-43). Always longer than
 * the server's own deadline for the same call, so a definite answer can arrive first.
 */
export const SAFETY_NET_MS = {
  default: 30_000,
  /** The slowest LLM provider's 90 s, plus 5 s. */
  import: 95_000,
  upload: 120_000,
} as const;

/** The safety net for a path. */
export function safetyNetMs(pathname: string): number {
  if (pathname.startsWith('/api/imports/')) return SAFETY_NET_MS.import;
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
 * `fetch` with the safety net (AD-43). Past the limit it answers 504 with an API-shaped
 * body, so the rest of the app reads it like any other error (`errors.<code>`):
 * `request_timeout` for a read or an import, which can simply be tried again, and
 * `outcome_unknown` for a write, which the server may have completed. A write also
 * fires `OUTCOME_UNKNOWN_EVENT`.
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
    if (isWrite) globalThis.dispatchEvent(new Event(OUTCOME_UNKNOWN_EVENT));
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
 * Configures the one generated client (AD-19): same-origin cookies, the CSRF
 * header on every non-GET request, and the single 401 interceptor (AD-21).
 * Safe to call more than once.
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
  // Only calls that require a session ever answer 401: `/auth/session` is public
  // (always 200) and a bad login is a 400, so any other 401 means "sign in again".
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
