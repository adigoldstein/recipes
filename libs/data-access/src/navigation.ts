import type { MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * Decides what a page's back button does.
 *
 * If the user came from another page in the app, going one step back in history
 * returns to that page, with its filters. After a direct visit or a reload there is
 * no such page, so the button keeps its link to the home page.
 *
 * Use `onBack` as the `onClick` of the link to the home page.
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
