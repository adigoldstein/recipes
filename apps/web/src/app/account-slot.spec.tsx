import { render, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { client } from '@bite-and-board/data-access';
import { AppProviders, createAppQueryClient } from './app-providers';
import { createRoutes } from './router';

const server = setupServer(
  http.get('*/api/recipes', () => HttpResponse.json([])),
  http.get('*/api/tags', () => HttpResponse.json([])),
);

beforeAll(() => {
  // Node's fetch rejects the client's relative `/api` URLs.
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderApp(path: string) {
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

describe('the top bar account slot', () => {
  it('offers "כניסה" to a visitor', async () => {
    server.use(
      http.get('*/api/auth/session', () => HttpResponse.json({ user: null })),
    );
    renderApp('/');
    const banner = await screen.findByRole('banner');
    expect(
      await within(banner).findByRole('link', { name: 'כניסה' }),
    ).toBeTruthy();
  });

  it('shows the name of a signed-in user', async () => {
    server.use(
      http.get('*/api/auth/session', () =>
        HttpResponse.json({
          user: { id: 'u1', email: 'a@b.co', name: 'Adi', role: 'editor' },
        }),
      ),
    );
    renderApp('/');
    const banner = await screen.findByRole('banner');
    expect(
      await within(banner).findByRole('button', { name: 'Adi' }),
    ).toBeTruthy();
  });

  it('renders the lazy login page at /login', async () => {
    server.use(
      http.get('*/api/auth/session', () => HttpResponse.json({ user: null })),
    );
    renderApp('/login');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'כניסה' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('אימייל')).toBeTruthy();
    // The page has its own sign-in form, so the bar does not offer a second way in.
    expect(
      within(await screen.findByRole('banner')).queryByRole('link', {
        name: 'כניסה',
      }),
    ).toBeNull();
  });
});
