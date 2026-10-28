import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { setSystemDark } from '../test-setup';
import { createRoutes } from './router';
import { AppProviders, createAppQueryClient } from './app-providers';
import { THEME_STORAGE_KEY } from './theme';

const LABELS = {
  system: 'צבעים: לפי המכשיר',
  light: 'צבעים: בהיר',
  dark: 'צבעים: כהה',
};

const isDark = () => document.documentElement.classList.contains('dark');

async function renderApp() {
  const queryClient = createAppQueryClient();
  const router = createMemoryRouter(createRoutes(queryClient), {
    initialEntries: ['/'],
  });
  render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  await screen.findByRole('heading', { name: 'מתכונים' });
}

const toggle = () => screen.getByRole('button', { name: /^צבעים:/ });

describe('pre-paint script in index.html', () => {
  const html = readFileSync(
    join(import.meta.dirname, '../../index.html'),
    'utf8',
  );
  const script = /<script id="theme-init">([\s\S]*?)<\/script>/.exec(html)?.[1];
  // Runs the inline script the way the browser does before first paint.
  // eslint-disable-next-line no-new-func -- the code under test is that script
  const run = () => new Function(script ?? '')();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the ThemeProvider storage key', () => {
    expect(script).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  it('applies dark from the OS on a first visit', () => {
    setSystemDark(true);
    run();
    expect(isDark()).toBe(true);
  });

  it('lets a stored light choice win over a dark OS', () => {
    setSystemDark(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    run();
    expect(isDark()).toBe(false);
  });

  it('applies a stored dark choice', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    run();
    expect(isDark()).toBe(true);
  });

  it('falls back to the OS when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setSystemDark(true);
    expect(run).not.toThrow();
    expect(isDark()).toBe(true);
  });
});

describe('ThemeProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('follows a dark OS on a first visit and shows "system"', async () => {
    setSystemDark(true);
    await renderApp();
    expect(isDark()).toBe(true);
    expect(toggle().getAttribute('aria-label')).toBe(LABELS.system);
  });

  it('cycles system → light → dark → system and remembers the choice', async () => {
    setSystemDark(true);
    await renderApp();

    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-label')).toBe(LABELS.light);
    expect(isDark()).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-label')).toBe(LABELS.dark);
    expect(isDark()).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-label')).toBe(LABELS.system);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('restores a remembered choice', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    await renderApp();
    expect(toggle().getAttribute('aria-label')).toBe(LABELS.dark);
    expect(isDark()).toBe(true);
  });

  it('follows the OS live in system mode', async () => {
    await renderApp();
    expect(isDark()).toBe(false);
    act(() => setSystemDark(true));
    expect(isDark()).toBe(true);
    act(() => setSystemDark(false));
    expect(isDark()).toBe(false);
  });

  it('ignores the OS once a mode is chosen', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    await renderApp();
    act(() => setSystemDark(true));
    expect(isDark()).toBe(false);
  });

  it('still works for the session when storage is blocked', async () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    await renderApp();

    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-label')).toBe(LABELS.dark);
    expect(isDark()).toBe(true);
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-label')).toBe(LABELS.system);
  });
});
