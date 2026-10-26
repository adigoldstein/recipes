import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders a pill button that meets the 44px touch target', () => {
    render(<Button>שמירה</Button>);
    const button = screen.getByRole('button', { name: 'שמירה' });
    expect(button.className).toContain('rounded-full');
    expect(button.className).toContain('h-11');
  });

  it('renders its child element with asChild', () => {
    render(
      <Button asChild>
        <a href="/">חזרה לרשימה</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'חזרה לרשימה' });
    expect(link.getAttribute('data-slot')).toBe('button');
  });

  it('lets a caller className win over the variant', () => {
    render(<Button className="bg-secondary">x</Button>);
    const { classList } = screen.getByRole('button');
    expect(classList.contains('bg-secondary')).toBe(true);
    expect(classList.contains('bg-primary')).toBe(false);
  });
});
