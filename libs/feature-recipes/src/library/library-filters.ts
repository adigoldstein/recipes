/** The library's filters, as they are kept in the URL (AD-8, AD-26). */
export interface LibraryFilters {
  /** `?q=`: the title search text. */
  query: string;
  /** `?tags=<uuid>,<uuid>`: tag ids in the URL's order, without duplicates. */
  tagIds: string[];
  /** `?fast=1`: only recipes that take 30 minutes or less. */
  fastOnly: boolean;
}

export const QUERY_PARAM = 'q';
export const TAGS_PARAM = 'tags';
export const FAST_PARAM = 'fast';

/** Reads the filters from the URL. It does not check that the tag ids exist. */
export function parseLibraryFilters(params: URLSearchParams): LibraryFilters {
  const tagIds = (params.get(TAGS_PARAM) ?? '').split(',').filter(Boolean);
  return {
    query: params.get(QUERY_PARAM) ?? '',
    tagIds: [...new Set(tagIds)],
    fastOnly: params.get(FAST_PARAM) === '1',
  };
}

/**
 * Returns a copy of `params` with the given filters changed. Empty values are
 * removed, so a library without filters has a clean URL. Other params are kept.
 */
export function withLibraryFilters(
  params: URLSearchParams,
  change: Partial<LibraryFilters>,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (name: string, value: string | undefined) => {
    if (value) next.set(name, value);
    else next.delete(name);
  };
  if (change.query !== undefined) set(QUERY_PARAM, change.query);
  if (change.tagIds !== undefined) set(TAGS_PARAM, change.tagIds.join(','));
  if (change.fastOnly !== undefined) {
    set(FAST_PARAM, change.fastOnly ? '1' : undefined);
  }
  return next;
}
