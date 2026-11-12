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

let configured = false;

/**
 * Sets up the generated API client (AD-19): send cookies to the same origin, add the
 * CSRF header to every non-GET request, and handle 401 in one place (AD-21).
 * Calling it more than once is safe.
 */
export function configureClient() {
  if (configured) return;
  configured = true;
  client.setConfig({ credentials: 'same-origin' });
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
