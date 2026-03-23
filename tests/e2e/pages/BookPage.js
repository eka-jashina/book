/**
 * BOOK PAGE OBJECT MODEL
 * Encapsulates book interactions for E2E tests
 */

export class BookPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Locators
    this.book = page.locator('.book');
    this.cover = page.locator('#cover');
    this.pageLeft = page.locator('.page[data-side="left"][data-active="true"] .page-inner');
    this.pageRight = page.locator('.page[data-side="right"][data-active="true"] .page-inner');
    this.sheet = page.locator('.sheet');

    // Navigation
    this.btnNext = page.locator('#next');
    this.btnPrev = page.locator('#prev');
    this.continueBtn = page.locator('#continueBtn');

    // Page counter
    this.currentPage = page.locator('#current-page');
    this.totalPages = page.locator('#total-pages');
    this.progressBar = page.locator('#reading-progress');

    // TOC
    this.toc = page.locator('.toc');
    this.tocItems = page.locator('.toc li');

    // Loading
    this.loadingIndicator = page.locator('#loadingOverlay');

    // Corner zones for drag
    this.cornerBR = page.locator('.corner-zone.bottom-right');
    this.cornerBL = page.locator('.corner-zone.bottom-left');
  }

  /**
   * Navigate to the book page
   */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get current book state
   * @returns {Promise<string>} State: 'closed', 'opening', 'opened', 'flipping', 'closing'
   */
  async getState() {
    return await this.book.getAttribute('data-state');
  }

  /**
   * Check if book is closed
   */
  async isClosed() {
    return (await this.getState()) === 'closed';
  }

  /**
   * Check if book is opened
   */
  async isOpened() {
    return (await this.getState()) === 'opened';
  }

  /**
   * Open book by clicking the cover
   */
  async openByCover() {
    await this.cover.click();
    await this.waitForState('opened');
  }

  /**
   * Open book using "Continue reading" button
   */
  async openByContinue() {
    await this.continueBtn.click();
    await this.waitForState('opened');
  }

  /**
   * Wait for specific book state
   * @param {string} state
   * @param {number} timeout
   */
  async waitForState(state, timeout = 5000) {
    await this.book.waitFor({
      state: 'attached',
    });
    await this.page.waitForFunction(
      (expectedState) => {
        const book = document.querySelector('.book');
        return book?.getAttribute('data-state') === expectedState;
      },
      state,
      { timeout }
    );
  }

  /**
   * Wait for animation to complete (state returns to 'opened')
   */
  async waitForAnimation() {
    // Wait for flipping state to start (if not already)
    await this.page.waitForFunction(
      () => document.querySelector('.book')?.getAttribute('data-state') === 'flipping',
      { timeout: 500 }
    ).catch(() => {}); // Animation might be too fast to catch

    // Wait for animation to complete
    await this.waitForState('opened', 3000);
  }

  /**
   * Wait for loading indicator to disappear
   */
  async waitForLoading() {
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Get current page number (0-based index)
   * @returns {Promise<number>}
   */
  async getCurrentPageIndex() {
    const text = await this.currentPage.textContent();
    return parseInt(text, 10) - 1; // Convert from 1-based display to 0-based index
  }

  /**
   * Get current page number (1-based display)
   * @returns {Promise<number>}
   */
  async getCurrentPageDisplay() {
    const text = await this.currentPage.textContent();
    return parseInt(text, 10);
  }

  /**
   * Get total page count
   * @returns {Promise<number>}
   */
  async getTotalPages() {
    const text = await this.totalPages.textContent();
    return parseInt(text, 10);
  }

  /**
   * Get reading progress percentage
   * @returns {Promise<number>}
   */
  async getProgress() {
    const valuenow = await this.progressBar.getAttribute('aria-valuenow');
    return parseInt(valuenow, 10);
  }

  /**
   * Flip to next page using button
   */
  async flipNext() {
    await this.btnNext.click();
    await this.waitForAnimation();
  }

  /**
   * Flip to previous page using button
   */
  async flipPrev() {
    await this.btnPrev.click();
    await this.waitForAnimation();
  }

  /**
   * Flip using keyboard
   * @param {'left' | 'right' | 'home' | 'end'} direction
   */
  async flipByKey(direction) {
    const keyMap = {
      left: 'ArrowLeft',
      right: 'ArrowRight',
      home: 'Home',
      end: 'End',
    };
    await this.page.keyboard.press(keyMap[direction]);
    await this.waitForAnimation();
  }

  /**
   * Navigate to chapter via TOC
   * @param {number} chapterIndex - 0-based chapter index
   */
  async goToChapter(chapterIndex) {
    const tocItem = this.tocItems.nth(chapterIndex);
    await tocItem.click();
    await this.waitForAnimation();
  }

  /**
   * Perform swipe gesture
   * @param {'left' | 'right'} direction
   * @param {number} distance - Swipe distance in pixels
   */
  async swipe(direction, distance = 150) {
    const bookBox = await this.book.boundingBox();
    if (!bookBox) throw new Error('Book not visible');

    const startX = bookBox.x + bookBox.width / 2;
    const startY = bookBox.y + bookBox.height / 2;
    const endX = direction === 'left' ? startX - distance : startX + distance;

    await this.page.touchscreen.tap(startX, startY);
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, startY, { steps: 10 });
    await this.page.mouse.up();

    await this.waitForAnimation();
  }

  /**
   * Click on book half to flip
   * @param {'left' | 'right'} side
   */
  async clickBookHalf(side) {
    const bookBox = await this.book.boundingBox();
    if (!bookBox) throw new Error('Book not visible');

    const x = side === 'left'
      ? bookBox.x + bookBox.width * 0.25
      : bookBox.x + bookBox.width * 0.75;
    const y = bookBox.y + bookBox.height / 2;

    await this.page.mouse.click(x, y);
    await this.waitForAnimation();
  }

  /**
   * Drag corner to flip page
   * @param {'br' | 'bl'} corner - Bottom right or bottom left
   * @param {number} dragDistance - How far to drag
   */
  async dragCorner(corner, dragDistance = 300) {
    const cornerEl = corner === 'br' ? this.cornerBR : this.cornerBL;
    const cornerBox = await cornerEl.boundingBox();
    if (!cornerBox) throw new Error('Corner zone not visible');

    const startX = cornerBox.x + cornerBox.width / 2;
    const startY = cornerBox.y + cornerBox.height / 2;
    const endX = corner === 'br' ? startX - dragDistance : startX + dragDistance;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, startY, { steps: 20 });
    await this.page.mouse.up();

    await this.waitForAnimation();
  }

  /**
   * Close the book (flip backward from first page)
   */
  async close() {
    // Go to first page
    await this.flipByKey('home');

    // Flip backward to close
    await this.btnPrev.click();
    await this.waitForState('closed', 5000);
  }

  /**
   * Check if continue button is visible
   */
  async hasContinueButton() {
    return await this.continueBtn.isVisible();
  }

  /**
   * Get page content text
   * @param {'left' | 'right'} side
   */
  async getPageContent(side) {
    const pageEl = side === 'left' ? this.pageLeft : this.pageRight;
    return await pageEl.textContent();
  }

  /**
   * Check if TOC is visible on current page
   */
  async hasTOC() {
    return await this.toc.isVisible();
  }

  /**
   * Get chapter count from TOC
   */
  async getChapterCount() {
    return await this.tocItems.count();
  }
}
