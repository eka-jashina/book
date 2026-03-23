/**
 * TESTS: SoundsModule
 * Тесты для модуля управления звуками (селекторный UI)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SoundsModule } from '../../../js/admin/modules/SoundsModule.js';

function createMockApp() {
  return {
    store: {
      getSounds: vi.fn().mockResolvedValue({
        pageFlip: 'sounds/page-flip.mp3',
        bookOpen: 'sounds/cover-flip.mp3',
        bookClose: 'sounds/cover-flip.mp3',
      }),
      updateSounds: vi.fn(),
      uploadSound: vi.fn().mockResolvedValue(null),
    },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((s) => s),
    _renderJsonPreview: vi.fn(),
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="soundCardsGrid"></div>
    <button id="saveSounds"></button>
    <button id="resetSounds"></button>
  `;
}

describe('SoundsModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    setupDOM();
    app = createMockApp();
    mod = new SoundsModule(app);
    mod.cacheDOM();
    mod.bindEvents();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // cacheDOM
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cacheDOM()', () => {
    it('should generate sound cards and cache DOM elements', () => {
      expect(mod._modes.pageFlip).toBe(document.getElementById('sound-pageFlip-mode'));
      expect(mod._modes.bookOpen).toBe(document.getElementById('sound-bookOpen-mode'));
      expect(mod._modes.bookClose).toBe(document.getElementById('sound-bookClose-mode'));
      expect(mod._uploads.pageFlip).toBe(document.getElementById('sound-pageFlip-upload'));
      expect(mod._customInfos.pageFlip).toBe(document.getElementById('sound-pageFlip-custom-info'));
      expect(mod._removeButtons.pageFlip).toBe(document.getElementById('sound-pageFlip-remove'));
      expect(mod._previewButtons.pageFlip).toBe(document.getElementById('sound-pageFlip-preview'));
      expect(mod.saveSoundsBtn).toBe(document.getElementById('saveSounds'));
      expect(mod.resetSoundsBtn).toBe(document.getElementById('resetSounds'));
    });

    it('should generate 3 sound cards in the grid', () => {
      const cards = document.querySelectorAll('#soundCardsGrid .setting-card--sound');
      expect(cards.length).toBe(3);
    });

    it('should generate selector options for each card', () => {
      const options = document.querySelectorAll('[data-sound-key="pageFlip"] .sound-option');
      expect(options.length).toBe(2); // default + custom
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _renderSounds
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_renderSounds()', () => {
    it('should set mode to default for file paths', async () => {
      await mod._renderSounds();

      expect(mod._modes.pageFlip.value).toBe('default');
      expect(mod._modes.bookOpen.value).toBe('default');
      expect(mod._modes.bookClose.value).toBe('default');
    });

    it('should hide custom info for default sounds', async () => {
      await mod._renderSounds();

      expect(mod._customInfos.pageFlip.hidden).toBe(true);
      expect(mod._customInfos.bookOpen.hidden).toBe(true);
    });

    it('should set mode to custom for data URLs', async () => {
      app.store.getSounds.mockResolvedValue({
        pageFlip: 'data:audio/mp3;base64,abc',
        bookOpen: 'sounds/cover-flip.mp3',
        bookClose: 'sounds/cover-flip.mp3',
      });

      await mod._renderSounds();

      expect(mod._modes.pageFlip.value).toBe('custom');
      expect(mod._customInfos.pageFlip.hidden).toBe(false);
    });

    it('should set mode to custom for http URLs', async () => {
      app.store.getSounds.mockResolvedValue({
        pageFlip: 'https://example.com/sound.mp3',
        bookOpen: 'sounds/cover-flip.mp3',
        bookClose: 'sounds/cover-flip.mp3',
      });

      await mod._renderSounds();

      expect(mod._modes.pageFlip.value).toBe('custom');
      expect(mod._customInfos.pageFlip.hidden).toBe(false);
    });

    it('should mark default option as active for default mode', async () => {
      await mod._renderSounds();

      const defaultBtn = document.querySelector('[data-sound-key="pageFlip"] .sound-option[data-sound-mode="default"]');
      expect(defaultBtn.classList.contains('active')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _selectMode
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_selectMode()', () => {
    it('should reset to default sound and update selector', async () => {
      // Сначала сделать кастомным
      app.store.getSounds.mockResolvedValue({
        pageFlip: 'data:audio/mp3;base64,abc',
        bookOpen: 'sounds/cover-flip.mp3',
        bookClose: 'sounds/cover-flip.mp3',
      });
      await mod._renderSounds();
      expect(mod._modes.pageFlip.value).toBe('custom');

      // Кликнуть "По умолчанию"
      await mod._selectMode('pageFlip', 'default');

      expect(app.store.updateSounds).toHaveBeenCalledWith({ pageFlip: 'sounds/page-flip.mp3' });
      expect(mod._modes.pageFlip.value).toBe('default');
      expect(mod._customInfos.pageFlip.hidden).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _handleSoundUpload
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_handleSoundUpload()', () => {
    it('should reject files over 2MB', () => {
      const event = {
        target: { files: [{ size: 3 * 1024 * 1024, type: 'audio/mp3' }], value: 'file.mp3' },
      };

      mod._handleSoundUpload(event, 'pageFlip');

      expect(app._showToast).toHaveBeenCalledWith('Файл слишком большой (макс. 2 МБ)');
      expect(event.target.value).toBe('');
    });

    it('should reject non-audio files', () => {
      const event = {
        target: { files: [{ size: 1024, type: 'image/png' }], value: 'img.png' },
      };

      mod._handleSoundUpload(event, 'pageFlip');

      expect(app._showToast).toHaveBeenCalledWith('Допустимы только аудиофайлы');
    });

    it('should upload valid audio file via FileReader', async () => {
      const mockReader = {
        readAsDataURL: vi.fn(function () {
          this.result = 'data:audio/mp3;base64,abc';
          this.onload();
        }),
        result: null,
        onload: null,
      };
      const OriginalFileReader = global.FileReader;
      global.FileReader = vi.fn(function() { return mockReader; });

      const event = {
        target: { files: [{ size: 1024, type: 'audio/mp3' }], value: 'file.mp3' },
      };

      await mod._handleSoundUpload(event, 'pageFlip');

      expect(app.store.updateSounds).toHaveBeenCalledWith({ pageFlip: 'data:audio/mp3;base64,abc' });
      expect(app._showToast).toHaveBeenCalledWith('Звук загружен');
      expect(event.target.value).toBe('');
      expect(mod._modes.pageFlip.value).toBe('custom');

      global.FileReader = OriginalFileReader;
    });

    it('should do nothing if no file selected', () => {
      const event = { target: { files: [] } };
      mod._handleSoundUpload(event, 'pageFlip');
      expect(app.store.updateSounds).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _removeCustom
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_removeCustom()', () => {
    it('should reset to default and update selector', () => {
      mod._removeCustom('pageFlip');

      expect(app.store.updateSounds).toHaveBeenCalledWith({ pageFlip: 'sounds/page-flip.mp3' });
      expect(mod._modes.pageFlip.value).toBe('default');
      expect(mod._customInfos.pageFlip.hidden).toBe(true);
      expect(app._showToast).toHaveBeenCalledWith('Звуки сброшены');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _resetSounds
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_resetSounds()', () => {
    it('should reset all sounds to default paths', async () => {
      await mod._resetSounds();

      expect(app.store.updateSounds).toHaveBeenCalledWith({
        pageFlip: 'sounds/page-flip.mp3',
        bookOpen: 'sounds/cover-flip.mp3',
        bookClose: 'sounds/cover-flip.mp3',
      });
      expect(app._showToast).toHaveBeenCalledWith('Звуки сброшены');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _togglePreview
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_togglePreview()', () => {
    it('should create Audio and play sound', async () => {
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        addEventListener: vi.fn(),
      };
      const OriginalAudio = global.Audio;
      global.Audio = vi.fn(function() { return mockAudio; });

      await mod._togglePreview('pageFlip');

      expect(global.Audio).toHaveBeenCalledWith('sounds/page-flip.mp3');
      expect(mockAudio.play).toHaveBeenCalled();
      expect(mod._playingKey).toBe('pageFlip');

      global.Audio = OriginalAudio;
    });

    it('should stop playing when toggled again', async () => {
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        addEventListener: vi.fn(),
      };
      const OriginalAudio = global.Audio;
      global.Audio = vi.fn(function() { return mockAudio; });

      await mod._togglePreview('pageFlip');
      await mod._togglePreview('pageFlip');

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(mod._playingKey).toBe(null);

      global.Audio = OriginalAudio;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _saveSounds
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_saveSounds()', () => {
    it('should show toast on save', async () => {
      await mod._saveSounds();

      expect(app._showToast).toHaveBeenCalledWith('Звуки сохранены');
    });
  });
});
