import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import {
  recipesListRecipesQueryKey,
  tagsListTagsQueryKey,
  type RecipeRead,
} from '@bite-and-board/data-access';
import { toast } from '@bite-and-board/ui-components';
import { renderNew } from '../testing/render-new';
import { server } from '../testing/server';

const SAVED: RecipeRead = {
  id: 'r-new',
  title: 'פשטידת תרד',
  description: null,
  notes: null,
  tags: [],
  base_servings: 4,
  prep_time_minutes: null,
  cook_time_minutes: null,
  source_url: null,
  photo: null,
  ingredients: [],
  steps: [],
  created_at: '2026-10-28T12:00:00Z',
  updated_at: '2026-10-28T12:00:00Z',
};

/** Answers POST /api/recipes with a created recipe and returns what the page sent. */
function serveCreate() {
  const sent: unknown[] = [];
  server.use(
    http.post('*/api/recipes', async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json(SAVED, { status: 201 });
    }),
  );
  return sent;
}

/** Answers POST /api/recipes with this 422 body. */
function serveInvalid(detail: object[]) {
  server.use(
    http.post('*/api/recipes', () =>
      HttpResponse.json({ detail }, { status: 422 }),
    ),
  );
}

// A required field's label also holds its " *", so match the name with or without it.
const field = (name: string) =>
  screen.getByLabelText(new RegExp(String.raw`^${name}( \*)?$`));
const save = () => screen.getByRole('button', { name: 'שמירה' });
type User = ReturnType<typeof userEvent.setup>;

async function fillRequired(user: User) {
  await user.type(field('שם המתכון'), 'פשטידת תרד');
  await user.type(field('שם המצרך 1'), 'תרד');
  await user.type(field('שלב 1'), 'אופים');
}

