import { describe, expect, it } from 'vitest';
import { parseAmount } from './parse-amount.js';

describe('parseAmount', () => {
  it.each([
    ['1.5', 1.5],
    ['1,5', 1.5],
    ['.5', 0.5],
    ['2', 2],
    ['½', 0.5],
    ['⅓', 0.333],
    ['⅔', 0.667],
    ['¾', 0.75],
    ['1 ½', 1.5],
    ['1½', 1.5],
    ['1/3', 0.333],
    ['1 / 2', 0.5],
    ['1 1/2', 1.5],
    ['  2 ⅓ ', 2.333],
    ['0', 0],
  ])('accepts %j as %d', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  it.each(['', 'abc', '-1', '1/0', '1..5', '1/', '1 2', '½ 1', '1.5.2', '1e3'])(
    'rejects %j',
    (text) => {
      expect(parseAmount(text)).toBeNull();
    },
  );
});
