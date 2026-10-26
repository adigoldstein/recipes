import { fireEvent, render, screen } from '@testing-library/react';
import { nextThemeMode, ThemeToggle } from './theme-toggle';

describe('nextThemeMode', () => {
  it('cycles system → light → dark → system', () => {
    expect(nextThemeMode('system')).toBe('light');
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('system');
  });
});

describe('ThemeToggle', () => {
  it('is a labelled button that asks for the next mode', () => {
    const onValueChange = vi.fn();
    render(
      <ThemeToggle
        value="light"
        onValueChange={onValueChange}
        label="ערכת נושא: בהירה"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'ערכת נושא: בהירה' }));
    expect(onValueChange).toHaveBeenCalledWith('dark');
  });

  it('shows a different icon for each mode', () => {
    const icons = (['system', 'light', 'dark'] as const).map((mode) => {
      const { container, unmount } = render(
        <ThemeToggle value={mode} onValueChange={vi.fn()} label={mode} />,
      );
      const svgClass = container.querySelector('svg')?.getAttribute('class');
      unmount();
      return svgClass;
    });
    expect(new Set(icons).size).toBe(3);
  });
});
