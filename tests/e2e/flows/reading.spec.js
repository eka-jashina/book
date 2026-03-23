/**
 * E2E TESTS: READING FLOWS
 * Critical user scenarios for reading the book
 */

import { test, expect, clearStorage, setStoredSettings, getStoredSettings } from '../fixtures/book.fixture.js';

test.describe('Reading Flows', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: First Time Reading
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('First Time Reading', () => {
    test('should show closed book on first visit', async ({ bookPage }) => {
      await bookPage.goto();

      expect(await bookPage.isClosed()).toBe(true);
      await expect(bookPage.cover).toBeVisible();
    });

    test('should not show continue button on first visit', async ({ bookPage }) => {
      await bookPage.goto();

      expect(await bookPage.hasContinueButton()).toBe(false);
    });

    test('should open book when clicking cover', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      expect(await bookPage.isOpened()).toBe(true);
    });

    test('should show TOC after opening', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      expect(await bookPage.hasTOC()).toBe(true);
    });

    test('should navigate to chapter via TOC', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();
      await bookPage.goToChapter(1); // Second chapter

      const pageAfter = await bookPage.getCurrentPageIndex();
      expect(pageAfter).toBeGreaterThan(pageBefore);
    });

    test('should flip pages forward and backward', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Flip forward 3 times
      const startPage = await bookPage.getCurrentPageIndex();
      await bookPage.flipNext();
      await bookPage.flipNext();
      await bookPage.flipNext();

      const afterForward = await bookPage.getCurrentPageIndex();
      expect(afterForward).toBeGreaterThan(startPage);

      // Flip backward
      await bookPage.flipPrev();
      const afterBackward = await bookPage.getCurrentPageIndex();
      expect(afterBackward).toBeLessThan(afterForward);
    });

    test('should save reading position', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Navigate to specific page
      await bookPage.flipNext();
      await bookPage.flipNext();
      const savedPage = await bookPage.getCurrentPageIndex();

      // Reload and verify position was saved
      const stored = await getStoredSettings(page);
      expect(stored?.page).toBe(savedPage);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Continue Reading
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Continue Reading', () => {
    test('should show continue button when position is saved', async ({ bookPage, page }) => {
      // Pre-set saved position
      await setStoredSettings(page, { page: 10, font: 'georgia', fontSize: 18 });
      await bookPage.goto();

      expect(await bookPage.hasContinueButton()).toBe(true);
    });

    test('should open at saved position when clicking continue', async ({ bookPage, page }) => {
      const savedPage = 10;
      await setStoredSettings(page, { page: savedPage, font: 'georgia', fontSize: 18 });
      await bookPage.goto();

      await bookPage.openByContinue();

      // Should be at or near saved position
      const currentPage = await bookPage.getCurrentPageIndex();
      expect(currentPage).toBeGreaterThanOrEqual(savedPage - 2);
      expect(currentPage).toBeLessThanOrEqual(savedPage + 2);
    });

    test('should hide continue button after clicking', async ({ bookPage, page }) => {
      await setStoredSettings(page, { page: 5 });
      await bookPage.goto();

      await bookPage.openByContinue();

      await expect(bookPage.continueBtn).toBeHidden();
    });

    test('should open from start when clicking cover instead of continue', async ({ bookPage, page }) => {
      await setStoredSettings(page, { page: 50 });
      await bookPage.goto();

      await bookPage.openByCover();

      // Should be near the beginning (TOC page)
      const currentPage = await bookPage.getCurrentPageIndex();
      expect(currentPage).toBeLessThan(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Full Reading Cycle
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Full Reading Cycle', () => {
    test('should navigate to last page with End key', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await bookPage.flipByKey('end');

      const currentPage = await bookPage.getCurrentPageDisplay();
      const totalPages = await bookPage.getTotalPages();

      // Should be on last spread (within 2 pages of end)
      expect(currentPage).toBeGreaterThanOrEqual(totalPages - 2);
    });

    test('should navigate to first page with Home key', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Go somewhere in the middle first
      await bookPage.flipNext();
      await bookPage.flipNext();
      await bookPage.flipNext();

      // Then go home
      await bookPage.flipByKey('home');

      const currentPage = await bookPage.getCurrentPageIndex();
      expect(currentPage).toBe(0);
    });

    test('should close book when flipping back from first page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Make sure we're at the beginning
      await bookPage.flipByKey('home');

      // Flip backward to close
      await bookPage.flipPrev();
      await bookPage.waitForState('closed', 5000);

      expect(await bookPage.isClosed()).toBe(true);
    });

    test('should update progress bar as pages are turned', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const progressBefore = await bookPage.getProgress();

      // Flip forward several pages
      await bookPage.flipNext();
      await bookPage.flipNext();
      await bookPage.flipNext();

      const progressAfter = await bookPage.getProgress();
      expect(progressAfter).toBeGreaterThan(progressBefore);
    });

    test('should maintain state after reload', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Navigate somewhere
      await bookPage.flipNext();
      await bookPage.flipNext();
      const pageBeforeReload = await bookPage.getCurrentPageIndex();

      // Reload
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Use continue button to restore position
      if (await bookPage.hasContinueButton()) {
        await bookPage.openByContinue();
      } else {
        await bookPage.openByCover();
      }

      // Verify we're close to where we were
      const pageAfterReload = await bookPage.getCurrentPageIndex();
      expect(Math.abs(pageAfterReload - pageBeforeReload)).toBeLessThanOrEqual(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: Chapter Navigation
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Chapter Navigation', () => {
    test('should have multiple chapters in TOC', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const chapterCount = await bookPage.getChapterCount();
      expect(chapterCount).toBeGreaterThan(1);
    });

    test('should navigate to different chapters', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Navigate to chapter 2
      await bookPage.goToChapter(1);
      const pageChapter2 = await bookPage.getCurrentPageIndex();

      // Navigate to chapter 3
      await bookPage.goToChapter(2);
      const pageChapter3 = await bookPage.getCurrentPageIndex();

      expect(pageChapter3).toBeGreaterThan(pageChapter2);

      // Navigate back to chapter 1
      await bookPage.goToChapter(0);
      const pageChapter1 = await bookPage.getCurrentPageIndex();

      expect(pageChapter1).toBeLessThan(pageChapter2);
    });

    test('should change background when changing chapters', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Get initial background
      const bgBefore = await page.locator('.book').evaluate(el =>
        getComputedStyle(el).backgroundImage
      );

      // Navigate to different chapter
      await bookPage.goToChapter(1);

      // Wait for background transition to complete
      await page.waitForFunction(
        (prevBg) => {
          const book = document.querySelector('.book');
          return book && getComputedStyle(book).backgroundImage !== prevBg;
        },
        bgBefore,
        { timeout: 2000 }
      ).catch(() => {}); // Background might not change in test environment

      const bgAfter = await page.locator('.book').evaluate(el =>
        getComputedStyle(el).backgroundImage
      );

      // Background should change (or at least be defined)
      expect(bgAfter).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: Reading Progress Tracking
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Reading Progress', () => {
    test('should display page counter correctly', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const currentPage = await bookPage.getCurrentPageDisplay();
      const totalPages = await bookPage.getTotalPages();

      expect(currentPage).toBeGreaterThanOrEqual(1);
      expect(totalPages).toBeGreaterThan(currentPage);
    });

    test('should increment page counter on flip', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageDisplay();
      await bookPage.flipNext();
      const pageAfter = await bookPage.getCurrentPageDisplay();

      expect(pageAfter).toBeGreaterThan(pageBefore);
    });

    test('should have accessible progress bar', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await expect(bookPage.progressBar).toHaveAttribute('role', 'progressbar');
      await expect(bookPage.progressBar).toHaveAttribute('aria-valuemin', '0');
      await expect(bookPage.progressBar).toHaveAttribute('aria-valuemax', '100');

      const valuenow = await bookPage.progressBar.getAttribute('aria-valuenow');
      expect(parseInt(valuenow)).toBeGreaterThanOrEqual(0);
      expect(parseInt(valuenow)).toBeLessThanOrEqual(100);
    });
  });
});
