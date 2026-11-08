import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { safetyNetMs, type DraftRecipe } from '@bite-and-board/data-access';
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

type User = ReturnType<typeof userEvent.setup>;

const openPanel = (user: User) =>
  user.click(screen.getByRole('button', { name: 'ייבוא עם בינה מלאכותית' }));
/** Opens the panel on the "הדבקת טקסט" input (the link input is the default). */
const open = async (user: User) => {
  await openPanel(user);
  await user.click(screen.getByRole('radio', { name: 'הדבקת טקסט' }));
};
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
    const sent = serveDraft(800);
    const user = userEvent.setup();
    const { onBusyChange } = renderPanel();
    await open(user);
    await user.type(textbox(), 'מתכון');
    await user.click(submit());
    expect(
      await screen.findByText('מכינים טיוטה. זה יכול לקחת כמה שניות.'),
    ).toBeTruthy();
    expect(onBusyChange).toHaveBeenCalledWith(true);
    // At once: disabled; after the short delay the button shows its working label.
    expect(submit()).toHaveProperty('disabled', true);
    expect(
      await screen.findByRole('button', { name: 'מכינים טיוטה' }),
    ).toHaveProperty('disabled', true);
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
    [400, 'no_recipe_found', undefined, 'לא נמצא כאן מתכון'],
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
    [
      504,
      'llm_timeout',
      undefined,
      'יש בעיה זמנית בשירות ה־AI. אפשר לנסות שוב בעוד כמה דקות.',
    ],
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

