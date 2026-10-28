import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, RouterProvider, createMemoryRouter } from 'react-router';
import { useBackNavigation } from './navigation';

function Page() {
  const { cameFromApp, onBack } = useBackNavigation();
  return (
    <>
      <p>{cameFromApp ? 'in-app' : 'direct'}</p>
      <Link to="/" onClick={onBack}>
        back
      </Link>
    </>
  );
}

function renderPage(entries: string[]) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>home</p> },
      { path: '/other', element: <p>other</p> },
      { path: '/page', element: <Page /> },
    ],
    { initialEntries: entries, initialIndex: entries.length - 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('useBackNavigation', () => {
  it('goes one step back in history after an in-app visit', async () => {
    const router = renderPage(['/other', '/page']);
    // The first entry of a memory history is the "default" location; step off it.
    await router.navigate('/other');
    await router.navigate('/page');

    expect(await screen.findByText('in-app')).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: 'back' }));

    expect(await screen.findByText('other')).toBeTruthy();
  });

  it('follows the link to the fallback page on a direct visit', async () => {
    renderPage(['/page']);

    expect(await screen.findByText('direct')).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: 'back' }));

    expect(await screen.findByText('home')).toBeTruthy();
  });
});
