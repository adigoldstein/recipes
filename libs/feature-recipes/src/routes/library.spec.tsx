import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { server, serveSession } from '../testing/server';
import { recipe, renderLibrary, serveRecipes } from '../testing/render-library';

const SHAKSHUKA = recipe('r1', 'שקשוקה', {
  tags: [
    { id: 't1', name: 'בוקר' },
    { id: 't2', name: 'על האש' },
    { id: 't3', name: 'מסיבות' },
  ],
  total_minutes: 25,
});
const LASAGNA = recipe('r2', 'לזניה', { total_minutes: 90 });
const CAKE = recipe('r3', 'עוגת שוקולד', { total_minutes: 75 });
const SALAD = recipe('r4', 'Greek Salad');
const ALL = [SHAKSHUKA, LASAGNA, CAKE, SALAD];

const TAGS = [
  { id: 't1', name: 'בוקר', pinned: true },
  { id: 't4', name: 'ערב', pinned: true },
  { id: 't2', name: 'על האש', pinned: false },
  { id: 't3', name: 'מסיבות', pinned: false },
];
const BREAKFAST_AND_DINNER = recipe('r5', 'פשטידה', {
  tags: [
    { id: 't1', name: 'בוקר' },
    { id: 't4', name: 'ערב' },
  ],
  total_minutes: 20,
});
const DINNER = recipe('r6', 'מרק', {
  tags: [{ id: 't4', name: 'ערב' }],
  total_minutes: 60,
});
const WITH_TAGS = [SHAKSHUKA, BREAKFAST_AND_DINNER, DINNER, SALAD];

const chip = (name: string) => screen.getByRole('button', { name });

const titles = () =>
  screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const search = () => screen.getByRole('searchbox', { name: 'חיפוש מתכונים' });
const fastChip = () => screen.getByRole('button', { name: 'עד 30 דקות' });

async function loaded(path = '/', tags = TAGS) {
  const router = renderLibrary(path, tags);
  await screen.findByRole('list');
  return router;
}

