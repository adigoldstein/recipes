import type { QueryClient } from '@tanstack/react-query';
import {
  recipesGetRecipeQueryKey,
  recipesListRecipesQueryKey,
  tagsListTagsQueryKey,
} from './generated/@tanstack/react-query.gen';

/**
 * The one place that decides which cached data to reload after a change (AD-19).
 * It uses the generated `*QueryKey()` helpers.
 */
export type Invalidator = (
  queryClient: QueryClient,
  recipeId?: string,
) => Promise<unknown>;

export const invalidationMap = {
  /**
   * After a recipe change, reload the library, the tag list (saving can create new
   * tags), and the recipe's page if its id is given.
   */
  recipeWrite: (queryClient: QueryClient, recipeId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: recipesListRecipesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: tagsListTagsQueryKey() }),
      recipeId
        ? queryClient.invalidateQueries({
            queryKey: recipesGetRecipeQueryKey({
              path: { recipe_id: recipeId },
            }),
          })
        : undefined,
    ]),
  /**
   * After a tag change (add, rename, pin, delete), reload the tag list, the library
   * and every recipe page, because a rename or delete shows in all of them.
   */
  tagWrite: (queryClient: QueryClient) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: tagsListTagsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: recipesListRecipesQueryKey() }),
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          (queryKey[0] as { _id?: string } | undefined)?._id ===
          'recipesGetRecipe',
      }),
    ]),
} satisfies Record<string, Invalidator>;
