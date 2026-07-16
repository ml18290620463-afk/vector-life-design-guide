import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import unusedImports from 'eslint-plugin-unused-imports';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const browserGlobals = globals.browser ?? {};
const nodeGlobals = globals.node ?? {};

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'storybook-static/**',
      '.git/**',
      'app/**',
      'backups/**',
      // Node-only build / tooling scripts. They run via `node` (or
      // `tsx`) outside the browser environment and use `process.*`
      // freely; running the same TS/JSX rule set against them adds
      // no signal and tripped `no-undef` warnings.
      'scripts/**',
      // CommonJS tool configs (commitlint, eventual prettier or
      // postcss configs). They use `module.exports` which the
      // browser-flavoured rule set flags as `no-undef`.
      '**/*.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      'unused-imports': unusedImports,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      // Project-specific tweaks: many decorative spans are intentionally
      // styled-only and have no semantic role; we keep recommended set but
      // turn off two rules that produce a high false-positive rate against
      // the existing UI without adding accessibility value.
      // autoFocus on modal-input combinations is intentional UX in this app;
      // reviewers should still call it out manually for non-modal cases.
      'jsx-a11y/no-autofocus': 'off',
      // Phase 2 §2.f — keep the soft 600-line ceiling visible while we
      // refactor the four 800–1300 line legacy components down toward
      // 350. Phase 3 ratchets this to error/400 once Viewer / Dashboard /
      // MasterLock / SettingsPanel are split.
      'max-lines': ['warn', { max: 600, skipBlankLines: true, skipComments: true }],
      // Phase 2 §F1.5 — re-open Phase 1's jsx-a11y mutes. We keep them
      // at `warn` so existing legacy violations show up in CI logs and
      // become visible during component splits, but they do not block
      // `--max-warnings=0` because the four giant components still have
      // file-scoped `max-lines` overrides anyway. The matching task in
      // ROADMAP §跨阶段 lifts these to `error` per file as soon as the
      // file's interactive surface is rewritten.
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unknown-property': 'off',
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      // Local unused vars/args are intentionally tolerated here; they live in
      // legacy components scheduled for stage D refactor. We still keep the
      // import-side rule strict so dead imports never accumulate again.
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
      'no-control-regex': 'off',
      'no-undef': 'off',
      // Phase 3 §3.a-2 — design-token migration scoreboard.
      // Status: `off` (infrastructure only). Engineers run
      // `npm run lint:tokens` to surface the current backlog of raw
      // hex / rgba literals that should eventually move to
      // `lib/designTokens.ts`. ROADMAP says "warn first, error last";
      // we will flip this rule to `warn` per directory in follow-up
      // commits (`components/CoverScreen` first, then Master, then
      // the rest of `components/`, then everywhere).
      'no-restricted-syntax': 'off',
    },
  },
  // Phase 2 §2.g–§2.m + §2.l: every legacy component (Viewer,
  // Dashboard, MasterLock, SettingsPanel, ArchiveVault, StatisticsWidget)
  // has been split below the 350-LOC target with its jsx-a11y
  // violations resolved. The previous file-scoped `max-lines: off` /
  // four jsx-a11y `off` overrides have been retired in their entirety;
  // the codebase now lives under one uniform rule set.
  // Phase 4.5 §E — locale dictionaries are pure data tables; the
  // 600-line LOC ceiling doesn't make sense for a `key: value` map
  // that grows with every feature. We exempt them rather than
  // sharding into language modules (single-import simplicity wins
  // for a translation file).
  {
    files: ['i18n/locales/**/*.ts'],
    rules: {
      'max-lines': 'off',
    },
  },
  // Cover hero is a dense single-screen composition; splitting would churn
  // layout timing. Keep lint strict elsewhere; exempt only this file.
  {
    files: ['components/CoverScreen.tsx', 'components/KleinBottleFoldSpace.tsx'],
    rules: {
      'max-lines': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
  },
  prettier,
];
