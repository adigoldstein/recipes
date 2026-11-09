import {
  fromZodIssues,
  schemas,
  type FieldIssue,
} from '@bite-and-board/data-access';
import { parseAmount } from '@bite-and-board/recipe-domain';
import { toWritePayload, type RecipeFormValues } from './recipe-form-values';

const INTEGER = /^\d+$/;

/**
 * List fields. Their own error is kept apart from the rows' errors
 * (`errors.steps.root`).
 */
const ARRAY_FIELDS = new Set(['ingredients', 'steps', 'tags']);

/** Returns the path where React Hook Form keeps the error of this field. */
export function issueFieldPath(path: string) {
  return ARRAY_FIELDS.has(path) ? `${path}.root` : path;
}

/** Checks whether a path is a form field, to tell field errors from other errors. */
export function isFormField(path: string) {
  const [field, , leaf] = path.split('.');
  // An invalid ingredient `id` has no field to show it on, so the form shows it
  // under the save button.
  if (field === 'ingredients' && leaf === 'id') return false;
  return [
    'title',
    'description',
    'notes',
    'base_servings',
    'prep_time_minutes',
    'cook_time_minutes',
    'source_url',
    'tags',
    'ingredients',
    'steps',
  ].includes(field);
}

/** Finds text that is not a number at all. The write schema only checks numbers. */
function numberIssues(values: RecipeFormValues): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const check = (
    path: string,
    value: string,
    pattern: RegExp,
    type: string,
  ) => {
    const trimmed = value.trim();
    if (trimmed !== '' && !pattern.test(trimmed)) {
      issues.push({ path, type, params: {} });
    }
  };
  check('base_servings', values.base_servings, INTEGER, 'integer');
  check('prep_time_minutes', values.prep_time_minutes, INTEGER, 'integer');
  check('cook_time_minutes', values.cook_time_minutes, INTEGER, 'integer');
  values.ingredients.forEach((ingredient, index) => {
    if (
      ingredient.amount.trim() !== '' &&
      parseAmount(ingredient.amount) === null
    ) {
      issues.push({
        path: `ingredients.${index}.amount`,
        type: 'number',
        params: {},
      });
    }
  });
  return issues;
}

/**
 * Returns all the problems in these values, in the same format as the server: first
 * text that is not a number, then what the generated write schema rejects. An empty
 * list means the values can be sent.
 */
export function validateRecipeForm(values: RecipeFormValues): FieldIssue[] {
  const unparsable = numberIssues(values);
  const result = schemas.zRecipesUpdateRecipeBody.safeParse(
    toWritePayload(values),
  );
  const rejected = result.success ? [] : fromZodIssues(result.error.issues);
  const seen = new Set(unparsable.map((issue) => issue.path));
  return [...unparsable, ...rejected.filter((issue) => !seen.has(issue.path))];
}
