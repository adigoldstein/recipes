import { useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  parseLibraryFilters,
  withLibraryFilters,
  type LibraryFilters,
} from './library-filters';

/**
 * The library filters. They are kept in the URL, so "back" from a recipe finds them
 * again (AD-8). `knownTagIds` are the tag ids that really exist.
 */
export function useLibraryFilters(knownTagIds: ReadonlySet<string>) {
  const [params, setParams] = useSearchParams();
  const parsed = parseLibraryFilters(params);

  // A local copy of the search text, so fast typing does not fight with the router
  // over the field's value.
  const [draft, setDraft] = useState(parsed.query);
  const [seenQuery, setSeenQuery] = useState(parsed.query);
  // If the URL changed from outside (back, a link, "clear"), use the new text.
  if (parsed.query !== seenQuery) {
    setSeenQuery(parsed.query);
    setDraft(parsed.query);
  }

  const filters: LibraryFilters = {
    query: draft,
    // Ignore tag ids in the URL that do not exist.
    tagIds: parsed.tagIds.filter((id) => knownTagIds.has(id)),
    fastOnly: parsed.fastOnly,
  };

  const update = (change: Partial<LibraryFilters>) => {
    if (change.query !== undefined) setDraft(change.query);
    // Replace the history entry, so typing and chip clicks do not add many "back"
    // steps.
    setParams((current) => withLibraryFilters(current, change), {
      replace: true,
    });
  };
  const clear = () => update({ query: '', tagIds: [], fastOnly: false });

  return { filters, update, clear };
}
