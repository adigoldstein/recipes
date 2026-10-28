import type { QueryClient } from '@tanstack/react-query';
import { data, redirect } from 'react-router';
import { authSessionOptions } from './generated/@tanstack/react-query.gen';
import type { Role } from './generated/types.gen';
import { roleAtLeast } from './session';

/**
 * A route loader that guards a signed-in area, like a Nest `@Roles()` guard.
 * A visitor is sent to `/login?next=…`; a signed-in user without `role` gets a
 * 404, so an editor never learns that an admin screen exists. Without `role` any
 * signed-in user passes. It reads the session from the cache the page already
 * shares, so a guarded click costs no extra request after the first.
 */
export function requireRole(queryClient: QueryClient, role?: Role) {
  return async ({ request }: { request: Request }) => {
    const { user } = await queryClient.ensureQueryData({
      ...authSessionOptions(),
      staleTime: Infinity,
    });
    if (!user) {
      const { pathname, search } = new URL(request.url);
      throw redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
    }
    if (role && !roleAtLeast(user.role, role)) {
      throw data(null, { status: 404 });
    }
    return null;
  };
}
