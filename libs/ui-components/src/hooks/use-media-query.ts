import { useSyncExternalStore } from 'react';

/**
 * Returns whether a CSS media query matches, and updates when it changes. Returns
 * false where `matchMedia` does not exist.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    if (typeof window.matchMedia !== 'function') return () => undefined;
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  };
  const getSnapshot = () =>
    typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True from Tailwind's `sm` size and up, where the chip row has room for all tags. */
export const useIsDesktop = () => useMediaQuery('(min-width: 40rem)');
