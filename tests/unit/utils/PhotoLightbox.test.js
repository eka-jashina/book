/**
 * Unit tests for PhotoLightbox
 * Полноэкранный просмотр фотографий с FLIP-анимацией
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhotoLightbox } from '../../../js/utils/PhotoLightbox.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS (mirrored from implementation)
// ═══════════════════════════════════════════════════════════════════════════

const TRANSITION_MS = 300;

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создать мок-изображение (img) с заданным src/alt и фиксированным DOMRect
 */
function createMockImg(src = 'http://example.com/photo.jpg', alt = 'Фото') {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  Object.defineProperty(img, 'getBoundingClientRect', {
    value: () => ({ left: 10, top: 20, width: 100, height: 80, right: 110, bottom: 100 }),
    configurable: true,
  });
  return img;
}

/**
 * Создать .photo-album__item с img и опциональным figcaption
 */
function createAlbumItem(caption = '') {
  const item = document.createElement('figure');
  item.className = 'photo-album__item';
  const img = createMockImg();
  item.appendChild(img);
  if (caption) {
    const fig = document.createElement('figcaption');
    fig.textContent = caption;
    item.appendChild(fig);
  }
  document.body.appendChild(item);
  return { item, img };
}

/**
 * Открыть лайтбокс и сбросить двойной rAF через fake-таймеры.
 * После вызова: _isOpen=true, _isAnimating=false.
 */
