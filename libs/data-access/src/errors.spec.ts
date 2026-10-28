import { getErrorCode, getErrorParams } from './errors';

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

describe('getErrorParams', () => {
  it('reads the params of an API error body', () => {
    expect(
      getErrorParams({
        detail: 'x',
        code: 'password_too_short',
        params: { min: 8 },
      }),
    ).toEqual({ min: 8 });
  });

  it('is empty for anything without params', () => {
    expect(getErrorParams({ detail: 'x', code: 'forbidden' })).toEqual({});
    expect(getErrorParams({ params: null })).toEqual({});
    expect(getErrorParams('boom')).toEqual({});
    expect(getErrorParams(undefined)).toEqual({});
  });
});
