import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

/**
 * The API stand-in for component tests; each spec adds its own handlers.
 * The default session is a visitor's; `serveSession` signs someone in.
 */
export const server = setupServer(
  http.get('*/api/auth/session', () => HttpResponse.json({ user: null })),
  // The recipe form reads the tag list; a spec that needs tags serves its own.
  http.get('*/api/tags', () => HttpResponse.json([])),
  // ... and the photo limits, for the photo field.
  http.get('*/api/photos/limits', () =>
    HttpResponse.json({
      max_bytes: 10 * 1024 * 1024,
      content_types: ['image/jpeg', 'image/png', 'image/webp'],
    }),
  ),
);

/** Serves GET /api/auth/session as a signed-in user of this role. */
export function serveSession(role: 'editor' | 'admin' = 'editor') {
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        user: { id: 'u1', email: 'dana@example.com', name: 'Dana', role },
      }),
    ),
  );
}
