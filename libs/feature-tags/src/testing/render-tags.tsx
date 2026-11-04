import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { TagRead } from '@bite-and-board/data-access';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider } from '@bite-and-board/ui-components';
import { Component as TagsPage } from '../routes/tags';
import { server } from './server';

initI18n();

/** Serves GET /api/tags with these tags. */
export function serveTags(tags: TagRead[]) {
  server.use(http.get('*/api/tags', () => HttpResponse.json(tags)));
}

export function renderTags() {
  const router = createMemoryRouter(
    [
      { path: '/tags', element: <TagsPage /> },
      { path: '/', element: <p>home</p> },
    ],
    { initialEntries: ['/tags'] },
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
