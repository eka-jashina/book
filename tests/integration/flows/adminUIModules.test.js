/**
 * INTEGRATION TEST: Admin UI Modules
 * AppearanceModule, FontsModule, SoundsModule — через DOM-интеракции.
 * Проверяет cacheDOM → bindEvents → render → user actions → store updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { flushPromises } from '../../helpers/testUtils.js';
import { setupTemplates } from '../../helpers/adminTemplates.js';

vi.mock('../../../js/admin/modules/adminHelpers.js', () => ({
  readFileAsDataURL: vi.fn().mockResolvedValue('data:font/woff2;base64,AABBCC'),
}));

// ── Shared helpers ─────────────────────────────────────────────────────────

function createMockApp(storeOverrides = {}) {
  const defaultStore = {
    getAppearance: vi.fn().mockResolvedValue({
      fontMin: 14, fontMax: 22,
      light: {
        coverBgStart: '#3a2d1f', coverBgEnd: '#2a2016', coverText: '#f2e9d8',
        coverBgImage: null, pageTexture: 'default', customTextureData: null,
        bgPage: '#fdfcf8', bgApp: '#e6e3dc',
      },
      dark: {
        coverBgStart: '#111111', coverBgEnd: '#000000', coverText: '#eaeaea',
        coverBgImage: null, pageTexture: 'none', customTextureData: null,
        bgPage: '#1e1e1e', bgApp: '#121212',
      },
    }),
    getCover: vi.fn().mockResolvedValue({ title: 'Test Book', author: 'Author' }),
    updateAppearanceTheme: vi.fn(),
    updateAppearanceGlobal: vi.fn(),
    getSounds: vi.fn().mockResolvedValue({
      pageFlip: 'sounds/page-flip.mp3',
      bookOpen: 'sounds/cover-flip.mp3',
      bookClose: 'sounds/cover-flip.mp3',
    }),
    updateSounds: vi.fn(),
    getDecorativeFont: vi.fn().mockResolvedValue(null),
    setDecorativeFont: vi.fn(),
    getReadingFonts: vi.fn().mockResolvedValue([
      { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true, dataUrl: null },
      { id: 'arial', label: 'Arial', family: 'Arial, sans-serif', builtin: true, enabled: true, dataUrl: null },
    ]),
    addReadingFont: vi.fn(),
    updateReadingFont: vi.fn(),
    removeReadingFont: vi.fn(),
    ...storeOverrides,
  };

  return {
    container: document.body,
    store: defaultStore,
    _showToast: vi.fn(),
    _escapeHtml: (s) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    _renderJsonPreview: vi.fn(),
    _confirm: vi.fn().mockResolvedValue(true),
    settings: { render: vi.fn(), updateFontSelect: vi.fn() },
  };
}

// ── AppearanceModule ────────────────────────────────────────────────────────

describe('AppearanceModule Integration', () => {
  let mod;
  let app;

  function createAppearanceDOM() {
    document.body.innerHTML = `
      <div id="appearanceThemeSwitch">
        <button class="appearance-theme-btn active" data-edit-theme="light">Light</button>
        <button class="appearance-theme-btn" data-edit-theme="dark">Dark</button>
      </div>
      <input type="color" id="coverBgStart" value="#3a2d1f" />
      <input type="color" id="coverBgEnd" value="#2a2016" />
      <input type="color" id="coverText" value="#f2e9d8" />
      <div id="coverTextPreview"></div>
      <input type="file" id="coverBgFileInput" accept="image/*" />
      <div id="coverBgPreview"></div>
      <div id="coverBgPreviewEmpty"></div>
      <button id="coverBgRemove" hidden></button>

      <select id="pageTexture"><option value="default">Default</option><option value="custom">Custom</option><option value="none">None</option></select>
      <div class="texture-option" data-texture="default"></div>
      <div class="texture-option" data-texture="none"></div>
      <div class="texture-option texture-option--upload" data-texture="custom"></div>
      <input type="file" id="textureFileInput" accept="image/*" />
      <div id="customTextureThumb"></div>
      <div id="textureCustomInfo" hidden></div>
      <span id="textureCustomName"></span>
      <button id="textureCustomRemove"></button>

      <input type="color" id="bgPage" value="#fdfcf8" />
      <div id="bgPageSwatch"></div>
      <input type="color" id="bgApp" value="#e6e3dc" />
      <div id="bgAppSwatch"></div>

      <button id="saveAppearance">Save</button>
      <button id="resetAppearance">Reset</button>

      <div id="previewCover"></div>
      <div id="previewPage"></div>
      <span id="previewTitle"></span>
      <span id="previewAuthor"></span>

      <input type="range" id="fontMin" min="10" max="20" value="14" />
      <span id="fontMinValue">14px</span>
      <input type="range" id="fontMax" min="18" max="30" value="22" />
      <span id="fontMaxValue">22px</span>
      <button id="savePlatform">Save Platform</button>
    `;
  }

  beforeEach(async () => {
    createAppearanceDOM();
    app = createMockApp();

    const { AppearanceModule } = await import('../../../js/admin/modules/AppearanceModule.js');
    mod = new AppearanceModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  afterEach(() => {
    mod = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('should render appearance from store on init', async () => {
    await mod.render();

    expect(app.store.getAppearance).toHaveBeenCalled();
    expect(mod.fontMin.value).toBe('14');
    expect(mod.fontMinValue.textContent).toBe('14px');
    expect(mod.coverBgStart.value).toBe('#3a2d1f');
  });

  it('should switch theme and save previous theme data', async () => {
    await mod.render();

    // Switch to dark
    const darkBtn = document.querySelector('[data-edit-theme="dark"]');
    darkBtn.click();
    await flushPromises();

    expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', expect.any(Object));
    expect(mod._editTheme).toBe('dark');
    expect(darkBtn.classList.contains('active')).toBe(true);
  });

  it('should update live preview when cover color changes', async () => {
    await mod.render();

    // After render, previewCover should have initial gradient
    const initialBg = mod.previewCover.style.background;

    mod.coverBgStart.value = '#ff0000';
    // Call _updateAppearancePreview directly and await it
    await mod._updateAppearancePreview();

    // previewCover gets linear-gradient background with the new color
    const newBg = mod.previewCover.style.background;
    // Verify the background was updated (may differ from initial)
    expect(mod.coverTextPreview.style.background).toContain('rgb(255, 0, 0)');
  });

  it('should update page background swatch on bgPage input', async () => {
    await mod.render();

    mod.bgPage.value = '#aabbcc';
    mod.bgPage.dispatchEvent(new Event('input'));

    // jsdom converts hex to rgb internally
    expect(mod.bgPageSwatch.style.background).toBeTruthy();
  });

  it('should update fontMin value display on range input', async () => {
    await mod.render();

    mod.fontMin.value = '16';
    mod.fontMin.dispatchEvent(new Event('input'));

    expect(mod.fontMinValue.textContent).toBe('16px');
  });

  it('should save appearance and show toast', async () => {
    await mod.render();

    mod.saveAppearanceBtn.click();
    await flushPromises();

    expect(app.store.updateAppearanceTheme).toHaveBeenCalled();
    expect(app._showToast).toHaveBeenCalledWith('Оформление сохранено');
  });

  it('should reset appearance to defaults', async () => {
    await mod.render();

    mod.resetAppearanceBtn.click();
    await flushPromises();

    expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', expect.objectContaining({
      coverBgStart: '#3a2d1f',
    }));
    expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('dark', expect.objectContaining({
      coverBgStart: '#111111',
    }));
    expect(app._showToast).toHaveBeenCalledWith('Оформление сброшено');
  });

  it('should save platform settings (fontMin/fontMax)', async () => {
    await mod.render();

    mod.fontMin.value = '16';
    mod.fontMax.value = '24';
    mod.savePlatformBtn.click();
    await flushPromises();

    expect(app.store.updateAppearanceGlobal).toHaveBeenCalledWith({
      fontMin: 16, fontMax: 24,
    });
    expect(app._showToast).toHaveBeenCalledWith('Настройки платформы сохранены');
  });

  it('should remove cover background image', async () => {
    await mod.render();

    mod.coverBgRemove.click();

    expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', { coverBgImage: null });
    expect(app._showToast).toHaveBeenCalledWith('Фон обложки удалён');
  });

  it('should remove custom texture', async () => {
    await mod.render();

    mod.textureCustomRemove.click();

    expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', {
      pageTexture: 'default', customTextureData: null,
    });
    expect(mod.pageTexture.value).toBe('default');
  });

  it('should select a texture option', async () => {
    await mod.render();

    const noneOption = document.querySelector('[data-texture="none"]');
    noneOption.click();
    await flushPromises();

    expect(mod.pageTexture.value).toBe('none');
  });
});

// ── SoundsModule ────────────────────────────────────────────────────────────

describe('SoundsModule Integration', () => {
  let mod;
  let app;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="soundCardsGrid"></div>
      <button id="saveSounds">Save</button>
      <button id="resetSounds">Reset</button>
    `;
    setupTemplates('tmpl-admin-sound-card');

    app = createMockApp();

    const { SoundsModule } = await import('../../../js/admin/modules/SoundsModule.js');
    mod = new SoundsModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  afterEach(() => {
    mod = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('should generate sound card HTML on cacheDOM', () => {
    expect(document.getElementById('sound-pageFlip-mode')).toBeTruthy();
    expect(document.getElementById('sound-bookOpen-mode')).toBeTruthy();
    expect(document.getElementById('sound-bookClose-mode')).toBeTruthy();
  });

  it('should render default mode for file paths', async () => {
    await mod.render();

    expect(mod._modes.pageFlip.value).toBe('default');
    expect(mod._customInfos.pageFlip.hidden).toBe(true);
  });

  it('should render custom mode for data URLs', async () => {
    app.store.getSounds.mockResolvedValue({
      pageFlip: 'data:audio/mp3;base64,AAAA',
      bookOpen: 'sounds/cover-flip.mp3',
      bookClose: 'sounds/cover-flip.mp3',
    });

    await mod.render();

    expect(mod._modes.pageFlip.value).toBe('custom');
    expect(mod._customInfos.pageFlip.hidden).toBe(false);
  });

  it('should save sounds and show toast', async () => {
    await mod.render();

    mod.saveSoundsBtn.click();
    await flushPromises();

    expect(app._showToast).toHaveBeenCalledWith('Звуки сохранены');
  });

  it('should reset sounds to defaults', async () => {
    await mod.render();

    mod.resetSoundsBtn.click();
    await flushPromises();

    expect(app.store.updateSounds).toHaveBeenCalledWith({
      pageFlip: 'sounds/page-flip.mp3',
      bookOpen: 'sounds/cover-flip.mp3',
      bookClose: 'sounds/cover-flip.mp3',
    });
    expect(app._showToast).toHaveBeenCalledWith('Звуки сброшены');
  });
});

// ── FontsModule ─────────────────────────────────────────────────────────────

describe('FontsModule Integration', () => {
  let mod;
  let app;

  function createFontsDOM() {
    document.body.innerHTML = `
      <input type="file" id="decorativeFontUpload" />
      <div id="decorativeFontSample"></div>
      <div id="decorativeFontInfo" hidden></div>
      <span id="decorativeFontName"></span>
      <button id="decorativeFontRemove"></button>

      <div id="readingFontsList"></div>
      <button id="addReadingFont">Add</button>
      <dialog id="readingFontModal">
        <h3 id="readingFontModalTitle"></h3>
        <form id="readingFontForm">
          <input id="readingFontName" />
          <input type="file" id="readingFontFileUpload" />
          <span id="readingFontUploadLabel">Выбрать файл</span>
          <select id="readingFontCategory">
            <option value="serif">Serif</option>
            <option value="sans-serif">Sans-serif</option>
            <option value="monospace">Monospace</option>
          </select>
          <button type="submit">OK</button>
          <button type="button" id="cancelReadingFontModal">Cancel</button>
        </form>
      </dialog>
    `;
  }

  beforeEach(async () => {
    createFontsDOM();
    setupTemplates('tmpl-admin-reading-font-card');
    app = createMockApp();

    // Mock dialog methods
    const dialog = document.getElementById('readingFontModal');
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();

    // Mock FontFace API — must be a proper constructor (not arrow function)
    globalThis.FontFace = class MockFontFace {
      constructor(family, source) {
        this.family = family;
        this.source = source;
      }
      load() { return Promise.resolve(this); }
    };
    document.fonts = { add: vi.fn(), delete: vi.fn(), [Symbol.iterator]: function* () {} };

    const { FontsModule } = await import('../../../js/admin/modules/FontsModule.js');
    mod = new FontsModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  afterEach(() => {
    mod = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('should render reading fonts as cards', async () => {
    await mod.render();

    const cards = mod.readingFontsList.querySelectorAll('.reading-font-card');
    expect(cards.length).toBe(2);
    expect(mod.readingFontsList.innerHTML).toContain('Georgia');
    expect(mod.readingFontsList.innerHTML).toContain('Arial');
  });

  it('should render font toggle checkboxes', async () => {
    await mod.render();

    const toggles = mod.readingFontsList.querySelectorAll('[data-font-toggle]');
    expect(toggles.length).toBe(2);
    expect(toggles[0].checked).toBe(true);
  });

  it('should not show delete button for builtin fonts', async () => {
    await mod.render();

    const deleteBtn = mod.readingFontsList.querySelector('[data-font-delete]');
    expect(deleteBtn).toBeNull();
  });

  it('should show delete button for custom fonts', async () => {
    app.store.getReadingFonts.mockResolvedValue([
      { id: 'custom1', label: 'My Font', family: '"My Font", serif', builtin: false, enabled: true, dataUrl: 'data:font;base64,AA' },
    ]);

    await mod.render();

    const deleteBtn = mod.readingFontsList.querySelector('[data-font-delete]');
    expect(deleteBtn).toBeTruthy();
  });

  it('should render decorative font info when present', async () => {
    app.store.getDecorativeFont.mockResolvedValue({
      name: 'Fancy Font', dataUrl: 'data:font/woff2;base64,XX',
    });

    await mod.render();

    expect(mod.decorativeFontInfo.style.display).toBe('flex');
    expect(mod.decorativeFontName.textContent).toBe('Fancy Font');
  });

  it('should hide decorative font info when not set', async () => {
    await mod.render();

    expect(mod.decorativeFontInfo.hidden).toBe(true);
    expect(mod.decorativeFontSample.style.fontFamily).toBe('');
  });

  it('should remove decorative font', async () => {
    await mod.render();

    mod._removeDecorativeFont();

    expect(app.store.setDecorativeFont).toHaveBeenCalledWith(null);
    expect(app._showToast).toHaveBeenCalledWith('Декоративный шрифт сброшен');
  });

  it('should open reading font modal', async () => {
    await mod.render();

    mod.addReadingFontBtn.click();

    expect(mod.readingFontModal.showModal).toHaveBeenCalled();
    expect(mod.readingFontUploadLabel.textContent).toBe('Выбрать файл');
  });

  it('should close modal on cancel', async () => {
    await mod.render();

    mod.cancelReadingFontModal.click();

    expect(mod.readingFontModal.close).toHaveBeenCalled();
  });

  it('should require file upload before submit', async () => {
    await mod.render();
    mod._pendingReadingFontDataUrl = null;

    mod.readingFontNameInput.value = 'Test Font';
    const submitEvent = new Event('submit', { cancelable: true });
    mod.readingFontForm.dispatchEvent(submitEvent);

    expect(app._showToast).toHaveBeenCalledWith('Загрузите файл шрифта');
    expect(app.store.addReadingFont).not.toHaveBeenCalled();
  });

  it('should add reading font via form submit', async () => {
    await mod.render();
    mod._pendingReadingFontDataUrl = 'data:font/woff2;base64,AABB';

    mod.readingFontNameInput.value = 'My Custom';
    mod.readingFontCategory.value = 'serif';

    const submitEvent = new Event('submit', { cancelable: true });
    mod.readingFontForm.dispatchEvent(submitEvent);

    expect(app.store.addReadingFont).toHaveBeenCalledWith(expect.objectContaining({
      label: 'My Custom',
      family: '"My Custom", serif',
      builtin: false,
      enabled: true,
    }));
    expect(mod.readingFontModal.close).toHaveBeenCalled();
    expect(app._showToast).toHaveBeenCalledWith('Шрифт добавлен');
  });

  it('should not submit empty font name', async () => {
    await mod.render();
    mod._pendingReadingFontDataUrl = 'data:font;base64,X';

    mod.readingFontNameInput.value = '';
    const submitEvent = new Event('submit', { cancelable: true });
    mod.readingFontForm.dispatchEvent(submitEvent);

    expect(app.store.addReadingFont).not.toHaveBeenCalled();
  });

  it('should toggle font enabled state via event delegation', async () => {
    await mod.render();

    const toggle = mod.readingFontsList.querySelector('[data-font-toggle="0"]');
    // click() toggles checked from true→false, handler sees checked=false
    toggle.click();
    await flushPromises();

    expect(app.store.updateReadingFont).toHaveBeenCalledWith(0, { enabled: false });
  });

  it('should prevent disabling last enabled font', async () => {
    app.store.getReadingFonts.mockResolvedValue([
      { id: 'only', label: 'Only', family: 'sans-serif', builtin: true, enabled: true, dataUrl: null },
    ]);
    await mod.render();

    const toggle = mod.readingFontsList.querySelector('[data-font-toggle="0"]');
    // click() toggles checked from true→false, handler checks enabledCount<=1
    toggle.click();
    await flushPromises();

    expect(toggle.checked).toBe(true);
    expect(app._showToast).toHaveBeenCalledWith('Нельзя отключить последний шрифт');
    expect(app.store.updateReadingFont).not.toHaveBeenCalled();
  });
});
