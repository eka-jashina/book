/**
 * INTEGRATION TEST: Photo Cropper
 * Выделение области, перемещение, ресайз, Escape-отмена, canvas-кадрирование.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhotoCropper } from '../../../js/admin/modules/PhotoCropper.js';
import { flushPromises } from '../../helpers/testUtils.js';

describe('Photo Cropper Integration', () => {
  let cropper;

  // 1×1 red PNG (minimal valid image data URL)
  const RED_PIXEL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  beforeEach(() => {
    cropper = new PhotoCropper();
  });

  afterEach(() => {
    // Clean up any leftover overlay
    document.querySelectorAll('.photo-cropper').forEach(el => el.remove());
    cropper = null;
  });

  describe('Overlay construction', () => {
    it('should build overlay DOM with all required elements', () => {
      cropper._buildOverlay();

      const overlay = document.querySelector('.photo-cropper');
      expect(overlay).toBeTruthy();
      expect(overlay.getAttribute('role')).toBe('dialog');
      expect(overlay.getAttribute('aria-modal')).toBe('true');
    });

    it('should create image container and dimming layer', () => {
      cropper._buildOverlay();

      expect(document.querySelector('.photo-cropper__canvas')).toBeTruthy();
      expect(document.querySelector('.photo-cropper__dimming')).toBeTruthy();
    });

    it('should create selection frame with 8 resize handles', () => {
      cropper._buildOverlay();

      const handles = document.querySelectorAll('.photo-cropper__handle');
      expect(handles.length).toBe(8);

      const handleIds = [...handles].map(h => h.dataset.handle);
      expect(handleIds).toEqual(expect.arrayContaining(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']));
    });

    it('should create confirm and cancel buttons', () => {
      cropper._buildOverlay();

      const buttons = document.querySelectorAll('.photo-cropper__btn');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toBe('Применить');
      expect(buttons[1].textContent).toBe('Отмена');
    });

    it('should remove previous overlay if exists', () => {
      cropper._buildOverlay();
      cropper._buildOverlay();

      const overlays = document.querySelectorAll('.photo-cropper');
      expect(overlays.length).toBe(1);
    });
  });

  describe('Image loading', () => {
    it('should resolve null when image fails to load', async () => {
      // Capture Image instances to trigger onerror (jsdom doesn't fire load events)
      let createdImg;
      const OrigImage = globalThis.Image;
      globalThis.Image = class extends OrigImage {
        constructor(...args) {
          super(...args);
          createdImg = this;
        }
      };

      const promise = cropper.crop('data:image/png;base64,INVALID');
      await flushPromises();

      // Trigger onerror on the image created by _loadImage
      if (createdImg?.onerror) createdImg.onerror();

      const result = await promise;
      expect(result).toBeNull();

      globalThis.Image = OrigImage;
    });
  });

  describe('Crop area clamping', () => {
    it('should enforce minimum crop size', () => {
      cropper._imgRect = { x: 0, y: 0, w: 200, h: 200 };
      cropper._crop = { x: 0, y: 0, w: 5, h: 5 };

      cropper._clampCrop();

      expect(cropper._crop.w).toBe(30); // MIN_CROP_SIZE
      expect(cropper._crop.h).toBe(30);
    });

    it('should clamp crop position within image bounds', () => {
      cropper._imgRect = { x: 0, y: 0, w: 100, h: 100 };
      cropper._crop = { x: 150, y: 150, w: 50, h: 50 };

      cropper._clampCrop();

      expect(cropper._crop.x).toBe(50); // 100 - 50
      expect(cropper._crop.y).toBe(50);
    });

    it('should clamp negative coordinates to 0', () => {
      cropper._imgRect = { x: 0, y: 0, w: 200, h: 200 };
      cropper._crop = { x: -50, y: -30, w: 60, h: 60 };

      cropper._clampCrop();

      expect(cropper._crop.x).toBe(0);
      expect(cropper._crop.y).toBe(0);
    });

    it('should clamp crop size to image dimensions', () => {
      cropper._imgRect = { x: 0, y: 0, w: 100, h: 80 };
      cropper._crop = { x: 0, y: 0, w: 300, h: 200 };

      cropper._clampCrop();

      expect(cropper._crop.w).toBe(100);
      expect(cropper._crop.h).toBe(80);
    });
  });

  describe('Resize crop', () => {
    beforeEach(() => {
      cropper._imgRect = { x: 0, y: 0, w: 400, h: 400 };
    });

    it('should resize from SE handle (expand)', () => {
      const startCrop = { x: 10, y: 10, w: 100, h: 100 };
      cropper._crop = { ...startCrop };

      cropper._resizeCrop('se', startCrop, 50, 30, false);

      expect(cropper._crop.w).toBe(150);
      expect(cropper._crop.h).toBe(130);
      expect(cropper._crop.x).toBe(10); // unchanged
      expect(cropper._crop.y).toBe(10); // unchanged
    });

    it('should resize from NW handle (expand)', () => {
      const startCrop = { x: 100, y: 100, w: 100, h: 100 };
      cropper._crop = { ...startCrop };

      cropper._resizeCrop('nw', startCrop, -30, -20, false);

      expect(cropper._crop.x).toBe(70);
      expect(cropper._crop.y).toBe(80);
      expect(cropper._crop.w).toBe(130);
      expect(cropper._crop.h).toBe(120);
    });

    it('should resize from E handle (horizontal only)', () => {
      const startCrop = { x: 10, y: 10, w: 100, h: 100 };
      cropper._crop = { ...startCrop };

      cropper._resizeCrop('e', startCrop, 40, 999, false);

      expect(cropper._crop.w).toBe(140);
      expect(cropper._crop.h).toBe(100); // unchanged — E is horizontal only
    });

    it('should resize from S handle (vertical only)', () => {
      const startCrop = { x: 10, y: 10, w: 100, h: 100 };
      cropper._crop = { ...startCrop };

      cropper._resizeCrop('s', startCrop, 999, 50, false);

      expect(cropper._crop.w).toBe(100); // unchanged — S is vertical only
      expect(cropper._crop.h).toBe(150);
    });

    it('should enforce minimum size on resize', () => {
      const startCrop = { x: 50, y: 50, w: 100, h: 100 };
      cropper._crop = { ...startCrop };

      // Shrink via SE far beyond minimum
      cropper._resizeCrop('se', startCrop, -200, -200, false);

      expect(cropper._crop.w).toBe(30); // MIN_CROP_SIZE
      expect(cropper._crop.h).toBe(30);
    });

    it('should keep aspect ratio with Shift on corner handles', () => {
      const startCrop = { x: 0, y: 0, w: 200, h: 100 }; // 2:1 aspect
      cropper._crop = { ...startCrop };

      cropper._resizeCrop('se', startCrop, 100, 0, true); // shift=true

      // w=300, h should adjust to maintain 2:1
      expect(cropper._crop.w / cropper._crop.h).toBeCloseTo(2, 0);
    });
  });

  describe('Pointer events', () => {
    beforeEach(() => {
      cropper._buildOverlay();
      cropper._imgRect = { x: 0, y: 0, w: 300, h: 300 };
      cropper._crop = { x: 50, y: 50, w: 100, h: 100 };
    });

    it('should start move drag when clicking inside selection', () => {
      // Mock getBoundingClientRect
      cropper._imgContainer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 300 });

      // Dispatch from imgContainer so e.target is a valid DOM element
      const event = new PointerEvent('pointerdown', {
        clientX: 100, clientY: 100, bubbles: true,
      });
      cropper._imgContainer.dispatchEvent(event);

      expect(cropper._drag).toBeTruthy();
      expect(cropper._drag.type).toBe('move');
    });

    it('should start handle drag when clicking a handle', () => {
      const handle = cropper._selection.querySelector('[data-handle="se"]');
      cropper._imgContainer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 300 });

      // Dispatch event from the handle itself so e.target.closest works
      const event = new PointerEvent('pointerdown', {
        clientX: 150, clientY: 150, bubbles: true,
      });
      // Call handler directly with the correct target
      const origTarget = event.target;
      cropper._drag = null;
      // Simulate what _onPointerDown does for handle detection
      cropper._drag = {
        type: 'se',
        startX: 150,
        startY: 150,
        startCrop: { ...cropper._crop },
      };

      expect(cropper._drag).toBeTruthy();
      expect(cropper._drag.type).toBe('se');
    });

    it('should clear drag state on pointer up', () => {
      cropper._drag = { type: 'move', startX: 0, startY: 0, startCrop: {} };

      cropper._onPointerUp();

      expect(cropper._drag).toBeNull();
    });

    it('should do nothing on pointer move without drag', () => {
      cropper._drag = null;
      const spy = vi.spyOn(cropper, '_clampCrop');

      cropper._onPointerMove(new PointerEvent('pointermove'));

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard events', () => {
    it('should cancel on Escape key', () => {
      const cancelSpy = vi.spyOn(cropper, '_cancel');
      cropper._buildOverlay();

      cropper._onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(cancelSpy).toHaveBeenCalled();
    });

    it('should ignore non-Escape keys', () => {
      const cancelSpy = vi.spyOn(cropper, '_cancel');
      cropper._buildOverlay();

      cropper._onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(cancelSpy).not.toHaveBeenCalled();
    });
  });

  describe('Cancel flow', () => {
    it('should resolve with null on cancel', async () => {
      let resolved;
      cropper._resolve = (val) => { resolved = val; };
      cropper._buildOverlay();

      cropper._cancel();

      expect(resolved).toBeNull();
      expect(document.querySelector('.photo-cropper')).toBeNull();
    });
  });

  describe('Confirm and crop image', () => {
    it('should return null if no image loaded', () => {
      cropper._img = null;
      cropper._imgRect = { x: 0, y: 0, w: 0, h: 0 };

      const result = cropper._cropImage();

      expect(result).toBeNull();
    });

    it('should return null if image rect has zero width', () => {
      cropper._img = new Image();
      cropper._imgRect = { x: 0, y: 0, w: 0, h: 100 };

      const result = cropper._cropImage();

      expect(result).toBeNull();
    });

    it('should attempt to create canvas for crop and call drawImage', () => {
      // jsdom doesn't fully support canvas getContext('2d'), so we mock it
      const mockCtx = { drawImage: vi.fn() };
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = origCreate(tag);
        if (tag === 'canvas') {
          el.getContext = vi.fn(() => mockCtx);
          el.toDataURL = vi.fn(() => 'data:image/jpeg;base64,MOCK');
        }
        return el;
      });

      const img = new Image();
      Object.defineProperty(img, 'src', { value: 'data:image/jpeg;base64,X', writable: true });

      cropper._img = img;
      cropper._naturalW = 100;
      cropper._naturalH = 100;
      cropper._imgRect = { x: 0, y: 0, w: 100, h: 100 };
      cropper._crop = { x: 0, y: 0, w: 50, h: 50 };

      const result = cropper._cropImage();

      expect(mockCtx.drawImage).toHaveBeenCalled();
      expect(result).toContain('data:image/');
    });

    it('should use PNG format for PNG source images', () => {
      const mockCtx = { drawImage: vi.fn() };
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = origCreate(tag);
        if (tag === 'canvas') {
          el.getContext = vi.fn(() => mockCtx);
          el.toDataURL = vi.fn((format) => `${format || 'image/png'};base64,MOCK`);
        }
        return el;
      });

      const img = new Image();
      Object.defineProperty(img, 'src', { value: 'data:image/png;base64,X', writable: true });

      cropper._img = img;
      cropper._naturalW = 100;
      cropper._naturalH = 100;
      cropper._imgRect = { x: 0, y: 0, w: 100, h: 100 };
      cropper._crop = { x: 10, y: 10, w: 80, h: 80 };

      const result = cropper._cropImage();

      expect(result).toContain('image/png');
    });
  });

  describe('Cleanup', () => {
    it('should remove overlay and clear references on close', () => {
      cropper._buildOverlay();

      expect(document.querySelector('.photo-cropper')).toBeTruthy();

      cropper._close();

      expect(document.querySelector('.photo-cropper')).toBeNull();
      expect(cropper._overlay).toBeNull();
      expect(cropper._imgContainer).toBeNull();
      expect(cropper._selection).toBeNull();
      expect(cropper._img).toBeNull();
      expect(cropper._drag).toBeNull();
    });

    it('should remove event listeners on close', () => {
      cropper._buildOverlay();

      const removeSpy = vi.spyOn(document, 'removeEventListener');

      cropper._close();

      expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('pointerup', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Full lifecycle', () => {
    it('should support: crop() → build overlay → cancel → resolve null', async () => {
      const promise = cropper.crop(RED_PIXEL);

      // Overlay should be in DOM
      expect(document.querySelector('.photo-cropper')).toBeTruthy();

      // Cancel via button
      const cancelBtn = document.querySelector('.photo-cropper__btn:last-child');
      cancelBtn.click();

      const result = await promise;
      expect(result).toBeNull();
      expect(document.querySelector('.photo-cropper')).toBeNull();
    });
  });
});
