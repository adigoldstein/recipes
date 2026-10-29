import type { RecipeRead } from '@bite-and-board/data-access';
import {
  emptyFormValues,
  toFormValues,
  toWritePayload,
  type RecipeFormValues,
} from './recipe-form-values';

const filled: RecipeFormValues = {
  title: '  פשטידת תרד ',
  description: 'פשטידה מהירה',
  notes: '   ',
  base_servings: '6',
  prep_time_minutes: '15',
  cook_time_minutes: '',
  source_url: ' https://example.com/pie ',
  ingredients: [
    { amount: '1.5', unit: 'cup', name: ' קמח ', note: ' מנופה ' },
    { amount: '', unit: 'g', name: 'מלח', note: '' },
  ],
  steps: [{ description: ' מערבבים ' }],
};

describe('toWritePayload', () => {
  it('trims text, turns numbers into numbers and blank optionals into null', () => {
    expect(toWritePayload(filled)).toEqual({
      title: 'פשטידת תרד',
      description: 'פשטידה מהירה',
      notes: null,
      base_servings: 6,
      prep_time_minutes: 15,
      cook_time_minutes: null,
      source_url: 'https://example.com/pie',
      tags: [],
      ingredients: [
        { name: 'קמח', amount: 1.5, unit: 'cup', note: 'מנופה' },
        { name: 'מלח', amount: null, unit: null, note: null },
      ],
      steps: [{ description: 'מערבבים' }],
    });
  });

  it('drops the unit of an ingredient with no amount ("to taste")', () => {
    const [, toTaste] = toWritePayload(filled).ingredients;
    expect(toTaste).toMatchObject({ amount: null, unit: null });
  });

  it('turns a blank servings into NaN, which the write schema reports as missing', () => {
    expect(
      toWritePayload({ ...filled, base_servings: '' }).base_servings,
    ).toBeNaN();
  });
});

describe('toFormValues', () => {
  const recipe: RecipeRead = {
    id: 'r1',
    title: 'שקשוקה',
    description: null,
    notes: 'אפשר להקפיא',
    tags: [],
    base_servings: 4,
    prep_time_minutes: 10,
    cook_time_minutes: null,
    source_url: null,
    photo: null,
    ingredients: [
      {
        id: 'i1',
        name: 'עגבניות',
        amount: 0.333,
        unit: 'kg',
        note: null,
        original: null,
        source: null,
      },
      {
        id: 'i2',
        name: 'מלח',
        amount: null,
        unit: null,
        note: 'לפי הטעם',
        original: null,
        source: null,
      },
    ],
    steps: [{ id: 's1', description: 'מבשלים', source_text: null }],
    created_at: '2026-10-27T12:00:00Z',
    updated_at: '2026-10-27T12:00:00Z',
  };

  it('shows every value as the text of its field', () => {
    expect(toFormValues(recipe)).toEqual({
      title: 'שקשוקה',
      description: '',
      notes: 'אפשר להקפיא',
      base_servings: '4',
      prep_time_minutes: '10',
      cook_time_minutes: '',
      source_url: '',
      ingredients: [
        { amount: '0.333', unit: 'kg', name: 'עגבניות', note: '' },
        { amount: '', unit: '', name: 'מלח', note: 'לפי הטעם' },
      ],
      steps: [{ description: 'מבשלים' }],
    });
  });

  it('round-trips back to the same write payload', () => {
    const payload = toWritePayload(toFormValues(recipe));
    expect(payload.ingredients[0]).toMatchObject({ amount: 0.333, unit: 'kg' });
    expect(payload.base_servings).toBe(4);
    expect(payload.description).toBeNull();
  });
});

describe('emptyFormValues', () => {
  it('starts with 4 servings and one empty row of each kind', () => {
    const values = emptyFormValues();
    expect(values.base_servings).toBe('4');
    expect(values.ingredients).toHaveLength(1);
    expect(values.steps).toHaveLength(1);
  });
});
