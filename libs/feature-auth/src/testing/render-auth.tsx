import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { SessionUser } from '@bite-and-board/data-access';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider } from '@bite-and-board/ui-components';
import { server } from './server';

initI18n();

export const ADI: SessionUser = {
  id: 'u1',
  email: 'adi@example.com',
  name: 'Adi',
  role: 'admin',
};

/** Serves GET /api/auth/session: the user, or null for a visitor. */
export function serveSession(user: SessionUser | null) {
  server.use(http.get('*/api/auth/session', () => HttpResponse.json({ user })));
}

/** Renders these routes at `path`, with the providers the app gives them. */
export function renderAt(
  path: string,
  routes: { path: string; element: ReactNode }[],
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
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
