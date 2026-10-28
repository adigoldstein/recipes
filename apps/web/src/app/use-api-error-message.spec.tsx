import { renderHook } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AppProviders, createAppQueryClient } from './app-providers';
import { useApiErrorMessage } from './use-api-error-message';

const queryClient = createAppQueryClient();
const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProviders queryClient={queryClient}>{children}</AppProviders>
);

describe('useApiErrorMessage', () => {
  it('shows errors.<code> for a known code', () => {
    const { result } = renderHook(() => useApiErrorMessage(), { wrapper });
    expect(result.current({ detail: 'x', code: 'recipe_not_found' })).toBe(
      'המתכון לא נמצא',
    );
  });

  it('falls back to the generic message for unknown or missing codes', () => {
    const { result } = renderHook(() => useApiErrorMessage(), { wrapper });
    const generic = 'משהו השתבש, אפשר לנסות שוב';
    expect(result.current({ detail: 'x', code: 'brand_new' })).toBe(generic);
    expect(result.current(new TypeError('Failed to fetch'))).toBe(generic);
    expect(result.current(undefined)).toBe(generic);
  });
});

describe('AppProviders', () => {
  it('provides one QueryClient to the tree', () => {
    const { result } = renderHook(() => useQueryClient(), { wrapper });
    expect(result.current).toBeDefined();
  });
});
