import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  invalidationMap,
  recipesCreateRecipeMutation,
  recipesGetRecipeQueryKey,
  useBackNavigation,
  type DraftRecipe,
  type RecipeCreate,
} from '@bite-and-board/data-access';
import { BackLink, toast } from '@bite-and-board/ui-components';
import {
  draftReview,
  draftToFormValues,
  type DraftReview,
} from '../form/draft-to-form-values';
import { RecipeForm } from '../form/recipe-form';
import {
  emptyFormValues,
  type RecipeFormValues,
} from '../form/recipe-form-values';

/**
 * What the new recipe page gives to a panel shown above its form (the AI import).
 * The panel's library and this library may not import each other, so the app
 * connects them (AD-2).
 */
export interface ImportSlotApi {
  /** True if the editor changed the form, so filling it would replace their work. */
  dirty: boolean;
  /** Fills the form with an imported draft (AD-22). Nothing is saved. */
  onDraft: (draft: DraftRecipe) => void;
  /** Locks the form while the panel is working. */
  onBusyChange: (busy: boolean) => void;
}

export interface RecipeNewPageProps {
  /** Renders the import panel above the form. Without it, the page is only the form. */
  importPanel?: (api: ImportSlotApi) => ReactNode;
}

/**
 * The new recipe page at `/recipes/new` (FR-4). Only for editors (the route checks
 * it).
 */
export function RecipeNewPage({ importPanel }: RecipeNewPageProps = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { onBack } = useBackNavigation();
  const create = useMutation(recipesCreateRecipeMutation());
  // An import replaces the form: it gives it new starting values and a new key.
  const [start, setStart] = useState<{ key: number; values: RecipeFormValues }>(
    () => ({ key: 0, values: emptyFormValues() }),
  );
  // Set while the form holds an imported draft. Reloading the page clears it.
  const [review, setReview] = useState<DraftReview>();
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  // If saving fails, the form shows the error. After the recipe is saved, nothing
  // below can fail, so a second click on "save" can never create a duplicate.
  const save = async (payload: RecipeCreate) => {
    const recipe = await create.mutateAsync({ body: payload });
    // Put the new recipe in the cache, so the recipe page opens without loading.
    queryClient.setQueryData(
      recipesGetRecipeQueryKey({ path: { recipe_id: recipe.id } }),
      recipe,
    );
    await invalidationMap.recipeWrite(queryClient);
    toast.success(t('recipeForm.saved'));
    // Replace the history entry, so "back" from the new recipe goes to the library,
    // not to this form.
    await navigate(`/recipes/${recipe.id}`, { replace: true });
  };

  const fill = (draft: DraftRecipe) => {
    setReview(draftReview(draft));
    setStart((current) => ({
      key: current.key + 1,
      values: draftToFormValues(draft),
    }));
  };

  // "ביטול" on the review banner: go back to an empty form, as if nothing was
  // imported.
  const discard = () => {
    setReview(undefined);
    setStart((current) => ({
      key: current.key + 1,
      values: emptyFormValues(),
    }));
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
      {importPanel ? (
        <div className="pb-6">
          {importPanel({ dirty, onDraft: fill, onBusyChange: setBusy })}
        </div>
      ) : null}
      <RecipeForm
        key={start.key}
        defaultValues={start.values}
        onSave={save}
        submitLabel={t('recipeForm.save')}
        locked={busy}
        onDirtyChange={setDirty}
        review={review}
        onDiscard={discard}
      />
    </div>
  );
}

export { RecipeNewPage as Component };
