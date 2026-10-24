import javascript from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import typescript from 'typescript-eslint';

/** Enforces correctness with type information while Prettier owns formatting. */
export default defineConfig(
  globalIgnores(['dist/', '.cache/', 'test-results/', 'playwright-report/', 'validation/']),
  {
    files: ['**/*.mjs'],
    extends: [javascript.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.ts'],
    extends: [
      javascript.configs.recommended,
      typescript.configs.strictTypeChecked,
      typescript.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/strict-boolean-expressions': 'error',
      eqeqeq: ['error', 'always'],
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implicit-coercion': 'error',
      'no-param-reassign': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  prettier,
  { rules: { curly: ['error', 'all'] } },
);
