import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildLayoutButtons, buildOptionSelect, applyFilterPreview, getSlotElement } from '../../../js/admin/modules/AlbumPageRenderer.js';

// ---------------------------------------------------------------------------
// buildLayoutButtons
// ---------------------------------------------------------------------------
describe('buildLayoutButtons', () => {
  it('returns HTML string containing 8 layout buttons', () => {
    const html = buildLayoutButtons('1');
    const container = document.createElement('div');
    container.innerHTML = html;
    const buttons = container.querySelectorAll('button.album-layout-btn');
    expect(buttons).toHaveLength(8);
  });

  it('marks the active layout with "active" class', () => {
    const html = buildLayoutButtons('3r');
    const container = document.createElement('div');
    container.innerHTML = html;
    const activeButtons = container.querySelectorAll('button.album-layout-btn.active');
    expect(activeButtons).toHaveLength(1);
    expect(activeButtons[0].dataset.layout).toBe('3r');
  });

  it('does not mark any button as active when activeLayout does not match', () => {
    const html = buildLayoutButtons('unknown');
    const container = document.createElement('div');
    container.innerHTML = html;
    const activeButtons = container.querySelectorAll('button.album-layout-btn.active');
    expect(activeButtons).toHaveLength(0);
  });

  it('each button has a data-layout attribute', () => {
    const html = buildLayoutButtons('1');
    const container = document.createElement('div');
    container.innerHTML = html;
    const buttons = container.querySelectorAll('button.album-layout-btn');
    const layoutIds = Array.from(buttons).map(b => b.dataset.layout);
    expect(layoutIds).toEqual(['1', '2', '2h', '3', '3r', '3t', '3b', '4']);
  });

  it('each button has type="button"', () => {
    const html = buildLayoutButtons('2');
    const container = document.createElement('div');
    container.innerHTML = html;
    const buttons = container.querySelectorAll('button.album-layout-btn');
    buttons.forEach(btn => {
      expect(btn.type).toBe('button');
    });
  });

  it('layout "1" button has 1 <i> element in preview', () => {
    const html = buildLayoutButtons('1');
    const container = document.createElement('div');
    container.innerHTML = html;
    const btn = container.querySelector('[data-layout="1"]');
    const icons = btn.querySelectorAll('.album-layout-preview i');
    expect(icons).toHaveLength(1);
  });

  it('layout "2" button has 2 <i> elements in preview', () => {
    const html = buildLayoutButtons('2');
    const container = document.createElement('div');
    container.innerHTML = html;
    const btn = container.querySelector('[data-layout="2"]');
    const icons = btn.querySelectorAll('.album-layout-preview i');
    expect(icons).toHaveLength(2);
  });

  it('layout "3" button has 3 <i> elements in preview', () => {
    const html = buildLayoutButtons('1');
    const container = document.createElement('div');
    container.innerHTML = html;
    const btn = container.querySelector('[data-layout="3"]');
    const icons = btn.querySelectorAll('.album-layout-preview i');
    expect(icons).toHaveLength(3);
  });

  it('layout "4" button has 4 <i> elements in preview', () => {
    const html = buildLayoutButtons('4');
    const container = document.createElement('div');
    container.innerHTML = html;
    const btn = container.querySelector('[data-layout="4"]');
    const icons = btn.querySelectorAll('.album-layout-preview i');
    expect(icons).toHaveLength(4);
  });

  it('preview elements have correct CSS class with layout id suffix', () => {
    const html = buildLayoutButtons('2h');
    const container = document.createElement('div');
    container.innerHTML = html;
    const btn = container.querySelector('[data-layout="2h"]');
    const preview = btn.querySelector('.album-layout-preview');
    expect(preview.classList.contains('album-layout-preview--2h')).toBe(true);
  });

  it('each button has a label span with the layout id text', () => {
    const html = buildLayoutButtons('1');
    const container = document.createElement('div');
    container.innerHTML = html;
    const buttons = container.querySelectorAll('button.album-layout-btn');
    buttons.forEach(btn => {
      const label = btn.querySelector('.album-layout-label');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe(btn.dataset.layout);
    });
  });

  it('each button has a title attribute', () => {
    const html = buildLayoutButtons('1');
    const container = document.createElement('div');
    container.innerHTML = html;
    const buttons = container.querySelectorAll('button.album-layout-btn');
    buttons.forEach(btn => {
      expect(btn.title).toBeTruthy();
    });
  });

  it('only one button is active at a time for layout "4"', () => {
    const html = buildLayoutButtons('4');
    const container = document.createElement('div');
    container.innerHTML = html;
    const activeButtons = container.querySelectorAll('.active');
    expect(activeButtons).toHaveLength(1);
    expect(activeButtons[0].dataset.layout).toBe('4');
  });
});