describe('RecipeNewPage', () => {
  // Toasts live in a module-level store, so one test's would show in the next.
  afterEach(() => {
    toast.dismiss();
  });

  describe('the form', () => {
    it('has a heading, a back link and every field of the story', () => {
      renderNew();
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'מתכון חדש',
      );
      expect(
        screen
          .getByRole('link', { name: 'חזרה למתכונים' })
          .getAttribute('href'),
      ).toBe('/');
      for (const name of [
        'שם המתכון',
        'תיאור',
        'הערות וטיפים',
        'מספר מנות',
        'זמן הכנה בדקות',
        'זמן בישול בדקות',
        'קישור למקור',
        'כמות, מצרך 1',
        'יחידה, מצרך 1',
        'שם המצרך 1',
        'הערה למצרך 1',
        'שלב 1',
      ]) {
        expect(field(name)).toBeTruthy();
      }
      expect(field('מספר מנות')).toHaveProperty('value', '4');
      expect(field('קישור למקור').getAttribute('dir')).toBe('ltr');
      expect(field('תיאור').tagName).toBe('TEXTAREA');
      expect(field('הערות וטיפים').tagName).toBe('TEXTAREA');
    });

    it('marks the required fields with a star and says so at the top', () => {
      renderNew();
      expect(
        screen.getByText(/שדות המסומנים ב/).closest('p')?.textContent,
      ).toBe('שדות המסומנים ב־* הם שדות חובה');
      for (const name of ['שם המתכון', 'מספר מנות']) {
        expect(field(name).getAttribute('aria-required')).toBe('true');
        expect(
          screen
            .getByText(new RegExp(`^${name}`))
            .querySelector('[aria-hidden]')?.textContent,
        ).toBe(' *');
      }
      for (const name of [
        'תיאור',
        'הערות וטיפים',
        'זמן הכנה בדקות',
        'זמן בישול בדקות',
        'קישור למקור',
      ]) {
        expect(field(name).getAttribute('aria-required')).toBeNull();
        expect(
          screen.getByText(name).querySelector('[aria-hidden]'),
        ).toBeNull();
      }
      // Rows have no labels of their own: the star is on the section headings.
      for (const heading of ['מצרכים', 'אופן הכנה']) {
        const h2 = screen.getByRole('heading', { level: 2, name: heading });
        expect(h2.querySelector('[aria-hidden="true"]')?.textContent).toBe(
          ' *',
        );
      }
      expect(field('שם המצרך 1').getAttribute('aria-required')).toBe('true');
      expect(field('שלב 1').getAttribute('aria-required')).toBe('true');
      expect(field('הערה למצרך 1').getAttribute('aria-required')).toBeNull();
      expect(
        screen.getByPlaceholderText('שם המצרך').getAttribute('placeholder'),
      ).not.toContain('*');
    });

    it('counts the description and the notes against their limits', async () => {
      const user = userEvent.setup();
      renderNew();
      expect(screen.getByText('0/500')).toBeTruthy();
      expect(screen.getByText('0/5000')).toBeTruthy();
      await user.type(field('תיאור'), 'שלום');
      await user.type(field('הערות וטיפים'), 'אפשר להקפיא');
      expect(screen.getByText('4/500')).toBeTruthy();
      expect(screen.getByText('11/5000')).toBeTruthy();
    });

    it('offers the units in Hebrew, once there is an amount', async () => {
      const user = userEvent.setup();
      renderNew();
      const unit = field('יחידה, מצרך 1') as HTMLButtonElement;
      expect(unit.disabled).toBe(true);
      await user.type(field('כמות, מצרך 1'), '2');
      expect(unit.disabled).toBe(false);
      await user.click(unit);
      const options = screen.getAllByRole('option').map((o) => o.textContent);
      expect(options).toHaveLength(14);
      expect(options[0]).toBe('ללא יחידה');
      expect(options).toEqual(
        expect.arrayContaining(['גרם', 'כוסות', 'כפות', 'שיניים', 'קמצוצים']),
      );
    });

    it('adds and removes rows, keeping at least one of each', async () => {
      const user = userEvent.setup();
      renderNew();
      const removeIngredient = (n: number) =>
        screen.getByRole('button', { name: `הסרת מצרך ${n}` });
      expect((removeIngredient(1) as HTMLButtonElement).disabled).toBe(true);

      await user.click(screen.getByRole('button', { name: 'הוספת מצרך' }));
      await user.click(screen.getByRole('button', { name: 'הוספת מצרך' }));
      await user.type(field('שם המצרך 1'), 'א');
      await user.type(field('שם המצרך 2'), 'ב');
      await user.type(field('שם המצרך 3'), 'ג');
      await user.click(removeIngredient(2));
      expect(field('שם המצרך 1')).toHaveProperty('value', 'א');
      expect(field('שם המצרך 2')).toHaveProperty('value', 'ג');
      expect(screen.queryByLabelText('שם המצרך 3')).toBeNull();

      await user.click(screen.getByRole('button', { name: 'הוספת שלב' }));
      expect(field('שלב 2')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'הסרת שלב 1' }));
      expect(screen.queryByLabelText('שלב 2')).toBeNull();
      const lastStep = screen.getByRole('button', { name: 'הסרת שלב 1' });
      expect((lastStep as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('saving', () => {
    it('sends the payload, then opens the new recipe with a toast and a stale list', async () => {
      const user = userEvent.setup();
      const sent = serveCreate();
      const { router, queryClient } = renderNew();
      queryClient.setQueryData(recipesListRecipesQueryKey(), []);

      await user.type(field('שם המתכון'), '  פשטידת תרד ');
      await user.type(field('תיאור'), 'מהירה');
      await user.clear(field('מספר מנות'));
      await user.type(field('מספר מנות'), '6');
      await user.type(field('זמן הכנה בדקות'), '15');
      await user.type(field('כמות, מצרך 1'), '1.5');
      await user.click(field('יחידה, מצרך 1'));
      await user.click(await screen.findByRole('option', { name: 'כוסות' }));
      await user.type(field('שם המצרך 1'), 'תרד');
      await user.type(field('הערה למצרך 1'), 'קפוא');
      await user.click(screen.getByRole('button', { name: 'הוספת מצרך' }));
      await user.type(field('שם המצרך 2'), 'מלח');
      await user.type(field('שלב 1'), 'מערבבים');
      await user.click(save());

      await screen.findByText('recipe page stub');
      expect(router.state.location.pathname).toBe('/recipes/r-new');
      expect(sent).toEqual([
        {
          title: 'פשטידת תרד',
          description: 'מהירה',
          notes: null,
          base_servings: 6,
          prep_time_minutes: 15,
          cook_time_minutes: null,
          source_url: null,
          tags: [],
          ingredients: [
            { name: 'תרד', amount: 1.5, unit: 'cup', note: 'קפוא' },
            { name: 'מלח', amount: null, unit: null, note: null },
          ],
          steps: [{ description: 'מערבבים' }],
        },
      ]);
      expect(await screen.findByText('המתכון נשמר')).toBeTruthy();
      expect(
        queryClient.getQueryState(recipesListRecipesQueryKey())?.isInvalidated,
      ).toBe(true);
    });

    it('replaces the form in history, so back from the recipe is the library', async () => {
      const user = userEvent.setup();
      serveCreate();
      const { router } = renderNew('/');
      await fillRequired(user);
      await user.click(save());
      await screen.findByText('recipe page stub');
      await router.navigate(-1);
      await screen.findByText('library stub');
    });

    it('sends nothing and shows Hebrew errors on the fields that need them', async () => {
      const user = userEvent.setup();
      const sent = serveCreate();
      renderNew();
      await user.clear(field('מספר מנות'));
      await user.type(field('כמות, מצרך 1'), 'הרבה');
      await user.click(save());

      expect(await screen.findAllByText('יש למלא את השדה')).toHaveLength(4);
      expect(screen.getByText(/^יש להזין מספר, למשל/)).toBeTruthy();
      const title = field('שם המתכון');
      expect(title.getAttribute('aria-invalid')).toBe('true');
      expect(title.getAttribute('aria-describedby')).toBe('recipe-title-error');
      expect(document.activeElement).toBe(title);
      expect(sent).toEqual([]);
    });

    it('rejects a description and notes over their limits', async () => {
      const user = userEvent.setup();
      const sent = serveCreate();
      renderNew();
      await fillRequired(user);
      fireEvent.change(field('תיאור'), { target: { value: 'א'.repeat(501) } });
      fireEvent.change(field('הערות וטיפים'), {
        target: { value: 'א'.repeat(5001) },
      });
      await user.click(save());

      expect(await screen.findByText('אפשר עד 500 תווים')).toBeTruthy();
      expect(screen.getByText('אפשר עד 5000 תווים')).toBeTruthy();
      expect(screen.getByText('501/500').className).toContain(
        'text-destructive',
      );
      expect(sent).toEqual([]);
    });
  });

  describe('tags', () => {
    const TAGS = [
      { id: '11111111-1111-4111-8111-111111111111', name: 'ערב', pinned: true },
      { id: '22222222-2222-4222-8222-222222222222', name: 'מרק', pinned: true },
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'על האש',
        pinned: false,
      },
    ];
    const serveTags = () =>
      server.use(http.get('*/api/tags', () => HttpResponse.json(TAGS)));
    // The field's label is the button's accessible name.
    const picker = () => screen.getByLabelText('תגיות');

    it('lists every tag when opened, and sends existing ones by id and new ones by name', async () => {
      const user = userEvent.setup();
      serveTags();
      const sent = serveCreate();
      renderNew();
      await fillRequired(user);
      await user.click(picker());
      expect(
        (await screen.findAllByRole('option')).map((o) => o.textContent),
      ).toEqual(['ערב', 'מרק', 'על האש']);
      await user.click(screen.getByRole('option', { name: 'מרק' }));
      await user.type(
        screen.getByPlaceholderText('חיפוש תגית או שם חדש'),
        '  ארוחת   שבת ',
      );
      await user.click(
        screen.getByRole('option', { name: "יצירת תגית 'ארוחת שבת'" }),
      );
      await user.keyboard('{Escape}');
      const chips = screen.getByRole('list', { name: 'התגיות של המתכון' });
      expect(chips.textContent).toContain('מרק');
      expect(chips.textContent).toContain('ארוחת שבת');

      await user.click(save());
      await screen.findByText('recipe page stub');
      const [payload] = sent as { tags: unknown[] }[];
      expect(payload.tags).toEqual([
        { id: '22222222-2222-4222-8222-222222222222' },
        { name: 'ארוחת שבת' },
      ]);
    });

    it('does not offer to create a tag that exists, whatever its case', async () => {
      const user = userEvent.setup();
      server.use(
        http.get('*/api/tags', () =>
          HttpResponse.json([
            {
              id: '44444444-4444-4444-8444-444444444444',
              name: 'BBQ',
              pinned: false,
            },
          ]),
        ),
      );
      renderNew();
      await user.click(picker());
      await screen.findByRole('option', { name: 'BBQ' });
      await user.type(
        screen.getByPlaceholderText('חיפוש תגית או שם חדש'),
        'bbq ',
      );
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        'BBQ',
      ]);
    });

    it('works when the tag list cannot be loaded: a typed name can still be created', async () => {
      const user = userEvent.setup();
      server.use(
        http.get('*/api/tags', () => HttpResponse.json({}, { status: 500 })),
      );
      const sent = serveCreate();
      renderNew();
      await fillRequired(user);
      await user.click(picker());
      await user.type(
        screen.getByPlaceholderText('חיפוש תגית או שם חדש'),
        'חג',
      );
      await user.click(screen.getByRole('option', { name: "יצירת תגית 'חג'" }));
      await user.keyboard('{Escape}');
      await user.click(save());
      await screen.findByText('recipe page stub');
      expect((sent as { tags: unknown[] }[])[0].tags).toEqual([{ name: 'חג' }]);
    });

    it('counts a chosen tag as an unsaved change', async () => {
      const user = userEvent.setup();
      serveTags();
      renderNew('/');
      await user.click(picker());
      await user.click(await screen.findByRole('option', { name: 'ערב' }));
      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('link', { name: 'חזרה למתכונים' }));
      expect(await screen.findByRole('alertdialog')).toBeTruthy();
    });

    it('refreshes the tag list after saving, so a new tag shows up everywhere', async () => {
      const user = userEvent.setup();
      serveCreate();
      const { queryClient } = renderNew();
      // The form reads the tags, so the list refetches at once and cannot be
      // inspected as "stale": watch for the call instead.
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      await fillRequired(user);
      await user.click(save());
      await screen.findByText('recipe page stub');
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: tagsListTagsQueryKey(),
      });
    });
  });

  describe('the form experience', () => {
    it('accepts fractions as amounts and sends them as numbers', async () => {
      const user = userEvent.setup();
      const sent = serveCreate();
      renderNew();
      await fillRequired(user);
      await user.type(field('כמות, מצרך 1'), '1 ½');
      for (const [n, amount, name] of [
        [2, '⅓', 'ב'],
        [3, '1/3', 'ג'],
        [4, '1,5', 'ד'],
      ] as const) {
        await user.click(screen.getByRole('button', { name: 'הוספת מצרך' }));
        await user.type(field(`כמות, מצרך ${n}`), amount);
        await user.type(field(`שם המצרך ${n}`), name);
      }
      await user.click(save());
      await screen.findByText('recipe page stub');
      const [payload] = sent as { ingredients: { amount: number }[] }[];
      expect(payload.ingredients.map((i) => i.amount)).toEqual([
        1.5, 0.333, 0.333, 1.5,
      ]);
    });

    it('flags an amount that is not a number as soon as it is left', async () => {
      const user = userEvent.setup();
      renderNew();
      await user.type(field('כמות, מצרך 1'), '1/0');
      expect(screen.queryByText(/^יש להזין מספר, למשל/)).toBeNull();
      await user.tab();
      expect(await screen.findByText(/^יש להזין מספר, למשל/)).toBeTruthy();
      expect(field('כמות, מצרך 1').getAttribute('aria-invalid')).toBe('true');
      await user.clear(field('כמות, מצרך 1'));
      await user.type(field('כמות, מצרך 1'), '½');
      await waitFor(() =>
        expect(screen.queryByText(/^יש להזין מספר, למשל/)).toBeNull(),
      );
    });

    it('shows a required error when a field is left, not before', async () => {
      const user = userEvent.setup();
      renderNew();
      expect(screen.queryByText('יש למלא את השדה')).toBeNull();
      await user.click(field('שם המתכון'));
      await user.tab();
      expect(await screen.findByText('יש למלא את השדה')).toBeTruthy();
      await user.type(field('שם המתכון'), 'א');
      await waitFor(() =>
        expect(screen.queryByText('יש למלא את השדה')).toBeNull(),
      );
    });

    it('focuses the first error in a list row on submit', async () => {
      const user = userEvent.setup();
      renderNew();
      await user.type(field('שם המתכון'), 'פשטידה');
      await user.type(field('שלב 1'), 'אופים');
      await user.click(save());
      await waitFor(() =>
        expect(document.activeElement).toBe(field('שם המצרך 1')),
      );
    });

    it('moves ingredient rows up and down with buttons, keeping the keyboard on them', async () => {
      const user = userEvent.setup();
      const sent = serveCreate();
      renderNew();
      await fillRequired(user);
      await user.click(screen.getByRole('button', { name: 'הוספת מצרך' }));
      await user.type(field('שם המצרך 2'), 'מלח');
      const button = (name: string) =>
        screen.getByRole('button', { name }) as HTMLButtonElement;
      expect(button('העברת מצרך 1 למעלה').disabled).toBe(true);
      expect(button('העברת מצרך 2 למטה').disabled).toBe(true);

      button('העברת מצרך 1 למטה').focus();
      await user.keyboard('{Enter}');
      expect(field('שם המצרך 1')).toHaveProperty('value', 'מלח');
      expect(field('שם המצרך 2')).toHaveProperty('value', 'תרד');
      // The pressed button is now disabled, so focus moves to its partner.
      expect(document.activeElement).toBe(button('העברת מצרך 2 למעלה'));

      await user.click(save());
      await screen.findByText('recipe page stub');
      const [payload] = sent as { ingredients: { name: string }[] }[];
      expect(payload.ingredients.map((i) => i.name)).toEqual(['מלח', 'תרד']);
    });

    it('moves steps too', async () => {
      const user = userEvent.setup();
      renderNew();
      await user.type(field('שלב 1'), 'ראשון');
      await user.click(screen.getByRole('button', { name: 'הוספת שלב' }));
      await user.type(field('שלב 2'), 'שני');
      await user.click(
        screen.getByRole('button', { name: 'העברת שלב 2 למעלה' }),
      );
      expect(field('שלב 1')).toHaveProperty('value', 'שני');
      expect(field('שלב 2')).toHaveProperty('value', 'ראשון');
    });

    it('adds an ingredient row on Enter in the last row, once it has a name', async () => {
      const user = userEvent.setup();
      const sent = serveCreate();
      renderNew();
      await user.type(field('שם המצרך 1'), '{Enter}');
      expect(screen.queryByLabelText('שם המצרך 2')).toBeNull();
      await user.type(field('שם המצרך 1'), 'תרד{Enter}');
      expect(field('כמות, מצרך 2')).toBeTruthy();
      expect(document.activeElement).toBe(field('כמות, מצרך 2'));
      // Enter in a row that is not the last one adds nothing, and never submits.
      await user.type(field('שם המצרך 1'), '{Enter}');
      expect(screen.queryByLabelText('שם המצרך 3')).toBeNull();
      expect(sent).toEqual([]);
    });
  });

  describe('leaving with unsaved changes', () => {
    const back = () => screen.getByRole('link', { name: 'חזרה למתכונים' });

    it('leaves at once when nothing was typed', async () => {
      const user = userEvent.setup();
      renderNew('/');
      await user.click(back());
      await screen.findByText('library stub');
    });

    it('asks first, and staying keeps the form as it was', async () => {
      const user = userEvent.setup();
      const { router } = renderNew('/');
      await user.type(field('שם המתכון'), 'פשטידה');
      await user.click(back());
      const dialog = await screen.findByRole('alertdialog');
      expect(dialog.textContent).toContain('לצאת בלי לשמור?');
      await user.click(screen.getByRole('button', { name: 'להישאר' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(router.state.location.pathname).toBe('/recipes/new');
      expect(field('שם המתכון')).toHaveProperty('value', 'פשטידה');
    });

    it('leaves after confirming', async () => {
      const user = userEvent.setup();
      renderNew('/');
      await user.type(field('שם המתכון'), 'פשטידה');
      await user.click(back());
      await user.click(await screen.findByRole('button', { name: 'לצאת' }));
      await screen.findByText('library stub');
    });

    it('also guards the browser back button', async () => {
      const user = userEvent.setup();
      const { router } = renderNew('/');
      await user.type(field('שם המתכון'), 'פשטידה');
      await router.navigate(-1);
      expect(await screen.findByRole('alertdialog')).toBeTruthy();
    });

    it('asks the browser to warn on reload or close only while there are changes', async () => {
      const user = userEvent.setup();
      renderNew();
      const unload = () => {
        const event = new Event('beforeunload', { cancelable: true });
        globalThis.dispatchEvent(event);
        return event.defaultPrevented;
      };
      expect(unload()).toBe(false);
      await user.type(field('שם המתכון'), 'פשטידה');
      expect(unload()).toBe(true);
    });

    it('does not ask after a successful save', async () => {
      const user = userEvent.setup();
      serveCreate();
      renderNew();
      await fillRequired(user);
      await user.click(save());
      await screen.findByText('recipe page stub');
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });

  describe('when the server says no', () => {
    it('puts a 422 on the matching fields in Hebrew and keeps the values', async () => {
      const user = userEvent.setup();
      serveInvalid([
        {
          loc: ['body', 'title'],
          type: 'string_too_long',
          msg: 'x',
          ctx: { max_length: 120 },
        },
        {
          loc: ['body', 'ingredients', 0, 'amount'],
          type: 'greater_than',
          msg: 'x',
          ctx: { gt: 0 },
        },
        {
          loc: ['body', 'base_servings'],
          type: 'less_than_equal',
          msg: 'x',
          ctx: { le: 100 },
        },
      ]);
      renderNew();
      await fillRequired(user);
      await user.type(field('כמות, מצרך 1'), '2');
      await user.click(save());

      const title = field('שם המתכון');
      await waitFor(() =>
        expect(title.getAttribute('aria-invalid')).toBe('true'),
      );
      expect(screen.getByText('אפשר עד 120 תווים')).toBeTruthy();
      expect(screen.getByText('המספר חייב להיות גדול מ־0')).toBeTruthy();
      expect(screen.getByText('המספר חייב להיות 100 לכל היותר')).toBeTruthy();
      expect(field('כמות, מצרך 1').getAttribute('aria-invalid')).toBe('true');
      expect(title).toHaveProperty('value', 'פשטידת תרד');
      expect(field('שם המצרך 1')).toHaveProperty('value', 'תרד');
      expect(save().hasAttribute('disabled')).toBe(false);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows a list error from the server under its list', async () => {
      const user = userEvent.setup();
      serveInvalid([
        {
          loc: ['body', 'ingredients'],
          type: 'too_short',
          msg: 'x',
          ctx: { min_length: 1 },
        },
      ]);
      renderNew();
      await fillRequired(user);
      await user.click(save());
      expect(await screen.findByText('יש להוסיף לפחות מצרך אחד')).toBeTruthy();
    });

    it('shows an error that fits no field under the button, in Hebrew', async () => {
      const user = userEvent.setup();
      server.use(
        http.post('*/api/recipes', () =>
          HttpResponse.json(
            { detail: 'Tag not found', code: 'tag_not_found' },
            { status: 404 },
          ),
        ),
      );
      renderNew();
      await fillRequired(user);
      await user.click(save());
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('התגית לא נמצאה');
    });

    it('keeps every value after a network failure, and a second try can succeed', async () => {
      const user = userEvent.setup();
      let calls = 0;
      server.use(
        http.post('*/api/recipes', () => {
          calls += 1;
          return calls === 1
            ? HttpResponse.error()
            : HttpResponse.json(SAVED, { status: 201 });
        }),
      );
      renderNew();
      await fillRequired(user);
      await user.click(save());

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('משהו השתבש, אפשר לנסות שוב');
      expect(field('שם המתכון')).toHaveProperty('value', 'פשטידת תרד');
      expect(field('שלב 1')).toHaveProperty('value', 'אופים');

      await user.click(save());
      await screen.findByText('recipe page stub');
      expect(calls).toBe(2);
    });

    it('offers a retry toast when the server fails, and the retry saves', async () => {
      const user = userEvent.setup();
      let calls = 0;
      server.use(
        http.post('*/api/recipes', () => {
          calls += 1;
          return calls === 1
            ? new HttpResponse('boom', { status: 500 })
            : HttpResponse.json(SAVED, { status: 201 });
        }),
      );
      renderNew();
      await fillRequired(user);
      await user.click(save());

      expect(await screen.findAllByText(/^השמירה לא הצליחה/)).not.toHaveLength(
        0,
      );
      expect((await screen.findByRole('alert')).textContent).toBe(
        'משהו השתבש, אפשר לנסות שוב',
      );
      expect(field('שם המתכון')).toHaveProperty('value', 'פשטידת תרד');
      await user.click(screen.getByRole('button', { name: 'לנסות שוב' }));
      await screen.findByText('recipe page stub');
      expect(calls).toBe(2);
    });

    it('shows no retry toast for an error that retrying cannot fix', async () => {
      const user = userEvent.setup();
      server.use(
        http.post('*/api/recipes', () =>
          HttpResponse.json(
            { detail: 'Tag not found', code: 'tag_not_found' },
            { status: 404 },
          ),
        ),
      );
      renderNew();
      await fillRequired(user);
      await user.click(save());
      await screen.findByRole('alert');
      expect(screen.queryAllByText(/^השמירה לא הצליחה/)).toHaveLength(0);
    });
  });
});
