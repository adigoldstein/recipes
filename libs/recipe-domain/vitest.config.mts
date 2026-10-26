import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/recipe-domain',
  test: {
    name: '@bite-and-board/recipe-domain',
    watch: false,
    passWithNoTests: true,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    reporters: ['default'],
    // Scaling and rounding rules must stay fully covered, so every
    // test run measures coverage and fails below 100%.
    coverage: {
      enabled: true,
      include: ['src/**/*.ts'],
      thresholds: { 100: true },
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
