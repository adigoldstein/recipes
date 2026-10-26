import { render, screen, within } from '@testing-library/react';
import { TopBar, Wordmark } from './top-bar';

describe('TopBar', () => {
  it('renders the brand and the actions inside the banner', () => {
    render(
      <TopBar
        brand={
          <Wordmark asChild>
            <a href="/">ביס &amp; סיר</a>
          </Wordmark>
        }
        actions={<button type="button">פעולה</button>}
      />,
    );
    const banner = screen.getByRole('banner');
    const wordmark = within(banner).getByRole('link', { name: 'ביס & סיר' });
    expect(wordmark.getAttribute('href')).toBe('/');
    expect(wordmark.className).toContain('text-title');
    expect(within(banner).getByRole('button', { name: 'פעולה' })).toBeTruthy();
  });
});
