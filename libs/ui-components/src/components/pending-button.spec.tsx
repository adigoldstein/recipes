import { act, render, screen } from '@testing-library/react';
import { PendingButton, SlowNote } from './pending-button';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

function renderButton(pending: boolean) {
  const view = render(
    <PendingButton pending={pending} pendingLabel="מוחקים">
      מחיקה
    </PendingButton>,
  );
  return {
    rerenderWith: (next: boolean) =>
      view.rerender(
        <PendingButton pending={next} pendingLabel="מוחקים">
          מחיקה
        </PendingButton>,
      ),
  };
}

const button = () => screen.getByRole('button');
// Finds the button by the text a screen reader reads (the label that is not hidden).
const name = (label: string) => screen.getByRole('button', { name: label });

describe('PendingButton', () => {
  it('is a plain button while nothing is pending', () => {
    renderButton(false);
    expect(button().hasAttribute('disabled')).toBe(false);
    expect(button().getAttribute('aria-busy')).toBeNull();
  });

  it('is disabled at once, so a second tap cannot repeat the action', () => {
    renderButton(true);
    expect(button().hasAttribute('disabled')).toBe(true);
    expect(button().getAttribute('aria-busy')).toBe('true');
  });

  it('shows no spinner for a fast action', async () => {
    const { rerenderWith } = renderButton(true);
    await advance(200);
    rerenderWith(false);
    await advance(1000);
    expect(name('מחיקה')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'מוחקים' })).toBeNull();
  });

  it('shows the spinner and the present-tense label after the delay', async () => {
    renderButton(true);
    expect(name('מחיקה')).toBeTruthy();
    await advance(350);
    expect(name('מוחקים')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'מחיקה' })).toBeNull();
  });

  it('keeps the indicator for at least half a second once it showed', async () => {
    const { rerenderWith } = renderButton(true);
    // The spinner appears after about 300 ms.
    await advance(350);
    // The action ends 50 ms after the spinner appeared.
    rerenderWith(false);
    await advance(200);
    expect(name('מוחקים')).toBeTruthy();
    await advance(400);
    expect(name('מחיקה')).toBeTruthy();
    expect(button().hasAttribute('disabled')).toBe(false);
  });

  it('holds the same space for both labels so the button does not jump', () => {
    renderButton(true);
    const cell = button().firstElementChild;
    expect(cell?.className).toContain('inline-grid');
    expect(cell?.children).toHaveLength(2);
  });
});

describe('SlowNote', () => {
  it('stays empty at first and says so after the wait', async () => {
    render(
      <SlowNote pending afterMs={10_000}>
        זה לוקח יותר זמן מהרגיל
      </SlowNote>,
    );
    expect(screen.getByRole('status').textContent).toBe('');
    await advance(9_000);
    expect(screen.getByRole('status').textContent).toBe('');
    await advance(1_500);
    expect(screen.getByRole('status').textContent).toBe(
      'זה לוקח יותר זמן מהרגיל',
    );
  });

  it('clears when the action ends', async () => {
    const { rerender } = render(
      <SlowNote pending afterMs={1_000}>
        איטי
      </SlowNote>,
    );
    await advance(1_500);
    expect(screen.getByRole('status').textContent).toBe('איטי');
    rerender(
      <SlowNote pending={false} afterMs={1_000}>
        איטי
      </SlowNote>,
    );
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
