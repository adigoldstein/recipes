import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import {
  recipesGetRecipeQueryKey,
  recipesListRecipesQueryKey,
  type RecipeRead,
} from '@bite-and-board/data-access';
import { toast } from '@bite-and-board/ui-components';
import { renderDetail } from '../testing/render-detail';
import { server, serveSession } from '../testing/server';

const RECIPE: RecipeRead = {
  id: 'r1',
  title: "עוגת ג'ינג'ר",
  description: null,
  notes: null,
  tags: [],
  base_servings: 4,
  prep_time_minutes: null,
  cook_time_minutes: null,
  source_url: null,
  photo: null,
  ingredients: [
    {
      id: 'i1',
      name: 'קמח',
      amount: 2,
      unit: 'cup',
      note: null,
      original: null,
      source: null,
    },
  ],
  steps: [{ id: 's1', description: 'אופים', source_text: null }],
  created_at: '2026-10-28T12:00:00Z',
  updated_at: '2026-10-28T12:00:00Z',
};

/** Serves the recipe and answers DELETE with this status; returns the calls made. */
function serveDelete(status = 204, body?: object) {
  const calls: string[] = [];
  server.use(
    http.get('*/api/recipes/:id', () => HttpResponse.json(RECIPE)),
    http.delete('*/api/recipes/:id', ({ params }) => {
      calls.push(String(params['id']));
      return status === 204
        ? new HttpResponse(null, { status })
        : HttpResponse.json(body, { status });
    }),
  );
  return calls;
}

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByRole('heading', { level: 1, name: RECIPE.title });
  // The session answers after the recipe, so the button can arrive a moment later.
  await user.click(await screen.findByRole('button', { name: 'מחיקה' }));
  return screen.findByRole('alertdialog');
};

describe('deleting a recipe', () => {
  beforeEach(() => serveSession('editor'));
  afterEach(() => toast.dismiss());

  it('is offered to an editor only', async () => {
    server.use(
      http.get('*/api/auth/session', () => HttpResponse.json({ user: null })),
      http.get('*/api/recipes/:id', () => HttpResponse.json(RECIPE)),
    );
    renderDetail('r1');
    await screen.findByRole('heading', { level: 1, name: RECIPE.title });
    expect(screen.queryByRole('button', { name: 'מחיקה' })).toBeNull();
  });

  it('asks first, names the recipe and starts on "ביטול"', async () => {
    const user = userEvent.setup();
    serveDelete();
    renderDetail('r1');
    const dialog = await openDialog(user);
    expect(dialog.textContent).toContain('למחוק את המתכון?');
    expect(dialog.textContent).toContain(
      "המתכון 'עוגת ג'ינג'ר' יימחק לצמיתות.",
    );
    expect(document.activeElement?.textContent).toBe('ביטול');
  });

  it('changes nothing on "ביטול"', async () => {
    const user = userEvent.setup();
    const calls = serveDelete();
    const { router } = renderDetail('r1', '/');
    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'ביטול' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls).toEqual([]);
    expect(router.state.location.pathname).toBe('/recipes/r1');
  });

  it('deletes, goes back to the library with its filters and refreshes the list', async () => {
    const user = userEvent.setup();
    const calls = serveDelete();
    const { router, queryClient } = renderDetail('r1', '/?tag=dinner');
    queryClient.setQueryData(recipesListRecipesQueryKey(), []);
    queryClient.setQueryData(
      recipesGetRecipeQueryKey({ path: { recipe_id: 'r1' } }),
      RECIPE,
    );
    await openDialog(user);
    await user.click(
      screen.getByRole('button', { name: 'מחיקה', hidden: false }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(router.state.location.search).toBe('?tag=dinner');
    expect(calls).toEqual(['r1']);
    expect(await screen.findByText('המתכון נמחק')).toBeTruthy();
    await waitFor(() =>
      expect(
        queryClient.getQueryData(
          recipesGetRecipeQueryKey({ path: { recipe_id: 'r1' } }),
        ),
      ).toBeUndefined(),
    );
    expect(
      queryClient.getQueryState(recipesListRecipesQueryKey())?.isInvalidated,
    ).toBe(true);
  });

  it('goes to the library when the page was opened directly', async () => {
    const user = userEvent.setup();
    serveDelete();
    const { router } = renderDetail('r1');
    await openDialog(user);
    await user.click(
      screen.getByRole('button', { name: 'מחיקה', hidden: false }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('treats a recipe that is already gone as deleted, with its own message', async () => {
    const user = userEvent.setup();
    serveDelete(404, { detail: 'Recipe not found', code: 'recipe_not_found' });
    const { router } = renderDetail('r1', '/');
    await openDialog(user);
    await user.click(
      screen.getByRole('button', { name: 'מחיקה', hidden: false }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByText('המתכון כבר נמחק')).toBeTruthy();
  });

  it('keeps the dialog open and says why when the delete fails', async () => {
    const user = userEvent.setup();
    serveDelete(500, {});
    const { router } = renderDetail('r1', '/');
    const dialog = await openDialog(user);
    await user.click(
      screen.getByRole('button', { name: 'מחיקה', hidden: false }),
    );
    expect(await screen.findByText('משהו השתבש, אפשר לנסות שוב')).toBeTruthy();
    expect(dialog.isConnected).toBe(true);
    expect(router.state.location.pathname).toBe('/recipes/r1');
  });
});
