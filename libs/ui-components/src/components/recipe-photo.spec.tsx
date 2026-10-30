import { render, screen } from '@testing-library/react';
import { RecipePhoto } from './recipe-photo';

describe('RecipePhoto', () => {
  it('shows the picture with its alt text, set size and shape for each width', () => {
    render(<RecipePhoto src="/media/photos/a.webp" alt="תמונה של לזניה" />);
    const photo = screen.getByRole('img', { name: 'תמונה של לזניה' });
    expect(photo.getAttribute('src')).toBe('/media/photos/a.webp');
    expect(photo.getAttribute('width')).toBe('1600');
    expect(photo.getAttribute('height')).toBe('1200');
    // The page's top image is not lazy-loaded.
    expect(photo.getAttribute('loading')).toBeNull();
    expect(photo.getAttribute('fetchpriority')).toBe('high');
    expect(photo.className).toContain('aspect-4/3');
    expect(photo.className).toContain('lg:aspect-video');
    expect(photo.parentElement?.className).toContain('rounded-board');
  });

  it('cuts the board handle slot through the picture, hidden from screen readers', () => {
    const { container } = render(<RecipePhoto src="/a.webp" alt="x" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('shows the credit under the picture only when there is one', () => {
    const { rerender } = render(<RecipePhoto src="/a.webp" alt="x" />);
    expect(screen.queryByText(/מקור/)).toBeNull();
    rerender(
      <RecipePhoto
        src="/a.webp"
        alt="x"
        credit="מקור: commons.wikimedia.org"
      />,
    );
    expect(screen.getByText('מקור: commons.wikimedia.org')).toBeTruthy();
  });
});
