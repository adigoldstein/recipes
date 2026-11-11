// First-time local setup: `npm run setup` (run `npm ci` first).
//
//   1. installs the back end dependencies (uv sync)
//   2. creates apps/recipe-service/.env from .env.example, with a new random JWT_SECRET
//   3. creates the admin account, with a random password that is printed once
//
// It is safe to run again: an existing .env is never changed, and an admin that
// already exists is left alone. The only thing it cannot do is your AI key:
// add ANTHROPIC_API_KEY to the .env yourself (or run with --fake-ai to try imports
// without a key).
//
// Options: --email <address> --name <display name> --fake-ai
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const service = join(root, 'apps/recipe-service');
const envFile = join(service, '.env');

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}
const email = option('email', 'admin@example.com');
const adminName = option('name', 'Admin');
const fakeAi = process.argv.includes('--fake-ai');

function step(text) {
  console.log(`\n==> ${text}`);
}

// Runs a command in the back end folder. With `input`, writes it to stdin (used for
// the password, so it never appears in an argument or an environment variable).
function run(command, args, input) {
  return spawnSync(command, args, {
    cwd: service,
    env: { ...process.env, PYTHONUTF8: '1' },
    input,
    encoding: 'utf8',
    stdio: input === undefined ? 'inherit' : ['pipe', 'pipe', 'pipe'],
  });
}

step('Installing the back end (uv sync)');
const sync = run('uv', ['sync']);
if (sync.error || sync.status !== 0) {
  console.error(
    'uv sync failed. Is uv installed? See https://docs.astral.sh/uv/',
  );
  process.exit(1);
}

step('Creating apps/recipe-service/.env');
if (existsSync(envFile)) {
  console.log('Already there, left as it is.');
} else {
  const set = (text, key, value) =>
    text.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
  let text = readFileSync(join(service, '.env.example'), 'utf8');
  text = set(text, 'ENV', 'dev');
  text = set(text, 'JWT_SECRET', randomBytes(36).toString('base64url'));
  // The cookie is sent over plain http on localhost, which `true` would block on a phone.
  text = set(text, 'COOKIE_SECURE', 'false');
  if (fakeAi) {
    text = set(text, 'LLM_PROVIDERS', 'fake');
  }
  writeFileSync(envFile, text);
  console.log('Created, with a new random JWT_SECRET.');
}

step(`Creating the admin account (${email})`);
const password = randomBytes(12).toString('base64url');
const admin = run(
  'uv',
  [
    'run',
    'python',
    '-m',
    'app.cli',
    'create-admin',
    '--email',
    email,
    '--name',
    adminName,
    '--password-stdin',
  ],
  `${password}\n`,
);
const output = `${admin.stdout ?? ''}${admin.stderr ?? ''}`;
let passwordLine;
if (admin.status === 0) {
  passwordLine = `Password:  ${password}   (shown only now; change it in the app)`;
  console.log('Created.');
} else if (output.includes('already exists')) {
  console.log('This admin already exists, left as it is.');
} else {
  console.error(output.trim());
  process.exit(1);
}

console.log('\nSetup done. Start the app with:  npm run dev');
console.log('Then open http://localhost:4200 and log in:');
console.log(`  Email:     ${email}`);
if (passwordLine) {
  console.log(`  ${passwordLine}`);
}
if (!fakeAi) {
  console.log(
    '\nFor AI imports, add your key to apps/recipe-service/.env:  ANTHROPIC_API_KEY=...',
  );
}
