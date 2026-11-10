import { useQuery } from '@tanstack/react-query';
import { authSessionOptions } from './generated/@tanstack/react-query.gen';
import type { Role } from './generated/types.gen';

// Role ranks. An admin can do everything an editor can, like on the server (AD-30).
const RANK: Record<Role, number> = { editor: 1, admin: 2 };

/** Checks whether a user with role `held` may do what role `required` allows. */
export function roleAtLeast(held: Role, required: Role): boolean {
  return RANK[held] >= RANK[required];
}

/**
 * Returns the logged-in user (AD-21). The query cache holds the login state: login
 * sets it, logout clears it, and every component reads it from here. `data.user` is
 * null for a visitor. `data` is undefined only while the first answer is loading.
 */
export function useSession() {
  // Never reload by itself. The cookie is `httpOnly`, so the client cannot see it
  // expire. An expired session returns 401 on the next protected request, and the
  // 401 handler then sends the user to `/login`.
  return useQuery({ ...authSessionOptions(), staleTime: Infinity });
}

/**
 * Checks whether the logged-in user may use controls that need `role`. Returns false
 * for a visitor and while the session is still loading. Use it to hide controls,
 * not to disable them (FR-16). The server still makes the real check (AD-30).
 */
export function useCan(role: Role): boolean {
  const user = useSession().data?.user;
  return user ? roleAtLeast(user.role, role) : false;
}
