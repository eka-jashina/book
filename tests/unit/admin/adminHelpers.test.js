/**
 * TESTS: adminHelpers
 * Тесты для общих хелперов admin-модулей
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileAsDataURL, uploadWithFallback, setupDropzone } from '../../../js/admin/modules/adminHelpers.js';

describe('adminHelpers', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // readFileAsDataURL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('readFileAsDataURL()', () => {
    it('should resolve with data URL', async () => {
      const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
      const result = await readFileAsDataURL(file);
      expect(result).toMatch(/^data:text\/plain;base64,/);
    });

    it('should resolve with correct base64 content', async () => {
      const content = 'test content';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const result = await readFileAsDataURL(file);
      // Декодируем base64 часть
      const base64 = result.split(',')[1];
      expect(atob(base64)).toBe(content);
    });

    it('should handle empty file', async () => {
      const file = new File([], 'empty.txt', { type: 'text/plain' });
      const result = await readFileAsDataURL(file);
      expect(result).toMatch(/^data:/);
    });

    it('should handle binary file', async () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const file = new File([bytes], 'image.png', { type: 'image/png' });
      const result = await readFileAsDataURL(file);
      expect(result).toMatch(/^data:image\/png;base64,/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // uploadWithFallback
  // ═══════════════════════════════════════════════════════════════════════════

  describe('uploadWithFallback()', () => {
    it('should return server URL when upload succeeds', async () => {
      const store = { uploadImage: vi.fn().mockResolvedValue('https://cdn.example.com/img.png') };
      const file = new File(['data'], 'img.png', { type: 'image/png' });
      const result = await uploadWithFallback(store, file, 'image');
      expect(result).toBe('https://cdn.example.com/img.png');
      expect(store.uploadImage).toHaveBeenCalledWith(file);
    });

    it('should fallback to data URL when upload returns null', async () => {
      const store = { uploadImage: vi.fn().mockResolvedValue(null) };
      const file = new File(['hello'], 'img.png', { type: 'image/png' });
      const result = await uploadWithFallback(store, file, 'image');
      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it('should use uploadSound for sound type', async () => {
      const store = { uploadSound: vi.fn().mockResolvedValue('https://cdn.example.com/sound.mp3') };
      const file = new File(['audio'], 'sound.mp3', { type: 'audio/mpeg' });
      const result = await uploadWithFallback(store, file, 'sound');
      expect(result).toBe('https://cdn.example.com/sound.mp3');
      expect(store.uploadSound).toHaveBeenCalledWith(file);
    });

    it('should use uploadFont for font type', async () => {
      const store = { uploadFont: vi.fn().mockResolvedValue('https://cdn.example.com/font.woff2') };
      const file = new File(['font'], 'font.woff2', { type: 'font/woff2' });
      const result = await uploadWithFallback(store, file, 'font');
      expect(result).toBe('https://cdn.example.com/font.woff2');
      expect(store.uploadFont).toHaveBeenCalledWith(file);
    });

    it('should fallback to data URL when store has no upload method', async () => {
      const store = {};
      const file = new File(['data'], 'file.bin', { type: 'application/octet-stream' });
      const result = await uploadWithFallback(store, file, 'image');
      expect(result).toMatch(/^data:/);
    });

    it('should default to image type when type not specified', async () => {
      const store = { uploadImage: vi.fn().mockResolvedValue('https://cdn.example.com/img.jpg') };
      const file = new File(['data'], 'img.jpg', { type: 'image/jpeg' });
      const result = await uploadWithFallback(store, file);
      expect(result).toBe('https://cdn.example.com/img.jpg');
      expect(store.uploadImage).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setupDropzone
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setupDropzone()', () => {
    let dropzone;
    let fileInput;
    let onFile;

    beforeEach(() => {
      dropzone = document.createElement('div');
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      onFile = vi.fn();
      setupDropzone(dropzone, fileInput, onFile);
    });

    it('should trigger file input click on dropzone click', () => {
      const clickSpy = vi.spyOn(fileInput, 'click');
      dropzone.click();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should add dragover class on dragover', () => {
      const event = new Event('dragover', { bubbles: true });
      event.preventDefault = vi.fn();
      dropzone.dispatchEvent(event);
      expect(dropzone.classList.contains('dragover')).toBe(true);
    });

    it('should prevent default on dragover', () => {
      const event = new Event('dragover', { bubbles: true });
      event.preventDefault = vi.fn();
      dropzone.dispatchEvent(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should remove dragover class on dragleave', () => {
      dropzone.classList.add('dragover');
      dropzone.dispatchEvent(new Event('dragleave'));
      expect(dropzone.classList.contains('dragover')).toBe(false);
    });

    it('should remove dragover class on drop', () => {
      dropzone.classList.add('dragover');
      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.dataTransfer = { files: [] };
      dropzone.dispatchEvent(event);
      expect(dropzone.classList.contains('dragover')).toBe(false);
    });

    it('should call onFile with dropped file', () => {
      const file = new File(['content'], 'test.txt');
      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.dataTransfer = { files: [file] };
      dropzone.dispatchEvent(event);
      expect(onFile).toHaveBeenCalledWith(file);
    });

    it('should not call onFile when no files dropped', () => {
      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.dataTransfer = { files: [] };
      dropzone.dispatchEvent(event);
      expect(onFile).not.toHaveBeenCalled();
    });

    it('should prevent default on drop', () => {
      const event = new Event('drop', { bubbles: true });
      event.preventDefault = vi.fn();
      event.dataTransfer = { files: [] };
      dropzone.dispatchEvent(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });
});
