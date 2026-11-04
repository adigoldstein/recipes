import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  tagsListTagsOptions,
  useBackNavigation,
} from '@bite-and-board/data-access';
import {
  BackLink,
  Button,
  EmptyState,
  Skeleton,
} from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';
import { AddTagForm } from '../tags/add-tag-form';
import { TagRow } from '../tags/tag-row';

const SKELETON_COUNT = 4;

/** The editor's Tags screen at `/tags` (FR23): add, rename, pin and delete tags. */
export function TagsPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const tags = useQuery(tagsListTagsOptions());
  const { onBack } = useBackNavigation();

  const renderBody = () => {
    if (tags.isPending) {
      return (
        <div
          role="status"
          aria-label={t('tags.loading')}
          className="grid gap-3"
        >
          {Array.from({ length: SKELETON_COUNT }, (_, n) => (
            <Skeleton key={n} className="h-16 rounded-xl" />
          ))}
        </div>
      );
    }
    if (tags.isError) {
      return (
        <EmptyState
          title={errorMessage(tags.error)}
          actions={
            <Button variant="secondary" onClick={() => void tags.refetch()}>
              {t('tags.retry')}
            </Button>
          }
        />
      );
    }
    if (tags.data.length === 0) {
      return <EmptyState title={t('tags.empty')} />;
    }
    // The server sends them pinned first, in the order of the chip row (UX-DR18).
    return (
      <ul aria-label={t('tags.list')} className="grid gap-3">
        {tags.data.map((tag) => (
          <TagRow key={tag.id} tag={tag} />
        ))}
      </ul>
    );
  };

  return (
    <>
      <title>{t('app.pageTitle', { page: t('tags.title') })}</title>
      <div className="mx-auto flex max-w-detail flex-col gap-6 pt-4">
        <BackLink
          label={t('tags.back')}
          link={(children) => (
            <Link to="/" onClick={onBack}>
              {children}
            </Link>
          )}
        />
        <h1 tabIndex={-1} className="text-title outline-none">
          {t('tags.title')}
        </h1>
        <AddTagForm />
        {renderBody()}
      </div>
    </>
  );
}

export { TagsPage as Component };