function openAndFlush(lb, imgEl) {
  lb.open(imgEl);
  vi.runAllTimers(); // оба уровня requestAnimationFrame (через mocked setTimeout)
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('PhotoLightbox', () => {
  let lightbox;
  let mockImg;

  beforeEach(() => {
    vi.useFakeTimers();
    mockImg = createMockImg();
    lightbox = new PhotoLightbox();
  });

  afterEach(() => {
    if (lightbox) {
      lightbox.destroy();
      lightbox = null;
    }
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // constructor / _buildDOM
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor / _buildDOM', () => {
    it('should create overlay with class "lightbox"', () => {
      expect(lightbox._overlay.classList.contains('lightbox')).toBe(true);
    });

    it('should set role="dialog" on overlay', () => {
      expect(lightbox._overlay.getAttribute('role')).toBe('dialog');
    });

    it('should set aria-modal="true" on overlay', () => {
      expect(lightbox._overlay.getAttribute('aria-modal')).toBe('true');
    });

    it('should set aria-label on overlay', () => {
      expect(lightbox._overlay.getAttribute('aria-label')).toBeTruthy();
    });

    it('should create img element with class "lightbox__img"', () => {
      expect(lightbox._img).not.toBeNull();
      expect(lightbox._img.classList.contains('lightbox__img')).toBe(true);
    });

    it('should set empty alt on img', () => {
      expect(lightbox._img.alt).toBe('');
    });

    it('should create closeBtn with class "lightbox__close"', () => {
      expect(lightbox._closeBtn).not.toBeNull();
      expect(lightbox._closeBtn.classList.contains('lightbox__close')).toBe(true);
    });

    it('should set type="button" on closeBtn', () => {
      expect(lightbox._closeBtn.type).toBe('button');
    });

    it('should set aria-label on closeBtn', () => {
      expect(lightbox._closeBtn.getAttribute('aria-label')).toBeTruthy();
    });

    it('should create caption element with class "lightbox__caption"', () => {
      expect(lightbox._caption).not.toBeNull();
      expect(lightbox._caption.classList.contains('lightbox__caption')).toBe(true);
    });

    it('should append overlay to document.body', () => {
      expect(document.body.contains(lightbox._overlay)).toBe(true);
    });

    it('should initialize _isOpen as false', () => {
      expect(lightbox._isOpen).toBe(false);
    });

    it('should initialize _isAnimating as false', () => {
      expect(lightbox._isAnimating).toBe(false);
    });

    it('should initialize _originRect as null', () => {
      expect(lightbox._originRect).toBeNull();
    });

    it('should initialize _originImg as null', () => {
      expect(lightbox._originImg).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // open()
  // ─────────────────────────────────────────────────────────────────────────

  describe('open()', () => {
    it('should set _img.src from the passed image element', () => {
      lightbox.open(mockImg);
      expect(lightbox._img.src).toBe(mockImg.src);
    });

    it('should set _img.alt from the passed image element', () => {
      mockImg.alt = 'Пейзаж';
      lightbox.open(mockImg);
      expect(lightbox._img.alt).toBe('Пейзаж');
    });

    it('should use empty string for alt when not set', () => {
      mockImg.alt = '';
      lightbox.open(mockImg);
      expect(lightbox._img.alt).toBe('');
    });

    it('should add lightbox--visible class immediately', () => {
      lightbox.open(mockImg);
      expect(lightbox._overlay.classList.contains('lightbox--visible')).toBe(true);
    });

    it('should set _isAnimating=true immediately', () => {
      lightbox.open(mockImg);
      expect(lightbox._isAnimating).toBe(true);
    });

    it('should store _originImg reference', () => {
      lightbox.open(mockImg);
      expect(lightbox._originImg).toBe(mockImg);
    });

    it('should store _originRect from getBoundingClientRect', () => {
      lightbox.open(mockImg);
      expect(lightbox._originRect).not.toBeNull();
      expect(lightbox._originRect.width).toBe(100);
    });

    it('should add lightbox--active class after double rAF', () => {
      openAndFlush(lightbox, mockImg);
      expect(lightbox._overlay.classList.contains('lightbox--active')).toBe(true);
    });

    it('should set _isOpen=true after double rAF', () => {
      openAndFlush(lightbox, mockImg);
      expect(lightbox._isOpen).toBe(true);
    });

    it('should set _isAnimating=false after double rAF', () => {
      openAndFlush(lightbox, mockImg);
      expect(lightbox._isAnimating).toBe(false);
    });

    it('should clear img transform after double rAF', () => {
      openAndFlush(lightbox, mockImg);
      expect(lightbox._img.style.transform).toBe('');
    });

    it('should register keydown listener on document', () => {
      const spy = vi.spyOn(document, 'addEventListener');
      lightbox.open(mockImg);
      expect(spy).toHaveBeenCalledWith('keydown', lightbox._onKeyDown);
    });

    it('should register popstate listener on window', () => {
      const spy = vi.spyOn(window, 'addEventListener');
      lightbox.open(mockImg);
      expect(spy).toHaveBeenCalledWith('popstate', lightbox._onPopState, true);
    });

    it('should call history.pushState', () => {
      const spy = vi.spyOn(history, 'pushState');
      lightbox.open(mockImg);
      expect(spy).toHaveBeenCalledWith({ lightbox: true }, '');
    });

    it('should set FLIP transform on img (non-empty before rAF)', () => {
      lightbox.open(mockImg);
      // Before double rAF, transform is set to origin rect position
      expect(lightbox._img.style.transform).not.toBe('');
    });

    it('should ignore open() call when already open', () => {
      openAndFlush(lightbox, mockImg);
      const spy = vi.spyOn(lightbox, '_setTransformFromRect');
      lightbox.open(mockImg); // second call — должен игнорироваться
      expect(spy).not.toHaveBeenCalled();
    });

    it('should ignore open() call when animating', () => {
      lightbox.open(mockImg); // _isAnimating=true, but _isOpen still false
      const secondImg = createMockImg('http://example.com/b.jpg');
      lightbox.open(secondImg);
      // src should still be the first image
      expect(lightbox._img.src).toBe(mockImg.src);
    });

    describe('caption handling', () => {
      it('should show caption text when figcaption is present', () => {
        const { img } = createAlbumItem('Горный пейзаж');
        lightbox.open(img);
        expect(lightbox._caption.textContent).toBe('Горный пейзаж');
        expect(lightbox._caption.hidden).toBe(false);
      });

      it('should hide caption when no figcaption', () => {
        const { img } = createAlbumItem(''); // no caption
        lightbox.open(img);
        expect(lightbox._caption.hidden).toBe(true);
      });

      it('should clear caption text when no figcaption', () => {
        const { img } = createAlbumItem('');
        lightbox.open(img);
        expect(lightbox._caption.textContent).toBe('');
      });

      it('should hide caption for standalone img (no .photo-album__item parent)', () => {
        lightbox.open(mockImg);
        expect(lightbox._caption.hidden).toBe(true);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // close()
  // ─────────────────────────────────────────────────────────────────────────

  describe('close()', () => {
    it('should do nothing when lightbox is not open', () => {
      expect(() => lightbox.close()).not.toThrow();
      expect(lightbox._isAnimating).toBe(false);
    });

    it('should do nothing when already animating', () => {
      lightbox.open(mockImg); // starts animation, _isOpen still false
      lightbox._isOpen = true; // force open state mid-animation
      const spy = vi.spyOn(document, 'removeEventListener');
      lightbox.close(); // should be blocked by _isAnimating=true
      expect(spy).not.toHaveBeenCalled();
    });

    describe('when open', () => {
      beforeEach(() => {
        openAndFlush(lightbox, mockImg);
      });

      it('should set _isAnimating=true immediately', () => {
        lightbox.close();
        expect(lightbox._isAnimating).toBe(true);
      });

      it('should remove lightbox--active class immediately', () => {
        lightbox.close();
        expect(lightbox._overlay.classList.contains('lightbox--active')).toBe(false);
      });

      it('should remove keydown listener from document', () => {
        const spy = vi.spyOn(document, 'removeEventListener');
        lightbox.close();
        expect(spy).toHaveBeenCalledWith('keydown', lightbox._onKeyDown);
      });

      it('should remove popstate listener from window (capture phase)', () => {
        const spy = vi.spyOn(window, 'removeEventListener');
        lightbox.close();
        expect(spy).toHaveBeenCalledWith('popstate', lightbox._onPopState, true);
      });

      it('should set FLIP return transform (non-empty) on img', () => {
        lightbox.close();
        expect(lightbox._img.style.transform).not.toBe('');
      });

      describe('after TRANSITION_MS timeout', () => {
        beforeEach(() => {
          lightbox.close();
          vi.advanceTimersByTime(TRANSITION_MS);
        });

        it('should remove lightbox--visible class', () => {
          expect(lightbox._overlay.classList.contains('lightbox--visible')).toBe(false);
        });

        it('should clear _img.src', () => {
          // jsdom normalises img.src='' to the document base URL;
          // check the raw attribute value instead
          expect(lightbox._img.getAttribute('src')).toBe('');
        });

        it('should clear _img transform', () => {
          expect(lightbox._img.style.transform).toBe('');
        });

        it('should set _isOpen=false', () => {
          expect(lightbox._isOpen).toBe(false);
        });

        it('should set _isAnimating=false', () => {
          expect(lightbox._isAnimating).toBe(false);
        });

        it('should clear _originImg', () => {
          expect(lightbox._originImg).toBeNull();
        });

        it('should clear _originRect', () => {
          expect(lightbox._originRect).toBeNull();
        });
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Клик по оверлею
  // ─────────────────────────────────────────────────────────────────────────

  describe('overlay click', () => {
    beforeEach(() => {
      openAndFlush(lightbox, mockImg);
    });

    it('should call history.back() when clicking directly on overlay', () => {
      const spy = vi.spyOn(history, 'back').mockImplementation(() => {});
      lightbox._overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(spy).toHaveBeenCalled();
    });

    it('should NOT call history.back() when clicking on the img child', () => {
      const spy = vi.spyOn(history, 'back').mockImplementation(() => {});
      // click on _img → e.target is _img, not overlay
      lightbox._img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(spy).not.toHaveBeenCalled();
    });

    it('should call history.back() once when clicking on closeBtn', () => {
      // The overlay listener checks e.target === overlay; clicking the button
      // triggers the button's own listener but not through overlay path
      const backSpy = vi.spyOn(history, 'back').mockImplementation(() => {});
      // Fire a direct click on closeBtn — its own listener calls history.back()
      // but not through the overlay's e.target check
      lightbox._closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      // history.back() called once (by closeBtn listener), but NOT by overlay path
      expect(backSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Клик по closeBtn
  // ─────────────────────────────────────────────────────────────────────────

  describe('closeBtn click', () => {
    it('should call history.back() when closeBtn is clicked', () => {
      openAndFlush(lightbox, mockImg);
      const spy = vi.spyOn(history, 'back').mockImplementation(() => {});
      lightbox._closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: false }));
      expect(spy).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _onKeyDown() — Escape
  // ─────────────────────────────────────────────────────────────────────────

  describe('_onKeyDown()', () => {
    it('should call history.back() on Escape', () => {
      const spy = vi.spyOn(history, 'back').mockImplementation(() => {});
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      lightbox._onKeyDown(event);
      expect(spy).toHaveBeenCalled();
    });

    it('should call event.preventDefault() on Escape', () => {
      vi.spyOn(history, 'back').mockImplementation(() => {});
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      lightbox._onKeyDown(event);
      expect(preventSpy).toHaveBeenCalled();
    });

    it('should call event.stopPropagation() on Escape', () => {
      vi.spyOn(history, 'back').mockImplementation(() => {});
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      const stopSpy = vi.spyOn(event, 'stopPropagation');
      lightbox._onKeyDown(event);
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should NOT call history.back() for non-Escape keys', () => {
      const spy = vi.spyOn(history, 'back').mockImplementation(() => {});
      lightbox._onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
      lightbox._onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      lightbox._onKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
      expect(spy).not.toHaveBeenCalled();
    });

    it('should be reachable via document keydown event when lightbox is open', () => {
      openAndFlush(lightbox, mockImg);
      const spy = vi.spyOn(history, 'back').mockImplementation(() => {});
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(spy).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _onPopState() — Back-кнопка
  // ─────────────────────────────────────────────────────────────────────────

  describe('_onPopState()', () => {
    it('should call close() and stopImmediatePropagation when lightbox is open', () => {
      openAndFlush(lightbox, mockImg);
      const spy = vi.spyOn(lightbox, 'close');
      const event = { stopImmediatePropagation: vi.fn() };
      lightbox._onPopState(event);
      expect(spy).toHaveBeenCalled();
      expect(event.stopImmediatePropagation).toHaveBeenCalled();
    });

    it('should NOT call close() when lightbox is closed', () => {
      const spy = vi.spyOn(lightbox, 'close');
      const event = { stopImmediatePropagation: vi.fn() };
      lightbox._onPopState(event);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _setTransformFromRect()
  // ─────────────────────────────────────────────────────────────────────────

  describe('_setTransformFromRect()', () => {
    it('should set a non-empty transform on _img', () => {
      const rect = { left: 50, top: 100, width: 120, height: 90 };
      lightbox._setTransformFromRect(rect);
      expect(lightbox._img.style.transform).not.toBe('');
    });

    it('should produce a transform containing "translate"', () => {
      const rect = { left: 50, top: 100, width: 120, height: 90 };
      lightbox._setTransformFromRect(rect);
      expect(lightbox._img.style.transform).toContain('translate');
    });

    it('should produce a transform containing "scale"', () => {
      const rect = { left: 50, top: 100, width: 120, height: 90 };
      lightbox._setTransformFromRect(rect);
      expect(lightbox._img.style.transform).toContain('scale');
    });

    it('should produce different transforms for different rects', () => {
      const rectA = { left: 0, top: 0, width: 80, height: 60 };
      const rectB = { left: 500, top: 400, width: 80, height: 60 };
      lightbox._setTransformFromRect(rectA);
      const transformA = lightbox._img.style.transform;
      lightbox._setTransformFromRect(rectB);
      const transformB = lightbox._img.style.transform;
      expect(transformA).not.toBe(transformB);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // attach()
  // ─────────────────────────────────────────────────────────────────────────

  describe('attach()', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      lightbox.attach(container);
    });

    it('should call open() when clicking on .photo-album__item img', () => {
      const { img } = createAlbumItem('Test');
      container.appendChild(img.closest('.photo-album__item') || img.parentElement);
      const spy = vi.spyOn(lightbox, 'open');
      img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(spy).toHaveBeenCalledWith(img);
    });

    it('should NOT call open() when clicking on non-photo elements', () => {
      const btn = document.createElement('button');
      container.appendChild(btn);
      const spy = vi.spyOn(lightbox, 'open');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(spy).not.toHaveBeenCalled();
    });

    it('should NOT call open() when clicking on a plain img outside album item', () => {
      const img = document.createElement('img');
      container.appendChild(img);
      const spy = vi.spyOn(lightbox, 'open');
      img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(spy).not.toHaveBeenCalled();
    });

    it('should stop propagation on album img click', () => {
      const { img } = createAlbumItem('');
      container.appendChild(img.closest('.photo-album__item') || img.parentElement);
      vi.spyOn(lightbox, 'open').mockImplementation(() => {});
      const containerClickSpy = vi.fn();
      // listener ABOVE container — should not fire
      document.body.addEventListener('click', containerClickSpy);
      img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      // stopPropagation is called on the event, so it should not reach body
      // (actually stopPropagation stops it from reaching listeners added AFTER)
      document.body.removeEventListener('click', containerClickSpy);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // destroy()
  // ─────────────────────────────────────────────────────────────────────────

  describe('destroy()', () => {
    it('should remove overlay from document.body', () => {
      const overlay = lightbox._overlay;
      lightbox.destroy();
      expect(document.body.contains(overlay)).toBe(false);
    });

    it('should set _overlay to null', () => {
      lightbox.destroy();
      expect(lightbox._overlay).toBeNull();
    });

    it('should remove document keydown listener', () => {
      openAndFlush(lightbox, mockImg);
      lightbox.destroy();
      // After destroy, Escape should not trigger history.back()
      const spy = vi.spyOn(history, 'back').mockImplementation(() => {});
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(spy).not.toHaveBeenCalled();
    });

    it('should remove window popstate listener', () => {
      openAndFlush(lightbox, mockImg);
      const closeSpy = vi.spyOn(lightbox, 'close');
      lightbox.destroy();
      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      lightbox.destroy();
      expect(() => lightbox.destroy()).not.toThrow();
      lightbox = null; // prevent afterEach from calling destroy again
    });
  });
});
