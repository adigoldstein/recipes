import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { server } from '../testing/server';
import { ADI, renderAt, serveSession } from '../testing/render-auth';
import { Component as LoginPage } from './login';

function renderLogin(path = '/login') {
  serveSession(null);
  return renderAt(path, [
    { path: '/login', element: <LoginPage /> },
    { path: '/', element: <p>home stub</p> },
    { path: '/recipes/:id', element: <p>recipe stub</p> },
  ]);
}

const email = () => screen.getByLabelText('אימייל');
const password = () => screen.getByLabelText('סיסמה');
const submit = () => screen.getByRole('button', { name: 'כניסה' });

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(email(), 'adi@example.com');
  await user.type(password(), 'correct horse');
}

describe('LoginPage', () => {
  it('has labelled, left-to-right email and password fields', async () => {
    renderLogin();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'כניסה' }),
    ).toBeTruthy();
    expect(email().getAttribute('dir')).toBe('ltr');
    expect(email().getAttribute('autocomplete')).toBe('username');
    expect(password().getAttribute('dir')).toBe('ltr');
    expect(password().getAttribute('type')).toBe('password');
    expect(password().getAttribute('autocomplete')).toBe('current-password');
    expect(document.title).toBe('כניסה · ביס & סיר');
  });

  it('logs in, sends the CSRF header and goes to ?next=', async () => {
    const user = userEvent.setup();
    let body: unknown;
    let csrf: string | null = null;
    server.use(
      http.post('*/api/auth/login', async ({ request }) => {
        body = await request.json();
        csrf = request.headers.get('X-Requested-With');
        return HttpResponse.json({ user: ADI });
      }),
    );
    const { router } = renderLogin('/login?next=%2Frecipes%2Fr1');
    await fill(user);
    await user.click(submit());
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/recipes/r1'),
    );
    expect(body).toEqual({
      email: 'adi@example.com',
      password: 'correct horse',
    });
    expect(csrf).toBe('bite-and-board');
    expect(screen.getByText('recipe stub')).toBeTruthy();
  });

  it('goes to / without ?next=', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json({ user: ADI })),
    );
    const { router } = renderLogin();
    await fill(user);
    await user.click(submit());
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it.each(['https://evil.example', '//evil.example'])(
    'ignores an off-site ?next=%s',
    async (next) => {
      const user = userEvent.setup();
      server.use(
        http.post('*/api/auth/login', () => HttpResponse.json({ user: ADI })),
      );
      const { router } = renderLogin(`/login?next=${encodeURIComponent(next)}`);
      await fill(user);
      await user.click(submit());
      await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    },
  );

  it('shows one generic message for wrong credentials', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { detail: 'Invalid email or password', code: 'invalid_credentials' },
          { status: 400 },
        ),
      ),
    );
    renderLogin();
    await fill(user);
    await user.click(submit());
    const alert = await screen.findByText('אימייל או סיסמה שגויים');
    expect(alert.getAttribute('role')).toBe('alert');
    // It names no field, and the visitor stays on the page with the email kept.
    expect(email().getAttribute('aria-invalid')).toBeNull();
    expect(password().getAttribute('aria-invalid')).toBeNull();
    expect((email() as HTMLInputElement).value).toBe('adi@example.com');
  });

  it('tells a blocked user to contact the admin, and stays on the form', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { detail: 'This account is blocked', code: 'account_blocked' },
          { status: 403 },
        ),
      ),
    );
    renderLogin();
    await fill(user);
    await user.click(submit());
    expect(
      await screen.findByText('החשבון חסום. יש לפנות למנהל.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: 'כניסה' }),
    ).toBeTruthy();
    expect((email() as HTMLInputElement).value).toBe('adi@example.com');
  });

  it('says to wait when rate limited', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { detail: 'Too many attempts', code: 'rate_limited' },
          { status: 429 },
        ),
      ),
    );
    renderLogin();
    await fill(user);
    await user.click(submit());
    expect(
      await screen.findByText('יותר מדי ניסיונות. אפשר לנסות שוב בעוד דקה.'),
    ).toBeTruthy();
  });

  it('falls back to the generic message for a network failure', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/auth/login', () => HttpResponse.error()));
    renderLogin();
    await fill(user);
    await user.click(submit());
    expect(await screen.findByText('משהו השתבש, אפשר לנסות שוב')).toBeTruthy();
  });

  it('asks for both fields without calling the server', async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.post('*/api/auth/login', () => {
        called = true;
        return HttpResponse.json({ user: ADI });
      }),
    );
    renderLogin();
    await user.click(submit());
    expect(await screen.findByText('יש להזין אימייל')).toBeTruthy();
    expect(screen.getByText('יש להזין סיסמה')).toBeTruthy();
    expect(email().getAttribute('aria-invalid')).toBe('true');
    expect(email().getAttribute('aria-describedby')).toBe('login-email-error');
    expect(called).toBe(false);
  });

  it('disables the button while the request is in flight', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/login', async () => {
        await delay(50);
        return HttpResponse.json({ user: ADI });
      }),
    );
    renderLogin();
    await fill(user);
    await user.click(submit());
    const busy = await screen.findByRole('button', { name: 'נכנסים' });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
  });

  it('sends a user who is already signed in on to ?next=', async () => {
    serveSession(ADI);
    const { router } = renderAt('/login?next=%2Frecipes%2Fr1', [
      { path: '/login', element: <LoginPage /> },
      { path: '/recipes/:id', element: <p>recipe stub</p> },
    ]);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/recipes/r1'),
    );
  });
});

describe('the back button', () => {
  it('links to the library on a direct visit, even with ?next=', async () => {
    const user = userEvent.setup();
    const { router } = renderLogin('/login?next=%2Fusers');

    const back = await screen.findByRole('link', { name: 'חזרה למתכונים' });
    expect(back.getAttribute('href')).toBe('/');
    expect(back.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    await user.click(back);

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('returns to the page the visitor came from after an in-app visit', async () => {
    const user = userEvent.setup();
    const { router } = renderLogin();
    await router.navigate('/recipes/r1');
    await router.navigate('/login?next=%2Frecipes%2Fr1');

    await user.click(
      await screen.findByRole('link', { name: 'חזרה למתכונים' }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/recipes/r1'),
    );
  });
});
