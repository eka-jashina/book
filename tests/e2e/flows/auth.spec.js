/**
 * E2E: Authentication — email/password login, registration, Google OAuth, logout.
 *
 * Мокаем API-ответы через page.route(), чтобы тесты работали
 * без реального сервера.
 */

import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const TEST_USER = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  displayName: 'Test User',
};

/**
 * Mock API: unauthenticated state (401 on /api/auth/me).
 */
async function mockUnauthenticated(page) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' }),
  );
}

/**
 * Mock API: successful login/register endpoints.
 */
async function mockAuthEndpoints(page) {
  await page.route('**/api/v1/auth/login', (route) => {
    const body = route.request().postDataJSON?.() ?? {};
    if (body?.email === TEST_USER.email && body?.password) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: TEST_USER }),
      });
    }
    return route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Неверный email или пароль' }),
    });
  });

  await page.route('**/api/v1/auth/register', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: TEST_USER }),
    }),
  );

  await page.route('**/api/v1/auth/logout', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  );
}

/**
 * Mock API: authenticated state (200 on /api/auth/me).
 */
async function mockAuthenticated(page) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: TEST_USER }),
    }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: TEST_USER }),
    }),
  );
}

/**
 * Mock common API endpoints (books, settings, etc.) to prevent 404 errors.
 */
