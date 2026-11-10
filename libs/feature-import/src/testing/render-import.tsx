import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { Mock } from 'vitest';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider } from '@bite-and-board/ui-components';
import { ImportPanel, type ImportPanelProps } from '../panel/import-panel';

initI18n();

/** Spies for the callbacks that the page gives the panel. */
export interface PanelSpies {
  onDraft: Mock<ImportPanelProps['onDraft']>;
  onBusyChange: Mock<ImportPanelProps['onBusyChange']>;
}

/** Renders the panel, with spies for the callbacks the page gives it. */
export function renderPanel(props: Partial<ImportPanelProps> = {}): PanelSpies {
  const onDraft = vi.fn<ImportPanelProps['onDraft']>();
  const onBusyChange = vi.fn<ImportPanelProps['onBusyChange']>();
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
