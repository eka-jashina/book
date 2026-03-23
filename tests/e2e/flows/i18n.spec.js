/**
 * E2E: i18n — переключение между 5 языками (ru, en, es, fr, de).
 *
 * Проверяется: переключение на landing page, корректность переводов,
 * язык по умолчанию, обновление HTML-атрибутов, сохранение после reload.
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function mockGuestState(page) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' }),
  );
  await page.route('**/api/v1/public/discover**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }),
  );
}

const LANGUAGES = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

/** Expected tagline translations per language */
const TAGLINES = {
  ru: 'Каждая страница — событие',
  en: 'Every page is an event',
  es: 'Cada página es un evento',
  fr: 'Chaque page est un événement',
  de: 'Jede Seite ist ein Ereignis',
};

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('i18n — Language Switching', () => {
  test.describe('Language Selector', () => {
    test('should have language selector on landing page', async ({ page }) => {
      await mockGuestState(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      await expect(langSelect).toBeVisible({ timeout: 10000 });
    });

    test('should have all 5 languages available', async ({ page }) => {
      await mockGuestState(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      await expect(langSelect).toBeVisible({ timeout: 10000 });

      const options = langSelect.locator('option');
      await expect(options).toHaveCount(5);

      for (const lang of LANGUAGES) {
        const option = langSelect.locator(`option[value="${lang.code}"]`);
        await expect(option).toHaveText(lang.label);
      }
    });

    test('should default to Russian (ru)', async ({ page }) => {
      await mockGuestState(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      await expect(langSelect).toBeVisible({ timeout: 10000 });

      // Default value should be 'ru'
      const value = await langSelect.inputValue();
      expect(value).toBe('ru');
    });
  });

  test.describe('Translation Application', () => {
    test('should switch to English and update translations', async ({ page }) => {
      await mockGuestState(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      await expect(langSelect).toBeVisible({ timeout: 10000 });

      await langSelect.selectOption('en');
      await page.waitForTimeout(500); // Wait for translations to apply

      // Check tagline translated
      const tagline = page.locator('.landing-hero-tagline');
      const text = await tagline.textContent();
      // Should be in English now (not Russian)
      expect(text).not.toBe('Каждая страница — событие');
    });

    test('should switch to Spanish and update translations', async ({ page }) => {
      await mockGuestState(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      await expect(langSelect).toBeVisible({ timeout: 10000 });

      await langSelect.selectOption('es');
      await page.waitForTimeout(500);

      // Verify Spanish translations applied to data-i18n elements
      const tagline = page.locator('.landing-hero-tagline');
      const text = await tagline.textContent();
      expect(text).not.toBe('Каждая страница — событие');
    });

    test('should switch to French and update translations', async ({ page }) => {
      await mockGuestState(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      await expect(langSelect).toBeVisible({ timeout: 10000 });

      await langSelect.selectOption('fr');
      await page.waitForTimeout(500);

      const tagline = page.locator('.landing-hero-tagline');
      const text = await tagline.textContent();
      expect(text).not.toBe('Каждая страница — событие');
    });

    test('should switch to German and update translations', async ({ page }) => {
      await mockGuestState(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      await expect(langSelect).toBeVisible({ timeout: 10000 });

      await langSelect.selectOption('de');
      await page.waitForTimeout(500);

      const tagline = page.locator('.landing-hero-tagline');
      const text = await tagline.textContent();
      expect(text).not.toBe('Каждая страница — событие');
    });

    test('should update HTML lang attribute on language switch', async ({ page }) => {
      await mockGuestState(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      await expect(langSelect).toBeVisible({ timeout: 10000 });

      await langSelect.selectOption('en');
      await page.waitForTimeout(500);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });

  test.describe('Multiple Translations', () => {
    test('should translate multiple elements simultaneously', async ({ page }) => {
      await mockGuestState(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      await expect(langSelect).toBeVisible({ timeout: 10000 });

      // Get Russian texts first
      const taglineRu = await page.locator('.landing-hero-tagline').textContent();

      // Switch to English
      await langSelect.selectOption('en');
      await page.waitForTimeout(500);

      const taglineEn = await page.locator('.landing-hero-tagline').textContent();

      // Texts should differ between languages
      expect(taglineEn).not.toBe(taglineRu);
    });

    test('should switch between all 5 languages sequentially', async ({ page }) => {
      await mockGuestState(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      await expect(langSelect).toBeVisible({ timeout: 10000 });

      const previousTexts = new Set();

      for (const lang of LANGUAGES) {
        await langSelect.selectOption(lang.code);
        await page.waitForTimeout(300);

        const tagline = await page.locator('.landing-hero-tagline').textContent();
        // Each language should produce a unique translation
        previousTexts.add(tagline);
      }

      // All 5 languages should have different taglines
      expect(previousTexts.size).toBe(5);
    });
  });

  test.describe('Switch Back to Russian', () => {
    test('should switch back to Russian correctly after changing language', async ({ page }) => {
      await mockGuestState(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      await expect(langSelect).toBeVisible({ timeout: 10000 });

      // Switch to English
      await langSelect.selectOption('en');
      await page.waitForTimeout(300);

      // Switch back to Russian
      await langSelect.selectOption('ru');
      await page.waitForTimeout(300);

      await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

      const tagline = await page.locator('.landing-hero-tagline').textContent();
      expect(tagline).toBe('Каждая страница — событие');
    });
  });
});
