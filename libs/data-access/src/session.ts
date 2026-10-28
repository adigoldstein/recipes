import { useQuery } from '@tanstack/react-query';
import { authSessionOptions } from './generated/@tanstack/react-query.gen';

/**
 * Who is signed in (AD-21). The query cache is the auth state: login sets it,
 * logout clears it, and every component reads it here. `data.user` is null for
 * a visitor, and `data` is undefined only while the first answer is loading.
 *
 * It never goes stale by itself: the cookie is `httpOnly`, so the client cannot
 * see it expire. An expired or revoked session shows up as a 401 on the next
 * protected request (Story 2.3).
 */
export function useSession() {
  return useQuery({ ...authSessionOptions(), staleTime: Infinity });
}
