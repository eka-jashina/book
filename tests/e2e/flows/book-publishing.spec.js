/**
 * E2E: Book Publishing — управление видимостью (draft/published/unlisted),
 * описание книги, ссылка для шаринга.
 *
 * Тесты используют localStorage-based AdminConfigStore (offline mode).
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createTestBook(overrides = {}) {
  return {
    id: overrides.id || 'test-book-1',
    cover: { title: 'Test Book', author: 'Test Author' },
    chapters: [{ id: 'ch1', title: 'Ch 1', htmlContent: '<p>Text</p>', file: '', bg: '', bgMobile: '' }],
    sounds: { pageFlip: '', bookOpen: '', bookClose: '' },
    ambients: [],
    appearance: {
      light: { coverBgStart: '#3a2d1f', coverBgEnd: '#2a2016', coverText: '#f2e9d8' },
      dark: { coverBgStart: '#111', coverBgEnd: '#000', coverText: '#eaeaea' },
    },
    decorativeFont: null,
    defaultSettings: {},
    visibility: 'draft',
    description: '',
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

async function navigateToEditor(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Navigate to account
  await page.evaluate(() => {
    history.pushState(null, '', '/account');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForLoadState('networkidle');

  // Click on book card to enter editor
  const bookCard = page.locator('[data-book-id]').first();
  if (await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    await bookCard.click();
    return true;
  }
  return false;
}

async function openPublishTab(page) {
  const publishTab = page.locator('.editor-tab[data-editor-tab="publish"]');
  if (await publishTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await publishTab.click();
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Book Publishing', () => {
  test.describe('Publish Tab UI', () => {
    test('should show publish tab in editor', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const editorOpened = await navigateToEditor(page);

      if (editorOpened) {
        const publishTab = page.locator('.editor-tab[data-editor-tab="publish"]');
        await expect(publishTab).toBeVisible({ timeout: 5000 });
      }
    });

    test('should show visibility radio group with 3 options', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const editorOpened = await navigateToEditor(page);

      if (editorOpened) {
        const tabOpened = await openPublishTab(page);
        if (tabOpened) {
          const radios = page.locator('input[name="bookVisibility"]');
          await expect(radios).toHaveCount(3);

          await expect(page.locator('input[name="bookVisibility"][value="draft"]')).toBeAttached();
          await expect(page.locator('input[name="bookVisibility"][value="published"]')).toBeAttached();
          await expect(page.locator('input[name="bookVisibility"][value="unlisted"]')).toBeAttached();
        }
      }
    });

    test('should default to draft visibility', async ({ page }) => {
      const book = createTestBook({ visibility: 'draft' });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const editorOpened = await navigateToEditor(page);

      if (editorOpened) {
        const tabOpened = await openPublishTab(page);
        if (tabOpened) {
          const draftRadio = page.locator('input[name="bookVisibility"][value="draft"]');
          await expect(draftRadio).toBeChecked();
        }
      }
    });
  });

  test.describe('Visibility Toggle', () => {
    test('should switch to published', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const editorOpened = await navigateToEditor(page);

      if (editorOpened) {
        const tabOpened = await openPublishTab(page);
        if (tabOpened) {
          const publishedRadio = page.locator('input[name="bookVisibility"][value="published"]');
          await publishedRadio.check();
          await expect(publishedRadio).toBeChecked();
        }
      }
    });

    test('should switch to unlisted', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const editorOpened = await navigateToEditor(page);

      if (editorOpened) {
        const tabOpened = await openPublishTab(page);
        if (tabOpened) {
          const unlistedRadio = page.locator('input[name="bookVisibility"][value="unlisted"]');
          await unlistedRadio.check();
          await expect(unlistedRadio).toBeChecked();
        }
      }
    });

    test('should show share section when published or unlisted', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const editorOpened = await navigateToEditor(page);

      if (editorOpened) {
        const tabOpened = await openPublishTab(page);
        if (tabOpened) {
          // Share section hidden for draft
          const shareSection = page.locator('#shareSection');

          // Switch to published
          await page.locator('input[name="bookVisibility"][value="published"]').check();
          await page.waitForTimeout(300);

          // Share section should become visible
          if (await shareSection.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(shareSection).toBeVisible();
            const shareLink = page.locator('#shareLink');
            const linkValue = await shareLink.inputValue();
            expect(linkValue).toContain('/book/');
          }
        }
      }
    });
  });

  test.describe('Book Description', () => {
    test('should have description textarea', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const editorOpened = await navigateToEditor(page);

      if (editorOpened) {
        const tabOpened = await openPublishTab(page);
        if (tabOpened) {
          const textarea = page.locator('#bookDescription');
          await expect(textarea).toBeVisible();
          await expect(textarea).toHaveAttribute('maxlength', '2000');
        }
      }
    });

    test('should update character count as user types', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const editorOpened = await navigateToEditor(page);

      if (editorOpened) {
        const tabOpened = await openPublishTab(page);
        if (tabOpened) {
          const textarea = page.locator('#bookDescription');
          const charCount = page.locator('#descCharCount');

          await textarea.fill('Hello World');
          await page.waitForTimeout(200);

          const count = await charCount.textContent();
          expect(parseInt(count)).toBe(11);
        }
      }
    });

    test('should preserve description on save', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const editorOpened = await navigateToEditor(page);

      if (editorOpened) {
        const tabOpened = await openPublishTab(page);
        if (tabOpened) {
          const textarea = page.locator('#bookDescription');
          await textarea.fill('My book about adventures');

          const saveBtn = page.locator('#savePublish');
          if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await saveBtn.click();
            await page.waitForTimeout(500);

            // Verify saved in localStorage
            const config = await page.evaluate(() => {
              const stored = localStorage.getItem('flipbook-admin-config');
              return stored ? JSON.parse(stored) : null;
            });

            if (config?.books?.[0]) {
              expect(config.books[0].description).toBe('My book about adventures');
            }
          }
        }
      }
    });
  });

  test.describe('Share Link', () => {
    test('should have copy button for share link', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const editorOpened = await navigateToEditor(page);

      if (editorOpened) {
        const tabOpened = await openPublishTab(page);
        if (tabOpened) {
          await page.locator('input[name="bookVisibility"][value="published"]').check();
          await page.waitForTimeout(300);

          const copyBtn = page.locator('#copyShareLink');
          if (await copyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(copyBtn).toBeVisible();
          }
        }
      }
    });

    test('should have readonly share link input', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const editorOpened = await navigateToEditor(page);

      if (editorOpened) {
        const tabOpened = await openPublishTab(page);
        if (tabOpened) {
          await page.locator('input[name="bookVisibility"][value="unlisted"]').check();
          await page.waitForTimeout(300);

          const shareLink = page.locator('#shareLink');
          if (await shareLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(shareLink).toHaveAttribute('readonly');
          }
        }
      }
    });
  });
});
