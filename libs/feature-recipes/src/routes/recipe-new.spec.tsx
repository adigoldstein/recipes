import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import {
  recipesListRecipesQueryKey,
  type RecipeRead,
} from '@bite-and-board/data-access';
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
      expect(screen.getByText('יש להזין מספר')).toBeTruthy();
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
  });
});
