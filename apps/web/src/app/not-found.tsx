import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@bite-and-board/ui-components';
import { PageHeading } from './page-heading';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <>
      <title>{t('app.pageTitle', { page: t('notFound.title') })}</title>
      <PageHeading>{t('notFound.title')}</PageHeading>
      <p className="pb-8 text-muted-foreground">{t('notFound.body')}</p>
      <Button asChild>
        <Link to="/">{t('notFound.back')}</Link>
      </Button>
    </>
  );
}
