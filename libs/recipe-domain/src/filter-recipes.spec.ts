import {
  FAST_MINUTES,
  filterRecipes,
  type FilterableRecipe,
  type RecipeFilter,
} from './filter-recipes.js';

const NONE: RecipeFilter = { query: '', tagIds: [], fastOnly: false };

function recipe(
  title: string,
  tagIds: string[] = [],
  totalMinutes: number | null = null,
): FilterableRecipe {
  return {
    title,
    tags: tagIds.map((id) => ({ id })),
    total_minutes: totalMinutes,
  };
}

const shakshuka = recipe('שקשוקה', ['breakfast'], 25);
const lasagna = recipe('לזניה', ['dinner', 'party'], 90);
const cake = recipe('עוגת שוקולד', ['dessert', 'party'], 30);
const salad = recipe('Greek Salad', [], null);
const ALL = [shakshuka, lasagna, cake, salad];

describe('filterRecipes', () => {
  it('returns everything, in order, for the empty filter', () => {
    expect(filterRecipes(ALL, NONE)).toEqual(ALL);
  });

  it('matches a title substring', () => {
    expect(filterRecipes(ALL, { ...NONE, query: 'עוגת' })).toEqual([cake]);
    expect(filterRecipes(ALL, { ...NONE, query: 'זני' })).toEqual([lasagna]);
  });

  it('ignores case and surrounding spaces', () => {
    expect(filterRecipes(ALL, { ...NONE, query: '  GREEK sal ' })).toEqual([
      salad,
    ]);
  });

  it('treats a blank query as no search', () => {
    expect(filterRecipes(ALL, { ...NONE, query: '   ' })).toEqual(ALL);
  });

  it('returns nothing when no title matches', () => {
    expect(filterRecipes(ALL, { ...NONE, query: 'פיצה' })).toEqual([]);
  });

  it('keeps recipes that have one selected tag', () => {
    expect(filterRecipes(ALL, { ...NONE, tagIds: ['party'] })).toEqual([
      lasagna,
      cake,
    ]);
  });

  it('requires every selected tag (AND)', () => {
    expect(
      filterRecipes(ALL, { ...NONE, tagIds: ['party', 'dessert'] }),
    ).toEqual([cake]);
    expect(
      filterRecipes(ALL, { ...NONE, tagIds: ['breakfast', 'dinner'] }),
    ).toEqual([]);
  });

  it('matches nothing for a tag no recipe has', () => {
    expect(filterRecipes(ALL, { ...NONE, tagIds: ['unknown'] })).toEqual([]);
  });

  it('keeps only recipes with a known total time of at most 30 minutes', () => {
    expect(FAST_MINUTES).toBe(30);
    expect(filterRecipes(ALL, { ...NONE, fastOnly: true })).toEqual([
      shakshuka,
      cake,
    ]);
  });

  it('excludes recipes whose time is unknown or just over the limit', () => {
    const over = recipe('ארוך', [], 31);
    const zero = recipe('מיידי', [], 0);
    expect(
      filterRecipes([salad, over, zero], { ...NONE, fastOnly: true }),
    ).toEqual([zero]);
  });

  it('combines search, tags and the quick chip', () => {
    const filter: RecipeFilter = {
      query: 'שוק',
      tagIds: ['party'],
      fastOnly: true,
    };
    expect(filterRecipes(ALL, filter)).toEqual([cake]);
    expect(filterRecipes(ALL, { ...filter, query: 'לזניה' })).toEqual([]);
  });

  it('does not change its input', () => {
    const input = [...ALL];
    filterRecipes(input, { query: 'ש', tagIds: ['party'], fastOnly: true });
    expect(input).toEqual(ALL);
  });

  it('filters 200 recipes in under 100 ms (NFR-3)', () => {
    const recipes = Array.from({ length: 200 }, (_, n) =>
      recipe(`מתכון מספר ${n} עם שם ארוך יחסית`, [`tag-${n % 13}`], n % 90),
    );
    const filter: RecipeFilter = {
      query: 'מספר 1',
      tagIds: ['tag-1'],
      fastOnly: true,
    };
    const start = performance.now();
    filterRecipes(recipes, filter);
    expect(performance.now() - start).toBeLessThan(100);
  });
});
