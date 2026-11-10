import type { QueryClient } from '@tanstack/react-query';
import { authSessionQueryKey, requireRole } from '@bite-and-board/data-access';

// The only file in the app layout that imports the API client. Everyone imports
// this file lazily, so the client is not part of the first load (AD-11). Importing
// data-access only from here also satisfies the module-boundary lint rule.
export { requireRole };

/** Marks the user as logged out right away, then checks again with the server. */
export function markSignedOut(queryClient: QueryClient) {
  queryClient.setQueryData(authSessionQueryKey(), { user: null });
  void queryClient.invalidateQueries({ queryKey: authSessionQueryKey() });
}
