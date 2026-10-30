import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { schemas, type RecipeRead } from '@bite-and-board/data-access';
import { initI18n } from '@bite-and-board/i18n';
import { server, serveSession } from '../testing/server';
import { renderDetail } from '../testing/render-detail';

function recipe(overrides: Partial<RecipeRead> = {}): RecipeRead {
  return {
    id: 'r1',
    title: 'פנקייק',
    description: null,
    base_servings: 4,
    prep_time_minutes: 10,
    cook_time_minutes: 75,
    source_url: null,
    notes: null,
    photo: null,
    tags: [{ id: 't1', name: 'בוקר' }],
    ingredients: [
      {
        id: 'i1',
        name: 'קמח',
        amount: 2,
        unit: 'cup',
        note: 'מנופה',
        original: null,
        source: null,
      },
      {
        id: 'i2',
        name: 'מלח',
        amount: null,
        unit: null,
        note: null,
        original: null,
        source: null,
      },
    ],
    steps: [
      { id: 's1', description: 'מערבבים', source_text: null },
      { id: 's2', description: 'אופים', source_text: null },
    ],
    created_at: '2026-10-27T12:00:00Z',
    updated_at: '2026-10-27T12:00:00Z',
    ...overrides,
  };
}

function serve(r: RecipeRead) {
  server.use(http.get('*/api/recipes/:id', () => HttpResponse.json(r)));
}

afterEach(() => {
  localStorage.clear();
});

