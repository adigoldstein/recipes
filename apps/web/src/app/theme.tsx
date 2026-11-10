import {
  createContext,
  use,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { ThemeMode } from '@bite-and-board/ui-components';

/** The script in index.html also reads this key, so keep both the same. */
export const THEME_STORAGE_KEY = 'theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function storeMode(mode: ThemeMode) {
  try {
    if (mode === 'system') {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
  } catch {
    // Storage is blocked, so the choice is kept only until the page closes.
  }
}

const hasMatchMedia = () => typeof window.matchMedia === 'function';

function subscribeToSystemTheme(onChange: () => void) {
  if (!hasMatchMedia()) return () => undefined;
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const systemPrefersDark = () =>
  hasMatchMedia() && window.matchMedia(DARK_QUERY).matches;

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Manages the theme (AD-8). The choice is saved in the browser. In `system` mode,
 * the theme changes right away when the OS setting changes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState(readStoredMode);
  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    systemPrefersDark,
  );
  const dark = mode === 'dark' || (mode === 'system' && systemDark);

  // A layout effect, so the class changes before the browser draws the page.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    storeMode(next);
  };

  return <ThemeContext value={{ mode, setMode }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
