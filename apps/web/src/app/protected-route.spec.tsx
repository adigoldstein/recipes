import { act, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import {
  authSessionQueryKey,
  client,
  SESSION_EXPIRED_EVENT as DATA_ACCESS_EVENT,
  useCan,
  type SessionUser,
} from '@bite-and-board/data-access';
import { AppLayout } from './app-layout';
import { AppProviders, createAppQueryClient } from './app-providers';
import { NotFound } from './not-found';
import { protectedRoute } from './protected-route';
import { SESSION_EXPIRED_EVENT } from './use-session-expiry';

const EDITOR: SessionUser = {
  id: 'u1',
  email: 'ed@example.com',
  name: 'Ed',
  role: 'editor',
};
const ADMIN: SessionUser = { ...EDITOR, name: 'Boss', role: 'admin' };

// What `GET /api/auth/session` answers; a blocked user is a visitor to it.
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

// A page whose controls depend on the role: absent, not disabled.
function Area({ title }: { title: string }) {
  const canEdit = useCan('editor');
  const canManage = useCan('admin');
  return (
    <>
      <h1>{title}</h1>
      {canEdit ? <button>עריכה</button> : null}
      {canManage ? <button>ניהול</button> : null}
    </>
  );
}

// Stands in for a real protected call, such as saving a recipe.
function SaveButton() {
  return (
    <button onClick={() => void client.post({ url: '/api/recipes' })}>
      שמירה
    </button>
  );
}

function renderTestApp(path: string) {
  const queryClient = createAppQueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: AppLayout,
        HydrateFallback: () => null,
        children: [
          protectedRoute(queryClient, undefined, [
            {
              path: 'area',
              element: (
                <>
                  <Area title="אזור מוגן" />
                  <SaveButton />
                </>
              ),
            },
          ]),
          protectedRoute(queryClient, 'admin', [
            { path: 'admin-area', element: <Area title="אזור מנהל" /> },
          ]),
          {
            path: 'login',
            lazy: () => import('@bite-and-board/feature-auth/login'),
          },
          { path: '*', Component: NotFound },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, queryClient };
}

describe('protected routes', () => {
  it('sends a visitor to /login with the page they wanted', async () => {
    const { router } = renderTestApp('/area?tab=1');
    await screen.findByRole('heading', { level: 1, name: 'כניסה' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      `?next=${encodeURIComponent('/area?tab=1')}`,
    );
  });

  it('shows an editor the signed-in page with editor controls only', async () => {
    sessionUser = EDITOR;
    renderTestApp('/area');
    await screen.findByRole('heading', { name: 'אזור מוגן' });
    expect(await screen.findByRole('button', { name: 'עריכה' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'ניהול' })).toBeNull();
  });

  it('shows an admin every control', async () => {
    sessionUser = ADMIN;
    renderTestApp('/area');
    expect(await screen.findByRole('button', { name: 'עריכה' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'ניהול' })).toBeTruthy();
  });

  it('lets an admin into the admin-only area', async () => {
    sessionUser = ADMIN;
    renderTestApp('/admin-area');
    expect(
      await screen.findByRole('heading', { name: 'אזור מנהל' }),
    ).toBeTruthy();
  });

  it('shows an editor the not-found page, inside the shell, for an admin-only area', async () => {
    sessionUser = EDITOR;
    renderTestApp('/admin-area');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'הדף לא נמצא' }),
    ).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'אזור מנהל' })).toBeNull();
  });

  it('treats a blocked user, whom the session reports as nobody, as a visitor', async () => {
    sessionUser = null; // the server answers `user: null` for a blocked account
    const { router } = renderTestApp('/admin-area');
    await screen.findByRole('heading', { level: 1, name: 'כניסה' });
    expect(router.state.location.pathname).toBe('/login');
  });
});

describe('an expired session', () => {
  it('uses the same event name as data-access', () => {
    expect(SESSION_EXPIRED_EVENT).toBe(DATA_ACCESS_EVENT);
  });

  it('goes to /login?next=… with a message, without leaving the app', async () => {
    sessionUser = EDITOR;
    // The server has blocked the account since the page loaded.
    server.use(
      http.post('*/api/recipes', () =>
        HttpResponse.json(
          { detail: 'Sign in required', code: 'unauthorized' },
          { status: 401 },
        ),
      ),
    );
    const { router, queryClient } = renderTestApp('/area');
    // What the cache says about the user when the router first reaches /login.
    let seenAtLogin: unknown = 'not reached';
    router.subscribe((state) => {
      if (
        state.location.pathname === '/login' &&
        seenAtLogin === 'not reached'
      ) {
        seenAtLogin = queryClient.getQueryData<{ user: unknown }>(
          authSessionQueryKey(),
        )?.user;
      }
    });
    const save = await screen.findByRole('button', { name: 'שמירה' });
    sessionUser = null;
    await act(async () => save.click());

    await screen.findByRole('heading', { level: 1, name: 'כניסה' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      `?next=${encodeURIComponent('/area')}`,
    );
    // The login page sends a signed-in user straight on, so the cache must already
    // say "visitor" when it appears, or it would bounce back to the page.
    expect(seenAtLogin).toBeNull();
    expect(await screen.findByText('פג תוקף החיבור')).toBeTruthy();
    // The shell now shows a visitor.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Ed' })).toBeNull(),
    );
  });

  it('counts several 401s at once as one trip to /login', async () => {
    sessionUser = EDITOR;
    server.use(
      http.post('*/api/recipes', () =>
        HttpResponse.json(
          { detail: 'Sign in required', code: 'unauthorized' },
          { status: 401 },
        ),
      ),
    );
    renderTestApp('/area');
    const save = await screen.findByRole('button', { name: 'שמירה' });
    sessionUser = null;
    await act(async () => {
      save.click();
      save.click();
    });
    await screen.findByRole('heading', { level: 1, name: 'כניסה' });
    await screen.findByText('פג תוקף החיבור');
    expect(document.querySelectorAll('[data-title]')).toHaveLength(1);
  });
});
