/** "עד 30 דקות": the maximum minutes of a quick recipe (30 itself counts). */
export const FAST_MINUTES = 30;

/** The fields the library filter uses. The API's recipe summary has all of them. */
export interface FilterableRecipe {
  title: string;
  tags: readonly { id: string }[];
  total_minutes: number | null;
}

export interface RecipeFilter {
  /** Text to find in the title, ignoring case. Empty text matches every recipe. */
  query: string;
  /** A recipe must have all of these tags (AND). */
  tagIds: readonly string[];
  /** Keep only recipes with a known total time of FAST_MINUTES or less. */
  fastOnly: boolean;
}

/**
 * Filters the library (AD-26). A recipe must match the search, the tags and the
 * quick filter (AND). It keeps the original order and changes nothing else.
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
