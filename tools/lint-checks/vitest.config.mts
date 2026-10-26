import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/tools/lint-checks',
  test: {
    name: 'lint-checks',
    watch: false,
    globals: true,
    environment: 'node',
    // Specs spawn uv, mypy and Vite with cold caches; CI runners need headroom.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
