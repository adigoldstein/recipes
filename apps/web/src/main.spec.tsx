import { screen } from '@testing-library/react';

// Loads the real entry point the way index.html does, so a broken provider
// tree or route table in main.tsx fails here.
// The first import of the entry point transforms the whole app's module graph, which
// takes longer than the default 5 s when the machine is busy running other projects.
const LAZY_TIMEOUT = 30_000;

describe('main.tsx bootstrap', () => {
  it(
    'mounts the app into #root in Hebrew RTL',
    async () => {
      document.body.innerHTML = '<div id="root"></div>';
      await import('./main');
      expect(
        await screen.findByRole(
          'heading',
          { name: 'מתכונים' },
          { timeout: LAZY_TIMEOUT },
        ),
      ).toBeTruthy();
      expect(screen.getByRole('banner')).toBeTruthy();
      expect(screen.getByRole('region', { name: 'התראות' })).toBeTruthy();
    },
    2 * LAZY_TIMEOUT,
  );
});