describe('ImportPanel link input', () => {
  const linkbox = () => screen.getByRole('textbox', { name: /^קישור למתכון/ });
  const submitLink = () =>
    screen.getByRole('button', { name: 'ייבוא מהקישור' });
  const DRAFT_FROM_URL: DraftRecipe = {
    ...DRAFT,
    source_url: 'https://example.com/cookies',
    photo_source_url: 'https://example.com/cookies.jpg',
  };

  function serveUrl(response: () => Response) {
    const sent: unknown[] = [];
    server.use(
      http.post('*/api/imports/url', async ({ request }) => {
        sent.push(await request.json());
        return response();
      }),
    );
    return sent;
  }

  it('opens on the link input', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openPanel(user);
    expect(
      screen.getByRole('radio', { name: 'קישור' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(linkbox()).toBeTruthy();
  });

  it('sends the trimmed link and hands the draft to the page', async () => {
    const sent = serveUrl(() => HttpResponse.json(DRAFT_FROM_URL));
    const user = userEvent.setup();
    const { onDraft } = renderPanel();
    await openPanel(user);
    await user.type(linkbox(), '  https://example.com/cookies ');
    await user.click(submitLink());
    await screen.findByText(/^המתכון יובא/);
    expect(sent).toEqual([{ url: 'https://example.com/cookies' }]);
    expect(onDraft).toHaveBeenCalledExactlyOnceWith(DRAFT_FROM_URL);
  });

  it.each([
    ['', 'צריך להדביק קישור למתכון'],
    ['example.com/cookies', 'הקישור צריך להתחיל ב-https:// או ב-http://'],
    ['ftp://example.com/x', 'הקישור צריך להתחיל ב-https:// או ב-http://'],
  ])('checks the link %j before sending', async (value, message) => {
    const sent = serveUrl(() => HttpResponse.json(DRAFT));
    const user = userEvent.setup();
    renderPanel();
    await openPanel(user);
    if (value) await user.type(linkbox(), value);
    await user.click(submitLink());
    expect(await screen.findByText(message)).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it.each([
    [
      'fetch_challenged',
      502,
      'האתר חוסם ייבוא אוטומטי. אפשר להעתיק את המתכון מהדף ולהדביק אותו כטקסט',
    ],
    [
      'fetch_blocked',
      400,
      'אי אפשר לייבא מהקישור הזה. אפשר להעתיק את המתכון מהדף ולהדביק אותו כטקסט',
    ],
    [
      'fetch_failed',
      502,
      'לא הצלחנו לפתוח את הקישור. כדאי לבדוק אותו ולנסות שוב, או להדביק את המתכון כטקסט',
    ],
    [
      'fetch_too_large',
      413,
      'הדף גדול מדי לייבוא. אפשר להעתיק את המתכון מהדף ולהדביק אותו כטקסט',
    ],
  ])(
    'on %s offers one click to paste the text instead',
    async (code, status, message) => {
      serveUrl(() => HttpResponse.json({ detail: code, code }, { status }));
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await user.type(linkbox(), 'https://example.com/cookies');
      await user.click(submitLink());
      expect(await screen.findByText(message)).toBeTruthy();
      await user.click(
        screen.getByRole('button', { name: 'להדביק את הטקסט במקום' }),
      );
      expect(textbox()).toBeTruthy();
      expect(screen.queryByText(message)).toBeNull();
    },
  );

  it('does not offer the text switch for other errors', async () => {
    serveUrl(() =>
      HttpResponse.json(
        { detail: 'x', code: 'no_recipe_found' },
        { status: 400 },
      ),
    );
    const user = userEvent.setup();
    renderPanel();
    await openPanel(user);
    await user.type(linkbox(), 'https://example.com/about');
    await user.click(submitLink());
    expect(await screen.findByText('לא נמצא כאן מתכון')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'להדביק את הטקסט במקום' }),
    ).toBeNull();
  });
});

describe('ImportPanel cancel', () => {
  /** A server that never answers; it records when the browser drops the request. */
  function serveForever() {
    const state = { received: 0, aborted: false };
    server.use(
      http.post('*/api/imports/text', async ({ request }) => {
        state.received += 1;
        request.signal.addEventListener('abort', () => {
          state.aborted = true;
        });
        await delay('infinite');
        return HttpResponse.json(DRAFT);
      }),
    );
    return state;
  }

  it('aborts the request and returns to the form with the input kept', async () => {
    const state = serveForever();
    const user = userEvent.setup();
    const { onDraft, onBusyChange } = renderPanel();
    await open(user);
    await user.type(textbox(), 'עוגיות: 2 כוסות קמח');
    await user.click(submit());
    await user.click(await screen.findByRole('button', { name: 'ביטול' }));

    expect(textbox()).toHaveProperty('disabled', false);
    expect((textbox() as HTMLTextAreaElement).value).toBe(
      'עוגיות: 2 כוסות קמח',
    );
    expect(screen.queryByRole('button', { name: 'ביטול' })).toBeNull();
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
    await vi.waitFor(() => expect(state.aborted).toBe(true));
    expect(onDraft).not.toHaveBeenCalled();
  });

  it('shows no error after a cancel', async () => {
    serveForever();
    const user = userEvent.setup();
    renderPanel();
    await open(user);
    await user.type(textbox(), 'מתכון');
    await user.click(submit());
    await user.click(await screen.findByRole('button', { name: 'ביטול' }));
    // Give the aborted request time to reject; nothing may be shown.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/שגיאה|בעיה/)).toBeNull();
    expect(submit()).toHaveProperty('disabled', false);
  });

  it('can import again after a cancel', async () => {
    serveForever();
    const user = userEvent.setup();
    const { onDraft } = renderPanel();
    await open(user);
    await user.type(textbox(), 'מתכון');
    await user.click(submit());
    await user.click(await screen.findByRole('button', { name: 'ביטול' }));
    serveDraft();
    await user.click(submit());
    await screen.findByText(/^המתכון יובא/);
    expect(onDraft).toHaveBeenCalledExactlyOnceWith(DRAFT);
  });

  it('cancels a link import too', async () => {
    let aborted = false;
    server.use(
      http.post('*/api/imports/url', async ({ request }) => {
        request.signal.addEventListener('abort', () => {
          aborted = true;
        });
        await delay('infinite');
        return HttpResponse.json(DRAFT);
      }),
    );
    const user = userEvent.setup();
    renderPanel();
    await openPanel(user);
    const link = () =>
      screen.getByRole<HTMLInputElement>('textbox', { name: /^קישור למתכון/ });
    await user.type(link(), 'https://example.com/cookies');
    await user.click(screen.getByRole('button', { name: 'ייבוא מהקישור' }));
    await user.click(await screen.findByRole('button', { name: 'ביטול' }));
    expect(link().value).toBe('https://example.com/cookies');
    await vi.waitFor(() => expect(aborted).toBe(true));
  });
});

describe('ImportPanel engine errors', () => {
  const TEMPORARY = 'יש בעיה זמנית בשירות ה־AI. אפשר לנסות שוב בעוד כמה דקות.';

  it.each([
    ['llm_timeout', 504, TEMPORARY],
    ['llm_unavailable', 502, TEMPORARY],
    ['llm_quota', 502, TEMPORARY],
    [
      'llm_invalid_output',
      502,
      'לא הצלחנו להפוך את הטקסט למתכון. אפשר לנסות שוב או לערוך את הטקסט',
    ],
    [
      'provider_unavailable',
      400,
      'שירות הייבוא לא זמין כרגע. אפשר לנסות שוב מאוחר יותר',
    ],
  ])('on %s shows Hebrew copy and retries', async (code, status, message) => {
    serveError(status, code);
    const user = userEvent.setup();
    const { onDraft, onBusyChange } = renderPanel();
    await open(user);
    await user.type(textbox(), 'מתכון');
    await user.click(submit());
    expect(await screen.findByText(message)).toBeTruthy();
    expect(onDraft).not.toHaveBeenCalled();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect((textbox() as HTMLTextAreaElement).value).toBe('מתכון');

    const sent = serveDraft();
    await user.click(screen.getByRole('button', { name: 'לנסות שוב' }));
    await screen.findByText(/^המתכון יובא/);
    expect(sent).toEqual([{ text: 'מתכון' }]);
    expect(onDraft).toHaveBeenCalledExactlyOnceWith(DRAFT);
  });

  it('does not offer the text tab when the user is already pasting text', async () => {
    serveError(502, 'llm_unavailable');
    const user = userEvent.setup();
    renderPanel();
    await open(user);
    await user.type(textbox(), 'מתכון');
    await user.click(submit());
    await screen.findByText(TEMPORARY);
    expect(
      screen.queryByRole('button', { name: 'להדביק את הטקסט במקום' }),
    ).toBeNull();
  });

  it('for a link import offers retry and the paste tab', async () => {
    server.use(
      http.post('*/api/imports/url', () =>
        HttpResponse.json(
          { detail: 'x', code: 'llm_unavailable' },
          { status: 502 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPanel();
    await openPanel(user);
    await user.type(
      screen.getByRole('textbox', { name: /^קישור למתכון/ }),
      'https://example.com/cookies',
    );
    await user.click(screen.getByRole('button', { name: 'ייבוא מהקישור' }));
    expect(await screen.findByText(TEMPORARY)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'לנסות שוב' })).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: 'להדביק את הטקסט במקום' }),
    );
    expect(textbox()).toBeTruthy();
    expect(screen.queryByText(TEMPORARY)).toBeNull();
    expect(screen.queryByRole('button', { name: 'לנסות שוב' })).toBeNull();
  });

  it('shows the timeout message when the client gave up waiting', async () => {
    serveError(504, 'request_timeout');
    const user = userEvent.setup();
    renderPanel();
    await open(user);
    await user.type(textbox(), 'מתכון');
    await user.click(submit());
    expect(
      await screen.findByText('הבקשה לקחה יותר מדי זמן. אפשר לנסות שוב'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'לנסות שוב' })).toBeTruthy();
  });

  it('learns the engine timeout from the server', async () => {
    server.use(
      http.get('*/api/imports/providers', () =>
        HttpResponse.json([{ name: 'anthropic', timeout_s: 45 }]),
      ),
    );
    renderPanel();
    await vi.waitFor(() =>
      expect(safetyNetMs('/api/imports/text')).toBe(50_000),
    );
  });
});
