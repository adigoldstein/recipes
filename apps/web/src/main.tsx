import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { initI18n } from '@bite-and-board/i18n';
import { DirectionProvider } from '@bite-and-board/ui-components';
import { routes } from './app/router';
import { ThemeProvider } from './app/theme';

initI18n();

const router = createBrowserRouter(routes);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <DirectionProvider dir="rtl">
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </DirectionProvider>
  </StrictMode>,
);
