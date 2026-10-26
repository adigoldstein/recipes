import type { RouteObject } from 'react-router';
import { AppLayout } from './app-layout';
import { NotFound } from './not-found';
import { RouteError } from './route-error';

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    errorElement: <RouteError />,
    // Rendered while the first lazy page chunk loads; the app shell replaces it.
    HydrateFallback: () => null,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('./placeholder-home')).PlaceholderHome,
        }),
      },
      // Inside the layout, so the top bar stays on unknown paths.
      { path: '*', Component: NotFound },
    ],
  },
];