describe('RecipeDetailPage', () => {
  it('shows the photo with alt text and its credit, above the title', async () => {
    serve(
      recipe({
        photo: {
          url: '/media/photos/a.webp',
          thumb_url: '/media/photos/a-thumb.webp',
          credit_domain: 'commons.wikimedia.org',
        },
      }),
    );
    renderDetail('r1');
    const photo = await screen.findByRole('img', { name: 'תמונה של פנקייק' });
    expect(photo.getAttribute('src')).toBe('/media/photos/a.webp');
    expect(screen.getByText('מקור: commons.wikimedia.org')).toBeTruthy();
    const title = screen.getByRole('heading', { level: 1, name: 'פנקייק' });
    expect(
      photo.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows a photo without a credit line when it has no source', async () => {
    serve(
      recipe({
        photo: {
          url: '/media/photos/a.webp',
          thumb_url: '/media/photos/a-thumb.webp',
          credit_domain: null,
        },
      }),
    );
    renderDetail('r1');
    await screen.findByRole('img', { name: 'תמונה של פנקייק' });
    expect(screen.queryByText(/מקור:/)).toBeNull();
  });

  it('has no photo and no placeholder when the recipe has none', async () => {
    serve(recipe());
    renderDetail('r1');
    await screen.findByRole('heading', { level: 1, name: 'פנקייק' });
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('offers editing to an editor only', async () => {
    serve(recipe());
    renderDetail('r1');
    await screen.findByRole('heading', { level: 1, name: 'פנקייק' });
    expect(screen.queryByRole('link', { name: 'עריכה' })).toBeNull();
  });

  it('links an editor to the edit form', async () => {
    serveSession('editor');
    serve(recipe());
    renderDetail('r1');
    const edit = await screen.findByRole('link', { name: 'עריכה' });
    expect(edit.getAttribute('href')).toBe('/recipes/r1/edit');
  });

  it('shows tags, times, title, ingredients, numbered steps', async () => {
    serve(recipe({ description: 'ארוחת בוקר קלאסית' }));
    renderDetail('r1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'פנקייק' }),
    ).toBeTruthy();
    expect(screen.getByText('בוקר')).toBeTruthy();
    expect(screen.getByText('הכנה: 10 דק׳')).toBeTruthy();
    expect(screen.getByText('בישול: 1 שע׳ 15 דק׳')).toBeTruthy();
    expect(screen.getByText('ארוחת בוקר קלאסית')).toBeTruthy();
    expect(document.title).toBe('פנקייק · ביס & סיר');

    const board = screen.getByRole('heading', { name: 'מצרכים' }).parentElement;
    expect(
      within(board as HTMLElement).getByRole('checkbox', {
        name: '2 כוסות קמח מנופה',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'מלח — לפי הטעם' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'אופן הכנה' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'מערבבים' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'אופים' })).toBeTruthy();
  });

  describe('the back button', () => {
    it('goes back to the library with its filters after an in-app visit', async () => {
      serve(recipe());
      renderDetail('r1', '/?q=%D7%A9&tags=t1');
      const back = await screen.findByRole('link', { name: 'חזרה למתכונים' });
      expect(back.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
      await userEvent.click(back);
      expect(
        await screen.findByText(/library stub \?q=.*&tags=t1/),
      ).toBeTruthy();
    });

    it('links to the library on a direct visit', async () => {
      serve(recipe());
      renderDetail('r1');
      const back = await screen.findByRole('link', { name: 'חזרה למתכונים' });
      expect(back.getAttribute('href')).toBe('/');
      await userEvent.click(back);
      expect(await screen.findByText('library stub')).toBeTruthy();
    });
  });

  it('uses singular and plural unit labels and trims decimals', async () => {
    serve(
      recipe({
        ingredients: [
          { ...recipe().ingredients[0], amount: 1, unit: 'cup', note: null },
          {
            ...recipe().ingredients[0],
            id: 'i3',
            amount: 1.5,
            unit: 'tbsp',
            name: 'סוכר',
            note: null,
          },
          {
            ...recipe().ingredients[0],
            id: 'i4',
            amount: 3,
            unit: null,
            name: 'ביצים',
            note: null,
          },
        ],
      }),
    );
    renderDetail('r1');
    expect(
      await screen.findByRole('checkbox', { name: '1 כוס קמח' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: '1.5 כפות סוכר' }),
    ).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '3 ביצים' })).toBeTruthy();
  });

  it('has a Hebrew label for every unit the API can send', () => {
    const { exists } = initI18n();
    for (const unit of schemas.zUnit.options) {
      expect(exists(`units.${unit}_one` as never)).toBe(true);
      expect(exists(`units.${unit}_other` as never)).toBe(true);
    }
  });

  it('shows notes as text with line breaks kept, never as HTML', async () => {
    serve(recipe({ notes: 'שורה ראשונה\nשורה <b>שנייה</b>' }));
    renderDetail('r1');
    const heading = await screen.findByRole('heading', {
      name: 'הערות וטיפים',
    });
    const notes = heading.nextElementSibling as HTMLElement;
    expect(notes.textContent).toBe('שורה ראשונה\nשורה <b>שנייה</b>');
    expect(notes.querySelector('b')).toBeNull();
    expect(notes.className).toContain('whitespace-pre-line');
  });

  it('has no notes section, description or source link when there are none', async () => {
    serve(recipe());
    renderDetail('r1');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('heading', { name: 'הערות וטיפים' })).toBeNull();
    expect(screen.queryByRole('link', { name: /למתכון המקורי/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'הצג מתכון מקורי' }),
    ).toBeNull();
  });

  it('links to the source for web URLs only', async () => {
    serve(recipe({ source_url: 'https://example.com/pancakes' }));
    const { unmount } = renderDetail('r1');
    const link = await screen.findByRole('link', { name: /למתכון המקורי/ });
    expect(link.getAttribute('href')).toBe('https://example.com/pancakes');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('example.com');
    unmount();

    // eslint-disable-next-line no-script-url -- the test is that it is not linked
    serve(recipe({ source_url: 'javascript:alert(1)' }));
    renderDetail('r1');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /למתכון המקורי/ })).toBeNull();
  });

  it('skips the source link for a URL that does not parse', async () => {
    serve(recipe({ source_url: 'not a url' }));
    renderDetail('r1');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /למתכון המקורי/ })).toBeNull();
  });

  it('shows the FR-7 original hint, linked to its line', async () => {
    serve(
      recipe({
        ingredients: [
          {
            ...recipe().ingredients[0],
            note: null,
            original: { amount: 1.5, unit: 'cup' },
          },
          {
            ...recipe().ingredients[0],
            id: 'i5',
            name: 'שמרים',
            note: null,
            original: { amount: null, unit: null },
          },
          {
            ...recipe().ingredients[0],
            id: 'i6',
            name: 'ביצים',
            note: null,
            original: { amount: 2, unit: null },
          },
        ],
      }),
    );
    renderDetail('r1');
    const box = await screen.findByRole('checkbox', { name: '2 כוסות קמח' });
    expect(box.getAttribute('aria-describedby')).toBe(
      screen.getByText('במקור 1.5 כוסות').id,
    );
    expect(screen.getByText('במקור: לפי הטעם')).toBeTruthy();
    expect(screen.getByText('במקור 2')).toBeTruthy();
    // The hint is separate from the converted-values toggle.
    expect(
      screen.queryByRole('button', { name: 'הצג מתכון מקורי' }),
    ).toBeNull();
  });

  describe('the original-recipe toggle', () => {
    const converted = recipe({
      ingredients: [
        {
          ...recipe().ingredients[0],
          name: 'גבינה',
          note: null,
          amount: 227,
          unit: 'g',
          source: { amount: 8, unit: 'oz' },
        },
      ],
      steps: [
        { id: 's1', description: 'אופים ב־180', source_text: 'Bake at 350F' },
        { id: 's2', description: 'מגישים', source_text: null },
      ],
    });

    it('is off by default and shows source values and original steps when on', async () => {
      serve(converted);
      renderDetail('r1');
      const toggle = await screen.findByRole('button', {
        name: 'הצג מתכון מקורי',
      });
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(
        screen.getByRole('checkbox', { name: '227 גרם גבינה' }),
      ).toBeTruthy();
      expect(screen.queryByText('במקור: Bake at 350F')).toBeNull();

      await userEvent.click(toggle);
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(
        screen.getByRole('checkbox', { name: '8 oz (227 גרם) גבינה' }),
      ).toBeTruthy();
      expect(screen.getByText('במקור: Bake at 350F')).toBeTruthy();

      await userEvent.click(toggle);
      expect(screen.queryByText('במקור: Bake at 350F')).toBeNull();
    });

    it('also appears when only a step was converted', async () => {
      serve(recipe({ steps: converted.steps }));
      renderDetail('r1');
      expect(
        await screen.findByRole('button', { name: 'הצג מתכון מקורי' }),
      ).toBeTruthy();
    });

    it('formats source units that have no unit label', async () => {
      serve(
        recipe({
          ingredients: [
            {
              ...converted.ingredients[0],
              source: { amount: 1, unit: 'fl_oz' },
            },
          ],
        }),
      );
      renderDetail('r1');
      await userEvent.click(
        await screen.findByRole('button', { name: 'הצג מתכון מקורי' }),
      );
      expect(screen.getByRole('checkbox', { name: /^1 fl oz/ })).toBeTruthy();
    });
  });

  describe('scaling servings', () => {
    const scalable = recipe({
      ingredients: [
        { ...recipe().ingredients[0], note: null, amount: 2, unit: 'cup' },
        {
          ...recipe().ingredients[0],
          id: 'i2',
          name: 'שום',
          note: null,
          amount: 1,
          unit: 'clove',
        },
        {
          ...recipe().ingredients[0],
          id: 'i3',
          name: 'גבינה',
          note: null,
          amount: 227,
          unit: 'g',
          source: { amount: 8, unit: 'oz' },
          original: { amount: 1, unit: 'cup' },
        },
        {
          ...recipe().ingredients[0],
          id: 'i4',
          name: 'מלח',
          note: null,
          amount: null,
          unit: null,
        },
      ],
    });

    it('scales every amount without a server call and never touches to-taste', async () => {
      serve(scalable);
      renderDetail('r1');
      const more = await screen.findByRole('button', { name: 'יותר מנות' });
      const requests = vi.fn();
      server.events.on('request:start', requests);
      for (let n = 0; n < 6; n++) await userEvent.click(more);
      server.events.removeListener('request:start', requests);

      expect(requests).not.toHaveBeenCalled();
      expect(
        (screen.getByRole('textbox', { name: 'מספר מנות' }) as HTMLInputElement)
          .value,
      ).toBe('10');
      expect(screen.getByRole('status').textContent).toBe('10 מנות');
      expect(
        screen.getByRole('checkbox', { name: '5 כוסות קמח' }),
      ).toBeTruthy();
      // 1 × 10/4 = 2.5, a countable unit in halves
      expect(
        screen.getByRole('checkbox', { name: '2.5 שיניים שום' }),
      ).toBeTruthy();
      expect(
        screen.getByRole('checkbox', { name: '567.5 גרם גבינה' }),
      ).toBeTruthy();
      expect(screen.getByText('במקור 2.5 כוסות')).toBeTruthy();
      expect(
        screen.getByRole('checkbox', { name: 'מלח — לפי הטעם' }),
      ).toBeTruthy();
    });

    it('scales the source value too', async () => {
      serve(scalable);
      renderDetail('r1');
      await userEvent.click(
        await screen.findByRole('button', { name: 'הצג מתכון מקורי' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'יותר מנות' }));
      await userEvent.click(screen.getByRole('button', { name: 'יותר מנות' }));
      expect(
        screen.getByRole('checkbox', { name: '12 oz (340.5 גרם) גבינה' }),
      ).toBeTruthy();
    });

    it('offers a way back to the base servings, only when changed', async () => {
      serve(scalable);
      renderDetail('r1');
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByRole('button', { name: 'חזרה ל־4' })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'יותר מנות' }));
      expect(
        screen.getByRole('checkbox', { name: '2.5 כוסות קמח' }),
      ).toBeTruthy();
      await userEvent.click(screen.getByRole('button', { name: 'חזרה ל־4' }));
      expect(
        screen.getByRole('checkbox', { name: '2 כוסות קמח' }),
      ).toBeTruthy();
    });

    it('remembers the servings per recipe across a reload', async () => {
      serve(scalable);
      const { unmount } = renderDetail('r1');
      await userEvent.click(
        await screen.findByRole('button', { name: 'יותר מנות' }),
      );
      unmount();
      renderDetail('r1');
      expect(
        await screen.findByRole('checkbox', { name: '2.5 כוסות קמח' }),
      ).toBeTruthy();
    });

    it('accepts a typed value and explains the range', async () => {
      serve(scalable);
      renderDetail('r1');
      const field = await screen.findByRole('textbox', { name: 'מספר מנות' });
      await userEvent.clear(field);
      await userEvent.type(field, '200');
      expect(screen.getByText('אפשר להזין מספר בין 1 ל־100')).toBeTruthy();
      await userEvent.clear(field);
      await userEvent.type(field, '8');
      expect(
        screen.getByRole('checkbox', { name: '4 כוסות קמח' }),
      ).toBeTruthy();
    });
  });

  describe('ticking off', () => {
    it('keeps ticks per recipe in this browser and clears them', async () => {
      serve(recipe());
      const { unmount } = renderDetail('r1');
      const flour = await screen.findByRole('checkbox', {
        name: '2 כוסות קמח מנופה',
      });
      expect(
        screen.queryByRole('button', { name: 'ניקוי סימונים' }),
      ).toBeNull();

      await userEvent.click(flour);
      await userEvent.click(screen.getByRole('checkbox', { name: 'מערבבים' }));
      expect((flour as HTMLInputElement).checked).toBe(true);
      expect(JSON.parse(localStorage.getItem('bb:checks:r1') ?? '')).toEqual([
        'i1',
        's1',
      ]);

      unmount();
      renderDetail('r1');
      const again = await screen.findByRole('checkbox', {
        name: '2 כוסות קמח מנופה',
      });
      expect((again as HTMLInputElement).checked).toBe(true);

      await userEvent.click(again);
      expect((again as HTMLInputElement).checked).toBe(false);

      await userEvent.click(
        screen.getByRole('button', { name: 'ניקוי סימונים' }),
      );
      expect(
        screen
          .getAllByRole('checkbox')
          .every((box) => !(box as HTMLInputElement).checked),
      ).toBe(true);
      expect(localStorage.getItem('bb:checks:r1')).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'ניקוי סימונים' }),
      ).toBeNull();
    });

    it('keeps working when storage fails', async () => {
      serve(recipe());
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      renderDetail('r1');
      const flour = await screen.findByRole('checkbox', {
        name: '2 כוסות קמח מנופה',
      });
      await userEvent.click(flour);
      expect((flour as HTMLInputElement).checked).toBe(true);
      vi.restoreAllMocks();
    });
  });

  it('shows a skeleton while loading', async () => {
    server.use(
      http.get('*/api/recipes/:id', async () => {
        await delay(50);
        return HttpResponse.json(recipe());
      }),
    );
    renderDetail('r1');
    expect(screen.getByRole('status', { name: 'טוען מתכון' })).toBeTruthy();
    await screen.findByRole('heading', { level: 1, name: 'פנקייק' });
    expect(screen.queryByRole('status', { name: 'טוען מתכון' })).toBeNull();
  });

  it('says the recipe was not found and links back to the list', async () => {
    server.use(
      http.get('*/api/recipes/:id', () =>
        HttpResponse.json(
          { detail: 'nope', code: 'recipe_not_found' },
          { status: 404 },
        ),
      ),
    );
    renderDetail('missing');
    expect(await screen.findByText('המתכון לא נמצא')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'חזרה לרשימה' }).getAttribute('href'),
    ).toBe('/');
    expect(screen.queryByRole('button', { name: 'לנסות שוב' })).toBeNull();
  });

  it('offers a retry for other errors', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/recipes/:id', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ detail: 'boom' }, { status: 500 })
          : HttpResponse.json(recipe());
      }),
    );
    renderDetail('r1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'לנסות שוב' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'פנקייק' }),
      ).toBeTruthy(),
    );
  });
});
