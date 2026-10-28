import { useQuery } from '@tanstack/react-query';
import { authSessionOptions } from './generated/@tanstack/react-query.gen';
import type { Role } from './generated/types.gen';

// Admin satisfies every editor-level check, as on the server (AD-30).
const RANK: Record<Role, number> = { editor: 1, admin: 2 };

/** Whether someone with `held` may do what `required` allows. */
export function roleAtLeast(held: Role, required: Role): boolean {
  return RANK[held] >= RANK[required];
}

/**
 * Who is signed in (AD-21). The query cache is the auth state: login sets it,
 * logout clears it, and every component reads it here. `data.user` is null for
 * a visitor, and `data` is undefined only while the first answer is loading.
 *
 * It never goes stale by itself: the cookie is `httpOnly`, so the client cannot
 * see it expire. An expired or revoked session shows up as a 401 on the next
 * protected request, which the 401 interceptor turns into a trip to `/login`.
 */
export function useSession() {
  return useQuery({ ...authSessionOptions(), staleTime: Infinity });
}

/**
 * Whether the signed-in user may use controls that need `role`. A visitor, and
 * the moment before the first answer, both say no. Hide controls with this
 * instead of disabling them (FR-16); the server stays the authority (AD-30).
 */
export function useCan(role: Role): boolean {
  const user = useSession().data?.user;
  return user ? roleAtLeast(user.role, role) : false;
}
