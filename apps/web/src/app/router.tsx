import type { QueryClient } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';
import { AppLayout } from './app-layout';
import { NotFound } from './not-found';
import { protectedRoute } from './protected-route';
import { RouteError } from './route-error';

/** The route table. Guarded areas are built with `protectedRoute`. */
export function createRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      path: '/',
      Component: AppLayout,
      errorElement: <RouteError />,
      // Rendered while the first lazy page chunk loads; the app shell replaces it.
      HydrateFallback: () => null,
      children: [
        {
          index: true,
          // The page is its own chunk, loaded when the route first matches (AD-11).
          lazy: () => import('@bite-and-board/feature-recipes/library'),
        },
        {
          path: 'recipes/:id',
          lazy: () => import('@bite-and-board/feature-recipes/recipe-detail'),
        },
        // Inside the layout, so the top bar stays on unknown paths.
        {
          path: 'login',
          lazy: () => import('@bite-and-board/feature-auth/login'),
        },
        // Any signed-in user: a visitor goes to /login.
        protectedRoute(queryClient, 'editor', [
          {
            path: 'recipes/new',
            lazy: () => import('@bite-and-board/feature-recipes/recipe-new'),
          },
          {
            path: 'recipes/:id/edit',
            lazy: () => import('@bite-and-board/feature-recipes/recipe-edit'),
          },
          {
            path: 'account',
            lazy: () => import('@bite-and-board/feature-auth/account'),
          },
        ]),
        // Admin only: an editor sees the not-found page, a visitor goes to /login.
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
