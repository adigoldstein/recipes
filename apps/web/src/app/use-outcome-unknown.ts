import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// Must be the same as `OUTCOME_UNKNOWN_EVENT` in data-access (a test checks it). We
// copy it here because importing data-access would add the API client to the first
// load (AD-11).
export const OUTCOME_UNKNOWN_EVENT = 'bite-and-board:outcome-unknown';

/**
 * When a write takes longer than the client's time limit, the server may still have
 * finished it (AD-43). So we reload all the data, and the library, the recipe and the
 * tags show what the server really has before the editor tries again. The message
 * ("לא ברור אם הפעולה הושלמה") is shown by the action that failed.
 */
export function useOutcomeUnknown() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refetch = () => void queryClient.invalidateQueries();
    globalThis.addEventListener(OUTCOME_UNKNOWN_EVENT, refetch);
    return () => globalThis.removeEventListener(OUTCOME_UNKNOWN_EVENT, refetch);
  }, [queryClient]);
}
