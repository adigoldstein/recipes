import { ESLint, type Linter } from 'eslint';
import { join } from 'node:path';

const WORKSPACE = join(import.meta.dirname, '../../..');

const engines = new Map<string, ESLint>();

/** Lints `code` as if it were a file in `project`, with that project's real config. */
async function lint(
  project: string,
  code: string,
  file = 'src/fixture.tsx',
): Promise<Linter.LintMessage[]> {
  const cwd = join(WORKSPACE, project);
  let engine = engines.get(cwd);
  if (!engine) {
    engine = new ESLint({ cwd });
    engines.set(cwd, engine);
  }
  const [result] = await engine.lintText(code, {
    filePath: join(cwd, file),
  });
  return result.messages;
}

const rulesOf = (messages: Linter.LintMessage[]) =>
  messages.map((message) => message.ruleId);

const TAILWIND = 'better-tailwindcss/no-restricted-classes';

describe('RTL and design-token class bans', () => {
  it.each([
    'ml-2',
    'mr-auto',
    'pl-4',
    'pr-1',
    'left-0',
    'right-2',
    'text-left',
    'text-right',
    'md:-ml-2',
    'hover:pr-3',
    'border-l',
    'rounded-tr-lg',
    'ml-2!',
    'text-right!',
  ])('rejects the physical-direction utility %s', async (cls) => {
    const messages = await lint(
      'apps/web',
      `export const A = () => <div className="flex ${cls}" />;\n`,
    );
    expect(rulesOf(messages)).toEqual([TAILWIND]);
  });

  it.each(['p-[13px]', 'bg-[#ff0000]', 'w-[372px]', '[mask-type:luminance]'])(
    'rejects the arbitrary value %s inside cn()',
    async (cls) => {
      const messages = await lint(
        'apps/web',
        `declare function cn(...c: string[]): string;\nexport const A = () => <div className={cn('flex', '${cls}')} />;\n`,
      );
      // `bg-[#ff0000]` also trips the colour-literal rule.
      expect(rulesOf(messages)).toContain(TAILWIND);
    },
  );

  it.each([
    ['clsx', "clsx('flex', { 'mr-2': true })"],
    ['cva', "cva('flex', { variants: { side: { start: 'pl-2' } } })"],
  ])('rejects physical utilities inside %s()', async (callee, call) => {
    const messages = await lint(
      'libs/ui-components',
      `declare function ${callee}(...a: unknown[]): string;\nexport const c = ${call};\n`,
      'src/fixture.ts',
    );
    expect(rulesOf(messages)).toEqual([TAILWIND]);
  });

  it('rejects physical utilities in template literals', async () => {
    const messages = await lint(
      'libs/ui-components',
      'export const A = ({ on }: { on: boolean }) => <div className={`ms-2 ${on ? "pl-2" : ""}`} />;\n',
    );
    expect(rulesOf(messages)).toEqual([TAILWIND]);
  });

  it('accepts logical utilities and design tokens', async () => {
    const messages = await lint(
      'apps/web',
      'export const A = () => <div className="ms-2 me-auto ps-4 pe-1 start-0 end-2 text-start text-end md:-ms-2 border-s rounded-se-lg bg-primary p-3 data-[state=open]:bg-accent [&_svg]:size-4 has-[>svg]:ps-2" />;\n',
    );
    expect(messages).toEqual([]);
  });
});

describe('colour literals', () => {
  it.each([
    `'#ff0000'`,
    `'#FFF'`,
    '`color: rgb(1 2 3)`',
    `'rgba(0,0,0,0.5)'`,
    `'hsl(10 20% 30%)'`,
    `'oklch(0.7 0.1 30)'`,
  ])('rejects %s', async (literal) => {
    const messages = await lint(
      'libs/ui-components',
      `export const c = ${literal};\n`,
      'src/fixture.ts',
    );
    expect(rulesOf(messages)).toEqual(['no-restricted-syntax']);
  });

  it.each([`'#main'`, `'&#123;'`, `'bg-primary'`, `'Recipe #123'`])(
    'accepts the non-colour %s',
    async (literal) => {
      const messages = await lint(
        'libs/ui-components',
        `export const c = ${literal};\n`,
        'src/fixture.ts',
      );
      expect(messages).toEqual([]);
    },
  );
});

