import { isRouteErrorResponse, useRouteError } from 'react-router';

export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main>
      <h1>{notFound ? 'Page not found' : 'Something went wrong'}</h1>
    </main>
  );
}
