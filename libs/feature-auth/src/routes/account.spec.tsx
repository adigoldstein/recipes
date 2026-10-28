import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { authSessionQueryKey } from '@bite-and-board/data-access';
import { toast } from '@bite-and-board/ui-components';
import { server } from '../testing/server';
import { ADI, renderAt, serveSession } from '../testing/render-auth';
import { Component as AccountPage } from './account';

function renderAccount() {
  serveSession(ADI);
  return renderAt('/account', [
    { path: '/account', element: <AccountPage /> },
    { path: '/', element: <p>home stub</p> },
  ]);
}

const current = () => screen.getByLabelText('סיסמה נוכחית');
const next = () => screen.getByLabelText('סיסמה חדשה');
const confirm = () => screen.getByLabelText('אימות הסיסמה החדשה');
const submit = () => screen.getByRole('button', { name: 'עדכון סיסמה' });

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  values: { next?: string; again?: string } = {},
) {
  const newPassword = values.next ?? 'battery staple';
  await user.type(current(), 'correct horse');
  await user.type(next(), newPassword);
  await user.type(confirm(), values.again ?? newPassword);
}

describe('AccountPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the title, who I am and left-to-right password fields', async () => {
    renderAccount();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'החשבון שלי' }),
    ).toBeTruthy();
    expect(await screen.findByText('adi@example.com')).toBeTruthy();
    expect(document.title).toBe('החשבון שלי · ביס & סיר');
    for (const field of [current(), next(), confirm()]) {
      expect(field.getAttribute('type')).toBe('password');
      expect(field.getAttribute('dir')).toBe('ltr');
    }
    expect(current().getAttribute('autocomplete')).toBe('current-password');
    expect(next().getAttribute('autocomplete')).toBe('new-password');
  });

  it('has a back link to the library', async () => {
    renderAccount();
    const back = await screen.findByRole('link', { name: /חזרה למתכונים/ });
    expect(back.getAttribute('href')).toBe('/');
  });

  it('changes the password, keeps me signed in and confirms with a toast', async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, 'success');
    let body: unknown;
    let csrf: string | null = null;
    server.use(
      http.post('*/api/auth/password', async ({ request }) => {
        body = await request.json();
        csrf = request.headers.get('X-Requested-With');
        return HttpResponse.json({ user: { ...ADI, name: 'Adi B' } });
      }),
    );
    const { queryClient } = renderAccount();
    await screen.findByText('adi@example.com');
    await fill(user);
    await user.click(submit());
    await waitFor(() => expect(success).toHaveBeenCalledWith('הסיסמה עודכנה'));
    expect(body).toEqual({
      current_password: 'correct horse',
      new_password: 'battery staple',
    });
    expect(csrf).toBe('bite-and-board');
    // The answer is the new session, and the form is empty again.
    expect(queryClient.getQueryData(authSessionQueryKey())).toEqual({
      user: { ...ADI, name: 'Adi B' },
    });
    expect((current() as HTMLInputElement).value).toBe('');
    expect((next() as HTMLInputElement).value).toBe('');
  });

  it('shows a wrong current password on that field', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/password', () =>
        HttpResponse.json(
          { detail: 'Current password is wrong', code: 'invalid_credentials' },
          { status: 400 },
        ),
      ),
    );
    renderAccount();
    await screen.findByText('adi@example.com');
    await fill(user);
    await user.click(submit());
    expect(await screen.findByText('הסיסמה הנוכחית שגויה')).toBeTruthy();
    expect(current().getAttribute('aria-invalid')).toBe('true');
    expect(next().getAttribute('aria-invalid')).toBeNull();
  });

  it('rejects a new password under 8 characters without calling the server', async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.post('*/api/auth/password', () => {
        called = true;
        return HttpResponse.json({ user: ADI });
      }),
    );
    renderAccount();
    await screen.findByText('adi@example.com');
    await fill(user, { next: 'short' });
    await user.click(submit());
    expect(
      await screen.findByText('הסיסמה חייבת להכיל לפחות 8 תווים'),
    ).toBeTruthy();
    expect(called).toBe(false);
  });

  it('asks for the confirmation to match', async () => {
    const user = userEvent.setup();
    renderAccount();
    await screen.findByText('adi@example.com');
    await fill(user, { again: 'battery stapler' });
    await user.click(submit());
    expect(await screen.findByText('הסיסמאות אינן זהות')).toBeTruthy();
  });

  it('asks for the current and the new password', async () => {
    const user = userEvent.setup();
    renderAccount();
    await screen.findByText('adi@example.com');
    await user.click(submit());
    expect(await screen.findByText('יש להזין את הסיסמה הנוכחית')).toBeTruthy();
    expect(screen.getByText('יש להזין סיסמה חדשה')).toBeTruthy();
  });

  it('shows a server-side policy rejection on the new password field', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/password', () =>
        HttpResponse.json(
          {
            detail: 'too long',
            code: 'password_too_long',
            params: { max: 128 },
          },
          { status: 422 },
        ),
      ),
    );
    renderAccount();
    await screen.findByText('adi@example.com');
    await fill(user);
    await waitFor(() => expect(submit()).toBeTruthy());
    await user.click(submit());
    await waitFor(() =>
      expect(next().getAttribute('aria-invalid')).toBe('true'),
    );
  });

  it('shows other failures, like the rate limit, in a live line', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/password', () =>
        HttpResponse.json(
          { detail: 'Too many attempts', code: 'rate_limited' },
          { status: 429 },
        ),
      ),
    );
    renderAccount();
    await screen.findByText('adi@example.com');
    await fill(user);
    await user.click(submit());
    const alert = await screen.findByText(
      'יותר מדי ניסיונות. אפשר לנסות שוב בעוד דקה.',
    );
    expect(alert.getAttribute('role')).toBe('alert');
  });
});
