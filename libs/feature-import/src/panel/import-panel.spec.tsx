import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import type { DraftRecipe } from '@bite-and-board/data-access';
import { renderPanel } from '../testing/render-import';
import { server } from '../testing/server';

const DRAFT: DraftRecipe = {
  title: 'עוגיות שוקולד',
  ingredients: [{ name: 'קמח', amount: 2, unit: 'cup' }],
  steps: [{ description: 'מערבבים.' }],
  tags: ['קינוח'],
  new_tags: [],
  missing_fields: [],
};

/** Answers POST /api/imports/text with this draft and returns what was sent. */
function serveDraft(wait = 0) {
  const sent: unknown[] = [];
  server.use(
    http.post('*/api/imports/text', async ({ request }) => {
      sent.push(await request.json());
      if (wait) await delay(wait);
      return HttpResponse.json(DRAFT);
    }),
  );
  return sent;
}

function serveError(status: number, code: string, params?: object) {
  server.use(
    http.post('*/api/imports/text', () =>
      HttpResponse.json({ detail: code, code, params }, { status }),
    ),
  );
}

const open = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'ייבוא עם בינה מלאכותית' }));
const textbox = () => screen.getByRole('textbox', { name: /^טקסט המתכון/ });
const submit = () => screen.getByRole('button', { name: 'יצירת טיוטה' });

describe('ImportPanel', () => {
  it('starts as a single button and opens the paste form', async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(screen.queryByRole('textbox')).toBeNull();
    await open(user);
    expect(textbox()).toBeTruthy();
  });

  it('closes again without sending anything', async () => {
    const sent = serveDraft();
    const user = userEvent.setup();
    renderPanel();
    await open(user);
    await user.click(screen.getByRole('button', { name: 'סגירת הייבוא' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('asks for text instead of sending an empty request', async () => {
    const sent = serveDraft();
    const user = userEvent.setup();
    const { onBusyChange } = renderPanel();
    await open(user);
    await user.type(textbox(), '   ');
    await user.click(submit());
    expect(await screen.findByText('צריך להדביק טקסט של מתכון')).toBeTruthy();
    expect(sent).toHaveLength(0);
    expect(onBusyChange).not.toHaveBeenCalled();
  });

  it('hands the draft to the page, closes, and says the form was filled', async () => {
    const sent = serveDraft();
    const user = userEvent.setup();
    const { onDraft, onBusyChange } = renderPanel();
    await open(user);
    await user.type(textbox(), 'עוגיות: 2 כוסות קמח');
    await user.click(submit());
    expect(
      await screen.findByText('המתכון יובא. כדאי לבדוק את השדות לפני השמירה.'),
    ).toBeTruthy();
    expect(sent).toEqual([{ text: 'עוגיות: 2 כוסות קמח' }]);
    expect(onDraft).toHaveBeenCalledExactlyOnceWith(DRAFT);
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows progress, tells the page it is busy, and blocks a second request', async () => {
    const sent = serveDraft(150);
    const user = userEvent.setup();
    const { onBusyChange } = renderPanel();
    await open(user);
    await user.type(textbox(), 'מתכון');
    await user.click(submit());
    expect(
      await screen.findByText('מכינים טיוטה. זה יכול לקחת כמה שניות.'),
    ).toBeTruthy();
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'מכינים טיוטה' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(textbox()).toHaveProperty('disabled', true);
    await screen.findByText(/^המתכון יובא/);
    expect(sent).toHaveLength(1);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('asks before replacing what the editor typed, and sends only on confirm', async () => {
    const sent = serveDraft();
    const user = userEvent.setup();
    const { onDraft } = renderPanel({ dirty: true });
    await open(user);
    await user.type(textbox(), 'מתכון');
    await user.click(submit());
    expect(
      await screen.findByRole('alertdialog', { name: 'להחליף את מה שהקלדת?' }),
    ).toBeTruthy();
    expect(sent).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'להחליף' }));
    await screen.findByText(/^המתכון יובא/);
    expect(sent).toHaveLength(1);
    expect(onDraft).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the editor cancels the replacement', async () => {
    const sent = serveDraft();
    const user = userEvent.setup();
    const { onDraft, onBusyChange } = renderPanel({ dirty: true });
    await open(user);
    await user.type(textbox(), 'מתכון');
    await user.click(submit());
    await user.click(await screen.findByRole('button', { name: 'ביטול' }));
    expect(sent).toHaveLength(0);
    expect(onDraft).not.toHaveBeenCalled();
    expect(onBusyChange).not.toHaveBeenCalled();
    // The text is still there to edit.
    expect(textbox()).toHaveProperty('value', 'מתכון');
  });

  it.each([
    [400, 'no_recipe_found', undefined, 'לא נמצא מתכון בטקסט הזה'],
    [
      413,
      'import_text_too_long',
      { max: 20000 },
      'הטקסט ארוך מדי. אפשר להדביק עד 20000 תווים',
    ],
    [
      429,
      'import_cap_reached',
      { cap: 50 },
      'מכסת הייבוא היומית נוצלה. אפשר לנסות שוב מחר',
    ],
    [504, 'llm_timeout', undefined, 'הייבוא לקח יותר מדי זמן. אפשר לנסות שוב'],
    [
      502,
      'llm_invalid_output',
      undefined,
      'לא הצלחנו להפוך את הטקסט למתכון. אפשר לנסות שוב או לערוך את הטקסט',
    ],
    [
      502,
      'provider_unavailable',
      undefined,
      'שירות הייבוא לא זמין כרגע. אפשר לנסות שוב מאוחר יותר',
    ],
  ])(
    'shows the Hebrew message for %i %s, keeps the text and frees the form',
    async (status, code, params, message) => {
      serveError(status, code, params);
      const user = userEvent.setup();
      const { onDraft, onBusyChange } = renderPanel();
      await open(user);
      await user.type(textbox(), 'מתכון שלי');
      await user.click(submit());
      expect(await screen.findByText(message)).toBeTruthy();
      expect(textbox()).toHaveProperty('value', 'מתכון שלי');
      expect(submit()).toHaveProperty('disabled', false);
      expect(onDraft).not.toHaveBeenCalled();
      expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
    },
  );
});
