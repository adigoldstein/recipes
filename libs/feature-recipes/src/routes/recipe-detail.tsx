import { useEffect, useRef, useState } from 'react';
import type { ParseKeys } from 'i18next';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  getErrorCode,
  recipesGetRecipeOptions,
  type IngredientRead,
  type RecipeRead,
  type SourceUnit,
  type Unit,
} from '@bite-and-board/data-access';
import { formatAmount, scaleAmount } from '@bite-and-board/recipe-domain';
import {
  Button,
  EmptyState,
  IngredientBoard,
  IngredientLine,
  RecipeDetailSkeleton,
  ServingsStepper,
  StepItem,
  Toggle,
  type IngredientQuantity,
} from '@bite-and-board/ui-components';
import { useCookingChecks } from '../detail/use-cooking-checks';
import { useServings } from '../detail/use-servings';
import { useErrorMessage } from '../shared/use-error-message';
import { useFormatTime } from '../shared/use-format-time';

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 100;

const TAG = 'rounded-full bg-secondary px-3 py-1 text-label';

/** The hostname of a recipe's source link, or undefined if it is not a web URL. */
function webHost(url: string) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol)
      ? parsed.hostname
      : undefined;
  } catch {
    return undefined;
  }
}

/** The recipe at `/recipes/:id`: ingredient board, steps and cooking aids (FR-5). */
export function RecipeDetailPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { id = '' } = useParams();
  const recipe = useQuery(recipesGetRecipeOptions({ path: { recipe_id: id } }));

  if (recipe.isPending) {
    return (
      <div
        role="status"
        aria-label={t('detail.loading')}
        className="mx-auto max-w-detail pt-8"
      >
        <RecipeDetailSkeleton />
      </div>
    );
  }
  if (recipe.isError) {
    const notFound = getErrorCode(recipe.error) === 'recipe_not_found';
    return (
      <EmptyState
        title={errorMessage(recipe.error)}
        actions={
          <>
            {notFound ? null : (
              <Button variant="secondary" onClick={() => void recipe.refetch()}>
                {t('library.error.retry')}
              </Button>
            )}
            <Button asChild>
              <Link to="/">{t('notFound.back')}</Link>
            </Button>
          </>
        }
      />
    );
  }
  // Keyed by id so a different recipe starts with its own ticks and toggle.
  return <RecipeDetail key={recipe.data.id} recipe={recipe.data} />;
}

