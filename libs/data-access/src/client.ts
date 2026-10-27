import { client } from './generated/client.gen';

export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_VALUE = 'bite-and-board';

let configured = false;

/**
 * Configures the one generated client (AD-19): same-origin cookies, and the
 * CSRF header on every non-GET request. Safe to call more than once.
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
}
