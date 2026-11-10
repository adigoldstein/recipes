import { useId } from 'react';
import { cn } from '../lib/utils';

export interface IngredientQuantity {
  /** The amount, already formatted. */
  amount: string;
  /** The unit name, already singular or plural. Leave it out for a plain count. */
  unit?: string;
}

export interface IngredientLineProps {
  name: string;
  note?: string;
  /** The amount. Leave it out (and pass `toTasteLabel`) for "to taste". */
  quantity?: IngredientQuantity;
  /**
   * The imperial value before an import converted it. Shown in parentheses next to
   * `quantity`.
   */
  source?: IngredientQuantity;
  /** "לפי הטעם". The line then shows "name — to taste". */
  toTasteLabel?: string;
  /**
   * The original value hint (FR-7), for example "במקור 2 כוסות", shown under the
   * line.
   */
  originalHint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

function Quantity({ amount, unit }: IngredientQuantity) {
  return (
    <>
      <bdi className="text-quantity tabular-nums">{amount}</bdi>
      {unit ? ` ${unit}` : null}
    </>
  );
}

/** One ingredient on the board, with a checkbox to mark it done (UX-DR10). */
export function IngredientLine({
  name,
  note,
  quantity,
  source,
  toTasteLabel,
  originalHint,
  checked,
  onCheckedChange,
  className,
}: IngredientLineProps) {
  const hintId = useId();
  return (
    <li className={className}>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-describedby={originalHint ? hintId : undefined}
          className="mt-0.5 size-6 shrink-0 accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring"
        />
        <span
          className={cn(
            'min-w-0 break-words',
            checked && 'line-through opacity-60',
          )}
        >
          {quantity && source ? (
            <>
              <Quantity {...source} />
              {' ('}
              <Quantity {...quantity} />
              {') '}
            </>
          ) : null}
          {quantity && !source ? (
            <>
              <Quantity {...quantity} />{' '}
            </>
          ) : null}
          <span dir="auto">{name}</span>
          {quantity === undefined && toTasteLabel ? ` — ${toTasteLabel}` : null}
          {note ? (
            <>
              {' '}
              <span dir="auto" className="text-label opacity-80">
                {note}
              </span>
            </>
          ) : null}
        </span>
      </label>
      {originalHint ? (
        <p id={hintId} className="ps-9 text-label text-hint">
          {originalHint}
        </p>
      ) : null}
    </li>
  );
}
