import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, HttpResponse, http } from 'msw';
import type { RecipeRead } from '@bite-and-board/data-access';
import { toast } from '@bite-and-board/ui-components';
import { renderEdit } from '../testing/render-edit';
import { renderNew } from '../testing/render-new';
import { server } from '../testing/server';

const KEY = 'c'.repeat(32);
const ING = '5d0f7f6e-1d6c-4a52-9a0c-0b1c3f5e0b01';

const SAVED: RecipeRead = {
  id: 'r1',
  title: 'פנקייק',
  description: null,
  notes: null,
  tags: [],
  base_servings: 4,
  prep_time_minutes: null,
  cook_time_minutes: null,
  source_url: null,
  photo: {
    url: '/media/photos/old.webp',
    thumb_url: '/media/photos/old-thumb.webp',
    credit_domain: null,
  },
  ingredients: [
    {
      id: ING,
      name: 'קמח',
      amount: 1,
      unit: 'cup',
      note: null,
      original: null,
      source: null,
    },
  ],
  steps: [{ id: 's1', description: 'מערבבים', source_text: null }],
  created_at: '2026-10-28T12:00:00Z',
  updated_at: '2026-10-28T12:00:00Z',
};

const picture = (name = 'cake.jpg', type = 'image/jpeg') =>
  new File(['pixels'], name, { type });

/**
 * Answers POST /api/photos with a key and returns the names of the files it got;
 * `wait` makes the upload take a while. The body is read as text because jsdom's
 * `File` is not one that Node's multipart parser accepts.
 */
function serveUpload(wait = 0) {
  const names: string[] = [];
  server.use(
    http.post('*/api/photos', async ({ request }) => {
      const body = await request.text();
      names.push(/filename="([^"]+)"/.exec(body)?.[1] ?? '');
      if (wait) await delay(wait);
      return HttpResponse.json({ photo_key: KEY }, { status: 201 });
    }),
  );
  return names;
}

function serveCreate() {
  const sent: Record<string, unknown>[] = [];
  server.use(
    http.post('*/api/recipes', async ({ request }) => {
      sent.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(SAVED, { status: 201 });
    }),
  );
  return sent;
}

function serveEdit(recipe: RecipeRead = SAVED) {
  const sent: Record<string, unknown>[] = [];
  server.use(
    http.get('*/api/recipes/:id', () => HttpResponse.json(recipe)),
    http.put('*/api/recipes/:id', async ({ request }) => {
      sent.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(recipe);
    }),
  );
  return sent;
}

const field = (name: string) =>
  screen.getByLabelText(new RegExp(String.raw`^${name}( \*)?$`));
const save = () => screen.getByRole('button', { name: 'שמירה' });
const fileInput = () =>
  document.querySelector('input[type="file"]') as HTMLInputElement;
const pick = (file: File) =>
  fireEvent.change(fileInput(), { target: { files: [file] } });

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(field('שם המתכון'), 'פשטידת תרד');
  await user.type(field('שם המצרך 1'), 'תרד');
  await user.type(field('שלב 1'), 'אופים');
}