describe('Hebrew literals', () => {
  const HEBREW_RULE = ['no-restricted-syntax'];

  it.each([
    ['JSX text', 'export const A = () => <p>שלום</p>;\n'],
    ['an attribute', 'export const A = () => <p aria-label="שלום" />;\n'],
    ['a string', "export const s = 'שלום';\n"],
    ['a template literal', 'export const s = (n: number) => `${n} מנות`;\n'],
  ])('rejects Hebrew in %s outside he.json', async (_, code) => {
    expect(rulesOf(await lint('apps/web', code))).toEqual(HEBREW_RULE);
    expect(rulesOf(await lint('libs/ui-components', code))).toEqual(
      HEBREW_RULE,
    );
  });

  it('allows Hebrew in spec files, which assert on the rendered copy', async () => {
    const messages = await lint(
      'apps/web',
      "export const A = () => <p>שלום</p>;\nexport const s = 'שלום';\n",
      'src/fixture.spec.tsx',
    );
    expect(messages).toEqual([]);
  });

  it('allows Hebrew sample copy in Storybook stories', async () => {
    const messages = await lint(
      'libs/ui-components',
      'export const A = () => <p>שלום</p>;\n',
      'src/fixture.stories.tsx',
    );
    expect(messages).toEqual([]);
  });

  it('keeps colour literals banned in stories', async () => {
    const messages = await lint(
      'libs/ui-components',
      "export const c = '#ff0000';\n",
      'src/fixture.stories.tsx',
    );
    expect(rulesOf(messages)).toEqual(['no-restricted-syntax']);
  });

  it('keeps colour literals banned in spec files', async () => {
    const messages = await lint(
      'apps/web',
      "export const c = '#ff0000';\n",
      'src/fixture.spec.ts',
    );
    expect(rulesOf(messages)).toEqual(['no-restricted-syntax']);
  });

  it('accepts translated copy', async () => {
    const messages = await lint(
      'apps/web',
      "declare function t(key: string): string;\nexport const A = () => <p>{t('home.title')}</p>;\n",
    );
    expect(messages).toEqual([]);
  });
});

describe('style prop', () => {
  const code =
    'import type { FC } from "react";\nexport const A = ({ C }: { C: FC<{ style?: object }> }) => <><div style={{}} /><C style={{}} /></>;\n';

  it('is banned on DOM nodes and components in ui-components', async () => {
    const messages = await lint('libs/ui-components', code);
    expect(rulesOf(messages)).toEqual([
      'react/forbid-dom-props',
      'react/forbid-component-props',
    ]);
  });

  it('stays allowed in the app shell', async () => {
    expect(await lint('apps/web', code)).toEqual([]);
  });
});

describe('accessibility and React Compiler rules', () => {
  it('enforces jsx-a11y as errors', async () => {
    const messages = await lint(
      'libs/ui-components',
      'export const A = () => <img src="x.png" />;\n',
    );
    expect(messages.map((m) => [m.ruleId, m.severity])).toEqual([
      ['jsx-a11y/alt-text', 2],
    ]);
  });

  it('accepts accessible markup and pure components', async () => {
    const messages = await lint(
      'libs/ui-components',
      'export function A({ src }: { src: string }) {\n  return <img src={src} alt="" />;\n}\n',
    );
    expect(messages).toEqual([]);
  });

  it('enforces the compiler-era hooks rules', async () => {
    const messages = await lint(
      'apps/web',
      'export function A() {\n  const now = Date.now();\n  return <p>{now}</p>;\n}\n',
    );
    expect(rulesOf(messages)).toEqual(['react-hooks/purity']);
  });
});

describe('module boundaries', () => {
  const BOUNDARIES = '@nx/enforce-module-boundaries';

  it.each([
    ['libs/ui-components', '@bite-and-board/data-access'],
    ['libs/ui-components', 'react-router'],
    ['libs/ui-components', '@bite-and-board/i18n'],
    ['libs/ui-components', 'react-i18next'],
    ['libs/ui-components', 'i18next'],
    ['libs/i18n', '@bite-and-board/recipe-domain'],
    ['libs/recipe-domain', 'react'],
  ])('%s may not import %s', async (project, target) => {
    const messages = await lint(
      project,
      `import * as dep from '${target}';\nexport const x = dep;\n`,
      'src/fixture.ts',
    );
    expect(rulesOf(messages)).toEqual([BOUNDARIES]);
  });

  it.each([
    ['libs/ui-components', '@bite-and-board/recipe-domain'],
    ['apps/web', '@bite-and-board/ui-components'],
    ['apps/web', '@bite-and-board/i18n'],
  ])('%s may import %s', async (project, target) => {
    const messages = await lint(
      project,
      `import * as dep from '${target}';\nexport const x = dep;\n`,
      'src/fixture.ts',
    );
    expect(messages).toEqual([]);
  });

  it('keeps feature libs from importing each other', async () => {
    // No feature lib exists yet to lint against, so assert the constraint itself.
    const engine = new ESLint({ cwd: join(WORKSPACE, 'apps/web') });
    const config = await engine.calculateConfigForFile(
      join(WORKSPACE, 'apps/web/src/main.tsx'),
    );
    const [, { depConstraints }] = config.rules[BOUNDARIES];
    const feature = depConstraints.find(
      (c: { sourceTag: string }) => c.sourceTag === 'type:feature',
    );
    expect(feature.onlyDependOnLibsWithTags).toEqual([
      'type:data-access',
      'type:ui',
      'type:domain',
      'type:i18n',
    ]);
  });
});
