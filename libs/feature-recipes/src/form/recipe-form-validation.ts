import {
  fromZodIssues,
  schemas,
  type FieldIssue,
} from '@bite-and-board/data-access';
import { parseAmount } from '@bite-and-board/recipe-domain';
import { toWritePayload, type RecipeFormValues } from './recipe-form-values';

const INTEGER = /^\d+$/;

/** Array fields keep their own message apart from their rows' (`errors.steps.root`). */
const ARRAY_FIELDS = new Set(['ingredients', 'steps']);

/** The path React Hook Form stores an issue under. */
export function issueFieldPath(path: string) {
  return ARRAY_FIELDS.has(path) ? `${path}.root` : path;
}

/** The part of the form a path belongs to, for telling form fields from other errors. */
export function isFormField(path: string) {
  const [field] = path.split('.');
  return [
    'title',
    'description',
    'notes',
    'base_servings',
    'prep_time_minutes',
    'cook_time_minutes',
    'source_url',
    'ingredients',
    'steps',
  ].includes(field);
}

/** Text that is not a number at all; the write schema only sees numbers. */
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
 * Everything wrong with these values, as the server would report it: text that is
 * not a number first, then whatever the generated write schema rejects. Empty
 * means the values can be sent.
 */
export function validateRecipeForm(values: RecipeFormValues): FieldIssue[] {
  const unparsable = numberIssues(values);
  const result = schemas.zRecipesCreateRecipeBody.safeParse(
    toWritePayload(values),
  );
  const rejected = result.success ? [] : fromZodIssues(result.error.issues);
  const seen = new Set(unparsable.map((issue) => issue.path));
  return [...unparsable, ...rejected.filter((issue) => !seen.has(issue.path))];
}
