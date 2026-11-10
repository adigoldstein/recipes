import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD } from './src/test-account';

// Not 8000 / 4300 (the development ports), so a running dev server does not get in
// the way.
const API_PORT = 8130;
const WEB_PORT = 8131;
const apiOrigin = `http://127.0.0.1:${API_PORT}`;
const baseURL = `http://127.0.0.1:${WEB_PORT}`;
const root = resolve(__dirname, '../..');

const phone = { width: 375, height: 812 };
const desktop = { width: 1280, height: 800 };

export default defineConfig({
  testDir: './src',
  outputDir: './out-tsc/test-results',
  // There is one server and one database, so tests run one at a time, in order.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: './out-tsc/report' }]]
    : 'list',
  use: {
    baseURL,
    locale: 'he-IL',
    trace: 'off',
  },
  projects: [
    // Logs in once and saves the session (login is limited to 5 times a minute).
    { name: 'setup', testMatch: /login\.setup\.spec\.ts/ },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: phone },
      dependencies: ['setup'],
      testIgnore: /login\.setup\.spec\.ts/,
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: desktop },
      dependencies: ['setup'],
      testIgnore: /login\.setup\.spec\.ts/,
    },
  ],
  // Start the API with a new database, and the built app (`vite preview`, which
  // passes `/api` and `/media` to that API, like `vite` does in development).
  webServer: [
    {
      command: 'node apps/web-e2e/scripts/start-server.mjs',
      cwd: root,
      url: `${apiOrigin}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        E2E_PORT: String(API_PORT),
        E2E_ADMIN_EMAIL: E2E_EMAIL,
        E2E_ADMIN_PASSWORD: E2E_PASSWORD,
      },
    },
    {
      command: `npx vite preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      cwd: resolve(root, 'apps/web'),
      url: baseURL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { API_ORIGIN: apiOrigin },
    },
  ],
});
