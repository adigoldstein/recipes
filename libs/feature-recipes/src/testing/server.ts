import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

/**
 * A fake API for the component tests. Each test file adds its own handlers.
 * By default the user is a visitor. `serveSession` logs someone in.
 */
export const server = setupServer(
  http.get('*/api/auth/session', () => HttpResponse.json({ user: null })),
  // The recipe form loads the tag list. A test that needs tags adds its own.
  http.get('*/api/tags', () => HttpResponse.json([])),
  // The photo limits, for the photo field.
  http.get('*/api/photos/limits', () =>
    HttpResponse.json({
      max_bytes: 10 * 1024 * 1024,
      content_types: ['image/jpeg', 'image/png', 'image/webp'],
    }),
  ),
);

/** Makes GET /api/auth/session return a logged-in user with this role. */
export function serveSession(role: 'editor' | 'admin' = 'editor') {
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        user: { id: 'u1', email: 'dana@example.com', name: 'Dana', role },
      }),
    ),
  );
}
