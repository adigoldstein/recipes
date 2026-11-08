import { render, screen } from '@testing-library/react';
import { focusManager } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import {
  client,
  invalidationMap,
  type SessionUser,
} from '@bite-and-board/data-access';
import { AppProviders, createAppQueryClient } from './app-providers';
import { createRoutes } from './router';

const EDITOR: SessionUser = {
  id: 'u1',
  email: 'dana@example.com',
  name: 'Dana',
  role: 'editor',
};

// The first import of a lazy page transforms its whole module graph.
const LAZY_TIMEOUT = 30_000;

let tagRequests = 0;
const server = setupServer(
  http.get('*/api/auth/session', () => HttpResponse.json({ user: EDITOR })),
  http.get('*/api/recipes', () => HttpResponse.json([])),
  http.get('*/api/tags', () => {
    tagRequests += 1;
    return HttpResponse.json([]);
  }),
  http.get('*/api/imports/providers', () => HttpResponse.json([])),
);

beforeAll(() => {
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  tagRequests = 0;
});
afterAll(() => server.close());

// Story 7.3: server data loads once, and only an edit in this app refreshes it.
describe('the tag list cache', () => {
  it(
    'fetches tags once across several screens and a window refocus, and again after an edit',
    async () => {
      const queryClient = createAppQueryClient();
      const router = createMemoryRouter(createRoutes(queryClient), {
        initialEntries: ['/'],
      });
      render(
        <AppProviders queryClient={queryClient}>
          <RouterProvider router={router} />
        </AppProviders>,
      );
      await screen.findByRole(
        'heading',
        { level: 1, name: 'מתכונים' },
        { timeout: LAZY_TIMEOUT },
      );

      await router.navigate('/tags');
      await screen.findByRole(
        'heading',
        { level: 1, name: 'תגיות' },
        { timeout: LAZY_TIMEOUT },
      );
      await router.navigate('/recipes/new');
      await screen.findByRole(
        'heading',
        { level: 1, name: 'מתכון חדש' },
        { timeout: LAZY_TIMEOUT },
      );
      await router.navigate('/');
      await screen.findByRole('heading', { level: 1, name: 'מתכונים' });
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      focusManager.setFocused(undefined);

      expect(tagRequests).toBe(1);

      await invalidationMap.tagWrite(queryClient);
      expect(tagRequests).toBe(2);
    },
    4 * LAZY_TIMEOUT,
  );

  it('keeps all server data fresh until a write invalidates it', () => {
    expect(createAppQueryClient().getDefaultOptions().queries?.staleTime).toBe(
      Infinity,
    );
  });
});
