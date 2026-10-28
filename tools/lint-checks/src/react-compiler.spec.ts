import { join } from 'node:path';
import { createServer } from 'vite';

const WORKSPACE = join(import.meta.dirname, '../../..');

// Only components the React Compiler rewrote import its memo-cache runtime.
const COMPILED = /react[/_]compiler-runtime/;

it('compiles app components with the React Compiler', async () => {
  const root = join(WORKSPACE, 'apps/web');
  const server = await createServer({
    configFile: join(root, 'vite.config.mts'),
    root,
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const result = await server.transformRequest('/src/app/app-layout.tsx');
    expect(result?.code).toMatch(COMPILED);
  } finally {
    await server.close();
  }
});
