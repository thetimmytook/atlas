import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import { flatConfigs as importConfigs } from 'eslint-plugin-import-x';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import type { Linter } from 'eslint';

const codeFiles = ['**/*.{ts,mts,js,mjs}'];
const typedFiles = ['src/**/*.{ts,mts}'];
const sonarjsRecommended = sonarjs.configs?.recommended;

if (!sonarjsRecommended) {
  throw new Error('SonarJS recommended config is unavailable.');
}

export default defineConfig([
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '.husky/**'] },
  {
    files: codeFiles,
    extends: [
      js.configs.recommended,
      sonarjsRecommended as Linter.Config,
      security.configs.recommended,
      importConfigs.recommended,
    ],
    rules: {
      curly: ['error', 'all'],
      'import-x/no-duplicates': 'error',
      'import-x/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'sonarjs/no-duplicate-string': 'warn',
      'security/detect-object-injection': 'warn',
    },
  },
  {
    files: typedFiles,
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true } },
    settings: {
      'import-x/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      'import-x/no-unresolved': ['error', { ignore: ['\\.html\\?raw$'] }],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: false,
          allowDirectConstAssertionInArrowFunctions: false,
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/only-throw-error': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,mts,js,mjs}'],
    languageOptions: { globals: globals.browser },
    rules: {
      'import-x/no-nodejs-modules': 'error',
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: false }],
    },
  },
  {
    files: ['*.config.mts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: { project: './tsconfig.tooling.json' },
    },
    settings: { 'import-x/resolver': { typescript: { project: './tsconfig.tooling.json' } } },
  },
  prettier,
  {
    files: codeFiles,
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/lines-around-comment': [
        'error',
        {
          beforeBlockComment: true,
          beforeLineComment: true,
          allowBlockStart: true,
          allowClassStart: true,
          allowObjectStart: true,
          allowArrayStart: true,
          allowInterfaceStart: true,
          allowTypeStart: true,
          allowEnumStart: true,
          allowModuleStart: true,
        },
      ],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'if' },
        { blankLine: 'always', prev: 'if', next: '*' },
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
    },
  },
]);
