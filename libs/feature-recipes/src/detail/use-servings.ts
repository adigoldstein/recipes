import { useStoredState } from '../shared/use-stored-state';

/**
 * The number of servings the user is cooking, remembered per recipe on this device.
 * Going back to the recipe's own number of servings deletes the saved value. Use it
 * with `key={recipeId}`.
 */
export function useServings(
  recipeId: string,
  base: number,
  min: number,
  max: number,
) {
  return useStoredState(`bb:servings:${recipeId}`, base, {
    parse: (stored) =>
      typeof stored === 'number' &&
      Number.isInteger(stored) &&
      stored >= min &&
      stored <= max
        ? stored
        : undefined,
  });
}
