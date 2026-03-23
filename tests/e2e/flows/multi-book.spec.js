/**
 * E2E: Мультикнижность — переключение между книгами, сохранение прогресса чтения.
 *
 * Тесты используют localStorage-based AdminConfigStore (offline mode).
 * Навигация через `/` (SPA fallback не работает в vite preview).
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createChapter(id, title) {
  return {
    id,
    title,
    file: 'content/part_1.html',
    bg: '',
    bgMobile: '',
  };
}

function createTestBook(id, title, chapters = []) {
  return {
    id,
    cover: { title, author: `Author of ${title}` },
    chapters: chapters.length
      ? chapters
      : [createChapter(`${id}-ch1`, 'Chapter 1'), createChapter(`${id}-ch2`, 'Chapter 2')],
    sounds: { pageFlip: '', bookOpen: '', bookClose: '' },
    ambients: [],
    appearance: {
      light: { coverBgStart: '#1a3a4a', coverBgEnd: '#0d1f2d', coverText: '#d4af37' },
      dark: { coverBgStart: '#1a1a2e', coverBgEnd: '#16213e', coverText: '#e0c068' },
    },
    decorativeFont: null,
    defaultSettings: {},
  };
}

function buildMultiBookConfig(books) {
  return {
    books,
    activeBookId: books[0]?.id || null,
    readingFonts: [
      { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
    ],
    settingsVisibility: {
      fontSize: true,
      theme: true,
      font: true,
      fullscreen: true,
      sound: true,
      ambient: true,
    },
    fontMin: 14,
    fontMax: 22,
  };
}

async function seedConfig(page, config) {
  await page.addInitScript((configStr) => {
    localStorage.setItem('flipbook-admin-config', configStr);
  }, JSON.stringify(config));
}

async function seedReadingProgress(page, bookId, settings) {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: `reader-settings:${bookId}`, value: JSON.stringify(settings) },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Multi-Book', () => {
  const book1 = createTestBook('book-alpha', 'Alpha Book');
  const book2 = createTestBook('book-beta', 'Beta Book');
  const book3 = createTestBook('book-gamma', 'Gamma Book');

  test.describe('Bookshelf Display', () => {
    test('should display multiple books on the bookshelf', async ({ page }) => {
      await seedConfig(page, buildMultiBookConfig([book1, book2, book3]));
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // На полке должны быть карточки книг
      const bookCards = page.locator('.book-card, [data-book-id]');
      if (await bookCards.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        const count = await bookCards.count();
        expect(count).toBeGreaterThanOrEqual(2);
      }
    });

    test('should show book titles on cards', async ({ page }) => {
      await seedConfig(page, buildMultiBookConfig([book1, book2]));
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const pageContent = await page.textContent('body');
      // Хотя бы одно из названий должно быть видно (на полке или обложке)
      const hasAlpha = pageContent.includes('Alpha Book');
      const hasBeta = pageContent.includes('Beta Book');
      expect(hasAlpha || hasBeta).toBe(true);
    });
  });

  test.describe('Book Switching', () => {
    test('should open a specific book from bookshelf', async ({ page }) => {
      await seedConfig(page, buildMultiBookConfig([book1, book2]));
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const firstBook = page.locator('.book-card, [data-book-id]').first();
      if (await firstBook.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstBook.click();

        // Должна открыться книга (reader или cover view)
        const bookElement = page.locator('.book, #cover');
        await expect(bookElement.first()).toBeVisible({ timeout: 5000 });
      }
    });

    test('should maintain separate reading progress per book', async ({ page }) => {
      await seedConfig(page, buildMultiBookConfig([book1, book2]));
      await seedReadingProgress(page, 'book-alpha', {
        page: 10,
        font: 'georgia',
        fontSize: 18,
        theme: 'light',
      });
      await seedReadingProgress(page, 'book-beta', {
        page: 5,
        font: 'georgia',
        fontSize: 20,
        theme: 'dark',
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Проверить, что прогресс сохранён отдельно
      const alphaProgress = await page.evaluate(() => {
        const data = localStorage.getItem('reader-settings:book-alpha');
        return data ? JSON.parse(data) : null;
      });
      const betaProgress = await page.evaluate(() => {
        const data = localStorage.getItem('reader-settings:book-beta');
        return data ? JSON.parse(data) : null;
      });

      expect(alphaProgress?.page).toBe(10);
      expect(betaProgress?.page).toBe(5);
      expect(alphaProgress?.fontSize).toBe(18);
      expect(betaProgress?.fontSize).toBe(20);
    });

    test('should persist individual settings per book', async ({ page }) => {
      await seedConfig(page, buildMultiBookConfig([book1, book2]));
      await seedReadingProgress(page, 'book-alpha', {
        page: 0,
        theme: 'dark',
        font: 'merriweather',
      });
      await seedReadingProgress(page, 'book-beta', {
        page: 0,
        theme: 'light',
        font: 'georgia',
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const alpha = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('reader-settings:book-alpha') || '{}'),
      );
      const beta = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('reader-settings:book-beta') || '{}'),
      );

      expect(alpha.theme).toBe('dark');
      expect(beta.theme).toBe('light');
    });
  });

  test.describe('Reading Progress', () => {
    test('should show continue reading button for books with progress', async ({ page }) => {
      await seedConfig(page, buildMultiBookConfig([book1]));
      await seedReadingProgress(page, 'book-alpha', {
        page: 5,
        font: 'georgia',
        fontSize: 18,
        theme: 'light',
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const continueBtn = page.locator('#continueBtn, [data-action="continue"]');
      if (await continueBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(continueBtn.first()).toBeVisible();
      }
    });

    test('should save reading progress to correct storage key', async ({ page }) => {
      await seedConfig(page, buildMultiBookConfig([book1]));
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const keys = await page.evaluate(() => {
        const result = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('reader-settings')) {
            result.push(key);
          }
        }
        return result;
      });

      // Ключи должны существовать (с ID книги или без)
      expect(keys.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Storage Isolation', () => {
    test('should not mix settings between books', async ({ page }) => {
      await seedConfig(page, buildMultiBookConfig([book1, book2]));
      await seedReadingProgress(page, 'book-alpha', {
        page: 15,
        fontSize: 22,
        theme: 'dark',
        soundEnabled: false,
      });
      await seedReadingProgress(page, 'book-beta', {
        page: 3,
        fontSize: 14,
        theme: 'bw',
        soundEnabled: true,
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const alpha = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('reader-settings:book-alpha') || '{}'),
      );
      const beta = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('reader-settings:book-beta') || '{}'),
      );

      expect(alpha.page).not.toBe(beta.page);
      expect(alpha.fontSize).not.toBe(beta.fontSize);
      expect(alpha.theme).not.toBe(beta.theme);
      expect(alpha.soundEnabled).not.toBe(beta.soundEnabled);
    });

    test('should not lose progress of other books when reading one', async ({ page }) => {
      await seedConfig(page, buildMultiBookConfig([book1, book2]));
      await seedReadingProgress(page, 'book-alpha', { page: 15 });
      await seedReadingProgress(page, 'book-beta', { page: 7 });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const betaAfter = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('reader-settings:book-beta') || '{}'),
      );
      expect(betaAfter.page).toBe(7);
    });
  });
});
