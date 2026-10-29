import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import {
  recipesGetRecipeQueryKey,
  recipesListRecipesQueryKey,
  type RecipeRead,
} from '@bite-and-board/data-access';
import { toast } from '@bite-and-board/ui-components';
import { renderEdit } from '../testing/render-edit';
import { server } from '../testing/server';

// Real UUIDs: the write schema rejects any other id.
const TAG = '5d0f7f6e-1d6c-4a52-9a0c-0b1c3f5e0a01';
const ING1 = '5d0f7f6e-1d6c-4a52-9a0c-0b1c3f5e0b01';
const ING2 = '5d0f7f6e-1d6c-4a52-9a0c-0b1c3f5e0b02';
const ING3 = '5d0f7f6e-1d6c-4a52-9a0c-0b1c3f5e0b03';

const SAVED: RecipeRead = {
  id: 'r1',
  title: 'פנקייק',
  description: null,
  notes: null,
  tags: [{ id: TAG, name: 'בוקר' }],
  base_servings: 4,
  prep_time_minutes: 10,
  cook_time_minutes: null,
  source_url: null,
  photo: null,
  ingredients: [
    {
      id: ING1,
      name: 'כמון',
      amount: 2,
      unit: 'tsp',
      note: null,
      original: { amount: 1, unit: 'tsp' },
      source: null,
    },
    {
      id: ING2,
      name: 'מלח',
      amount: 1,
      unit: 'tsp',
      note: null,
      original: { amount: null, unit: null },
      source: null,
    },
    {
      id: ING3,
      name: 'קמח',
      amount: 1,
      unit: 'cup',
      note: 'מנופה',
      original: null,
      source: null,
    },
  ],
  steps: [{ id: 's1', description: 'מערבבים', source_text: null }],
  created_at: '2026-10-28T12:00:00Z',
  updated_at: '2026-10-28T12:00:00Z',
};

function serveRecipe(recipe: RecipeRead = SAVED) {
  server.use(http.get('*/api/recipes/:id', () => HttpResponse.json(recipe)));
}

/** Answers PUT /api/recipes/r1 with the recipe and returns what the page sent. */
function serveUpdate() {
  const sent: unknown[] = [];
  server.use(
    http.put('*/api/recipes/:id', async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json({ ...SAVED, title: 'פנקייק מושלם' });
    }),
  );
  return sent;
}

const field = (name: string) =>
  screen.getByLabelText(new RegExp(String.raw`^${name}( \*)?$`));

