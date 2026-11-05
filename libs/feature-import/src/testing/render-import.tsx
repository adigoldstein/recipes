import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider } from '@bite-and-board/ui-components';
import { ImportPanel, type ImportPanelProps } from '../panel/import-panel';

initI18n();

/** Renders the panel with spies for what the hosting page gives it. */
export function renderPanel(props: Partial<ImportPanelProps> = {}) {
  const onDraft = vi.fn();
  const onBusyChange = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <DirectionProvider dir="rtl">
        <ImportPanel
          dirty={false}
          onDraft={onDraft}
          onBusyChange={onBusyChange}
          {...props}
        />
      </DirectionProvider>
    </QueryClientProvider>,
  );
  return { onDraft, onBusyChange };
}
