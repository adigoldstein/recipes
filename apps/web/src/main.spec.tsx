import { screen } from '@testing-library/react';

// Loads the real entry point like index.html does, so a broken provider or route
// in main.tsx fails this test.

// Time limit for the first import. It builds the code of the whole app, which takes
// longer than the default 5 seconds when the computer is busy running other tests.
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
