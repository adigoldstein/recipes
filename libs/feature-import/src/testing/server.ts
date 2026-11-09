import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

/**
 * A fake API for the component tests. Each test file adds its own handlers. The panel
 * always asks which engine is active, so that answer is included here.
 */
export const server = setupServer(
  http.get('*/api/imports/providers', () =>
    HttpResponse.json([{ name: 'fake', timeout_s: 30 }]),
  ),
);
