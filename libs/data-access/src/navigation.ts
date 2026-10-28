import type { MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * What a page's back button does. Arriving by navigating inside the app (the router
 * location key is not "default") means one step back in history returns to the page
 * the visitor came from, with its filters. A direct visit or a reload has no such
 * page, so the button keeps its link to the fallback (the home page).
 *
 * Use `onBack` as the `onClick` of the router link to the fallback page.
 */
export function useBackNavigation() {
  const navigate = useNavigate();
  const cameFromApp = useLocation().key !== 'default';
  const onBack = (event: MouseEvent<HTMLElement>) => {
    if (!cameFromApp) return;
    event.preventDefault();
    void navigate(-1);
  };
  return { cameFromApp, onBack };
}
