import type { ParseKeys } from 'i18next';
import { Plus, Trash2 } from 'lucide-react';
import {
  Controller,
  set,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldPath,
  type Resolver,
  type UseFormRegister,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  getErrorCode,
  getValidationIssues,
  schemas,
  type RecipeCreate,
} from '@bite-and-board/data-access';
import {
  Button,
  CharacterCounter,
  FormField,
  RequiredMark,
  RequiredNote,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';
import {
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  emptyIngredientRow,
  emptyStepRow,
  toWritePayload,
  type RecipeFormValues,
} from './recipe-form-values';
import {
  isFormField,
  issueFieldPath,
  validateRecipeForm,
} from './recipe-form-validation';
import { useIssueMessage } from './use-issue-message';

const NO_UNIT = 'none';
// The options list names the unit in general, which is the plural form (`_other`).
const UNITS = schemas.zUnit.options;

export interface RecipeFormProps {
  defaultValues: RecipeFormValues;
  /** Saves the recipe. A rejected promise shows its error on the form. */
  onSave: (payload: RecipeCreate) => Promise<unknown>;
  submitLabel: string;
}

function rowError(errors: FieldErrors | undefined, field: string) {
  const error = (errors as Record<string, { message?: string }> | undefined)?.[
    field
  ];
  return error?.message;
}

function IngredientRow({
  index,
  control,
  register,
  errors,
  onRemove,
  canRemove,
}: {
  index: number;
  control: Control<RecipeFormValues>;
  register: UseFormRegister<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues['ingredients'][number]> | undefined;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { t } = useTranslation();
  const n = index + 1;
  const amount = useWatch({ control, name: `ingredients.${index}.amount` });
  const messages = (['amount', 'name', 'note'] as const)
    .map((field) => rowError(errors, field))
    .filter((message): message is string => Boolean(message));
  const errorId = `ingredient-${index}-error`;
  const describedBy = messages.length > 0 ? errorId : undefined;
  return (
    <li className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
        <Input
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          aria-label={t('recipeForm.ingredient.amountLabel', { n })}
          placeholder={t('recipeForm.ingredient.amount')}
          aria-invalid={errors?.amount ? true : undefined}
          aria-describedby={describedBy}
          className="sm:col-span-2"
          {...register(`ingredients.${index}.amount`)}
        />
        <Controller
          control={control}
          name={`ingredients.${index}.unit`}
          render={({ field }) => (
            <Select
              value={field.value === '' ? NO_UNIT : field.value}
              onValueChange={(value) =>
                field.onChange(value === NO_UNIT ? '' : value)
              }
              disabled={amount.trim() === ''}
            >
              <SelectTrigger
                aria-label={t('recipeForm.ingredient.unitLabel', { n })}
                className="w-full sm:col-span-3"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_UNIT}>
                  {t('recipeForm.ingredient.noUnit')}
                </SelectItem>
                {UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {t(`units.${unit}` as ParseKeys, { count: 0 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <Input
          dir="auto"
          autoComplete="off"
          aria-label={t('recipeForm.ingredient.nameLabel', { n })}
          aria-required="true"
          placeholder={t('recipeForm.ingredient.name')}
          aria-invalid={errors?.name ? true : undefined}
          aria-describedby={describedBy}
          className="col-span-2 sm:col-span-4"
          {...register(`ingredients.${index}.name`)}
        />
        <Input
          dir="auto"
          autoComplete="off"
          aria-label={t('recipeForm.ingredient.noteLabel', { n })}
          placeholder={t('recipeForm.ingredient.note')}
          aria-invalid={errors?.note ? true : undefined}
          aria-describedby={describedBy}
          className="col-span-2 sm:col-span-2"
          {...register(`ingredients.${index}.note`)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="col-span-2 w-full sm:col-span-1 sm:w-11"
          aria-label={t('recipeForm.ingredient.remove', { n })}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      {messages.length > 0 ? (
        <div id={errorId} className="flex flex-col text-sm text-destructive">
          {messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function Ingredients({
  control,
  register,
  errors,
}: {
  control: Control<RecipeFormValues>;
  register: UseFormRegister<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
}) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'ingredients',
  });
  const rootError = errors.ingredients?.root?.message;
  return (
    <section
      aria-labelledby="ingredients-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="ingredients-heading" className="text-title">
        {t('recipeForm.sections.ingredients')}
        <RequiredMark />
      </h2>
      <ul className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <IngredientRow
            key={field.id}
            index={index}
            control={control}
            register={register}
            errors={errors.ingredients?.[index]}
            canRemove={fields.length > 1}
            onRemove={() => remove(index)}
          />
        ))}
      </ul>
      {rootError ? (
        <p role="alert" className="text-sm text-destructive">
          {rootError}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        className="w-fit"
        onClick={() => append(emptyIngredientRow())}
      >
        <Plus aria-hidden="true" />
        {t('recipeForm.ingredient.add')}
      </Button>
    </section>
  );
}

function Steps({
  control,
  register,
  errors,
}: {
  control: Control<RecipeFormValues>;
  register: UseFormRegister<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
}) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({ control, name: 'steps' });
  const rootError = errors.steps?.root?.message;
  return (
    <section aria-labelledby="steps-heading" className="flex flex-col gap-3">
      <h2 id="steps-heading" className="text-title">
        {t('recipeForm.sections.steps')}
        <RequiredMark />
      </h2>
      <ol className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <li key={field.id}>
            <FormField
              id={`step-${index}`}
              label={t('recipeForm.step.label', { n: index + 1 })}
              error={errors.steps?.[index]?.description?.message}
            >
              {(field) => (
                <div className="flex items-start gap-2">
                  <Textarea
                    dir="auto"
                    {...field}
                    {...register(`steps.${index}.description`)}
                    aria-required="true"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('recipeForm.step.remove', { n: index + 1 })}
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              )}
            </FormField>
          </li>
        ))}
      </ol>
      {rootError ? (
        <p role="alert" className="text-sm text-destructive">
          {rootError}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        className="w-fit"
        onClick={() => append(emptyStepRow())}
      >
        <Plus aria-hidden="true" />
        {t('recipeForm.step.add')}
      </Button>
    </section>
  );
}

/**
 * The recipe form (FR-4), for create now and edit later (Story 3.4). Values are
 * checked against the generated write schema before sending; a 422 from the server
 * lands on the same fields with the same Hebrew messages (AD-9, AD-28).
 */
export function RecipeForm({
  defaultValues,
  onSave,
  submitLabel,
}: RecipeFormProps) {
  const { t } = useTranslation();
  const issueMessage = useIssueMessage();
  const errorMessage = useErrorMessage();

  // The resolver turns client issues into field errors with their Hebrew text.
  const resolver: Resolver<RecipeFormValues> = (values) => {
    const issues = validateRecipeForm(values);
    if (issues.length === 0) return { values, errors: {} };
    const errors: Record<string, unknown> = {};
    for (const issue of issues) {
      set(errors, issueFieldPath(issue.path), {
        type: issue.type,
        message: issueMessage(issue),
      });
    }
    return { values: {}, errors: errors as FieldErrors<RecipeFormValues> };
  };

  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormValues>({ defaultValues, resolver });

  const description = useWatch({ control, name: 'description' });
  const notes = useWatch({ control, name: 'notes' });
  const formError = errors.root?.server?.message;

  const onSubmit = handleSubmit(async (values) => {
    clearErrors('root.server');
    try {
      await onSave(toWritePayload(values));
    } catch (error) {
      const issues = getValidationIssues(error);
      const known = issues.filter((issue) => isFormField(issue.path));
      for (const issue of known) {
        setError(issueFieldPath(issue.path) as FieldPath<RecipeFormValues>, {
          type: issue.type,
          message: issueMessage(issue),
        });
      }
      // Anything the form cannot place on a field is shown under the button.
      if (known.length === 0 || known.length < issues.length) {
        setError('root.server', {
          type: getErrorCode(error) ?? 'unknown',
          message: errorMessage(error),
        });
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <RequiredNote>{t('form.requiredNote')}</RequiredNote>
      <section
        aria-labelledby="details-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="details-heading" className="text-title">
          {t('recipeForm.sections.details')}
        </h2>
        <FormField
          id="recipe-title"
          label={t('recipeForm.title')}
          required
          error={errors.title?.message}
        >
          {(field) => (
            <Input
              dir="auto"
              autoComplete="off"
              {...field}
              {...register('title')}
            />
          )}
        </FormField>
        <FormField
          id="recipe-description"
          label={t('recipeForm.description')}
          error={errors.description?.message}
          counter={
            <CharacterCounter
              length={description.length}
              max={DESCRIPTION_MAX_LENGTH}
            />
          }
        >
          {(field) => (
            <Textarea dir="auto" {...field} {...register('description')} />
          )}
        </FormField>
        <FormField
          id="recipe-notes"
          label={t('recipeForm.notes')}
          error={errors.notes?.message}
          counter={
            <CharacterCounter length={notes.length} max={NOTES_MAX_LENGTH} />
          }
        >
          {(field) => <Textarea dir="auto" {...field} {...register('notes')} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            id="recipe-servings"
            label={t('recipeForm.servings')}
            required
            error={errors.base_servings?.message}
          >
            {(field) => (
              <Input
                dir="ltr"
                inputMode="numeric"
                {...field}
                {...register('base_servings')}
              />
            )}
          </FormField>
          <FormField
            id="recipe-prep"
            label={t('recipeForm.prepTime')}
            error={errors.prep_time_minutes?.message}
          >
            {(field) => (
              <Input
                dir="ltr"
                inputMode="numeric"
                {...field}
                {...register('prep_time_minutes')}
              />
            )}
          </FormField>
          <FormField
            id="recipe-cook"
            label={t('recipeForm.cookTime')}
            error={errors.cook_time_minutes?.message}
          >
            {(field) => (
              <Input
                dir="ltr"
                inputMode="numeric"
                {...field}
                {...register('cook_time_minutes')}
              />
            )}
          </FormField>
        </div>
        <FormField
          id="recipe-source"
          label={t('recipeForm.sourceUrl')}
          error={errors.source_url?.message}
        >
          {(field) => (
            <Input
              dir="ltr"
              type="url"
              inputMode="url"
              autoComplete="off"
              {...field}
              {...register('source_url')}
            />
          )}
        </FormField>
      </section>

      <Ingredients control={control} register={register} errors={errors} />
      <Steps control={control} register={register} errors={errors} />

      <div className="flex flex-col items-start gap-3">
        {formError ? (
          <p role="alert" className="text-destructive">
            {formError}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? t('recipeForm.saving') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
