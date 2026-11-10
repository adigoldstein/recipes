import type { ErrorCode } from './generated/types.gen';

/** All the error codes the API can return (AD-28). The UI shows `errors.<code>`. */
export type { ErrorCode };

/**
 * Returns the `code` from an API error body `{detail, code, params?}` (not 422).
 * Returns undefined for anything else (network error, 422, unknown shape).
 * A code that this client does not know yet is returned as is, so the UI can show
 * a general message.
 */
export function getErrorCode(error: unknown): ErrorCode | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? (code as ErrorCode) : undefined;
}

/**
 * Returns the `params` from an API error body: the values its message needs (for
 * example `{min: 8}` for `password_too_short`). Returns an empty object if none.
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
