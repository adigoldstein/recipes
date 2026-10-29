import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { BackLink, Button } from '@bite-and-board/ui-components';

/**
 * Root error element: replaces the whole shell when a route throws. The back link
 * goes to the home page, not one step back in history, because the page before
 * this one is the page that just failed. It uses no data-access hook, which would
 * pull the API client into the first load (AD-11) and could itself fail here.
 */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const title = notFound ? t('notFound.title') : t('error.title');

  return (
    <main className="mx-auto min-h-dvh max-w-library bg-background px-4 pt-4 text-foreground lg:px-8">
      <title>{t('app.pageTitle', { page: title })}</title>
      <BackLink
        label={t('notFound.back')}
        link={(children) => <Link to="/">{children}</Link>}
      />
      <h1 className="pt-4 pb-3 text-title">{title}</h1>
      <p className="pb-6 text-muted-foreground">
        {notFound ? t('notFound.body') : t('error.body')}
      </p>
      {notFound ? null : (
        <Button onClick={() => globalThis.location.reload()}>
          {t('error.refresh')}
        </Button>
      )}
    </main>
  );
}
