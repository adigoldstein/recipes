import { defineConfig } from '@hey-api/openapi-ts';

// Generated output is never hand-edited; `nx run data-access:generate` rewrites it.
export default defineConfig({
  input: './openapi.json',
  output: { path: './src/generated', clean: true },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/client-fetch',
    '@hey-api/sdk',
    '@tanstack/react-query',
    'zod',
  ],
});
