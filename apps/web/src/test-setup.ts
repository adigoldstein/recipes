import { initI18n } from '@bite-and-board/i18n';

initI18n();

type Listener = (event: MediaQueryListEvent) => void;

const listeners = new Set<Listener>();
let systemDark = false;

/** Sets the OS colour scheme jsdom reports, notifying live listeners. */
export function setSystemDark(dark: boolean) {
  systemDark = dark;
  for (const listener of listeners) {
    listener({ matches: dark } as MediaQueryListEvent);
  }
}

// jsdom has no matchMedia; this fake answers the dark-scheme query only.
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
