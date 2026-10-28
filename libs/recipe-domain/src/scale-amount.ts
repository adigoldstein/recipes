/** Units counted in whole pieces (FR-11); mirrors the backend's countable set. */
const COUNTABLE_UNITS: ReadonlySet<string> = new Set([
  'unit',
  'clove',
  'slice',
  'can',
  'package',
]);

/** The fractions a cook can measure (Adi's kitchen fractions), with 1 closing the range. */
const KITCHEN_FRACTIONS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1] as const;

/** The nearest whole-plus-kitchen-fraction, e.g. 1.3 -> 1⅓, 0.7 -> ⅔. */
function toKitchenFraction(value: number): number {
  const whole = Math.floor(value);
  const part = value - whole;
  const nearest = KITCHEN_FRACTIONS.reduce((best, fraction) =>
    Math.abs(fraction - part) < Math.abs(best - part) ? fraction : best,
  );
  return whole + nearest;
}

/**
 * An ingredient amount scaled from `baseServings` to `servings` (FR-11).
 * Countable units round to the nearest kitchen fraction (¼ ⅓ ½ ⅔ ¾), others to
 * two decimals. A positive amount never rounds down to zero. At the base
 * servings the amount is as stored.
 */
export function scaleAmount(
  amount: number,
  unit: string | null,
  baseServings: number,
  servings: number,
): number {
  if (servings === baseServings) return amount;
  const scaled = (amount * servings) / baseServings;
  if (unit !== null && COUNTABLE_UNITS.has(unit)) {
    const snapped = toKitchenFraction(scaled);
    return scaled > 0 ? Math.max(snapped, 1 / 4) : snapped;
  }
  const rounded = Math.round(scaled * 100) / 100;
  return scaled > 0 ? Math.max(rounded, 0.01) : rounded;
}
