import type { QueryClient } from '@tanstack/react-query';
import {
  recipesGetRecipeQueryKey,
  recipesListRecipesQueryKey,
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
  /** A recipe write refreshes the library list and, given its id, that recipe's page. */
  recipeWrite: (queryClient: QueryClient, recipeId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: recipesListRecipesQueryKey() }),
      recipeId
        ? queryClient.invalidateQueries({
            queryKey: recipesGetRecipeQueryKey({
              path: { recipe_id: recipeId },
            }),
          })
        : undefined,
    ]),
} satisfies Record<string, Invalidator>;
