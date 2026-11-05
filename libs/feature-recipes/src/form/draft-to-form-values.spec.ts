import type { DraftRecipe } from '@bite-and-board/data-access';
import { draftToFormValues } from './draft-to-form-values';
import { emptyFormValues } from './recipe-form-values';

const DRAFT: DraftRecipe = {
  title: 'עוגיות שוקולד צ׳יפס',
  description: 'עוגיות רכות.',
  base_servings: 24,
  prep_time_minutes: 15,
  cook_time_minutes: null,
  ingredients: [
    { name: 'קמח', amount: 2, unit: 'cup' },
    { name: 'שוקולד', amount: 115, unit: 'g', note: '4 oz' },
    { name: 'מלח' },
  ],
  steps: [{ description: 'מערבבים.' }, { description: 'אופים ב-175°C.' }],
  tags: ['קינוח'],
  new_tags: ['עוגיות'],
  missing_fields: ['cook_time_minutes'],
};

describe('draftToFormValues', () => {
  it('fills the form fields from the draft', () => {
    const values = draftToFormValues(DRAFT);
    expect(values.title).toBe('עוגיות שוקולד צ׳יפס');
    expect(values.description).toBe('עוגיות רכות.');
    expect(values.base_servings).toBe('24');
    expect(values.prep_time_minutes).toBe('15');
    expect(values.cook_time_minutes).toBe('');
    expect(values.steps).toEqual([
      { description: 'מערבבים.' },
      { description: 'אופים ב-175°C.' },
    ]);
  });

  it('turns an ingredient without an amount into a to-taste row', () => {
    const [flour, chocolate, salt] = draftToFormValues(DRAFT).ingredients;
    expect(flour).toEqual({ amount: '2', unit: 'cup', name: 'קמח', note: '' });
    expect(chocolate).toEqual({
      amount: '115',
      unit: 'g',
      name: 'שוקולד',
      note: '4 oz',
    });
    expect(salt).toEqual({ amount: '', unit: '', name: 'מלח', note: '' });
  });

  it('carries existing and suggested tags by name', () => {
    expect(draftToFormValues(DRAFT).tags).toEqual([
      { name: 'קינוח' },
      { name: 'עוגיות' },
    ]);
  });

  it('uses the default servings when the draft has none', () => {
    expect(
      draftToFormValues({ title: 'x', base_servings: null }).base_servings,
    ).toBe(emptyFormValues().base_servings);
  });

  it('keeps one empty row when the draft has no ingredients or steps', () => {
    const values = draftToFormValues({ title: 'x' });
    expect(values.ingredients).toEqual(emptyFormValues().ingredients);
    expect(values.steps).toEqual(emptyFormValues().steps);
  });

  it('does not touch the photo or the source link', () => {
    const values = draftToFormValues(DRAFT);
    expect(values.photoPreview).toBeNull();
    expect(values.photoKey).toBeUndefined();
    expect(values.source_url).toBe('');
  });
});
