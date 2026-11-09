import { useState } from 'react';

export interface StoredStateOptions<T> {
  /**
   * Where to keep the value: on this device (`local`, the default) or in this tab
   * (`session`).
   */
  storage?: 'local' | 'session';
  /** Turns the stored JSON into a `T`. Returns `undefined` if it is not valid. */
  parse?: (stored: unknown) => T | undefined;
  /**
   * Turns the value into data that can be saved as JSON. By default, the value
   * itself.
   */
  serialize?: (value: T) => unknown;
  /**
   * Checks if a value is the default. A default value is not stored, and saving it
   * removes the key. By default `=== fallback`.
   */
  isDefault?: (value: T) => boolean;
}

function area(kind: 'local' | 'session') {
  return kind === 'session' ? sessionStorage : localStorage;
}

/**
 * A state that is saved in the browser under `key`.
 *
 * If the stored value is missing, cannot be read, or is invalid, it returns
 * `fallback`. Storage errors (private mode, full disk) are ignored, and the value is
 * then kept only until the page closes. Use it with `key={...}` if `key` can change.
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
      // Not saved. The value is still kept until the page closes.
    }
  };

  return [value, update] as const;
}
