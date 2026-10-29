import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider, Toaster } from '@bite-and-board/ui-components';
import { Component as RecipeEditPage } from '../routes/recipe-edit';

initI18n();

/** Renders the edit form at `/recipes/:id/edit`, with stub routes for the recipe page. */
export function renderEdit(id: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>library stub</p> },
      { path: '/recipes/:id', element: <p>recipe page stub</p> },
      { path: '/recipes/:id/edit', Component: RecipeEditPage },
    ],
    {
      initialEntries: [`/recipes/${id}`, `/recipes/${id}/edit`],
      initialIndex: 1,
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
