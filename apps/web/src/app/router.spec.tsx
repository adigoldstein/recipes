import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RouteError } from './route-error';
import { routes } from './router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe('routes', () => {
  it('renders the lazy home page at /', async () => {
    renderAt('/');
    expect(
      await screen.findByRole('heading', { name: 'Bite & Board' }),
    ).toBeTruthy();
  });

  it('renders the not-found error for an unknown path', async () => {
    renderAt('/nope');
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeTruthy();
  });
});

describe('RouteError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a generic message when a route throws', async () => {
    // The router logs the thrown error; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter([
      {
        path: '/',
        errorElement: <RouteError />,
        loader: () => {
          throw new Error('boom');
        },
      },
    ]);
    render(<RouterProvider router={router} />);
    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeTruthy();
  });
});
