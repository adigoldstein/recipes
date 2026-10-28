import { safeNext } from './safe-next';

describe('safeNext', () => {
  it.each([
    ['/recipes/abc', '/recipes/abc'],
    ['/?q=pasta&tag=1', '/?q=pasta&tag=1'],
    ['/', '/'],
  ])('keeps the same-site path %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });

  it.each([
    null,
    '',
    'recipes/abc',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '/\nfoo',
    // eslint-disable-next-line no-script-url
    'javascript:alert(1)',
  ])('falls back to / for %j', (next) => {
    expect(safeNext(next)).toBe('/');
  });
});
