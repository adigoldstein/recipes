import { useSyncExternalStore } from 'react';

/** Follows a CSS media query live; false where `matchMedia` does not exist. */
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

/** Tailwind's `sm` and up: the chip row has room for every tag. */
export const useIsDesktop = () => useMediaQuery('(min-width: 40rem)');
