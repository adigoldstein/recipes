import { initI18n } from './i18n';
import he from './he.json';

function values(node: unknown): string[] {
  return typeof node === 'string'
    ? [node]
    : Object.values(node as Record<string, unknown>).flatMap(values);
}

describe('he.json', () => {
  const strings = values(he);

  it('names the product ביס & סיר', () => {
    expect(he.app.name).toBe('ביס & סיר');
  });

  it('follows the voice: no exclamation marks or emoji', () => {
    for (const text of strings) {
      expect(text).not.toMatch(/!|\p{Extended_Pictographic}/u);
    }
  });
});

describe('initI18n', () => {
  it('translates in Hebrew without escaping interpolated values', () => {
    const i18n = initI18n();
    expect(i18n.language).toBe('he');
    expect(i18n.t('notFound.back')).toBe('חזרה לרשימה');
    expect(i18n.t('app.pageTitle', { page: 'א & ב' })).toBe(
      'א & ב · ביס & סיר',
    );
    expect(initI18n()).toBe(i18n);
  });
});