describe('LibraryPage', () => {
  describe('the list', () => {
    it('shows a heading, then the cards in the order the API sends them', async () => {
      serveRecipes(ALL);
      await loaded();
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'מתכונים',
      );
      expect(titles()).toEqual([
        'שקשוקה',
        'לזניה',
        'עוגת שוקולד',
        'Greek Salad',
      ]);
      const link = screen.getByRole('link', { name: /שקשוקה/ });
      expect(link.getAttribute('href')).toBe('/recipes/r1');
    });

    it('shows up to 2 tags, a "+N" for the rest, and the total time', async () => {
      serveRecipes(ALL);
      await loaded();
      const card = screen.getByRole('link', { name: /שקשוקה/ });
      expect(card.textContent).toContain('בוקר');
      expect(card.textContent).toContain('על האש');
      expect(card.textContent).not.toContain('מסיבות');
      expect(card.textContent).toContain('+1');
      expect(card.textContent).toContain('25 דק׳');
    });

    it('formats hours, leaves out an unknown time, and uses the thumbnail', async () => {
      serveRecipes([
        recipe('r1', 'שעה אחת', { total_minutes: 60 }),
        recipe('r2', 'שעה ורבע', { total_minutes: 75 }),
        recipe('r3', 'בלי זמן'),
        recipe('r4', 'עם תמונה', {
          photo: {
            url: '/m/a.webp',
            thumb_url: '/m/a-t.webp',
            credit_domain: null,
          },
        }),
      ]);
      await loaded();
      const text = (name: RegExp) =>
        screen.getByRole('link', { name }).textContent;
      expect(text(/^שעה אחת/)).toContain('1 שע׳');
      expect(text(/שעה ורבע/)).toContain('1 שע׳ 15 דק׳');
      expect(text(/בלי זמן/)).not.toMatch(/דק׳|שע׳/);
      const img = screen
        .getByRole('link', { name: /עם תמונה/ })
        .querySelector('img');
      expect(img?.getAttribute('src')).toBe('/m/a-t.webp');
    });

    it('shows 6 skeleton cards while loading', async () => {
      server.use(
        http.get('*/api/recipes', async () => {
          await delay('infinite');
          return HttpResponse.json([]);
        }),
      );
      renderLibrary();
      const status = await screen.findByRole('status', {
        name: 'טוען מתכונים',
      });
      expect(
        status.querySelectorAll('[data-slot="recipe-card-skeleton"]'),
      ).toHaveLength(6);
    });

    it('shows the visitor empty state with no recipes', async () => {
      serveRecipes([]);
      renderLibrary();
      expect(
        await screen.findByRole('heading', { name: 'עוד אין כאן מתכונים' }),
      ).toBeTruthy();
      expect(screen.queryByRole('list')).toBeNull();
      expect(screen.queryByRole('button', { name: /ניקוי/ })).toBeNull();
      expect(screen.queryByRole('link', { name: 'מתכון חדש' })).toBeNull();
    });

    it('offers an editor "מתכון חדש" in the empty state, and a visitor nothing', async () => {
      serveRecipes([]);
      serveSession('editor');
      const router = renderLibrary();
      const link = await screen.findByRole('link', { name: 'מתכון חדש' });
      expect(link.getAttribute('href')).toBe('/recipes/new');
      expect(router.state.location.pathname).toBe('/');
    });

    it('shows the API error in Hebrew and retries', async () => {
      server.use(
        http.get('*/api/recipes', () =>
          HttpResponse.json(
            { detail: 'x', code: 'recipe_not_found' },
            { status: 404 },
          ),
        ),
      );
      renderLibrary();
      expect(
        await screen.findByRole('heading', { name: 'המתכון לא נמצא' }),
      ).toBeTruthy();

      serveRecipes(ALL);
      await userEvent.click(screen.getByRole('button', { name: 'לנסות שוב' }));
      expect(await screen.findByRole('list')).toBeTruthy();
    });

    it('shows the generic message for an error without a code', async () => {
      server.use(http.get('*/api/recipes', () => HttpResponse.error()));
      renderLibrary();
      expect(
        await screen.findByRole('heading', {
          name: 'משהו השתבש, אפשר לנסות שוב',
        }),
      ).toBeTruthy();
    });
  });

  describe('search', () => {
    it('keeps only titles that contain the text, ignoring case, as you type', async () => {
      serveRecipes(ALL);
      await loaded();
      await userEvent.type(search(), 'greek');
      await waitFor(() => expect(titles()).toEqual(['Greek Salad']));
      await userEvent.clear(search());
      await waitFor(() => expect(titles()).toHaveLength(4));
    });

    it('keeps the text in ?q= without piling up history entries', async () => {
      serveRecipes(ALL);
      const router = await loaded();
      const entries = window.history.length;
      await userEvent.type(search(), 'עוג');
      expect(router.state.location.search).toBe(
        `?q=${encodeURIComponent('עוג')}`,
      );
      expect(window.history.length).toBe(entries);
      expect(search()).toHaveProperty('value', 'עוג');
    });

    it('starts from ?q= in the URL', async () => {
      serveRecipes(ALL);
      await loaded(`/?q=${encodeURIComponent('לזניה')}`);
      expect(search()).toHaveProperty('value', 'לזניה');
      expect(titles()).toEqual(['לזניה']);
    });

    it('clears the text with the x button', async () => {
      serveRecipes(ALL);
      const router = await loaded('/?q=greek');
      await userEvent.click(
        screen.getByRole('button', { name: 'ניקוי שדה החיפוש' }),
      );
      expect(search()).toHaveProperty('value', '');
      expect(router.state.location.search).toBe('');
      await waitFor(() => expect(titles()).toHaveLength(4));
    });

    it('says nothing matched, and "ניקוי החיפוש" clears search and filter', async () => {
      serveRecipes(ALL);
      const router = await loaded('/?fast=1');
      await userEvent.type(search(), 'פיצה');
      expect(
        await screen.findByRole('heading', {
          name: "לא נמצאו מתכונים ל־'פיצה'",
        }),
      ).toBeTruthy();

      await userEvent.click(
        screen.getByRole('button', { name: 'ניקוי החיפוש' }),
      );
      expect(router.state.location.search).toBe('');
      expect(search()).toHaveProperty('value', '');
      expect(fastChip().getAttribute('aria-pressed')).toBe('false');
      await waitFor(() => expect(titles()).toHaveLength(4));
    });

    it('focuses the field on "/" unless already typing', async () => {
      serveRecipes(ALL);
      await loaded();
      await userEvent.keyboard('/');
      expect(document.activeElement).toBe(search());
      expect(search()).toHaveProperty('value', '');

      // Typing a slash in the field itself is just text.
      await userEvent.keyboard('a/b');
      expect(search()).toHaveProperty('value', 'a/b');
    });

    it('ignores "/" with a modifier key', async () => {
      serveRecipes(ALL);
      await loaded();
      await userEvent.keyboard('{Control>}/{/Control}');
      expect(document.activeElement).not.toBe(search());
    });
  });

  describe('the quick chip', () => {
    it('keeps recipes of a known time of at most 30 minutes, kept in ?fast=1', async () => {
      serveRecipes(ALL);
      const router = await loaded();
      expect(fastChip().getAttribute('aria-pressed')).toBe('false');
      await userEvent.click(fastChip());
      expect(titles()).toEqual(['שקשוקה']);
      expect(router.state.location.search).toBe('?fast=1');
      await userEvent.click(fastChip());
      expect(titles()).toHaveLength(4);
      expect(router.state.location.search).toBe('');
    });

    it('combines with the search', async () => {
      serveRecipes(ALL);
      await loaded('/?fast=1');
      expect(fastChip().getAttribute('aria-pressed')).toBe('true');
      expect(titles()).toEqual(['שקשוקה']);
      await userEvent.type(search(), 'לזניה');
      expect(
        await screen.findByRole('heading', {
          name: "לא נמצאו מתכונים ל־'לזניה'",
        }),
      ).toBeTruthy();
    });

    it('says nothing matched without quoting an empty search', async () => {
      serveRecipes([LASAGNA]);
      await loaded();
      await userEvent.click(fastChip());
      expect(
        await screen.findByRole('heading', {
          name: 'לא נמצאו מתכונים מתאימים',
        }),
      ).toBeTruthy();
      await userEvent.click(
        screen.getByRole('button', { name: 'ניקוי הסינון' }),
      );
      expect(titles()).toEqual(['לזניה']);
    });
  });

  describe('tag chips', () => {
    it('shows "הכל", the quick chip and the pinned tags only, in the API order', async () => {
      serveRecipes(WITH_TAGS);
      await loaded();
      const names = screen
        .getAllByRole('button')
        .map((button) => button.textContent);
      expect(names).toEqual(['הכל', 'עד 30 דקות', 'בוקר', 'ערב']);
      expect(chip('הכל').getAttribute('aria-pressed')).toBe('true');
    });

    it('filters by a tag, kept in ?tags=', async () => {
      serveRecipes(WITH_TAGS);
      const router = await loaded();
      await userEvent.click(chip('ערב'));
      expect(titles()).toEqual(['פשטידה', 'מרק']);
      expect(chip('ערב').getAttribute('aria-pressed')).toBe('true');
      expect(chip('הכל').getAttribute('aria-pressed')).toBe('false');
      expect(router.state.location.search).toBe('?tags=t4');
    });

    it('needs every selected tag (AND)', async () => {
      serveRecipes(WITH_TAGS);
      const router = await loaded();
      await userEvent.click(chip('ערב'));
      await userEvent.click(chip('בוקר'));
      expect(titles()).toEqual(['פשטידה']);
      expect(router.state.location.search).toBe('?tags=t4%2Ct1');
      await userEvent.click(chip('בוקר'));
      expect(titles()).toEqual(['פשטידה', 'מרק']);
    });

    it('clears the tags with "הכל"', async () => {
      serveRecipes(WITH_TAGS);
      const router = await loaded('/?tags=t1,t4');
      expect(titles()).toEqual(['פשטידה']);
      await userEvent.click(chip('הכל'));
      expect(titles()).toHaveLength(4);
      expect(router.state.location.search).toBe('');
    });

    it('combines with the search and the quick chip', async () => {
      serveRecipes(WITH_TAGS);
      await loaded('/?tags=t4');
      await userEvent.click(fastChip());
      expect(titles()).toEqual(['פשטידה']);
      await userEvent.type(search(), 'מרק');
      expect(
        await screen.findByRole('heading', {
          name: "לא נמצאו מתכונים ל־'מרק'",
        }),
      ).toBeTruthy();
    });

    it('starts from ?tags= in the URL', async () => {
      serveRecipes(WITH_TAGS);
      await loaded('/?tags=t1');
      expect(chip('בוקר').getAttribute('aria-pressed')).toBe('true');
      expect(titles()).toEqual(['שקשוקה', 'פשטידה']);
    });

    it('ignores ids that are not tags', async () => {
      serveRecipes(WITH_TAGS);
      await loaded('/?tags=nope');
      expect(titles()).toHaveLength(4);
      expect(chip('הכל').getAttribute('aria-pressed')).toBe('true');
    });

    it('still applies the known ids next to an unknown one', async () => {
      serveRecipes(WITH_TAGS);
      await loaded('/?tags=nope,t4');
      expect(titles()).toEqual(['פשטידה', 'מרק']);
    });

    it('filters by an existing tag that is not pinned, without a chip for it', async () => {
      serveRecipes(WITH_TAGS);
      await loaded('/?tags=t2');
      expect(titles()).toEqual(['שקשוקה']);
      expect(screen.queryByRole('button', { name: 'על האש' })).toBeNull();
    });

    it('says nothing matched when no recipe has all the tags, and clears them', async () => {
      serveRecipes(WITH_TAGS);
      const router = renderLibrary('/?tags=t1,t4,t3', TAGS);
      expect(
        await screen.findByRole('heading', {
          name: 'לא נמצאו מתכונים מתאימים',
        }),
      ).toBeTruthy();
      await userEvent.click(chip('ניקוי הסינון'));
      expect(router.state.location.search).toBe('');
      expect(titles()).toHaveLength(4);
    });

    it('waits for the tags before showing the list', async () => {
      server.use(
        http.get('*/api/tags', async () => {
          await delay('infinite');
          return HttpResponse.json([]);
        }),
      );
      serveRecipes(WITH_TAGS);
      renderLibrary('/?tags=t4', null);
      expect(
        await screen.findByRole('status', { name: 'טוען מתכונים' }),
      ).toBeTruthy();
      expect(screen.queryByRole('list')).toBeNull();
    });

    it('still lists the recipes when the tags fail, with no tag chips', async () => {
      server.use(http.get('*/api/tags', () => HttpResponse.error()));
      serveRecipes(WITH_TAGS);
      renderLibrary('/?tags=t4', null);
      await screen.findByRole('list');
      expect(titles()).toHaveLength(4);
      expect(screen.queryByRole('button', { name: 'ערב' })).toBeNull();
      expect(chip('הכל')).toBeTruthy();
    });

    it('keeps the chosen tags after Back from a recipe', async () => {
      serveRecipes(WITH_TAGS);
      const router = await loaded('/?tags=t4');
      await userEvent.click(screen.getByRole('link', { name: /מרק/ }));
      expect(await screen.findByText('recipe detail stub')).toBeTruthy();
      await act(() => router.navigate(-1));
      await screen.findByRole('list');
      expect(chip('ערב').getAttribute('aria-pressed')).toBe('true');
      expect(titles()).toEqual(['פשטידה', 'מרק']);
    });
  });

  describe('coming back from a recipe', () => {
    it('still has the search and filter applied after Back', async () => {
      serveRecipes(ALL);
      const router = await loaded('/?q=%D7%A9&fast=1');
      expect(titles()).toEqual(['שקשוקה']);

      await userEvent.click(screen.getByRole('link', { name: /שקשוקה/ }));
      expect(await screen.findByText('recipe detail stub')).toBeTruthy();

      await act(() => router.navigate(-1));
      await screen.findByRole('list');
      expect(search()).toHaveProperty('value', 'ש');
      expect(fastChip().getAttribute('aria-pressed')).toBe('true');
      expect(titles()).toEqual(['שקשוקה']);
    });

    it('follows the URL when it changes by itself', async () => {
      serveRecipes(ALL);
      const router = await loaded('/?q=greek');
      expect(titles()).toEqual(['Greek Salad']);
      await act(() => router.navigate('/?q=%D7%9C%D7%96%D7%A0%D7%99%D7%94'));
      expect(search()).toHaveProperty('value', 'לזניה');
      await waitFor(() => expect(titles()).toEqual(['לזניה']));
    });
  });
});
