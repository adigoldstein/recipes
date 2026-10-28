import { scaleAmount } from './scale-amount.js';

describe('scaleAmount', () => {
  it('returns the stored amount at the base servings', () => {
    expect(scaleAmount(1.256, 'cup', 4, 4)).toBe(1.256);
    expect(scaleAmount(1.3, 'clove', 4, 4)).toBe(1.3);
  });

  it('multiplies by servings / base', () => {
    expect(scaleAmount(2, 'cup', 4, 10)).toBe(5);
    expect(scaleAmount(100, 'g', 4, 6)).toBe(150);
  });

  it('rounds other units to two decimals', () => {
    expect(scaleAmount(1, 'cup', 3, 1)).toBe(0.33);
    expect(scaleAmount(1, null, 3, 2)).toBe(0.67);
  });

  it('rounds countable units to the nearest kitchen fraction', () => {
    expect(scaleAmount(1, 'clove', 4, 7)).toBe(1.75);
    expect(scaleAmount(1, 'unit', 4, 5)).toBe(1.25);
    expect(scaleAmount(3, 'slice', 4, 5)).toBe(3.75);
    expect(scaleAmount(1, 'can', 4, 6)).toBe(1.5);
    expect(scaleAmount(1, 'package', 4, 3)).toBe(0.75);
  });

  it('snaps to thirds and whole numbers', () => {
    expect(scaleAmount(1.3, 'unit', 1, 2)).toBeCloseTo(2 + 2 / 3);
    expect(scaleAmount(1, 'clove', 10, 7)).toBeCloseTo(2 / 3);
    expect(scaleAmount(1, 'clove', 5, 1)).toBe(0.25);
    expect(scaleAmount(1, 'can', 3, 4)).toBeCloseTo(1 + 1 / 3);
    expect(scaleAmount(1, 'unit', 4, 7.9)).toBe(2);
    expect(scaleAmount(1, 'unit', 100, 100.001)).toBe(1);
    expect(scaleAmount(2.5, 'slice', 4, 2)).toBe(1.25);
  });

  it('never rounds a positive amount down to zero', () => {
    expect(scaleAmount(1, 'clove', 100, 1)).toBe(0.25);
    expect(scaleAmount(1, 'g', 100, 1)).toBe(0.01);
    expect(scaleAmount(0.001, 'g', 4, 5)).toBe(0.01);
  });

  it('keeps zero as zero', () => {
    expect(scaleAmount(0, 'g', 4, 8)).toBe(0);
    expect(scaleAmount(0, 'clove', 4, 8)).toBe(0);
  });
});
