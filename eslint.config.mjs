import nx from '@nx/eslint-plugin';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';

// Optional prefixes (`md:`, `rtl:`, `[&>a]:`) and the minus sign (`-ml-2`).
const VARIANTS = String.raw`^(?:[^:]+:)*!?-?`;

// Left/right classes break in RTL. Tailwind's logical classes (ms/me/ps/pe/start/end)
// flip with `dir`, so we allow only those.
const PHYSICAL_DIRECTION = [
  'm[lr]',
  'p[lr]',
  'left',
  'right',
  'border-[lr]',
  'rounded-[lr]',
  'rounded-[tb][lr]',
  'scroll-m[lr]',
  'scroll-p[lr]',
].map((utility) => ({
  pattern: `${VARIANTS}${utility}(?:-|$)`,
  message:
    'Physical-direction utility breaks RTL: use the logical one (ms/me/ps/pe/start/end).',
}));

const PHYSICAL_KEYWORD = {
  pattern: `${VARIANTS}(?:text|float|clear)-(?:left|right)!?$`,
  message: 'Physical alignment breaks RTL: use start/end.',
};

// Custom values (`p-[13px]`, `bg-[#f00]`, `[mask:none]`) skip the design tokens, so
// they are not allowed. Brackets in a prefix (`data-[state=open]:`, `[&_svg]:`) only
// select elements, so they are allowed.
const ARBITRARY_VALUE = {
  pattern: String.raw`^(?:(?:[^:\[\]]|\[[^\]]*\])+:)*[^\[\]:]*\[[^\]]*\][^:]*$`,
  message: 'Arbitrary values bypass the design tokens: use a token utility.',
};

// A string that is a hex color, or has a 6 or 8 digit hex color inside it. A short
// `#abc` inside text is not checked, because it is often an id (`Recipe #123`).
const HEX_COLOUR = String.raw`/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$|(^|[^\w&])#([0-9a-f]{6}|[0-9a-f]{8})\b/i`;
const FUNCTIONAL_COLOUR = String.raw`/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i`;
const COLOUR_MESSAGE =
  'Colour literals belong in the theme; use a design token class instead.';
const COLOUR_SYNTAX = [HEX_COLOUR, FUNCTIONAL_COLOUR].flatMap((regex) => [
  { selector: `Literal[value=${regex}]`, message: COLOUR_MESSAGE },
  { selector: `TemplateElement[value.raw=${regex}]`, message: COLOUR_MESSAGE },
]);

// Hebrew text must be only in libs/i18n `he.json` (AD-10). Tests may check it.
const HEBREW = String.raw`/[֐-׿]/`;
const HEBREW_MESSAGE =
  'Hebrew copy belongs in libs/i18n he.json: use a t() key, or take the string as a prop.';
const HEBREW_SYNTAX = [
  `Literal[value=${HEBREW}]`,
  `TemplateElement[value.raw=${HEBREW}]`,
  `JSXText[value=${HEBREW}]`,
].map((selector) => ({ selector, message: HEBREW_MESSAGE }));
const SPEC_FILES = ['**/*.{spec,test}.{ts,tsx,js,jsx}'];
// Storybook stories show sample text, and they are never part of the app.
const STORY_FILES = ['**/*.stories.{ts,tsx}'];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/storybook-static',
      '**/src/generated',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:data-access',
                'type:ui',
                'type:domain',
                'type:i18n',
              ],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:data-access',
                'type:ui',
                'type:domain',
                'type:i18n',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:domain'],
              // Only UI: no server state, API client, routing or i18n (text comes
              // in as props).
              bannedExternalImports: [
                '@tanstack/*',
                '@hey-api/*',
                'react-router',
                'react-router/*',
                'react-router-*',
                'i18next',
                'react-i18next',
              ],
            },
            {
              // he.json, the i18next setup and the typed keys (AD-10).
              sourceTag: 'type:i18n',
              onlyDependOnLibsWithTags: [],
            },
            {
              // Workspace tools (lint tests) import no project code.
              sourceTag: 'type:tooling',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: [],
              // Plain TypeScript only: no React and no IO.
              bannedExternalImports: [
                'react',
                'react/*',
                'react-*',
                '@tanstack/*',
                '@hey-api/*',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: { 'better-tailwindcss': betterTailwindcss },
    rules: {
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [...PHYSICAL_DIRECTION, PHYSICAL_KEYWORD, ARBITRARY_VALUE],
        },
      ],
      // A later block that sets `no-restricted-syntax` replaces this list, so add to
      // the list instead.
      'no-restricted-syntax': ['error', ...COLOUR_SYNTAX, ...HEBREW_SYNTAX],
    },
  },
  {
    files: [...SPEC_FILES, ...STORY_FILES],
    // The same list without the Hebrew rule: tests search by the Hebrew text the
    // user sees, and stories show components with sample Hebrew text.
    rules: { 'no-restricted-syntax': ['error', ...COLOUR_SYNTAX] },
  },
  {
    files: ['**/*.tsx', '**/*.jsx'],
    // Use the same plugin object that Nx's react config registers. flatConfigs has a
    // copy, which ESLint rejects.
    plugins: { 'jsx-a11y': jsxA11y },
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: { 'react-hooks': reactHooks },
    // The React Compiler rules (purity, refs, immutability...), so the compiler can
    // compile the code.
    rules: reactHooks.configs['recommended-latest'].rules,
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
