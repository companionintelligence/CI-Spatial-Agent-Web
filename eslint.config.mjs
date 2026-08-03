import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

/**
 * Flat ESLint config for the whole monorepo.
 *
 * There is a single config at the repo root rather than one per workspace
 * project: ESLint 9 walks up from the working directory to find it, so each
 * project's `eslint .` (run by `pnpm -r lint`) picks this up and lints only its
 * own subtree. `files` globs below are relative to this file, so they can be
 * written as full workspace paths.
 *
 * Linting is deliberately *not* type-aware (`tseslint.configs.recommended`, not
 * `recommendedTypeChecked`). Type errors are already caught by `tsc -b` in the
 * web build and in CI; adding a second, much slower type-aware pass over four
 * tsconfigs would duplicate that for little gain.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/storybook-static/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      'apps/*/public/**',
      'assets/**',
    ],
  },

  // Baseline for every linted file in the repo.
  {
    files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // The codebase leans on leading-underscore names to mark deliberately
      // unused bindings (unused React props, positional callback args, caught
      // errors that are intentionally swallowed).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },

  // Browser + React application/library code.
  {
    files: [
      'packages/core/src/**/*.{ts,tsx}',
      'apps/web/src/**/*.{ts,tsx}',
      'apps/vision-pro/src/**/*.{ts,tsx}',
    ],
    extends: [reactHooks.configs['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // Storybook stories intentionally export a `meta` default plus story objects,
  // which is exactly what react-refresh's component-only rule forbids. The rule
  // protects HMR boundaries in app code; stories are not app modules.
  {
    files: ['**/*.stories.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Node-side code: the BFF proxy, build/tooling scripts, and config files.
  {
    files: [
      'apps/proxy/**/*.ts',
      'scripts/**/*.mjs',
      'pipeline/**/*.mjs',
      'tests/**/*.mjs',
      '*.config.{ts,js,mjs}',
      'playwright.config*.ts',
      'apps/*/vite.config.ts',
      'apps/*/vitest.config.ts',
      'apps/*/*.config.js',
      'apps/web/.storybook/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Test code. Vitest runs with `globals: true`, and the jsdom projects get
  // both DOM and Node globals.
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', 'vitest.setup.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ...globals.vitest },
    },
  },
)
