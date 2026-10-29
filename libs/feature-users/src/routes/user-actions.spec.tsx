import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { UserRead } from '@bite-and-board/data-access';
import { server } from '../testing/server';
import {
  ADI,
  DANA,
  renderUsers,
  serveSession,
  serveUsers,
} from '../testing/render-users';
import { labelled } from '../testing/labelled';

type User = ReturnType<typeof userEvent.setup>;

const BOB: UserRead = {
  ...DANA,
  id: 'u3',
  email: 'bob@example.com',
  name: 'Bob',
  is_blocked: false,
};
const EDEN: UserRead = {
  ...ADI,
  id: 'u4',
  email: 'eden@example.com',
  name: 'Eden',
};

beforeEach(() => serveSession(ADI));

const openMenu = async (user: User, name: string) => {
  await user.click(
    await screen.findByRole('button', { name: `פעולות עבור ${name}` }),
  );
  return screen.findByRole('menu');
};

interface PatchCall {
  id: string;
  body: unknown;
  csrf: string | null;
}

/** A PATCH handler that records the call and answers with the changed user. */
function servePatch(users: UserRead[], calls: PatchCall[] = []) {
  server.use(
    http.get('*/api/users', () => HttpResponse.json(users)),
    http.patch('*/api/users/:id', async ({ request, params }) => {
      const body = (await request.json()) as Partial<UserRead> & {
        password?: string;
      };
      calls.push({
        id: String(params.id),
        body,
        csrf: request.headers.get('X-Requested-With'),
      });
      const target = users.find((u) => u.id === params.id);
      if (!target) return HttpResponse.json({}, { status: 404 });
      const { password: _password, ...changes } = body;
      Object.assign(target, changes);
      return HttpResponse.json(target);
    }),
  );
  return calls;
}

