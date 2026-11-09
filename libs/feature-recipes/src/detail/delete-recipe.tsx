import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  getErrorCode,
  invalidationMap,
  recipesDeleteRecipeMutation,
  recipesGetRecipeQueryKey,
  useBackNavigation,
} from '@bite-and-board/data-access';
import { Button, ConfirmDialog, toast } from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';

/**
 * The "מחיקה" button on the recipe page, with its confirmation (FR-10). A recipe that
 * was already deleted counts as deleted.
 */
export function DeleteRecipe({
  recipe,
}: {
  recipe: { id: string; title: string };
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { cameFromApp } = useBackNavigation();
  const [open, setOpen] = useState(false);
  const remove = useMutation(recipesDeleteRecipeMutation());

  const leave = async (message: string) => {
    toast.success(message);
    setOpen(false);
    // Leave the page. If the user came from inside the app, go one step back, so the
    // library keeps its filters. Otherwise go to the library.
    await (cameFromApp ? navigate(-1) : navigate('/', { replace: true }));
    // Remove the recipe from the cache only now that the page is closed, so the page
    // does not try to reload a recipe that no longer exists.
    queryClient.removeQueries({
      queryKey: recipesGetRecipeQueryKey({ path: { recipe_id: recipe.id } }),
    });
    await invalidationMap.recipeWrite(queryClient);
  };

  const confirm = () =>
    remove.mutate(
      { path: { recipe_id: recipe.id } },
      {
        onSuccess: () => void leave(t('detail.delete.done')),
        onError: (error) => {
          if (getErrorCode(error) === 'recipe_not_found') {
            void leave(t('detail.delete.gone'));
          }
        },
      },
    );

  const failed =
    remove.isError && getErrorCode(remove.error) !== 'recipe_not_found';

  return (
    <>
      <Button
        variant="ghost"
        className="text-destructive max-sm:size-11 max-sm:px-0"
        onClick={() => {
          remove.reset();
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" />
        <span className="max-sm:sr-only">{t('detail.delete.action')}</span>
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('detail.delete.title')}
        description={t('detail.delete.description', { title: recipe.title })}
        confirmLabel={t('detail.delete.confirm')}
        cancelLabel={t('detail.delete.cancel')}
        destructive
        pending={remove.isPending}
        pendingLabel={t('detail.delete.pending')}
        slowNote={t('pending.slow')}
        error={failed ? errorMessage(remove.error) : undefined}
        onConfirm={confirm}
      />
    </>
  );
}
