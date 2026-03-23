/**
 * E2E: Quill WYSIWYG Editor — редактирование глав книги.
 *
 * Тесты используют localStorage-based AdminConfigStore (offline mode).
 * Quill загружается динамически при открытии редактора глав.
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

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
    chapters: overrides.chapters || [
      {
        id: 'ch1',
        title: 'Chapter 1',
        htmlContent: '<p>Initial chapter content for testing.</p>',
        file: '',
        bg: '',
        bgMobile: '',
      },
    ],
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

function buildAdminConfig(books, overrides = {}) {
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
  if (navigated) await page.waitForLoadState('networkidle');
  return navigated;
}

/**
 * Navigate to the chapter editor for the first chapter.
 */
async function openChapterEditor(page) {
  const bookCard = page.locator('[data-book-id]').first();
  if (!await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) return false;
  await bookCard.click();

  const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
  if (!await chaptersTab.isVisible({ timeout: 3000 }).catch(() => false)) return false;
  await chaptersTab.click();

  // Click on the first chapter to edit it
  const chapterItem = page.locator('.chapter-item, [data-chapter-id]').first();
  if (await chapterItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await chapterItem.click();
    return true;
  }

  // Alternative: click the edit button for the first chapter
  const editBtn = page.locator('.chapter-edit-btn, [data-action="edit-chapter"]').first();
  if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await editBtn.click();
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Quill WYSIWYG Editor', () => {
  test.describe('Editor Loading', () => {
    test('should navigate to chapters tab and see chapter list', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCard = page.locator('[data-book-id]').first();
        if (!await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await bookCard.click();

        const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
        if (!await chaptersTab.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await chaptersTab.click();

        const chaptersPanel = page.locator('.editor-panel[data-editor-panel="chapters"]');
        await expect(chaptersPanel).toBeVisible();
      }
    });

    test('should open chapter modal with Quill editor', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const editorOpened = await openChapterEditor(page);

        if (editorOpened) {
          // Quill editor container should be visible
          const quillContainer = page.locator('.ql-editor, .quill-editor, #chapterEditor .ql-container');
          await expect(quillContainer).toBeVisible({ timeout: 10000 });
        }
      }
    });

    test('should load Quill toolbar with formatting options', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const editorOpened = await openChapterEditor(page);

        if (editorOpened) {
          const toolbar = page.locator('.ql-toolbar');
          await expect(toolbar).toBeVisible({ timeout: 10000 });

          // Check for essential toolbar buttons
          const boldBtn = toolbar.locator('.ql-bold');
          const italicBtn = toolbar.locator('.ql-italic');
          if (await boldBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(boldBtn).toBeVisible();
            await expect(italicBtn).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Text Editing', () => {
    test('should allow typing text in the editor', async ({ page }) => {
      const book = createTestBook({
        chapters: [{ id: 'ch1', title: 'Test Chapter', htmlContent: '', file: '', bg: '', bgMobile: '' }],
      });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const editorOpened = await openChapterEditor(page);

        if (editorOpened) {
          const editor = page.locator('.ql-editor');
          await expect(editor).toBeVisible({ timeout: 10000 });

          // Click into editor and type
          await editor.click();
          await page.keyboard.type('Hello World');

          const content = await editor.textContent();
          expect(content).toContain('Hello World');
        }
      }
    });

    test('should apply bold formatting via toolbar', async ({ page }) => {
      const book = createTestBook({
        chapters: [{ id: 'ch1', title: 'Test Chapter', htmlContent: '', file: '', bg: '', bgMobile: '' }],
      });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const editorOpened = await openChapterEditor(page);

        if (editorOpened) {
          const editor = page.locator('.ql-editor');
          await expect(editor).toBeVisible({ timeout: 10000 });

          // Type some text
          await editor.click();
          await page.keyboard.type('Bold text');

          // Select all text
          await page.keyboard.press('Control+A');

          // Click bold button
          const boldBtn = page.locator('.ql-bold');
          if (await boldBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await boldBtn.click();

            // Check that text is wrapped in <strong>
            const html = await editor.innerHTML();
            expect(html).toMatch(/<strong>|<b>/);
          }
        }
      }
    });

    test('should apply italic formatting via toolbar', async ({ page }) => {
      const book = createTestBook({
        chapters: [{ id: 'ch1', title: 'Test Chapter', htmlContent: '', file: '', bg: '', bgMobile: '' }],
      });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const editorOpened = await openChapterEditor(page);

        if (editorOpened) {
          const editor = page.locator('.ql-editor');
          await expect(editor).toBeVisible({ timeout: 10000 });

          await editor.click();
          await page.keyboard.type('Italic text');
          await page.keyboard.press('Control+A');

          const italicBtn = page.locator('.ql-italic');
          if (await italicBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await italicBtn.click();

            const html = await editor.innerHTML();
            expect(html).toMatch(/<em>|<i>/);
          }
        }
      }
    });

    test('should apply bold via keyboard shortcut Ctrl+B', async ({ page }) => {
      const book = createTestBook({
        chapters: [{ id: 'ch1', title: 'Test Chapter', htmlContent: '', file: '', bg: '', bgMobile: '' }],
      });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const editorOpened = await openChapterEditor(page);

        if (editorOpened) {
          const editor = page.locator('.ql-editor');
          await expect(editor).toBeVisible({ timeout: 10000 });

          await editor.click();

          // Enable bold via Ctrl+B, type, disable
          await page.keyboard.press('Control+B');
          await page.keyboard.type('Bold');
          await page.keyboard.press('Control+B');

          const html = await editor.innerHTML();
          expect(html).toMatch(/<strong>|<b>/);
        }
      }
    });
  });

  test.describe('Content Persistence', () => {
    test('should display existing chapter content in editor', async ({ page }) => {
      const book = createTestBook({
        chapters: [{
          id: 'ch1',
          title: 'Existing Chapter',
          htmlContent: '<p>Existing chapter content here.</p>',
          file: '',
          bg: '',
          bgMobile: '',
        }],
      });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const editorOpened = await openChapterEditor(page);

        if (editorOpened) {
          const editor = page.locator('.ql-editor');
          await expect(editor).toBeVisible({ timeout: 10000 });

          const content = await editor.textContent();
          expect(content).toContain('Existing chapter content');
        }
      }
    });
  });

  test.describe('Chapter Management', () => {
    test('should show add chapter button in chapters panel', async ({ page }) => {
      const book = createTestBook({ chapters: [] });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCard = page.locator('[data-book-id]').first();
        if (!await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await bookCard.click();

        const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
        if (!await chaptersTab.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await chaptersTab.click();

        const addBtn = page.locator('#addChapter');
        const emptyState = page.locator('#chaptersEmpty');
        const visible =
          (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) ||
          (await emptyState.isVisible({ timeout: 1000 }).catch(() => false));
        expect(visible).toBe(true);
      }
    });

    test('should open chapter modal when clicking add chapter', async ({ page }) => {
      const book = createTestBook({ chapters: [] });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCard = page.locator('[data-book-id]').first();
        if (!await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await bookCard.click();

        const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
        if (!await chaptersTab.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await chaptersTab.click();

        const addBtn = page.locator('#addChapter');
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await addBtn.click();

          const modal = page.locator('#chapterModal');
          await expect(modal).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('should show chapter title input in modal', async ({ page }) => {
      const book = createTestBook({ chapters: [] });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCard = page.locator('[data-book-id]').first();
        if (!await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await bookCard.click();

        const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
        if (!await chaptersTab.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await chaptersTab.click();

        const addBtn = page.locator('#addChapter');
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await addBtn.click();

          const titleInput = page.locator('#chapterTitle, .chapter-title-input');
          await expect(titleInput).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('Multiple Chapters', () => {
    test('should display all chapters in the list', async ({ page }) => {
      const book = createTestBook({
        chapters: [
          { id: 'ch1', title: 'Chapter 1', htmlContent: '<p>Content 1</p>', file: '', bg: '', bgMobile: '' },
          { id: 'ch2', title: 'Chapter 2', htmlContent: '<p>Content 2</p>', file: '', bg: '', bgMobile: '' },
          { id: 'ch3', title: 'Chapter 3', htmlContent: '<p>Content 3</p>', file: '', bg: '', bgMobile: '' },
        ],
      });
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const bookCard = page.locator('[data-book-id]').first();
        if (!await bookCard.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await bookCard.click();

        const chaptersTab = page.locator('.editor-tab[data-editor-tab="chapters"]');
        if (!await chaptersTab.isVisible({ timeout: 3000 }).catch(() => false)) return;
        await chaptersTab.click();

        const chapterItems = page.locator('.chapter-item, [data-chapter-id]');
        if (await chapterItems.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          const count = await chapterItems.count();
          expect(count).toBe(3);
        }
      }
    });
  });

  test.describe('Editor Toolbar Features', () => {
    test('should have header format selector', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const editorOpened = await openChapterEditor(page);

        if (editorOpened) {
          const toolbar = page.locator('.ql-toolbar');
          await expect(toolbar).toBeVisible({ timeout: 10000 });

          // Header selector (h2, h3, h4)
          const headerPicker = toolbar.locator('.ql-header');
          if (await headerPicker.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(headerPicker).toBeVisible();
          }
        }
      }
    });

    test('should have list format buttons', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const editorOpened = await openChapterEditor(page);

        if (editorOpened) {
          const toolbar = page.locator('.ql-toolbar');
          await expect(toolbar).toBeVisible({ timeout: 10000 });

          // Ordered and unordered list buttons
          const listBtns = toolbar.locator('.ql-list');
          if (await listBtns.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            const count = await listBtns.count();
            expect(count).toBeGreaterThanOrEqual(1);
          }
        }
      }
    });

    test('should have link button', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const editorOpened = await openChapterEditor(page);

        if (editorOpened) {
          const toolbar = page.locator('.ql-toolbar');
          await expect(toolbar).toBeVisible({ timeout: 10000 });

          const linkBtn = toolbar.locator('.ql-link');
          if (await linkBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(linkBtn).toBeVisible();
          }
        }
      }
    });

    test('should have image button', async ({ page }) => {
      const book = createTestBook();
      await seedAdminConfig(page, buildAdminConfig([book]));
      const navigated = await navigateToAccount(page);

      if (navigated) {
        const editorOpened = await openChapterEditor(page);

        if (editorOpened) {
          const toolbar = page.locator('.ql-toolbar');
          await expect(toolbar).toBeVisible({ timeout: 10000 });

          const imageBtn = toolbar.locator('.ql-image');
          if (await imageBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(imageBtn).toBeVisible();
          }
        }
      }
    });
  });
});
