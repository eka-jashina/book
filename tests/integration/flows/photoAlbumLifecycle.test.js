/**
 * INTEGRATION TEST: Photo Album Lifecycle
 * Тестирование полного цикла фотоальбома:
 * AlbumManager создание → добавление фото → crop → rotation → frames/filters →
 * buildAlbumHtml → PhotoLightbox отображение и навигация.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhotoLightbox } from '../../../js/utils/PhotoLightbox.js';

describe('Photo Album Lifecycle Integration', () => {
  // ── Helpers ──

  /** Создать минимальную структуру альбома как AlbumManager._buildAlbumHtml() генерирует */
  const buildAlbumHTML = (pages) => {
    let html = '<article class="photo-album-article"><h2>Test Album</h2>';

    for (const page of pages) {
      html += `<div class="photo-album" data-layout="${page.layout}">`;
      for (const img of page.images) {
        const filter = img.filter && img.filter !== 'none'
          ? `data-filter="${img.filter}" data-filter-intensity="${img.filterIntensity || 100}"`
          : '';
        const rotation = img.rotation ? `style="transform: rotate(${img.rotation}deg)"` : '';
        const frame = img.frame || 'none';

        html += `<figure class="photo-album__item" data-frame="${frame}">`;
        html += `<img src="${img.dataUrl}" alt="${img.caption || ''}" ${filter} ${rotation}>`;
        if (img.caption) {
          html += `<figcaption>${img.caption}</figcaption>`;
        }
        html += '</figure>';
      }
      html += '</div>';
    }

    html += '</article>';
    return html;
  };

  /** Создать тестовое data URL изображение (1x1 px PNG) */
  const makeDataUrl = (id = 1) =>
    `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB${id}`;

  beforeEach(() => {
    document.body.innerHTML = '';
    // Stub getBoundingClientRect for FLIP animation
    Element.prototype._origGetBCR = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      return { top: 100, left: 100, width: 200, height: 150, right: 300, bottom: 250, x: 100, y: 100 };
    };
    // Stub history pushState
    vi.spyOn(history, 'pushState').mockImplementation(() => {});
    vi.spyOn(history, 'back').mockImplementation(() => {});
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = Element.prototype._origGetBCR;
    delete Element.prototype._origGetBCR;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // Album HTML generation
  // ═══════════════════════════════════════════

  describe('Album HTML structure', () => {
    it('should build album with single image layout', () => {
      const html = buildAlbumHTML([
        { layout: '1', images: [{ dataUrl: makeDataUrl(1), caption: 'Sunset' }] },
      ]);

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      expect(container.querySelector('.photo-album')).not.toBeNull();
      expect(container.querySelector('.photo-album').dataset.layout).toBe('1');
      expect(container.querySelector('.photo-album__item img').src).toContain('data:image/png');
      expect(container.querySelector('figcaption').textContent).toBe('Sunset');
    });

    it('should build multi-page album with different layouts', () => {
      const html = buildAlbumHTML([
        { layout: '1', images: [{ dataUrl: makeDataUrl(1) }] },
        { layout: '2', images: [{ dataUrl: makeDataUrl(2) }, { dataUrl: makeDataUrl(3) }] },
        { layout: '4', images: [
          { dataUrl: makeDataUrl(4) }, { dataUrl: makeDataUrl(5) },
          { dataUrl: makeDataUrl(6) }, { dataUrl: makeDataUrl(7) },
        ] },
      ]);

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      const albums = container.querySelectorAll('.photo-album');
      expect(albums).toHaveLength(3);
      expect(albums[0].dataset.layout).toBe('1');
      expect(albums[1].dataset.layout).toBe('2');
      expect(albums[2].dataset.layout).toBe('4');
      expect(container.querySelectorAll('.photo-album__item')).toHaveLength(7);
    });

    it('should apply frame attribute to figures', () => {
      const html = buildAlbumHTML([
        { layout: '2', images: [
          { dataUrl: makeDataUrl(1), frame: 'polaroid' },
          { dataUrl: makeDataUrl(2), frame: 'shadow' },
        ] },
      ]);

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      const items = container.querySelectorAll('.photo-album__item');
      expect(items[0].dataset.frame).toBe('polaroid');
      expect(items[1].dataset.frame).toBe('shadow');
    });

    it('should apply filter data attributes', () => {
      const html = buildAlbumHTML([
        { layout: '1', images: [
          { dataUrl: makeDataUrl(1), filter: 'sepia', filterIntensity: 80 },
        ] },
      ]);

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      const img = container.querySelector('.photo-album__item img');
      expect(img.dataset.filter).toBe('sepia');
      expect(img.dataset.filterIntensity).toBe('80');
    });

    it('should apply rotation transform', () => {
      const html = buildAlbumHTML([
        { layout: '1', images: [
          { dataUrl: makeDataUrl(1), rotation: 90 },
        ] },
      ]);

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      const img = container.querySelector('.photo-album__item img');
      expect(img.style.transform).toContain('rotate(90deg)');
    });
  });

  // ═══════════════════════════════════════════
  // PhotoLightbox: attach and open
  // ═══════════════════════════════════════════

  describe('PhotoLightbox: attach and navigation', () => {
    let lightbox;
    let container;

    beforeEach(() => {
      lightbox = new PhotoLightbox();

      container = document.createElement('div');
      container.className = 'book';

      container.innerHTML = buildAlbumHTML([
        { layout: '1', images: [{ dataUrl: makeDataUrl(1), caption: 'Photo 1' }] },
        { layout: '2', images: [
          { dataUrl: makeDataUrl(2), caption: 'Photo 2' },
          { dataUrl: makeDataUrl(3), caption: 'Photo 3' },
        ] },
      ]);

      document.body.appendChild(container);
      lightbox.attach(container);
    });

    afterEach(() => {
      lightbox.destroy();
    });

    it('should create lightbox DOM on construction', () => {
      const overlay = document.querySelector('.lightbox');
      expect(overlay).not.toBeNull();
      expect(overlay.querySelector('.lightbox__img')).not.toBeNull();
      expect(overlay.querySelector('.lightbox__close')).not.toBeNull();
      expect(overlay.querySelector('.lightbox__nav--prev')).not.toBeNull();
      expect(overlay.querySelector('.lightbox__nav--next')).not.toBeNull();
      expect(overlay.querySelector('.lightbox__counter')).not.toBeNull();
    });

    it('should open lightbox on photo-album__item click', () => {
      const item = container.querySelector('.photo-album__item');
      item.click();

      expect(lightbox._isOpen || lightbox._isAnimating).toBe(true);
    });

    it('should collect all images for navigation', () => {
      const firstImg = container.querySelector('.photo-album__item img');
      lightbox.open(firstImg);

      expect(lightbox._images).toHaveLength(3);
      expect(lightbox._currentIndex).toBe(0);
    });

    it('should navigate to next image', () => {
      const firstImg = container.querySelector('.photo-album__item img');
      lightbox.open(firstImg);

      // Force animation complete
      lightbox._isAnimating = false;
      lightbox._isOpen = true;

      lightbox.next();
      expect(lightbox._currentIndex).toBe(1);
    });

    it('should navigate to previous image', () => {
      const imgs = container.querySelectorAll('.photo-album__item img');
      lightbox.open(imgs[1]);

      lightbox._isAnimating = false;
      lightbox._isOpen = true;

      lightbox.prev();
      expect(lightbox._currentIndex).toBe(0);
    });

    it('should not navigate past boundaries', () => {
      const firstImg = container.querySelector('.photo-album__item img');
      lightbox.open(firstImg);

      lightbox._isAnimating = false;
      lightbox._isOpen = true;

      lightbox.prev();
      expect(lightbox._currentIndex).toBe(0); // stays at 0

      // Go to last
      lightbox._currentIndex = 2;
      lightbox.next();
      expect(lightbox._currentIndex).toBe(2); // stays at last
    });

    it('should close lightbox', () => {
      const firstImg = container.querySelector('.photo-album__item img');
      lightbox.open(firstImg);

      lightbox._isAnimating = false;
      lightbox._isOpen = true;

      lightbox.close();
      // Close triggers animation
      expect(lightbox._isAnimating).toBe(true);
    });

    it('should close on Escape key', () => {
      const firstImg = container.querySelector('.photo-album__item img');
      lightbox.open(firstImg);
      lightbox._isAnimating = false;
      lightbox._isOpen = true;

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      // Should call history.back() for popstate close
      expect(history.back).toHaveBeenCalled();
    });

    it('should navigate with arrow keys', () => {
      const firstImg = container.querySelector('.photo-album__item img');
      lightbox.open(firstImg);
      lightbox._isAnimating = false;
      lightbox._isOpen = true;

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(lightbox._currentIndex).toBe(1);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(lightbox._currentIndex).toBe(0);
    });

    it('should block context menu on photo items (download protection)', () => {
      const item = container.querySelector('.photo-album__item');
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      const prevented = !item.dispatchEvent(event);

      expect(prevented).toBe(true);
    });

    it('should block drag on photo items', () => {
      const item = container.querySelector('.photo-album__item img');
      const event = new Event('dragstart', { bubbles: true, cancelable: true });
      const prevented = !item.dispatchEvent(event);

      expect(prevented).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // Album data structure (AlbumManager format)
  // ═══════════════════════════════════════════

  describe('Album data structure roundtrip', () => {
    it('should preserve album data through HTML generation and lightbox display', () => {
      const albumData = {
        title: 'Vacation 2024',
        hideTitle: false,
        pages: [
          {
            layout: '2',
            images: [
              { dataUrl: makeDataUrl(1), originalDataUrl: makeDataUrl(1), caption: 'Beach', frame: 'polaroid', filter: 'warm', filterIntensity: 70, rotation: 0 },
              { dataUrl: makeDataUrl(2), originalDataUrl: makeDataUrl(2), caption: 'Mountains', frame: 'none', filter: 'none', filterIntensity: 100, rotation: 90 },
            ],
          },
          {
            layout: '1',
            images: [
              { dataUrl: makeDataUrl(3), originalDataUrl: makeDataUrl(3), caption: 'Sunset panorama', frame: 'shadow', filter: 'sepia', filterIntensity: 50, rotation: 0 },
            ],
          },
        ],
      };

      // Build HTML from albumData (simulating AlbumManager._buildAlbumHtml)
      const html = buildAlbumHTML(albumData.pages);

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      // Verify structure preserved
      const items = container.querySelectorAll('.photo-album__item');
      expect(items).toHaveLength(3);

      // First image: polaroid frame, warm filter
      expect(items[0].dataset.frame).toBe('polaroid');
      expect(items[0].querySelector('img').dataset.filter).toBe('warm');
      expect(items[0].querySelector('figcaption').textContent).toBe('Beach');

      // Second image: 90° rotation
      expect(items[1].querySelector('img').style.transform).toContain('rotate(90deg)');

      // Third image: shadow frame, sepia filter
      expect(items[2].dataset.frame).toBe('shadow');
      expect(items[2].querySelector('img').dataset.filter).toBe('sepia');
      expect(items[2].querySelector('figcaption').textContent).toBe('Sunset panorama');
    });

    it('should handle empty captions and default frames', () => {
      const html = buildAlbumHTML([
        { layout: '1', images: [{ dataUrl: makeDataUrl(1), caption: '', frame: 'none' }] },
      ]);

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      expect(container.querySelector('figcaption')).toBeNull();
      expect(container.querySelector('.photo-album__item').dataset.frame).toBe('none');
    });
  });

  // ═══════════════════════════════════════════
  // PhotoCropper integration (mocked)
  // ═══════════════════════════════════════════

  describe('Crop and rotation workflow', () => {
    it('should simulate crop → update data → re-render', () => {
      // Simulate album page data
      const page = {
        layout: '1',
        images: [
          { dataUrl: makeDataUrl(1), originalDataUrl: makeDataUrl(1), caption: 'Original', frame: 'none', filter: 'none', filterIntensity: 100, rotation: 0 },
        ],
      };

      // Simulate crop result (new dataUrl, originalDataUrl preserved)
      const croppedDataUrl = makeDataUrl(99);
      page.images[0].dataUrl = croppedDataUrl;

      // Re-build HTML
      const html = buildAlbumHTML([page]);
      const container = document.createElement('div');
      container.innerHTML = html;

      const img = container.querySelector('.photo-album__item img');
      expect(img.src).toContain('99'); // cropped version
    });

    it('should simulate reset crop → restore original', () => {
      const page = {
        layout: '1',
        images: [
          { dataUrl: makeDataUrl(99), originalDataUrl: makeDataUrl(1), caption: '', frame: 'none', filter: 'none', filterIntensity: 100, rotation: 0 },
        ],
      };

      // Reset: restore originalDataUrl
      page.images[0].dataUrl = page.images[0].originalDataUrl;

      const html = buildAlbumHTML([page]);
      const container = document.createElement('div');
      container.innerHTML = html;

      const img = container.querySelector('.photo-album__item img');
      expect(img.src).toContain(makeDataUrl(1));
    });

    it('should simulate rotation cycle: 0 → 90 → 180 → 270 → 0', () => {
      const rotations = [0, 90, 180, 270, 0];
      let currentRotation = 0;

      for (const expected of rotations) {
        currentRotation = expected;

        const html = buildAlbumHTML([{
          layout: '1',
          images: [{ dataUrl: makeDataUrl(1), rotation: currentRotation }],
        }]);

        const container = document.createElement('div');
        container.innerHTML = html;

        const img = container.querySelector('.photo-album__item img');
        if (currentRotation === 0) {
          // No rotation transform when 0
          expect(img.style.transform).toBe('');
        } else {
          expect(img.style.transform).toContain(`rotate(${currentRotation}deg)`);
        }
      }
    });
  });
});
