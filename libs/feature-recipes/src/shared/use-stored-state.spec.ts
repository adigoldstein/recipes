import { act, renderHook } from '@testing-library/react';
import { useStoredState } from './use-stored-state';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

const setOptions = {
  parse: (stored: unknown) =>
    Array.isArray(stored) ? new Set(stored as string[]) : undefined,
  serialize: (value: Set<string>) => [...value],
  isDefault: (value: Set<string>) => value.size === 0,
};

describe('useStoredState', () => {
  it('starts at the fallback and saves to localStorage by default', () => {
    const { result } = renderHook(() => useStoredState('k', 4));
    expect(result.current[0]).toBe(4);
    act(() => result.current[1](10));
    expect(result.current[0]).toBe(10);
    expect(localStorage.getItem('k')).toBe('10');
    expect(sessionStorage.getItem('k')).toBeNull();
    expect(renderHook(() => useStoredState('k', 4)).result.current[0]).toBe(10);
  });

  it('can use sessionStorage instead', () => {
    const options = { storage: 'session' } as const;
    const { result } = renderHook(() => useStoredState('k', 4, options));
    act(() => result.current[1](7));
    expect(sessionStorage.getItem('k')).toBe('7');
    expect(localStorage.getItem('k')).toBeNull();
    expect(
      renderHook(() => useStoredState('k', 4, options)).result.current[0],
    ).toBe(7);
  });

  it('removes the key when the default is saved', () => {
    const { result } = renderHook(() => useStoredState('k', 4));
    act(() => result.current[1](10));
    act(() => result.current[1](4));
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('uses parse, serialize and isDefault when given', () => {
    const { result } = renderHook(() =>
      useStoredState('k', new Set<string>(), setOptions),
    );
    act(() => result.current[1](new Set(['a'])));
    expect(localStorage.getItem('k')).toBe('["a"]');
    const again = renderHook(() =>
      useStoredState('k', new Set<string>(), setOptions),
    );
    expect([...again.result.current[0]]).toEqual(['a']);
    act(() => result.current[1](new Set()));
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('falls back when the stored value is invalid or not JSON', () => {
    const options = {
      parse: (stored: unknown) =>
        typeof stored === 'number' ? stored : undefined,
    };
    localStorage.setItem('k', '"text"');
    expect(
      renderHook(() => useStoredState('k', 4, options)).result.current[0],
    ).toBe(4);
    localStorage.setItem('k', '{not json');
    expect(
      renderHook(() => useStoredState('k', 4, options)).result.current[0],
    ).toBe(4);
  });

  it('keeps working when storage throws', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('blocked');
      });
    }
    const { result } = renderHook(() => useStoredState('k', 4));
    expect(result.current[0]).toBe(4);
    act(() => result.current[1](6));
    expect(result.current[0]).toBe(6);
    act(() => result.current[1](4));
    expect(result.current[0]).toBe(4);
  });
});
