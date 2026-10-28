import { parseLibraryFilters, withLibraryFilters } from './library-filters';

describe('parseLibraryFilters', () => {
  it('defaults to no filter', () => {
    expect(parseLibraryFilters(new URLSearchParams())).toEqual({
      query: '',
      tagIds: [],
      fastOnly: false,
    });
  });

  it('reads the search text, tag ids and the quick flag', () => {
    const params = new URLSearchParams('q=עוף&tags=a,b&fast=1');
    expect(parseLibraryFilters(params)).toEqual({
      query: 'עוף',
      tagIds: ['a', 'b'],
      fastOnly: true,
    });
  });

  it('drops empty and repeated tag ids', () => {
    const params = new URLSearchParams('tags=a,,b,a,');
    expect(parseLibraryFilters(params).tagIds).toEqual(['a', 'b']);
  });

  it('only treats fast=1 as on', () => {
    expect(parseLibraryFilters(new URLSearchParams('fast=0')).fastOnly).toBe(
      false,
    );
    expect(parseLibraryFilters(new URLSearchParams('fast=true')).fastOnly).toBe(
      false,
    );
  });
});

describe('withLibraryFilters', () => {
  it('sets each filter and leaves the original params alone', () => {
    const original = new URLSearchParams('x=1');
    const next = withLibraryFilters(original, {
      query: 'עוף',
      tagIds: ['a', 'b'],
      fastOnly: true,
    });
    expect(next.get('q')).toBe('עוף');
    expect(next.get('tags')).toBe('a,b');
    expect(next.get('fast')).toBe('1');
    expect(next.get('x')).toBe('1');
    expect(original.toString()).toBe('x=1');
  });

  it('removes empty values so a cleared library has a clean URL', () => {
    const next = withLibraryFilters(
      new URLSearchParams('q=a&tags=b&fast=1&x=1'),
      { query: '', tagIds: [], fastOnly: false },
    );
    expect(next.toString()).toBe('x=1');
  });

  it('keeps the filters it was not asked to change', () => {
    const next = withLibraryFilters(new URLSearchParams('q=a&tags=b&fast=1'), {
      query: 'c',
    });
    expect(next.toString()).toBe('q=c&tags=b&fast=1');
  });
});
