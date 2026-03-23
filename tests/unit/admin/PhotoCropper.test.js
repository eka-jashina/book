/**
 * Unit tests for PhotoCropper
 * Кадрирование фотографий: UI оверлей, drag/resize, обрезка через canvas
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhotoCropper } from '../../../js/admin/modules/PhotoCropper.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Мок Image */
let imgInstances;

function setupImageMock(naturalWidth = 800, naturalHeight = 600) {
  imgInstances = [];
  const OrigImage = globalThis.Image;
  globalThis.Image = class MockImage extends OrigImage {
    constructor() {
      super();
      this.onload = null;
      this.onerror = null;
      Object.defineProperty(this, 'naturalWidth', { value: naturalWidth, writable: true });
      Object.defineProperty(this, 'naturalHeight', { value: naturalHeight, writable: true });
      imgInstances.push(this);
    }
    getBoundingClientRect() {
      return { left: 120, top: 60, width: 400, height: 300, right: 520, bottom: 360 };
    }
  };
}

/** Мок canvas */
let mockCtx, mockCanvas, originalCreateElement;

function setupCanvasMock() {
  mockCtx = { drawImage: vi.fn() };
  mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => mockCtx),
    toDataURL: vi.fn(() => 'data:image/jpeg;base64,cropped'),
  };

  originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'canvas') return mockCanvas;
    return originalCreateElement(tag);
  });
}

