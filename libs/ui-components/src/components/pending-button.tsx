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
  /** True while the button's action is running. */
  pending: boolean;
  /** The button's text while it works, in present tense: "מוחקים". */
  pendingLabel: React.ReactNode;
}

/**
 * A button for an action that waits for the server (Story 2.7). If the wait is longer
 * than a short delay, it also shows a spinner and `pendingLabel`, so a fast action
 * does not flicker.
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
      // Disabled as soon as `pending` is true, so a second click cannot repeat the
      // action.
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {/* Both labels are in the same grid cell, so the button keeps its width. The
          hidden label is `aria-hidden`, so the button's name is only the shown one. */}
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
  /** How long to wait before the note shows. The default fits a short action. */
  afterMs?: number;
  /** The text, for example "זה לוקח יותר זמן מהרגיל". */
  children: React.ReactNode;
}

/**
 * The line that says an action is taking longer than usual. The live region is always
 * in the page, so a screen reader reads the text when it appears.
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
