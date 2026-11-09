import type { QueryClient } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';
import { AppLayout } from './app-layout';
import { lazyNewRecipePage } from './new-recipe-page';
import { NotFound } from './not-found';
import { protectedRoute } from './protected-route';
import { RouteError } from './route-error';

/** The app routes. Protected pages are wrapped with `protectedRoute`. */
export function createRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      path: '/',
      Component: AppLayout,
      errorElement: <RouteError />,
      // Shown while the first page loads. It shows nothing; the layout replaces it.
      HydrateFallback: () => null,
      children: [
        {
          index: true,
          // The page is a separate chunk, loaded the first time the route opens
          // (AD-11).
          lazy: () => import('@bite-and-board/feature-recipes/library'),
        },
        {
          path: 'recipes/:id',
          lazy: () => import('@bite-and-board/feature-recipes/recipe-detail'),
        },
        // Inside the layout, so the top bar is shown on unknown paths too.
        {
          path: 'login',
          lazy: () => import('@bite-and-board/feature-auth/login'),
        },
        // For editors and admins. A visitor is sent to /login.
        protectedRoute(queryClient, 'editor', [
          {
            path: 'recipes/new',
            // The form page with the AI import panel above it (the app connects
            // them).
            lazy: lazyNewRecipePage,
          },
          {
            path: 'recipes/:id/edit',
            lazy: () => import('@bite-and-board/feature-recipes/recipe-edit'),
          },
          {
            path: 'tags',
            lazy: () => import('@bite-and-board/feature-tags/tags'),
          },
          {
            path: 'account',
            lazy: () => import('@bite-and-board/feature-auth/account'),
          },
        ]),
        // Admins only. An editor sees the not-found page, and a visitor is sent to
        // /login.
        protectedRoute(queryClient, 'admin', [
          {
            path: 'users',
            lazy: () => import('@bite-and-board/feature-users/users'),
          },
        ]),
        { path: '*', Component: NotFound },
      ],
    },
  ];
}
