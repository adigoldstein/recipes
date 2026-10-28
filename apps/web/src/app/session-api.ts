import type { QueryClient } from '@tanstack/react-query';
import { authSessionQueryKey, requireRole } from '@bite-and-board/data-access';

// The shell's only door to the API client. Everything imports this file lazily,
// so the client stays out of the first load (AD-11); importing data-access from
// the lazy chunk's own file also keeps the module-boundary lint rule happy.
export { requireRole };

/** Marks the session query as a visitor at once, then confirms with the server. */
export function markSignedOut(queryClient: QueryClient) {
  queryClient.setQueryData(authSessionQueryKey(), { user: null });
  void queryClient.invalidateQueries({ queryKey: authSessionQueryKey() });
}
