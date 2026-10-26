import { useTranslation } from 'react-i18next';
import { PageHeading } from './page-heading';

// Stands in for the recipe library page until it lands in its feature lib (1.9).
export function PlaceholderHome() {
  const { t } = useTranslation();
  return (
    <>
      <title>{t('app.name')}</title>
      <PageHeading>{t('home.title')}</PageHeading>
    </>
  );
}
