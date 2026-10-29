import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { client, type SessionUser } from '@bite-and-board/data-access';
import { AppProviders, createAppQueryClient } from './app-providers';
import { createRoutes } from './router';

const EDITOR: SessionUser = {
  id: 'u1',
  email: 'dana@example.com',
  name: 'Dana',
  role: 'editor',
};

// The first import of a lazy page transforms its whole module graph, which can take
// a while when the machine is busy running every other project's tests.
const LAZY_TIMEOUT = 30_000;

let sessionUser: SessionUser | null = null;
const server = setupServer(
  http.get('*/api/auth/session', () =>
    HttpResponse.json({ user: sessionUser }),
  ),
  http.get('*/api/recipes', () => HttpResponse.json([])),
  http.get('*/api/tags', () => HttpResponse.json([])),
  http.get('*/api/recipes/r1', () =>
    HttpResponse.json({
      id: 'r1',
      title: 'פנקייק',
      description: null,
      notes: null,
      tags: [],
      base_servings: 4,
      prep_time_minutes: null,
      cook_time_minutes: null,
      source_url: null,
      photo: null,
      ingredients: [
        {
          id: 'i1',
          name: 'קמח',
          amount: 2,
          unit: 'cup',
          note: null,
          original: null,
          source: null,
        },
      ],
      steps: [{ id: 's1', description: 'מערבבים', source_text: null }],
      created_at: '2026-10-28T12:00:00Z',
      updated_at: '2026-10-28T12:00:00Z',
    }),
  ),
);

beforeAll(() => {
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  sessionUser = null;
});
afterAll(() => server.close());

function renderAt(path: string) {
  const queryClient = createAppQueryClient();
  const router = createMemoryRouter(createRoutes(queryClient), {
    initialEntries: [path],
  });
  render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('/recipes/:id/edit', () => {
  it(
    'shows the filled form to an editor',
    async () => {
      sessionUser = EDITOR;
      renderAt('/recipes/r1/edit');
      expect(
        await screen.findByRole(
          'heading',
          { level: 1, name: 'עריכת מתכון' },
          { timeout: LAZY_TIMEOUT },
        ),
      ).toBeTruthy();
      expect(await screen.findByDisplayValue('פנקייק')).toBeTruthy();
    },
    2 * LAZY_TIMEOUT,
  );

  it('sends a visitor to the login page, remembering the edit page', async () => {
    const router = renderAt('/recipes/r1/edit');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Frecipes%2Fr1%2Fedit');
  });
});
