import type { QueryClient } from '@tanstack/react-query';
import {
  recipesGetRecipeQueryKey,
  recipesListRecipesQueryKey,
  tagsListTagsQueryKey,
} from './generated/@tanstack/react-query.gen';

/**
 * The one place that decides which cached queries a write refreshes (AD-19).
 * Entries use the generated `*QueryKey()` helpers.
 */
export type Invalidator = (
  queryClient: QueryClient,
  recipeId?: string,
) => Promise<unknown>;

export const invalidationMap = {
  /**
   * A recipe write refreshes the library list, the tag list (a save can create tags),
   * and, given its id, that recipe's page.
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
   * A tag write (add, rename, pin, delete) refreshes the tag list, the library list
   * and every recipe page, since a rename or delete shows in all of them.
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
