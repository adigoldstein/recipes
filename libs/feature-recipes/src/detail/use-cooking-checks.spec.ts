import { act, renderHook } from '@testing-library/react';
import { useCookingChecks } from './use-cooking-checks';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('useCookingChecks', () => {
  it('ticks, unticks and clears, keeping the ticks per recipe', () => {
    const { result } = renderHook(() => useCookingChecks('r1'));
    expect(result.current.any).toBe(false);

    act(() => result.current.set('a', true));
    act(() => result.current.set('b', true));
    act(() => result.current.set('a', false));
    expect(result.current.isChecked('a')).toBe(false);
    expect(result.current.isChecked('b')).toBe(true);
    expect(JSON.parse(localStorage.getItem('bb:checks:r1') ?? '')).toEqual([
      'b',
    ]);

    expect(renderHook(() => useCookingChecks('r2')).result.current.any).toBe(
      false,
    );
    expect(
      renderHook(() => useCookingChecks('r1')).result.current.isChecked('b'),
    ).toBe(true);

    act(() => result.current.clear());
    expect(result.current.any).toBe(false);
    expect(localStorage.getItem('bb:checks:r1')).toBeNull();
  });

  it('restores earlier ticks on load', () => {
    localStorage.setItem('bb:checks:r1', JSON.stringify(['x', 5]));
    const { result } = renderHook(() => useCookingChecks('r1'));
    expect(result.current.isChecked('x')).toBe(true);
    expect(result.current.isChecked('5')).toBe(false);
  });

  it('ignores stored junk', () => {
    localStorage.setItem('bb:checks:r1', '{"not":"a list"}');
    expect(renderHook(() => useCookingChecks('r1')).result.current.any).toBe(
      false,
    );
    localStorage.setItem('bb:checks:r1', 'not json');
    expect(renderHook(() => useCookingChecks('r1')).result.current.any).toBe(
      false,
    );
  });

  it('keeps working when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useCookingChecks('r1'));
    act(() => result.current.set('a', true));
    expect(result.current.isChecked('a')).toBe(true);
  });
});
