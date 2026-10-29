import { emptyFormValues, type RecipeFormValues } from './recipe-form-values';
import {
  isFormField,
  issueFieldPath,
  validateRecipeForm,
} from './recipe-form-validation';

const valid = (): RecipeFormValues => ({
  ...emptyFormValues(),
  title: 'פשטידה',
  ingredients: [{ amount: '2', unit: 'cup', name: 'קמח', note: '' }],
  steps: [{ description: 'מערבבים' }],
});

// Sorted: the order of the issues is the schema's business, not the form's.
const paths = (values: RecipeFormValues) =>
  validateRecipeForm(values)
    .map((issue) => `${issue.path}:${issue.type}`)
    .sort();

describe('validateRecipeForm', () => {
  it('accepts a complete recipe', () => {
    expect(validateRecipeForm(valid())).toEqual([]);
  });

  it('asks for what the blank form lacks', () => {
    expect(paths(emptyFormValues())).toEqual([
      'ingredients.0.name:string_too_short',
      'steps.0.description:string_too_short',
      'title:string_too_short',
    ]);
  });

  it('flags text that is not a number before the schema sees it', () => {
    const values = valid();
    values.base_servings = '1.5';
    values.prep_time_minutes = 'abc';
    values.ingredients[0].amount = '2 cups';
    expect(paths(values)).toEqual([
      'base_servings:integer',
      'ingredients.0.amount:number',
      'prep_time_minutes:integer',
    ]);
  });

  it('applies the limits the server applies', () => {
    const values = valid();
    values.title = 'א'.repeat(121);
    values.description = 'א'.repeat(501);
    values.notes = 'א'.repeat(5001);
    values.base_servings = '101';
    values.ingredients[0].amount = '0';
    expect(paths(values)).toEqual([
      'base_servings:less_than_equal',
      'description:string_too_long',
      'ingredients.0.amount:greater_than',
      'notes:string_too_long',
      'title:string_too_long',
    ]);
  });

  it('reports a blank servings as missing', () => {
    expect(paths({ ...valid(), base_servings: '' })).toEqual([
      'base_servings:missing',
    ]);
  });

  it('reports no ingredients or steps on the list itself', () => {
    expect(paths({ ...valid(), ingredients: [], steps: [] })).toEqual([
      'ingredients:too_short',
      'steps:too_short',
    ]);
  });
});

describe('issueFieldPath', () => {
  it('keeps a list error apart from its rows', () => {
    expect(issueFieldPath('ingredients')).toBe('ingredients.root');
    expect(issueFieldPath('ingredients.0.name')).toBe('ingredients.0.name');
    expect(issueFieldPath('title')).toBe('title');
  });
});

describe('isFormField', () => {
  it('knows the form fields and nothing else', () => {
    expect(isFormField('steps.1.description')).toBe(true);
    expect(isFormField('source_url')).toBe(true);
    expect(isFormField('tags.0.name')).toBe(true);
    expect(isFormField('photo')).toBe(false);
    expect(isFormField('')).toBe(false);
  });
});
