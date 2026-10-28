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

/**
 * Reads the `params` of an API error body, the values its message needs (for
 * example `{min: 8}` for `password_too_short`). Empty when there are none.
 */
export function getErrorParams(
  error: unknown,
): Record<string, string | number> {
  if (typeof error !== 'object' || error === null) return {};
  const { params } = error as { params?: unknown };
  return typeof params === 'object' && params !== null
    ? (params as Record<string, string | number>)
    : {};
}