describe('the actions menu', () => {
  it('has one menu per user, named after them', async () => {
    serveUsers([ADI, DANA]);
    renderUsers();

    expect(
      await screen.findByRole('button', { name: 'פעולות עבור Adi' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'פעולות עבור Dana' }),
    ).toBeTruthy();
  });

  it('offers role, block and reset, worded for the current state', async () => {
    const user = userEvent.setup();
    serveUsers([ADI, BOB, DANA]);
    renderUsers();

    const bob = within(await openMenu(user, 'Bob'));
    expect(bob.getByRole('menuitem', { name: 'הפיכה למנהל' })).toBeTruthy();
    expect(bob.getByRole('menuitem', { name: 'חסימה' })).toBeTruthy();
    expect(bob.getByRole('menuitem', { name: 'איפוס סיסמה' })).toBeTruthy();
    await user.keyboard('{Escape}');

    const dana = within(await openMenu(user, 'Dana'));
    expect(dana.getByRole('menuitem', { name: 'ביטול חסימה' })).toBeTruthy();
    expect(dana.queryByRole('menuitem', { name: 'חסימה' })).toBeNull();
  });

  it('offers an admin "הפיכה לעורך" instead', async () => {
    const user = userEvent.setup();
    serveUsers([ADI, EDEN]);
    renderUsers();

    const menu = within(await openMenu(user, 'Eden'));

    expect(menu.getByRole('menuitem', { name: 'הפיכה לעורך' })).toBeTruthy();
    expect(menu.queryByRole('menuitem', { name: 'הפיכה למנהל' })).toBeNull();
  });

  it("has no password reset on the signed-in admin's own row", async () => {
    const user = userEvent.setup();
    serveUsers([ADI, EDEN]);
    renderUsers();

    const menu = within(await openMenu(user, 'Adi'));

    expect(menu.getByRole('menuitem', { name: 'הפיכה לעורך' })).toBeTruthy();
    expect(menu.queryByRole('menuitem', { name: 'איפוס סיסמה' })).toBeNull();
  });

  it('disables role and block for the last active admin, and says why', async () => {
    const user = userEvent.setup();
    serveUsers([ADI, DANA]);
    renderUsers();

    const menu = within(await openMenu(user, 'Adi'));

    expect(menu.getByText('חייב להישאר מנהל אחד לפחות')).toBeTruthy();
    expect(
      menu
        .getByRole('menuitem', { name: 'הפיכה לעורך' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      menu
        .getByRole('menuitem', { name: 'חסימה' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('does not count a blocked admin when deciding who is the last one', async () => {
    const user = userEvent.setup();
    serveUsers([ADI, { ...EDEN, is_blocked: true }]);
    renderUsers();

    const menu = within(await openMenu(user, 'Adi'));

    expect(menu.getByText('חייב להישאר מנהל אחד לפחות')).toBeTruthy();
  });

  it('keeps every control enabled while a second admin is active', async () => {
    const user = userEvent.setup();
    serveUsers([ADI, EDEN]);
    renderUsers();

    const menu = within(await openMenu(user, 'Adi'));

    expect(menu.queryByText('חייב להישאר מנהל אחד לפחות')).toBeNull();
    expect(
      menu
        .getByRole('menuitem', { name: 'הפיכה לעורך' })
        .getAttribute('aria-disabled'),
    ).toBeNull();
  });
});

describe('changing a role or blocking', () => {
  it('asks first, naming the user, and does nothing on cancel', async () => {
    const user = userEvent.setup();
    const calls = servePatch([ADI, BOB]);
    renderUsers();
    await openMenu(user, 'Bob');

    await user.click(screen.getByRole('menuitem', { name: 'הפיכה למנהל' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'להפוך את Bob למנהל?',
    });
    expect(dialog.textContent).toContain('Bob יוכל לנהל משתמשים');
    await user.click(within(dialog).getByRole('button', { name: 'ביטול' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls).toEqual([]);
  });

  it('promotes after confirming, refreshes the list and closes', async () => {
    const user = userEvent.setup();
    const calls = servePatch([ADI, { ...BOB }]);
    renderUsers();
    await openMenu(user, 'Bob');

    await user.click(screen.getByRole('menuitem', { name: 'הפיכה למנהל' }));
    await user.click(
      await screen.findByRole('button', { name: 'הפיכה למנהל' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls).toEqual([
      { id: 'u3', body: { role: 'admin' }, csrf: 'bite-and-board' },
    ]);
    const bobRow = (await screen.findByText('bob@example.com')).closest('li');
    await waitFor(() =>
      expect(within(bobRow as HTMLElement).getByText('מנהל')).toBeTruthy(),
    );
  });

  it('demotes an admin', async () => {
    const user = userEvent.setup();
    const calls = servePatch([ADI, { ...EDEN }]);
    renderUsers();
    await openMenu(user, 'Eden');

    await user.click(screen.getByRole('menuitem', { name: 'הפיכה לעורך' }));
    await user.click(
      await screen.findByRole('button', { name: 'הפיכה לעורך' }),
    );

    await waitFor(() =>
      expect(calls).toEqual([
        { id: 'u4', body: { role: 'editor' }, csrf: 'bite-and-board' },
      ]),
    );
  });

  it('blocks after confirming and shows the blocked label', async () => {
    const user = userEvent.setup();
    const calls = servePatch([ADI, { ...BOB }]);
    renderUsers();
    await openMenu(user, 'Bob');

    await user.click(screen.getByRole('menuitem', { name: 'חסימה' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'לחסום את Bob?',
    });
    expect(
      within(dialog)
        .getByRole('button', { name: 'חסימה' })
        .getAttribute('data-variant'),
    ).toBe('destructive');
    await user.click(within(dialog).getByRole('button', { name: 'חסימה' }));

    await waitFor(() =>
      expect(calls).toEqual([
        { id: 'u3', body: { is_blocked: true }, csrf: 'bite-and-board' },
      ]),
    );
    const bobRow = (await screen.findByText('bob@example.com')).closest('li');
    await waitFor(() =>
      expect(within(bobRow as HTMLElement).getByText('חסום')).toBeTruthy(),
    );
  });

  it('unblocks after confirming', async () => {
    const user = userEvent.setup();
    const calls = servePatch([ADI, { ...DANA }]);
    renderUsers();
    await openMenu(user, 'Dana');

    await user.click(screen.getByRole('menuitem', { name: 'ביטול חסימה' }));
    await screen.findByRole('alertdialog', {
      name: 'לבטל את החסימה של Dana?',
    });
    await user.click(screen.getByRole('button', { name: 'ביטול חסימה' }));

    await waitFor(() =>
      expect(calls).toEqual([
        { id: 'u2', body: { is_blocked: false }, csrf: 'bite-and-board' },
      ]),
    );
    await waitFor(() => expect(screen.queryByText('חסום')).toBeNull());
  });

  it('keeps the dialog open and shows the reason when the server refuses', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/users', () => HttpResponse.json([ADI, EDEN])),
      http.patch('*/api/users/:id', () =>
        HttpResponse.json(
          { detail: 'last', code: 'last_admin' },
          { status: 409 },
        ),
      ),
    );
    renderUsers();
    await openMenu(user, 'Eden');

    await user.click(screen.getByRole('menuitem', { name: 'חסימה' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'חסימה',
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'חייב להישאר מנהל אחד לפחות',
      ),
    );
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('forgets an old error when the dialog is opened again', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/users', () => HttpResponse.json([ADI, EDEN])),
      http.patch('*/api/users/:id', () =>
        HttpResponse.json({ detail: 'x', code: 'forbidden' }, { status: 403 }),
      ),
    );
    renderUsers();
    await openMenu(user, 'Eden');
    await user.click(screen.getByRole('menuitem', { name: 'חסימה' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'חסימה' }));
    await within(dialog).findByText('אין הרשאה לפעולה הזאת');
    await user.click(within(dialog).getByRole('button', { name: 'ביטול' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    await openMenu(user, 'Eden');
    await user.click(screen.getByRole('menuitem', { name: 'חסימה' }));

    expect((await screen.findByRole('alert')).textContent).toBe('');
  });

  it('sends the admin home after they step down themselves', async () => {
    const user = userEvent.setup();
    const calls = servePatch([{ ...ADI }, EDEN]);
    let sessionReads = 0;
    server.use(
      http.get('*/api/auth/session', () => {
        sessionReads += 1;
        return HttpResponse.json({
          user: {
            id: 'u1',
            email: ADI.email,
            name: ADI.name,
            role: sessionReads > 1 ? 'editor' : 'admin',
          },
        });
      }),
    );
    const { router } = renderUsers();
    await openMenu(user, 'Adi');

    await user.click(screen.getByRole('menuitem', { name: 'הפיכה לעורך' }));
    await user.click(
      await screen.findByRole('button', { name: 'הפיכה לעורך' }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(calls).toEqual([
      { id: 'u1', body: { role: 'editor' }, csrf: 'bite-and-board' },
    ]);
    expect(sessionReads).toBeGreaterThan(1);
  });
});

describe('resetting a password', () => {
  const openReset = async (user: User, name = 'Dana') => {
    await openMenu(user, name);
    await user.click(screen.getByRole('menuitem', { name: 'איפוס סיסמה' }));
    return screen.findByRole('dialog', { name: `איפוס הסיסמה של ${name}` });
  };
  const typeInto = (user: User, label: string, text: string) =>
    user.type(screen.getByLabelText(labelled(label)), text);

  it('opens a form naming the user, with LTR password fields', async () => {
    const user = userEvent.setup();
    servePatch([ADI, { ...DANA }]);
    renderUsers();

    const dialog = await openReset(user);

    expect(dialog.textContent).toContain('Dana ינותק מכל המכשירים');
    for (const label of ['סיסמה חדשה', 'אימות סיסמה']) {
      const field = within(dialog).getByLabelText(labelled(label));
      expect(field.getAttribute('type')).toBe('password');
      expect(field.getAttribute('dir')).toBe('ltr');
    }
  });

  it('marks both password fields as required and explains the star', async () => {
    const user = userEvent.setup();
    servePatch([ADI, { ...DANA }]);
    renderUsers();

    const dialog = await openReset(user);

    expect(
      within(dialog)
        .getByText(/שדות המסומנים/)
        .closest('p')?.textContent,
    ).toBe('שדות המסומנים ב־* הם שדות חובה');
    for (const label of ['סיסמה חדשה', 'אימות סיסמה']) {
      const field = within(dialog).getByLabelText(labelled(label));
      expect(field.getAttribute('aria-required')).toBe('true');
      expect(field.closest('div')?.querySelector('label')?.textContent).toBe(
        `${label} *`,
      );
    }
  });

  it('checks length and confirmation before sending anything', async () => {
    const user = userEvent.setup();
    const calls = servePatch([ADI, { ...DANA }]);
    renderUsers();
    await openReset(user);

    await user.click(screen.getByRole('button', { name: 'איפוס' }));
    expect(await screen.findByText('יש להזין סיסמה')).toBeTruthy();

    await typeInto(user, 'סיסמה חדשה', 'short');
    await typeInto(user, 'אימות סיסמה', 'different');
    await user.click(screen.getByRole('button', { name: 'איפוס' }));

    expect(
      await screen.findByText('הסיסמה חייבת להכיל לפחות 8 תווים'),
    ).toBeTruthy();
    expect(screen.getByText('הסיסמאות אינן זהות')).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it('sets the new password, then closes', async () => {
    const user = userEvent.setup();
    const calls = servePatch([ADI, { ...DANA }]);
    renderUsers();
    await openReset(user);

    await typeInto(user, 'סיסמה חדשה', 'a brand new one');
    await typeInto(user, 'אימות סיסמה', 'a brand new one');
    await user.click(screen.getByRole('button', { name: 'איפוס' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls).toEqual([
      {
        id: 'u2',
        body: { password: 'a brand new one' },
        csrf: 'bite-and-board',
      },
    ]);
  });

  it('shows a password the server rejects on the password field', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/users', () => HttpResponse.json([ADI, DANA])),
      http.patch('*/api/users/:id', () =>
        HttpResponse.json(
          { detail: 'long', code: 'password_too_long', params: { max: 128 } },
          { status: 422 },
        ),
      ),
    );
    renderUsers();
    await openReset(user);

    await typeInto(user, 'סיסמה חדשה', 'a brand new one');
    await typeInto(user, 'אימות סיסמה', 'a brand new one');
    await user.click(screen.getByRole('button', { name: 'איפוס' }));

    const message = await screen.findByText('הסיסמה יכולה להכיל עד 128 תווים');
    expect(
      screen
        .getByLabelText(labelled('סיסמה חדשה'))
        .getAttribute('aria-describedby'),
    ).toBe(message.id);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows any other failure under the form', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/users', () => HttpResponse.json([ADI, DANA])),
      http.patch('*/api/users/:id', () =>
        HttpResponse.json(
          { detail: 'gone', code: 'user_not_found' },
          { status: 404 },
        ),
      ),
    );
    renderUsers();
    await openReset(user);

    await typeInto(user, 'סיסמה חדשה', 'a brand new one');
    await typeInto(user, 'אימות סיסמה', 'a brand new one');
    await user.click(screen.getByRole('button', { name: 'איפוס' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('המשתמש לא נמצא'),
    );
  });

  it('cancels, and reopens empty', async () => {
    const user = userEvent.setup();
    servePatch([ADI, { ...DANA }]);
    renderUsers();
    await openReset(user);
    await typeInto(user, 'סיסמה חדשה', 'something');

    await user.click(screen.getByRole('button', { name: 'ביטול' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await openReset(user);
    expect(
      (screen.getByLabelText(labelled('סיסמה חדשה')) as HTMLInputElement).value,
    ).toBe('');
  });
});
