import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  createMemoryRouter,
  data,
  RouterProvider,
  type RouteObject,
} from 'react-router';
import { AppProviders, createAppQueryClient } from './app-providers';
import { RouteError } from './route-error';
import { createRoutes } from './router';

function renderApp(path: string, appRoutes?: RouteObject[]) {
  const queryClient = createAppQueryClient();
  const router = createMemoryRouter(appRoutes ?? createRoutes(queryClient), {
    initialEntries: [path],
  });
  render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe('routes', () => {
  it('renders the shell and the lazy home page at /', async () => {
    renderApp('/');
    const heading = await screen.findByRole('heading', { name: 'מתכונים' });
    const banner = screen.getByRole('banner');
    expect(
      within(banner)
        .getByRole('link', { name: 'ביס & סיר' })
        .getAttribute('href'),
    ).toBe('/');
    expect(document.title).toBe('ביס & סיר');
    // The first load does not move focus.
    expect(document.activeElement).not.toBe(heading);
  });

  it('renders the not-found page inside the shell for an unknown path', async () => {
    renderApp('/nope');
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'הדף לא נמצא',
    });
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'חזרה לרשימה' }).getAttribute('href'),
    ).toBe('/');
    expect(document.title).toBe('הדף לא נמצא · ביס & סיר');
    expect(document.activeElement).not.toBe(heading);
  });

  it('moves focus to the new h1 and updates the title on navigation', async () => {
    renderApp('/nope');
    fireEvent.click(await screen.findByRole('link', { name: 'חזרה לרשימה' }));
    const heading = await screen.findByRole('heading', { name: 'מתכונים' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(document.title).toBe('ביס & סיר');
  });
});

describe('RouteError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function throwingRoutes(error: unknown) {
    return [
      {
        path: '/',
        Component: () => null,
        HydrateFallback: () => null,
        errorElement: <RouteError />,
        loader: () => {
          throw error;
        },
      },
    ];
  }

  it('renders a Hebrew message when a loader throws', async () => {
    // The router logs the thrown error; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderApp('/', throwingRoutes(new Error('boom')));
    expect(
      await screen.findByRole('heading', { name: 'משהו השתבש' }),
    ).toBeTruthy();
    expect(screen.getByText('אפשר לרענן ולנסות שוב')).toBeTruthy();
    expect(document.title).toBe('משהו השתבש · ביס & סיר');
  });

  it('has a back link to the home page and a refresh button', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    renderApp('/', throwingRoutes(new Error('boom')));
    const back = await screen.findByRole('link', { name: 'חזרה לרשימה' });
    expect(back.getAttribute('href')).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: 'רענון הדף' }));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('has the back link, and no refresh button, on a thrown 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderApp('/', throwingRoutes(data(null, { status: 404 })));
    expect(
      (await screen.findByRole('link', { name: 'חזרה לרשימה' })).getAttribute(
        'href',
      ),
    ).toBe('/');
    expect(screen.queryByRole('button', { name: 'רענון הדף' })).toBeNull();
  });

  it('renders the not-found copy for a thrown 404', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderApp('/', throwingRoutes(data(null, { status: 404 })));
    expect(
      await screen.findByRole('heading', { name: 'הדף לא נמצא' }),
    ).toBeTruthy();
  });
});
