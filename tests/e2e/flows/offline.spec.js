/**
 * E2E TESTS: OFFLINE & ERROR SCENARIOS (Фаза 4)
 *
 * Тесты поведения клиента при сбоях сети и ошибках API.
 * Используют Playwright route interception (моки API), без реального бэкенда.
 */

import { test, expect } from '@playwright/test';

test.describe('Offline & Error Scenarios', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: API health check failure → fallback to localStorage
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Server unavailable fallback', () => {
    test('should fallback to localStorage mode when /api/health fails', async ({ page }) => {
      // Перехватываем health endpoint — сервер недоступен
      await page.route('**/api/health', route =>
        route.abort('connectionrefused')
      );

      await page.goto('/');

      // Приложение должно загрузиться без ошибок (fallback)
      // Книжная полка или книга показаны из localStorage
      await expect(page.locator('body')).toBeVisible();
      // Не должно быть критической ошибки
      await expect(page.locator('#errorMessage')).toBeHidden();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Network error during API calls → retry behavior
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('API retry on server error', () => {
    test('should retry on 503 and succeed on second attempt', async ({ page }) => {
      let callCount = 0;

      // Первый вызов /api/books — 503, второй — успех
      await page.route('**/api/books', route => {
        callCount++;
        if (callCount === 1) {
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Service Unavailable' }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      // Мокаем остальные API для auth-flow
      await page.route('**/api/health', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' })
      );
      await page.route('**/api/auth/me', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 'test', email: 'test@test.com' } }),
        })
      );

      await page.goto('/');

      // Wait for retry to succeed (second call returns 200)
      await page.waitForResponse(
        resp => resp.url().includes('/api/books') && resp.status() === 200
      );

      // Было минимум 2 вызова (первый 503, второй 200)
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    test('should not retry on 404 client error', async ({ page }) => {
      let callCount = 0;

      await page.route('**/api/health', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' })
      );
      await page.route('**/api/auth/me', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 'test', email: 'test@test.com' } }),
        })
      );

      // Мокаем прогресс — 404 (нет прогресса, это нормально)
      await page.route('**/api/books/*/progress', route => {
        callCount++;
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not found' }),
        });
      });

      // Мокаем книги — пустой список (не попадём до progress)
      await page.route('**/api/books', route => {
        if (route.request().method() === 'GET') {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{ id: 'b1', title: 'Test', author: 'A', chaptersCount: 1 }]),
          });
        }
        return route.continue();
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // 404 не должен вызывать retry — максимум 1 вызов
      expect(callCount).toBeLessThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: 401 Unauthorized → auth modal
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Authentication flow', () => {
    test('should show auth modal when not authenticated', async ({ page }) => {
      await page.route('**/api/health', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' })
      );
      await page.route('**/api/auth/me', route =>
        route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' })
      );

      await page.goto('/');

      // Должна появиться модалка авторизации
      const authModal = page.locator('#auth-modal, .auth-modal, [data-auth-modal]');
      await expect(authModal).toBeVisible({ timeout: 5000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: Sync indicator states
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Sync indicator', () => {
    test('should have sync indicator element in DOM', async ({ page }) => {
      // Проверяем, что элемент индикатора существует
      await page.route('**/api/health', route =>
        route.abort('connectionrefused')
      );
      await page.goto('/');

      const indicator = page.locator('#sync-indicator');
      // Элемент должен существовать, но быть скрыт (hidden)
      await expect(indicator).toHaveCount(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: Network abort during fetch
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Network failures', () => {
    test('should handle network abort gracefully', async ({ page }) => {
      await page.route('**/api/health', route =>
        route.abort('failed')
      );

      await page.goto('/');

      // Приложение должно загрузиться в fallback-режиме без крашей
      await expect(page.locator('body')).toBeVisible();
      // Консоль может содержать предупреждения, но не uncaught errors
    });
  });
});
