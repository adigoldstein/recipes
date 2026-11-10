import type * as React from 'react';
import { Slot } from 'radix-ui';
import { cn } from '../lib/utils';

export interface TopBarProps {
  /** The app name, usually a router link inside `Wordmark`. */
  brand: React.ReactNode;
  /** The controls at the end (theme toggle, account menu). */
  actions?: React.ReactNode;
  className?: string;
}

/** The app's top bar: the app name at the start, and the controls at the end. */
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

/** The style of the "ביס & סיר" name. With `asChild`, a router link gets the style. */
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
