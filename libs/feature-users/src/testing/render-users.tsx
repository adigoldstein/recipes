import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { UserRead } from '@bite-and-board/data-access';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider } from '@bite-and-board/ui-components';
import { Component as UsersPage } from '../routes/users';
import { server } from './server';

initI18n();

export const ADI: UserRead = {
  id: 'u1',
  email: 'adi@example.com',
  name: 'Adi',
  role: 'admin',
  is_blocked: false,
  created_at: '2026-10-01T08:00:00Z',
};

export const DANA: UserRead = {
  id: 'u2',
  email: 'dana@example.com',
  name: 'Dana',
  role: 'editor',
  is_blocked: true,
  created_at: '2026-10-02T08:00:00Z',
};

/** Serves GET /api/auth/session as this user (the signed-in admin by default). */
export function serveSession(me: UserRead | null = ADI) {
  server.use(
    http.get('*/api/auth/session', () =>
      HttpResponse.json({
        user: me && {
          id: me.id,
          email: me.email,
          name: me.name,
          role: me.role,
        },
      }),
    ),
  );
}

/** Serves GET /api/users with these users. */
export function serveUsers(users: UserRead[]) {
  server.use(http.get('*/api/users', () => HttpResponse.json(users)));
}

export function renderUsers() {
  const router = createMemoryRouter(
    [
      { path: '/users', element: <UsersPage /> },
      { path: '/', element: <p>home</p> },
      { path: '/other', element: <p>other</p> },
    ],
    { initialEntries: ['/users'] },
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <DirectionProvider dir="rtl">
        <RouterProvider router={router} />
      </DirectionProvider>
    </QueryClientProvider>,
  );
  return { router, queryClient };
}
