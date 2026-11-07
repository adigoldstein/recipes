import type { DraftRecipe } from '@bite-and-board/data-access';
import {
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
    // Left empty when the source gave none, so the review marks it instead of guessing.
    base_servings: text(draft.base_servings),
    prep_time_minutes: text(draft.prep_time_minutes),
    cook_time_minutes: text(draft.cook_time_minutes),
    source_url: draft.source_url ?? '',
    tags: [...(draft.tags ?? []), ...(draft.new_tags ?? [])].map((name) => ({
      name,
    })),
    ingredients: ingredients.length > 0 ? ingredients : [emptyIngredientRow()],
    steps: steps.length > 0 ? steps : [emptyStepRow()],
    // The page's photo is shown from its own site until the save downloads it.
    photoPreview: draft.photo_source_url ?? null,
    photoSourceUrl: draft.photo_source_url ?? null,
  };
}

/** The form fields a draft can leave empty and ask the editor to complete. */
export const REVIEWABLE_FIELDS = [
  'base_servings',
  'prep_time_minutes',
  'cook_time_minutes',
] as const;
export type ReviewableField = (typeof REVIEWABLE_FIELDS)[number];

/** What the review step needs from a draft besides its values (Story 5.3). */
export interface DraftReview {
  /** Fields the source did not give, from the server's `missing_fields`. */
  missingFields: ReviewableField[];
  /** The source was in another language and the draft was translated. */
  translated: boolean;
  /** Suggested tags that are not in the tag list yet; created only on save (AD-25). */
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
