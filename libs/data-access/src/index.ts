import { configureClient } from './client';

configureClient();

export * from './generated';
export * from './generated/@tanstack/react-query.gen';
export * as schemas from './generated/zod.gen';
// The configured client instance, for tests that point it at a mock server.
export { client } from './generated/client.gen';
export {
  CSRF_HEADER,
  CSRF_VALUE,
  OUTCOME_UNKNOWN_EVENT,
  SAFETY_NET_MS,
  SESSION_EXPIRED_EVENT,
  configureClient,
  fetchWithSafetyNet,
  safetyNetMs,
} from './client';
export { getErrorCode, getErrorParams } from './errors';
export { uploadPhoto, type UploadPhotoOptions } from './upload-photo';
export { requireRole } from './guards';
export { useBackNavigation } from './navigation';
export { roleAtLeast, useCan, useSession } from './session';
export { invalidationMap, type Invalidator } from './invalidation';
export {
  fromZodIssues,
  getValidationIssues,
  isValidationError,
  type FieldIssue,
} from './validation-errors';
