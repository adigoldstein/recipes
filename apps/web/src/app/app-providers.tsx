import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider, Toaster } from '@bite-and-board/ui-components';
import { ThemeProvider, useTheme } from './theme';

initI18n();

// The Toaster is a UI-lib component that cannot read the app's theme, so the
// app passes the mode in.
function AppToaster() {
  const { t } = useTranslation();
  const { mode } = useTheme();
  return <Toaster theme={mode} customAriaLabel={t('toast.region')} />;
}

/**
 * The one provider tree (server cache, i18n, RTL, theme, toasts). `main.tsx` and the specs
 * both render through it, so a missing provider fails a test.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // One cache per mounted app; state keeps it stable across renders.
  const [queryClient] = useState(() => new QueryClient());
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
