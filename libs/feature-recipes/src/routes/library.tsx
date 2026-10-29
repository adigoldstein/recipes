import { useDeferredValue, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  recipesListRecipesOptions,
  tagsListTagsOptions,
  useCan,
  type RecipeSummary,
} from '@bite-and-board/data-access';
import { filterRecipes } from '@bite-and-board/recipe-domain';
import {
  Button,
  EmptyState,
  RecipeCard,
  RecipeCardSkeleton,
  SearchField,
  TagFilter,
} from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';
import { useFormatTime } from '../shared/use-format-time';
import { useLibraryFilters } from '../library/use-library-filters';

const SKELETON_COUNT = 6;

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** The recipe library at `/`: cards, search and tag filters (FR-1 to FR-3). */
export function LibraryPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const formatTime = useFormatTime();
  const search = useRef<HTMLInputElement>(null);
  const canEdit = useCan('editor');

  const recipes = useQuery(recipesListRecipesOptions());
  const tags = useQuery(tagsListTagsOptions());
  // Without tags (still loading, or failed) the library works as a plain list.
  const knownTagIds = new Set(tags.data?.map((tag) => tag.id));
  const pinnedTags = (tags.data ?? []).filter((tag) => tag.pinned);
  const { filters, update, clear } = useLibraryFilters(knownTagIds);
  const query = useDeferredValue(filters.query);

  // "/" jumps to the search field, unless the user is already typing somewhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== '/' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isTypingTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      search.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const renderBody = () => {
    // Waiting for the tags too, so a tag filter in the URL never flashes the full list.
    if (recipes.isPending || tags.isPending) {
      return (
        <div role="status" aria-label={t('library.loading')} className={GRID}>
          {Array.from({ length: SKELETON_COUNT }, (_, n) => (
            <RecipeCardSkeleton key={n} />
          ))}
        </div>
      );
    }
    if (recipes.isError) {
      return (
        <EmptyState
          title={errorMessage(recipes.error)}
          actions={
            <Button variant="secondary" onClick={() => void recipes.refetch()}>
              {t('library.error.retry')}
            </Button>
          }
        />
      );
    }
    if (recipes.data.length === 0) {
      return (
        <EmptyState
          title={t('library.empty.title')}
          actions={
            canEdit ? (
              <Button asChild>
                <Link to="/recipes/new">{t('recipeForm.newAction')}</Link>
              </Button>
            ) : undefined
          }
        />
      );
    }
    const visible = filterRecipes(recipes.data, { ...filters, query });
    if (visible.length === 0) {
      const searching = query.trim() !== '';
      return (
        <EmptyState
          title={
            searching
              ? t('library.noResults.title', { q: query.trim() })
              : t('library.noResults.titleFilter')
          }
          actions={
            <Button variant="secondary" onClick={clear}>
              {searching
                ? t('library.noResults.clearSearch')
                : t('library.noResults.clearFilter')}
            </Button>
          }
        />
      );
    }
    return (
      <ul className={GRID}>
        {visible.map((recipe) => (
          <li key={recipe.id}>
            <RecipeCardItem
              recipe={recipe}
              time={formatTime(recipe.total_minutes)}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <>
      <title>{t('app.name')}</title>
      <h1 tabIndex={-1} className="pt-8 pb-3 text-title outline-none">
        {t('library.title')}
      </h1>
      <div className="flex flex-col gap-3 pb-6">
        <SearchField
          ref={search}
          className="max-w-xl"
          value={filters.query}
          onValueChange={(value) => update({ query: value })}
          label={t('library.search.label')}
          placeholder={t('library.search.placeholder')}
          clearLabel={t('library.search.clear')}
        />
        <TagFilter
          label={t('library.filter.label')}
          allLabel={t('library.filter.all')}
          options={pinnedTags.map((tag) => ({ id: tag.id, label: tag.name }))}
          selectedIds={filters.tagIds}
          onSelectedIdsChange={(tagIds) => update({ tagIds })}
          fast={{
            label: t('library.filter.fast'),
            pressed: filters.fastOnly,
            onPressedChange: (fastOnly) => update({ fastOnly }),
          }}
        />
      </div>
      {renderBody()}
    </>
  );
}

function RecipeCardItem({
  recipe,
  time,
}: {
  recipe: RecipeSummary;
  time: string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <RecipeCard
      title={recipe.title}
      tags={recipe.tags.map((tag) => tag.name)}
      overflowLabel={(count) => t('library.card.moreTags', { count })}
      time={time}
      photoUrl={recipe.photo?.thumb_url}
      renderLink={({ className, children }) => (
        <Link to={`/recipes/${recipe.id}`} className={className}>
          {children}
        </Link>
      )}
    />
  );
}

export { LibraryPage as Component };
