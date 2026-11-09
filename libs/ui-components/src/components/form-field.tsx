import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Label } from './ui/label';
import { RequiredMark } from './required-mark';

/** The props that a control inside a `FormField` puts on itself. */
export interface FormFieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  'aria-required'?: true;
}

export interface FormFieldProps {
  id: string;
  label: string;
  /**
   * Marks the field as required: a star after the label, and `aria-required` on
   * the control.
   */
  required?: boolean;
  /** The error message under the control. It also marks the control as invalid. */
  error?: string;
  /** A line of help under the control. */
  hint?: string;
  /**
   * Marks the field as "needs to be filled" (an imported draft left it empty). Shows
   * a 2 px `flag` border around the control and this text under it. If there is an
   * error, the error is shown instead of the text. Removed when it is no longer
   * passed.
   */
  flag?: string;
  /** A character counter, shown at the end of the line under the control. */
  counter?: ReactNode;
  className?: string;
  /** Renders the control, with the ids that connect it to the label, hint and error. */
  children: (control: FormFieldControlProps) => ReactNode;
}

/**
 * A label, a control, and the lines under it (hint, error, counter). The control
 * gets `aria-invalid`, `aria-required` and `aria-describedby` from here, so screen
 * readers read the errors and required fields of every form the same way. Forms use
 * `noValidate`, because React Hook Form and Zod do the checks.
 */
export function FormField({
  id,
  label,
  required,
  error,
  hint,
  flag,
  counter,
  className,
  children,
}: FormFieldProps) {
  const flagText = flag && !error ? flag : undefined;
  const describedBy =
    [
      hint ? `${id}-hint` : null,
      error ? `${id}-error` : null,
      flagText ? `${id}-flag` : null,
      counter ? `${id}-counter` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        // Put the flag border on the control (the element after the label) with CSS,
        // without adding a wrapper. So the control keeps its place in the tree, and
        // its focus, when the flag is removed.
        flag &&
          '[&>:nth-child(2)]:rounded-md [&>:nth-child(2)]:outline-2 [&>:nth-child(2)]:outline-offset-2 [&>:nth-child(2)]:outline-flag',
        className,
      )}
    >
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
      {hint || error || flagText || counter ? (
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
            {flagText ? (
              <p id={`${id}-flag`} className="text-flag">
                {flagText}
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