/** Запустить crop() и вызвать onload на Image, вернуть промис */
function cropAndLoad(cropper, dataUrl = 'data:image/jpeg;base64,src') {
  const promise = cropper.crop(dataUrl);
  const img = imgInstances[imgInstances.length - 1];
  img.onload();
  // jsdom не рассчитывает layout — задать _imgRect вручную
  cropper._imgRect = { x: 20, y: 10, w: 400, h: 300 };
  cropper._crop = { x: 0, y: 0, w: 400, h: 300 };
  return { promise, img };
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('PhotoCropper', () => {
  let cropper;
  let rafCallback;

  beforeEach(() => {
    document.body.innerHTML = '';
    setupImageMock();
    setupCanvasMock();
    cropper = new PhotoCropper();

    // Мок requestAnimationFrame — сразу вызываем callback
    rafCallback = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb;
      cb();
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  // ─────────────────────────────────────────────────────────────────────────
  // constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should initialize with null overlay', () => {
      expect(cropper._overlay).toBeNull();
    });

    it('should initialize with null resolve', () => {
      expect(cropper._resolve).toBeNull();
    });

    it('should initialize with null img', () => {
      expect(cropper._img).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // crop() — открытие и закрытие
  // ─────────────────────────────────────────────────────────────────────────

  describe('crop()', () => {
    it('should return a Promise', () => {
      const result = cropper.crop('data:image/png;base64,abc');
      expect(result).toBeInstanceOf(Promise);
      // Очистить — вызвать onerror чтобы промис завершился
      imgInstances[0].onerror();
    });

    it('should create an overlay in the DOM', () => {
      cropper.crop('data:image/png;base64,abc');
      expect(document.querySelector('.photo-cropper')).not.toBeNull();
      imgInstances[0].onerror();
    });

    it('should set role="dialog" on overlay', () => {
      cropper.crop('data:image/png;base64,abc');
      const overlay = document.querySelector('.photo-cropper');
      expect(overlay.getAttribute('role')).toBe('dialog');
      imgInstances[0].onerror();
    });

    it('should set aria-modal="true" on overlay', () => {
      cropper.crop('data:image/png;base64,abc');
      const overlay = document.querySelector('.photo-cropper');
      expect(overlay.getAttribute('aria-modal')).toBe('true');
      imgInstances[0].onerror();
    });

    it('should create action buttons (confirm + cancel)', () => {
      cropper.crop('data:image/png;base64,abc');
      const buttons = document.querySelectorAll('.photo-cropper__btn');
      expect(buttons).toHaveLength(2);
      imgInstances[0].onerror();
    });

    it('should create 8 resize handles', () => {
      cropper.crop('data:image/png;base64,abc');
      const handles = document.querySelectorAll('.photo-cropper__handle');
      expect(handles).toHaveLength(8);
      imgInstances[0].onerror();
    });

    it('should create selection element', () => {
      cropper.crop('data:image/png;base64,abc');
      expect(document.querySelector('.photo-cropper__selection')).not.toBeNull();
      imgInstances[0].onerror();
    });

    it('should create dimming element', () => {
      cropper.crop('data:image/png;base64,abc');
      expect(document.querySelector('.photo-cropper__dimming')).not.toBeNull();
      imgInstances[0].onerror();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _loadImage()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_loadImage()', () => {
    it('should set img src to the provided dataUrl', () => {
      cropper.crop('data:image/png;base64,test123');
      expect(imgInstances[0].src).toBe('data:image/png;base64,test123');
      imgInstances[0].onerror();
    });

    it('should store naturalWidth and naturalHeight on load', () => {
      setupImageMock(1920, 1080);
      cropAndLoad(cropper);
      expect(cropper._naturalW).toBe(1920);
      expect(cropper._naturalH).toBe(1080);
    });

    it('should resolve with null on image load error', async () => {
      const promise = cropper.crop('data:image/png;base64,bad');
      imgInstances[0].onerror();
      const result = await promise;
      expect(result).toBeNull();
    });

    it('should remove overlay on image load error', async () => {
      const promise = cropper.crop('data:image/png;base64,bad');
      imgInstances[0].onerror();
      await promise;
      expect(document.querySelector('.photo-cropper')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _cancel()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_cancel()', () => {
    it('should resolve with null', async () => {
      const { promise } = cropAndLoad(cropper);
      cropper._cancel();
      const result = await promise;
      expect(result).toBeNull();
    });

    it('should remove overlay from DOM', () => {
      cropAndLoad(cropper);
      cropper._cancel();
      expect(document.querySelector('.photo-cropper')).toBeNull();
    });

    it('should be triggered by cancel button click', async () => {
      const { promise } = cropAndLoad(cropper);
      const buttons = document.querySelectorAll('.photo-cropper__btn');
      // Вторая кнопка — «Отмена»
      buttons[1].click();
      const result = await promise;
      expect(result).toBeNull();
    });

    it('should be triggered by Escape key', async () => {
      const { promise } = cropAndLoad(cropper);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      const result = await promise;
      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _confirm() / _cropImage()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_confirm()', () => {
    it('should resolve with a data URL', async () => {
      const { promise } = cropAndLoad(cropper);
      cropper._confirm();
      const result = await promise;
      expect(result).toBe('data:image/jpeg;base64,cropped');
    });

    it('should remove overlay from DOM', () => {
      cropAndLoad(cropper);
      cropper._confirm();
      expect(document.querySelector('.photo-cropper')).toBeNull();
    });

    it('should be triggered by confirm button click', async () => {
      const { promise } = cropAndLoad(cropper);
      const buttons = document.querySelectorAll('.photo-cropper__btn');
      // Первая кнопка — «Применить»
      buttons[0].click();
      const result = await promise;
      expect(result).toBe('data:image/jpeg;base64,cropped');
    });

    it('should call canvas drawImage', () => {
      cropAndLoad(cropper);
      cropper._confirm();
      expect(mockCtx.drawImage).toHaveBeenCalled();
    });

    it('should output PNG for PNG source', () => {
      mockCanvas.toDataURL.mockReturnValue('data:image/png;base64,croppedpng');
      const { promise } = cropAndLoad(cropper, 'data:image/png;base64,src');
      cropper._confirm();
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png');
    });

    it('should output JPEG for JPEG source', () => {
      cropAndLoad(cropper, 'data:image/jpeg;base64,src');
      cropper._confirm();
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.92);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _clampCrop()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_clampCrop()', () => {
    beforeEach(() => {
      cropper._imgRect = { x: 0, y: 0, w: 400, h: 300 };
    });

    it('should clamp x to >= 0', () => {
      cropper._crop = { x: -50, y: 0, w: 100, h: 100 };
      cropper._clampCrop();
      expect(cropper._crop.x).toBe(0);
    });

    it('should clamp y to >= 0', () => {
      cropper._crop = { x: 0, y: -50, w: 100, h: 100 };
      cropper._clampCrop();
      expect(cropper._crop.y).toBe(0);
    });

    it('should clamp x so selection stays within image', () => {
      cropper._crop = { x: 350, y: 0, w: 100, h: 100 };
      cropper._clampCrop();
      expect(cropper._crop.x).toBe(300); // 400 - 100
    });

    it('should clamp y so selection stays within image', () => {
      cropper._crop = { x: 0, y: 280, w: 100, h: 100 };
      cropper._clampCrop();
      expect(cropper._crop.y).toBe(200); // 300 - 100
    });

    it('should enforce minimum width', () => {
      cropper._crop = { x: 0, y: 0, w: 5, h: 100 };
      cropper._clampCrop();
      expect(cropper._crop.w).toBe(30); // MIN_CROP_SIZE
    });

    it('should enforce minimum height', () => {
      cropper._crop = { x: 0, y: 0, w: 100, h: 5 };
      cropper._clampCrop();
      expect(cropper._crop.h).toBe(30); // MIN_CROP_SIZE
    });

    it('should clamp width to image width', () => {
      cropper._crop = { x: 0, y: 0, w: 500, h: 100 };
      cropper._clampCrop();
      expect(cropper._crop.w).toBe(400);
    });

    it('should clamp height to image height', () => {
      cropper._crop = { x: 0, y: 0, w: 100, h: 400 };
      cropper._clampCrop();
      expect(cropper._crop.h).toBe(300);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _resizeCrop()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_resizeCrop()', () => {
    const startCrop = { x: 50, y: 50, w: 200, h: 150 };

    beforeEach(() => {
      cropper._crop = { ...startCrop };
    });

    it('should move right edge on "e" handle', () => {
      cropper._resizeCrop('e', startCrop, 30, 0, false);
      expect(cropper._crop.w).toBe(230);
      expect(cropper._crop.x).toBe(50); // x unchanged
    });

    it('should move left edge on "w" handle', () => {
      cropper._resizeCrop('w', startCrop, -20, 0, false);
      expect(cropper._crop.x).toBe(30);
      expect(cropper._crop.w).toBe(220);
    });

    it('should move bottom edge on "s" handle', () => {
      cropper._resizeCrop('s', startCrop, 0, 40, false);
      expect(cropper._crop.h).toBe(190);
      expect(cropper._crop.y).toBe(50); // y unchanged
    });

    it('should move top edge on "n" handle', () => {
      cropper._resizeCrop('n', startCrop, 0, -25, false);
      expect(cropper._crop.y).toBe(25);
      expect(cropper._crop.h).toBe(175);
    });

    it('should move both x and y on "nw" handle', () => {
      cropper._resizeCrop('nw', startCrop, -10, -15, false);
      expect(cropper._crop.x).toBe(40);
      expect(cropper._crop.y).toBe(35);
      expect(cropper._crop.w).toBe(210);
      expect(cropper._crop.h).toBe(165);
    });

    it('should move right and bottom on "se" handle', () => {
      cropper._resizeCrop('se', startCrop, 20, 25, false);
      expect(cropper._crop.w).toBe(220);
      expect(cropper._crop.h).toBe(175);
      expect(cropper._crop.x).toBe(50);
      expect(cropper._crop.y).toBe(50);
    });

    it('should enforce minimum width on "w" handle', () => {
      cropper._resizeCrop('w', startCrop, 190, 0, false);
      expect(cropper._crop.w).toBe(30); // MIN_CROP_SIZE
    });

    it('should enforce minimum height on "n" handle', () => {
      cropper._resizeCrop('n', startCrop, 0, 140, false);
      expect(cropper._crop.h).toBe(30); // MIN_CROP_SIZE
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _close()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_close()', () => {
    it('should remove overlay from document', () => {
      cropAndLoad(cropper);
      expect(document.querySelector('.photo-cropper')).not.toBeNull();
      cropper._close();
      expect(document.querySelector('.photo-cropper')).toBeNull();
    });

    it('should set _overlay to null', () => {
      cropAndLoad(cropper);
      cropper._close();
      expect(cropper._overlay).toBeNull();
    });

    it('should set _img to null', () => {
      cropAndLoad(cropper);
      cropper._close();
      expect(cropper._img).toBeNull();
    });

    it('should set _drag to null', () => {
      cropAndLoad(cropper);
      cropper._drag = { type: 'move' };
      cropper._close();
      expect(cropper._drag).toBeNull();
    });

    it('should not throw when called without overlay', () => {
      expect(() => cropper._close()).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Повторное использование
  // ─────────────────────────────────────────────────────────────────────────

  describe('повторное использование', () => {
    it('should remove previous overlay when crop() is called again', () => {
      cropAndLoad(cropper);
      expect(document.querySelectorAll('.photo-cropper')).toHaveLength(1);
      // Вызываем crop второй раз — предыдущий оверлей должен быть удалён
      cropper.crop('data:image/jpeg;base64,second');
      expect(document.querySelectorAll('.photo-cropper')).toHaveLength(1);
      imgInstances[imgInstances.length - 1].onerror();
    });
  });
});
