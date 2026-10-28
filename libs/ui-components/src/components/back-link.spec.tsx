import { render, screen } from '@testing-library/react';
import { BackLink } from './back-link';

describe('BackLink', () => {
  it('renders the given link with an arrow and the label', () => {
    render(
      <BackLink
        label="חזרה למתכונים"
        link={(children) => <a href="/">{children}</a>}
      />,
    );

    const link = screen.getByRole('link', { name: 'חזרה למתכונים' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('styles the link as a ghost button', () => {
    render(
      <BackLink label="חזרה" link={(children) => <a href="/">{children}</a>} />,
    );

    expect(
      screen.getByRole('link', { name: 'חזרה' }).getAttribute('data-variant'),
    ).toBe('ghost');
  });
});
