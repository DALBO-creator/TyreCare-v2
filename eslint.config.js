import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dev-dist/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      'supabase/functions/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/api/**/*.ts', '*.config.{js,ts}', '**/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // Deve restare ultimo: disattiva le regole di stile che confliggono con Prettier
  prettier,
);
