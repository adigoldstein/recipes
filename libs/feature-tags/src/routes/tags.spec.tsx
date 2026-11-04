import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import type { TagRead } from '@bite-and-board/data-access';
import { server } from '../testing/server';
import { renderTags, serveTags } from '../testing/render-tags';

export const SOUP: TagRead = {
  id: 't1',
  name: 'מרק',
  pinned: true,
  recipe_count: 7,
};

export const BBQ: TagRead = {
  id: 't2',
  name: 'על האש',
  pinned: false,
  recipe_count: 1,
};

export const UNUSED: TagRead = {
  id: 't3',
  name: 'ישן',
  pinned: false,
  recipe_count: 0,
};

/** Records the JSON bodies a handler receives. */
function record() {
  const bodies: unknown[] = [];
  return {
    bodies,
    capture: async (request: Request) => {
      bodies.push(await request.json());
    },
  };
}

describe('TagsPage', () => {
  it('lists the tags in the order the server sends, with the controls', async () => {
    serveTags([SOUP, BBQ]);
    renderTags();
    const list = await screen.findByRole('list', { name: 'רשימת התגיות' });
    const names = within(list)
      .getAllByRole('textbox')
      .map((input) => (input as HTMLInputElement).value);
    expect(names).toEqual(['מרק', 'על האש']);
    expect(
      screen.getByRole('button', { name: 'ביטול הנעיצה של מרק' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'נעיצת על האש לסינון מהיר' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'מחיקת מרק' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /חזרה למתכונים/ })).toBeTruthy();
  });

  it('shows an empty state and an error with a retry', async () => {
    serveTags([]);
    renderTags();
    expect(await screen.findByText('עדיין אין תגיות')).toBeTruthy();
  });

  it('shows a retry when the list fails to load', async () => {
    server.use(
      http.get('*/api/tags', () => HttpResponse.json({}, { status: 500 })),
    );
    renderTags();
    expect(
      await screen.findByRole('button', { name: 'לנסות שוב' }),
    ).toBeTruthy();
  });

  it('adds a tag and clears the field', async () => {
    const user = userEvent.setup();
    const seen = record();
    serveTags([SOUP]);
    server.use(
      http.post('*/api/tags', async ({ request }) => {
        await seen.capture(request);
        return HttpResponse.json(
          { id: 't9', name: 'חדש', pinned: false, recipe_count: 0 },
          { status: 201 },
        );
      }),
    );
    renderTags();
    const field = await screen.findByLabelText(/תגית חדשה/);
    await user.type(field, '  חדש ');
    await user.click(screen.getByRole('button', { name: 'הוספה' }));
    await waitFor(() => expect(seen.bodies).toEqual([{ name: 'חדש' }]));
    await waitFor(() => expect((field as HTMLInputElement).value).toBe(''));
  });

  it('refuses an empty name without calling the server', async () => {
    const user = userEvent.setup();
    serveTags([SOUP]);
    renderTags();
    await screen.findByRole('list');
    await user.click(screen.getByRole('button', { name: 'הוספה' }));
    expect(await screen.findByText('צריך להזין שם לתגית')).toBeTruthy();
  });

  it('shows the duplicate-name error when adding', async () => {
    const user = userEvent.setup();
    serveTags([SOUP]);
    server.use(
      http.post('*/api/tags', () =>
        HttpResponse.json(
          { detail: 'taken', code: 'tag_name_taken' },
          { status: 409 },
        ),
      ),
    );
    renderTags();
    await user.type(await screen.findByLabelText(/תגית חדשה/), 'מרק');
    await user.click(screen.getByRole('button', { name: 'הוספה' }));
    expect(await screen.findByText('כבר קיימת תגית בשם הזה')).toBeTruthy();
  });

  it('renames a tag on Enter', async () => {
    const user = userEvent.setup();
    const seen = record();
    serveTags([SOUP]);
    server.use(
      http.patch('*/api/tags/t1', async ({ request }) => {
        await seen.capture(request);
        return HttpResponse.json({ ...SOUP, name: 'מרקים' });
      }),
    );
    renderTags();
    const input = await screen.findByRole('textbox', { name: 'שם התגית מרק' });
    await user.clear(input);
    await user.type(input, 'מרקים{Enter}');
    await waitFor(() => expect(seen.bodies).toEqual([{ name: 'מרקים' }]));
  });

  it('shows the duplicate-name error when renaming', async () => {
    const user = userEvent.setup();
    serveTags([SOUP, BBQ]);
    server.use(
      http.patch('*/api/tags/t2', () =>
        HttpResponse.json(
          { detail: 'taken', code: 'tag_name_taken' },
          { status: 409 },
        ),
      ),
    );
    renderTags();
    const input = await screen.findByRole('textbox', {
      name: 'שם התגית על האש',
    });
    await user.clear(input);
    await user.type(input, 'מרק{Enter}');
    expect(await screen.findByText('כבר קיימת תגית בשם הזה')).toBeTruthy();
  });

  it('puts the old name back on Escape and sends nothing', async () => {
    const user = userEvent.setup();
    const seen = record();
    serveTags([SOUP]);
    server.use(
      http.patch('*/api/tags/t1', async ({ request }) => {
        await seen.capture(request);
        return HttpResponse.json(SOUP);
      }),
    );
    renderTags();
    const input = (await screen.findByRole('textbox', {
      name: 'שם התגית מרק',
    })) as HTMLInputElement;
    await user.type(input, 'xyz{Escape}');
    expect(input.value).toBe('מרק');
    await user.tab();
    expect(seen.bodies).toEqual([]);
  });

  it('pins and unpins with the toggle', async () => {
    const user = userEvent.setup();
    const seen = record();
    serveTags([SOUP, BBQ]);
    server.use(
      http.patch('*/api/tags/:id', async ({ request }) => {
        await seen.capture(request);
        return HttpResponse.json(BBQ);
      }),
    );
    renderTags();
    await user.click(
      await screen.findByRole('button', { name: 'נעיצת על האש לסינון מהיר' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'ביטול הנעיצה של מרק' }),
    );
    await waitFor(() =>
      expect(seen.bodies).toEqual([{ pinned: true }, { pinned: false }]),
    );
  });

  it('confirms a delete with the usage count, then deletes', async () => {
    const user = userEvent.setup();
    let deleted = false;
    serveTags([SOUP]);
    server.use(
      http.delete('*/api/tags/t1', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderTags();
    await user.click(await screen.findByRole('button', { name: 'מחיקת מרק' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('למחוק את התגית מרק?')).toBeTruthy();
    expect(within(dialog).getByText('התגית משויכת ל־7 מתכונים.')).toBeTruthy();
    expect(deleted).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }));
    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('words the usage for one recipe and for none', async () => {
    const user = userEvent.setup();
    serveTags([BBQ, UNUSED]);
    renderTags();
    await user.click(
      await screen.findByRole('button', { name: 'מחיקת על האש' }),
    );
    expect(await screen.findByText('התגית משויכת למתכון אחד.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'ביטול' }));
    await user.click(screen.getByRole('button', { name: 'מחיקת ישן' }));
    expect(await screen.findByText('התגית לא משויכת לאף מתכון.')).toBeTruthy();
  });

  it('keeps the tag when the delete is cancelled', async () => {
    const user = userEvent.setup();
    let deleted = false;
    serveTags([SOUP]);
    server.use(
      http.delete('*/api/tags/t1', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderTags();
    await user.click(await screen.findByRole('button', { name: 'מחיקת מרק' }));
    await user.click(await screen.findByRole('button', { name: 'ביטול' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deleted).toBe(false);
  });
});
