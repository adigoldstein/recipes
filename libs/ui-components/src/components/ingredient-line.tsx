import { useId } from 'react';
import { cn } from '../lib/utils';

export interface IngredientQuantity {
  /** The amount, already formatted. */
  amount: string;
  /** The unit label, already singular or plural; leave out for a bare count. */
  unit?: string;
}

export interface IngredientLineProps {
  name: string;
  note?: string;
  /** The amount; leave out (with `toTasteLabel`) for a to-taste line. */
  quantity?: IngredientQuantity;
  /** The imperial value an import converted from; shown with `quantity` in parentheses. */
  source?: IngredientQuantity;
  /** "לפי הטעם": makes the line read "name — to taste". */
  toTasteLabel?: string;
  /** The FR-7 hint, e.g. "במקור 2 כוסות", shown under the line. */
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

/** One ingredient on the board, with a tick-off checkbox (UX-DR10). */
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
