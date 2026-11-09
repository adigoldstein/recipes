import type { QueryClient } from '@tanstack/react-query';
import { data, redirect } from 'react-router';
import { authSessionOptions } from './generated/@tanstack/react-query.gen';
import type { Role } from './generated/types.gen';
import { roleAtLeast } from './session';

/**
 * A route loader that protects pages for logged-in users, like a Nest `@Roles()`
 * guard. If `role` is not given, any logged-in user can enter.
 */
export function requireRole(queryClient: QueryClient, role?: Role) {
  return async ({ request }: { request: Request }) => {
    // Read the session from the shared cache, so only the first check sends a
    // request.
    const { user } = await queryClient.ensureQueryData({
      ...authSessionOptions(),
      staleTime: Infinity,
    });
    // A visitor is sent to the login page, and comes back here after logging in.
    if (!user) {
      const { pathname, search } = new URL(request.url);
      throw redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
    }
    // A user without the role gets 404, so an editor does not even learn that an
    // admin page exists.
    if (role && !roleAtLeast(user.role, role)) {
      throw data(null, { status: 404 });
    }
    return null;
  };
}
