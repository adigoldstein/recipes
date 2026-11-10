import { cn } from '../lib/utils';

/**
 * The " *" that marks a required field, at the end of its label or heading. Screen
 * readers skip it, and use `aria-required` on the control instead.
 */
export function RequiredMark({ className }: { className?: string }) {
  return (
    // `-ms-1.5` cancels the gap of a flex label, so the star sits right after the
    // text.
    <span
      aria-hidden="true"
      className={cn('-ms-1.5 text-destructive', className)}
    >
      {' *'}
    </span>
  );
}

/**
 * The line that explains the star, once at the top of a form. Every `*` in the text
 * looks like the stars it explains.
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
        // The parts never change order, so the index is a safe key.
        <span key={index}>
          {index > 0 ? <span className="text-destructive">*</span> : null}
          {part}
        </span>
      ))}
    </p>
  );
}
