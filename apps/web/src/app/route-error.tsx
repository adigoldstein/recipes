import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, useRouteError } from 'react-router';

/** Root error element: replaces the whole shell when a route throws. */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const title = notFound ? t('notFound.title') : t('error.title');

  return (
    <main className="mx-auto min-h-dvh max-w-library bg-background px-4 pt-8 text-foreground lg:px-8">
      <title>{t('app.pageTitle', { page: title })}</title>
      <h1 className="pb-3 text-title">{title}</h1>
      <p className="text-muted-foreground">
        {notFound ? t('notFound.body') : t('error.body')}
      </p>
    </main>
  );
}
