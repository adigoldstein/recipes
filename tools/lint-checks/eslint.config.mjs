import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.spec.ts'],
    // The specs hold forbidden classes and colours as fixture strings on purpose.
    rules: {
      'no-restricted-syntax': 'off',
      'better-tailwindcss/no-restricted-classes': 'off',
    },
  },
  {
    ignores: ['**/out-tsc'],
  },
];
