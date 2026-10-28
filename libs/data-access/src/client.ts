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

let configured = false;

/**
 * Configures the one generated client (AD-19): same-origin cookies, the CSRF
 * header on every non-GET request, and the single 401 interceptor (AD-21).
 * Safe to call more than once.
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
