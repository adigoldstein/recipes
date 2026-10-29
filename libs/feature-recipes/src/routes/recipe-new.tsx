import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  invalidationMap,
  recipesCreateRecipeMutation,
  recipesGetRecipeQueryKey,
  useBackNavigation,
  type RecipeCreate,
} from '@bite-and-board/data-access';
import { BackLink, toast } from '@bite-and-board/ui-components';
import { RecipeForm } from '../form/recipe-form';
import { emptyFormValues } from '../form/recipe-form-values';

/** The new-recipe form at `/recipes/new` (FR-4); editors only, guarded by the route. */
export function RecipeNewPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { onBack } = useBackNavigation();
  const create = useMutation(recipesCreateRecipeMutation());

  // A rejection here is shown by the form. Once the recipe is saved nothing below
  // can fail, so a second tap on "save" can never create a duplicate.
  const save = async (payload: RecipeCreate) => {
    const recipe = await create.mutateAsync({ body: payload });
    // The detail page opens with the answer we already have.
    queryClient.setQueryData(
      recipesGetRecipeQueryKey({ path: { recipe_id: recipe.id } }),
      recipe,
    );
    await invalidationMap.recipeWrite(queryClient);
    toast.success(t('recipeForm.saved'));
    // Replaced, so "back" from the new recipe is the library, not this form.
    await navigate(`/recipes/${recipe.id}`, { replace: true });
  };

  return (
    <div className="mx-auto max-w-detail pb-8">
      <title>{t('app.pageTitle', { page: t('recipeForm.newTitle') })}</title>
      <div className="pt-4 pb-3">
        <BackLink
          label={t('recipeForm.back')}
          link={(children) => (
            <Link to="/" onClick={onBack}>
              {children}
            </Link>
          )}
        />
      </div>
      <h1 tabIndex={-1} className="pb-6 text-display outline-none">
        {t('recipeForm.newTitle')}
      </h1>
      <RecipeForm
        defaultValues={emptyFormValues()}
        onSave={save}
        submitLabel={t('recipeForm.save')}
      />
    </div>
  );
}

export { RecipeNewPage as Component };
