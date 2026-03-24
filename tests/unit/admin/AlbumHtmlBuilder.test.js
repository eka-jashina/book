import { describe, it, expect } from 'vitest';
import { buildAlbumHtml, buildItemModifiers, buildImgInlineStyle, buildImgDataAttrs } from '../../../js/admin/modules/AlbumHtmlBuilder.js';

const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// buildItemModifiers
// ---------------------------------------------------------------------------
describe('buildItemModifiers', () => {
  it('returns empty string when no frame and no filter', () => {
    expect(buildItemModifiers({})).toBe('');
  });

  it('returns empty string when frame is "none" and filter is "none"', () => {
    expect(buildItemModifiers({ frame: 'none', filter: 'none' })).toBe('');
  });

  it('adds frame class for "thin"', () => {
    expect(buildItemModifiers({ frame: 'thin' })).toBe(' photo-album__item--frame-thin');
  });

  it('adds frame class for "shadow"', () => {
    expect(buildItemModifiers({ frame: 'shadow' })).toBe(' photo-album__item--frame-shadow');
  });

  it('adds filter class for "sepia"', () => {
    expect(buildItemModifiers({ filter: 'sepia' })).toBe(' photo-album__item--filter-sepia');
  });

  it('adds filter class for "grayscale"', () => {
    expect(buildItemModifiers({ filter: 'grayscale' })).toBe(' photo-album__item--filter-grayscale');
  });

  it('adds both frame and filter classes', () => {
    const result = buildItemModifiers({ frame: 'thin', filter: 'sepia' });
    expect(result).toBe(' photo-album__item--frame-thin photo-album__item--filter-sepia');
  });

  it('ignores frame "none" but includes filter', () => {
    const result = buildItemModifiers({ frame: 'none', filter: 'grayscale' });
    expect(result).toBe(' photo-album__item--filter-grayscale');
  });

  it('includes frame but ignores filter "none"', () => {
    const result = buildItemModifiers({ frame: 'shadow', filter: 'none' });
    expect(result).toBe(' photo-album__item--frame-shadow');
  });
});

