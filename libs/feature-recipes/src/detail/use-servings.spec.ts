import { act, renderHook } from '@testing-library/react';
import { useServings } from './use-servings';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const setup = (id = 'r1') => renderHook(() => useServings(id, 4, 1, 100));

describe('useServings', () => {
  it('starts at the base servings', () => {
    expect(setup().result.current[0]).toBe(4);
  });

  it('remembers the servings per recipe on this device and restores them', () => {
    const { result } = setup();
    act(() => result.current[1](10));
    expect(result.current[0]).toBe(10);
    expect(localStorage.getItem('bb:servings:r1')).toBe('10');
    expect(setup().result.current[0]).toBe(10);
    expect(setup('r2').result.current[0]).toBe(4);
  });

  it('forgets the value when it is back at the base', () => {
    const { result } = setup();
    act(() => result.current[1](10));
    act(() => result.current[1](4));
    expect(localStorage.getItem('bb:servings:r1')).toBeNull();
  });

  it.each(['abc', '0', '101', '2.5', ''])('ignores a stored "%s"', (value) => {
    localStorage.setItem('bb:servings:r1', value);
    expect(setup().result.current[0]).toBe(4);
  });

  it('ignores storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = setup();
    expect(result.current[0]).toBe(4);
    act(() => result.current[1](6));
    expect(result.current[0]).toBe(6);
  });
});
