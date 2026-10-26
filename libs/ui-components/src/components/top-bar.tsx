import type * as React from 'react';
import { Slot } from 'radix-ui';
import { cn } from '../lib/utils';

export interface TopBarProps {
  /** The wordmark, usually a router link wrapped in `Wordmark`. */
  brand: React.ReactNode;
  /** Trailing controls (theme toggle, account menu). */
  actions?: React.ReactNode;
  className?: string;
}

/** The app's only navigation bar: wordmark at the start, actions at the end. */
export function TopBar({ brand, actions, className }: TopBarProps) {
  return (
    <header className={cn('bg-background', className)}>
      <div className="mx-auto flex h-16 max-w-library items-center justify-between gap-3 px-4 lg:px-8">
        {brand}
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}

/** The ביס & סיר wordmark styling; `asChild` lets a router link carry it. */
export function Wordmark({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<'a'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'a';
  return (
    <Comp
      className={cn(
        'rounded-sm text-title text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  );
}
