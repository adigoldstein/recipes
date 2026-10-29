import { cn } from '../lib/utils';

/**
 * The " *" that marks a required field, at the end of its label or heading. Hidden from
 * screen readers, which hear `aria-required` on the control instead of "star".
 */
export function RequiredMark({ className }: { className?: string }) {
  return (
    // `-ms-1.5` pulls the star in under a flex label's gap, so it reads as part of the text.
    <span
      aria-hidden="true"
      className={cn('-ms-1.5 text-destructive', className)}
    >
      {' *'}
    </span>
  );
}

/**
 * The line that explains the star, once at the top of a form. Every `*` in the text is
 * drawn like the stars it explains.
 */
export function RequiredNote({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const parts = children.split('*');
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {parts.map((part, index) => (
        // The parts never reorder, so the index is a stable key.
        <span key={index}>
          {index > 0 ? <span className="text-destructive">*</span> : null}
          {part}
        </span>
      ))}
    </p>
  );
}