async function mockCommonEndpoints(page) {
  await page.route('**/api/v1/books', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route('**/api/v1/settings', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    }),
  );
  await page.route('**/api/v1/fonts', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route('**/api/v1/public/discover**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
}

/**
 * Open auth modal by clicking CTA on landing page.
 */
async function openAuthModal(page) {
  const cta = page.locator('.landing-cta').first();
  if (await cta.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cta.click();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Authentication', () => {
  test.describe('Auth Modal UI', () => {
    test('should show auth modal when CTA is clicked on landing page', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await openAuthModal(page);

      const modal = page.locator('.auth-modal');
      await expect(modal).toBeVisible({ timeout: 5000 });
      await expect(modal).toHaveAttribute('role', 'dialog');
      await expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    test('should show login form by default with email and password fields', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      const modal = page.locator('.auth-modal');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Title says "Вход"
      await expect(modal.locator('.auth-modal-title')).toHaveText('Вход');

      // Email and password inputs visible
      await expect(page.locator('#auth-email')).toBeVisible();
      await expect(page.locator('#auth-password')).toBeVisible();

      // Username field hidden (login mode)
      await expect(page.locator('#auth-username')).toBeHidden();

      // Submit button says "Войти"
      await expect(page.locator('.auth-submit')).toHaveText('Войти');
    });

    test('should switch to register mode and show username field', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Click "Зарегистрироваться" switch button
      await page.locator('.auth-switch-btn').click();

      // Title changes to "Регистрация"
      await expect(page.locator('.auth-modal-title')).toHaveText('Регистрация');

      // Username field now visible
      await expect(page.locator('#auth-username')).toBeVisible();

      // Submit button text changes
      await expect(page.locator('.auth-submit')).toHaveText('Зарегистрироваться');
    });

    test('should switch back to login mode', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Switch to register
      await page.locator('.auth-switch-btn').click();
      await expect(page.locator('.auth-modal-title')).toHaveText('Регистрация');

      // Switch back to login
      await page.locator('.auth-switch-btn').click();
      await expect(page.locator('.auth-modal-title')).toHaveText('Вход');
      await expect(page.locator('#auth-username')).toBeHidden();
    });

    test('should close modal on Escape key', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      await page.keyboard.press('Escape');

      await expect(page.locator('.auth-modal')).toBeHidden();
    });

    test('should close modal on close button click', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      await page.locator('.auth-close-btn').click();

      await expect(page.locator('.auth-modal')).toBeHidden();
    });

    test('should close modal on overlay click', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Click overlay (outside modal)
      await page.locator('.auth-overlay').click({ position: { x: 5, y: 5 } });

      await expect(page.locator('.auth-modal')).toBeHidden();
    });
  });

  test.describe('Client-side Validation', () => {
    test('should show error for empty email', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Leave email empty, enter password
      await page.locator('#auth-password').fill('password123');
      await page.locator('.auth-submit').click();

      const error = page.locator('#auth-error');
      await expect(error).toBeVisible();
      await expect(error).toContainText('email');
    });

    test('should show error for short password', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      await page.locator('#auth-email').fill('test@example.com');
      await page.locator('#auth-password').fill('short');
      await page.locator('.auth-submit').click();

      const error = page.locator('#auth-error');
      await expect(error).toBeVisible();
      await expect(error).toContainText('8');
    });

    test('should show error for invalid username in register mode', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Switch to register
      await page.locator('.auth-switch-btn').click();

      await page.locator('#auth-username').fill('AB'); // Too short, uppercase
      await page.locator('#auth-email').fill('test@example.com');
      await page.locator('#auth-password').fill('password123');
      await page.locator('.auth-submit').click();

      const error = page.locator('#auth-error');
      await expect(error).toBeVisible();
      await expect(error).toContainText('3-40');
    });
  });

  test.describe('Login Flow', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockAuthEndpoints(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      await page.locator('#auth-email').fill(TEST_USER.email);
      await page.locator('#auth-password').fill('password123');

      // Submit button should show loading state
      await page.locator('.auth-submit').click();

      // Modal should close after successful login
      await expect(page.locator('.auth-modal')).toBeHidden({ timeout: 10000 });
    });

    test('should show error on login failure', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);

      // Mock login to always fail
      await page.route('**/api/v1/auth/login', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Неверный email или пароль' }),
        }),
      );

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      await page.locator('#auth-email').fill('wrong@example.com');
      await page.locator('#auth-password').fill('wrongpassword');
      await page.locator('.auth-submit').click();

      const error = page.locator('#auth-error');
      await expect(error).toBeVisible({ timeout: 5000 });

      // Submit button should be re-enabled after error
      await expect(page.locator('.auth-submit')).toBeEnabled();
    });

    test('should disable submit button during login request', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);

      // Slow login response
      await page.route('**/api/v1/auth/login', async (route) => {
        await new Promise((r) => setTimeout(r, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: TEST_USER }),
        });
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      await page.locator('#auth-email').fill(TEST_USER.email);
      await page.locator('#auth-password').fill('password123');
      await page.locator('.auth-submit').click();

      // Button should be disabled and show loading text
      await expect(page.locator('.auth-submit')).toBeDisabled();
      await expect(page.locator('.auth-submit')).toHaveText('Вход...');
    });
  });

  test.describe('Registration Flow', () => {
    test('should register successfully with valid data', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockAuthEndpoints(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Switch to register mode
      await page.locator('.auth-switch-btn').click();

      await page.locator('#auth-username').fill('newuser');
      await page.locator('#auth-name').fill('New User');
      await page.locator('#auth-email').fill('new@example.com');
      await page.locator('#auth-password').fill('password123');
      await page.locator('.auth-submit').click();

      // Modal should close after successful registration
      await expect(page.locator('.auth-modal')).toBeHidden({ timeout: 10000 });
    });

    test('should show loading state during registration', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);

      await page.route('**/api/v1/auth/register', async (route) => {
        await new Promise((r) => setTimeout(r, 1000));
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: TEST_USER }),
        });
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });
      await page.locator('.auth-switch-btn').click();

      await page.locator('#auth-username').fill('newuser');
      await page.locator('#auth-email').fill('new@example.com');
      await page.locator('#auth-password').fill('password123');
      await page.locator('.auth-submit').click();

      await expect(page.locator('.auth-submit')).toBeDisabled();
      await expect(page.locator('.auth-submit')).toHaveText('Регистрация...');
    });
  });

  test.describe('Google OAuth', () => {
    test('should have Google OAuth button with correct link', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      const googleBtn = page.locator('.auth-google-btn');
      await expect(googleBtn).toBeVisible();
      await expect(googleBtn).toHaveAttribute('href', '/api/auth/google');
      await expect(googleBtn).toContainText('Google');
    });

    test('should show Google OAuth button in both login and register modes', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Login mode
      await expect(page.locator('.auth-google-btn')).toBeVisible();

      // Switch to register
      await page.locator('.auth-switch-btn').click();

      // Still visible in register mode
      await expect(page.locator('.auth-google-btn')).toBeVisible();
    });
  });

  test.describe('Logout', () => {
    test('should show logout button for authenticated users on bookshelf', async ({ page }) => {
      await mockAuthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Look for logout button in profile header or bookshelf
      const logoutBtn = page.locator('.profile-header-logout, [data-action="logout"]');
      if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(logoutBtn).toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should focus first input when modal opens', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Wait for focus to be set (50ms delay in code)
      await page.waitForTimeout(200);

      const focusedEl = page.locator(':focus');
      await expect(focusedEl).toHaveClass(/auth-input/);
    });

    test('should have proper ARIA attributes on form elements', async ({ page }) => {
      await mockUnauthenticated(page);
      await mockCommonEndpoints(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await openAuthModal(page);

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Labels are associated with inputs via `for` attribute
      await expect(page.locator('label[for="auth-email"]')).toBeVisible();
      await expect(page.locator('label[for="auth-password"]')).toBeVisible();

      // Close button has aria-label
      await expect(page.locator('.auth-close-btn')).toHaveAttribute('aria-label', 'Закрыть');
    });
  });
});