function RecipeDetail({ recipe }: { recipe: RecipeRead }) {
  const { t } = useTranslation();
  const formatTime = useFormatTime();
  const navigate = useNavigate();
  // A router location key other than "default" means we arrived by navigating
  // inside the app, so going back lands on the library with its filters.
  const cameFromApp = useLocation().key !== 'default';
  const title = useRef<HTMLHeadingElement>(null);
  const checks = useCookingChecks(recipe.id);
  const [showOriginal, setShowOriginal] = useState(false);
  // View-only: kept for this tab's session, never saved to the recipe.
  const [servings, setServings] = useServings(
    recipe.id,
    recipe.base_servings,
    MIN_SERVINGS,
    MAX_SERVINGS,
  );

  // The app shell moves focus to the h1 on navigation, but the recipe loads after
  // that, so the title takes focus itself once it exists (not on a first load).
  useEffect(() => {
    if (cameFromApp) title.current?.focus();
  }, [cameFromApp]);

  // Hebrew has a singular only for exactly 1 ("1 כוס", "2 כוסות", "0.5 כוסות");
  // i18next would also look for `_two` and `_many` forms, which we do not write.
  const unitLabel = (unit: Unit | null, amount: number) =>
    unit
      ? t(`units.${unit}` as ParseKeys, { count: amount === 1 ? 1 : 0 })
      : undefined;
  const sourceUnitLabel = (unit: SourceUnit) =>
    t(`sourceUnits.${unit}` as ParseKeys);

  const scale = (amount: number, unit: Unit | SourceUnit | null) =>
    scaleAmount(amount, unit, recipe.base_servings, servings);

  const quantityOf = (
    amount: number,
    unit: Unit | null,
  ): IngredientQuantity => {
    const scaled = scale(amount, unit);
    return { amount: formatAmount(scaled), unit: unitLabel(unit, scaled) };
  };

  const originalHint = ({ original }: IngredientRead) => {
    if (!original) return undefined;
    if (original.amount === null) return t('detail.originalToTaste');
    const { amount, unit } = quantityOf(original.amount, original.unit);
    return t('detail.originalHint', {
      value: unit ? `${amount} ${unit}` : amount,
    });
  };

  const hasConverted =
    recipe.ingredients.some((ingredient) => ingredient.source) ||
    recipe.steps.some((step) => step.source_text);
  const prep = formatTime(recipe.prep_time_minutes);
  const cook = formatTime(recipe.cook_time_minutes);
  const sourceHost = recipe.source_url ? webHost(recipe.source_url) : undefined;

  return (
    <article className="mx-auto max-w-detail pb-8">
      <title>{t('app.pageTitle', { page: recipe.title })}</title>
      <div className="flex flex-col gap-3 pt-4 pb-6">
        <Button asChild variant="ghost" className="w-fit">
          <Link
            to="/"
            onClick={(event) => {
              if (!cameFromApp) return;
              event.preventDefault();
              void navigate(-1);
            }}
          >
            <ArrowRight aria-hidden="true" className="ltr:rotate-180" />
            {t('detail.back')}
          </Link>
        </Button>
        {recipe.tags.length > 0 || prep || cook ? (
          <div className="flex flex-wrap items-center gap-2">
            {recipe.tags.map((tag) => (
              <span key={tag.id} dir="auto" className={TAG}>
                {tag.name}
              </span>
            ))}
            {prep ? (
              <span className="text-label text-muted-foreground">
                {t('detail.prep', { time: prep })}
              </span>
            ) : null}
            {cook ? (
              <span className="text-label text-muted-foreground">
                {t('detail.cook', { time: cook })}
              </span>
            ) : null}
          </div>
        ) : null}
        <h1
          ref={title}
          tabIndex={-1}
          dir="auto"
          className="text-display break-words outline-none lg:text-display-lg"
        >
          {recipe.title}
        </h1>
        {recipe.description ? (
          <p dir="auto" className="max-w-prose text-muted-foreground">
            {recipe.description}
          </p>
        ) : null}
        {hasConverted || checks.any ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {hasConverted ? (
              <Toggle
                variant="outline"
                pressed={showOriginal}
                onPressedChange={setShowOriginal}
              >
                {t('detail.showOriginal')}
              </Toggle>
            ) : null}
            {checks.any ? (
              <Button variant="secondary" onClick={checks.clear}>
                {t('detail.clearChecks')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="lg:sticky lg:top-6 lg:w-board lg:shrink-0">
          <ServingsStepper
            className="pb-4"
            value={servings}
            base={recipe.base_servings}
            min={MIN_SERVINGS}
            max={MAX_SERVINGS}
            onChange={setServings}
            label={t('detail.servings.label')}
            decreaseLabel={t('detail.servings.decrease')}
            increaseLabel={t('detail.servings.increase')}
            resetLabel={t('detail.servings.reset', {
              value: recipe.base_servings,
            })}
            rangeMessage={t('detail.servings.range', {
              min: MIN_SERVINGS,
              max: MAX_SERVINGS,
            })}
            announcement={t('detail.servings.announce', { count: servings })}
          />
          <IngredientBoard title={t('detail.ingredients')}>
            {recipe.ingredients.map((ingredient) => (
              <IngredientLine
                key={ingredient.id}
                name={ingredient.name}
                note={ingredient.note ?? undefined}
                quantity={
                  ingredient.amount === null
                    ? undefined
                    : quantityOf(ingredient.amount, ingredient.unit)
                }
                source={
                  showOriginal && ingredient.source
                    ? {
                        amount: formatAmount(
                          scale(ingredient.source.amount, null),
                        ),
                        unit: sourceUnitLabel(ingredient.source.unit),
                      }
                    : undefined
                }
                toTasteLabel={t('detail.toTaste')}
                originalHint={originalHint(ingredient)}
                checked={checks.isChecked(ingredient.id)}
                onCheckedChange={(on) => checks.set(ingredient.id, on)}
              />
            ))}
          </IngredientBoard>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section aria-labelledby="steps-heading">
            <h2 id="steps-heading" className="pb-2 text-title">
              {t('detail.steps')}
            </h2>
            <ol>
              {recipe.steps.map((step, index) => (
                <StepItem
                  key={step.id}
                  number={index + 1}
                  text={step.description}
                  originalText={
                    showOriginal && step.source_text
                      ? t('detail.stepOriginal', { text: step.source_text })
                      : undefined
                  }
                  checked={checks.isChecked(step.id)}
                  onCheckedChange={(on) => checks.set(step.id, on)}
                />
              ))}
            </ol>
          </section>

          {recipe.notes ? (
            <section aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="pb-2 text-title">
                {t('detail.notes')}
              </h2>
              <p dir="auto" className="break-words whitespace-pre-line">
                {recipe.notes}
              </p>
            </section>
          ) : null}

          {recipe.source_url && sourceHost ? (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-label text-muted-foreground underline underline-offset-4"
            >
              {t('detail.source')} <bdi>{sourceHost}</bdi>
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export { RecipeDetailPage as Component };
