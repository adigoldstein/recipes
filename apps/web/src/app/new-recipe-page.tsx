/**
 * `/recipes/new`: the recipe form with the AI import panel above it. The two feature
 * libraries never import each other, so the app joins them: the form page offers a
 * slot, and the panel fills it (AD-2). Both are lazy chunks (AD-11).
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
