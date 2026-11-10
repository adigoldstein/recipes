import type { DraftRecipe } from '@bite-and-board/data-access';
import {
  emptyIngredientRow,
  emptyStepRow,
  type RecipeFormValues,
} from './recipe-form-values';

const text = (value: number | null | undefined) =>
  value == null ? '' : String(value);

/**
 * Turns an imported draft into values for the new recipe form (AD-22). It only fills
 * the form. Nothing is saved until the editor presses "שמירה".
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
    // Stays empty if the source has no value, so the review marks it instead of
    // guessing.
    base_servings: text(draft.base_servings),
    prep_time_minutes: text(draft.prep_time_minutes),
    cook_time_minutes: text(draft.cook_time_minutes),
    source_url: draft.source_url ?? '',
    tags: [...(draft.tags ?? []), ...(draft.new_tags ?? [])].map((name) => ({
      name,
    })),
    ingredients: ingredients.length > 0 ? ingredients : [emptyIngredientRow()],
    steps: steps.length > 0 ? steps : [emptyStepRow()],
    // Show the photo from the original site until saving downloads it.
    photoPreview: draft.photo_source_url ?? null,
    photoSourceUrl: draft.photo_source_url ?? null,
  };
}

/** The form fields that a draft can leave empty, for the editor to fill in. */
export const REVIEWABLE_FIELDS = [
  'base_servings',
  'prep_time_minutes',
  'cook_time_minutes',
] as const;
export type ReviewableField = (typeof REVIEWABLE_FIELDS)[number];

/** What the review step needs from a draft, besides the form values (Story 5.3). */
export interface DraftReview {
  /** Fields that the source did not have, from the server's `missing_fields`. */
  missingFields: ReviewableField[];
  /** True if the source was in another language and the draft was translated. */
  translated: boolean;
  /**
   * Suggested tags that are not in the tag list yet. They are created only on save
   * (AD-25).
   */
  newTags: string[];
}

export function draftReview(draft: DraftRecipe): DraftReview {
  return {
    missingFields: REVIEWABLE_FIELDS.filter((field) =>
      (draft.missing_fields ?? []).includes(field),
    ),
    translated: draft.translated ?? false,
    newTags: draft.new_tags ?? [],
  };
}
