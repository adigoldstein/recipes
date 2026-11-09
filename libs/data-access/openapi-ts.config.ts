import { defineConfig } from '@hey-api/openapi-ts';

// Never edit the generated files by hand. `nx run data-access:generate` rewrites them.
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
