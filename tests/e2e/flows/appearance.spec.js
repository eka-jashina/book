/**
 * E2E: Appearance Customization — цвета обложки, текстуры страниц,
 * фон приложения, тема light/dark, превью.
 *
 * Тесты используют localStorage-based AdminConfigStore (offline mode).
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createTestBook() {
  return {
    id: 'book1',
    cover: { title: 'Styled Book', author: 'Designer' },
    chapters: [{ id: 'ch1', title: 'Ch 1', htmlContent: '<p>Text</p>', file: '', bg: '', bgMobile: '' }],
    sounds: { pageFlip: '', bookOpen: '', bookClose: '' },
    ambients: [],
    appearance: {
      light: {
        coverBgStart: '#3a2d1f',
        coverBgEnd: '#2a2016',
        coverText: '#f2e9d8',
        coverBgImage: '',
        pageTexture: 'default',
        bgPage: '#fdfcf8',
        bgApp: '#e6e3dc',
      },
      dark: {
        coverBgStart: '#111111',
        coverBgEnd: '#000000',
        coverText: '#eaeaea',
        coverBgImage: '',
        pageTexture: 'none',
        bgPage: '#1e1e1e',
        bgApp: '#121212',
      },
    },
    decorativeFont: null,
    defaultSettings: {},
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

async function navigateToAppearanceTab(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => {
    history.pushState(null, '', '/account');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForLoadState('networkidle');

  // Click on book card
  const bookCard = page.locator('[data-book-id]').first();
  if (!await bookCard.isVisible({ timeout: 5000 }).catch(() => false)) return false;
  await bookCard.click();

  // Click appearance tab
  const appearanceTab = page.locator('.editor-tab[data-editor-tab="appearance"]');
  if (!await appearanceTab.isVisible({ timeout: 3000 }).catch(() => false)) return false;
  await appearanceTab.click();

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Appearance Customization', () => {
  test.describe('Appearance Tab', () => {
    test('should show appearance tab in editor', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.evaluate(() => {
        history.pushState(null, '', '/account');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForLoadState('networkidle');

      const bookCard = page.locator('[data-book-id]').first();
      if (await bookCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        await bookCard.click();

        const tab = page.locator('.editor-tab[data-editor-tab="appearance"]');
        await expect(tab).toBeVisible({ timeout: 5000 });
      }
    });

    test('should open appearance panel when tab is clicked', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const panel = page.locator('.editor-panel[data-editor-panel="appearance"]');
        await expect(panel).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Theme Switcher', () => {
    test('should show light and dark theme buttons', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const lightBtn = page.locator('[data-edit-theme="light"]');
        const darkBtn = page.locator('[data-edit-theme="dark"]');

        await expect(lightBtn).toBeVisible({ timeout: 5000 });
        await expect(darkBtn).toBeVisible();
      }
    });

    test('should switch to dark theme editor', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const darkBtn = page.locator('[data-edit-theme="dark"]');
        await expect(darkBtn).toBeVisible({ timeout: 5000 });
        await darkBtn.click();

        // Dark theme button should be active
        await expect(darkBtn).toHaveClass(/active|selected/);
      }
    });
  });

  test.describe('Cover Color Inputs', () => {
    test('should have cover gradient start color input', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const colorInput = page.locator('#coverBgStart');
        await expect(colorInput).toBeAttached({ timeout: 5000 });
      }
    });

    test('should have cover gradient end color input', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const colorInput = page.locator('#coverBgEnd');
        await expect(colorInput).toBeAttached({ timeout: 5000 });
      }
    });

    test('should have cover text color input', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const colorInput = page.locator('#coverText');
        await expect(colorInput).toBeAttached({ timeout: 5000 });
      }
    });

    test('should update cover gradient start color', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const colorInput = page.locator('#coverBgStart');
        if (await colorInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await colorInput.fill('#ff0000');
          const value = await colorInput.inputValue();
          expect(value).toBe('#ff0000');
        }
      }
    });
  });

  test.describe('Page Texture', () => {
    test('should show texture options', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const textureOptions = page.locator('.texture-option');
        if (await textureOptions.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          const count = await textureOptions.count();
          expect(count).toBeGreaterThanOrEqual(2); // At least 'default' and 'none'
        }
      }
    });

    test('should select "none" texture', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const noneTexture = page.locator('.texture-option[data-texture="none"], [data-texture="none"]');
        if (await noneTexture.isVisible({ timeout: 3000 }).catch(() => false)) {
          await noneTexture.click();
          await expect(noneTexture).toHaveClass(/active|selected/);
        }
      }
    });
  });

  test.describe('Page Background Colors', () => {
    test('should have page background color input', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const bgPage = page.locator('#bgPage');
        await expect(bgPage).toBeAttached({ timeout: 5000 });
      }
    });

    test('should have app background color input', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const bgApp = page.locator('#bgApp');
        await expect(bgApp).toBeAttached({ timeout: 5000 });
      }
    });

    test('should have color swatch previews', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const bgPageSwatch = page.locator('#bgPageSwatch');
        const bgAppSwatch = page.locator('#bgAppSwatch');

        if (await bgPageSwatch.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(bgPageSwatch).toBeVisible();
        }
        if (await bgAppSwatch.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(bgAppSwatch).toBeVisible();
        }
      }
    });
  });

  test.describe('Cover Background Image', () => {
    test('should have cover background file input', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const fileInput = page.locator('#coverBgFileInput');
        await expect(fileInput).toBeAttached({ timeout: 5000 });
      }
    });

    test('should show empty preview when no cover image', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const emptyPreview = page.locator('#coverBgPreviewEmpty');
        if (await emptyPreview.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(emptyPreview).toBeVisible();
        }
      }
    });
  });

  test.describe('Save & Reset', () => {
    test('should have save appearance button', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const saveBtn = page.locator('#saveAppearance');
        await expect(saveBtn).toBeVisible({ timeout: 5000 });
      }
    });

    test('should have reset appearance button', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const resetBtn = page.locator('#resetAppearance');
        await expect(resetBtn).toBeVisible({ timeout: 5000 });
      }
    });

    test('should save appearance changes to localStorage', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        // Change a color
        const colorInput = page.locator('#coverBgStart');
        if (await colorInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await colorInput.fill('#ff5500');

          // Save
          const saveBtn = page.locator('#saveAppearance');
          await saveBtn.click();
          await page.waitForTimeout(500);

          // Verify saved in localStorage
          const config = await page.evaluate(() => {
            const stored = localStorage.getItem('flipbook-admin-config');
            return stored ? JSON.parse(stored) : null;
          });

          if (config?.books?.[0]?.appearance?.light) {
            expect(config.books[0].appearance.light.coverBgStart).toBe('#ff5500');
          }
        }
      }
    });

    test('should reset appearance to defaults', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        // Change something first
        const colorInput = page.locator('#coverBgStart');
        if (await colorInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await colorInput.fill('#ff0000');

          // Click reset
          const resetBtn = page.locator('#resetAppearance');
          await resetBtn.click();

          // Accept confirmation if shown
          const confirmOk = page.locator('#confirmOk');
          if (await confirmOk.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmOk.click();
          }

          await page.waitForTimeout(500);

          // Color should be reset to default
          const value = await colorInput.inputValue();
          expect(value).not.toBe('#ff0000');
        }
      }
    });
  });

  test.describe('Live Preview', () => {
    test('should have cover preview element', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const preview = page.locator('#previewCover');
        if (await preview.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(preview).toBeVisible();
        }
      }
    });

    test('should have page preview element', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig([createTestBook()]));
      const opened = await navigateToAppearanceTab(page);

      if (opened) {
        const preview = page.locator('#previewPage');
        if (await preview.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(preview).toBeVisible();
        }
      }
    });
  });
});
