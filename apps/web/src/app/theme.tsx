import {
  createContext,
  use,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { ThemeMode } from '@bite-and-board/ui-components';

/** Read by the pre-paint script in index.html too; keep both in sync. */
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
    // Storage blocked: the choice lasts for this session only.
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

/** Owns the theme mode (AD-8): remembered per browser, `system` follows the OS live. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState(readStoredMode);
  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    systemPrefersDark,
  );
  const dark = mode === 'dark' || (mode === 'system' && systemDark);

  // Layout effect: the class flips before the browser paints the new theme.
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
