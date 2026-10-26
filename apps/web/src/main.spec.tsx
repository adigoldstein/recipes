import { screen } from '@testing-library/react';

// Loads the real entry point the way index.html does, so a broken provider
// tree or route table in main.tsx fails here.
describe('main.tsx bootstrap', () => {
  it('mounts the app into #root in Hebrew RTL', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await import('./main');
    expect(
      await screen.findByRole('heading', { name: 'מתכונים' }),
    ).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'התראות' })).toBeTruthy();
  });
});