describe('RecipeEditPage', () => {
  afterEach(() => {
    toast.dismiss();
  });

  it('opens the form filled with the saved recipe', async () => {
    serveRecipe();
    renderEdit('r1');
    expect(await screen.findByDisplayValue('פנקייק')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'עריכת מתכון',
    );
    expect(
      screen.getByRole('link', { name: 'חזרה למתכון' }).getAttribute('href'),
    ).toBe('/recipes/r1');
    expect(field('מספר מנות')).toHaveProperty('value', '4');
    expect(field('שם המצרך 1')).toHaveProperty('value', 'כמון');
    expect(field('כמות, מצרך 1')).toHaveProperty('value', '2');
    expect(field('שלב 1')).toHaveProperty('value', 'מערבבים');
    expect(screen.getByText('בוקר')).toBeTruthy();
  });

  it('shows the original under hinted ingredients and links it to the fields', async () => {
    serveRecipe();
    renderEdit('r1');
    await screen.findByDisplayValue('פנקייק');
    const hint = screen.getByText('במקור 1 כפית');
    expect(hint.className).toContain('text-hint');
    expect(field('כמות, מצרך 1').getAttribute('aria-describedby')).toContain(
      hint.id,
    );
    expect(field('שם המצרך 1').getAttribute('aria-describedby')).toContain(
      hint.id,
    );
    const toTaste = screen.getByText('במקור: לפי הטעם');
    expect(field('שם המצרך 2').getAttribute('aria-describedby')).toContain(
      toTaste.id,
    );
    expect(field('שם המצרך 3').getAttribute('aria-describedby')).toBeNull();
  });

  it('sends the whole recipe with ingredient ids and no originals, then opens it', async () => {
    const user = userEvent.setup();
    serveRecipe();
    const sent = serveUpdate();
    const { router, queryClient } = renderEdit('r1');
    queryClient.setQueryData(recipesListRecipesQueryKey(), []);
    await screen.findByDisplayValue('פנקייק');

    await user.clear(field('שם המתכון'));
    await user.type(field('שם המתכון'), 'פנקייק מושלם');
    await user.clear(field('כמות, מצרך 1'));
    await user.type(field('כמות, מצרך 1'), '3');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/recipes/r1');
    });
    expect(sent).toEqual([
      {
        title: 'פנקייק מושלם',
        description: null,
        notes: null,
        base_servings: 4,
        prep_time_minutes: 10,
        cook_time_minutes: null,
        source_url: null,
        tags: [{ id: TAG }],
        ingredients: [
          { id: ING1, name: 'כמון', amount: 3, unit: 'tsp', note: null },
          { id: ING2, name: 'מלח', amount: 1, unit: 'tsp', note: null },
          { id: ING3, name: 'קמח', amount: 1, unit: 'cup', note: 'מנופה' },
        ],
        steps: [{ description: 'מערבבים' }],
      },
    ]);
    expect(await screen.findByText('השינויים נשמרו')).toBeTruthy();
    expect(
      queryClient.getQueryData<RecipeRead>(
        recipesGetRecipeQueryKey({ path: { recipe_id: 'r1' } }),
      )?.title,
    ).toBe('פנקייק מושלם');
    expect(
      queryClient.getQueryState(recipesListRecipesQueryKey())?.isInvalidated,
    ).toBe(true);
    // "Back" from the saved recipe does not return to the form.
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('keeps the typed values and shows the message when the server refuses', async () => {
    const user = userEvent.setup();
    serveRecipe();
    server.use(
      http.put('*/api/recipes/:id', () =>
        HttpResponse.json(
          {
            detail: [
              {
                loc: ['body', 'ingredients', 0, 'id'],
                type: 'invalid',
                msg: 'x',
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    const { router } = renderEdit('r1');
    await screen.findByDisplayValue('פנקייק');
    await user.type(field('שם המתכון'), '!');
    await user.click(screen.getByRole('button', { name: 'שמירה' }));
    expect(await screen.findByText('משהו השתבש, אפשר לנסות שוב')).toBeTruthy();
    expect(field('שם המתכון')).toHaveProperty('value', 'פנקייק!');
    expect(router.state.location.pathname).toBe('/recipes/r1/edit');
  });

  it('asks before leaving a changed form', async () => {
    const user = userEvent.setup();
    serveRecipe();
    const { router } = renderEdit('r1');
    await screen.findByDisplayValue('פנקייק');

    await user.type(field('שם המתכון'), '!');
    await user.click(screen.getByRole('link', { name: 'חזרה למתכון' }));
    expect(await screen.findByText('לצאת בלי לשמור?')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/recipes/r1/edit');
    await user.click(screen.getByRole('button', { name: 'לצאת' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/recipes/r1');
    });
  });

  it('leaves an unchanged form without asking', async () => {
    const user = userEvent.setup();
    serveRecipe();
    const { router } = renderEdit('r1');
    await screen.findByDisplayValue('פנקייק');
    await user.click(screen.getByRole('link', { name: 'חזרה למתכון' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/recipes/r1');
    });
  });

  it('says the recipe was not found', async () => {
    server.use(
      http.get('*/api/recipes/:id', () =>
        HttpResponse.json(
          { detail: 'Recipe not found', code: 'recipe_not_found' },
          { status: 404 },
        ),
      ),
    );
    renderEdit('nope');
    expect(await screen.findByText('המתכון לא נמצא')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'שמירה' })).toBeNull();
  });
});
