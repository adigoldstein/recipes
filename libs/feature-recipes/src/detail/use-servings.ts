import { useStoredState } from '../shared/use-stored-state';

/**
 * The servings being cooked for, remembered per recipe on this device; going
 * back to the base servings forgets them. Mount it with `key={recipeId}`.
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
