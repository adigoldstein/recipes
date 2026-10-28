import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../testing/server';
import {
  ADI,
  DANA,
  renderUsers,
  serveSession,
  serveUsers,
} from '../testing/render-users';

type User = ReturnType<typeof userEvent.setup>;

const openDialog = async (user: User) => {
  await user.click(await screen.findByRole('button', { name: 'הוספת משתמש' }));
  return screen.findByRole('dialog', { name: 'הוספת משתמש' });
};

const typeInto = (user: User, label: string, text: string) =>
  user.type(screen.getByLabelText(label), text);

/** Fills the whole form with valid values (the role stays "עורך"). */
async function fillValid(user: User) {
  await typeInto(user, 'אימייל', 'dana@example.com');
  await typeInto(user, 'שם', 'Dana');
  await typeInto(user, 'סיסמה התחלתית', 'starting pass');
  await typeInto(user, 'אימות סיסמה', 'starting pass');
}

const submit = () => screen.getByRole('button', { name: 'הוספה' });

beforeEach(() => serveSession());

describe('UsersPage', () => {
  it('lists every user with name, role, email and blocked state', async () => {
    serveUsers([ADI, DANA]);
    renderUsers();

    const list = await screen.findByRole('list', { name: 'רשימת המשתמשים' });
    const [adi, dana] = within(list).getAllByRole('listitem');
    expect(within(adi).getByText('Adi')).toBeTruthy();
    expect(within(adi).getByText('מנהל')).toBeTruthy();
    expect(within(adi).getByText('adi@example.com')).toBeTruthy();
    expect(within(adi).queryByText('חסום')).toBeNull();
    expect(within(dana).getByText('עורך')).toBeTruthy();
    expect(within(dana).getByText('חסום')).toBeTruthy();
    expect(within(dana).getByText('dana@example.com').getAttribute('dir')).toBe(
      'ltr',
    );
    expect(document.title).toBe('משתמשים · ביס & סיר');
    expect(
      screen.getByRole('heading', { level: 1, name: 'משתמשים' }),
    ).toBeTruthy();
  });

  it('offers a retry when the list cannot be loaded', async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get('*/api/users', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { detail: 'x', code: 'forbidden' },
              { status: 403 },
            )
          : HttpResponse.json([ADI]);
      }),
    );
    renderUsers();

    expect(await screen.findByText('אין הרשאה לפעולה הזאת')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'לנסות שוב' }));
    expect(await screen.findByText('Adi')).toBeTruthy();
  });

  it('shows a loading status first', async () => {
    serveUsers([ADI]);
    renderUsers();
    expect(screen.getByRole('status', { name: 'טוען משתמשים' })).toBeTruthy();
    expect(await screen.findByText('Adi')).toBeTruthy();
  });
});

