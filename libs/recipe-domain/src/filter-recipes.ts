/** "עד 30 דקות": the quick-recipe cutoff in minutes (inclusive). */
export const FAST_MINUTES = 30;

/** The fields the library filter reads; the API summary satisfies it structurally. */
export interface FilterableRecipe {
  title: string;
  tags: readonly { id: string }[];
  total_minutes: number | null;
}

export interface RecipeFilter {
  /** Case-insensitive substring of the title; blank matches everything. */
  query: string;
  /** A recipe must have every one of these tags (AND). */
  tagIds: readonly string[];
  /** Keep only recipes whose total time is known and at most FAST_MINUTES. */
  fastOnly: boolean;
}

/**
 * The library filter (AD-26): search, tags and the quick chip combine with AND.
 * Pure, and keeps the input order.
 */
export function filterRecipes<T extends FilterableRecipe>(
  recipes: readonly T[],
  { query, tagIds, fastOnly }: RecipeFilter,
): T[] {
  const needle = query.trim().toLocaleLowerCase('he');
  return recipes.filter(
    (recipe) =>
      recipe.title.toLocaleLowerCase('he').includes(needle) &&
      tagIds.every((id) => recipe.tags.some((tag) => tag.id === id)) &&
      (!fastOnly ||
        (recipe.total_minutes !== null &&
          recipe.total_minutes <= FAST_MINUTES)),
  );
}
