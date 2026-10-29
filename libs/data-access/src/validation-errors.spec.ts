import { zRecipesCreateRecipeBody } from './generated/zod.gen';
import {
  fromZodIssues,
  getValidationIssues,
  isValidationError,
} from './validation-errors';

describe('getValidationIssues', () => {
  it('maps loc to a form path and keeps the type and the numbers of ctx', () => {
    const error = {
      detail: [
        {
          loc: ['body', 'ingredients', 0, 'name'],
          msg: 'String should have at least 1 character',
          type: 'string_too_short',
          input: '',
          ctx: { min_length: 1 },
        },
        {
          loc: ['body', 'base_servings'],
          msg: 'x',
          type: 'less_than_equal',
          ctx: { le: 100 },
        },
      ],
    };
    expect(getValidationIssues(error)).toEqual([
      {
        path: 'ingredients.0.name',
        type: 'string_too_short',
        params: { min_length: 1 },
      },
      { path: 'base_servings', type: 'less_than_equal', params: { le: 100 } },
    ]);
  });

  it('drops ctx values that are not text or numbers', () => {
    const [issue] = getValidationIssues({
      detail: [{ loc: ['body'], type: 'value_error', ctx: { error: {} } }],
    });
    expect(issue.params).toEqual({});
    expect(issue.path).toBe('');
  });

  it('is empty for anything that is not a 422 body', () => {
    expect(getValidationIssues(undefined)).toEqual([]);
    expect(getValidationIssues(new TypeError('Failed to fetch'))).toEqual([]);
    expect(
      getValidationIssues({ detail: 'Sign in required', code: 'unauthorized' }),
    ).toEqual([]);
    expect(getValidationIssues({ detail: [{ loc: 'x' }] })).toEqual([]);
    expect(isValidationError({ detail: 'x' })).toBe(false);
  });
});

describe('fromZodIssues', () => {
  const valid = {
    title: 'פשטידה',
    base_servings: 4,
    ingredients: [{ name: 'ביצה' }],
    steps: [{ description: 'אופים' }],
  };
  const issuesOf = (changes: object) => {
    const result = zRecipesCreateRecipeBody.safeParse({ ...valid, ...changes });
    return result.success ? [] : fromZodIssues(result.error.issues);
  };

  it('speaks the same vocabulary as the server', () => {
    expect(issuesOf({ title: '' })).toEqual([
      { path: 'title', type: 'string_too_short', params: { min_length: 1 } },
    ]);
    expect(issuesOf({ title: 'א'.repeat(121) })).toEqual([
      { path: 'title', type: 'string_too_long', params: { max_length: 120 } },
    ]);
    expect(issuesOf({ base_servings: 0 })).toEqual([
      { path: 'base_servings', type: 'greater_than_equal', params: { ge: 1 } },
    ]);
    expect(issuesOf({ base_servings: 101 })).toEqual([
      { path: 'base_servings', type: 'less_than_equal', params: { le: 100 } },
    ]);
    expect(issuesOf({ steps: [] })).toEqual([
      { path: 'steps', type: 'too_short', params: { min_length: 1 } },
    ]);
    expect(issuesOf({ ingredients: [{ name: 'ב', amount: 0 }] })).toEqual([
      {
        path: 'ingredients.0.amount',
        type: 'greater_than',
        params: { gt: 0 },
      },
    ]);
  });

  it('calls a missing value missing', () => {
    expect(issuesOf({ base_servings: undefined })).toEqual([
      { path: 'base_servings', type: 'missing', params: {} },
    ]);
  });

  it('falls back to invalid for anything else', () => {
    expect(
      issuesOf({ ingredients: [{ name: 'ב', unit: 'bucket' }] }).map(
        (issue) => issue.type,
      ),
    ).toEqual(['invalid']);
  });
});
