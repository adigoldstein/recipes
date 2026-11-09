/**
 * `/recipes/new`: the recipe form with the AI import panel above it.
 *
 * The two feature libraries may not import each other, so the app connects them: the
 * form page has a slot, and the app puts the panel in it (AD-2). Both are loaded
 * lazily (AD-11).
 */
export async function lazyNewRecipePage() {
  const [{ RecipeNewPage }, { ImportPanel }] = await Promise.all([
    import('@bite-and-board/feature-recipes/recipe-new'),
    import('@bite-and-board/feature-import/import-panel'),
  ]);
  return {
    Component: () => (
      <RecipeNewPage importPanel={(api) => <ImportPanel {...api} />} />
    ),
  };
}
