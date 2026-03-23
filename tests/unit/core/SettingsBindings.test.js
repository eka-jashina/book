/**
 * Unit tests for SettingsBindings
 * Binds settings UI controls to event handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bindSettingsControls } from '../../../js/core/SettingsBindings.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Fake EventListenerManager — records registered listeners */
function createMockEventManager() {
  const listeners = [];
  return {
    add(el, event, handler) {
      listeners.push({ el, event, handler });
      el.addEventListener(event, handler);
    },
    listeners,
  };
}

/** Create a minimal DOM element with children */
function createElement(tag = 'div', attrs = {}) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k.startsWith('data-')) {
      el.dataset[k.replace('data-', '')] = v;
    } else {
      el.setAttribute(k, v);
    }
  });
  return el;
}

function createElements() {
  const increaseBtn = createElement('button');
  const decreaseBtn = createElement('button');
  const fontSizeValue = createElement('span');
  fontSizeValue.textContent = '18';

  const fontSelect = createElement('select');
  const languageSelect = createElement('select');

  // Theme segmented control with segments
  const themeSegmented = createElement('div');
  ['light', 'dark', 'bw'].forEach((theme) => {
    const segment = createElement('button', { class: 'theme-segment' });
    segment.classList.add('theme-segment');
    segment.dataset.theme = theme;
    segment.dataset.active = theme === 'light' ? 'true' : 'false';
    segment.setAttribute('aria-checked', theme === 'light' ? 'true' : 'false');
    themeSegmented.appendChild(segment);
  });

  const debugToggle = createElement('button');

  const soundToggle = createElement('input');
  soundToggle.type = 'checkbox';
  soundToggle.checked = true;

  const volumeSlider = createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.value = '50';

  // Ambient pills
  const ambientPills = createElement('div');
  ['none', 'rain', 'fireplace'].forEach((type) => {
    const pill = createElement('button', { class: 'ambient-pill' });
    pill.classList.add('ambient-pill');
    pill.dataset.type = type;
    pill.dataset.active = type === 'none' ? 'true' : 'false';
    pill.setAttribute('aria-checked', type === 'none' ? 'true' : 'false');
    ambientPills.appendChild(pill);
  });

  const ambientVolume = createElement('input');
  ambientVolume.type = 'range';
  ambientVolume.value = '50';

  const ambientVolumeWrapper = createElement('div');
  const fullscreenBtn = createElement('button');

  return {
    increaseBtn,
    decreaseBtn,
    fontSizeValue,
    fontSelect,
    languageSelect,
    themeSegmented,
    debugToggle,
    soundToggle,
    volumeSlider,
    ambientPills,
    ambientVolume,
    ambientVolumeWrapper,
    fullscreenBtn,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('SettingsBindings', () => {
  let elements;
  let eventManager;
  let onSettings;
  let getFontSize;

  beforeEach(() => {
    elements = createElements();
    eventManager = createMockEventManager();
    onSettings = vi.fn();
    getFontSize = vi.fn(() => 18);
  });

  describe('bindSettingsControls', () => {
    it('should register listeners for all elements', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      // Each non-null element gets a listener
      const registeredElements = eventManager.listeners.map((l) => l.el);
      expect(registeredElements).toContain(elements.increaseBtn);
      expect(registeredElements).toContain(elements.decreaseBtn);
      expect(registeredElements).toContain(elements.fontSelect);
      expect(registeredElements).toContain(elements.languageSelect);
      expect(registeredElements).toContain(elements.themeSegmented);
      expect(registeredElements).toContain(elements.soundToggle);
      expect(registeredElements).toContain(elements.volumeSlider);
      expect(registeredElements).toContain(elements.ambientPills);
      expect(registeredElements).toContain(elements.ambientVolume);
      expect(registeredElements).toContain(elements.fullscreenBtn);
      expect(registeredElements).toContain(elements.debugToggle);
    });

    it('should skip null elements without errors', () => {
      const partialElements = {
        increaseBtn: null,
        decreaseBtn: null,
        fontSizeValue: null,
        fontSelect: null,
        languageSelect: null,
        themeSegmented: null,
        debugToggle: null,
        soundToggle: null,
        volumeSlider: null,
        ambientPills: null,
        ambientVolume: null,
        ambientVolumeWrapper: null,
        fullscreenBtn: null,
      };

      expect(() =>
        bindSettingsControls(partialElements, eventManager, onSettings, getFontSize),
      ).not.toThrow();
      expect(eventManager.listeners).toHaveLength(0);
    });
  });

  describe('font size stepper', () => {
    it('should call onSettings("fontSize", "increase") on increase click', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);
      elements.increaseBtn.click();

      expect(onSettings).toHaveBeenCalledWith('fontSize', 'increase');
    });

    it('should call onSettings("fontSize", "decrease") on decrease click', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);
      elements.decreaseBtn.click();

      expect(onSettings).toHaveBeenCalledWith('fontSize', 'decrease');
    });

    it('should update font size display after increase', () => {
      getFontSize.mockReturnValue(20);
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);
      elements.increaseBtn.click();

      expect(elements.fontSizeValue.textContent).toBe('20');
    });

    it('should update font size display after decrease', () => {
      getFontSize.mockReturnValue(16);
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);
      elements.decreaseBtn.click();

      expect(elements.fontSizeValue.textContent).toBe('16');
    });
  });

  describe('font select', () => {
    it('should call onSettings("font", value) on change', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      const event = new Event('change');
      Object.defineProperty(event, 'target', { value: { value: 'merriweather' } });
      elements.fontSelect.dispatchEvent(event);

      expect(onSettings).toHaveBeenCalledWith('font', 'merriweather');
    });
  });

  describe('language select', () => {
    it('should call onSettings("language", value) on change', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      const event = new Event('change');
      Object.defineProperty(event, 'target', { value: { value: 'en' } });
      elements.languageSelect.dispatchEvent(event);

      expect(onSettings).toHaveBeenCalledWith('language', 'en');
    });
  });

  describe('theme segmented control', () => {
    it('should call onSettings("theme", theme) on segment click', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      const darkSegment = elements.themeSegmented.querySelector('[data-theme="dark"]');
      darkSegment.click();

      expect(onSettings).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should update aria-checked on all segments', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      const darkSegment = elements.themeSegmented.querySelector('[data-theme="dark"]');
      darkSegment.click();

      const segments = elements.themeSegmented.querySelectorAll('.theme-segment');
      expect(segments[0].getAttribute('aria-checked')).toBe('false'); // light
      expect(segments[1].getAttribute('aria-checked')).toBe('true'); // dark
      expect(segments[2].getAttribute('aria-checked')).toBe('false'); // bw
    });

    it('should update data-active on segments', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      const bwSegment = elements.themeSegmented.querySelector('[data-theme="bw"]');
      bwSegment.click();

      expect(bwSegment.dataset.active).toBe('true');
      const lightSegment = elements.themeSegmented.querySelector('[data-theme="light"]');
      expect(lightSegment.dataset.active).toBe('false');
    });

    it('should ignore clicks outside segments', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      // Click on the container itself, not a segment
      elements.themeSegmented.click();

      expect(onSettings).not.toHaveBeenCalled();
    });
  });

  describe('debug toggle', () => {
    it('should call onSettings("debug", "toggle") on click', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);
      elements.debugToggle.click();

      expect(onSettings).toHaveBeenCalledWith('debug', 'toggle');
    });
  });

  describe('sound controls', () => {
    it('should call onSettings("soundEnabled", true) when toggled on', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      elements.soundToggle.checked = true;
      elements.soundToggle.dispatchEvent(new Event('change'));

      expect(onSettings).toHaveBeenCalledWith('soundEnabled', true);
    });

    it('should call onSettings("soundEnabled", false) when toggled off', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      elements.soundToggle.checked = false;
      elements.soundToggle.dispatchEvent(new Event('change'));

      expect(onSettings).toHaveBeenCalledWith('soundEnabled', false);
    });

    it('should call onSettings("soundVolume", normalized) on slider input', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      elements.volumeSlider.value = '75';
      elements.volumeSlider.dispatchEvent(new Event('input'));

      expect(onSettings).toHaveBeenCalledWith('soundVolume', 0.75);
    });

    it('should handle volume slider at 0', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      elements.volumeSlider.value = '0';
      elements.volumeSlider.dispatchEvent(new Event('input'));

      expect(onSettings).toHaveBeenCalledWith('soundVolume', 0);
    });

    it('should handle volume slider at 100', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      elements.volumeSlider.value = '100';
      elements.volumeSlider.dispatchEvent(new Event('input'));

      expect(onSettings).toHaveBeenCalledWith('soundVolume', 1);
    });
  });

  describe('ambient controls', () => {
    it('should call onSettings("ambientType", type) on pill click', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      const rainPill = elements.ambientPills.querySelector('[data-type="rain"]');
      rainPill.click();

      expect(onSettings).toHaveBeenCalledWith('ambientType', 'rain');
    });

    it('should update aria-checked on all pills', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      const rainPill = elements.ambientPills.querySelector('[data-type="rain"]');
      rainPill.click();

      const pills = elements.ambientPills.querySelectorAll('.ambient-pill');
      expect(pills[0].getAttribute('aria-checked')).toBe('false'); // none
      expect(pills[1].getAttribute('aria-checked')).toBe('true'); // rain
      expect(pills[2].getAttribute('aria-checked')).toBe('false'); // fireplace
    });

    it('should show ambient volume wrapper when type is not "none"', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      const rainPill = elements.ambientPills.querySelector('[data-type="rain"]');
      rainPill.click();

      expect(elements.ambientVolumeWrapper.classList.contains('visible')).toBe(true);
    });

    it('should hide ambient volume wrapper when type is "none"', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      // First select rain
      elements.ambientPills.querySelector('[data-type="rain"]').click();
      // Then select none
      elements.ambientPills.querySelector('[data-type="none"]').click();

      expect(elements.ambientVolumeWrapper.classList.contains('visible')).toBe(false);
    });

    it('should ignore clicks outside pills', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      elements.ambientPills.click();

      expect(onSettings).not.toHaveBeenCalled();
    });

    it('should call onSettings("ambientVolume", normalized) on volume input', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);

      elements.ambientVolume.value = '30';
      elements.ambientVolume.dispatchEvent(new Event('input'));

      expect(onSettings).toHaveBeenCalledWith('ambientVolume', 0.3);
    });
  });

  describe('fullscreen button', () => {
    it('should call onSettings("fullscreen", "toggle") on click', () => {
      bindSettingsControls(elements, eventManager, onSettings, getFontSize);
      elements.fullscreenBtn.click();

      expect(onSettings).toHaveBeenCalledWith('fullscreen', 'toggle');
    });
  });
});
