import type { ErrorCode } from './generated/types.gen';

/** Every code the API publishes (AD-28). The UI renders `errors.<code>`. */
export type { ErrorCode };

/**
 * Reads the `code` of a non-422 API error body `{detail, code, params?}`.
 * Returns undefined for anything else (network failure, 422, unknown shape);
 * a code newer than this client is returned as-is so the UI can fall back.
 */
export function getErrorCode(error: unknown): ErrorCode | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? (code as ErrorCode) : undefined;
}
