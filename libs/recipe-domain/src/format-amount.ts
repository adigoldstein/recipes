/**
 * Formats an amount for display (FR-11): whole numbers without decimals, others with
 * at most two.
 */
export function formatAmount(amount: number): string {
  return Number.isInteger(amount)
    ? String(amount)
    : String(Math.round(amount * 100) / 100);
}
