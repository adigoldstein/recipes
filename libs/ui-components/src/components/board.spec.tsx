import { render, screen } from '@testing-library/react';
import { Board } from './board';

describe('Board', () => {
  it('renders its content on the oak slab with a decorative handle slot', () => {
    const { container } = render(
      <Board aria-label="מצרכים">
        <p>2 כפיות כמון</p>
      </Board>,
    );
    const board = screen.getByLabelText('מצרכים');
    expect(board.className).toContain('bg-board');
    expect(board.className).toContain('rounded-board');
    expect(screen.getByText('2 כפיות כמון')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});
