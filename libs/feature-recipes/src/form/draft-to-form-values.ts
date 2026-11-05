import type { DraftRecipe } from '@bite-and-board/data-access';
import {
  DEFAULT_SERVINGS,
  emptyIngredientRow,
  emptyStepRow,
  type RecipeFormValues,
} from './recipe-form-values';

const text = (value: number | null | undefined) =>
  value == null ? '' : String(value);

/**
 * An imported draft as form values, for the new-recipe form (AD-22). It only fills
 * the form: nothing is saved until the editor presses "שמירה". A tag goes by name,
 * which the server resolves to the existing tag or creates (AD-25), so an existing
 * tag and a suggested new one are handled the same way here.
 */
export function draftToFormValues(draft: DraftRecipe): RecipeFormValues {
  const ingredients = (draft.ingredients ?? []).map((ingredient) => ({
    amount: text(ingredient.amount),
    unit: ingredient.unit ?? ('' as const),
    name: ingredient.name,
    note: ingredient.note ?? '',
  }));
  const steps = (draft.steps ?? []).map((step) => ({
    description: step.description,
  }));
  return {
    title: draft.title,
    description: draft.description ?? '',
    notes: draft.notes ?? '',
    base_servings: text(draft.base_servings ?? DEFAULT_SERVINGS),
    prep_time_minutes: text(draft.prep_time_minutes),
    cook_time_minutes: text(draft.cook_time_minutes),
    source_url: '',
    tags: [...(draft.tags ?? []), ...(draft.new_tags ?? [])].map((name) => ({
      name,
    })),
    ingredients: ingredients.length > 0 ? ingredients : [emptyIngredientRow()],
    steps: steps.length > 0 ? steps : [emptyStepRow()],
    photoPreview: null,
  };
}
