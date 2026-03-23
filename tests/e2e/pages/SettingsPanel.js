/**
 * SETTINGS PANEL PAGE OBJECT MODEL
 * Encapsulates settings interactions for E2E tests
 */

export class SettingsPanel {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Settings toggle
    this.settingsCheckbox = page.locator('#settings-checkbox');
    this.controls = page.locator('.controls');

    // Font settings
    this.fontSelect = page.locator('#font-select');
    this.fontSizeValue = page.locator('#font-size-value');
    this.btnIncrease = page.locator('#increase');
    this.btnDecrease = page.locator('#decrease');

    // Theme settings
    this.themeSegmented = page.locator('.theme-segmented');
    this.themeLight = page.locator('.theme-segment[data-theme="light"]');
    this.themeDark = page.locator('.theme-segment[data-theme="dark"]');
    this.themeBW = page.locator('.theme-segment[data-theme="bw"]');

    // Sound settings
    this.soundToggle = page.locator('#sound-toggle');
    this.volumeSlider = page.locator('#volume-slider');
    this.pageVolumeControl = page.locator('#page-volume-control');

    // Ambient settings
    this.ambientPills = page.locator('.ambient-pills');
    this.ambientNone = page.locator('.ambient-pill[data-type="none"]');
    this.ambientRain = page.locator('.ambient-pill[data-type="rain"]');
    this.ambientFireplace = page.locator('.ambient-pill[data-type="fireplace"]');
    this.ambientCafe = page.locator('.ambient-pill[data-type="cafe"]');
    this.ambientVolumeWrapper = page.locator('#ambient-volume-wrapper');
    this.ambientVolume = page.locator('#ambient-volume');

    // Other controls
    this.fullscreenBtn = page.locator('#fullscreen-btn');

