import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';

export interface ServingsStepperProps {
  /** The current number of servings. */
  value: number;
  /** The recipe's own servings; the reset button shows when `value` differs. */
  base: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  /** "חזרה ל־4"; the button is shown only when `value` differs from `base`. */
  resetLabel: string;
  /** Shown while the typed value is empty or outside `min`–`max`. */
  rangeMessage: string;
  /** Read out politely whenever the servings change, e.g. "10 מנות". */
  announcement: string;
  className?: string;
}

/** Servings control with 44 px buttons and a typeable, clamped value (UX-DR9). */
export function ServingsStepper({
  value,
  base,
  min,
  max,
  onChange,
  label,
  decreaseLabel,
  increaseLabel,
  resetLabel,
  rangeMessage,
  announcement,
  className,
}: ServingsStepperProps) {
  const inputId = useId();
  const messageId = useId();
  // What is being typed; null while the field simply shows `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const invalid =
    draft !== null &&
    (draft === '' || Number(draft) < min || Number(draft) > max);

  const commit = (next: number) => {
    setDraft(null);
    onChange(Math.min(max, Math.max(min, next)));
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={inputId} className="text-label">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={decreaseLabel}
          disabled={value <= min}
          onClick={() => commit(value - 1)}
        >
          <Minus aria-hidden="true" />
        </Button>
        <Input
          id={inputId}
          type="text"
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          value={draft ?? String(value)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? messageId : undefined}
          className="w-16 text-center tabular-nums"
          onChange={(event) => {
            const text = event.target.value.replace(/\D/g, '');
            setDraft(text);
            const next = Number(text);
            if (text !== '' && next >= min && next <= max) onChange(next);
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setDraft(null);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={increaseLabel}
          disabled={value >= max}
          onClick={() => commit(value + 1)}
        >
          <Plus aria-hidden="true" />
        </Button>
        {value !== base ? (
          <Button type="button" variant="ghost" onClick={() => commit(base)}>
            {resetLabel}
          </Button>
        ) : null}
      </div>
      {invalid ? (
        <p id={messageId} className="text-label text-destructive">
          {rangeMessage}
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
