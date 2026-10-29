import { QueryClient } from '@tanstack/react-query';
import {
  invalidationMap,
  recipesGetRecipeQueryKey,
  recipesListRecipesQueryKey,
  schemas,
  tagsListTagsQueryKey,
} from './index';

describe('data-access entry', () => {
  it('exports the generated hooks helpers and Zod schemas', () => {
    expect(recipesListRecipesQueryKey()[0]._id).toBe('recipesListRecipes');
    expect(schemas.zRecipeSummary).toBeDefined();
  });

  it('invalidates the list, the tags and the recipe page on a recipe write', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await invalidationMap.recipeWrite(queryClient, 'r1');
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: recipesListRecipesQueryKey(),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: recipesGetRecipeQueryKey({ path: { recipe_id: 'r1' } }),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: tagsListTagsQueryKey(),
    });
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it('refreshes only the list and the tags when there is no recipe id yet', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await invalidationMap.recipeWrite(queryClient);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });
});