    // Debug panel
    this.debugInfo = page.locator('#debugInfo');
  }

  /**
   * Open settings panel
   */
  async open() {
    const isOpen = await this.isOpen();
    if (!isOpen) {
      await this.settingsCheckbox.click();
      await this.page.locator('.settings-pod').waitFor({ state: 'visible', timeout: 1000 });
    }
  }

  /**
   * Close settings panel
   */
  async close() {
    const isOpen = await this.isOpen();
    if (isOpen) {
      await this.settingsCheckbox.click();
      await this.page.locator('.settings-pod').waitFor({ state: 'hidden', timeout: 1000 });
    }
  }

  /**
   * Check if settings panel is open
   */
  async isOpen() {
    return await this.settingsCheckbox.isChecked();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FONT SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current font family
   * @returns {Promise<string>}
   */
  async getFont() {
    return await this.fontSelect.inputValue();
  }

  /**
   * Set font family
   * @param {string} fontKey - Font key (georgia, merriweather, literata, etc.)
   */
  async setFont(fontKey) {
    await this.open();
    await this.fontSelect.selectOption(fontKey);
    await this.waitForRepagination();
  }

  /**
   * Get current font size
   * @returns {Promise<number>}
   */
  async getFontSize() {
    const text = await this.fontSizeValue.textContent();
    return parseInt(text, 10);
  }

  /**
   * Increase font size
   */
  async increaseFontSize() {
    await this.open();
    await this.btnIncrease.click();
    await this.waitForRepagination();
  }

  /**
   * Decrease font size
   */
  async decreaseFontSize() {
    await this.open();
    await this.btnDecrease.click();
    await this.waitForRepagination();
  }

  /**
   * Set font size to specific value by clicking increase/decrease
   * @param {number} targetSize
   */
  async setFontSize(targetSize) {
    await this.open();
    let currentSize = await this.getFontSize();

    while (currentSize !== targetSize) {
      if (currentSize < targetSize) {
        await this.btnIncrease.click();
        currentSize++;
      } else {
        await this.btnDecrease.click();
        currentSize--;
      }
    }

    await this.waitForRepagination();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THEME SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current theme
   * @returns {Promise<string>}
   */
  async getTheme() {
    return await this.page.locator('html').getAttribute('data-theme');
  }

  /**
   * Set theme
   * @param {'light' | 'dark' | 'bw'} theme
   */
  async setTheme(theme) {
    await this.open();
    const themeBtn = this.page.locator(`[data-theme="${theme}"]`);
    await themeBtn.click();
    await this.page.waitForFunction(
      (t) => document.documentElement.getAttribute('data-theme') === t,
      theme
    );
  }

  /**
   * Check if specific theme segment is active
   * @param {'light' | 'dark' | 'bw'} theme
   */
  async isThemeActive(theme) {
    const segment = this.page.locator(`[data-theme="${theme}"]`);
    const active = await segment.getAttribute('data-active');
    return active === 'true';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SOUND SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if sound is enabled
   */
  async isSoundEnabled() {
    return await this.soundToggle.isChecked();
  }

  /**
   * Toggle sound on/off
   */
  async toggleSound() {
    await this.open();
    await this.soundToggle.click();
  }

  /**
   * Enable sound
   */
  async enableSound() {
    if (!(await this.isSoundEnabled())) {
      await this.toggleSound();
    }
  }

  /**
   * Disable sound
   */
  async disableSound() {
    if (await this.isSoundEnabled()) {
      await this.toggleSound();
    }
  }

  /**
   * Get sound volume (0-100)
   * @returns {Promise<number>}
   */
  async getSoundVolume() {
    const value = await this.volumeSlider.inputValue();
    return parseInt(value, 10);
  }

  /**
   * Set sound volume
   * @param {number} volume - 0-100
   */
  async setSoundVolume(volume) {
    await this.open();
    await this.volumeSlider.fill(String(volume));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AMBIENT SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current ambient type
   * @returns {Promise<string>}
   */
  async getAmbientType() {
    const pills = ['none', 'rain', 'fireplace', 'cafe'];

    for (const type of pills) {
      const pill = this.page.locator(`[data-type="${type}"]`);
      const active = await pill.getAttribute('data-active');
      if (active === 'true') {
        return type;
      }
    }

    return 'none';
  }

  /**
   * Set ambient type
   * @param {'none' | 'rain' | 'fireplace' | 'cafe'} type
   */
  async setAmbientType(type) {
    await this.open();
    const pill = this.page.locator(`[data-type="${type}"]`);
    await pill.click();
    await this.page.waitForFunction(
      (t) => document.querySelector(`[data-type="${t}"]`)?.getAttribute('data-active') === 'true',
      type
    );
  }

  /**
   * Check if ambient volume slider is visible
   */
  async isAmbientVolumeVisible() {
    return await this.ambientVolumeWrapper.evaluate(el =>
      el.classList.contains('visible') || getComputedStyle(el).display !== 'none'
    );
  }

  /**
   * Get ambient volume (0-100)
   * @returns {Promise<number>}
   */
  async getAmbientVolume() {
    const value = await this.ambientVolume.inputValue();
    return parseInt(value, 10);
  }

  /**
   * Set ambient volume
   * @param {number} volume - 0-100
   */
  async setAmbientVolume(volume) {
    await this.open();
    await this.ambientVolume.fill(String(volume));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OTHER CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Toggle fullscreen
   */
  async toggleFullscreen() {
    await this.open();
    await this.fullscreenBtn.click();
  }

  /**
   * Check if in fullscreen mode
   */
  async isFullscreen() {
    return await this.page.evaluate(() => !!document.fullscreenElement);
  }

  /**
   * Toggle debug panel with Ctrl+D
   */
  async toggleDebug() {
    await this.page.keyboard.press('Control+d');
  }

  /**
   * Check if debug panel is visible
   */
  async isDebugVisible() {
    return await this.debugInfo.isVisible();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Wait for repagination to complete
   */
  async waitForRepagination() {
    // Wait for loading indicator to appear and disappear
    await this.page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    try {
      await this.page.locator('#loadingOverlay').waitFor({
        state: 'visible',
        timeout: 500,
      });
      await this.page.locator('#loadingOverlay').waitFor({
        state: 'hidden',
        timeout: 5000,
      });
    } catch {
      // Loading might be too fast to catch, which is fine
    }

    // Wait for book to settle in opened state after render
    await this.page.waitForFunction(
      () => document.querySelector('.book')?.getAttribute('data-state') === 'opened',
      { timeout: 3000 }
    ).catch(() => {});
  }

  /**
   * Get all current settings
   * @returns {Promise<object>}
   */
  async getAllSettings() {
    await this.open();

    return {
      font: await this.getFont(),
      fontSize: await this.getFontSize(),
      theme: await this.getTheme(),
      soundEnabled: await this.isSoundEnabled(),
      soundVolume: await this.getSoundVolume(),
      ambientType: await this.getAmbientType(),
      ambientVolume: await this.getAmbientVolume(),
    };
  }
}
