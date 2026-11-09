const VULGAR_FRACTIONS: Readonly<Record<string, number>> = {
  '¼': 1 / 4,
  '½': 1 / 2,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};

const DECIMAL = /^(\d+[.,]\d+|\d+|[.,]\d+)$/;
const VULGAR = /^(\d+)?\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/;
const FRACTION = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/;

/** Rounds to 3 decimals, like the server, so 1/3 is 0.333 on both sides. */
const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Reads the number from a typed amount (FR-4): "1.5", "1,5", "½", "⅓", "1 ½", "1/3"
 * and "1 1/2". Returns null if the text is none of these, or divides by zero.
 *
 * Zero is read as 0; the write schema rejects it with its own message. Empty text is
 * handled by the caller (it means "to taste").
 */
export function parseAmount(text: string): number | null {
  const value = text.trim();
  if (DECIMAL.test(value)) return round(Number(value.replace(',', '.')));
  const vulgar = VULGAR.exec(value);
  if (vulgar) {
    return round(Number(vulgar[1] ?? 0) + VULGAR_FRACTIONS[vulgar[2]]);
  }
  const fraction = FRACTION.exec(value);
  if (fraction) {
    const denominator = Number(fraction[3]);
    if (denominator === 0) return null;
    return round(Number(fraction[1] ?? 0) + Number(fraction[2]) / denominator);
  }
  return null;
}
