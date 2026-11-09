import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.spec.ts'],
    // The tests contain forbidden classes and colors as test strings, on purpose.
    rules: {
      'no-restricted-syntax': 'off',
      'better-tailwindcss/no-restricted-classes': 'off',
    },
  },
  {
    ignores: ['**/out-tsc'],
  },
];
