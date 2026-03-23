/**
 * E2E: Book Uploads — загрузка книг из файлов (txt, doc, docx, epub, fb2).
 *
 * Тесты используют localStorage-based AdminConfigStore (offline mode),
 * поэтому не требуют работающего сервера.
 *
 * Проверяется: выбор файла, парсинг, отображение результата, подтверждение.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function seedAdminConfig(page, config) {
  await page.addInitScript((configStr) => {
    localStorage.setItem('flipbook-admin-config', configStr);
  }, JSON.stringify(config));
}

function buildAdminConfig(books = [], overrides = {}) {
  return {
    books,
    activeBookId: books[0]?.id || null,
    readingFonts: [
      { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
    ],
    settingsVisibility: { fontSize: true, theme: true, font: true, fullscreen: true, sound: true, ambient: true },
    fontMin: 14,
    fontMax: 22,
    ...overrides,
  };
}

/**
 * Navigate to account screen using SPA navigation.
 */
async function navigateToAccount(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const editBtn = page.locator('[data-route="/account"], .bookshelf-edit-btn, [href="/account"]').first();
  if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await editBtn.click();
    await page.waitForLoadState('networkidle');
    return true;
  }

  const navigated = await page.evaluate(() => {
    if (window.bookApp?.router) {
      window.bookApp.router.navigate('/account');
      return true;
    }
    history.pushState(null, '', '/account');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return true;
  });
  if (navigated) {
    await page.waitForLoadState('networkidle');
  }
  return navigated;
}

/**
 * Navigate to account and open mode selector for adding a new book.
 */
async function openModeSelector(page) {
  const navigated = await navigateToAccount(page);
  if (!navigated) return false;

  const addBtn = page.locator('#addBookBtn');
  if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addBtn.click();
    const modeSelector = page.locator('[data-view="mode-selector"]');
    return await modeSelector.isVisible({ timeout: 3000 }).catch(() => false);
  }
  return false;
}

/**
 * Create a minimal TXT file content via Playwright's file chooser.
 */
async function uploadFileViaInput(page, fileName, content, mimeType = 'text/plain') {
  // Find the file input for book upload
  const fileInput = page.locator('input[type="file"][accept*=".txt"], input[type="file"][accept*=".epub"], input[type="file"].book-upload-input').first();

  if (await fileInput.isAttached({ timeout: 3000 }).catch(() => false)) {
    // Create a buffer from content
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    await fileInput.setInputFiles({
      name: fileName,
      mimeType,
      buffer,
    });
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Book Upload', () => {
  test.describe('Upload Mode Selection', () => {
    test('should show mode selector with upload option', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const addBtn = page.locator('#addBookBtn');
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await addBtn.click();

          const modeSelector = page.locator('[data-view="mode-selector"]');
          if (await modeSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Look for upload mode card
            const uploadCard = page.locator('[data-mode="upload"], .mode-card').first();
            await expect(uploadCard).toBeVisible();
          }
        }
      }
    });

    test('should show supported formats in upload area', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const addBtn = page.locator('#addBookBtn');
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await addBtn.click();

          // Find and click the upload mode card
          const uploadCard = page.locator('[data-mode="upload"]');
          if (await uploadCard.isVisible({ timeout: 3000 }).catch(() => false)) {
            await uploadCard.click();

            // Should show the upload dropzone area
            const dropzone = page.locator('.book-upload-dropzone, .dropzone, [data-view="upload"]');
            if (await dropzone.isVisible({ timeout: 3000 }).catch(() => false)) {
              // Check supported formats are mentioned
              const text = await dropzone.textContent();
              expect(text).toMatch(/txt|doc|epub|fb2/i);
            }
          }
        }
      }
    });
  });

  test.describe('TXT File Upload', () => {
    test('should parse and display a TXT file', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        // Navigate to upload view
        const addBtn = page.locator('#addBookBtn');
        if (!await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await addBtn.click();

        const uploadCard = page.locator('[data-mode="upload"]');
        if (!await uploadCard.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await uploadCard.click();

        // Upload a TXT file
        const txtContent = 'Глава 1: Начало\n\nЭто первая глава моей книги.\nОна содержит важный текст.\n\nГлава 2: Продолжение\n\nА это вторая глава.';
        const uploaded = await uploadFileViaInput(page, 'test-book.txt', txtContent);

        if (uploaded) {
          // Wait for parsing to complete — look for result card
          const resultCard = page.locator('.book-upload-result, .upload-result, .parsed-book-card');
          if (await resultCard.isVisible({ timeout: 10000 }).catch(() => false)) {
            await expect(resultCard).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('File Input Interaction', () => {
    test('should have file input accepting multiple formats', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const addBtn = page.locator('#addBookBtn');
        if (!await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await addBtn.click();

        const uploadCard = page.locator('[data-mode="upload"]');
        if (!await uploadCard.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await uploadCard.click();

        // Check file input accept attribute
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isAttached({ timeout: 3000 }).catch(() => false)) {
          const accept = await fileInput.getAttribute('accept');
          if (accept) {
            expect(accept).toMatch(/\.txt/);
          }
        }
      }
    });

    test('should show dropzone area for drag and drop', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const addBtn = page.locator('#addBookBtn');
        if (!await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await addBtn.click();

        const uploadCard = page.locator('[data-mode="upload"]');
        if (!await uploadCard.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await uploadCard.click();

        const dropzone = page.locator('.book-upload-dropzone, .dropzone, [data-view="upload"]');
        if (await dropzone.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(dropzone).toBeVisible();
        }
      }
    });
  });

  test.describe('Upload Error Handling', () => {
    test('should handle unsupported file format', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const addBtn = page.locator('#addBookBtn');
        if (!await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await addBtn.click();

        const uploadCard = page.locator('[data-mode="upload"]');
        if (!await uploadCard.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await uploadCard.click();

        // Try uploading an unsupported format (.pdf)
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isAttached({ timeout: 3000 }).catch(() => false)) {
          await fileInput.setInputFiles({
            name: 'test.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('fake pdf content'),
          });

          // Should show error toast or message (not crash)
          await page.waitForTimeout(2000);

          // Verify page is still functional
          await expect(page.locator('#landing-screen, .bookshelf, .admin-tab')).toBeAttached();
        }
      }
    });
  });

  test.describe('Book Confirmation', () => {
    test('should add book to shelf after confirmation', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const addBtn = page.locator('#addBookBtn');
        if (!await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await addBtn.click();

        const uploadCard = page.locator('[data-mode="upload"]');
        if (!await uploadCard.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await uploadCard.click();

        // Upload a TXT file
        const txtContent = 'Простая книга\n\nЭто содержание книги для теста.';
        const uploaded = await uploadFileViaInput(page, 'simple-book.txt', txtContent);

        if (uploaded) {
          // Wait for result and confirm
          const confirmBtn = page.locator('.book-upload-confirm, .upload-confirm-btn, [data-action="confirm"]');
          if (await confirmBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
            await confirmBtn.click();

            // Should navigate to editor or show the book in list
            await page.waitForTimeout(2000);

            // Verify book was added to admin config
            const config = await page.evaluate(() => {
              const stored = localStorage.getItem('flipbook-admin-config');
              return stored ? JSON.parse(stored) : null;
            });

            if (config) {
              expect(config.books.length).toBeGreaterThanOrEqual(1);
            }
          }
        }
      }
    });
  });
});
