import { useState } from 'react';

export interface StoredStateOptions<T> {
  /** Where to keep the value: this device (`local`, default) or this tab (`session`). */
  storage?: 'local' | 'session';
  /** Turns whatever JSON was stored into a `T`, or `undefined` if it is not valid. */
  parse?: (stored: unknown) => T | undefined;
  /** Turns the value into JSON-safe data; the value itself by default. */
  serialize?: (value: T) => unknown;
  /** A value that need not be stored; saving it removes the key. By default `=== fallback`. */
  isDefault?: (value: T) => boolean;
}

function area(kind: 'local' | 'session') {
  return kind === 'session' ? sessionStorage : localStorage;
}

/**
 * State kept in the browser under `key`. A missing, unreadable or invalid stored
 * value gives `fallback`, and every storage failure (private mode, full disk) is
 * ignored: the state then just lasts for this page view. Saving a default value
 * clears the key. Mount with `key={...}` when `key` can change.
 */
export function useStoredState<T>(
  key: string,
  fallback: T,
  {
    storage = 'local',
    parse = (stored) => stored as T,
    serialize = (value) => value,
    isDefault = (value) => value === fallback,
  }: StoredStateOptions<T> = {},
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = area(storage).getItem(key);
      return raw === null ? fallback : (parse(JSON.parse(raw)) ?? fallback);
    } catch {
      return fallback;
    }
  });

  const update = (next: T) => {
    setValue(next);
    try {
      if (isDefault(next)) area(storage).removeItem(key);
      else area(storage).setItem(key, JSON.stringify(serialize(next)));
    } catch {
      // Not saved; the value still holds for this page view.
    }
  };

  return [value, update] as const;
}
