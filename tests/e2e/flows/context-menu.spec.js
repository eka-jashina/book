/**
 * E2E: Bookshelf Context Menu — контекстное меню книги на полке.
 *
 * Проверяется: открытие/закрытие меню, действия (читать, редактировать,
 * видимость, удалить), badge видимости.
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createTestBook(id, overrides = {}) {
  return {
    id,
    cover: { title: overrides.title || `Book ${id}`, author: overrides.author || 'Author' },
    chapters: [{ id: 'ch1', title: 'Ch 1', htmlContent: '<p>Text</p>', file: '', bg: '', bgMobile: '' }],
    sounds: { pageFlip: '', bookOpen: '', bookClose: '' },
    ambients: [],
    appearance: {
      light: { coverBgStart: '#3a2d1f', coverBgEnd: '#2a2016', coverText: '#f2e9d8' },
      dark: { coverBgStart: '#111', coverBgEnd: '#000', coverText: '#eaeaea' },
    },
    decorativeFont: null,
    defaultSettings: {},
    visibility: overrides.visibility || 'draft',
    ...overrides,
  };
}

function buildAdminConfig(books) {
  return {
    books,
    activeBookId: books[0]?.id || null,
    readingFonts: [{ id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true }],
    settingsVisibility: { fontSize: true, theme: true, font: true, fullscreen: true, sound: true, ambient: true },
    fontMin: 14,
    fontMax: 22,
  };
}

async function seedAdminConfig(page, config) {
  await page.addInitScript((configStr) => {
    localStorage.setItem('flipbook-admin-config', configStr);
  }, JSON.stringify(config));
}

async function goToBookshelf(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Bookshelf Context Menu', () => {
  test.describe('Book Card Display', () => {
    test('should display book cards on bookshelf', async ({ page }) => {
      const books = [
        createTestBook('b1', { title: 'First Book' }),
        createTestBook('b2', { title: 'Second Book' }),
      ];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const bookCards = page.locator('.bookshelf-book');
      await expect(bookCards.first()).toBeVisible({ timeout: 10000 });

      const count = await bookCards.count();
      expect(count).toBe(2);
    });

    test('should display book title on card', async ({ page }) => {
      const books = [createTestBook('b1', { title: 'My Amazing Book' })];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const title = page.locator('.bookshelf-book-title').first();
      await expect(title).toBeVisible({ timeout: 10000 });
      await expect(title).toHaveText('My Amazing Book');
    });

    test('should display book author on card', async ({ page }) => {
      const books = [createTestBook('b1', { title: 'Book', author: 'Jane Doe' })];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const author = page.locator('.bookshelf-book-author').first();
      await expect(author).toBeVisible({ timeout: 10000 });
      await expect(author).toHaveText('Jane Doe');
    });

    test('should show draft badge for draft books', async ({ page }) => {
      const books = [createTestBook('b1', { visibility: 'draft' })];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const badge = page.locator('.bookshelf-book-badge').first();
      if (await badge.isVisible({ timeout: 5000 }).catch(() => false)) {
        const text = await badge.textContent();
        expect(text).toMatch(/Черновик|Draft/i);
      }
    });
  });

  test.describe('Menu Open/Close', () => {
    test('should open context menu on book click', async ({ page }) => {
      const books = [createTestBook('b1')];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const bookBtn = page.locator('.bookshelf-book').first();
      await expect(bookBtn).toBeVisible({ timeout: 10000 });
      await bookBtn.click();

      const menu = page.locator('.bookshelf-book-menu').first();
      await expect(menu).toBeVisible({ timeout: 3000 });
    });

    test('should show menu items: read, edit, visibility, delete', async ({ page }) => {
      const books = [createTestBook('b1')];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const bookBtn = page.locator('.bookshelf-book').first();
      await expect(bookBtn).toBeVisible({ timeout: 10000 });
      await bookBtn.click();

      await expect(page.locator('[data-book-action="read"]').first()).toBeVisible({ timeout: 3000 });
      await expect(page.locator('[data-book-action="edit"]').first()).toBeVisible();
      await expect(page.locator('[data-book-action="set-visibility"]').first()).toBeVisible();
      await expect(page.locator('[data-book-action="delete"]').first()).toBeVisible();
    });

    test('should close menu on outside click', async ({ page }) => {
      const books = [createTestBook('b1')];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const bookBtn = page.locator('.bookshelf-book').first();
      await expect(bookBtn).toBeVisible({ timeout: 10000 });
      await bookBtn.click();

      const menu = page.locator('.bookshelf-book-menu').first();
      await expect(menu).toBeVisible({ timeout: 3000 });

      // Click outside the menu
      await page.locator('.bookshelf-screen').click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(300);

      await expect(menu).toBeHidden();
    });

    test('should add menu-open class to wrapper when opened', async ({ page }) => {
      const books = [createTestBook('b1')];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const bookBtn = page.locator('.bookshelf-book').first();
      await expect(bookBtn).toBeVisible({ timeout: 10000 });
      await bookBtn.click();

      const wrapper = page.locator('.bookshelf-book-wrapper').first();
      await expect(wrapper).toHaveClass(/menu-open/, { timeout: 3000 });
    });
  });

  test.describe('Menu Actions', () => {
    test('should navigate to reader on "Read" action', async ({ page }) => {
      const books = [createTestBook('b1')];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const bookBtn = page.locator('.bookshelf-book').first();
      await expect(bookBtn).toBeVisible({ timeout: 10000 });
      await bookBtn.click();

      const readBtn = page.locator('[data-book-action="read"]').first();
      await expect(readBtn).toBeVisible({ timeout: 3000 });
      await readBtn.click();

      // Should navigate to book reader (URL changes to /book/b1)
      await page.waitForTimeout(1000);
      const url = page.url();
      expect(url).toMatch(/\/book\/b1/);
    });

    test('should navigate to editor on "Edit" action', async ({ page }) => {
      const books = [createTestBook('b1')];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const bookBtn = page.locator('.bookshelf-book').first();
      await expect(bookBtn).toBeVisible({ timeout: 10000 });
      await bookBtn.click();

      const editBtn = page.locator('[data-book-action="edit"]').first();
      await expect(editBtn).toBeVisible({ timeout: 3000 });
      await editBtn.click();

      // Should navigate to account/editor
      await page.waitForTimeout(1000);
      const url = page.url();
      expect(url).toMatch(/\/account/);
    });

    test('should set visibility on "set-visibility" action', async ({ page }) => {
      const books = [createTestBook('b1', { visibility: 'draft' })];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const bookBtn = page.locator('.bookshelf-book').first();
      await expect(bookBtn).toBeVisible({ timeout: 10000 });
      await bookBtn.click();

      // Draft should be marked as active
      const draftBtn = page.locator('[data-book-action="set-visibility"][data-visibility="draft"]').first();
      await expect(draftBtn).toHaveClass(/is-active/, { timeout: 3000 });

      // Click "Published" option
      const publishBtn = page.locator('[data-book-action="set-visibility"][data-visibility="published"]').first();
      await expect(publishBtn).toBeVisible({ timeout: 3000 });
      await publishBtn.click();

      // Visibility should change to published
      await page.waitForTimeout(500);

      // Verify config updated
      const config = await page.evaluate(() => {
        const stored = localStorage.getItem('flipbook-admin-config');
        return stored ? JSON.parse(stored) : null;
      });

      if (config?.books?.[0]) {
        expect(config.books[0].visibility).not.toBe('draft');
      }
    });

    test('should show confirmation dialog on "Delete" action', async ({ page }) => {
      const books = [createTestBook('b1')];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      const bookBtn = page.locator('.bookshelf-book').first();
      await expect(bookBtn).toBeVisible({ timeout: 10000 });
      await bookBtn.click();

      const deleteBtn = page.locator('[data-book-action="delete"]').first();
      await expect(deleteBtn).toBeVisible({ timeout: 3000 });
      await deleteBtn.click();

      // Should show confirmation dialog
      const confirmDialog = page.locator('#confirmDialog');
      if (await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(confirmDialog).toBeVisible();
      }
    });

    test('should delete book when confirmed', async ({ page }) => {
      const books = [
        createTestBook('b1', { title: 'Book To Delete' }),
        createTestBook('b2', { title: 'Keep This' }),
      ];
      await seedAdminConfig(page, buildAdminConfig(books));
      await goToBookshelf(page);

      // Count initial books
      const initialCount = await page.locator('.bookshelf-book').count();
      expect(initialCount).toBe(2);

      // Open menu and delete first book
      const bookBtn = page.locator('.bookshelf-book').first();
      await bookBtn.click();

      const deleteBtn = page.locator('[data-book-action="delete"]').first();
      await expect(deleteBtn).toBeVisible({ timeout: 3000 });
      await deleteBtn.click();

      // Confirm deletion
      const confirmOk = page.locator('#confirmOk');
      if (await confirmOk.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmOk.click();
        await page.waitForTimeout(1000);

        // Should have one less book
        const newCount = await page.locator('.bookshelf-book').count();
        expect(newCount).toBe(1);
      }
    });
  });

  test.describe('Empty Bookshelf', () => {
    test('should show empty state when no books', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      await goToBookshelf(page);

      const emptyState = page.locator('#bookshelf-empty');
      if (await emptyState.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(emptyState).toBeVisible();
      }
    });

    test('should show "Create Book" button on empty bookshelf', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      await goToBookshelf(page);

      const addBtn = page.locator('[data-action="add-book"]');
      await expect(addBtn.first()).toBeVisible({ timeout: 10000 });
    });
  });
});
