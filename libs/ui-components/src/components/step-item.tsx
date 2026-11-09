import { cn } from '../lib/utils';

export interface StepItemProps {
  /** The step number, starting at 1. */
  number: number;
  text: string;
  /** The step's text before an import converted it. Shown under the text. */
  originalText?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

/** One numbered step of the recipe, with a checkbox to mark it done. */
export function StepItem({
  number,
  text,
  originalText,
  checked,
  onCheckedChange,
  className,
}: StepItemProps) {
  return (
    <li className={className}>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-0.5 size-6 shrink-0 accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring"
        />
        <span
          aria-hidden="true"
          className="mt-0.5 w-6 shrink-0 text-center text-quantity tabular-nums text-muted-foreground"
        >
          {number}
        </span>
        <span className={cn('min-w-0', checked && 'line-through opacity-60')}>
          <span dir="auto" className="block break-words">
            {text}
          </span>
          {originalText ? (
            <span dir="auto" className="block text-label text-hint-muted">
              {originalText}
            </span>
          ) : null}
        </span>
      </label>
    </li>
  );
}
