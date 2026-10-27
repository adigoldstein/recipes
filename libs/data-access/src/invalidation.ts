import type { QueryClient } from '@tanstack/react-query';

/**
 * The one place that decides which cached queries a write refreshes (AD-19).
 * Entries use the generated `*QueryKey()` helpers; empty until Epic 3.
 */
export type Invalidator = (queryClient: QueryClient) => Promise<unknown>;

export const invalidationMap = {} satisfies Record<string, Invalidator>;
