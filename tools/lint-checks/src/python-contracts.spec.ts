import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SERVICE = join(import.meta.dirname, '../../../apps/recipe-service');

function uv(args: string[], cwd: string) {
  const result = spawnSync('uv', ['run', '--project', SERVICE, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONUTF8: '1' },
  });
  // A missing uv must fail loudly, not pass every "exits non-zero" check.
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}

let workdir: string;

beforeEach(() => {
  // A scratch copy of the real `app` package, so fixtures never touch the source.
  workdir = mkdtempSync(join(tmpdir(), 'lint-checks-'));
  cpSync(join(SERVICE, 'app'), join(workdir, 'app'), {
    recursive: true,
    filter: (source) => !source.includes('__pycache__'),
  });
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function lintImports(files: Record<string, string>) {
  for (const [path, code] of Object.entries(files)) {
    writeFileSync(join(workdir, 'app', path), code);
  }
  return uv(
    ['lint-imports', '--no-cache', '--config', join(SERVICE, 'pyproject.toml')],
    workdir,
  );
}

const importing = (module: string, name: string) =>
  `from app.${module} import ${name}  # noqa: F401\n`;

describe('import-linter contracts', () => {
  it('pass on the untouched app', () => {
    expect(lintImports({}).status).toBe(0);
  });

  it('allow the full router -> service -> repository -> models chain', () => {
    expect(
      lintImports({
        'recipes/router.py': importing('recipes', 'service'),
        'recipes/service.py': importing('recipes', 'repository'),
        'recipes/repository.py': importing('recipes', 'models'),
      }).status,
    ).toBe(0);
  });

  it('reject a router that skips the service layer', () => {
    const { status, output } = lintImports({
      'recipes/router.py': importing('recipes', 'repository'),
    });
    expect(status).not.toBe(0);
    expect(output).toContain('Routers never reach the repository or models');
  });

  it.each([
    ['repository', 'service'],
    ['models', 'repository'],
    ['service', 'router'],
  ])('reject %s importing its own %s (upward)', (from, target) => {
    const { status, output } = lintImports({
      [`recipes/${from}.py`]: importing('recipes', target),
    });
    expect(status).not.toBe(0);
    expect(output).toContain('Feature layers point down');
  });

  it("reject reaching into another module's repository", () => {
    const { status, output } = lintImports({
      'recipes/service.py': importing('tags', 'repository'),
    });
    expect(status).not.toBe(0);
    expect(output).toContain('tags: router, repository and models are private');
  });

  it('allow using the public schemas of tags and photos', () => {
    expect(
      lintImports({
        'recipes/schemas.py':
          importing('tags', 'schemas') + importing('photos', 'schemas'),
      }).status,
    ).toBe(0);
  });

  it("allow calling another module's service", () => {
    expect(
      lintImports({ 'recipes/service.py': importing('tags', 'service') })
        .status,
    ).toBe(0);
  });

  it.each([
    ['tags', 'recipes', 'tags depends on no other catalogue module'],
    ['photos', 'recipes', 'photos depends on no other catalogue module'],
    ['recipes', 'imports', 'recipes does not depend on imports'],
    ['imports', 'recipes', 'imports depends only on tags'],
    ['imports', 'photos', 'imports depends only on tags'],
  ])('reject %s depending on %s', (from, target, contract) => {
    const { status, output } = lintImports({
      [`${from}/service.py`]: importing(target, 'service'),
    });
    expect(status).not.toBe(0);
    expect(output).toContain(contract);
  });

  it('reject core depending on a feature module', () => {
    const { status, output } = lintImports({
      'core/errors.py': importing('recipes', 'service'),
    });
    expect(status).not.toBe(0);
    expect(output).toContain('core depends on no feature module');
  });
});

describe('mypy strict', () => {
  function mypy(code: string) {
    const file = join(workdir, 'app', 'fixture.py');
    writeFileSync(file, code);
    return uv(
      ['mypy', '--config-file', join(SERVICE, 'pyproject.toml'), file],
      workdir,
    );
  }

  it('rejects an unannotated function', () => {
    const { status, output } = mypy('def f(x):\n    return x\n');
    expect(status).not.toBe(0);
    expect(output).toContain('[no-untyped-def]');
  });

  it('accepts an annotated function', () => {
    expect(mypy('def f(x: int) -> int:\n    return x\n').status).toBe(0);
  });
});
