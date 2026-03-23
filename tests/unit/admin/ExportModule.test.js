/**
 * TESTS: ExportModule
 * Тесты для модуля экспорта/импорта конфигурации
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportModule } from '../../../js/admin/modules/ExportModule.js';

function createMockApp() {
  return {
    store: {
      exportJSON: vi.fn(() => '{"books":[]}'),
      importJSON: vi.fn(),
      clear: vi.fn(),
    },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => s),
    _renderJsonPreview: vi.fn(),
    _render: vi.fn(),
    _confirm: vi.fn(() => Promise.resolve(true)),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <button id="exportConfig"></button>
    <input id="importConfig" type="file">
    <button id="resetAll"></button>
    <pre id="jsonPreview"></pre>
    <button id="copyJson"></button>
  `;
}

describe('ExportModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    setupDOM();
    app = createMockApp();
    mod = new ExportModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // cacheDOM
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cacheDOM()', () => {
    it('should cache all required DOM elements', () => {
      expect(mod.exportBtn).toBe(document.getElementById('exportConfig'));
      expect(mod.importInput).toBe(document.getElementById('importConfig'));
      expect(mod.resetAllBtn).toBe(document.getElementById('resetAll'));
      expect(mod.jsonPreview).toBe(document.getElementById('jsonPreview'));
      expect(mod.copyJsonBtn).toBe(document.getElementById('copyJson'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // render / renderJsonPreview
  // ═══════════════════════════════════════════════════════════════════════════

  describe('renderJsonPreview()', () => {
    it('should set jsonPreview text from store.exportJSON()', () => {
      mod.renderJsonPreview();
      expect(app.store.exportJSON).toHaveBeenCalled();
      expect(mod.jsonPreview.textContent).toBe('{"books":[]}');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _exportConfig
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_exportConfig()', () => {
    it('should export JSON from store and show toast', () => {
      const createObjectURL = vi.fn(() => 'blob:url');
      const revokeObjectURL = vi.fn();
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;

      mod._exportConfig();

      expect(app.store.exportJSON).toHaveBeenCalled();
      expect(createObjectURL).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:url');
      expect(app._showToast).toHaveBeenCalledWith('Конфигурация скачана');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _importConfig
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_importConfig()', () => {
    it('should import valid JSON via FileReader', () => {
      const jsonContent = '{"books":[{"id":"test"}]}';
      const mockReader = {
        readAsText: vi.fn(function () {
          this.result = jsonContent;
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const file = new File([jsonContent], 'config.json', { type: 'application/json' });
      const event = { target: { files: [file], value: 'config.json' } };

      mod._importConfig(event);

      expect(app.store.importJSON).toHaveBeenCalledWith(jsonContent);
      expect(app._render).toHaveBeenCalled();
      expect(app._showToast).toHaveBeenCalledWith('Конфигурация загружена');
      expect(event.target.value).toBe('');

      global.FileReader = OriginalFileReader;
    });

    it('should show error toast on invalid JSON', () => {
      const mockReader = {
        readAsText: vi.fn(function () {
          this.result = 'not json';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      app.store.importJSON.mockImplementation(() => { throw new Error('bad json'); });

      const file = new File(['bad'], 'bad.json');
      const event = { target: { files: [file], value: 'bad.json' } };

      mod._importConfig(event);

      expect(app._showToast).toHaveBeenCalledWith('Ошибка: неверный формат JSON');

      global.FileReader = OriginalFileReader;
    });

    it('should do nothing if no file selected', () => {
      const event = { target: { files: [], value: '' } };
      mod._importConfig(event);
      expect(app.store.importJSON).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _resetAll
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_resetAll()', () => {
    it('should clear store and re-render on confirm', async () => {
      app._confirm.mockResolvedValue(true);

      await mod._resetAll();

      expect(app.store.clear).toHaveBeenCalled();
      expect(app._render).toHaveBeenCalled();
      expect(app._showToast).toHaveBeenCalledWith('Всё сброшено');
    });

    it('should do nothing on cancel', async () => {
      app._confirm.mockResolvedValue(false);

      await mod._resetAll();

      expect(app.store.clear).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _copyJson
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_copyJson()', () => {
    it('should copy JSON to clipboard and show toast', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });

      mod._copyJson();

      expect(writeText).toHaveBeenCalledWith('{"books":[]}');

      await vi.waitFor(() => {
        expect(app._showToast).toHaveBeenCalledWith('Скопировано в буфер');
      });
    });
  });
});
