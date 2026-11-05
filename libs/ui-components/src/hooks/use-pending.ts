import { useEffect, useRef, useState } from 'react';

/**
 * Waiting feedback timings (Story 2.7). A spinner that flashes for a tenth of a second
 * is worse than none, so it appears only after `PENDING_DELAY_MS`, and once shown it
 * stays for at least `PENDING_MIN_MS`.
 */
export const PENDING_DELAY_MS = 300;
export const PENDING_MIN_MS = 500;
/** After this long a short action says it is taking longer than usual. */
export const SLOW_AFTER_MS = 10_000;
/** The same for the long ones: an import, a photo upload. */
export const SLOW_AFTER_LONG_MS = 30_000;

export interface PendingTiming {
  delayMs?: number;
  minVisibleMs?: number;
}

/**
 * Whether to show the waiting indicator for an action that is `pending`: false for a
 * fast action, true only once it has lasted `delayMs`, then kept for `minVisibleMs`.
 * The action itself must still be blocked at once; this only decides what to show.
 */
export function usePendingVisible(
  pending: boolean,
  {
    delayMs = PENDING_DELAY_MS,
    minVisibleMs = PENDING_MIN_MS,
  }: PendingTiming = {},
): boolean {
  const [visible, setVisible] = useState(false);
  // When the indicator appeared; null while it is hidden.
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    if (pending) {
      const show = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delayMs);
      return () => clearTimeout(show);
    }
    if (shownAt.current === null) return;
    const remaining = Math.max(
      0,
      minVisibleMs - (Date.now() - shownAt.current),
    );
    const hide = setTimeout(() => {
      shownAt.current = null;
      setVisible(false);
    }, remaining);
    return () => clearTimeout(hide);
  }, [pending, delayMs, minVisibleMs]);

  return visible;
}

/** True once an action that is `pending` has lasted `afterMs`; resets when it ends. */
export function useSlowPending(
  pending: boolean,
  afterMs: number = SLOW_AFTER_MS,
): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), afterMs);
    // Reset when the action ends (or the limit changes), for the next run.
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [pending, afterMs]);

  return slow;
}
