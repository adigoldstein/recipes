import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';

/**
 * Stops a form with unsaved changes from being left by accident (UX-DR15). A move to
 * another path (a link, "back", the browser's back button) is blocked and the owner
 * asks the person; closing or reloading the tab gets the browser's own prompt, whose
 * text a page cannot change. `allowLeaving(false)` is for the save: it lets the
 * navigation after a successful save through, and puts the guard back if the save fails.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const allowed = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !allowed.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

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
