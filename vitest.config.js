/**
 * VITEST CONFIGURATION
 * Конфигурация для юнит-тестирования проекта Flipbook
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // ═══════════════════════════════════════════════════════════
    // ENVIRONMENT
    // ═══════════════════════════════════════════════════════════

    // jsdom для эмуляции браузерного окружения
    environment: 'jsdom',

    // Глобальные переменные (describe, it, expect, vi)
    globals: true,

    // Setup файл с моками
    setupFiles: ['./tests/setup.js'],

    // ═══════════════════════════════════════════════════════════
    // TEST FILES
    // ═══════════════════════════════════════════════════════════

    // Паттерны для поиска тестов
    include: ['tests/**/*.test.js'],

    // Исключения
    exclude: ['node_modules', 'dist'],

    // ═══════════════════════════════════════════════════════════
    // COVERAGE
    // ═══════════════════════════════════════════════════════════

    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Файлы для покрытия
      include: [
        'js/utils/**/*.js',
        'js/managers/**/*.js',
        'js/core/**/*.js',
        'js/admin/**/*.js',
      ],

      // Исключения
      exclude: [
        'js/**/index.js',
        'js/config.js',
      ],

      // Пороговые значения покрытия
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
        'js/admin/**/*.js': {
          statements: 60,
          branches: 50,
          functions: 60,
          lines: 60,
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    // ISOLATION & PERFORMANCE
    // ═══════════════════════════════════════════════════════════

    // Изоляция тестов
    isolate: true,

    // Автоматическое восстановление моков
    restoreMocks: true,

    // Очистка моков между тестами
    clearMocks: true,

    // Таймауты
    testTimeout: 10000,
    hookTimeout: 10000,

    // Ограничение параллелизма: jsdom-окружения потребляют много памяти,
    // при запуске всех 148 файлов без лимита воркеры не успевают инициализироваться
    pool: 'forks',
    maxWorkers: 4,

    // ═══════════════════════════════════════════════════════════
    // REPORTING
    // ═══════════════════════════════════════════════════════════

    // Репортер для вывода
    reporters: ['default'],

    // Показывать причину пропуска тестов
    passWithNoTests: false,
  },

  // ═══════════════════════════════════════════════════════════
  // PATH ALIASES
  // ═══════════════════════════════════════════════════════════

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
