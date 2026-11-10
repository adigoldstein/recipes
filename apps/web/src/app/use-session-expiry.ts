import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { toast } from '@bite-and-board/ui-components';

// Must be the same as `SESSION_EXPIRED_EVENT` in data-access (a test checks it). We
// copy it here because importing data-access would add the API client to the first
// load (AD-11).
export const SESSION_EXPIRED_EVENT = 'bite-and-board:session-expired';

/**
 * When a protected request returns 401 (the session expired, or the account was
 * blocked): forget the logged-in user, show a message, and go to `/login?next=…`.
 * It navigates with the router, so data typed in a form is not lost (AD-21).
 */
export function useSessionExpiry() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const path = `${location.pathname}${location.search}`;
  // Set by the first 401 and kept until the user leaves /login. So when several
  // requests fail together, we show one message and navigate once.
  const handled = useRef(false);

  useEffect(() => {
    if (location.pathname !== '/login') handled.current = false;
  }, [location.pathname]);

  useEffect(() => {
    const onExpired = async () => {
      if (handled.current || location.pathname === '/login') return;
      handled.current = true;
      try {
        // Mark the user as logged out before navigating. The login page sends a
        // logged-in user away, so it must not see the old session.
        const { markSignedOut } = await import('./session-api');
        markSignedOut(queryClient);
      } catch {
        // The file could not load (offline). Still go to the login page.
      }
      toast.error(t('auth.sessionExpired'));
      void navigate(`/login?next=${encodeURIComponent(path)}`);
    };
    const listener = () => void onExpired();
    globalThis.addEventListener(SESSION_EXPIRED_EVENT, listener);
    return () =>
      globalThis.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  }, [location.pathname, navigate, path, queryClient, t]);
}
