import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { OriginalValue, Unit } from '@bite-and-board/data-access';
import { formatAmount } from '@bite-and-board/recipe-domain';

type Scale = (amount: number, unit: Unit | null) => number;

/**
 * Returns the hint text for an ingredient's original value (FR-7), such as
 * "במקור 2 כוסות" or "במקור: לפי הטעם". Returns undefined if there is no original.
 * On the recipe page, `scale` adjusts it to the servings. The edit form shows the
 * original as it was saved.
 */
export function useOriginalHint() {
  const { t } = useTranslation();
  return (original: OriginalValue | null | undefined, scale?: Scale) => {
    if (!original) return undefined;
    if (original.amount === null) return t('detail.originalToTaste');
    const amount = scale
      ? scale(original.amount, original.unit)
      : original.amount;
    // In Hebrew the singular is used only for exactly 1 ("1 כוס", "2 כוסות",
    // "0.5 כוסות").
    const unit = original.unit
      ? t(`units.${original.unit}` as ParseKeys, {
          count: amount === 1 ? 1 : 0,
        })
      : undefined;
    const quantity = formatAmount(amount);
    return t('detail.originalHint', {
      value: unit ? `${quantity} ${unit}` : quantity,
    });
  };
}
