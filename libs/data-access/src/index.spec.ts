import { invalidationMap, recipesListRecipesQueryKey, schemas } from './index';

describe('data-access entry', () => {
  it('exports the generated hooks helpers and Zod schemas', () => {
    expect(recipesListRecipesQueryKey()[0]._id).toBe('recipesListRecipes');
    expect(schemas.zRecipeSummary).toBeDefined();
  });

  it('starts with an empty invalidation map', () => {
    expect(invalidationMap).toEqual({});
  });
});
