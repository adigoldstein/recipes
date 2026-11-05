import type * as React from 'react';
import { Loader2Icon } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  usePendingVisible,
  useSlowPending,
  SLOW_AFTER_MS,
  type PendingTiming,
} from '../hooks/use-pending';
import { Button } from './ui/button';

export interface PendingButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'asChild'>, PendingTiming {
  /** The action behind the button is running. */
  pending: boolean;
  /** What the button says while it works, in the present continuous: "מוחקים". */
  pendingLabel: React.ReactNode;
}

/**
 * A button for an action that waits on the server (Story 2.7). The moment `pending`
 * is true it is disabled, so a second tap cannot repeat the action. If the wait lasts
 * past a short delay it also shows a spinner and `pendingLabel`; a fast action never
 * flickers. Both labels share one grid cell, so the button keeps its width; the one
 * that is not shown is `aria-hidden`, so the button's name is the shown label only.
 */
export function PendingButton({
  pending,
  pendingLabel,
  children,
  disabled,
  delayMs,
  minVisibleMs,
  ...props
}: PendingButtonProps) {
  const visible = usePendingVisible(pending, { delayMs, minVisibleMs });
  return (
    <Button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      <span className="inline-grid items-center justify-items-center">
        <span
          aria-hidden={visible || undefined}
          className={cn(
            'col-start-1 row-start-1 inline-flex items-center gap-2',
            visible && 'invisible',
          )}
        >
          {children}
        </span>
        <span
          aria-hidden={!visible || undefined}
          className={cn(
            'col-start-1 row-start-1 inline-flex items-center gap-2',
            !visible && 'invisible',
          )}
        >
          <Loader2Icon
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
          {pendingLabel}
        </span>
      </span>
    </Button>
  );
}

export interface SlowNoteProps {
  pending: boolean;
  /** How long the wait must last before the note shows; default for a short action. */
  afterMs?: number;
  /** "זה לוקח יותר זמן מהרגיל". */
  children: React.ReactNode;
}

/**
 * The line that says an action is taking longer than usual. The live region is always
 * in the page, so a screen reader announces the text when it appears.
 */
export function SlowNote({
  pending,
  afterMs = SLOW_AFTER_MS,
  children,
}: SlowNoteProps) {
  const slow = useSlowPending(pending, afterMs);
  return (
    <p role="status" className="min-h-5 text-sm text-muted-foreground">
      {slow ? children : null}
    </p>
  );
}
