import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { toast } from '@bite-and-board/ui-components';

// Must match `SESSION_EXPIRED_EVENT` in data-access (a spec checks it). It is
// repeated here because importing data-access would put the API client in the
// first load (AD-11).
export const SESSION_EXPIRED_EVENT = 'bite-and-board:session-expired';

/**
 * When a protected call answers 401 (the session expired, or the account was
 * blocked), send the user to `/login?next=…`, say why, and forget the signed-in
 * state. It navigates through the router, so a form's in-memory state survives
 * (AD-21). Several calls failing at once count as one.
 */
export function useSessionExpiry() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const path = `${location.pathname}${location.search}`;
  // Set by the first 401 and held until the user leaves /login again, so the
  // calls that fail together do not each toast and navigate.
  const handled = useRef(false);

  useEffect(() => {
    if (location.pathname !== '/login') handled.current = false;
  }, [location.pathname]);

  useEffect(() => {
    const onExpired = async () => {
      if (handled.current || location.pathname === '/login') return;
      handled.current = true;
      try {
        // Marked signed out before navigating: the login page sends a signed-in
        // user straight on, so it must not see the stale session.
        const { markSignedOut } = await import('./session-api');
        markSignedOut(queryClient);
      } catch {
        // The chunk could not load (offline): still go to the login page.
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
