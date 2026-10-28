import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { client } from '@bite-and-board/data-access';
import { AppProviders } from './app-providers';
import { routes } from './router';

const RECIPE = {
  id: 'r1',
  title: 'שקשוקה',
  description: null,
  base_servings: 4,
  prep_time_minutes: 5,
  cook_time_minutes: 20,
  source_url: null,
  notes: null,
  photo: null,
  tags: [],
  ingredients: [
    {
      id: 'i1',
      name: 'עגבניות',
      amount: 4,
      unit: null,
      note: null,
      original: null,
      source: null,
    },
  ],
  steps: [{ id: 's1', description: 'מבשלים', source_text: null }],
  created_at: '2026-10-27T12:00:00Z',
  updated_at: '2026-10-27T12:00:00Z',
};

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
  http.get('*/api/recipes/:id', ({ params }) =>
    params.id === 'r1'
      ? HttpResponse.json(RECIPE)
      : HttpResponse.json(
          { detail: 'nope', code: 'recipe_not_found' },
          { status: 404 },
        ),
  ),
);

beforeAll(() => {
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe('the recipe detail page inside the app shell', () => {
  it('opens from a library card and moves focus to the recipe title', async () => {
    const router = renderApp('/');
    await userEvent.click(await screen.findByRole('link', { name: /שקשוקה/ }));

    const title = await screen.findByRole('heading', {
      level: 1,
      name: 'שקשוקה',
    });
    expect(router.state.location.pathname).toBe('/recipes/r1');
    expect(screen.getAllByRole('banner')[0]).toBeTruthy();
    await vi.waitFor(() => expect(document.activeElement).toBe(title));
    expect(document.title).toBe('שקשוקה · ביס & סיר');
  });

  it('goes back to the filtered library from the back button', async () => {
    const router = renderApp('/?q=%D7%A9%D7%A7');
    await userEvent.click(await screen.findByRole('link', { name: /שקשוקה/ }));
    await userEvent.click(
      await screen.findByRole('link', { name: 'חזרה למתכונים' }),
    );
    expect(await screen.findByRole('searchbox')).toHaveProperty('value', 'שק');
    expect(router.state.location.pathname).toBe('/');
  });

  it('keeps focus on a checkbox while ticking it off', async () => {
    renderApp('/recipes/r1');
    const box = await screen.findByRole('checkbox', { name: '4 עגבניות' });
    await userEvent.click(box);
    expect((box as HTMLInputElement).checked).toBe(true);
    expect(document.activeElement).toBe(box);
  });

  it('shows "not found" inside the shell for an unknown id', async () => {
    renderApp('/recipes/nope');
    expect(await screen.findByText('המתכון לא נמצא')).toBeTruthy();
    expect(screen.getAllByRole('banner')[0]).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'חזרה לרשימה' }).getAttribute('href'),
    ).toBe('/');
  });
});
