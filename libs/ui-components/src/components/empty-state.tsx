import type * as React from 'react';
import { cn } from '../lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Buttons or links under the text. */
  actions?: React.ReactNode;
  className?: string;
}

/** A centred message for "nothing here yet" and "nothing matches" (UX-DR17). */
export function EmptyState({
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-4 py-16 text-center',
        className,
      )}
    >
      <h2 className="text-title">{title}</h2>
      {description ? (
        <p className="max-w-detail text-muted-foreground">{description}</p>
      ) : null}
      {actions ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
