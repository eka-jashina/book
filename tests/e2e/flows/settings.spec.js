/**
 * E2E ТЕСТЫ: НАСТРОЙКИ
 * Тесты шрифтов, тем, звука и ambient настроек
 */

import { test, expect, clearStorage, setStoredSettings, getStoredSettings, testData } from '../fixtures/book.fixture.js';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FONT SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Font Settings', () => {
    test('should open and close settings panel', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      expect(await settings.isOpen()).toBe(false);

      await settings.open();
      expect(await settings.isOpen()).toBe(true);

      await settings.close();
      expect(await settings.isOpen()).toBe(false);
    });

    test('should increase font size', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();
      const sizeBefore = await settings.getFontSize();

      await settings.increaseFontSize();
      const sizeAfter = await settings.getFontSize();

      expect(sizeAfter).toBe(sizeBefore + 1);
    });

    test('should decrease font size', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();

      // Сначала увеличиваем, чтобы можно было уменьшить
      await settings.increaseFontSize();
      const sizeBefore = await settings.getFontSize();

      await settings.decreaseFontSize();
      const sizeAfter = await settings.getFontSize();

      expect(sizeAfter).toBe(sizeBefore - 1);
    });

    test('should not exceed max font size', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setFontSize(testData.fontSizes.max);
      await settings.increaseFontSize();

      const size = await settings.getFontSize();
      expect(size).toBe(testData.fontSizes.max);
    });

    test('should not go below min font size', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setFontSize(testData.fontSizes.min);
      await settings.decreaseFontSize();

      const size = await settings.getFontSize();
      expect(size).toBe(testData.fontSizes.min);
    });

    test('should change font family', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setFont('merriweather');

      // Проверяем, что шрифт применён к контенту
      const fontFamily = await page.locator('.page-content').evaluate(el =>
        getComputedStyle(el).fontFamily
      );
      expect(fontFamily.toLowerCase()).toContain('merriweather');
    });

    test('font size change should repaginate', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pagesBefore = await bookPage.getTotalPages();

      // Значительно увеличиваем размер шрифта
      await settings.setFontSize(testData.fontSizes.max);

      const pagesAfter = await bookPage.getTotalPages();

      // С большим шрифтом страниц больше
      expect(pagesAfter).toBeGreaterThanOrEqual(pagesBefore);
    });

    test('font settings should persist', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setFont('literata');
      await settings.setFontSize(20);

      // Перезагрузка
      await page.reload();
      await page.waitForLoadState('networkidle');
      await bookPage.openByCover();

      await settings.open();
      expect(await settings.getFont()).toBe('literata');
      expect(await settings.getFontSize()).toBe(20);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // THEME SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Theme Settings', () => {
    test('should switch to dark theme', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setTheme('dark');

      const theme = await page.locator('html').getAttribute('data-theme');
      expect(theme).toBe('dark');
    });

    test('should switch to bw theme', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setTheme('bw');

      const theme = await page.locator('html').getAttribute('data-theme');
      expect(theme).toBe('bw');
    });

    test('should switch back to light theme', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setTheme('dark');
      await settings.setTheme('light');

      const theme = await page.locator('html').getAttribute('data-theme');
      expect(theme).toBe('light');
    });

    test('theme buttons should show active state', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();

      // Изначально активна светлая тема
      expect(await settings.isThemeActive('light')).toBe(true);
      expect(await settings.isThemeActive('dark')).toBe(false);

      // Переключаем на тёмную
      await settings.setTheme('dark');
      expect(await settings.isThemeActive('light')).toBe(false);
      expect(await settings.isThemeActive('dark')).toBe(true);
    });

    test('theme should persist after reload', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setTheme('dark');

      await page.reload();
      await page.waitForLoadState('networkidle');

      const theme = await page.locator('html').getAttribute('data-theme');
      expect(theme).toBe('dark');
    });

    test('theme should apply correct colors', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Светлая тема
      await settings.setTheme('light');
      const lightBg = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim()
      );

      // Тёмная тема
      await settings.setTheme('dark');
      const darkBg = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim()
      );

      // Цвета должны отличаться
      expect(lightBg).not.toBe(darkBg);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SOUND SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Sound Settings', () => {
    test('should toggle sound on/off', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();

      // Изначально включён
      expect(await settings.isSoundEnabled()).toBe(true);

      // Выключаем
      await settings.toggleSound();
      expect(await settings.isSoundEnabled()).toBe(false);

      // Включаем снова
      await settings.toggleSound();
      expect(await settings.isSoundEnabled()).toBe(true);
    });

    test('volume control should be disabled when sound is off', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();
      await settings.disableSound();

      const volumeControl = page.locator('#page-volume-control');
      await expect(volumeControl).toHaveClass(/disabled/);
    });

    test('should adjust sound volume', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();
      await settings.setSoundVolume(75);

      const volume = await settings.getSoundVolume();
      expect(volume).toBe(75);
    });

    test('sound settings should persist', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.disableSound();
      await settings.setSoundVolume(25);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await bookPage.openByCover();

      await settings.open();
      expect(await settings.isSoundEnabled()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AMBIENT SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Ambient Settings', () => {
    test('should select ambient type', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setAmbientType('rain');

      expect(await settings.getAmbientType()).toBe('rain');
    });

    test('should show volume slider when ambient is active', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();

      // Изначально ambient выключен
      await settings.setAmbientType('none');
      expect(await settings.isAmbientVolumeVisible()).toBe(false);

      // Выбираем ambient
      await settings.setAmbientType('fireplace');
      expect(await settings.isAmbientVolumeVisible()).toBe(true);
    });

    test('should hide volume slider when ambient is none', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setAmbientType('rain');
      await settings.setAmbientType('none');

      expect(await settings.isAmbientVolumeVisible()).toBe(false);
    });

    test('should adjust ambient volume', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setAmbientType('cafe');
      await settings.setAmbientVolume(60);

      expect(await settings.getAmbientVolume()).toBe(60);
    });

    test('ambient settings should persist', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.setAmbientType('rain');
      await settings.setAmbientVolume(40);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await bookPage.openByCover();

      await settings.open();
      expect(await settings.getAmbientType()).toBe('rain');
    });

    test('switching ambient types should update active state', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();

      // Выбираем дождь
      await settings.setAmbientType('rain');
      await expect(page.locator('[data-type="rain"]')).toHaveAttribute('data-active', 'true');
      await expect(page.locator('[data-type="fireplace"]')).toHaveAttribute('data-active', 'false');

      // Переключаем на камин
      await settings.setAmbientType('fireplace');
      await expect(page.locator('[data-type="rain"]')).toHaveAttribute('data-active', 'false');
      await expect(page.locator('[data-type="fireplace"]')).toHaveAttribute('data-active', 'true');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Settings Persistence', () => {
    test('all settings should persist together', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Устанавливаем все настройки
      await settings.setFont('lora');
      await settings.setFontSize(20);
      await settings.setTheme('dark');
      await settings.disableSound();
      await settings.setAmbientType('rain');

      // Перезагрузка
      await page.reload();
      await page.waitForLoadState('networkidle');
      await bookPage.openByCover();

      // Проверяем все настройки
      await settings.open();
      expect(await settings.getFont()).toBe('lora');
      expect(await settings.getFontSize()).toBe(20);
      expect(await settings.getTheme()).toBe('dark');
      expect(await settings.isSoundEnabled()).toBe(false);
      expect(await settings.getAmbientType()).toBe('rain');
    });

    test('should handle corrupted localStorage gracefully', async ({ bookPage, page }) => {
      // Устанавливаем повреждённые данные
      await page.addInitScript(() => {
        localStorage.setItem('reader-settings', 'invalid{json');
      });

      await bookPage.goto();

      // Должно загрузиться с настройками по умолчанию
      await expect(bookPage.book).toBeVisible();
    });

    test('should use stored settings on load', async ({ bookPage, settings, page }) => {
      await setStoredSettings(page, {
        font: 'literata',
        fontSize: 16,
        theme: 'bw',
        page: 0,
      });

      await bookPage.goto();
      await bookPage.openByCover();

      await settings.open();
      expect(await settings.getFont()).toBe('literata');
      expect(await settings.getFontSize()).toBe(16);
      expect(await settings.getTheme()).toBe('bw');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBUG PANEL
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Debug Panel', () => {
    test('should toggle debug panel', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      expect(await settings.isDebugVisible()).toBe(false);

      await settings.toggleDebug();
      expect(await settings.isDebugVisible()).toBe(true);

      await settings.toggleDebug();
      expect(await settings.isDebugVisible()).toBe(false);
    });

    test('debug panel should show state info', async ({ bookPage, settings, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await settings.toggleDebug();

      const debugInfo = page.locator('.debug-info');
      await expect(debugInfo).toBeVisible();
      await expect(debugInfo).toContainText(/state|page|cache/i);
    });
  });
});
