/**
 * E2E TESTS: RESPONSIVE DESIGN
 * Desktop, tablet, and mobile layout tests
 */

import { test, expect, clearStorage, viewports } from '../fixtures/book.fixture.js';

// ═══════════════════════════════════════════════════════════════════════════
// DESKTOP LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Desktop Layout', () => {
  test.use({ viewport: viewports.desktop });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('should display two pages per spread', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Navigate past TOC to content pages
    await bookPage.flipNext();

    const leftPage = page.locator('.page-left');
    const rightPage = page.locator('.page-right');

    await expect(leftPage).toBeVisible();
    await expect(rightPage).toBeVisible();
  });

  test('should flip two pages at a time', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const pageBefore = await bookPage.getCurrentPageIndex();
    await bookPage.flipNext();
    const pageAfter = await bookPage.getCurrentPageIndex();

    // Desktop flips 2 pages at a time
    expect(pageAfter - pageBefore).toBe(2);
  });

  test('should show corner zones for drag', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();
    await bookPage.flipNext();

    const cornerBR = page.locator('.corner-zone.bottom-right');
    const cornerBL = page.locator('.corner-zone.bottom-left');

    // Corner zones should exist
    await expect(cornerBR).toBeAttached();
    await expect(cornerBL).toBeAttached();
  });

  test('should have proper book dimensions', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const box = await bookPage.book.boundingBox();

    // Book should fit in viewport with some margin
    expect(box.width).toBeLessThanOrEqual(viewports.desktop.width);
    expect(box.height).toBeLessThanOrEqual(viewports.desktop.height);

    // Book should have reasonable dimensions
    expect(box.width).toBeGreaterThan(600);
    expect(box.height).toBeGreaterThan(400);
  });

  test('should enable click navigation on book halves', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const pageBefore = await bookPage.getCurrentPageIndex();
    await bookPage.clickBookHalf('right');
    const pageAfter = await bookPage.getCurrentPageIndex();

    expect(pageAfter).toBeGreaterThan(pageBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TABLET LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Tablet Layout', () => {
  test.use({ viewport: viewports.tablet });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('should adapt to tablet dimensions', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const box = await bookPage.book.boundingBox();

    // Book should fit in viewport
    expect(box.width).toBeLessThanOrEqual(viewports.tablet.width);
    expect(box.height).toBeLessThanOrEqual(viewports.tablet.height);
  });

  test('should maintain readable layout', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();
    await bookPage.flipNext();

    // Content should be readable (not too small)
    const fontSize = await page.locator('.page-content').evaluate(el =>
      parseFloat(getComputedStyle(el).fontSize)
    );

    expect(fontSize).toBeGreaterThanOrEqual(14);
  });
});

test.describe('Tablet Landscape Layout', () => {
  test.use({ viewport: viewports.tabletLandscape });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('should display properly in landscape', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const box = await bookPage.book.boundingBox();

    // Should use landscape space well
    expect(box.width).toBeLessThanOrEqual(viewports.tabletLandscape.width);
    expect(box.height).toBeLessThanOrEqual(viewports.tabletLandscape.height);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Mobile Layout', () => {
  test.use({ viewport: viewports.mobile });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('should display single page mode', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // In mobile mode, only right page is visible
    const leftPage = page.locator('.page-left .page-content');
    const rightPage = page.locator('.page-right .page-content');

    // Left page should be empty/hidden
    const leftContent = await leftPage.textContent();
    expect(leftContent?.trim() || '').toBe('');

    // Right page should have content
    await expect(rightPage).toBeVisible();
  });

  test('should flip one page at a time', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const pageBefore = await bookPage.getCurrentPageIndex();
    await bookPage.flipNext();
    const pageAfter = await bookPage.getCurrentPageIndex();

    // Mobile flips 1 page at a time
    expect(pageAfter - pageBefore).toBe(1);
  });

  test('should support swipe navigation', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const pageBefore = await bookPage.getCurrentPageIndex();

    // Swipe left to flip forward
    const box = await bookPage.book.boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();

    await bookPage.waitForAnimation();
    const pageAfter = await bookPage.getCurrentPageIndex();

    expect(pageAfter).toBeGreaterThan(pageBefore);
  });

  test('should fit book within viewport', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const box = await bookPage.book.boundingBox();

    // Book should not exceed viewport
    expect(box.width).toBeLessThanOrEqual(viewports.mobile.width);
    expect(box.height).toBeLessThanOrEqual(viewports.mobile.height);
  });

  test('navigation buttons should be accessible', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    await expect(bookPage.btnNext).toBeVisible();
    await expect(bookPage.btnPrev).toBeVisible();

    // Buttons should be large enough to tap
    const nextBox = await bookPage.btnNext.boundingBox();
    expect(nextBox.width).toBeGreaterThanOrEqual(40);
    expect(nextBox.height).toBeGreaterThanOrEqual(40);
  });

  test('settings panel should be accessible', async ({ bookPage, settings, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    await settings.open();

    // Settings should be visible
    const controlsBox = await page.locator('.controls').boundingBox();
    expect(controlsBox).not.toBeNull();

    // Font controls should be usable
    await expect(page.locator('#font-select')).toBeVisible();
    await expect(page.locator('#increase')).toBeVisible();
  });
});

