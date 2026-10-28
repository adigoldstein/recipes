import { configureClient } from './client';

configureClient();

export * from './generated';
export * from './generated/@tanstack/react-query.gen';
export * as schemas from './generated/zod.gen';
// The configured client instance, for tests that point it at a mock server.
export { client } from './generated/client.gen';
export { CSRF_HEADER, CSRF_VALUE, configureClient } from './client';
export { getErrorCode } from './errors';
export { invalidationMap, type Invalidator } from './invalidation';
