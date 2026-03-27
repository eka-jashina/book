/**
 * TESTS: AppearanceModule
 * Тесты для модуля оформления (темы, текстуры, фон обложки)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppearanceModule } from '../../../js/admin/modules/AppearanceModule.js';

function createMockApp() {
  return {
    store: {
      getAppearance: vi.fn().mockResolvedValue({
        fontMin: 14,
        fontMax: 22,
        light: {
          coverBgStart: '#3a2d1f',
          coverBgEnd: '#2a2016',
          coverText: '#f2e9d8',
          coverBgImage: null,
          pageTexture: 'default',
          customTextureData: null,
          bgPage: '#fdfcf8',
          bgApp: '#e6e3dc',
        },
        dark: {
          coverBgStart: '#111111',
          coverBgEnd: '#000000',
          coverText: '#eaeaea',
          coverBgImage: null,
          pageTexture: 'none',
          customTextureData: null,
          bgPage: '#1e1e1e',
          bgApp: '#121212',
        },
      }),
      updateAppearanceGlobal: vi.fn().mockResolvedValue(),
      updateAppearanceTheme: vi.fn().mockResolvedValue(),
      getCover: vi.fn().mockResolvedValue({ title: 'Sample Book', author: 'Flipbook Demo' }),
      uploadImage: vi.fn().mockResolvedValue(null),
    },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => s),
    _renderJsonPreview: vi.fn(),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="appearanceThemeSwitch">
      <button class="appearance-theme-btn active" data-edit-theme="light">Light</button>
      <button class="appearance-theme-btn" data-edit-theme="dark">Dark</button>
    </div>
    <input id="coverBgStart" type="color" value="#3a2d1f">
    <input id="coverBgEnd" type="color" value="#2a2016">
    <input id="coverText" type="color" value="#f2e9d8">
    <div id="coverTextPreview"></div>
    <input id="coverBgFileInput" type="file">
    <div id="coverBgPreview"></div>
    <div id="coverBgPreviewEmpty"></div>
    <button id="coverBgRemove"></button>
    <input id="pageTexture" type="hidden" value="default">
    <button class="texture-option" data-texture="default"></button>
    <button class="texture-option" data-texture="none"></button>
    <div class="texture-option--upload"></div>
    <input id="textureFileInput" type="file">
    <div id="customTextureThumb"></div>
    <div id="textureCustomInfo" hidden></div>
    <span id="textureCustomName"></span>
    <button id="textureCustomRemove"></button>
    <input id="bgPage" type="color" value="#fdfcf8">
    <div id="bgPageSwatch"></div>
    <input id="bgApp" type="color" value="#e6e3dc">
    <div id="bgAppSwatch"></div>
    <input id="fontMin" type="range" min="10" max="20" value="14">
    <span id="fontMinValue">14px</span>
    <input id="fontMax" type="range" min="16" max="30" value="22">
    <span id="fontMaxValue">22px</span>
    <div id="appearancePreview">
      <div id="previewCover"><span id="previewTitle"></span><span id="previewAuthor"></span></div>
      <div id="previewPage"><div class="appearance-preview-text"></div></div>
    </div>
    <button id="saveAppearance"></button>
    <button id="resetAppearance"></button>
    <button id="savePlatform"></button>
  `;
}

describe('AppearanceModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    setupDOM();
    app = createMockApp();
    mod = new AppearanceModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderAppearance
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderAppearance()', () => {
    it('should populate global font range fields', async () => {
      await mod._renderAppearance();

      expect(mod.fontMin.value).toBe('14');
      expect(mod.fontMinValue.textContent).toBe('14px');
      expect(mod.fontMax.value).toBe('22');
      expect(mod.fontMaxValue.textContent).toBe('22px');
    });

    it('should load light theme fields by default', async () => {
      await mod._renderAppearance();

      expect(mod.coverBgStart.value).toBe('#3a2d1f');
      expect(mod.coverBgEnd.value).toBe('#2a2016');
      expect(mod.coverText.value).toBe('#f2e9d8');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _switchEditTheme
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_switchEditTheme()', () => {
    it('should save current theme and switch to dark', async () => {
      await mod._switchEditTheme('dark');

      expect(mod._editTheme).toBe('dark');
      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', expect.any(Object));
    });

    it('should load dark theme fields after switching', async () => {
      await mod._switchEditTheme('dark');

      expect(mod.coverBgStart.value).toBe('#111111');
      expect(mod.coverBgEnd.value).toBe('#000000');
      expect(mod.coverText.value).toBe('#eaeaea');
    });

    it('should toggle active class on theme buttons', async () => {
      await mod._switchEditTheme('dark');

      const lightBtn = document.querySelector('[data-edit-theme="light"]');
      const darkBtn = document.querySelector('[data-edit-theme="dark"]');
      expect(lightBtn.classList.contains('active')).toBe(false);
      expect(darkBtn.classList.contains('active')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _updateAppearancePreview
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_updateAppearancePreview()', () => {
    it('should set gradient background and text color', async () => {
      mod.coverBgStart.value = '#ff0000';
      mod.coverBgEnd.value = '#0000ff';
      mod.coverText.value = '#ffffff';

      await mod._updateAppearancePreview();

      expect(mod.coverTextPreview.style.background).toContain('linear-gradient');
      expect(mod.coverTextPreview.style.color).toBe('rgb(255, 255, 255)');
    });

    it('should show book title in preview', async () => {
      await mod._updateAppearancePreview();
      expect(mod.coverTextPreview.textContent).toBe('Sample Book');
    });

    it('should show fallback text if no title', async () => {
      app.store.getCover.mockResolvedValue({ title: '', author: '' });
      await mod._updateAppearancePreview();
      expect(mod.coverTextPreview.textContent).toBe('Заголовок');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderCoverBgPreview
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderCoverBgPreview()', () => {
    it('should show image when data provided', () => {
      mod._renderCoverBgPreview('data:image/png;base64,abc');

      expect(mod.coverBgPreview.classList.contains('has-image')).toBe(true);
      expect(mod.coverBgPreviewEmpty.hidden).toBe(true);
      expect(mod.coverBgRemove.hidden).toBe(false);
    });

    it('should clear preview when no data', () => {
      mod._renderCoverBgPreview(null);

      expect(mod.coverBgPreview.classList.contains('has-image')).toBe(false);
      expect(mod.coverBgPreviewEmpty.hidden).toBe(false);
      expect(mod.coverBgRemove.hidden).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleCoverBgUpload
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleCoverBgUpload()', () => {
    it('should reject files over 2MB', () => {
      const event = {
        target: { files: [{ size: 3 * 1024 * 1024, type: 'image/png' }], value: 'img.png' },
      };

      mod._handleCoverBgUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Файл слишком большой (макс. 2 МБ)');
    });

    it('should reject non-image files', () => {
      const event = {
        target: { files: [{ size: 1024, type: 'audio/mp3' }], value: 'file.mp3' },
      };

      mod._handleCoverBgUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Допустимы только изображения');
    });

    it('should upload valid image and update store', async () => {
      const mockReader = {
        readAsDataURL: vi.fn(function () {
          this.result = 'data:image/png;base64,abc';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const event = {
        target: { files: [{ size: 1024, type: 'image/png' }], value: 'img.png' },
      };

      await mod._handleCoverBgUpload(event);

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', { coverBgImage: 'data:image/png;base64,abc' });
      expect(app._showToast).toHaveBeenCalledWith('Фон обложки загружен');

      global.FileReader = OriginalFileReader;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _removeCoverBg
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_removeCoverBg()', () => {
    it('should clear cover background in store', () => {
      mod._removeCoverBg();

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', { coverBgImage: null });
      expect(app._showToast).toHaveBeenCalledWith('Фон обложки удалён');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleTextureUpload
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleTextureUpload()', () => {
    it('should reject files over 2MB', () => {
      const event = {
        target: { files: [{ size: 3 * 1024 * 1024, type: 'image/png' }], value: 'tex.png' },
      };

      mod._handleTextureUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Файл слишком большой (макс. 2 МБ)');
    });

    it('should reject non-image files', () => {
      const event = {
        target: { files: [{ size: 1024, type: 'text/plain' }], value: 'file.txt' },
      };

      mod._handleTextureUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Допустимы только изображения');
    });

    it('should upload custom texture and set to custom mode', async () => {
      const mockReader = {
        readAsDataURL: vi.fn(function () {
          this.result = 'data:image/png;base64,tex';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const event = {
        target: { files: [{ size: 1024, type: 'image/png' }], value: 'tex.png' },
      };

      await mod._handleTextureUpload(event);

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', {
        pageTexture: 'custom',
        customTextureData: 'data:image/png;base64,tex',
      });
      expect(mod.pageTexture.value).toBe('custom');
      expect(app._showToast).toHaveBeenCalledWith('Текстура загружена');

      global.FileReader = OriginalFileReader;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _removeCustomTexture
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_removeCustomTexture()', () => {
    it('should reset texture to default', () => {
      mod._removeCustomTexture();

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', {
        pageTexture: 'default',
        customTextureData: null,
      });
      expect(mod.pageTexture.value).toBe('default');
      expect(app._showToast).toHaveBeenCalledWith('Своя текстура удалена');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _saveAppearance (now only saves per-theme data)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_saveAppearance()', () => {
    it('should save current theme form data', async () => {
      mod.coverBgStart.value = '#ff0000';
      mod.coverBgEnd.value = '#00ff00';
      mod.coverText.value = '#0000ff';
      mod.pageTexture.value = 'default';
      mod.bgPage.value = '#ffffff';
      mod.bgApp.value = '#000000';

      await mod._saveAppearance();

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', {
        coverBgStart: '#ff0000',
        coverBgEnd: '#00ff00',
        coverText: '#0000ff',
        pageTexture: 'default',
        customTextureData: null,
        bgPage: '#ffffff',
        bgApp: '#000000',
      });
      expect(app._showToast).toHaveBeenCalledWith('Оформление сохранено');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _savePlatform (saves fontMin/fontMax)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_savePlatform()', () => {
    it('should save global fontMin/fontMax', async () => {
      mod.fontMin.value = '12';
      mod.fontMax.value = '26';

      await mod._savePlatform();

      expect(app.store.updateAppearanceGlobal).toHaveBeenCalledWith({
        fontMin: 12,
        fontMax: 26,
      });
      expect(app._showToast).toHaveBeenCalledWith('Настройки платформы сохранены');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _resetAppearance
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_resetAppearance()', () => {
    it('should reset per-theme values', async () => {
      await mod._resetAppearance();

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('light', expect.objectContaining({
        coverBgStart: '#3a2d1f',
        coverBgEnd: '#2a2016',
        coverText: '#f2e9d8',
        coverBgImage: null,
        pageTexture: 'default',
        bgPage: '#fdfcf8',
        bgApp: '#e6e3dc',
      }));

      expect(app.store.updateAppearanceTheme).toHaveBeenCalledWith('dark', expect.objectContaining({
        coverBgStart: '#111111',
        coverBgEnd: '#000000',
        coverText: '#eaeaea',
        pageTexture: 'none',
        bgPage: '#1e1e1e',
        bgApp: '#121212',
      }));

      expect(app._showToast).toHaveBeenCalledWith('Оформление сброшено');
    });
  });
});
