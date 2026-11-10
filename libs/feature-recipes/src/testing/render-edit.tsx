import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider, Toaster } from '@bite-and-board/ui-components';
import { Component as RecipeEditPage } from '../routes/recipe-edit';

initI18n();

/**
 * Renders the edit page at `/recipes/:id/edit`, with fake routes for the recipe page.
 * By default the user comes from the recipe page. `direct` opens it with no history.
 */
export function renderEdit(id: string, { direct = false } = {}) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>library stub</p> },
      { path: '/recipes/:id', element: <p>recipe page stub</p> },
      { path: '/recipes/:id/edit', Component: RecipeEditPage },
    ],
    {
      initialEntries: direct
        ? [`/recipes/${id}/edit`]
        : [`/recipes/${id}`, `/recipes/${id}/edit`],
      initialIndex: direct ? 0 : 1,
    },
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <DirectionProvider dir="rtl">
        <RouterProvider router={router} />
        <Toaster />
      </DirectionProvider>
    </QueryClientProvider>,
  );
  return { router, queryClient };
}