describe('Add user dialog', () => {
  it('opens a labelled form with LTR email and password fields', async () => {
    const user = userEvent.setup();
    serveUsers([ADI]);
    renderUsers();
    const dialog = await openDialog(user);

    expect(within(dialog).getByLabelText('אימייל').getAttribute('dir')).toBe(
      'ltr',
    );
    expect(within(dialog).getByLabelText('שם')).toBeTruthy();
    expect(within(dialog).getByLabelText('תפקיד').textContent).toContain(
      'עורך',
    );
    for (const label of ['סיסמה התחלתית', 'אימות סיסמה']) {
      const field = within(dialog).getByLabelText(label);
      expect(field.getAttribute('type')).toBe('password');
      expect(field.getAttribute('dir')).toBe('ltr');
    }
  });

  it('creates the user, refreshes the list and closes', async () => {
    const user = userEvent.setup();
    const users = [ADI];
    let body: unknown;
    let csrf: string | null = null;
    server.use(
      http.get('*/api/users', () => HttpResponse.json(users)),
      http.post('*/api/users', async ({ request }) => {
        body = await request.json();
        csrf = request.headers.get('X-Requested-With');
        const created = { ...DANA, is_blocked: false, role: 'admin' as const };
        users.push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    renderUsers();
    await openDialog(user);

    await typeInto(user, 'אימייל', 'dana@example.com');
    await typeInto(user, 'שם', 'Dana');
    await user.click(screen.getByLabelText('תפקיד'));
    await user.click(await screen.findByRole('option', { name: 'מנהל' }));
    await typeInto(user, 'סיסמה התחלתית', 'starting pass');
    await typeInto(user, 'אימות סיסמה', 'starting pass');
    await user.click(submit());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(body).toEqual({
      email: 'dana@example.com',
      name: 'Dana',
      role: 'admin',
      password: 'starting pass',
    });
    expect(csrf).toBe('bite-and-board');
    expect(await screen.findByText('dana@example.com')).toBeTruthy();
  });

  it('checks the fields on the client before sending anything', async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      http.get('*/api/users', () => HttpResponse.json([ADI])),
      http.post('*/api/users', () => {
        posts += 1;
        return HttpResponse.json(DANA, { status: 201 });
      }),
    );
    renderUsers();
    await openDialog(user);

    await user.click(submit());
    expect(await screen.findByText('יש להזין אימייל')).toBeTruthy();
    expect(screen.getByText('יש להזין שם')).toBeTruthy();
    expect(screen.getByText('יש להזין סיסמה')).toBeTruthy();

    await typeInto(user, 'אימייל', 'not-an-email');
    await typeInto(user, 'שם', 'Dana');
    await typeInto(user, 'סיסמה התחלתית', 'short');
    await typeInto(user, 'אימות סיסמה', 'different');
    await user.click(submit());

    expect(await screen.findByText('כתובת האימייל אינה תקינה')).toBeTruthy();
    expect(screen.getByText('הסיסמה חייבת להכיל לפחות 8 תווים')).toBeTruthy();
    expect(screen.getByText('הסיסמאות אינן זהות')).toBeTruthy();
    expect(screen.getByLabelText('אימייל').getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(posts).toBe(0);
  });

  it('rejects a mismatched confirmation of a long enough password', async () => {
    const user = userEvent.setup();
    serveUsers([ADI]);
    renderUsers();
    await openDialog(user);

    await typeInto(user, 'אימייל', 'dana@example.com');
    await typeInto(user, 'שם', 'Dana');
    await typeInto(user, 'סיסמה התחלתית', 'starting pass');
    await typeInto(user, 'אימות סיסמה', 'starting pasz');
    await user.click(submit());

    expect(await screen.findByText('הסיסמאות אינן זהות')).toBeTruthy();
    expect(screen.queryByText('הסיסמה חייבת להכיל לפחות 8 תווים')).toBeNull();
  });

  it('shows a taken email on the email field and keeps the dialog open', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/users', () => HttpResponse.json([ADI])),
      http.post('*/api/users', () =>
        HttpResponse.json(
          { detail: 'taken', code: 'email_taken' },
          { status: 409 },
        ),
      ),
    );
    renderUsers();
    await openDialog(user);

    await fillValid(user);
    await user.click(submit());

    const message = await screen.findByText('כבר קיים משתמש עם האימייל הזה');
    const email = screen.getByLabelText('אימייל');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby')).toBe(message.id);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows a password the server rejects on the password field', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/users', () => HttpResponse.json([ADI])),
      http.post('*/api/users', () =>
        HttpResponse.json(
          { detail: 'short', code: 'password_too_short', params: { min: 8 } },
          { status: 422 },
        ),
      ),
    );
    renderUsers();
    await openDialog(user);

    await fillValid(user);
    await user.click(submit());

    const message = await screen.findByText('הסיסמה חייבת להכיל לפחות 8 תווים');
    expect(
      screen.getByLabelText('סיסמה התחלתית').getAttribute('aria-describedby'),
    ).toBe(message.id);
  });

  it('shows any other error under the form', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/users', () => HttpResponse.json([ADI])),
      http.post('*/api/users', () =>
        HttpResponse.json({ detail: 'no', code: 'forbidden' }, { status: 403 }),
      ),
    );
    renderUsers();
    await openDialog(user);

    await fillValid(user);
    await user.click(submit());

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'אין הרשאה לפעולה הזאת',
      ),
    );
  });

  it('cancels, and reopens empty', async () => {
    const user = userEvent.setup();
    serveUsers([ADI]);
    renderUsers();
    await openDialog(user);
    await typeInto(user, 'שם', 'Dana');

    await user.click(screen.getByRole('button', { name: 'ביטול' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await openDialog(user);
    expect((screen.getByLabelText('שם') as HTMLInputElement).value).toBe('');
  });
});

describe('the back button', () => {
  it('links to the library on a direct visit', async () => {
    const user = userEvent.setup();
    serveUsers([ADI]);
    const { router } = renderUsers();

    const back = await screen.findByRole('link', { name: 'חזרה למתכונים' });
    expect(back.getAttribute('href')).toBe('/');
    expect(back.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    await user.click(back);

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('returns to the page the admin came from after an in-app visit', async () => {
    const user = userEvent.setup();
    serveUsers([ADI]);
    const { router } = renderUsers();
    await router.navigate('/other');
    await router.navigate('/users');

    await user.click(
      await screen.findByRole('link', { name: 'חזרה למתכונים' }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/other'));
  });
});
