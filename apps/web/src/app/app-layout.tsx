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
  const shownPath = useRef(location.pathname);

  // After a navigation to another page (not the first load), move focus to the
  // new page's h1 so screen readers announce it and keyboard users start at the
  // content. Only the path counts: a page that keeps its state in the query
  // string (the library's search) navigates on every keystroke and must keep focus.
  useEffect(() => {
    if (shownPath.current === location.pathname) return;
    shownPath.current = location.pathname;
    main.current?.querySelector('h1')?.focus();
  }, [location.pathname]);

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
