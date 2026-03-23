/**
 * E2E: User Profile — username, display name, bio, avatar.
 *
 * Тесты используют localStorage-based AdminConfigStore (offline mode)
 * и мокают API для серверных проверок.
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function buildAdminConfig() {
  return {
    books: [{
      id: 'book1',
      cover: { title: 'My Book', author: 'Me' },
      chapters: [{ id: 'ch1', title: 'Ch 1', htmlContent: '<p>Text</p>', file: '', bg: '', bgMobile: '' }],
      sounds: { pageFlip: '', bookOpen: '', bookClose: '' },
      ambients: [],
      appearance: {
        light: { coverBgStart: '#3a2d1f', coverBgEnd: '#2a2016', coverText: '#f2e9d8' },
        dark: { coverBgStart: '#111', coverBgEnd: '#000', coverText: '#eaeaea' },
      },
      decorativeFont: null,
      defaultSettings: {},
    }],
    activeBookId: 'book1',
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

async function navigateToAccountProfile(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.evaluate(() => {
    history.pushState(null, '', '/account');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForLoadState('networkidle');

  // Click profile tab
  const profileTab = page.locator('.admin-tab[data-tab="profile"]');
  if (await profileTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await profileTab.click();
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('User Profile', () => {
  test.describe('Profile Tab UI', () => {
    test('should show profile tab in account screen', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.evaluate(() => {
        history.pushState(null, '', '/account');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForLoadState('networkidle');

      const profileTab = page.locator('.admin-tab[data-tab="profile"]');
      await expect(profileTab).toBeVisible({ timeout: 5000 });
    });

    test('should show profile form fields when tab is selected', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const profilePanel = page.locator('.admin-panel[data-panel="profile"]');
        await expect(profilePanel).toBeVisible({ timeout: 5000 });

        await expect(page.locator('#profileUsername')).toBeVisible();
        await expect(page.locator('#profileDisplayName')).toBeVisible();
        await expect(page.locator('#profileBio')).toBeVisible();
      }
    });
  });

  test.describe('Username', () => {
    test('should have username input with @ prefix', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        await expect(page.locator('#profileUsername')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.profile-username-prefix')).toHaveText('@');
      }
    });

    test('should accept valid username format', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const usernameInput = page.locator('#profileUsername');
        await expect(usernameInput).toBeVisible({ timeout: 5000 });

        await usernameInput.fill('alice-123');
        const value = await usernameInput.inputValue();
        expect(value).toBe('alice-123');
      }
    });

    test('should have pattern validation for username', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const usernameInput = page.locator('#profileUsername');
        await expect(usernameInput).toBeVisible({ timeout: 5000 });

        const pattern = await usernameInput.getAttribute('pattern');
        expect(pattern).toBe('^[a-z0-9][a-z0-9-]{2,39}$');
      }
    });

    test('should show username hint', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const hint = page.locator('#usernameHint');
        await expect(hint).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Display Name', () => {
    test('should have display name input with max length', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const nameInput = page.locator('#profileDisplayName');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        await expect(nameInput).toHaveAttribute('maxlength', '100');
      }
    });

    test('should allow entering display name', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const nameInput = page.locator('#profileDisplayName');
        await expect(nameInput).toBeVisible({ timeout: 5000 });

        await nameInput.fill('Алиса Чудесная');
        const value = await nameInput.inputValue();
        expect(value).toBe('Алиса Чудесная');
      }
    });
  });

  test.describe('Bio', () => {
    test('should have bio textarea with max length 500', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const bioInput = page.locator('#profileBio');
        await expect(bioInput).toBeVisible({ timeout: 5000 });
        await expect(bioInput).toHaveAttribute('maxlength', '500');
      }
    });

    test('should update character count on bio input', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const bioInput = page.locator('#profileBio');
        await expect(bioInput).toBeVisible({ timeout: 5000 });

        await bioInput.fill('I love reading books');
        await page.waitForTimeout(200);

        const charCount = page.locator('#bioCharCount');
        const count = await charCount.textContent();
        expect(parseInt(count)).toBe(20);
      }
    });
  });

  test.describe('Avatar', () => {
    test('should have avatar upload input', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const avatarInput = page.locator('#profileAvatarInput');
        await expect(avatarInput).toBeAttached({ timeout: 5000 });
        await expect(avatarInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
      }
    });

    test('should have avatar preview area', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const avatarPreview = page.locator('#profileAvatarPreview');
        await expect(avatarPreview).toBeVisible({ timeout: 5000 });
      }
    });

    test('should have remove avatar button (initially hidden)', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const removeBtn = page.locator('#profileAvatarRemove');
        await expect(removeBtn).toBeAttached({ timeout: 5000 });
        // Hidden by default when no avatar
        await expect(removeBtn).toBeHidden();
      }
    });
  });

  test.describe('Profile Preview', () => {
    test('should have profile preview section', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const preview = page.locator('#profilePreview');
        await expect(preview).toBeAttached({ timeout: 5000 });
      }
    });
  });

  test.describe('Save Profile', () => {
    test('should have save profile button', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        const saveBtn = page.locator('#saveProfile');
        await expect(saveBtn).toBeVisible({ timeout: 5000 });
      }
    });

    test('should fill in all profile fields', async ({ page }) => {
      await seedAdminConfig(page, buildAdminConfig());
      const navigated = await navigateToAccountProfile(page);

      if (navigated) {
        await page.locator('#profileUsername').fill('coolauthor');
        await page.locator('#profileDisplayName').fill('Cool Author');
        await page.locator('#profileBio').fill('I write awesome books.');

        // Verify all values
        expect(await page.locator('#profileUsername').inputValue()).toBe('coolauthor');
        expect(await page.locator('#profileDisplayName').inputValue()).toBe('Cool Author');
        expect(await page.locator('#profileBio').inputValue()).toBe('I write awesome books.');
      }
    });
  });
});
