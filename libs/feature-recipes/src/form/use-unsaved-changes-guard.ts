import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';

/**
 * Stops the user from leaving a form with unsaved changes by mistake (UX-DR15).
 *
 * `allowLeaving` is for saving: `allowLeaving(true)` lets the navigation after a
 * successful save through, and `allowLeaving(false)` turns the guard back on if the
 * save fails.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const allowed = useRef(false);
  // Block a move to another path (a link, "back", the browser's back button). The
  // component that uses this hook then asks the user.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !allowed.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  // Closing or reloading the tab shows the browser's own question. A page cannot
  // change its text.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!allowed.current) event.preventDefault();
    };
    globalThis.addEventListener('beforeunload', warn);
    return () => globalThis.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return {
    blocker,
    allowLeaving: (allow: boolean) => {
      allowed.current = allow;
    },
  };
}
