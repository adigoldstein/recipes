import { useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  parseLibraryFilters,
  withLibraryFilters,
  type LibraryFilters,
} from './library-filters';

/**
 * The library filters, kept in the URL so Back from a recipe finds them again
 * (AD-8). Every change replaces the history entry, so typing and chip taps do
 * not pile up Back steps.
 *
 * `knownTagIds` are the ids that really exist; any other id in the URL is
 * ignored. The search text also has a local copy, so a fast typist is never
 * fighting the router for the input's value.
 */
export function useLibraryFilters(knownTagIds: ReadonlySet<string>) {
  const [params, setParams] = useSearchParams();
  const parsed = parseLibraryFilters(params);

  const [draft, setDraft] = useState(parsed.query);
  const [seenQuery, setSeenQuery] = useState(parsed.query);
  // The URL changed by itself (Back, a link, "clear"): follow it.
  if (parsed.query !== seenQuery) {
    setSeenQuery(parsed.query);
    setDraft(parsed.query);
  }

  const filters: LibraryFilters = {
    query: draft,
    tagIds: parsed.tagIds.filter((id) => knownTagIds.has(id)),
    fastOnly: parsed.fastOnly,
  };

  const update = (change: Partial<LibraryFilters>) => {
    if (change.query !== undefined) setDraft(change.query);
    setParams((current) => withLibraryFilters(current, change), {
      replace: true,
    });
  };
  const clear = () => update({ query: '', tagIds: [], fastOnly: false });

  return { filters, update, clear };
}
