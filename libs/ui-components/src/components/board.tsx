import type * as React from 'react';
import { cn } from '../lib/utils';

/** The oak cutting-board slab with its handle slot; food surfaces only (DESIGN.md). */
export function Board({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="board"
      className={cn(
        'relative rounded-board bg-board p-4.5 pt-9 text-board-foreground',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-3 mx-auto h-3 w-11 rounded-full bg-background"
      />
      {children}
    </div>
  );
}
