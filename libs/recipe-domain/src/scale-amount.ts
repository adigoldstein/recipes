/** Units of things you count (FR-11). The same list as in the backend. */
const COUNTABLE_UNITS: ReadonlySet<string> = new Set([
  'unit',
  'clove',
  'slice',
  'can',
  'package',
]);

/** The fractions a cook can measure (Adi's kitchen fractions). 1 closes the range. */
const KITCHEN_FRACTIONS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1] as const;

/**
 * Rounds to the nearest whole number plus kitchen fraction, for example
 * 1.3 -> 1⅓, 0.7 -> ⅔.
 */
function toKitchenFraction(value: number): number {
  const whole = Math.floor(value);
  const part = value - whole;
  const nearest = KITCHEN_FRACTIONS.reduce((best, fraction) =>
    Math.abs(fraction - part) < Math.abs(best - part) ? fraction : best,
  );
  return whole + nearest;
}

/** Scales an ingredient amount from `baseServings` to `servings` (FR-11). */
export function scaleAmount(
  amount: number,
  unit: string | null,
  baseServings: number,
  servings: number,
): number {
  // At the recipe's own servings, return the amount as saved.
  if (servings === baseServings) return amount;
  const scaled = (amount * servings) / baseServings;
  // Counted units round to the nearest kitchen fraction (¼ ⅓ ½ ⅔ ¾). A positive
  // amount never rounds down to zero.
  if (unit !== null && COUNTABLE_UNITS.has(unit)) {
    const snapped = toKitchenFraction(scaled);
    return scaled > 0 ? Math.max(snapped, 1 / 4) : snapped;
  }
  // Other units round to two decimals, and also never down to zero.
  const rounded = Math.round(scaled * 100) / 100;
  return scaled > 0 ? Math.max(rounded, 0.01) : rounded;
}
