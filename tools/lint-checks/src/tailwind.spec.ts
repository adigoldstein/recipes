import { join } from 'node:path';
import { createServer } from 'vite';

const WORKSPACE = join(import.meta.dirname, '../../..');

// Without the Tailwind Vite plugin the app ships unstyled while every other check stays green.
it('generates the theme tokens and utilities for the app stylesheet', async () => {
  const root = join(WORKSPACE, 'apps/web');
  const server = await createServer({
    configFile: join(root, 'vite.config.mts'),
    root,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const result = await server.transformRequest('/src/styles.css');
    const code = result?.code ?? '';
    for (const utility of ['.bg-board', '.text-title', '.rounded-full']) {
      expect(code).toContain(utility);
    }
    expect(code).toMatch(/:root\s*\{[^}]*--board:/);
    expect(code).toMatch(/\.dark\s*\{[^}]*--board:/);
  } finally {
    await server.close();
  }
});
