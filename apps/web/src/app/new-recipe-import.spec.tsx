import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { client, type SessionUser } from '@bite-and-board/data-access';
import { AppProviders, createAppQueryClient } from './app-providers';
import { createRoutes } from './router';

const EDITOR: SessionUser = {
  id: 'u1',
  email: 'dana@example.com',
  name: 'Dana',
  role: 'editor',
};

// The first import of a lazy page transforms its whole module graph, which can take
// a while when the machine is busy running every other project's tests.
const LAZY_TIMEOUT = 30_000;

const server = setupServer(
  http.get('*/api/auth/session', () => HttpResponse.json({ user: EDITOR })),
  http.get('*/api/recipes', () => HttpResponse.json([])),
  http.get('*/api/tags', () => HttpResponse.json([])),
);

beforeAll(() => {
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderNewRecipe() {
  const queryClient = createAppQueryClient();
  const router = createMemoryRouter(createRoutes(queryClient), {
    initialEntries: ['/recipes/new'],
  });
  render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('/recipes/new with the AI import', () => {
  it(
    'imports pasted text into the form on the same page',
    async () => {
      server.use(
        http.post('*/api/imports/text', () =>
          HttpResponse.json({
            title: 'לחם בית',
            ingredients: [{ name: 'קמח', amount: 455, unit: 'g' }],
            steps: [{ description: 'אופים ב-175°C.' }],
            tags: [],
            new_tags: [],
            missing_fields: ['base_servings'],
          }),
        ),
      );
      const user = userEvent.setup();
      renderNewRecipe();
      await user.click(
        await screen.findByRole(
          'button',
          { name: 'ייבוא עם בינה מלאכותית' },
          { timeout: LAZY_TIMEOUT },
        ),
      );
      await user.type(
        screen.getByRole('textbox', { name: /^טקסט המתכון/ }),
        'לחם: 1 ליברה קמח',
      );
      await user.click(screen.getByRole('button', { name: 'יצירת טיוטה' }));
      expect(
        await screen.findByText(/^המתכון יובא/, undefined, {
          timeout: LAZY_TIMEOUT,
        }),
      ).toBeTruthy();
      // The same page, filled in: no navigation happened.
      expect(screen.getByLabelText(/^שם המתכון( \*)?$/)).toHaveProperty(
        'value',
        'לחם בית',
      );
      expect(screen.getByLabelText('שלב 1')).toHaveProperty(
        'value',
        'אופים ב-175°C.',
      );
    },
    2 * LAZY_TIMEOUT,
  );
});
