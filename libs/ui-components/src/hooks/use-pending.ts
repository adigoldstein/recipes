import { useEffect, useRef, useState } from 'react';

/**
 * Timings for the "waiting" indicator (Story 2.7). A spinner that flashes for a tenth
 * of a second is worse than no spinner. So it appears only after `PENDING_DELAY_MS`,
 * and once shown, it stays for at least `PENDING_MIN_MS`.
 */
export const PENDING_DELAY_MS = 300;
export const PENDING_MIN_MS = 500;
/** After this time, a short action shows that it is taking longer than usual. */
export const SLOW_AFTER_MS = 10_000;
/** The same, for long actions: an import or a photo upload. */
export const SLOW_AFTER_LONG_MS = 30_000;

export interface PendingTiming {
  delayMs?: number;
  minVisibleMs?: number;
}

/**
 * Decides whether to show the waiting indicator for a `pending` action. False for a
 * fast action. True only after the action lasted `delayMs`, and then it stays for at
 * least `minVisibleMs`. This only decides what to show; the action itself must still
 * be blocked right away.
 */
export function usePendingVisible(
  pending: boolean,
  {
    delayMs = PENDING_DELAY_MS,
    minVisibleMs = PENDING_MIN_MS,
  }: PendingTiming = {},
): boolean {
  const [visible, setVisible] = useState(false);
  // When the indicator appeared. Null while it is hidden.
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

/** True after a `pending` action lasted `afterMs`. Goes back to false when it ends. */
export function useSlowPending(
  pending: boolean,
  afterMs: number = SLOW_AFTER_MS,
): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), afterMs);
    // Reset when the action ends (or the limit changes), ready for the next time.
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [pending, afterMs]);

  return slow;
}
