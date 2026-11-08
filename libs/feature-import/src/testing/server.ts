import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

/**
 * The API stand-in for component tests; each spec adds its own handlers. The panel
 * always asks which engine is active, so that answer is built in.
 */
export const server = setupServer(
  http.get('*/api/imports/providers', () =>
    HttpResponse.json([{ name: 'fake', timeout_s: 30 }]),
  ),
);
