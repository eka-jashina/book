/**
 * TESTS: AmbientsModule
 * Тесты для модуля управления атмосферными звуками
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AmbientsModule } from '../../../js/admin/modules/AmbientsModule.js';

function createMockApp() {
  return {
    store: {
      getAmbients: vi.fn().mockResolvedValue([
        { id: 'none', label: 'Без звука', icon: '✕', file: null, visible: true, builtin: true },
        { id: 'rain', label: 'Дождь', icon: '🌧️', file: 'sounds/ambient/rain.mp3', visible: true, builtin: true },
        { id: 'custom1', label: 'Океан', icon: '🌊', file: 'ocean.mp3', visible: true, builtin: false },
      ]),
      addAmbient: vi.fn(),
      updateAmbient: vi.fn(),
      removeAmbient: vi.fn(),
      uploadSound: vi.fn().mockResolvedValue(null),
    },
    settings: { render: vi.fn() },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => s),
    _renderJsonPreview: vi.fn(),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="ambientCards"></div>
    <button id="addAmbient"></button>
    <dialog id="ambientModal">
      <h2 id="ambientModalTitle"></h2>
      <form id="ambientForm">
        <input id="ambientLabel" type="text">
        <input id="ambientIcon" type="text">
        <input id="ambientFile" type="text">
        <input id="ambientFileUpload" type="file">
        <span id="ambientUploadLabel"></span>
        <button id="cancelAmbientModal" type="button"></button>
      </form>
    </dialog>
  `;
}

describe('AmbientsModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    setupDOM();
    document.querySelectorAll('dialog').forEach(d => {
      d.showModal = d.showModal || vi.fn();
      d.close = d.close || vi.fn();
    });
    app = createMockApp();
    mod = new AmbientsModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize editing state as null', () => {
      expect(mod._editingAmbientIndex).toBeNull();
      expect(mod._pendingAmbientDataUrl).toBeNull();
    });

    it('should initialize expanded index as -1', () => {
      expect(mod._expandedIndex).toBe(-1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderAmbients
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderAmbients()', () => {
    it('should render ambient cards from store', async () => {
      await mod._renderAmbients();

      const cards = mod.ambientCards.querySelectorAll('.ambient-card');
      expect(cards.length).toBe(3);
    });

    it('should show toggle for non-none ambients', async () => {
      await mod._renderAmbients();

      const toggles = mod.ambientCards.querySelectorAll('[data-ambient-toggle]');
      // 'none' has no toggle, rain and custom1 have toggles
      expect(toggles.length).toBe(2);
    });

    it('should show delete buttons for custom ambients only', async () => {
      await mod._renderAmbients();

      const deleteBtns = mod.ambientCards.querySelectorAll('[data-ambient-delete]');
      // Only custom1 is non-builtin
      expect(deleteBtns.length).toBe(1);
    });

    it('should show expand chevron for custom ambients only', async () => {
      await mod._renderAmbients();

      const chevrons = mod.ambientCards.querySelectorAll('.ambient-expand-icon');
      expect(chevrons.length).toBe(1);
    });

    it('should show "Загруженный файл" for data URL files', async () => {
      app.store.getAmbients.mockResolvedValue([
        { id: 'test', label: 'Test', icon: '🎵', file: 'data:audio/mp3;base64,abc', visible: true, builtin: false },
      ]);

      await mod._renderAmbients();

      const meta = mod.ambientCards.querySelector('.ambient-card-meta');
      expect(meta.textContent).toBe('Загруженный файл');
    });

    it('should show "Нет файла" when file is null', async () => {
      app.store.getAmbients.mockResolvedValue([
        { id: 'none', label: 'Без звука', icon: '✕', file: null, visible: true, builtin: true },
      ]);

      await mod._renderAmbients();

      const meta = mod.ambientCards.querySelector('.ambient-card-meta');
      expect(meta.textContent).toBe('Нет файла');
    });

    it('should render expanded card with form fields', async () => {
      mod._expandedIndex = 2; // custom1
      await mod._renderAmbients();

      const expandedCard = mod.ambientCards.querySelector('.ambient-card--expanded');
      expect(expandedCard).not.toBeNull();
      expect(expandedCard.querySelector('.ambient-inline-label')).not.toBeNull();
      expect(expandedCard.querySelector('.ambient-inline-icon')).not.toBeNull();
      expect(expandedCard.querySelector('.ambient-inline-file-upload')).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _toggleExpand
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_toggleExpand()', () => {
    it('should expand a card', async () => {
      await mod._toggleExpand(2);

      expect(mod._expandedIndex).toBe(2);
      const expanded = mod.ambientCards.querySelector('.ambient-card--expanded');
      expect(expanded).not.toBeNull();
    });

    it('should collapse when toggling the same card', async () => {
      await mod._toggleExpand(2);
      await mod._toggleExpand(2);

      expect(mod._expandedIndex).toBe(-1);
      const expanded = mod.ambientCards.querySelector('.ambient-card--expanded');
      expect(expanded).toBeNull();
    });

    it('should set pending data URL for uploaded files when expanding', async () => {
      app.store.getAmbients.mockResolvedValue([
        { id: 'test', label: 'Test', icon: '🎵', file: 'data:audio/mp3;base64,abc', visible: true, builtin: false },
      ]);

      await mod._toggleExpand(0);

      expect(mod._pendingAmbientDataUrl).toBe('data:audio/mp3;base64,abc');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _addNewAmbient
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_addNewAmbient()', () => {
    it('should add empty ambient and expand it', async () => {
      await mod._addNewAmbient();

      expect(app.store.addAmbient).toHaveBeenCalledWith(
        expect.objectContaining({
          label: expect.any(String),
          icon: '🎵',
          file: null,
          visible: true,
          builtin: false,
        })
      );
      // Label should be non-empty (placeholder for server validation)
      const callArg = app.store.addAmbient.mock.calls[0][0];
      expect(callArg.label.length).toBeGreaterThan(0);
      // After adding, expanded index points to the last card (mock returns 3 items)
      expect(mod._expandedIndex).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _saveExpanded
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_saveExpanded()', () => {
    it('should save expanded ambient data to store', async () => {
      mod._expandedIndex = 2;
      await mod._renderAmbients();

      // Fill in form fields (file comes from existing?.file since no pendingDataUrl)
      const card = mod.ambientCards.querySelector('.ambient-card--expanded');
      card.querySelector('.ambient-inline-label').value = 'Океан обновлённый';
      card.querySelector('.ambient-inline-icon').value = '🌊';

      await mod._saveExpanded();

      expect(app.store.updateAmbient).toHaveBeenCalledWith(2,
        expect.objectContaining({
          id: 'custom1',
          label: 'Океан обновлённый',
          icon: '🌊',
          file: 'ocean.mp3',
        })
      );
      expect(mod._expandedIndex).toBe(-1);
    });

    it('should truncate shortLabel to 8 characters', async () => {
      mod._expandedIndex = 2;
      await mod._renderAmbients();

      const card = mod.ambientCards.querySelector('.ambient-card--expanded');
      card.querySelector('.ambient-inline-label').value = 'Очень длинное название';
      card.querySelector('.ambient-inline-icon').value = '🎵';
      // file comes from existing?.file ('ocean.mp3')

      await mod._saveExpanded();

      const ambient = app.store.updateAmbient.mock.calls[0][1];
      expect(ambient.shortLabel).toBe('Очень дл');
      expect(ambient.shortLabel.length).toBeLessThanOrEqual(8);
    });

    it('should reject if label or icon is empty', async () => {
      mod._expandedIndex = 2;
      await mod._renderAmbients();

      const card = mod.ambientCards.querySelector('.ambient-card--expanded');
      card.querySelector('.ambient-inline-label').value = '';
      card.querySelector('.ambient-inline-icon').value = '';

      await mod._saveExpanded();

      expect(app.store.updateAmbient).not.toHaveBeenCalled();
    });

    it('should reject if no file provided', async () => {
      // Ambient with no file and no pending data URL
      app.store.getAmbients.mockResolvedValue([
        { id: 'none', label: 'Без звука', icon: '✕', file: null, visible: true, builtin: true },
        { id: 'rain', label: 'Дождь', icon: '🌧️', file: 'sounds/ambient/rain.mp3', visible: true, builtin: true },
        { id: 'custom1', label: 'Океан', icon: '🌊', file: null, visible: true, builtin: false },
      ]);
      mod._expandedIndex = 2;
      mod._pendingAmbientDataUrl = null;
      await mod._renderAmbients();

      const card = mod.ambientCards.querySelector('.ambient-card--expanded');
      card.querySelector('.ambient-inline-label').value = 'Test';
      card.querySelector('.ambient-inline-icon').value = '🎵';

      await mod._saveExpanded();

      expect(app.store.updateAmbient).not.toHaveBeenCalled();
    });

    it('should prefer pending data URL over existing file', async () => {
      mod._expandedIndex = 2;
      mod._pendingAmbientDataUrl = 'data:audio/mp3;base64,abc';
      await mod._renderAmbients();

      const card = mod.ambientCards.querySelector('.ambient-card--expanded');
      card.querySelector('.ambient-inline-label').value = 'Test';
      card.querySelector('.ambient-inline-icon').value = '🎵';
      // existing file is 'ocean.mp3', but pendingDataUrl should take priority

      await mod._saveExpanded();

      const ambient = app.store.updateAmbient.mock.calls[0][1];
      expect(ambient.file).toBe('data:audio/mp3;base64,abc');
    });

    it('should do nothing if no card is expanded', async () => {
      mod._expandedIndex = -1;
      await mod._saveExpanded();

      expect(app.store.updateAmbient).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleAmbientFileUpload (legacy)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleAmbientFileUpload()', () => {
    it('should reject files over 3MB', () => {
      const event = {
        target: { files: [{ size: 6 * 1024 * 1024, type: 'audio/mp3' }], value: 'big.mp3' },
      };

      mod._handleAmbientFileUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Файл слишком большой (макс. 3 МБ)');
    });

    it('should reject non-audio files', () => {
      const event = {
        target: { files: [{ size: 1024, type: 'image/png' }], value: 'img.png' },
      };

      mod._handleAmbientFileUpload(event);

      expect(app._showToast).toHaveBeenCalledWith('Допустимы только аудиофайлы');
    });

    it('should store data URL and update label on success', async () => {
      const mockReader = {
        readAsDataURL: vi.fn(function () {
          this.result = 'data:audio/mp3;base64,xyz';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const event = {
        target: { files: [{ size: 1024, type: 'audio/mp3', name: 'ambient.mp3' }], value: 'ambient.mp3' },
      };

      await mod._handleAmbientFileUpload(event);

      expect(mod._pendingAmbientDataUrl).toBe('data:audio/mp3;base64,xyz');
      expect(mod.ambientUploadLabel.textContent).toBe('ambient.mp3');

      global.FileReader = OriginalFileReader;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleAmbientSubmit (legacy)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleAmbientSubmit()', () => {
    it('should add new ambient to store', async () => {
      mod.ambientLabelInput.value = 'Лес';
      mod.ambientIconInput.value = '🌲';
      mod.ambientFileInput.value = 'forest.mp3';
      vi.spyOn(mod.ambientModal, 'close');

      const event = { preventDefault: vi.fn() };
      await mod._handleAmbientSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(app.store.addAmbient).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Лес',
          icon: '🌲',
          file: 'forest.mp3',
          visible: true,
          builtin: false,
        })
      );
      expect(app._showToast).toHaveBeenCalledWith('Атмосфера добавлена');
    });

    it('should update existing ambient in edit mode', async () => {
      mod._editingAmbientIndex = 2;
      mod.ambientLabelInput.value = 'Океан обновлённый';
      mod.ambientIconInput.value = '🌊';
      mod.ambientFileInput.value = 'ocean2.mp3';
      vi.spyOn(mod.ambientModal, 'close');

      const event = { preventDefault: vi.fn() };
      await mod._handleAmbientSubmit(event);

      expect(app.store.updateAmbient).toHaveBeenCalledWith(2,
        expect.objectContaining({
          id: 'custom1',
          label: 'Океан обновлённый',
        })
      );
      expect(app._showToast).toHaveBeenCalledWith('Атмосфера обновлена');
    });

    it('should truncate shortLabel to 8 characters', async () => {
      mod.ambientLabelInput.value = 'Очень длинное название';
      mod.ambientIconInput.value = '🎵';
      mod.ambientFileInput.value = 'file.mp3';

      await mod._handleAmbientSubmit({ preventDefault: vi.fn() });

      const ambient = app.store.addAmbient.mock.calls[0][0];
      expect(ambient.shortLabel).toBe('Очень дл');
      expect(ambient.shortLabel.length).toBeLessThanOrEqual(8);
    });

    it('should reject if label or icon is empty', async () => {
      mod.ambientLabelInput.value = '';
      mod.ambientIconInput.value = '';

      await mod._handleAmbientSubmit({ preventDefault: vi.fn() });

      expect(app.store.addAmbient).not.toHaveBeenCalled();
    });

    it('should reject if no file provided', async () => {
      mod.ambientLabelInput.value = 'Test';
      mod.ambientIconInput.value = '🎵';
      mod.ambientFileInput.value = '';
      mod._pendingAmbientDataUrl = null;

      await mod._handleAmbientSubmit({ preventDefault: vi.fn() });

      expect(app._showToast).toHaveBeenCalledWith('Укажите путь к файлу или загрузите аудио');
      expect(app.store.addAmbient).not.toHaveBeenCalled();
    });

    it('should prefer pending data URL over file path', async () => {
      mod.ambientLabelInput.value = 'Test';
      mod.ambientIconInput.value = '🎵';
      mod.ambientFileInput.value = 'path.mp3';
      mod._pendingAmbientDataUrl = 'data:audio/mp3;base64,abc';

      await mod._handleAmbientSubmit({ preventDefault: vi.fn() });

      const ambient = app.store.addAmbient.mock.calls[0][0];
      expect(ambient.file).toBe('data:audio/mp3;base64,abc');
    });
  });
});
