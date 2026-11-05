import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { OUTCOME_UNKNOWN_EVENT as DATA_ACCESS_EVENT } from '@bite-and-board/data-access';
import {
  OUTCOME_UNKNOWN_EVENT,
  useOutcomeUnknown,
} from './use-outcome-unknown';

function Listener() {
  useOutcomeUnknown();
  return null;
}

describe('useOutcomeUnknown', () => {
  it('uses the same event name as data-access', () => {
    expect(OUTCOME_UNKNOWN_EVENT).toBe(DATA_ACCESS_EVENT);
  });

  it('refetches every query when a write may or may not have gone through', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <QueryClientProvider client={queryClient}>
        <Listener />
      </QueryClientProvider>,
    );
    globalThis.dispatchEvent(new Event(OUTCOME_UNKNOWN_EVENT));
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('stops listening when the shell goes away', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const view = render(
      <QueryClientProvider client={queryClient}>
        <Listener />
      </QueryClientProvider>,
    );
    view.unmount();
    globalThis.dispatchEvent(new Event(OUTCOME_UNKNOWN_EVENT));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
