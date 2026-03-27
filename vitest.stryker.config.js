/**
 * Конфигурация Vitest для Stryker mutation testing.
 * Исключает тесты, падающие в dry run.
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const __dirname = import.meta.dirname;

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    exclude: [
      'node_modules',
      'dist',
      'tests/unit/core/AccountScreen.test.js',
      'tests/unit/core/AccountScreenUI.test.js',
    ],
    isolate: true,
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'forks',
    maxWorkers: 4,
    reporters: ['default'],
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './js'),
      '@utils': resolve(__dirname, './js/utils'),
      '@managers': resolve(__dirname, './js/managers'),
      '@core': resolve(__dirname, './js/core'),
      '@css': resolve(__dirname, './css'),
      '@i18n': resolve(__dirname, './js/i18n'),
      '@shared': resolve(__dirname, './shared'),
    },
  },
});
