import { parseAmount } from '@bite-and-board/recipe-domain';
import type {
  OriginalValue,
  RecipeRead,
  RecipeUpdate,
  Unit,
} from '@bite-and-board/data-access';

/**
 * What the form holds (AD-22): every number is the text in its field, so a field can
 * be empty or half typed, and an amount can later hold "½". The field names are the
 * payload's, so a server 422 `loc` is also the form field's path.
 */
export interface IngredientFormValues {
  amount: string;
  /** Empty when the ingredient has no unit. */
  unit: Unit | '';
  name: string;
  note: string;
  /** Set when editing a saved ingredient: it is sent back so the server keeps it. */
  ingredientId?: string;
  /** The saved FR-7 original, for the hint only; never sent (AD-20). */
  original?: OriginalValue | null;
}

/** A tag on the recipe: an existing one by `id`, or a new one that only has a name. */
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
}

/** Matches the Pydantic limits, which the generated Zod repeats (AD-19). */
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

/** A blank form: one empty ingredient row and one empty step row. */
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
  };
}

const text = (value: number | null | undefined) =>
  value == null ? '' : String(value);

/** A saved recipe as form values, for the edit form. */
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
  };
}

const trimmedOrNull = (value: string) => value.trim() || null;

/** The number in a field, or null when it is blank. Text that is not a number stays NaN. */
const numberOrNull = (value: string) =>
  value.trim() === '' ? null : Number(value.trim());

/**
 * The write request for these values; a saved ingredient keeps its `id` (AD-20). Blank optional fields become null, and an
 * ingredient with no amount is "to taste", so it carries no unit either. A blank
 * required number becomes NaN, which the write schema reports as missing.
 *
 * It does not validate; the generated write schema does (see `recipe-form-resolver`).
 * A tag that exists goes as its `id`, a new one as its `name` for the server to
 * create inside the recipe's transaction (AD-25).
 */
export function toWritePayload(values: RecipeFormValues): RecipeUpdate {
  return {
    title: values.title.trim(),
    description: trimmedOrNull(values.description),
    notes: trimmedOrNull(values.notes),
    base_servings: numberOrNull(values.base_servings) ?? Number.NaN,
    prep_time_minutes: numberOrNull(values.prep_time_minutes),
    cook_time_minutes: numberOrNull(values.cook_time_minutes),
    source_url: trimmedOrNull(values.source_url),
    tags: values.tags.map((tag) =>
      tag.id ? { id: tag.id } : { name: tag.name },
    ),
    ingredients: values.ingredients.map((ingredient) => {
      // Blank is "to taste"; text that is no amount stays NaN for the checks.
      const amount =
        ingredient.amount.trim() === ''
          ? null
          : (parseAmount(ingredient.amount) ?? Number.NaN);
      return {
        ...(ingredient.ingredientId ? { id: ingredient.ingredientId } : {}),
        name: ingredient.name.trim(),
        amount,
        unit:
          amount === null || ingredient.unit === '' ? null : ingredient.unit,
        note: trimmedOrNull(ingredient.note),
      };
    }),
    steps: values.steps.map((step) => ({
      description: step.description.trim(),
    })),
  };
}
