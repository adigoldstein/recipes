import type { QueryClient } from '@tanstack/react-query';
import {
  isRouteErrorResponse,
  useRouteError,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import type { Role } from '@bite-and-board/data-access';
import { NotFound } from './not-found';

// Import the guard only when it first runs, so the API client is not part of the
// first load (AD-11). A protected page needs the API client anyway.
function guard(queryClient: QueryClient, role?: Role) {
  return async (args: LoaderFunctionArgs) => {
    const { requireRole } = await import('./session-api');
    return requireRole(queryClient, role)(args);
  };
}

/** Shows the not-found page inside the layout. Any other error goes up to the root. */
function ProtectedError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  throw error;
}

/**
 * A group of pages for logged-in users (FR-16). Visitors are sent to
 * `/login?next=…`. If `role` is set, users with a lower role see the not-found page.
 * The pages open only after the guard runs, so their loaders can rely on the session.
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
