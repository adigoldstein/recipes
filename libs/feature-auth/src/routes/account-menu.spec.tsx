import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../testing/server';
import { toast } from '@bite-and-board/ui-components';
import { ADI, renderAt, serveSession } from '../testing/render-auth';
import { AccountMenu } from './account-menu';

function renderMenu(path = '/') {
  return renderAt(path, [{ path: '*', element: <AccountMenu /> }]);
}

describe('AccountMenu', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows nothing until the session is known', () => {
    serveSession(null);
    renderMenu();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers "כניסה" to a visitor', async () => {
    serveSession(null);
    renderMenu();
    const link = await screen.findByRole('link', { name: 'כניסה' });
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('brings the visitor back to the page they were on', async () => {
    serveSession(null);
    renderMenu('/recipes/r1?servings=6');
    const link = await screen.findByRole('link', { name: 'כניסה' });
    expect(link.getAttribute('href')).toBe(
      '/login?next=%2Frecipes%2Fr1%3Fservings%3D6',
    );
  });

  it('hides "כניסה" on the login page', async () => {
    serveSession(null);
    renderMenu('/login');
    // Give the session answer time to arrive; there is still nothing to show.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the signed-in name as the menu button', async () => {
    serveSession(ADI);
    renderMenu();
    expect(await screen.findByRole('button', { name: 'Adi' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'כניסה' })).toBeNull();
  });

  it('gives the admin a link to the Users screen', async () => {
    const user = userEvent.setup();
    serveSession(ADI);
    renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Adi' }));
    const item = await screen.findByRole('menuitem', { name: 'משתמשים' });
    expect(item.getAttribute('href')).toBe('/users');
  });

  it('gives every signed-in user a link to "החשבון שלי"', async () => {
    const user = userEvent.setup();
    serveSession({ ...ADI, role: 'editor' });
    renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Adi' }));
    const item = await screen.findByRole('menuitem', { name: 'החשבון שלי' });
    expect(item.getAttribute('href')).toBe('/account');
  });

  it('leaves the Users link out for an editor', async () => {
    const user = userEvent.setup();
    serveSession({ ...ADI, role: 'editor' });
    renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Adi' }));
    expect(await screen.findByRole('menuitem', { name: 'יציאה' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'משתמשים' })).toBeNull();
  });

  it('logs out and turns back into "כניסה" without a reload', async () => {
    const user = userEvent.setup();
    let signedIn = true;
    let csrf: string | null = null;
    server.use(
      http.get('*/api/auth/session', () =>
        HttpResponse.json({ user: signedIn ? ADI : null }),
      ),
      http.post('*/api/auth/logout', ({ request }) => {
        csrf = request.headers.get('X-Requested-With');
        signedIn = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Adi' }));
    await user.click(await screen.findByRole('menuitem', { name: 'יציאה' }));
    expect(await screen.findByRole('link', { name: 'כניסה' })).toBeTruthy();
    expect(csrf).toBe('bite-and-board');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Adi' })).toBeNull(),
    );
  });

  it('confirms a logout with a toast', async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, 'success');
    serveSession(ADI);
    server.use(
      http.post(
        '*/api/auth/logout',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Adi' }));
    await user.click(await screen.findByRole('menuitem', { name: 'יציאה' }));

    await waitFor(() => expect(success).toHaveBeenCalledWith('התנתקת בהצלחה'));
  });

  it('shows no toast when the logout fails, and stays signed in', async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, 'success');
    serveSession(ADI);
    let logoutCalls = 0;
    server.use(
      http.post('*/api/auth/logout', () => {
        logoutCalls += 1;
        return HttpResponse.json(
          { detail: 'x', code: 'forbidden' },
          { status: 403 },
        );
      }),
    );
    renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Adi' }));
    await user.click(await screen.findByRole('menuitem', { name: 'יציאה' }));

    await waitFor(() => expect(logoutCalls).toBe(1));
    expect(success).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Adi' })).toBeTruthy();
  });
});
