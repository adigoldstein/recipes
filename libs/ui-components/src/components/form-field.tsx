import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Label } from './ui/label';
import { RequiredMark } from './required-mark';

/** What a control inside a `FormField` spreads on itself. */
export interface FormFieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  'aria-required'?: true;
}

export interface FormFieldProps {
  id: string;
  label: string;
  /** Marks the field as required: a star after the label, and `aria-required` on the control. */
  required?: boolean;
  /** The message under the control; also marks the control invalid. */
  error?: string;
  /** A line of help under the control. */
  hint?: string;
  /** A character counter, shown at the end of the line under the control. */
  counter?: ReactNode;
  className?: string;
  /** Renders the control with the ids that tie label, hint and error to it. */
  children: (control: FormFieldControlProps) => ReactNode;
}

/**
 * A label, a control and the lines under it (hint, error, counter). The control
 * gets `aria-invalid`, `aria-required` and `aria-describedby` from here, so every
 * form reads its errors and its required fields to screen readers the same way.
 * Forms stay `noValidate`; the checks are React Hook Form's and Zod's.
 */
export function FormField({
  id,
  label,
  required,
  error,
  hint,
  counter,
  className,
  children,
}: FormFieldProps) {
  const describedBy =
    [
      hint ? `${id}-hint` : null,
      error ? `${id}-error` : null,
      counter ? `${id}-counter` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <RequiredMark /> : null}
      </Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {hint || error || counter ? (
        <div className="flex items-start justify-between gap-3 text-sm">
          <div className="flex min-w-0 flex-col gap-1">
            {hint ? (
              <p id={`${id}-hint`} className="text-muted-foreground">
                {hint}
              </p>
            ) : null}
            {error ? (
              <p id={`${id}-error`} className="text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          {counter ? (
            <span id={`${id}-counter`} className="ms-auto shrink-0">
              {counter}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
