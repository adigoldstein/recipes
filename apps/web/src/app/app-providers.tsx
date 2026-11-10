import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider, Toaster } from '@bite-and-board/ui-components';
import { ThemeProvider, useTheme } from './theme';

initI18n();

// The Toaster comes from the UI lib and cannot read the app's theme, so we pass the
// theme to it.
function AppToaster() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  return <Toaster theme={mode} customAriaLabel={t('toast.region')} />;
}

/**
 * Creates the server data cache. `main.tsx` creates it once and passes it to both
 * the providers and the routes, so route loaders and components share one session.
 */
export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is never reloaded by itself, only after a change in this app
        // (invalidationMap, AD-19). Changes by other users show after a page
        // reload, which is fine for this app (Story 7.3).
        staleTime: Infinity,
        // Retry up to 3 times, but only network and server failures. An API error
        // with a `code` (like "recipe not found") will not change on retry.
        // We read the code by hand, because importing data-access here would add
        // the whole API client to the first load.
        retry: (failures, error) =>
          (error as { code?: unknown } | null)?.code === undefined &&
          failures < 3,
      },
    },
  });
}

/**
 * All the app providers (server cache, i18n, RTL, theme, toasts). `main.tsx` and the
 * tests both use it, so a missing provider fails a test.
 */
export function AppProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <DirectionProvider dir="rtl">
        <ThemeProvider>
          {children}
          <AppToaster />
        </ThemeProvider>
      </DirectionProvider>
    </QueryClientProvider>
  );
}
