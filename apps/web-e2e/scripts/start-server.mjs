// Starts the API for the end-to-end tests (Story 6.3), with a new database. The built
// React app is served by `vite preview` (see playwright.config.ts).
//
// Every setting is passed as an env var, and the Python processes run from a temp
// folder, so the developer's `.env` is never loaded (the app reads `.env` from the
// current folder). Imports use the fake AI provider, with no network.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const service = join(root, 'apps/recipe-service');
const port = process.env.E2E_PORT ?? '8100';
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
if (!email || !password) {
  throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required');
}

const workdir = mkdtempSync(join(tmpdir(), 'recipes-e2e-'));
const env = {
  ...process.env,
  ENV: 'dev',
  LLM_PROVIDERS: 'fake',
  JWT_SECRET: 'e2e-only-secret-not-for-real-use',
  COOKIE_SECURE: 'false',
  // Use only the small `seed` recipes, not the demo recipes.
  SEED_DEMO: 'false',
  DATA_DIR: join(workdir, 'data'),
  ANTHROPIC_API_KEY: '',
  GEMINI_API_KEY: '',
  PYTHONUTF8: '1',
  PYTHONPATH: service,
};
// Run from the temp folder, because the app reads `.env` from the current folder.
const uv = (args, options = {}) => [
  'uv',
  ['run', '--frozen', '--project', service, ...args],
  { cwd: workdir, env, ...options },
];

function run(label, [command, args, options]) {
  const result = spawnSync(command, args, {
    stdio: ['pipe', 'inherit', 'inherit'],
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status})`);
  }
}

function cleanup() {
  rmSync(workdir, { recursive: true, force: true });
}

try {
  run('seed', uv(['python', '-m', 'app.cli', 'seed'], { input: '' }));
  // Pass the password on stdin, never as an argument or an env var.
  run(
    'create-admin',
    uv(
      [
        'python',
        '-m',
        'app.cli',
        'create-admin',
        '--email',
        email,
        '--name',
        'E2E',
        '--password-stdin',
      ],
      { input: `${password}\n` },
    ),
  );
} catch (error) {
  cleanup();
  throw error;
}

const [command, args, options] = uv([
  'uvicorn',
  'app.main:app',
  '--host',
  '127.0.0.1',
  '--port',
  port,
]);
const server = spawn(command, args, { ...options, stdio: 'inherit' });
const stop = () => {
  server.kill();
  cleanup();
};
process.on('SIGTERM', () => {
  stop();
  process.exit(0);
});
process.on('SIGINT', () => {
  stop();
  process.exit(0);
});
server.on('exit', (code) => {
  cleanup();
  process.exit(code ?? 0);
});
