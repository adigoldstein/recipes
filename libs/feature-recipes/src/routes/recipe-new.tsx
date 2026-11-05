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
 * What the new-recipe page offers a panel placed above its form (the AI import). The
 * panel's library and this one never import each other; the app joins them (AD-2).
 */
export interface ImportSlotApi {
  /** The editor changed the form, so filling it would replace their work. */
  dirty: boolean;
  /** Fills the form with an imported draft (AD-22). Nothing is saved. */
  onDraft: (draft: DraftRecipe) => void;
  /** Locks the form while the panel is working. */
  onBusyChange: (busy: boolean) => void;
}

export interface RecipeNewPageProps {
  /** Renders the import panel above the form; left out, the page is just the form. */
  importPanel?: (api: ImportSlotApi) => ReactNode;
}

/** The new-recipe form at `/recipes/new` (FR-4); editors only, guarded by the route. */
export function RecipeNewPage({ importPanel }: RecipeNewPageProps = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { onBack } = useBackNavigation();
  const create = useMutation(recipesCreateRecipeMutation());
  // An import replaces the form by giving it new starting values under a new key.
  const [start, setStart] = useState<{ key: number; values: RecipeFormValues }>(
    () => ({ key: 0, values: emptyFormValues() }),
  );
  // Set while the form holds an imported draft; reloading the page clears it.
  const [review, setReview] = useState<DraftReview>();
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

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

  const fill = (draft: DraftRecipe) => {
    setReview(draftReview(draft));
    setStart((current) => ({
      key: current.key + 1,
      values: draftToFormValues(draft),
    }));
  };

  // "ביטול" on the review banner: back to an empty form, as if nothing was imported.
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
