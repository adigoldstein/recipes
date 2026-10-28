import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { client, type SessionUser } from '@bite-and-board/data-access';
import { AppProviders, createAppQueryClient } from './app-providers';
import { createRoutes } from './router';

const ADMIN: SessionUser = {
  id: 'u1',
  email: 'adi@example.com',
  name: 'Adi',
  role: 'admin',
};

let sessionUser: SessionUser | null = null;
const server = setupServer(
  http.get('*/api/auth/session', () =>
    HttpResponse.json({ user: sessionUser }),
  ),
  http.get('*/api/users', () =>
    HttpResponse.json([
      { ...ADMIN, is_blocked: false, created_at: '2026-10-01T08:00:00Z' },
    ]),
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

describe('/users', () => {
  it('shows the Users screen to the admin', async () => {
    sessionUser = ADMIN;
    renderAt('/users');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'משתמשים' }),
    ).toBeTruthy();
    expect(await screen.findByText('adi@example.com')).toBeTruthy();
  });

  it('shows an editor the not-found page, inside the shell', async () => {
    sessionUser = { ...ADMIN, role: 'editor' };
    renderAt('/users');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'הדף לא נמצא' }),
    ).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'משתמשים' })).toBeNull();
  });

  it('sends a visitor to the login page, remembering /users', async () => {
    const router = renderAt('/users');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fusers');
  });
});

describe('/account', () => {
  it('shows the account page to an editor', async () => {
    sessionUser = { ...ADMIN, role: 'editor' };
    renderAt('/account');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'החשבון שלי' }),
    ).toBeTruthy();
  });

  it('sends a visitor to the login page, remembering /account', async () => {
    const router = renderAt('/account');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Faccount');
  });
});
