import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router';
import { ThemeToggle, TopBar, Wordmark } from '@bite-and-board/ui-components';
import { useTheme } from './theme';

/** The shell around every page: top bar, then the page in `<main>`. */
export function AppLayout() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const shownKey = useRef(location.key);

  // After a navigation (not the first load), move focus to the new page's h1
  // so screen readers announce it and keyboard users start at the content.
  useEffect(() => {
    if (shownKey.current === location.key) return;
    shownKey.current = location.key;
    main.current?.querySelector('h1')?.focus();
  }, [location.key]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopBar
        brand={
          <Wordmark asChild>
            <Link to="/">{t('app.name')}</Link>
          </Wordmark>
        }
        actions={
          <ThemeToggle
            value={mode}
            onValueChange={setMode}
            label={t(`theme.toggle.${mode}`)}
          />
        }
      />
      <main ref={main} className="mx-auto max-w-library px-4 pb-12 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