// ---------------------------------------------------------------------------
// buildImgInlineStyle
// ---------------------------------------------------------------------------
describe('buildImgInlineStyle', () => {
  it('returns empty string when no rotation and no filter', () => {
    expect(buildImgInlineStyle({})).toBe('');
  });

  it('returns empty string for rotation 0 and filter "none"', () => {
    expect(buildImgInlineStyle({ rotation: 0, filter: 'none' })).toBe('');
  });

  it('returns transform for rotation 90', () => {
    expect(buildImgInlineStyle({ rotation: 90 })).toBe('transform:rotate(90deg)');
  });

  it('returns transform for rotation 180', () => {
    expect(buildImgInlineStyle({ rotation: 180 })).toBe('transform:rotate(180deg)');
  });

  it('returns transform for rotation 270', () => {
    expect(buildImgInlineStyle({ rotation: 270 })).toBe('transform:rotate(270deg)');
  });

  it('returns filter style for sepia filter', () => {
    const result = buildImgInlineStyle({ filter: 'sepia', filterIntensity: 100 });
    expect(result).toBe('filter:sepia(0.75)');
  });

  it('returns filter style for grayscale filter', () => {
    const result = buildImgInlineStyle({ filter: 'grayscale', filterIntensity: 100 });
    expect(result).toBe('filter:grayscale(1)');
  });

  it('combines rotation and filter', () => {
    const result = buildImgInlineStyle({ rotation: 90, filter: 'grayscale', filterIntensity: 100 });
    expect(result).toBe('transform:rotate(90deg);filter:grayscale(1)');
  });

  it('returns empty string for rotation 0 (falsy)', () => {
    expect(buildImgInlineStyle({ rotation: 0 })).toBe('');
  });

  it('handles filter with partial intensity', () => {
    const result = buildImgInlineStyle({ filter: 'grayscale', filterIntensity: 50 });
    expect(result).toBe('filter:grayscale(0.5)');
  });

  it('returns empty string when filter is "none"', () => {
    expect(buildImgInlineStyle({ filter: 'none', filterIntensity: 100 })).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildImgDataAttrs
// ---------------------------------------------------------------------------
describe('buildImgDataAttrs', () => {
  it('returns empty string when no filter and no rotation', () => {
    expect(buildImgDataAttrs({})).toBe('');
  });

  it('returns empty string when filter is "none" and no rotation', () => {
    expect(buildImgDataAttrs({ filter: 'none' })).toBe('');
  });

  it('returns filter and intensity data attrs', () => {
    const result = buildImgDataAttrs({ filter: 'sepia', filterIntensity: 80 });
    expect(result).toBe(' data-filter="sepia" data-filter-intensity="80"');
  });

  it('uses default intensity (100) when filterIntensity is undefined', () => {
    const result = buildImgDataAttrs({ filter: 'grayscale' });
    expect(result).toBe(' data-filter="grayscale" data-filter-intensity="100"');
  });

  it('returns rotation data attr', () => {
    const result = buildImgDataAttrs({ rotation: 90 });
    expect(result).toBe(' data-rotation="90"');
  });

  it('returns both filter and rotation data attrs', () => {
    const result = buildImgDataAttrs({ filter: 'sepia', filterIntensity: 50, rotation: 180 });
    expect(result).toBe(' data-filter="sepia" data-filter-intensity="50" data-rotation="180"');
  });

  it('omits rotation when rotation is 0 (falsy)', () => {
    expect(buildImgDataAttrs({ rotation: 0 })).toBe('');
  });

  it('omits filter attrs when filter is "none" but includes rotation', () => {
    const result = buildImgDataAttrs({ filter: 'none', rotation: 270 });
    expect(result).toBe(' data-rotation="270"');
  });

  it('uses explicit filterIntensity of 0', () => {
    const result = buildImgDataAttrs({ filter: 'contrast', filterIntensity: 0 });
    expect(result).toBe(' data-filter="contrast" data-filter-intensity="0"');
  });
});

// ---------------------------------------------------------------------------
// buildAlbumHtml
// ---------------------------------------------------------------------------
describe('buildAlbumHtml', () => {
  it('renders a single page with one image', () => {
    const albumData = {
      title: 'My Album',
      hideTitle: false,
      pages: [
        {
          layout: '1',
          images: [{ dataUrl: 'data:image/png;base64,abc', caption: 'Photo 1' }],
        },
      ],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toContain('<article class="photo-album-chapter">');
    expect(html).toContain('<h2>My Album</h2>');
    expect(html).toContain('data-layout="1"');
    expect(html).toContain('src="data:image/png;base64,abc"');
    expect(html).toContain('alt="Photo 1"');
    expect(html).toContain('<figcaption>Photo 1</figcaption>');
    expect(html).toContain('</article>');
  });

  it('renders hidden title with sr-only class', () => {
    const albumData = {
      title: 'Hidden Title',
      hideTitle: true,
      pages: [],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toContain('<h2 class="sr-only">Hidden Title</h2>');
  });

  it('renders visible title without sr-only class', () => {
    const albumData = {
      title: 'Visible Title',
      hideTitle: false,
      pages: [],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toContain('<h2>Visible Title</h2>');
    expect(html).not.toContain('sr-only');
  });

  it('renders multiple pages', () => {
    const albumData = {
      title: 'Multi',
      hideTitle: false,
      pages: [
        { layout: '1', images: [{ dataUrl: 'img1.jpg', caption: '' }] },
        { layout: '2', images: [{ dataUrl: 'img2.jpg', caption: '' }, { dataUrl: 'img3.jpg', caption: '' }] },
      ],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toContain('data-layout="1"');
    expect(html).toContain('data-layout="2"');
    expect(html).toContain('src="img1.jpg"');
    expect(html).toContain('src="img2.jpg"');
    expect(html).toContain('src="img3.jpg"');
  });

  it('skips images without dataUrl (empty slots)', () => {
    const albumData = {
      title: 'Sparse',
      hideTitle: false,
      pages: [
        { layout: '2', images: [{ dataUrl: 'img1.jpg', caption: 'yes' }, null] },
      ],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toContain('src="img1.jpg"');
    // Only one figure element since the second slot is null
    const figureCount = (html.match(/<figure/g) || []).length;
    expect(figureCount).toBe(1);
  });

  it('omits figcaption when caption is empty', () => {
    const albumData = {
      title: 'No Caption',
      hideTitle: false,
      pages: [
        { layout: '1', images: [{ dataUrl: 'img.jpg', caption: '' }] },
      ],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).not.toContain('<figcaption>');
  });

  it('includes figcaption when caption is provided', () => {
    const albumData = {
      title: 'With Caption',
      hideTitle: false,
      pages: [
        { layout: '1', images: [{ dataUrl: 'img.jpg', caption: 'A nice photo' }] },
      ],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toContain('<figcaption>A nice photo</figcaption>');
  });

  it('escapes HTML in title', () => {
    const albumData = {
      title: '<script>alert("xss")</script>',
      hideTitle: false,
      pages: [],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toContain('&lt;script&gt;alert("xss")&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('escapes HTML in captions', () => {
    const albumData = {
      title: 'Safe',
      hideTitle: false,
      pages: [
        { layout: '1', images: [{ dataUrl: 'img.jpg', caption: '<b>bold</b>' }] },
      ],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain('alt="&lt;b&gt;bold&lt;/b&gt;"');
  });

  it('escapes HTML in alt attribute when caption is absent', () => {
    const albumData = {
      title: 'Test',
      hideTitle: false,
      pages: [
        { layout: '1', images: [{ dataUrl: 'img.jpg' }] },
      ],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toContain('alt=""');
  });

  it('renders image modifiers, inline styles, and data attrs', () => {
    const albumData = {
      title: 'Styled',
      hideTitle: false,
      pages: [
        {
          layout: '1',
          images: [{
            dataUrl: 'img.jpg',
            caption: 'Rotated',
            frame: 'thin',
            filter: 'sepia',
            filterIntensity: 100,
            rotation: 90,
          }],
        },
      ],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toContain('photo-album__item--frame-thin');
    expect(html).toContain('photo-album__item--filter-sepia');
    expect(html).toContain('transform:rotate(90deg)');
    expect(html).toContain('filter:sepia(');
    expect(html).toContain('data-filter="sepia"');
    expect(html).toContain('data-rotation="90"');
  });

  it('renders empty page with no figures when all slots are empty', () => {
    const albumData = {
      title: 'Empty',
      hideTitle: false,
      pages: [
        { layout: '1', images: [] },
      ],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toContain('data-layout="1"');
    const figureCount = (html.match(/<figure/g) || []).length;
    expect(figureCount).toBe(0);
  });

  it('handles image with no caption property (undefined)', () => {
    const albumData = {
      title: 'Test',
      hideTitle: false,
      pages: [
        { layout: '1', images: [{ dataUrl: 'img.jpg' }] },
      ],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).not.toContain('<figcaption>');
    expect(html).toContain('alt=""');
  });

  it('renders no pages when pages array is empty', () => {
    const albumData = {
      title: 'Empty Album',
      hideTitle: false,
      pages: [],
    };
    const html = buildAlbumHtml(albumData, escapeHtml);
    expect(html).toBe('<article class="photo-album-chapter"><h2>Empty Album</h2></article>');
  });
});
