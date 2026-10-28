import { useState } from 'react';

const storageKey = (recipeId: string) => `bb:checks:${recipeId}`;

function load(recipeId: string): ReadonlySet<string> {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(storageKey(recipeId)) ?? '[]',
    );
    return new Set(
      Array.isArray(stored)
        ? stored.filter((id): id is string => typeof id === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

function save(recipeId: string, checked: ReadonlySet<string>) {
  try {
    if (checked.size === 0) localStorage.removeItem(storageKey(recipeId));
    else
      localStorage.setItem(storageKey(recipeId), JSON.stringify([...checked]));
  } catch {
    // Private mode or a full disk: ticks just last for this visit.
  }
}

/**
 * Which ingredients and steps are ticked off while cooking, kept in this
 * browser per recipe. Storage failures are ignored. Mount it with
 * `key={recipeId}` so a new recipe reads its own ticks.
 */
export function useCookingChecks(recipeId: string) {
  const [checked, setChecked] = useState(() => load(recipeId));

  const update = (next: ReadonlySet<string>) => {
    setChecked(next);
    save(recipeId, next);
  };

  return {
    isChecked: (id: string) => checked.has(id),
    set: (id: string, on: boolean) => {
      const next = new Set(checked);
      if (on) next.add(id);
      else next.delete(id);
      update(next);
    },
    clear: () => update(new Set()),
    any: checked.size > 0,
  };
}
