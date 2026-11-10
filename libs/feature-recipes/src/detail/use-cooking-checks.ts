import { useStoredState } from '../shared/use-stored-state';

const NONE: ReadonlySet<string> = new Set();

/**
 * Remembers which ingredients and steps were checked while cooking, per recipe, in
 * this browser. Storage errors are ignored. Use it with `key={recipeId}`, so another
 * recipe reads its own checks.
 */
export function useCookingChecks(recipeId: string) {
  const [checked, setChecked] = useStoredState<ReadonlySet<string>>(
    `bb:checks:${recipeId}`,
    NONE,
    {
      parse: (stored) =>
        Array.isArray(stored)
          ? new Set(stored.filter((id): id is string => typeof id === 'string'))
          : undefined,
      serialize: (ids) => [...ids],
      isDefault: (ids) => ids.size === 0,
    },
  );

  return {
    isChecked: (id: string) => checked.has(id),
    set: (id: string, on: boolean) => {
      const next = new Set(checked);
      if (on) next.add(id);
      else next.delete(id);
      setChecked(next);
    },
    clear: () => setChecked(NONE),
    any: checked.size > 0,
  };
}
