import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD } from './src/test-account';

// Not 8000 / 4300 (development) so a running dev server never gets in the way.
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
  // One server and one database: tests run one at a time, in order.
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
    // Logs in once (the login is rate limited to 5 a minute) and saves the session.
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
  // The API on a fresh database, and the built app (`vite preview`, which proxies
  // `/api` and `/media` to that API, as `vite` does in development).
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
