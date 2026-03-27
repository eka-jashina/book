/**
 * TESTS: FontsModule
 * Тесты для модуля управления шрифтами
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTemplates } from '../../helpers/adminTemplates.js';
import { FontsModule } from '../../../js/admin/modules/FontsModule.js';

function createMockApp() {
  return {
    store: {
      getDecorativeFont: vi.fn().mockResolvedValue(null),
      setDecorativeFont: vi.fn().mockResolvedValue(undefined),
      getReadingFonts: vi.fn().mockResolvedValue([
        { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
        { id: 'inter', label: 'Inter', family: 'Inter, sans-serif', builtin: true, enabled: true },
        { id: 'custom1', label: 'MyFont', family: '"MyFont", serif', builtin: false, enabled: true, dataUrl: 'data:font;base64,abc' },
      ]),
      addReadingFont: vi.fn(),
      updateReadingFont: vi.fn(),
      removeReadingFont: vi.fn(),
      uploadFont: vi.fn().mockResolvedValue(null),
    },
    settings: { render: vi.fn(), updateFontSelect: vi.fn() },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => s),
    _renderJsonPreview: vi.fn(),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <input id="decorativeFontUpload" type="file">
    <div id="decorativeFontSample"></div>
    <div id="decorativeFontInfo"></div>
    <span id="decorativeFontName"></span>
    <button id="decorativeFontRemove"></button>

    <div id="readingFontsList"></div>
    <button id="addReadingFont"></button>
    <dialog id="readingFontModal">
      <h2 id="readingFontModalTitle"></h2>
      <form id="readingFontForm">
        <input id="readingFontName" type="text">
        <input id="readingFontFileUpload" type="file">
        <span id="readingFontUploadLabel"></span>
        <select id="readingFontCategory">
          <option value="serif">Serif</option>
          <option value="sans-serif">Sans-serif</option>
        </select>
        <button id="cancelReadingFontModal" type="button"></button>
      </form>
    </dialog>
  `;
  setupTemplates('tmpl-admin-reading-font-card');
}

describe('FontsModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    setupDOM();
    document.querySelectorAll('dialog').forEach(d => {
      d.showModal = d.showModal || vi.fn();
      d.close = d.close || vi.fn();
    });
    app = createMockApp();
    mod = new FontsModule(app);
    // Stub _loadCustomFontPreview since FontFace is not available in jsdom
    mod._loadCustomFontPreview = vi.fn();
    mod.cacheDOM();
    mod.bindEvents();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DECORATIVE FONT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderDecorativeFont()', () => {
    it('should hide info when no decorative font', async () => {
      await mod._renderDecorativeFont();

      expect(mod.decorativeFontInfo.style.display).toBe('none');
      expect(mod.decorativeFontSample.style.fontFamily).toBe('');
    });

    it('should show info and preview when decorative font exists', async () => {
      app.store.getDecorativeFont.mockResolvedValue({ name: 'Fancy', dataUrl: 'data:font;base64,xyz' });

      await mod._renderDecorativeFont();

      expect(mod.decorativeFontInfo.style.display).toBe('flex');
      expect(mod.decorativeFontName.textContent).toBe('Fancy');
      expect(mod._loadCustomFontPreview).toHaveBeenCalledWith('CustomDecorativePreview', 'data:font;base64,xyz');
      expect(mod.decorativeFontSample.style.fontFamily).toContain('CustomDecorativePreview');
    });
  });

  describe('_handleDecorativeFontUpload()', () => {
    it('should reject decorative files over 400KB', () => {
      const event = {
        target: { files: [{ size: 3 * 1024 * 1024, name: 'big.woff2' }], value: 'big.woff2' },
      };

      mod._handleDecorativeFontUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Файл слишком большой (макс. 0.390625 МБ)');
    });

    it('should reject invalid font extensions', () => {
      const event = {
        target: { files: [{ size: 1024, name: 'font.txt' }], value: 'font.txt' },
      };

      mod._handleDecorativeFontUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Допустимые форматы: .woff2, .woff, .ttf, .otf');
    });

    it('should accept .woff2 files', async () => {
      const mockReader = {
        readAsDataURL: vi.fn(function () {
          this.result = 'data:font/woff2;base64,abc';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const event = {
        target: { files: [{ size: 1024, name: 'myfont.woff2' }], value: 'myfont.woff2' },
      };

      await mod._handleDecorativeFontUpload(event);

      expect(app.store.setDecorativeFont).toHaveBeenCalledWith({
        name: 'myfont',
        dataUrl: 'data:font/woff2;base64,abc',
      });
      expect(app._showToast).toHaveBeenCalledWith('Декоративный шрифт загружен');

      global.FileReader = OriginalFileReader;
    });

    it('should strip extension from font name', async () => {
      const mockReader = {
        readAsDataURL: vi.fn(function () {
          this.result = 'data:abc';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const event = {
        target: { files: [{ size: 1024, name: 'My-Custom-Font.ttf' }], value: '' },
      };

      await mod._handleDecorativeFontUpload(event);

      const call = app.store.setDecorativeFont.mock.calls[0][0];
      expect(call.name).toBe('My-Custom-Font');

      global.FileReader = OriginalFileReader;
    });
  });

  describe('_removeDecorativeFont()', () => {
    it('should clear decorative font from store', async () => {
      await mod._removeDecorativeFont();

      expect(app.store.setDecorativeFont).toHaveBeenCalledWith(null);
      expect(app._showToast).toHaveBeenCalledWith('Декоративный шрифт сброшен');
      expect(mod.decorativeFontInfo.style.display).toBe('none');
      expect(mod.decorativeFontSample.style.fontFamily).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // READING FONTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderReadingFonts()', () => {
    it('should render font cards', async () => {
      await mod._renderReadingFonts();

      const cards = mod.readingFontsList.querySelectorAll('.reading-font-card');
      expect(cards.length).toBe(3);
    });

    it('should show "Встроенный" for builtin fonts', async () => {
      await mod._renderReadingFonts();

      const metas = mod.readingFontsList.querySelectorAll('.reading-font-meta');
      expect(metas[0].textContent).toBe('Встроенный');
    });

    it('should show "Пользовательский" for custom fonts', async () => {
      await mod._renderReadingFonts();

      const metas = mod.readingFontsList.querySelectorAll('.reading-font-meta');
      expect(metas[2].textContent).toBe('Пользовательский');
    });

    it('should show delete button only for non-builtin fonts', async () => {
      await mod._renderReadingFonts();

      const deleteBtns = mod.readingFontsList.querySelectorAll('[data-font-delete]');
      expect(deleteBtns.length).toBe(1);
    });

    it('should load custom font preview for non-builtin fonts with dataUrl', async () => {
      await mod._renderReadingFonts();

      expect(mod._loadCustomFontPreview).toHaveBeenCalledWith('CustomReading_2', 'data:font;base64,abc');
    });

    it('should update font select in settings', async () => {
      await mod._renderReadingFonts();
      expect(app.settings.updateFontSelect).toHaveBeenCalled();
    });
  });

  describe('_openReadingFontModal()', () => {
    it('should reset state and open modal', () => {
      const showModalSpy = vi.spyOn(mod.readingFontModal, 'showModal');

      mod._openReadingFontModal();

      expect(mod._pendingReadingFontDataUrl).toBeNull();
      expect(mod.readingFontUploadLabel.textContent).toBe('Выбрать файл');
      expect(mod.readingFontModalTitle.textContent).toBe('Добавить шрифт');
      expect(showModalSpy).toHaveBeenCalled();
    });
  });

  describe('_handleReadingFontFileUpload()', () => {
    it('should reject files over 2MB', () => {
      const event = {
        target: { files: [{ size: 3 * 1024 * 1024, name: 'big.woff2' }], value: 'big.woff2' },
      };

      mod._handleReadingFontFileUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Файл слишком большой (макс. 2 МБ)');
    });

    it('should reject invalid extensions', () => {
      const event = {
        target: { files: [{ size: 1024, name: 'font.zip' }], value: 'font.zip' },
      };

      mod._handleReadingFontFileUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Допустимые форматы: .woff2, .woff, .ttf, .otf');
    });

    it('should store pending data URL and update label', async () => {
      const mockReader = {
        readAsDataURL: vi.fn(function () {
          this.result = 'data:font;base64,xyz';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const event = {
        target: { files: [{ size: 1024, name: 'custom.woff2' }], value: 'custom.woff2' },
      };

      await mod._handleReadingFontFileUpload(event);

      expect(mod._pendingReadingFontDataUrl).toBe('data:font;base64,xyz');
      expect(mod.readingFontUploadLabel.textContent).toBe('custom.woff2');

      global.FileReader = OriginalFileReader;
    });
  });

  describe('_handleReadingFontSubmit()', () => {
    it('should add reading font to store', () => {
      mod.readingFontNameInput.value = 'My Font';
      mod.readingFontCategory.value = 'serif';
      mod._pendingReadingFontDataUrl = 'data:font;base64,abc';
      vi.spyOn(mod.readingFontModal, 'close');

      mod._handleReadingFontSubmit({ preventDefault: vi.fn() });

      expect(app.store.addReadingFont).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'My Font',
          family: '"My Font", serif',
          builtin: false,
          enabled: true,
          dataUrl: 'data:font;base64,abc',
        })
      );
      expect(app._showToast).toHaveBeenCalledWith('Шрифт добавлен');
    });

    it('should reject if name is empty', () => {
      mod.readingFontNameInput.value = '';
      mod._pendingReadingFontDataUrl = 'data:font;base64,abc';

      mod._handleReadingFontSubmit({ preventDefault: vi.fn() });

      expect(app.store.addReadingFont).not.toHaveBeenCalled();
    });

    it('should reject if no font file uploaded', () => {
      mod.readingFontNameInput.value = 'My Font';
      mod._pendingReadingFontDataUrl = null;

      mod._handleReadingFontSubmit({ preventDefault: vi.fn() });

      expect(app._showToast).toHaveBeenCalledWith('Загрузите файл шрифта');
      expect(app.store.addReadingFont).not.toHaveBeenCalled();
    });

    it('should generate ID with custom_ prefix', () => {
      mod.readingFontNameInput.value = 'Test';
      mod._pendingReadingFontDataUrl = 'data:abc';

      mod._handleReadingFontSubmit({ preventDefault: vi.fn() });

      const font = app.store.addReadingFont.mock.calls[0][0];
      expect(font.id).toMatch(/^custom_\d+$/);
    });
  });
});
