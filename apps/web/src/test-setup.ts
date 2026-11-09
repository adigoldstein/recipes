import { configure } from '@testing-library/react';

// The first render loads a lazy page, which is slow on the first test run.
configure({ asyncUtilTimeout: 5000 });

type Listener = (event: MediaQueryListEvent) => void;

const listeners = new Set<Listener>();
let systemDark = false;

/** Sets the OS dark/light mode that jsdom reports, and tells the listeners. */
export function setSystemDark(dark: boolean) {
  systemDark = dark;
  for (const listener of listeners) {
    listener({ matches: dark } as MediaQueryListEvent);
  }
}

// jsdom has no matchMedia. This fake version answers only the dark mode query.
window.matchMedia = (query: string) =>
  ({
    media: query,
    get matches() {
      return query === '(prefers-color-scheme: dark)' && systemDark;
    },
    addEventListener: (_: string, listener: Listener) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) =>
      listeners.delete(listener),
  }) as unknown as MediaQueryList;

afterEach(() => {
  systemDark = false;
  listeners.clear();
  window.localStorage.clear();
  document.documentElement.className = '';
});
