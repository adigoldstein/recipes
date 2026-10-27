import { configureClient } from './client';

configureClient();

export * from './generated';
export * from './generated/@tanstack/react-query.gen';
export * as schemas from './generated/zod.gen';
export { CSRF_HEADER, CSRF_VALUE, configureClient } from './client';
export { getErrorCode } from './errors';
export { invalidationMap, type Invalidator } from './invalidation';
