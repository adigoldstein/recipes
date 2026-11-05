import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// Must match `OUTCOME_UNKNOWN_EVENT` in data-access (a spec checks it). It is
// repeated here because importing data-access would put the API client in the
// first load (AD-11).
export const OUTCOME_UNKNOWN_EVENT = 'bite-and-board:outcome-unknown';

/**
 * When a write ran past the client's time limit, the server may still have finished it
 * (AD-43). Every query is refetched, so the library, the recipe and the tags show what
 * the server really holds before the editor decides to try again. The message itself
 * ("לא ברור אם הפעולה הושלמה") is the failed action's own error.
 */
export function useOutcomeUnknown() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refetch = () => void queryClient.invalidateQueries();
    globalThis.addEventListener(OUTCOME_UNKNOWN_EVENT, refetch);
    return () => globalThis.removeEventListener(OUTCOME_UNKNOWN_EVENT, refetch);
  }, [queryClient]);
}
