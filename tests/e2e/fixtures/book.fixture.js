/**
 * ФИКСТУРЫ КНИГИ
 * Тестовые фикстуры и хелперы для E2E тестов книги
 */

import { test as base, expect } from '@playwright/test';
import { BookPage } from '../pages/BookPage.js';
import { SettingsPanel } from '../pages/SettingsPanel.js';

/**
 * Extended test fixture with BookPage and SettingsPanel
 */
export const test = base.extend({
  /**
   * BookPage instance
   */
  bookPage: async ({ page }, use) => {
    const bookPage = new BookPage(page);
    await use(bookPage);
  },

  /**
   * SettingsPanel instance
   */
  settings: async ({ page }, use) => {
    const settings = new SettingsPanel(page);
    await use(settings);
  },

  /**
   * Pre-opened book fixture
   */
  openedBook: async ({ page }, use) => {
    const bookPage = new BookPage(page);
    await bookPage.goto();
    await bookPage.openByCover();
    await use(bookPage);
  },
});

export { expect };

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clear localStorage before test
 * @param {import('@playwright/test').Page} page
 */
export async function clearStorage(page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Set localStorage values before navigation
 * @param {import('@playwright/test').Page} page
 * @param {object} settings
 */
export async function setStoredSettings(page, settings) {
  await page.addInitScript((settingsStr) => {
    localStorage.setItem('reader-settings', settingsStr);
  }, JSON.stringify(settings));
}

/**
 * Get stored settings from localStorage
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<object|null>}
 */
export async function getStoredSettings(page) {
  return await page.evaluate(() => {
    const stored = localStorage.getItem('reader-settings');
    return stored ? JSON.parse(stored) : null;
  });
}

/**
 * Wait for CSS animations to complete
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout
 */
export async function waitForAnimations(page, timeout = 5000) {
  // Wait for book animation to complete (state returns to 'opened')
  await page.waitForFunction(
    () => document.querySelector('.book')?.getAttribute('data-state') === 'opened',
    { timeout }
  );
}

/**
 * Capture performance metrics
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<object>}
 */
export async function getPerformanceMetrics(page) {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const memory = performance.memory;

    return {
      loadTime: navigation?.loadEventEnd - navigation?.fetchStart,
      domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.fetchStart,
      firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
      usedJSHeapSize: memory?.usedJSHeapSize,
      totalJSHeapSize: memory?.totalJSHeapSize,
    };
  });
}

/**
 * Simulate touch swipe on mobile
 * @param {import('@playwright/test').Page} page
 * @param {object} options
 */
export async function touchSwipe(page, { startX, startY, endX, endY, steps = 10 }) {
  await page.touchscreen.tap(startX, startY);

  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps;
    const y = startY + ((endY - startY) * i) / steps;
    await page.touchscreen.tap(x, y);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  }
}

/**
 * Check accessibility of the page
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<object>}
 */
export async function checkA11y(page) {
  // Базовые проверки доступности без axe-core
  const results = await page.evaluate(() => {
    const issues = [];

    // Проверка изображений без alt
    document.querySelectorAll('img:not([alt])').forEach(img => {
      issues.push({ type: 'missing-alt', element: img.outerHTML.slice(0, 100) });
    });

    // Проверка кнопок без доступного имени
    document.querySelectorAll('button').forEach(btn => {
      if (!btn.textContent?.trim() && !btn.getAttribute('aria-label')) {
        issues.push({ type: 'button-no-name', element: btn.outerHTML.slice(0, 100) });
      }
    });

    // Проверка полей ввода без меток
    document.querySelectorAll('input, select, textarea').forEach(input => {
      const id = input.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.getAttribute('aria-label');
      const hasAriaLabelledBy = input.getAttribute('aria-labelledby');

      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
        issues.push({ type: 'input-no-label', element: input.outerHTML.slice(0, 100) });
      }
    });

    return { issues, count: issues.length };
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════════════════

export const testData = {
  fonts: ['georgia', 'merriweather', 'libre-baskerville', 'inter', 'roboto', 'open-sans'],
  themes: ['light', 'dark', 'bw'],
  fontSizes: { min: 14, max: 22, default: 18 },
  ambientTypes: ['none', 'rain', 'fireplace', 'cafe'],
  chapters: [
    { index: 0, title: 'Глава 1' },
    { index: 1, title: 'Глава 2' },
    { index: 2, title: 'Глава 3' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// VIEWPORT PRESETS
// ═══════════════════════════════════════════════════════════════════════════

export const viewports = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  tabletLandscape: { width: 1024, height: 768 },
  mobile: { width: 375, height: 667 },
  mobileSmall: { width: 320, height: 568 },
  mobileLarge: { width: 414, height: 896 },
};
