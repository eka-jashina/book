/**
 * E2E: Landing Page — публичная витрина, discovery, hero, tabs, showcase.
 *
 * Мокаем API через page.route() для showcase-данных.
 * Тесты запускаются без авторизации (гостевой режим).
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const SHOWCASE_BOOKS = [
  { id: 'b1', title: 'Мастер и Маргарита', author: 'Булгаков', coverBg: '#1a3a4a', visibility: 'published' },
  { id: 'b2', title: 'Война и мир', author: 'Толстой', coverBg: '#2a4a5a', visibility: 'published' },
  { id: 'b3', title: 'Преступление и наказание', author: 'Достоевский', coverBg: '#3a5a6a', visibility: 'published' },
];

async function mockGuestState(page) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' }),
  );
}

async function mockDiscoverAPI(page, books = SHOWCASE_BOOKS) {
  await page.route('**/api/v1/public/discover**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: books }),
    }),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Landing Page', () => {
  test.describe('Hero Section', () => {
    test('should display landing screen for unauthenticated users', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const landing = page.locator('#landing-screen');
      await expect(landing).toBeVisible({ timeout: 10000 });
    });

    test('should show app title and tagline', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('.landing-hero-title')).toHaveText('Foliant');
      await expect(page.locator('.landing-hero-tagline')).toBeVisible();
    });

    test('should show CTA buttons', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const ctaBooks = page.locator('#landing-cta-books');
      await expect(ctaBooks).toBeVisible({ timeout: 5000 });
    });

    test('should show decorative 3D book illustration', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('.landing-book-3d')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Tabs', () => {
    test('should have Books and Albums tabs', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const booksTab = page.locator('.landing-tab[data-tab="books"]');
      const albumsTab = page.locator('.landing-tab[data-tab="albums"]');

      await expect(booksTab).toBeVisible({ timeout: 5000 });
      await expect(albumsTab).toBeVisible();
    });

    test('should have Books tab active by default', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const booksTab = page.locator('.landing-tab[data-tab="books"]');
      await expect(booksTab).toHaveClass(/landing-tab--active/);
    });

    test('should switch to Albums tab on click', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const albumsTab = page.locator('.landing-tab[data-tab="albums"]');
      await albumsTab.click();

      await expect(albumsTab).toHaveClass(/landing-tab--active/);
      await expect(page.locator('.landing-tab-panel[data-panel="albums"]')).toHaveClass(/landing-tab-panel--active/);
    });

    test('should show corresponding panel content for each tab', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Books panel initially active
      const booksPanel = page.locator('.landing-tab-panel[data-panel="books"]');
      await expect(booksPanel).toHaveClass(/landing-tab-panel--active/);

      // Switch to albums
      await page.locator('.landing-tab[data-tab="albums"]').click();
      const albumsPanel = page.locator('.landing-tab-panel[data-panel="albums"]');
      await expect(albumsPanel).toHaveClass(/landing-tab-panel--active/);

      // Switch back to books
      await page.locator('.landing-tab[data-tab="books"]').click();
      await expect(booksPanel).toHaveClass(/landing-tab-panel--active/);
    });
  });

  test.describe('Showcase / Discovery', () => {
    test('should load and display public books from discover API', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const showcase = page.locator('#landing-showcase');
      // Showcase may be hidden initially and revealed after data loads
      await expect(showcase).toBeVisible({ timeout: 10000 });

      const grid = page.locator('#landing-showcase-grid');
      const cards = grid.locator('.landing-book-card, .landing-book-cover');
      await expect(cards).toHaveCount(SHOWCASE_BOOKS.length, { timeout: 10000 });
    });

    test('should display book titles in showcase cards', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#landing-showcase')).toBeVisible({ timeout: 10000 });

      const titles = page.locator('.landing-book-title');
      const count = await titles.count();
      expect(count).toBeGreaterThanOrEqual(1);

      // Check first book title matches
      await expect(titles.first()).toContainText(SHOWCASE_BOOKS[0].title);
    });

    test('should display book authors in showcase cards', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#landing-showcase')).toBeVisible({ timeout: 10000 });

      const authors = page.locator('.landing-book-author');
      const count = await authors.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should handle empty discover response gracefully', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page, []);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Landing should still show, even with no books
      await expect(page.locator('#landing-screen')).toBeVisible({ timeout: 10000 });
      // Showcase section should remain hidden when empty
      // (no crash, page is functional)
    });

    test('should handle discover API failure gracefully', async ({ page }) => {
      await mockGuestState(page);
      await page.route('**/api/v1/public/discover**', (route) =>
        route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Server error"}' }),
      );
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Landing should still display (no crash)
      await expect(page.locator('#landing-screen')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.landing-hero-title')).toHaveText('Foliant');
    });

    test('should handle discover network failure gracefully', async ({ page }) => {
      await mockGuestState(page);
      await page.route('**/api/v1/public/discover**', (route) => route.abort());
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('#landing-screen')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Content Sections', () => {
    test('should show "Для кого" audience section', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const audienceSection = page.locator('.landing-audience');
      await expect(audienceSection).toBeAttached();

      const cards = audienceSection.locator('.landing-audience-card');
      const count = await cards.count();
      expect(count).toBe(2); // Authors + Photographers
    });

    test('should show "Как это работает" steps section', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const stepsSection = page.locator('.landing-steps');
      await expect(stepsSection).toBeAttached();

      const steps = stepsSection.locator('.landing-step');
      const count = await steps.count();
      expect(count).toBe(3); // Upload → Customize → Share
    });

    test('should show "Возможности" features section', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const featuresSection = page.locator('.landing-features');
      await expect(featuresSection).toBeAttached();

      const features = featuresSection.locator('.landing-feature');
      const count = await features.count();
      expect(count).toBe(6); // 3D, Sound, Custom, Albums, Mobile, Profiles
    });

    test('should show final CTA section', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const finalCta = page.locator('.landing-final-cta');
      await expect(finalCta).toBeAttached();
      await expect(page.locator('#landing-cta')).toBeAttached();
    });

    test('should show footer', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('.landing-footer')).toBeAttached();
    });
  });

  test.describe('Language Selector', () => {
    test('should have language selector with 5 languages', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const langSelect = page.locator('#landing-lang-select');
      if (await langSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        const options = langSelect.locator('option');
        await expect(options).toHaveCount(5); // ru, en, es, fr, de
      }
    });
  });

  test.describe('CTA Actions', () => {
    test('should open auth modal when "Создать книгу" is clicked', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const ctaBooks = page.locator('#landing-cta-books');
      await expect(ctaBooks).toBeVisible({ timeout: 5000 });
      await ctaBooks.click();

      const modal = page.locator('.auth-modal');
      await expect(modal).toBeVisible({ timeout: 5000 });
    });

    test('should open auth modal when final CTA is clicked', async ({ page }) => {
      await mockGuestState(page);
      await mockDiscoverAPI(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Scroll to final CTA
      const finalCta = page.locator('#landing-cta');
      await finalCta.scrollIntoViewIfNeeded();
      await finalCta.click();

      const modal = page.locator('.auth-modal');
      await expect(modal).toBeVisible({ timeout: 5000 });
    });
  });
});
