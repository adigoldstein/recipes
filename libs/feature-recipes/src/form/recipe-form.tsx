import type { ParseKeys } from 'i18next';
import { Plus } from 'lucide-react';
import type { KeyboardEvent } from 'react';
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
  type UseFormGetValues,
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
  ConfirmDialog,
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
  toast,
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
import { RowActions } from './row-actions';
import { useIssueMessage } from './use-issue-message';
import { useUnsavedChangesGuard } from './use-unsaved-changes-guard';

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
  count,
  onMove,
  onRemove,
  onEnter,
}: {
  index: number;
  control: Control<RecipeFormValues>;
  register: UseFormRegister<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues['ingredients'][number]> | undefined;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  onEnter: () => void;
}) {
  const { t } = useTranslation();
  const n = index + 1;
  const amount = useWatch({ control, name: `ingredients.${index}.amount` });
  const messages = (['amount', 'name', 'note'] as const)
    .map((field) => rowError(errors, field))
    .filter((message): message is string => Boolean(message));
  const errorId = `ingredient-${index}-error`;
  const describedBy = messages.length > 0 ? errorId : undefined;
  // Enter in a text box never submits the form; in the last row it adds the next one.
  const enter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    onEnter();
  };
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
          onKeyDown={enter}
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
                className="w-full sm:col-span-2"
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
          className="col-span-2 sm:col-span-3"
          onKeyDown={enter}
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
          onKeyDown={enter}
          {...register(`ingredients.${index}.note`)}
        />
        <RowActions
          index={index}
          count={count}
          moveUpLabel={t('recipeForm.ingredient.moveUp', { n })}
          moveDownLabel={t('recipeForm.ingredient.moveDown', { n })}
          removeLabel={t('recipeForm.ingredient.remove', { n })}
          onMove={onMove}
          onRemove={onRemove}
          className="col-span-2 flex justify-end gap-1 sm:col-span-3"
        />
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
  getValues,
  errors,
}: {
  control: Control<RecipeFormValues>;
  register: UseFormRegister<RecipeFormValues>;
  getValues: UseFormGetValues<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
}) {
  const { t } = useTranslation();
  const { fields, append, move, remove } = useFieldArray({
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
            count={fields.length}
            onMove={(to) => move(index, to)}
            onRemove={() => remove(index)}
            onEnter={() => {
              // Only the last row grows the list, and only once it has a name.
              const last = index === fields.length - 1;
              if (
                !last ||
                getValues(`ingredients.${index}.name`).trim() === ''
              ) {
                return;
              }
              append(emptyIngredientRow(), {
                focusName: `ingredients.${index + 1}.amount`,
              });
            }}
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
  const { fields, append, move, remove } = useFieldArray({
    control,
    name: 'steps',
  });
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
                  <RowActions
                    index={index}
                    count={fields.length}
                    moveUpLabel={t('recipeForm.step.moveUp', { n: index + 1 })}
                    moveDownLabel={t('recipeForm.step.moveDown', {
                      n: index + 1,
                    })}
                    removeLabel={t('recipeForm.step.remove', { n: index + 1 })}
                    onMove={(to) => move(index, to)}
                    onRemove={() => remove(index)}
                    className="flex flex-col gap-1"
                  />
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
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RecipeFormValues>({
    defaultValues,
    resolver,
    // An error shows when a field is first left, then follows the typing until it clears.
    mode: 'onTouched',
  });
  const { blocker, allowLeaving } = useUnsavedChangesGuard(isDirty);

  const description = useWatch({ control, name: 'description' });
  const notes = useWatch({ control, name: 'notes' });
  const formError = errors.root?.server?.message;

  const onSubmit: () => Promise<void> = handleSubmit(async (values) => {
    clearErrors('root.server');
    // A saved form navigates away from inside `onSave`; that must not ask.
    allowLeaving(true);
    try {
      await onSave(toWritePayload(values));
    } catch (error) {
      allowLeaving(false);
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
      // No code and no field means the network or the server failed, not the input.
      if (getErrorCode(error) === undefined && issues.length === 0) {
        toast.error(t('recipeForm.saveFailed'), {
          action: {
            label: t('recipeForm.retry'),
            onClick: () => void onSubmit(),
          },
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

      <Ingredients
        control={control}
        register={register}
        getValues={getValues}
        errors={errors}
      />
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
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('recipeForm.leave.title')}
        description={t('recipeForm.leave.description')}
        confirmLabel={t('recipeForm.leave.confirm')}
        cancelLabel={t('recipeForm.leave.cancel')}
        destructive
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </form>
  );
}
