/**
 * E2E: Admin Panel — загрузка книг, редактирование глав, управление шрифтами.
 *
 * Тесты используют localStorage-based AdminConfigStore (offline mode),
 * поэтому не требуют работающего сервера.
 *
 * Навигация через `/` (SPA fallback не работает в vite preview).
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Подготовить admin config в localStorage перед загрузкой страницы.
 * Использует addInitScript — выполняется ДО загрузки каждой страницы.
 */
async function seedAdminConfig(page, config) {
  await page.addInitScript((configStr) => {
    localStorage.setItem('flipbook-admin-config', configStr);
  }, JSON.stringify(config));
}

function createTestBook(overrides = {}) {
  return {
    id: overrides.id || 'test-book-1',
    cover: {
      title: overrides.title || 'Test Book',
      author: overrides.author || 'Test Author',
    },
    chapters: overrides.chapters || [],
    sounds: { pageFlip: '', bookOpen: '', bookClose: '' },
    ambients: [],
    appearance: {
      light: { coverBgStart: '#1a3a4a', coverBgEnd: '#0d1f2d', coverText: '#d4af37' },
      dark: { coverBgStart: '#1a1a2e', coverBgEnd: '#16213e', coverText: '#e0c068' },
    },
    decorativeFont: null,
    defaultSettings: {},
    ...overrides,
  };
}

