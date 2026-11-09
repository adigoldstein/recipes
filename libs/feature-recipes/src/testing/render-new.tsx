import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider, Toaster } from '@bite-and-board/ui-components';
import { RecipeNewPage, type RecipeNewPageProps } from '../routes/recipe-new';

initI18n();

/**
 * Renders the new recipe page, with fake routes for the library and a saved recipe.
 * `importPanel` fills the page's import slot, like the app does with the AI import.
 */
export function renderNew(
  from?: string,
  importPanel?: RecipeNewPageProps['importPanel'],
) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>library stub</p> },
      {
        path: '/recipes/new',
        element: <RecipeNewPage importPanel={importPanel} />,
      },
      { path: '/recipes/:id', element: <p>recipe page stub</p> },
    ],
    from
      ? { initialEntries: [from, '/recipes/new'], initialIndex: 1 }
      : { initialEntries: ['/recipes/new'] },
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
