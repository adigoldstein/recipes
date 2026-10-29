import type { z } from 'zod';

/**
 * One problem with one form field, in FastAPI's vocabulary (AD-9, AD-28): the
 * `type` of the 422 error (`string_too_short`, `less_than_equal`, ...) and the
 * numbers its message needs. `path` is the React Hook Form field path
 * (`ingredients.0.name`), so the form's field names match the payload's.
 */
export interface FieldIssue {
  path: string;
  type: string;
  params: Record<string, string | number>;
}

type Params = FieldIssue['params'];

function primitives(source: unknown): Params {
  if (typeof source !== 'object' || source === null) return {};
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string | number] =>
        typeof entry[1] === 'string' || typeof entry[1] === 'number',
    ),
  );
}

/**
 * The per-field problems of a 422 response (`detail[].loc/type/ctx`), or an
 * empty list for any other error. The leading `body` of `loc` is dropped.
 */
export function getValidationIssues(error: unknown): FieldIssue[] {
  if (typeof error !== 'object' || error === null) return [];
  const { detail } = error as { detail?: unknown };
  if (!Array.isArray(detail)) return [];
  return detail.flatMap((item: unknown): FieldIssue[] => {
    if (typeof item !== 'object' || item === null) return [];
    const { loc, type, ctx } = item as {
      loc?: unknown;
      type?: unknown;
      ctx?: unknown;
    };
    if (!Array.isArray(loc) || typeof type !== 'string') return [];
    const path = (loc[0] === 'body' ? loc.slice(1) : loc).join('.');
    return [{ path, type, params: primitives(ctx) }];
  });
}

/** Whether this error is a 422 with field problems the form can show. */
export function isValidationError(error: unknown) {
  return getValidationIssues(error).length > 0;
}

/**
 * Zod issues in the same vocabulary, so a client-side check and the server's 422
 * share one set of Hebrew messages (AD-28).
 */
export function fromZodIssues(
  issues: readonly z.core.$ZodIssue[],
): FieldIssue[] {
  return issues.map((issue): FieldIssue => {
    const path = issue.path.join('.');
    switch (issue.code) {
      case 'too_small': {
        const min = Number(issue.minimum);
        if (issue.origin === 'string')
          return {
            path,
            type: 'string_too_short',
            params: { min_length: min },
          };
        if (issue.origin === 'array')
          return { path, type: 'too_short', params: { min_length: min } };
        return issue.inclusive
          ? { path, type: 'greater_than_equal', params: { ge: min } }
          : { path, type: 'greater_than', params: { gt: min } };
      }
      case 'too_big': {
        const max = Number(issue.maximum);
        if (issue.origin === 'string')
          return { path, type: 'string_too_long', params: { max_length: max } };
        if (issue.origin === 'array')
          return { path, type: 'too_long', params: { max_length: max } };
        return issue.inclusive
          ? { path, type: 'less_than_equal', params: { le: max } }
          : { path, type: 'less_than', params: { lt: max } };
      }
      case 'invalid_type':
        return { path, type: 'missing', params: {} };
      case 'unrecognized_keys':
        return { path, type: 'extra_forbidden', params: {} };
      default:
        return { path, type: 'invalid', params: {} };
    }
  });
}
