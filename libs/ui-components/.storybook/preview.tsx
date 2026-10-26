import { useEffect, type ReactNode } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import { DirectionProvider } from '../src/components/ui/direction';
import '../src/styles/theme.css';

type StoryTheme = 'light' | 'dark';

// Every story renders RTL in Hebrew, inside the Radix DirectionProvider, on the
// page background, with `.dark` on <html> exactly as the app's ThemeProvider does.
function AppShell({
  theme,
  children,
}: {
  theme: StoryTheme;
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.lang = 'he';
    root.dir = 'rtl';
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <DirectionProvider dir="rtl">
      <div className="min-h-dvh bg-background p-6 text-foreground">
        {children}
      </div>
    </DirectionProvider>
  );
}

const withAppShell: Decorator = (Story, context) => (
  <AppShell theme={context.globals['theme'] === 'dark' ? 'dark' : 'light'}>
    <Story />
  </AppShell>
);

const preview: Preview = {
  decorators: [withAppShell],
  globalTypes: {
    theme: {
      description: 'Colour theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
  },
};

export default preview;
