import { parseAmount } from '@bite-and-board/recipe-domain';
import type {
  OriginalValue,
  RecipeRead,
  RecipeUpdate,
  Unit,
} from '@bite-and-board/data-access';

/**
 * The values the form holds (AD-22). Every number is kept as the text in its field,
 * so a field can be empty or half typed, and an amount can later hold "½". The field
 * names are the same as in the request body, so a server 422 `loc` is also the
 * form field's path.
 */
export interface IngredientFormValues {
  amount: string;
  /** Empty if the ingredient has no unit. */
  unit: Unit | '';
  name: string;
  note: string;
  /**
   * Set when editing a saved ingredient. It is sent back so the server keeps the
   * same ingredient.
   */
  ingredientId?: string;
  /** The saved original value (FR-7), only to show the hint. Never sent (AD-20). */
  original?: OriginalValue | null;
}

/** A tag of the recipe: an existing tag with an `id`, or a new tag with only a name. */
export interface TagFormValues {
  id?: string;
  name: string;
}

export interface StepFormValues {
  description: string;
}

export interface RecipeFormValues {
  title: string;
  description: string;
  notes: string;
  base_servings: string;
  prep_time_minutes: string;
  cook_time_minutes: string;
  source_url: string;
  tags: TagFormValues[];
  ingredients: IngredientFormValues[];
  steps: StepFormValues[];
  /**
   * What saving does with the photo (AD-27): `undefined` keeps the saved photo, `null`
   * removes it, and a key attaches a photo uploaded with `uploadPhoto`.
   */
  photoKey?: string | null;
  /**
   * The picture the form shows: the saved thumbnail, or a preview of the chosen
   * file.
   */
  photoPreview: string | null;
  /**
   * A photo that an import found on the recipe's page (Story 5.4). It is only shown
   * until the recipe is saved. Then the server downloads it and attaches it.
   * "הסרה" or "החלפה" remove it.
   */
  photoSourceUrl: string | null;
}

/** The same limits as in Pydantic, which the generated Zod also has (AD-19). */
export const DESCRIPTION_MAX_LENGTH = 500;
export const NOTES_MAX_LENGTH = 5000;

export const DEFAULT_SERVINGS = 4;

export const emptyIngredientRow = (): IngredientFormValues => ({
  amount: '',
  unit: '',
  name: '',
  note: '',
});
export const emptyStepRow = (): StepFormValues => ({ description: '' });

/** Returns an empty form: one empty ingredient row and one empty step row. */
export function emptyFormValues(): RecipeFormValues {
  return {
    title: '',
    description: '',
    notes: '',
    base_servings: String(DEFAULT_SERVINGS),
    prep_time_minutes: '',
    cook_time_minutes: '',
    source_url: '',
    tags: [],
    ingredients: [emptyIngredientRow()],
    steps: [emptyStepRow()],
    photoPreview: null,
    photoSourceUrl: null,
  };
}

const text = (value: number | null | undefined) =>
  value == null ? '' : String(value);

/** Turns a saved recipe into form values, for the edit form. */
export function toFormValues(recipe: RecipeRead): RecipeFormValues {
  return {
    title: recipe.title,
    description: recipe.description ?? '',
    notes: recipe.notes ?? '',
    base_servings: text(recipe.base_servings),
    prep_time_minutes: text(recipe.prep_time_minutes),
    cook_time_minutes: text(recipe.cook_time_minutes),
    source_url: recipe.source_url ?? '',
    tags: recipe.tags.map((tag) => ({ id: tag.id, name: tag.name })),
    ingredients: recipe.ingredients.map((ingredient) => ({
      amount: text(ingredient.amount),
      unit: ingredient.unit ?? '',
      name: ingredient.name,
      note: ingredient.note ?? '',
      ingredientId: ingredient.id,
      original: ingredient.original,
    })),
    steps: recipe.steps.map((step) => ({ description: step.description })),
    photoPreview: recipe.photo?.thumb_url ?? null,
    photoSourceUrl: null,
  };
}

const trimmedOrNull = (value: string) => value.trim() || null;

/**
 * Returns the number in a field, or null if it is empty. Text that is not a number
 * becomes NaN.
 */
const numberOrNull = (value: string) =>
  value.trim() === '' ? null : Number(value.trim());

/**
 * Builds the save request from the form values. Empty optional fields become null.
 *
 * It does not validate. The generated write schema does that (see
 * `recipe-form-resolver`).
 */
export function toWritePayload(values: RecipeFormValues): RecipeUpdate {
  return {
    title: values.title.trim(),
    description: trimmedOrNull(values.description),
    notes: trimmedOrNull(values.notes),
    // A required number that is empty becomes NaN, and the write schema reports it
    // as missing.
    base_servings: numberOrNull(values.base_servings) ?? Number.NaN,
    prep_time_minutes: numberOrNull(values.prep_time_minutes),
    cook_time_minutes: numberOrNull(values.cook_time_minutes),
    source_url: trimmedOrNull(values.source_url),
    // An existing tag is sent by `id`. A new tag is sent by `name`, and the server
    // creates it in the same transaction as the recipe (AD-25).
    tags: values.tags.map((tag) =>
      tag.id ? { id: tag.id } : { name: tag.name },
    ),
    ingredients: values.ingredients.map((ingredient) => {
      // Empty means "to taste". Text that is not an amount becomes NaN, so the
      // checks catch it.
      const amount =
        ingredient.amount.trim() === ''
          ? null
          : (parseAmount(ingredient.amount) ?? Number.NaN);
      return {
        // A saved ingredient keeps its `id` (AD-20).
        ...(ingredient.ingredientId ? { id: ingredient.ingredientId } : {}),
        name: ingredient.name.trim(),
        amount,
        // An ingredient "to taste" (no amount) has no unit either.
        unit:
          amount === null || ingredient.unit === '' ? null : ingredient.unit,
        note: trimmedOrNull(ingredient.note),
      };
    }),
    steps: values.steps.map((step) => ({
      description: step.description.trim(),
    })),
    // Send the photo only if it changed. If it is not sent, the server keeps the
    // saved photo.
    ...(values.photoKey === undefined ? {} : { photo_key: values.photoKey }),
  };
}