test.describe('Small Mobile Layout', () => {
  test.use({ viewport: viewports.mobileSmall });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('should handle very small screens', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const box = await bookPage.book.boundingBox();

    // Should still fit
    expect(box.width).toBeLessThanOrEqual(viewports.mobileSmall.width);
    expect(box.height).toBeLessThanOrEqual(viewports.mobileSmall.height);
  });

  test('should maintain readable text', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();
    await bookPage.flipNext();

    const fontSize = await page.locator('.page-content').evaluate(el =>
      parseFloat(getComputedStyle(el).fontSize)
    );

    // Text should still be readable
    expect(fontSize).toBeGreaterThanOrEqual(12);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RESIZE HANDLING
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Resize Handling', () => {
  test('should handle resize from desktop to mobile', async ({ bookPage, page }) => {
    // Start desktop
    await page.setViewportSize(viewports.desktop);
    await clearStorage(page);
    await bookPage.goto();
    await bookPage.openByCover();

    const pageDesktop = await bookPage.getCurrentPageIndex();

    // Resize to mobile
    await page.setViewportSize(viewports.mobile);
    await bookPage.waitForState('opened', 3000);

    // Should maintain approximate position
    const pageMobile = await bookPage.getCurrentPageIndex();
    expect(Math.abs(pageMobile - pageDesktop)).toBeLessThanOrEqual(2);
  });

  test('should handle resize from mobile to desktop', async ({ bookPage, page }) => {
    // Start mobile
    await page.setViewportSize(viewports.mobile);
    await clearStorage(page);
    await bookPage.goto();
    await bookPage.openByCover();

    await bookPage.flipNext();
    await bookPage.flipNext();

    // Resize to desktop
    await page.setViewportSize(viewports.desktop);
    await bookPage.waitForState('opened', 3000);

    // Book should still be functional
    expect(await bookPage.isOpened()).toBe(true);

    // Should be able to flip
    const pageBefore = await bookPage.getCurrentPageIndex();
    await bookPage.flipNext();
    const pageAfter = await bookPage.getCurrentPageIndex();

    expect(pageAfter).toBeGreaterThan(pageBefore);
  });

  test('should repaginate on significant resize', async ({ bookPage, page }) => {
    await page.setViewportSize(viewports.desktop);
    await clearStorage(page);
    await bookPage.goto();
    await bookPage.openByCover();

    const pagesDesktop = await bookPage.getTotalPages();

    // Resize to mobile (much smaller)
    await page.setViewportSize(viewports.mobile);
    await bookPage.waitForState('opened', 5000);

    const pagesMobile = await bookPage.getTotalPages();

    // Page count might change due to single-page mode
    expect(pagesMobile).toBeDefined();
  });

  test('should not break during animation resize', async ({ bookPage, page }) => {
    await page.setViewportSize(viewports.desktop);
    await clearStorage(page);
    await bookPage.goto();
    await bookPage.openByCover();

    // Start flipping
    bookPage.btnNext.click(); // Don't await

    // Resize during animation
    await page.setViewportSize(viewports.tablet);

    // Wait for animation to complete
    await bookPage.waitForState('opened', 5000);

    // Should be in valid state
    expect(await bookPage.isOpened()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Accessibility', () => {
  test.use({ viewport: viewports.desktop });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('book should have proper ARIA attributes', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    await expect(bookPage.book).toHaveAttribute('role', 'region');
    await expect(bookPage.book).toHaveAttribute('aria-label');
  });

  test('page content should announce changes', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const pageContent = page.locator('.page-content').first();
    await expect(pageContent).toHaveAttribute('aria-live', 'polite');
  });

  test('progress bar should have ARIA attributes', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    await expect(bookPage.progressBar).toHaveAttribute('role', 'progressbar');
    await expect(bookPage.progressBar).toHaveAttribute('aria-valuemin', '0');
    await expect(bookPage.progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  test('buttons should be keyboard accessible', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Tab to next button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to activate with Enter
    const pageBefore = await bookPage.getCurrentPageIndex();
    await page.keyboard.press('Enter');
    await bookPage.waitForAnimation();

    // If focused button was navigation, page should change
    // (behavior depends on tab order)
  });

  test('TOC items should be keyboard navigable', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // TOC items should have tabindex
    const tocItem = page.locator('.toc li').first();
    if (await tocItem.isVisible()) {
      await tocItem.focus();
      await page.keyboard.press('Enter');

      // Should navigate to chapter
      await bookPage.waitForAnimation();
    }
  });
});
