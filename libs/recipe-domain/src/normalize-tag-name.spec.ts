import { describe, expect, it } from 'vitest';
import { normalizeTagName } from './normalize-tag-name.js';

describe('normalizeTagName', () => {
  it.each([
    ['BBQ ', 'BBQ'],
    ['  ארוחת   שבת ', 'ארוחת שבת'],
    ['על\tהאש\n', 'על האש'],
    ['', ''],
    ['   ', ''],
  ])('turns %j into %j', (input, expected) => {
    expect(normalizeTagName(input)).toBe(expected);
  });

  it('composes to NFC, so one letter has one spelling', () => {
    expect(normalizeTagName('é')).toBe('é');
  });

  it('keeps the case: matching ignores it, storing does not change it', () => {
    expect(normalizeTagName('Bbq')).toBe('Bbq');
  });
});
