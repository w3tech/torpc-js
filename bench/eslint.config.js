// Flat config (ESLint 9+). Mirrors the Codacy default ruleset for TypeScript:
//   - typescript-eslint  ≈ ErrorProne / BestPractice
//   - eslint-plugin-security ≈ Security
//   - eslint-plugin-sonarjs ≈ BestPractice + Complexity
//   - eslint-config-prettier turns off stylistic rules so Prettier owns CodeStyle.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'results/**',
      'fixtures/**',
      'pnpm-lock.yaml',
      'node_modules/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  sonarjs.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        NodeJS: 'readonly',
      },
    },
    rules: {
      // bench loops over fixtures by design; await-in-loop is intentional
      'no-await-in-loop': 'off',
      // numbers in CSVs / token counts are inherently magic; rule fires on every row
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      // bench prints tables to stdout
      'no-console': 'off',
      // High-complexity runner/aggregation functions in count-tokens.ts and
      // run-bench.ts are legit debt (table-building, multi-format loops). Flagged
      // as warn so it's visible without blocking; refactor in a follow-up.
      'sonarjs/cognitive-complexity': ['warn', 50],
      // Regex slowness on internal bench inputs is not exploitable. Keep visible.
      'sonarjs/slow-regex': 'warn',
    },
  },
];
