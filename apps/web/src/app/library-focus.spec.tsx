import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { client } from '@bite-and-board/data-access';
import { AppProviders } from './app-providers';
import { routes } from './router';

const server = setupServer(
  http.get('*/api/recipes', () =>
    HttpResponse.json([
      {
        id: 'r1',
        title: 'שקשוקה',
        tags: [],
        total_minutes: 25,
        photo: null,
        created_at: '2026-10-27T12:00:00Z',
      },
    ]),
  ),
  http.get('*/api/tags', () => HttpResponse.json([])),
);

beforeAll(() => {
  // Node's fetch rejects the client's relative `/api` URLs.
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// The library keeps its filters in the URL, so each keystroke is a navigation.
// The shell must not treat that as a new page and pull focus away.
describe('the library inside the app shell', () => {
  it('keeps focus in the search field while typing', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    const search = await screen.findByRole('searchbox');
    await screen.findByRole('list');

    await userEvent.type(search, 'שקש');

    expect(search).toHaveProperty('value', 'שקש');
    expect(document.activeElement).toBe(search);
    expect(router.state.location.search).toBe(
      `?q=${encodeURIComponent('שקש')}`,
    );
  });

  it('still moves focus to the heading when the page changes', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/nope'] });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    await userEvent.click(
      await screen.findByRole('link', { name: 'חזרה לרשימה' }),
    );
    const heading = await screen.findByRole('heading', { name: 'מתכונים' });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
  });
});
