import type { QueryClient } from '@tanstack/react-query';
import {
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import type { Role } from '@bite-and-board/data-access';
import { NotFound } from './not-found';

// The guard is imported when it first runs, so the API client stays out of the
// first load (AD-11); by the time someone opens a guarded page it is needed anyway.
function guard(queryClient: QueryClient, role?: Role) {
  return async (args: LoaderFunctionArgs) => {
    const { requireRole } = await import('./session-api');
    return requireRole(queryClient, role)(args);
  };
}

/** Shows the not-found page inside the shell; any other error goes up to the root. */
function ProtectedError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  throw error;
}

/**
 * A group of pages for signed-in users (FR-16): visitors go to `/login?next=…`,
 * and with `role` set, anyone below it sees the not-found page. The routes are
 * only reachable after the guard runs, so their own loaders can trust the session.
 */
export function protectedRoute(
  queryClient: QueryClient,
  role: Role | undefined,
  children: RouteObject[],
): RouteObject {
  return {
    loader: guard(queryClient, role),
    errorElement: <ProtectedError />,
    children,
  };
}
