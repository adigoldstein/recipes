import { render, screen, waitFor, within } from '@testing-library/react';
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

describe('/recipes/new', () => {
  it(
    'shows the form to an editor',
    async () => {
      sessionUser = EDITOR;
      renderAt('/recipes/new');
      expect(
        await screen.findByRole(
          'heading',
          { level: 1, name: 'מתכון חדש' },
          { timeout: LAZY_TIMEOUT },
        ),
      ).toBeTruthy();
      expect(screen.getByLabelText(/^שם המתכון( \*)?$/)).toBeTruthy();
    },
    2 * LAZY_TIMEOUT,
  );

  it('sends a visitor to the login page, remembering /recipes/new', async () => {
    const router = renderAt('/recipes/new');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Frecipes%2Fnew');
  });
});

describe('the "מתכון חדש" button', () => {
  it(
    'is in the top bar for an editor and opens the form',
    async () => {
      sessionUser = EDITOR;
      const router = renderAt('/');
      // The library's empty state has its own link with this name, so look only in
      // the top bar. The button is a lazy chunk, which a busy machine can take a
      // while to load.
      // Wait until both links are there, so the check always runs in the state where
      // an unscoped query would be ambiguous.
      await waitFor(
        () =>
          expect(
            screen.getAllByRole('link', { name: 'מתכון חדש' }),
          ).toHaveLength(2),
        { timeout: LAZY_TIMEOUT },
      );
      const topBar = screen.getByRole('banner');
      const button = await within(topBar).findByRole(
        'link',
        { name: 'מתכון חדש' },
        { timeout: LAZY_TIMEOUT },
      );
      expect(button.getAttribute('href')).toBe('/recipes/new');
      button.click();
      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/recipes/new'),
      );
    },
    2 * LAZY_TIMEOUT,
  );

  it('is not offered to a visitor', async () => {
    renderAt('/');
    await screen.findByRole('link', { name: 'כניסה' });
    expect(
      within(screen.getByRole('banner')).queryByRole('link', {
        name: 'מתכון חדש',
      }),
    ).toBeNull();
  });
});
