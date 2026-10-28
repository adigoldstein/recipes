import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServingsStepper } from './servings-stepper';

function Harness({ start = 4 }: { start?: number }) {
  const [value, setValue] = useState(start);
  return (
    <ServingsStepper
      value={value}
      base={4}
      min={1}
      max={100}
      onChange={setValue}
      label="מספר מנות"
      decreaseLabel="פחות מנות"
      increaseLabel="יותר מנות"
      resetLabel="חזרה ל־4"
      rangeMessage="בין 1 ל־100"
      announcement={`${value} מנות`}
    />
  );
}

const input = () => screen.getByRole('textbox', { name: 'מספר מנות' });

describe('ServingsStepper', () => {
  it('steps up and down with the buttons and announces politely', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'יותר מנות' }));
    expect((input() as HTMLInputElement).value).toBe('5');
    expect(screen.getByRole('status').textContent).toBe('5 מנות');
    await userEvent.click(screen.getByRole('button', { name: 'פחות מנות' }));
    await userEvent.click(screen.getByRole('button', { name: 'פחות מנות' }));
    expect((input() as HTMLInputElement).value).toBe('3');
  });

  it('shows the reset button only away from the base, and it restores it', async () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'חזרה ל־4' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'יותר מנות' }));
    await userEvent.click(screen.getByRole('button', { name: 'חזרה ל־4' }));
    expect((input() as HTMLInputElement).value).toBe('4');
    expect(screen.queryByRole('button', { name: 'חזרה ל־4' })).toBeNull();
  });

  it('disables the buttons at the limits', () => {
    const { unmount } = render(<Harness start={1} />);
    expect(
      screen
        .getByRole('button', { name: 'פחות מנות' })
        .hasAttribute('disabled'),
    ).toBe(true);
    unmount();
    render(<Harness start={100} />);
    expect(
      screen
        .getByRole('button', { name: 'יותר מנות' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('takes a typed value and ignores non-digits', async () => {
    render(<Harness />);
    await userEvent.clear(input());
    await userEvent.type(input(), '1a0');
    expect((input() as HTMLInputElement).value).toBe('10');
    expect(screen.getByRole('status').textContent).toBe('10 מנות');
    expect(screen.queryByText('בין 1 ל־100')).toBeNull();
  });

  it('shows the range message for empty or out-of-range input, then reverts on blur', async () => {
    render(<Harness />);
    await userEvent.clear(input());
    expect(screen.getByText('בין 1 ל־100')).toBeTruthy();
    expect(input().getAttribute('aria-invalid')).toBe('true');

    await userEvent.type(input(), '150');
    expect(screen.getByText('בין 1 ל־100')).toBeTruthy();
    // "15" was valid on the way to "150", so that is what the page holds.
    expect(screen.getByRole('status').textContent).toBe('15 מנות');

    await userEvent.tab();
    expect((input() as HTMLInputElement).value).toBe('15');
    expect(screen.queryByText('בין 1 ל־100')).toBeNull();
  });

  it('treats 0 as out of range', async () => {
    render(<Harness />);
    await userEvent.clear(input());
    await userEvent.type(input(), '0');
    expect(screen.getByText('בין 1 ל־100')).toBeTruthy();
  });

  it('drops the draft on Enter', async () => {
    render(<Harness />);
    await userEvent.clear(input());
    await userEvent.type(input(), '7{Enter}');
    expect((input() as HTMLInputElement).value).toBe('7');
  });
});
