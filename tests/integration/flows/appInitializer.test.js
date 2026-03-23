/**
 * INTEGRATION TEST: AppInitializer
 * Полная последовательность инициализации приложения:
 * настройки → UI → режим ридера → события → шрифты → lifecycle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { flushPromises } from '../../helpers/testUtils.js';

// Mock CONFIG
const mockConfig = {
  COVER_BG: '/images/cover.webp',
  AMBIENT: {
    none: { label: 'Тишина', icon: '🔇', shortLabel: 'Тишина' },
    rain: { label: 'Дождь', icon: '🌧', shortLabel: 'Дождь' },
  },
};

vi.mock('../../../js/config.js', () => ({
  getConfig: () => mockConfig,
}));

// Mock ErrorHandler
vi.mock('../../../js/utils/ErrorHandler.js', () => ({
  ErrorHandler: { handle: vi.fn() },
}));

// Mock AmbientManager
vi.mock('../../../js/managers/AmbientManager.js', () => ({
  AmbientManager: { TYPE_NONE: 'none' },
}));

import { AppInitializer } from '../../../js/core/AppInitializer.js';
import { ErrorHandler } from '../../../js/utils/ErrorHandler.js';

describe('AppInitializer Integration', () => {
  let context;

  const createReaderDOM = () => {
    // Font selector
    const fontSelect = document.createElement('select');
    fontSelect.id = 'fontSelect';
    ['georgia', 'merriweather'].forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      fontSelect.appendChild(opt);
    });
    document.body.appendChild(fontSelect);

    // Font size value
    const fontSizeValue = document.createElement('span');
    fontSizeValue.id = 'fontSizeValue';
    document.body.appendChild(fontSizeValue);

    // Theme segmented
    const themeSegmented = document.createElement('div');
    themeSegmented.id = 'themeSegmented';
    ['light', 'dark', 'bw'].forEach(theme => {
      const seg = document.createElement('button');
      seg.className = 'theme-segment';
      seg.dataset.theme = theme;
      seg.dataset.active = 'false';
      seg.setAttribute('aria-checked', 'false');
      themeSegmented.appendChild(seg);
    });
    document.body.appendChild(themeSegmented);

    // Sound controls
    const soundToggle = document.createElement('input');
    soundToggle.id = 'soundToggle';
    soundToggle.type = 'checkbox';
    document.body.appendChild(soundToggle);

    const volumeSlider = document.createElement('input');
    volumeSlider.id = 'volumeSlider';
    volumeSlider.type = 'range';
    document.body.appendChild(volumeSlider);

    // Ambient controls
    const ambientPills = document.createElement('div');
    ambientPills.id = 'ambientPills';
    document.body.appendChild(ambientPills);

    const ambientVolume = document.createElement('input');
    ambientVolume.id = 'ambientVolume';
    ambientVolume.type = 'range';
    document.body.appendChild(ambientVolume);

    const ambientVolumeWrapper = document.createElement('div');
    ambientVolumeWrapper.id = 'ambientVolumeWrapper';
    document.body.appendChild(ambientVolumeWrapper);

    // Language selector
    const languageSelect = document.createElement('select');
    languageSelect.id = 'languageSelect';
    document.body.appendChild(languageSelect);

    // Continue button
    const continueBtn = document.createElement('button');
    continueBtn.id = 'continueBtn';
    continueBtn.hidden = true;
    document.body.appendChild(continueBtn);

    // Navigation buttons
    const nextBtn = document.createElement('button');
    nextBtn.id = 'nextBtn';
    document.body.appendChild(nextBtn);

    const prevBtn = document.createElement('button');
    prevBtn.id = 'prevBtn';
    document.body.appendChild(prevBtn);

    const tocBtn = document.createElement('button');
    tocBtn.id = 'tocBtn';
    document.body.appendChild(tocBtn);

    // Cover
    const cover = document.createElement('div');
    cover.id = 'cover';
    document.body.appendChild(cover);

    // Font size buttons
    const increaseBtn = document.createElement('button');
    increaseBtn.id = 'increaseBtn';
    document.body.appendChild(increaseBtn);

    const decreaseBtn = document.createElement('button');
    decreaseBtn.id = 'decreaseBtn';
    document.body.appendChild(decreaseBtn);

    // Debug toggle
    const debugToggle = document.createElement('button');
    debugToggle.id = 'debugToggle';
    document.body.appendChild(debugToggle);

    // Fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.id = 'fullscreenBtn';
    document.body.appendChild(fullscreenBtn);

    // Ambient pill template
    const tmpl = document.createElement('template');
    tmpl.id = 'tmpl-ambient-pill';
    const pill = document.createElement('button');
    pill.className = 'ambient-pill';
    const icon = document.createElement('span');
    icon.className = 'ambient-pill-icon';
    pill.appendChild(icon);
    const label = document.createElement('span');
    label.className = 'ambient-pill-label';
    pill.appendChild(label);
    tmpl.content.appendChild(pill);
    document.body.appendChild(tmpl);

    // Reader mode elements
    const editBtn = document.createElement('button');
    editBtn.id = 'reader-edit-btn';
    editBtn.hidden = true;
    document.body.appendChild(editBtn);

    const authorInfo = document.createElement('a');
    authorInfo.id = 'reader-author-info';
    authorInfo.hidden = true;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'reader-author-name';
    authorInfo.appendChild(nameSpan);
    document.body.appendChild(authorInfo);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'controls';
    document.body.appendChild(controls);

    // Back to shelf button
    const backBtn = document.createElement('button');
    backBtn.id = 'backToShelfBtn';
    document.body.appendChild(backBtn);

    // Embed elements
    const embedLink = document.createElement('a');
    embedLink.id = 'embed-open-link';
    embedLink.hidden = true;
    document.body.appendChild(embedLink);

    const watermark = document.createElement('a');
    watermark.id = 'embed-watermark';
    watermark.hidden = true;
    document.body.appendChild(watermark);
  };

  const createContext = (overrides = {}) => {
    const elements = {};
    [
      'fontSelect', 'fontSizeValue', 'themeSegmented',
      'soundToggle', 'volumeSlider',
      'ambientPills', 'ambientVolume', 'ambientVolumeWrapper',
      'languageSelect', 'continueBtn',
      'nextBtn', 'prevBtn', 'tocBtn', 'cover',
      'increaseBtn', 'decreaseBtn', 'debugToggle', 'fullscreenBtn',
    ].forEach(id => {
      elements[id.replace('Btn', 'Btn')] = document.getElementById(id);
    });
    // Remap some
    elements.coverEl = elements.cover;

    return {
      dom: {
        get: (key) => {
          const map = {
            body: document.body,
            fontSelect: document.getElementById('fontSelect'),
            fontSizeValue: document.getElementById('fontSizeValue'),
            themeSegmented: document.getElementById('themeSegmented'),
            soundToggle: document.getElementById('soundToggle'),
            volumeSlider: document.getElementById('volumeSlider'),
            ambientPills: document.getElementById('ambientPills'),
            ambientVolume: document.getElementById('ambientVolume'),
            ambientVolumeWrapper: document.getElementById('ambientVolumeWrapper'),
            languageSelect: document.getElementById('languageSelect'),
            continueBtn: document.getElementById('continueBtn'),
          };
          return map[key] || null;
        },
        elements,
      },
      settings: {
        get: vi.fn((key) => {
          const defaults = {
            font: 'georgia', fontSize: 18, theme: 'light', page: 0,
            soundEnabled: true, soundVolume: 0.3,
            ambientType: 'none', ambientVolume: 0.5,
          };
          return defaults[key];
        }),
      },
      settingsDelegate: { apply: vi.fn() },
      backgroundManager: { setBackground: vi.fn() },
      eventController: { bind: vi.fn() },
      dragDelegate: { bind: vi.fn() },
      lifecycleDelegate: { init: vi.fn().mockResolvedValue() },
      readerMode: 'owner',
      bookOwner: null,
      bookId: null,
      ...overrides,
    };
  };

  beforeEach(() => {
    createReaderDOM();
    // Mock document.fonts.ready
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
    document.querySelectorAll('template').forEach(t => t.remove());
  });

  describe('Basic initialization', () => {
    it('should run full initialization sequence', async () => {
      context = createContext();
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      expect(context.settingsDelegate.apply).toHaveBeenCalled();
      expect(context.backgroundManager.setBackground).toHaveBeenCalledWith('/images/cover.webp');
      expect(context.eventController.bind).toHaveBeenCalled();
      expect(context.dragDelegate.bind).toHaveBeenCalled();
      expect(context.lifecycleDelegate.init).toHaveBeenCalled();
    });

    it('should apply settings to DOM elements', async () => {
      context = createContext();
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      expect(document.getElementById('fontSelect').value).toBe('georgia');
      expect(document.getElementById('fontSizeValue').textContent).toBe('18');
    });

    it('should sync theme segmented control', async () => {
      context = createContext();
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      const lightSeg = document.querySelector('[data-theme="light"]');
      expect(lightSeg.dataset.active).toBe('true');
      expect(lightSeg.getAttribute('aria-checked')).toBe('true');

      const darkSeg = document.querySelector('[data-theme="dark"]');
      expect(darkSeg.dataset.active).toBe('false');
    });

    it('should sync sound controls', async () => {
      context = createContext();
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      expect(document.getElementById('soundToggle').checked).toBe(true);
      expect(document.getElementById('volumeSlider').value).toBe('30');
    });

    it('should populate ambient pills from CONFIG', async () => {
      context = createContext();
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      const pills = document.querySelectorAll('.ambient-pill');
      expect(pills.length).toBe(2); // none + rain
    });

    it('should set body chapter dataset to cover', async () => {
      context = createContext();
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      expect(document.body.dataset.chapter).toBe('cover');
    });
  });

  describe('Continue button', () => {
    it('should show continue button when saved page > 0', async () => {
      context = createContext({
        settings: {
          get: vi.fn((key) => key === 'page' ? 5 : 'georgia'),
        },
      });
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      expect(document.getElementById('continueBtn').hidden).toBe(false);
    });

    it('should keep continue button hidden when page is 0', async () => {
      context = createContext();
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      expect(document.getElementById('continueBtn').hidden).toBe(true);
    });
  });

  describe('Reader modes', () => {
    it('should set owner mode by default', async () => {
      context = createContext({ readerMode: 'owner', bookId: 'book-1' });
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      expect(document.body.dataset.readerMode).toBe('owner');
      const editBtn = document.getElementById('reader-edit-btn');
      expect(editBtn.hidden).toBe(false);
    });

    it('should set guest mode and show author info', async () => {
      context = createContext({
        readerMode: 'guest',
        bookOwner: { username: 'demo', displayName: 'Demo Author' },
      });
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      expect(document.body.dataset.readerMode).toBe('guest');

      const authorInfo = document.getElementById('reader-author-info');
      expect(authorInfo.hidden).toBe(false);
      expect(authorInfo.querySelector('.reader-author-name').textContent).toBe('Demo Author');
    });

    it('should set embed mode with minimal UI', async () => {
      context = createContext({
        readerMode: 'embed',
        bookId: 'embed-book-1',
      });
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      expect(document.body.dataset.readerMode).toBe('embed');
      expect(document.body.classList.contains('embed-mode')).toBe(true);

      const controls = document.querySelector('.controls');
      expect(controls.hidden).toBe(true);

      const embedLink = document.getElementById('embed-open-link');
      expect(embedLink.hidden).toBe(false);
      expect(embedLink.href).toContain('/book/embed-book-1');

      const watermark = document.getElementById('embed-watermark');
      expect(watermark.hidden).toBe(false);
    });

    it('should hide back button in embed mode', async () => {
      context = createContext({ readerMode: 'embed', bookId: 'b1' });
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      expect(document.getElementById('backToShelfBtn').hidden).toBe(true);
    });

    it('should set author shelf link in guest mode', async () => {
      context = createContext({
        readerMode: 'guest',
        bookOwner: { username: 'johndoe', displayName: 'John' },
      });
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      const authorInfo = document.getElementById('reader-author-info');
      expect(authorInfo.dataset.route).toBe('/johndoe');
    });

    it('should use username as fallback when displayName is absent', async () => {
      context = createContext({
        readerMode: 'guest',
        bookOwner: { username: 'johndoe' },
      });
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      const authorName = document.querySelector('.reader-author-name');
      expect(authorName.textContent).toBe('johndoe');
    });
  });

  describe('Error handling', () => {
    it('should handle initialization errors via ErrorHandler', async () => {
      const error = new Error('Init failed');
      context = createContext({
        lifecycleDelegate: { init: vi.fn().mockRejectedValue(error) },
      });
      const initializer = new AppInitializer(context);

      await expect(initializer.initialize()).rejects.toThrow('Init failed');
      expect(ErrorHandler.handle).toHaveBeenCalledWith(error, expect.any(String));
    });
  });

  describe('Cleanup', () => {
    it('should remove edit button listener on destroy', async () => {
      context = createContext({ readerMode: 'owner', bookId: 'book-1' });
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      const editBtn = document.getElementById('reader-edit-btn');
      const removeSpy = vi.spyOn(editBtn, 'removeEventListener');

      initializer.destroy();

      expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should not throw on destroy without edit button handler', () => {
      context = createContext({ readerMode: 'guest' });
      const initializer = new AppInitializer(context);

      expect(() => initializer.destroy()).not.toThrow();
    });
  });

  describe('Full initialization flow', () => {
    it('should run complete owner flow: settings → UI → events → lifecycle', async () => {
      const callOrder = [];
      context = createContext({
        readerMode: 'owner',
        bookId: 'book-1',
        settingsDelegate: { apply: vi.fn(() => callOrder.push('settings')) },
        backgroundManager: { setBackground: vi.fn(() => callOrder.push('background')) },
        eventController: { bind: vi.fn(() => callOrder.push('events')) },
        dragDelegate: { bind: vi.fn(() => callOrder.push('drag')) },
        lifecycleDelegate: { init: vi.fn(async () => callOrder.push('lifecycle')) },
      });
      const initializer = new AppInitializer(context);

      await initializer.initialize();

      expect(callOrder).toEqual(['settings', 'background', 'events', 'drag', 'lifecycle']);
    });
  });
});
