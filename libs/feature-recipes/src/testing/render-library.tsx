import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { RecipeSummary, TagRead } from '@bite-and-board/data-access';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider } from '@bite-and-board/ui-components';
import { Component as LibraryPage } from '../routes/library';
import { server } from './server';

initI18n();

export function recipe(
  id: string,
  title: string,
  overrides: Partial<RecipeSummary> = {},
): RecipeSummary {
  return {
    id,
    title,
    tags: [],
    total_minutes: null,
    photo: null,
    created_at: '2026-10-27T12:00:00Z',
    ...overrides,
  };
}

/** Returns these recipes from GET /api/recipes (newest first, like the API). */
export function serveRecipes(recipes: RecipeSummary[]) {
  server.use(http.get('*/api/recipes', () => HttpResponse.json(recipes)));
}

/** Returns these tags from GET /api/tags (pinned first, like the API). */
export function serveTags(tags: TagRead[]) {
  server.use(http.get('*/api/tags', () => HttpResponse.json(tags)));
}

/**
 * Renders the library at `path`, with a fake recipe route to navigate to.
 * `tags` are served, unless it is null (then the test adds its own handler).
 */
export function renderLibrary(path = '/', tags: TagRead[] | null = []) {
  if (tags) serveTags(tags);
  const router = createMemoryRouter(
    [
      { path: '/', Component: LibraryPage },
      { path: '/recipes/:id', element: <p>recipe detail stub</p> },
    ],
    { initialEntries: [path] },
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
  return router;
}