// ---------------------------------------------------------------------------
// buildOptionSelect
// ---------------------------------------------------------------------------
describe('buildOptionSelect', () => {
  const sampleOptions = [
    { id: 'none', label: 'None' },
    { id: 'thin', label: 'Thin' },
    { id: 'shadow', label: 'Shadow' },
  ];

  it('returns a <select> element', () => {
    const select = buildOptionSelect(sampleOptions, 'none', vi.fn());
    expect(select.tagName).toBe('SELECT');
  });

  it('has the correct CSS class', () => {
    const select = buildOptionSelect(sampleOptions, 'none', vi.fn());
    expect(select.className).toBe('album-image-option-select');
  });

  it('creates correct number of <option> elements', () => {
    const select = buildOptionSelect(sampleOptions, 'none', vi.fn());
    expect(select.options).toHaveLength(3);
  });

  it('option values match provided ids', () => {
    const select = buildOptionSelect(sampleOptions, 'thin', vi.fn());
    const values = Array.from(select.options).map(o => o.value);
    expect(values).toEqual(['none', 'thin', 'shadow']);
  });

  it('option labels match provided labels', () => {
    const select = buildOptionSelect(sampleOptions, 'none', vi.fn());
    const labels = Array.from(select.options).map(o => o.textContent);
    expect(labels).toEqual(['None', 'Thin', 'Shadow']);
  });

  it('sets the correct option as selected', () => {
    const select = buildOptionSelect(sampleOptions, 'shadow', vi.fn());
    expect(select.value).toBe('shadow');
  });

  it('defaults to first option when activeId does not match', () => {
    const select = buildOptionSelect(sampleOptions, 'nonexistent', vi.fn());
    // No option is explicitly selected, browser picks the first
    expect(select.value).toBe('none');
  });

  it('fires onChange callback on change event with new value', () => {
    const onChange = vi.fn();
    const select = buildOptionSelect(sampleOptions, 'none', onChange);
    select.value = 'thin';
    select.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('thin');
  });

  it('fires onChange with correct value on subsequent changes', () => {
    const onChange = vi.fn();
    const select = buildOptionSelect(sampleOptions, 'none', onChange);

    select.value = 'shadow';
    select.dispatchEvent(new Event('change'));

    select.value = 'thin';
    select.dispatchEvent(new Event('change'));

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 'shadow');
    expect(onChange).toHaveBeenNthCalledWith(2, 'thin');
  });

  it('works with a single option', () => {
    const single = [{ id: 'only', label: 'Only Option' }];
    const select = buildOptionSelect(single, 'only', vi.fn());
    expect(select.options).toHaveLength(1);
    expect(select.value).toBe('only');
  });

  it('works with empty options array', () => {
    const select = buildOptionSelect([], 'none', vi.fn());
    expect(select.options).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// applyFilterPreview
// ---------------------------------------------------------------------------
describe('applyFilterPreview', () => {
  let slot;
  let imgEl;

  beforeEach(() => {
    slot = document.createElement('div');
    imgEl = document.createElement('img');
    imgEl.className = 'album-image-slot-img';
    slot.appendChild(imgEl);
  });

  it('applies CSS filter to the .album-image-slot-img element', () => {
    applyFilterPreview(slot, { filter: 'grayscale', filterIntensity: 100 });
    expect(imgEl.style.filter).toBe('grayscale(1)');
  });

  it('applies sepia filter with intensity', () => {
    applyFilterPreview(slot, { filter: 'sepia', filterIntensity: 100 });
    expect(imgEl.style.filter).toContain('sepia');
  });

  it('clears filter when filter is "none"', () => {
    imgEl.style.filter = 'grayscale(1)';
    applyFilterPreview(slot, { filter: 'none', filterIntensity: 100 });
    expect(imgEl.style.filter).toBe('');
  });

  it('clears filter when filter is null/undefined', () => {
    imgEl.style.filter = 'sepia(0.5)';
    applyFilterPreview(slot, { filter: null });
    expect(imgEl.style.filter).toBe('');
  });

  it('handles null img (no filter applied, no error)', () => {
    imgEl.style.filter = 'grayscale(1)';
    applyFilterPreview(slot, null);
    expect(imgEl.style.filter).toBe('');
  });

  it('handles undefined img', () => {
    imgEl.style.filter = 'contrast(1.2)';
    applyFilterPreview(slot, undefined);
    expect(imgEl.style.filter).toBe('');
  });

  it('does nothing when slot has no .album-image-slot-img', () => {
    const emptySlot = document.createElement('div');
    // Should not throw
    expect(() => applyFilterPreview(emptySlot, { filter: 'grayscale', filterIntensity: 50 })).not.toThrow();
  });

  it('applies filter with partial intensity', () => {
    applyFilterPreview(slot, { filter: 'grayscale', filterIntensity: 50 });
    expect(imgEl.style.filter).toBe('grayscale(0.5)');
  });

  it('applies contrast filter correctly', () => {
    applyFilterPreview(slot, { filter: 'contrast', filterIntensity: 100 });
    expect(imgEl.style.filter).toContain('contrast');
  });

  it('uses default intensity when filterIntensity is missing', () => {
    applyFilterPreview(slot, { filter: 'grayscale' });
    // Default intensity is 100 -> grayscale(1)
    expect(imgEl.style.filter).toBe('grayscale(1)');
  });

  it('handles img object without filter property', () => {
    imgEl.style.filter = 'sepia(0.5)';
    applyFilterPreview(slot, { dataUrl: 'data:image/png;base64,...' });
    expect(imgEl.style.filter).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getSlotElement
// ---------------------------------------------------------------------------
describe('getSlotElement', () => {
  let albumPagesEl;

  function createManager(pagesEl) {
    return { albumPagesEl: pagesEl };
  }

  function buildPageCard(slotCount) {
    const card = document.createElement('div');
    card.className = 'album-page-card';
    for (let i = 0; i < slotCount; i++) {
      const slot = document.createElement('div');
      slot.className = 'album-image-slot';
      slot.dataset.testIndex = String(i);
      card.appendChild(slot);
    }
    return card;
  }

  beforeEach(() => {
    albumPagesEl = document.createElement('div');
  });

  it('finds the correct slot by page and image index', () => {
    const page0 = buildPageCard(2);
    const page1 = buildPageCard(3);
    albumPagesEl.appendChild(page0);
    albumPagesEl.appendChild(page1);

    const manager = createManager(albumPagesEl);
    const slot = getSlotElement(manager, 1, 2);
    expect(slot).not.toBeNull();
    expect(slot.dataset.testIndex).toBe('2');
    expect(slot.closest('.album-page-card')).toBe(page1);
  });

  it('returns first slot for imageIndex 0', () => {
    const page = buildPageCard(3);
    albumPagesEl.appendChild(page);

    const manager = createManager(albumPagesEl);
    const slot = getSlotElement(manager, 0, 0);
    expect(slot).not.toBeNull();
    expect(slot.dataset.testIndex).toBe('0');
  });

  it('returns null for invalid page index (out of range)', () => {
    const page = buildPageCard(2);
    albumPagesEl.appendChild(page);

    const manager = createManager(albumPagesEl);
    expect(getSlotElement(manager, 5, 0)).toBeNull();
  });

  it('returns null for negative page index', () => {
    const page = buildPageCard(2);
    albumPagesEl.appendChild(page);

    const manager = createManager(albumPagesEl);
    // Negative indices won't match children
    expect(getSlotElement(manager, -1, 0)).toBeNull();
  });

  it('returns null for invalid image index (out of range)', () => {
    const page = buildPageCard(2);
    albumPagesEl.appendChild(page);

    const manager = createManager(albumPagesEl);
    expect(getSlotElement(manager, 0, 10)).toBeNull();
  });

  it('returns null when albumPagesEl is null', () => {
    const manager = createManager(null);
    expect(getSlotElement(manager, 0, 0)).toBeNull();
  });

  it('returns null when albumPagesEl is undefined', () => {
    const manager = createManager(undefined);
    expect(getSlotElement(manager, 0, 0)).toBeNull();
  });

  it('returns null when page has no slots', () => {
    const emptyCard = document.createElement('div');
    emptyCard.className = 'album-page-card';
    albumPagesEl.appendChild(emptyCard);

    const manager = createManager(albumPagesEl);
    expect(getSlotElement(manager, 0, 0)).toBeNull();
  });

  it('handles multiple pages and returns correct slot', () => {
    albumPagesEl.appendChild(buildPageCard(1));
    albumPagesEl.appendChild(buildPageCard(4));
    albumPagesEl.appendChild(buildPageCard(2));

    const manager = createManager(albumPagesEl);

    // Page 1, slot 3 (last of 4)
    const slot = getSlotElement(manager, 1, 3);
    expect(slot).not.toBeNull();
    expect(slot.dataset.testIndex).toBe('3');

    // Page 2, slot 1
    const slot2 = getSlotElement(manager, 2, 1);
    expect(slot2).not.toBeNull();
    expect(slot2.dataset.testIndex).toBe('1');
  });
});
