import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import {
  getErrorCode,
  invalidationMap,
  recipesGetRecipeOptions,
  recipesGetRecipeQueryKey,
  recipesUpdateRecipeMutation,
  type RecipeRead,
  type RecipeUpdate,
} from '@bite-and-board/data-access';
import {
  BackLink,
  Button,
  EmptyState,
  RecipeDetailSkeleton,
  toast,
} from '@bite-and-board/ui-components';
import { RecipeForm } from '../form/recipe-form';
import { toFormValues } from '../form/recipe-form-values';
import { useErrorMessage } from '../shared/use-error-message';

/** The edit form at `/recipes/:id/edit` (FR-6); editors only, guarded by the route. */
export function RecipeEditPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { id = '' } = useParams();
  // Always fetched on arrival, so the form never starts from a stale copy; it is not
  // refetched while typing, which would replace what the person is changing.
  const recipe = useQuery({
    ...recipesGetRecipeOptions({ path: { recipe_id: id } }),
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  // Once the form is up it stays up, even while a save refreshes the cache.
  const [shown, setShown] = useState(false);
  if (!shown && recipe.data && !recipe.isFetching) setShown(true);

  if (!shown && !recipe.isError) {
    return (
      <div
        role="status"
        aria-label={t('detail.loading')}
        className="mx-auto max-w-detail pt-8"
      >
        <RecipeDetailSkeleton />
      </div>
    );
  }
  if (!recipe.data) {
    const notFound = getErrorCode(recipe.error) === 'recipe_not_found';
    return (
      <EmptyState
        title={errorMessage(recipe.error)}
        actions={
          <>
            {notFound ? null : (
              <Button variant="secondary" onClick={() => void recipe.refetch()}>
                {t('library.error.retry')}
              </Button>
            )}
            <Button asChild>
              <Link to="/">{t('notFound.back')}</Link>
            </Button>
          </>
        }
      />
    );
  }
  return <RecipeEdit key={recipe.data.id} recipe={recipe.data} />;
}

function RecipeEdit({ recipe }: { recipe: RecipeRead }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const update = useMutation(recipesUpdateRecipeMutation());

  // A rejection here is shown by the form. Once the recipe is saved nothing below
  // can fail, so a second tap on "save" cannot save twice.
  const save = async (payload: RecipeUpdate) => {
    const saved = await update.mutateAsync({
      path: { recipe_id: recipe.id },
      body: payload,
    });
    // The detail page opens with the answer we already have. This page's own copy is
    // set, not refetched, so the form keeps what was typed until it navigates away.
    queryClient.setQueryData(
      recipesGetRecipeQueryKey({ path: { recipe_id: recipe.id } }),
      saved,
    );
    await invalidationMap.recipeWrite(queryClient);
    toast.success(t('recipeForm.editSaved'));
    // Replaced, so "back" from the recipe is where the person came from.
    await navigate(`/recipes/${recipe.id}`, { replace: true });
  };

  return (
    <div className="mx-auto max-w-detail pb-8">
      <title>{t('app.pageTitle', { page: t('recipeForm.editTitle') })}</title>
      <div className="pt-4 pb-3">
        <BackLink
          label={t('recipeForm.editBack')}
          link={(children) => (
            <Link to={`/recipes/${recipe.id}`}>{children}</Link>
          )}
        />
      </div>
      <h1 tabIndex={-1} className="pb-6 text-display outline-none">
        {t('recipeForm.editTitle')}
      </h1>
      <RecipeForm
        defaultValues={toFormValues(recipe)}
        onSave={save}
        submitLabel={t('recipeForm.save')}
      />
    </div>
  );
}

export { RecipeEditPage as Component };
