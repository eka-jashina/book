import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,

  {
    files: ['js/**/*.js'],

    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },

    rules: {
      // ── Возможные ошибки ──────────────────────────────
      'no-constant-binary-expression': 'error',
      'no-constructor-return': 'error',
      'no-duplicate-imports': 'error',
      'no-promise-executor-return': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',

      // ── Качество кода ─────────────────────────────────
      'eqeqeq': ['error', 'always'],
      'no-caller': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-floating-decimal': 'error',
      'no-lone-blocks': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-var': 'error',
      'prefer-template': 'warn',

      // ── Проект использует console.log/warn/error ──────
      'no-console': 'off',

      // ── Неиспользуемые переменные: игнорируем _ и rest ─
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
    },
  },

  // Конфигурация для Vite и конфигурационных файлов
  {
    files: ['vite.config.js', 'postcss.config.js', 'vitest.config.js', 'playwright.config.js', 'eslint.config.js', 'vite-plugin-*.js'],

    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },

  // Исключения
  {
    ignores: ['dist/', 'node_modules/', 'docs/', 'coverage/', 'public/'],
  },
];
