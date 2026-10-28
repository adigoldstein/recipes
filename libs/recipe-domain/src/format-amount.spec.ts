import { formatAmount } from './format-amount.js';

describe('formatAmount', () => {
  it('shows whole numbers without decimals', () => {
    expect(formatAmount(5)).toBe('5');
    expect(formatAmount(5.0)).toBe('5');
  });

  it('keeps at most two decimals', () => {
    expect(formatAmount(0.5)).toBe('0.5');
    expect(formatAmount(1.256)).toBe('1.26');
    expect(formatAmount(227.0001)).toBe('227');
  });
});
