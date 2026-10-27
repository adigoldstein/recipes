import { getErrorCode } from './errors';

describe('getErrorCode', () => {
  it('reads the code of an API error body', () => {
    expect(getErrorCode({ detail: 'x', code: 'recipe_not_found' })).toBe(
      'recipe_not_found',
    );
  });

  it('passes an unknown code through for the UI to fall back on', () => {
    expect(getErrorCode({ detail: 'x', code: 'brand_new' })).toBe('brand_new');
  });

  it('returns undefined for anything without a string code', () => {
    expect(getErrorCode(undefined)).toBeUndefined();
    expect(getErrorCode('boom')).toBeUndefined();
    expect(getErrorCode({ detail: [] })).toBeUndefined();
    expect(getErrorCode(new TypeError('Failed to fetch'))).toBeUndefined();
  });
});
