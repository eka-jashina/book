import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@i18n', () => ({ t: vi.fn((key, opts) => opts ? `${key}:${JSON.stringify(opts)}` : key) }));

vi.mock('@/admin/modules/adminHelpers.js', () => ({
  uploadWithFallback: vi.fn().mockResolvedValue('data:audio/mp3;base64,abc'),
}));

import { handleInlineFileUpload, handleAmbientFileUpload } from '@/admin/modules/ambients/AmbientsFileHandler.js';
import { uploadWithFallback } from '@/admin/modules/adminHelpers.js';

// ═══════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════

function createMockModule() {
  return {
    _showToast: vi.fn(),
    _escapeHtml: vi.fn(s => s),
    _validateFile: vi.fn(() => true),
    _renderAmbients: vi.fn(),
    _pendingAmbientDataUrl: null,
    _pendingAmbientFileName: null,
    store: {},
    ambientCards: document.createElement('div'),
    ambientUploadLabel: document.createElement('span'),
    ambientFileInput: document.createElement('input'),
    inlineAmbientFileInput: document.createElement('input'),
  };
}

function createMockAudioFile(name = 'ambient.mp3', size = 1024) {
  return new File([new ArrayBuffer(size)], name, { type: 'audio/mpeg' });
}

describe('AmbientsFileHandler', () => {
  let mod;

  beforeEach(() => {
    mod = createMockModule();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // ФУНКЦИЯ handleInlineFileUpload()
  // ═══════════════════════════════════════════

  describe('handleInlineFileUpload()', () => {
    it('должен обработать аудио файл', async () => {
      const file = createMockAudioFile('rain.mp3');
      const event = { target: { files: [file], value: '' } };

      await handleInlineFileUpload(mod, event);

      expect(uploadWithFallback).toHaveBeenCalled();
    });

    it('должен сохранить data URL в модуле', async () => {
      const file = createMockAudioFile('rain.mp3');
      const event = { target: { files: [file], value: '' } };

      await handleInlineFileUpload(mod, event);

      expect(mod._pendingAmbientDataUrl).toBe('data:audio/mp3;base64,abc');
    });

    it('должен сохранить имя файла в модуле', async () => {
      const file = createMockAudioFile('ocean-waves.mp3');
      const event = { target: { files: [file], value: '' } };

      await handleInlineFileUpload(mod, event);

      expect(mod._pendingAmbientFileName).toBe('ocean-waves.mp3');
    });

    it('должен не вызывать upload при невалидном файле', async () => {
      mod._validateFile.mockReturnValue(false);
      const file = createMockAudioFile('bad.mp3');
      const event = { target: { files: [file], value: '' } };

      await handleInlineFileUpload(mod, event);

      expect(uploadWithFallback).not.toHaveBeenCalled();
    });

    it('должен обработать пустой выбор файла', async () => {
      const event = { target: { files: [], value: '' } };

      await handleInlineFileUpload(mod, event);

      expect(uploadWithFallback).not.toHaveBeenCalled();
    });

    it('должен обработать ошибку загрузки', async () => {
      uploadWithFallback.mockRejectedValueOnce(new Error('upload failed'));

      const file = createMockAudioFile('broken.mp3');
      const event = { target: { files: [file], value: '' } };

      await expect(handleInlineFileUpload(mod, event)).rejects.toThrow('upload failed');
    });
  });

  // ═══════════════════════════════════════════
  // ФУНКЦИЯ handleAmbientFileUpload()
  // ═══════════════════════════════════════════

  describe('handleAmbientFileUpload()', () => {
    it('должен обработать аудио файл', async () => {
      const file = createMockAudioFile('forest.mp3');
      const event = { target: { files: [file], value: '' } };

      await handleAmbientFileUpload(mod, event);

      expect(uploadWithFallback).toHaveBeenCalled();
    });

    it('должен сохранить data URL', async () => {
      const file = createMockAudioFile('birds.mp3');
      const event = { target: { files: [file], value: '' } };

      await handleAmbientFileUpload(mod, event);

      expect(mod._pendingAmbientDataUrl).toBe('data:audio/mp3;base64,abc');
    });

    it('должен не вызывать upload при невалидном файле', async () => {
      mod._validateFile.mockReturnValue(false);
      const file = createMockAudioFile('bad.mp3');
      const event = { target: { files: [file], value: '' } };

      await handleAmbientFileUpload(mod, event);

      expect(uploadWithFallback).not.toHaveBeenCalled();
    });

    it('должен обработать пустой выбор', async () => {
      const event = { target: { files: [], value: '' } };

      await handleAmbientFileUpload(mod, event);

      expect(uploadWithFallback).not.toHaveBeenCalled();
    });

    it('должен обновить label с именем файла', async () => {
      const file = createMockAudioFile('storm.mp3');
      const event = { target: { files: [file], value: '' } };

      await handleAmbientFileUpload(mod, event);

      expect(mod.ambientUploadLabel.textContent).toBe('storm.mp3');
    });
  });
});
