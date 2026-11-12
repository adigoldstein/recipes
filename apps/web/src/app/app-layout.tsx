import { lazy, Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router';
import { ThemeToggle, TopBar, Wordmark } from '@bite-and-board/ui-components';
import { useSessionExpiry } from './use-session-expiry';
import { useTheme } from './theme';

// Load the account menu as a separate chunk. It reads the session with the API
// client, and a visitor who only browses recipes should not wait for it (AD-11).
const AccountMenu = lazy(async () => ({
  default: (await import('@bite-and-board/feature-auth/account-menu'))
    .AccountMenu,
}));

// Also a separate chunk, for the same reason: it checks who is logged in. Visitors
// see nothing, and editors see the "מתכון חדש" button.
const NewRecipeButton = lazy(async () => ({
  default: (await import('@bite-and-board/feature-recipes/new-recipe-button'))
    .NewRecipeButton,
}));

/** The frame around every page: the top bar, and then the page inside `<main>`. */
export function AppLayout() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const shownPath = useRef(location.pathname);

  useSessionExpiry();

  // After moving to another page (not on the first load), move focus to the new
  // page's h1, so screen readers read it and keyboard users start at the content.
  useEffect(() => {
    // Check only the path. The library keeps its search in the query string, so it
    // navigates on every key press, and it must not lose focus.
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
          <>
            <Suspense fallback={null}>
              <NewRecipeButton />
            </Suspense>
            <ThemeToggle
              value={mode}
              onValueChange={setMode}
              label={t(`theme.toggle.${mode}`)}
            />
            {/* The same size as the "כניסה" button, so the bar does not jump. */}
            <Suspense
              fallback={<div aria-hidden="true" className="h-11 w-20" />}
            >
              <AccountMenu />
            </Suspense>
          </>
        }
      />
      <main ref={main} className="mx-auto max-w-library px-4 pb-12 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