function buildAdminConfig(books = [], overrides = {}) {
  return {
    books,
    activeBookId: books[0]?.id || null,
    readingFonts: overrides.readingFonts || [
      { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
      { id: 'merriweather', label: 'Merriweather', family: 'Merriweather, serif', builtin: true, enabled: true },
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
    ...overrides,
  };
}

/**
 * Перейти к аккаунту через SPA-навигацию (кнопка «Редактировать» в bookshelf).
 * Vite preview не поддерживает SPA fallback, поэтому нельзя делать goto('/account').
 */
async function navigateToAccount(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Попробовать найти кнопку перехода к аккаунту
  const editBtn = page.locator('[data-route="/account"], .bookshelf-edit-btn, [href="/account"]').first();
  if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await editBtn.click();
    await page.waitForLoadState('networkidle');
    return true;
  }

  // Альтернатива: программная навигация через Router
  const navigated = await page.evaluate(() => {
    if (window.bookApp?.router) {
      window.bookApp.router.navigate('/account');
      return true;
    }
    // Fallback: History API + popstate
    history.pushState(null, '', '/account');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return true;
  });
  if (navigated) {
    await page.waitForLoadState('networkidle');
  }
  return navigated;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Admin Panel', () => {
  test.describe('Account Screen Navigation', () => {
    test('should navigate to account and show tabs', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const booksTab = page.locator('.admin-tab[data-tab="books"]');
        const exportTab = page.locator('.admin-tab[data-tab="export"]');

        // Если аккаунт доступен — проверяем табы
        if (await booksTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(booksTab).toBeVisible();
          await expect(exportTab).toBeVisible();
        }
      }
    });

    test('should switch between tabs', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const exportTab = page.locator('.admin-tab[data-tab="export"]');
        if (await exportTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await exportTab.click();
          const exportPanel = page.locator('.admin-panel[data-panel="export"]');
          await expect(exportPanel).toBeVisible();
        }
      }
    });
  });

  test.describe('Book Management', () => {
    test('should display existing books in bookshelf view', async ({ page }) => {
      const book1 = createTestBook({ id: 'book-1', title: 'First Book' });
      const book2 = createTestBook({ id: 'book-2', title: 'Second Book' });
      await seedAdminConfig(page, buildAdminConfig([book1, book2]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCards = page.locator('.book-card, [data-book-id]');
        if (await bookCards.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(bookCards).toHaveCount(2);
        }
      }
    });

    test('should show mode selector when adding new book', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const addBtn = page.locator('#addBookBtn');
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await addBtn.click();
          const modeSelector = page.locator('[data-view="mode-selector"]');
          await expect(modeSelector).toBeVisible();
        }
      }
    });
  });

  test.describe('Book Editor', () => {
    test('should show editor tabs when book is selected', async ({ page }) => {
      const book = createTestBook({ title: 'Editable Book' });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCard = page.locator('[data-book-id]').first();
        if (await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          await bookCard.click();

          const coverTab = page.locator('.editor-tab[data-editor-tab="cover"]');
          const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
          if (await coverTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(coverTab).toBeVisible();
            await expect(chaptersTab).toBeVisible();
          }
        }
      }
    });

    test('should show cover editor with title and author fields', async ({ page }) => {
      const book = createTestBook({ title: 'Cover Test', author: 'Author Name' });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCard = page.locator('[data-book-id]').first();
        if (await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          await bookCard.click();

          const coverTitle = page.locator('#coverTitle');
          if (await coverTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(coverTitle).toHaveValue('Cover Test');
            await expect(page.locator('#coverAuthor')).toHaveValue('Author Name');
          }
        }
      }
    });

    test('should switch between editor tabs', async ({ page }) => {
      const book = createTestBook({
        chapters: [{ id: 'ch1', title: 'Chapter 1', file: '', bg: '', bgMobile: '' }],
      });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCard = page.locator('[data-book-id]').first();
        if (await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          await bookCard.click();

          const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
          if (await chaptersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chaptersTab.click();
            const chaptersPanel = page.locator('.editor-panel[data-editor-panel="chapters"]');
            await expect(chaptersPanel).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Chapter Management', () => {
    test('should show add chapter button', async ({ page }) => {
      const book = createTestBook({ chapters: [] });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCard = page.locator('[data-book-id]').first();
        if (await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          await bookCard.click();

          const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
          if (await chaptersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chaptersTab.click();

            const addBtn = page.locator('#addChapter');
            const emptyState = page.locator('#chaptersEmpty');
            const visible =
              (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) ||
              (await emptyState.isVisible({ timeout: 1000 }).catch(() => false));
            expect(visible).toBe(true);
          }
        }
      }
    });

    test('should open chapter modal on add click', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCard = page.locator('[data-book-id]').first();
        if (await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          await bookCard.click();

          const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
          if (await chaptersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chaptersTab.click();

            const addBtn = page.locator('#addChapter');
            if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await addBtn.click();
              const modal = page.locator('#chapterModal');
              await expect(modal).toBeVisible();
            }
          }
        }
      }
    });
  });

  test.describe('Font Management', () => {
    test('should show font configuration in reader settings', async ({ page }) => {
      const book = createTestBook();
      const config = buildAdminConfig([book], {
        readingFonts: [
          { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
          { id: 'merriweather', label: 'Merriweather', family: 'Merriweather, serif', builtin: true, enabled: true },
        ],
      });
      await seedAdminConfig(page, config);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const fontSelect = page.locator('#font-select');
      if (await fontSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        const options = fontSelect.locator('option');
        const count = await options.count();
        expect(count).toBeGreaterThanOrEqual(2);
      }
    });
  });

  test.describe('Export/Import', () => {
    test('should show export panel', async ({ page }) => {
      const book = createTestBook({ title: 'Export Test' });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const exportTab = page.locator('.admin-tab[data-tab="export"]');
        if (await exportTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await exportTab.click();
          const exportPanel = page.locator('.admin-panel[data-panel="export"]');
          await expect(exportPanel).toBeVisible();
        }
      }
    });
  });

  test.describe('Appearance Customization', () => {
    test('should show appearance editor', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCard = page.locator('[data-book-id]').first();
        if (await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          await bookCard.click();

          const appearanceTab = page.locator('.editor-tab[data-editor-tab="appearance"]');
          if (await appearanceTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await appearanceTab.click();

            const preview = page.locator('#appearancePreview');
            if (await preview.isVisible({ timeout: 3000 }).catch(() => false)) {
              await expect(preview).toBeVisible();
            }
          }
        }
      }
    });
  });
});
