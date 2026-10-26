import { join } from 'node:path';
import { createServer } from 'vite';

const WORKSPACE = join(import.meta.dirname, '../../..');

// The memo cache sentinel only appears in components the React Compiler rewrote.
const COMPILED = 'react.memo_cache_sentinel';

it('compiles app components with the React Compiler', async () => {
  const root = join(WORKSPACE, 'apps/web');
  const server = await createServer({
    configFile: join(root, 'vite.config.mts'),
    root,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const result = await server.transformRequest(
      '/src/app/placeholder-home.tsx',
    );
    expect(result?.code).toContain(COMPILED);
  } finally {
    await server.close();
  }
});