describe('the form photo', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    toast.dismiss();
  });

  describe('a new recipe', () => {
    it('shows the limits beside the field and only "הוספת תמונה" at first', async () => {
      renderNew();
      expect(
        await screen.findByText('JPEG, PNG או WebP, עד 10 מ״ב'),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'הוספת תמונה' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'הסרה' })).toBeNull();
      expect(fileInput().getAttribute('accept')).toBe(
        'image/jpeg,image/png,image/webp',
      );
    });

    it('sits after "קישור למקור" and before the tags', () => {
      renderNew();
      const url = field('קישור למקור');
      const photo = screen.getByRole('group', { name: 'תמונה' });
      const tags = screen.getByText('תגיות');
      const after = Node.DOCUMENT_POSITION_FOLLOWING;
      expect(url.compareDocumentPosition(photo) & after).toBeTruthy();
      expect(photo.compareDocumentPosition(tags) & after).toBeTruthy();
    });

    it('uploads at once, previews the picture, and saves the key with the recipe', async () => {
      const user = userEvent.setup();
      const uploaded = serveUpload();
      const sent = serveCreate();
      renderNew();
      await fillRequired(user);

      pick(picture());
      expect(
        await screen.findByRole('img', { name: 'התמונה שנבחרה למתכון' }),
      ).toBeTruthy();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'החלפה' })).toBeTruthy(),
      );
      expect(uploaded).toEqual(['cake.jpg']);

      await user.click(save());
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]['photo_key']).toBe(KEY);
    });

    it('leaves the photo out of the request when none was chosen', async () => {
      const user = userEvent.setup();
      const sent = serveCreate();
      renderNew();
      await fillRequired(user);
      await user.click(save());
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).not.toHaveProperty('photo_key');
    });

    it('shows a progress bar, disables saving while uploading, and enables it after', async () => {
      const user = userEvent.setup();
      serveUpload(150);
      renderNew();
      await fillRequired(user);
      pick(picture());

      expect(
        await screen.findByRole('progressbar', { name: 'מעלה תמונה' }),
      ).toBeTruthy();
      expect(screen.getByText('מחכים לסיום העלאת התמונה')).toBeTruthy();
      expect((save() as HTMLButtonElement).disabled).toBe(true);

      await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
      expect((save() as HTMLButtonElement).disabled).toBe(false);
      expect(screen.queryByText('מחכים לסיום העלאת התמונה')).toBeNull();
    });

    it('shows the server message for a file it refuses, and keeps the form without a photo', async () => {
      const user = userEvent.setup();
      server.use(
        http.post('*/api/photos', () =>
          HttpResponse.json(
            {
              detail: 'Only JPEG, PNG and WebP images are accepted',
              code: 'photo_unsupported_type',
            },
            { status: 415 },
          ),
        ),
      );
      const sent = serveCreate();
      renderNew();
      await fillRequired(user);
      pick(picture('notes.jpg'));

      expect(
        await screen.findByText('אפשר להעלות תמונה בפורמט JPEG, PNG או WebP'),
      ).toBeTruthy();
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByRole('button', { name: 'הוספת תמונה' })).toBeTruthy();

      await user.click(save());
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).not.toHaveProperty('photo_key');
    });

    it('shows a "too large" answer from the server', async () => {
      server.use(
        http.post('*/api/photos', () =>
          HttpResponse.json(
            { detail: 'The photo is too large', code: 'photo_too_large' },
            { status: 413 },
          ),
        ),
      );
      renderNew();
      pick(picture());
      expect(
        await screen.findByText(
          'התמונה גדולה מדי. אפשר להעלות תמונה קטנה יותר',
        ),
      ).toBeTruthy();
    });

    it('says so when the upload fails without an API answer', async () => {
      server.use(http.post('*/api/photos', () => HttpResponse.error()));
      renderNew();
      pick(picture());
      expect(
        await screen.findByText('העלאת התמונה לא הצליחה. אפשר לנסות שוב'),
      ).toBeTruthy();
    });

    it('refuses a file of the wrong type, or over the limit, without sending it', async () => {
      const uploaded = serveUpload();
      renderNew();
      await screen.findByText('JPEG, PNG או WebP, עד 10 מ״ב');

      pick(picture('notes.txt', 'text/plain'));
      expect(
        await screen.findByText('אפשר להעלות תמונה בפורמט JPEG, PNG או WebP'),
      ).toBeTruthy();

      const big = picture();
      Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
      pick(big);
      expect(
        await screen.findByText(
          'התמונה גדולה מדי. אפשר להעלות תמונה קטנה יותר',
        ),
      ).toBeTruthy();
      expect(uploaded).toEqual([]);
    });

    it('removes a chosen photo before saving, and then sends none', async () => {
      const user = userEvent.setup();
      serveUpload();
      const sent = serveCreate();
      renderNew();
      await fillRequired(user);
      pick(picture());
      await user.click(await screen.findByRole('button', { name: 'הסרה' }));

      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByRole('button', { name: 'הוספת תמונה' })).toBeTruthy();
      await user.click(save());
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).not.toHaveProperty('photo_key');
    });

    it('asks before leaving a form where a photo was chosen', async () => {
      const user = userEvent.setup();
      serveUpload();
      const { router } = renderNew('/');
      pick(picture());
      await screen.findByRole('button', { name: 'החלפה' });
      await user.click(screen.getByRole('link', { name: 'חזרה למתכונים' }));
      expect(await screen.findByText('לצאת בלי לשמור?')).toBeTruthy();
      expect(router.state.location.pathname).toBe('/recipes/new');
    });
  });

  describe('an existing recipe', () => {
    it('shows its photo with "החלפה" and "הסרה"', async () => {
      serveEdit();
      renderEdit('r1');
      const photo = await screen.findByRole('img', {
        name: 'התמונה שנבחרה למתכון',
      });
      expect(photo.getAttribute('src')).toBe('/media/photos/old-thumb.webp');
      expect(screen.getByRole('button', { name: 'החלפה' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'הסרה' })).toBeTruthy();
    });

    it('keeps the saved photo when the form is saved without touching it', async () => {
      const user = userEvent.setup();
      const sent = serveEdit();
      renderEdit('r1');
      await screen.findByDisplayValue('פנקייק');
      await user.type(field('שם המתכון'), '!');
      await user.click(save());
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).not.toHaveProperty('photo_key');
    });

    it('replaces the photo: uploads the new one and sends its key', async () => {
      const user = userEvent.setup();
      serveUpload();
      const sent = serveEdit();
      renderEdit('r1');
      await screen.findByDisplayValue('פנקייק');
      pick(picture('new.jpg'));
      await waitFor(() =>
        expect(
          screen
            .getByRole('img', { name: 'התמונה שנבחרה למתכון' })
            .getAttribute('src'),
        ).toBe('blob:preview'),
      );
      await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
      await user.click(save());
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]['photo_key']).toBe(KEY);
    });

    it('keeps the saved photo when a replacement fails', async () => {
      server.use(
        http.post('*/api/photos', () =>
          HttpResponse.json(
            { detail: 'x', code: 'photo_unsupported_type' },
            { status: 415 },
          ),
        ),
      );
      const user = userEvent.setup();
      const sent = serveEdit();
      renderEdit('r1');
      await screen.findByDisplayValue('פנקייק');
      pick(picture('new.jpg'));
      expect(
        await screen.findByText('אפשר להעלות תמונה בפורמט JPEG, PNG או WebP'),
      ).toBeTruthy();
      expect(
        screen
          .getByRole('img', { name: 'התמונה שנבחרה למתכון' })
          .getAttribute('src'),
      ).toBe('/media/photos/old-thumb.webp');
      await user.click(save());
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).not.toHaveProperty('photo_key');
    });

    it('removes the photo on save, with no confirmation, by sending null', async () => {
      const user = userEvent.setup();
      const sent = serveEdit();
      renderEdit('r1');
      await user.click(await screen.findByRole('button', { name: 'הסרה' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByRole('button', { name: 'הוספת תמונה' })).toBeTruthy();

      await user.click(save());
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]['photo_key']).toBeNull();
    });

    it('brings the removed photo back with "החזרת התמונה", and then sends nothing about it', async () => {
      const user = userEvent.setup();
      const sent = serveEdit();
      renderEdit('r1');
      await user.click(await screen.findByRole('button', { name: 'הסרה' }));
      await user.click(screen.getByRole('button', { name: 'החזרת התמונה' }));
      expect(
        screen
          .getByRole('img', { name: 'התמונה שנבחרה למתכון' })
          .getAttribute('src'),
      ).toBe('/media/photos/old-thumb.webp');
      expect(screen.queryByRole('button', { name: 'החזרת התמונה' })).toBeNull();

      await user.type(field('שם המתכון'), '!');
      await user.click(save());
      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).not.toHaveProperty('photo_key');
    });

    it('does not offer to bring a photo back on a new recipe', async () => {
      const user = userEvent.setup();
      serveUpload();
      renderNew();
      pick(picture());
      await user.click(await screen.findByRole('button', { name: 'הסרה' }));
      expect(screen.queryByRole('button', { name: 'החזרת התמונה' })).toBeNull();
    });

    it('asks before leaving once the photo was removed', async () => {
      const user = userEvent.setup();
      serveEdit();
      renderEdit('r1');
      await user.click(await screen.findByRole('button', { name: 'הסרה' }));
      await user.click(screen.getByRole('link', { name: 'חזרה למתכון' }));
      expect(await screen.findByText('לצאת בלי לשמור?')).toBeTruthy();
    });

    it('shows no photo and no "הסרה" for a recipe without one', async () => {
      serveEdit({ ...SAVED, photo: null });
      renderEdit('r1');
      await screen.findByDisplayValue('פנקייק');
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.queryByRole('button', { name: 'הסרה' })).toBeNull();
      expect(screen.getByRole('button', { name: 'הוספת תמונה' })).toBeTruthy();
    });
  });
});
