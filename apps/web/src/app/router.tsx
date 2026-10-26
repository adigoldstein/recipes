import type { RouteObject } from 'react-router';
import { RouteError } from './route-error';

export const routes: RouteObject[] = [
  {
    path: '/',
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
    ],
  },
];
