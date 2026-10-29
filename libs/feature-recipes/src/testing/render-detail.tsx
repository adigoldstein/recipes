import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider, Toaster } from '@bite-and-board/ui-components';
import { Component as RecipeDetailPage } from '../routes/recipe-detail';

initI18n();

function LibraryStub() {
  return <p>library stub {useLocation().search}</p>;
}

/**
 * Renders the detail page at `/recipes/:id`, with a stub list route to go back
 * to. With `from`, that library URL is the page before it (in-app history).
 */
export function renderDetail(id: string, from?: string) {
  const router = createMemoryRouter(
    [
      { path: '/', Component: LibraryStub },
      { path: '/recipes/:id', Component: RecipeDetailPage },
    ],
    from
      ? { initialEntries: [from, `/recipes/${id}`], initialIndex: 1 }
      : { initialEntries: [`/recipes/${id}`] },
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <DirectionProvider dir="rtl">
        <RouterProvider router={router} />
        <Toaster />
      </DirectionProvider>
    </QueryClientProvider>,
  );
  return { ...rendered, router, queryClient };
}
