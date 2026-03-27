/**
 * Unit tests for EventController
 * User event handling: clicks, keyboard, touch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSizedElement,
  createKeyboardEvent,
  createTouchEvent,
  flushPromises,
} from '../../helpers/testUtils.js';

// Hoist mocks
const { mockCssVars, mockMediaQueries, mockDirection, mockBoolStr } = vi.hoisted(() => ({
  mockCssVars: {
    getNumber: vi.fn((name, defaultVal) => {
      const values = {
        '--swipe-threshold': 20,
        '--swipe-vertical-limit': 30,
        '--font-min': 14,
        '--font-max': 22,
      };
      return values[name] ?? defaultVal;
    }),
  },
  mockMediaQueries: {
    isMobile: false,
  },
  mockDirection: {
    NEXT: 'next',
    PREV: 'prev',
  },
  mockBoolStr: {
    TRUE: 'true',
    FALSE: 'false',
  },
}));

vi.mock('../../../js/utils/CSSVariables.js', () => ({
  cssVars: mockCssVars,
}));

vi.mock('../../../js/utils/MediaQueryManager.js', () => ({
  mediaQueries: mockMediaQueries,
}));

vi.mock('../../../js/config.js', () => ({
  Direction: mockDirection,
  BoolStr: mockBoolStr,
  getConfig: () => ({}),
}));

// Import after mocks
const { EventController } = await import('../../../js/core/EventController.js');
const { bindSettingsControls } = await import('../../../js/core/SettingsBindings.js');

describe('EventController', () => {
  let controller;
  let mockBook;
  let mockEventManager;
  let mockCallbacks;
  let registeredListeners;

  beforeEach(() => {
    vi.useFakeTimers();

    // Track registered event listeners
    registeredListeners = [];

    mockBook = createSizedElement(800, 600);
    mockBook.className = 'book';
    document.body.appendChild(mockBook);

    mockEventManager = {
      add: vi.fn((element, event, handler, options) => {
        registeredListeners.push({ element, event, handler, options });
      }),
      remove: vi.fn(),
      removeAll: vi.fn(),
    };

    mockCallbacks = {
      onFlip: vi.fn(),
      onTOCClick: vi.fn(),
      onOpen: vi.fn(),
      onSettings: vi.fn(),
      isBusy: vi.fn(() => false),
      isOpened: vi.fn(() => true),
      getFontSize: vi.fn(() => 18),
    };

    controller = new EventController({
      book: mockBook,
      eventManager: mockEventManager,
      ...mockCallbacks,
    });
  });

  afterEach(() => {
    controller?.destroy();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockMediaQueries.isMobile = false;
  });


  describe('_bindNavigationButtons', () => {
    let elements;

    beforeEach(() => {
      elements = {
        nextBtn: document.createElement('button'),
        prevBtn: document.createElement('button'),
        tocBtn: document.createElement('button'),
        continueBtn: document.createElement('button'),
        coverEl: document.createElement('div'),
      };
    });

    it('should bind click handler to nextBtn', () => {
      controller._bindNavigationButtons(elements);

      const call = registeredListeners.find(
        (l) => l.element === elements.nextBtn && l.event === 'click'
      );
      expect(call).toBeDefined();
    });

    it('should call onFlip with NEXT when nextBtn clicked', () => {
      controller._bindNavigationButtons(elements);

      const handler = registeredListeners.find(
        (l) => l.element === elements.nextBtn
      ).handler;
      handler();

      expect(mockCallbacks.onFlip).toHaveBeenCalledWith('next');
    });

    it('should not call onFlip when busy', () => {
      mockCallbacks.isBusy.mockReturnValue(true);
      controller._bindNavigationButtons(elements);

      const handler = registeredListeners.find(
        (l) => l.element === elements.nextBtn
      ).handler;
      handler();

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });

    it('should bind click handler to prevBtn', () => {
      controller._bindNavigationButtons(elements);

      const call = registeredListeners.find(
        (l) => l.element === elements.prevBtn && l.event === 'click'
      );
      expect(call).toBeDefined();
    });

    it('should call onFlip with PREV when prevBtn clicked', () => {
      controller._bindNavigationButtons(elements);

      const handler = registeredListeners.find(
        (l) => l.element === elements.prevBtn
      ).handler;
      handler();

      expect(mockCallbacks.onFlip).toHaveBeenCalledWith('prev');
    });

    it('should bind click handler to tocBtn', () => {
      controller._bindNavigationButtons(elements);

      const call = registeredListeners.find(
        (l) => l.element === elements.tocBtn && l.event === 'click'
      );
      expect(call).toBeDefined();
    });

    it('should call onTOCClick when tocBtn clicked', () => {
      controller._bindNavigationButtons(elements);

      const handler = registeredListeners.find(
        (l) => l.element === elements.tocBtn
      ).handler;
      handler();

      expect(mockCallbacks.onTOCClick).toHaveBeenCalled();
    });

    it('should bind click handler to continueBtn', () => {
      controller._bindNavigationButtons(elements);

      const call = registeredListeners.find(
        (l) => l.element === elements.continueBtn && l.event === 'click'
      );
      expect(call).toBeDefined();
    });

    it('should call onOpen(true) when continueBtn clicked', () => {
      controller._bindNavigationButtons(elements);

      const handler = registeredListeners.find(
        (l) => l.element === elements.continueBtn
      ).handler;
      handler();

      expect(mockCallbacks.onOpen).toHaveBeenCalledWith(true);
    });

    it('should hide continueBtn after click', () => {
      controller._bindNavigationButtons(elements);

      const handler = registeredListeners.find(
        (l) => l.element === elements.continueBtn
      ).handler;
      handler();

      expect(elements.continueBtn.hidden).toBe(true);
    });

    it('should bind click handler to coverEl', () => {
      controller._bindNavigationButtons(elements);

      const call = registeredListeners.find(
        (l) => l.element === elements.coverEl && l.event === 'click'
      );
      expect(call).toBeDefined();
    });

    it('should call onFlip(NEXT) when cover clicked and book is closed', () => {
      mockCallbacks.isOpened.mockReturnValue(false);
      controller._bindNavigationButtons(elements);

      const handler = registeredListeners.find(
        (l) => l.element === elements.coverEl
      ).handler;
      handler();

      expect(mockCallbacks.onFlip).toHaveBeenCalledWith('next');
    });

    it('should not call onFlip when cover clicked and book is opened', () => {
      mockCallbacks.isOpened.mockReturnValue(true);
      controller._bindNavigationButtons(elements);

      const handler = registeredListeners.find(
        (l) => l.element === elements.coverEl
      ).handler;
      handler();

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });

    it('should handle missing elements gracefully', () => {
      expect(() => controller._bindNavigationButtons({})).not.toThrow();
    });
  });

  describe('_bindBookInteractions', () => {
    beforeEach(() => {
      mockMediaQueries.isMobile = false;
    });

    it('should bind click handler for TOC navigation', () => {
      controller._bindBookInteractions();

      const call = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'click'
      );
      expect(call).toBeDefined();
    });

    it('should call onTOCClick when TOC item clicked', () => {
      controller._bindBookInteractions();

      // Create TOC structure
      const toc = document.createElement('ul');
      toc.className = 'toc';
      const li = document.createElement('li');
      li.dataset.chapter = '2';
      toc.appendChild(li);
      mockBook.appendChild(toc);

      const clickHandler = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'click'
      ).handler;

      const event = {
        target: li,
        preventDefault: vi.fn(),
      };
      clickHandler(event);

      expect(mockCallbacks.onTOCClick).toHaveBeenCalledWith(2);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not call onTOCClick when clicking outside TOC', () => {
      controller._bindBookInteractions();

      const clickHandler = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'click'
      ).handler;

      const event = {
        target: mockBook,
        preventDefault: vi.fn(),
      };
      clickHandler(event);

      expect(mockCallbacks.onTOCClick).not.toHaveBeenCalled();
    });

    it('should bind keydown handler for TOC keyboard navigation', () => {
      controller._bindBookInteractions();

      const call = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'keydown'
      );
      expect(call).toBeDefined();
    });

    it('should handle Enter key on TOC item', () => {
      controller._bindBookInteractions();

      const toc = document.createElement('ul');
      toc.className = 'toc';
      const li = document.createElement('li');
      li.dataset.chapter = '1';
      toc.appendChild(li);
      mockBook.appendChild(toc);

      const keyHandler = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'keydown'
      ).handler;

      const event = {
        key: 'Enter',
        target: li,
        preventDefault: vi.fn(),
      };
      keyHandler(event);

      expect(mockCallbacks.onTOCClick).toHaveBeenCalledWith(1);
    });

    it('should handle Space key on TOC item', () => {
      controller._bindBookInteractions();

      const toc = document.createElement('ul');
      toc.className = 'toc';
      const li = document.createElement('li');
      li.dataset.chapter = '3';
      toc.appendChild(li);
      mockBook.appendChild(toc);

      const keyHandler = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'keydown'
      ).handler;

      const event = {
        key: ' ',
        target: li,
        preventDefault: vi.fn(),
      };
      keyHandler(event);

      expect(mockCallbacks.onTOCClick).toHaveBeenCalledWith(3);
    });

    describe('desktop mode', () => {
      beforeEach(() => {
        mockMediaQueries.isMobile = false;
      });

      it('should bind pointerdown handler on desktop', () => {
        controller._bindBookInteractions();

        const call = registeredListeners.find(
          (l) => l.element === mockBook && l.event === 'pointerdown'
        );
        expect(call).toBeDefined();
      });

      it('should call onFlip(PREV) when clicking left half', () => {
        controller._bindBookInteractions();

        const pointerHandler = registeredListeners.find(
          (l) => l.element === mockBook && l.event === 'pointerdown'
        ).handler;

        // Click on left half (x = 100, book width = 800)
        const event = {
          clientX: 100,
          target: mockBook,
        };
        pointerHandler(event);

        expect(mockCallbacks.onFlip).toHaveBeenCalledWith('prev');
      });

      it('should call onFlip(NEXT) when clicking right half', () => {
        controller._bindBookInteractions();

        const pointerHandler = registeredListeners.find(
          (l) => l.element === mockBook && l.event === 'pointerdown'
        ).handler;

        // Click on right half (x = 600, book width = 800)
        const event = {
          clientX: 600,
          target: mockBook,
        };
        pointerHandler(event);

        expect(mockCallbacks.onFlip).toHaveBeenCalledWith('next');
      });

      it('should not flip when clicking on TOC', () => {
        controller._bindBookInteractions();

        const toc = document.createElement('div');
        toc.className = 'toc';
        mockBook.appendChild(toc);

        const pointerHandler = registeredListeners.find(
          (l) => l.element === mockBook && l.event === 'pointerdown'
        ).handler;

        const event = {
          clientX: 100,
          target: toc,
        };
        pointerHandler(event);

        expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
      });

      it('should not flip when clicking on corner zone', () => {
        controller._bindBookInteractions();

        const cornerZone = document.createElement('div');
        cornerZone.className = 'corner-zone';
        mockBook.appendChild(cornerZone);

        const pointerHandler = registeredListeners.find(
          (l) => l.element === mockBook && l.event === 'pointerdown'
        ).handler;

        const event = {
          clientX: 100,
          target: cornerZone,
        };
        pointerHandler(event);

        expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
      });

      it('should not flip when busy', () => {
        mockCallbacks.isBusy.mockReturnValue(true);
        controller._bindBookInteractions();

        const pointerHandler = registeredListeners.find(
          (l) => l.element === mockBook && l.event === 'pointerdown'
        ).handler;

        const event = {
          clientX: 600,
          target: mockBook,
        };
        pointerHandler(event);

        expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
      });

      it('should not flip when book is not opened', () => {
        mockCallbacks.isOpened.mockReturnValue(false);
        controller._bindBookInteractions();

        const pointerHandler = registeredListeners.find(
          (l) => l.element === mockBook && l.event === 'pointerdown'
        ).handler;

        const event = {
          clientX: 600,
          target: mockBook,
        };
        pointerHandler(event);

        expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
      });
    });

    describe('mobile mode', () => {
      beforeEach(() => {
        mockMediaQueries.isMobile = true;
      });

      it('should not bind pointerdown handler on mobile', () => {
        controller._bindBookInteractions();

        const call = registeredListeners.find(
          (l) => l.element === mockBook && l.event === 'pointerdown'
        );
        expect(call).toBeUndefined();
      });
    });
  });

  describe('bindSettingsControls', () => {
    let elements;

    beforeEach(() => {
      elements = {
        increaseBtn: document.createElement('button'),
        decreaseBtn: document.createElement('button'),
        fontSizeValue: document.createElement('span'),
        fontSelect: document.createElement('select'),
        themeSegmented: document.createElement('div'),
        debugToggle: document.createElement('button'),
        soundToggle: document.createElement('input'),
        volumeSlider: document.createElement('input'),
        pageVolumeControl: document.createElement('div'),
        ambientPills: document.createElement('div'),
        ambientVolume: document.createElement('input'),
        ambientVolumeWrapper: document.createElement('div'),
        fullscreenBtn: document.createElement('button'),
        settingsCheckbox: document.createElement('input'),
      };

      elements.soundToggle.type = 'checkbox';
      elements.settingsCheckbox.type = 'checkbox';
      elements.volumeSlider.type = 'range';
      elements.volumeSlider.value = '50';
      elements.ambientVolume.type = 'range';
      elements.ambientVolume.value = '50';
      elements.fontSizeValue.textContent = '18';

      // Wrap settings checkbox in controls
      const controls = document.createElement('div');
      controls.className = 'controls';
      controls.appendChild(elements.settingsCheckbox);
      document.body.appendChild(controls);
    });

    it('should bind click handler to increaseBtn', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const call = registeredListeners.find(
        (l) => l.element === elements.increaseBtn && l.event === 'click'
      );
      expect(call).toBeDefined();
    });

    it('should call onSettings with fontSize increase when increaseBtn clicked', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.increaseBtn
      ).handler;
      handler();

      expect(mockCallbacks.onSettings).toHaveBeenCalledWith('fontSize', 'increase');
    });

    it('должен обновить отображение размера шрифта при клике на increase', () => {
      // Симулируем: onSettings изменяет настройки, getFontSize возвращает новое значение
      let currentFontSize = 18;
      mockCallbacks.getFontSize.mockImplementation(() => currentFontSize);
      mockCallbacks.onSettings.mockImplementation((key, value) => {
        if (key === 'fontSize' && value === 'increase') {
          currentFontSize = Math.min(currentFontSize + 1, 22);
        }
      });

      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.increaseBtn
      ).handler;
      handler();

      expect(elements.fontSizeValue.textContent).toBe('19');
    });

    it('не должен превышать максимальный размер шрифта', () => {
      // Симулируем: fontSize уже на максимуме, onSettings не изменяет значение
      let currentFontSize = 22;
      mockCallbacks.getFontSize.mockImplementation(() => currentFontSize);
      mockCallbacks.onSettings.mockImplementation((key, value) => {
        if (key === 'fontSize' && value === 'increase') {
          currentFontSize = Math.min(currentFontSize + 1, 22);
        }
      });

      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.increaseBtn
      ).handler;
      handler();

      expect(elements.fontSizeValue.textContent).toBe('22');
    });

    it('should call onSettings with fontSize decrease when decreaseBtn clicked', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.decreaseBtn
      ).handler;
      handler();

      expect(mockCallbacks.onSettings).toHaveBeenCalledWith('fontSize', 'decrease');
    });

    it('не должен опускаться ниже минимального размера шрифта', () => {
      // Симулируем: fontSize уже на минимуме, onSettings не изменяет значение
      let currentFontSize = 14;
      mockCallbacks.getFontSize.mockImplementation(() => currentFontSize);
      mockCallbacks.onSettings.mockImplementation((key, value) => {
        if (key === 'fontSize' && value === 'decrease') {
          currentFontSize = Math.max(currentFontSize - 1, 14);
        }
      });

      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.decreaseBtn
      ).handler;
      handler();

      expect(elements.fontSizeValue.textContent).toBe('14');
    });

    it('should bind change handler to fontSelect', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const call = registeredListeners.find(
        (l) => l.element === elements.fontSelect && l.event === 'change'
      );
      expect(call).toBeDefined();
    });

    it('should call onSettings with font value when fontSelect changed', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.fontSelect
      ).handler;

      handler({ target: { value: 'merriweather' } });

      expect(mockCallbacks.onSettings).toHaveBeenCalledWith('font', 'merriweather');
    });

    it('should bind click handler to themeSegmented', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const call = registeredListeners.find(
        (l) => l.element === elements.themeSegmented && l.event === 'click'
      );
      expect(call).toBeDefined();
    });

    it('should call onSettings with theme when theme segment clicked', () => {
      // Create theme segments
      const segment = document.createElement('div');
      segment.className = 'theme-segment';
      segment.dataset.theme = 'dark';
      elements.themeSegmented.appendChild(segment);

      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.themeSegmented
      ).handler;

      handler({ target: segment });

      expect(mockCallbacks.onSettings).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should update all theme segments state when one is clicked', () => {
      const segment1 = document.createElement('div');
      segment1.className = 'theme-segment';
      segment1.dataset.theme = 'light';

      const segment2 = document.createElement('div');
      segment2.className = 'theme-segment';
      segment2.dataset.theme = 'dark';

      elements.themeSegmented.appendChild(segment1);
      elements.themeSegmented.appendChild(segment2);

      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.themeSegmented
      ).handler;

      handler({ target: segment2 });

      expect(segment1.dataset.active).toBe('false');
      expect(segment2.dataset.active).toBe('true');
      expect(segment1.getAttribute('aria-checked')).toBe('false');
      expect(segment2.getAttribute('aria-checked')).toBe('true');
    });

    it('should bind click handler to debugToggle', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const call = registeredListeners.find(
        (l) => l.element === elements.debugToggle && l.event === 'click'
      );
      expect(call).toBeDefined();
    });

    it('should call onSettings with debug toggle when debugToggle clicked', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.debugToggle
      ).handler;
      handler();

      expect(mockCallbacks.onSettings).toHaveBeenCalledWith('debug', 'toggle');
    });

    it('should bind change handler to soundToggle', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const call = registeredListeners.find(
        (l) => l.element === elements.soundToggle && l.event === 'change'
      );
      expect(call).toBeDefined();
    });

    it('should call onSettings with soundEnabled when soundToggle changed', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.soundToggle
      ).handler;

      handler({ target: { checked: false } });

      expect(mockCallbacks.onSettings).toHaveBeenCalledWith('soundEnabled', false);
    });

    // Volume control disabled state теперь управляется через CSS :has()
    // JS больше не переключает .disabled класс на pageVolumeControl

    it('should bind input handler to volumeSlider', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const call = registeredListeners.find(
        (l) => l.element === elements.volumeSlider && l.event === 'input'
      );
      expect(call).toBeDefined();
    });

    it('should call onSettings with normalized volume value', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.volumeSlider
      ).handler;

      handler({ target: { value: '50' } });

      expect(mockCallbacks.onSettings).toHaveBeenCalledWith('soundVolume', 0.5);
    });

    it('should bind click handler to ambientPills', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const call = registeredListeners.find(
        (l) => l.element === elements.ambientPills && l.event === 'click'
      );
      expect(call).toBeDefined();
    });

    it('should call onSettings with ambient type when pill clicked', () => {
      const pill = document.createElement('div');
      pill.className = 'ambient-pill';
      pill.dataset.type = 'rain';
      elements.ambientPills.appendChild(pill);

      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.ambientPills
      ).handler;

      handler({ target: pill });

      expect(mockCallbacks.onSettings).toHaveBeenCalledWith('ambientType', 'rain');
    });

    it('should show ambient volume wrapper when ambient type is not none', () => {
      const pill = document.createElement('div');
      pill.className = 'ambient-pill';
      pill.dataset.type = 'fireplace';
      elements.ambientPills.appendChild(pill);

      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.ambientPills
      ).handler;

      handler({ target: pill });

      expect(elements.ambientVolumeWrapper.classList.contains('visible')).toBe(true);
    });

    it('should hide ambient volume wrapper when ambient type is none', () => {
      const pill = document.createElement('div');
      pill.className = 'ambient-pill';
      pill.dataset.type = 'none';
      elements.ambientPills.appendChild(pill);
      elements.ambientVolumeWrapper.classList.add('visible');

      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.ambientPills
      ).handler;

      handler({ target: pill });

      expect(elements.ambientVolumeWrapper.classList.contains('visible')).toBe(false);
    });

    it('should bind input handler to ambientVolume', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const call = registeredListeners.find(
        (l) => l.element === elements.ambientVolume && l.event === 'input'
      );
      expect(call).toBeDefined();
    });

    it('should call onSettings with normalized ambient volume', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.ambientVolume
      ).handler;

      handler({ target: { value: '75' } });

      expect(mockCallbacks.onSettings).toHaveBeenCalledWith('ambientVolume', 0.75);
    });

    it('should bind click handler to fullscreenBtn', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const call = registeredListeners.find(
        (l) => l.element === elements.fullscreenBtn && l.event === 'click'
      );
      expect(call).toBeDefined();
    });

    it('should call onSettings with fullscreen toggle when fullscreenBtn clicked', () => {
      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.fullscreenBtn
      ).handler;
      handler();

      expect(mockCallbacks.onSettings).toHaveBeenCalledWith('fullscreen', 'toggle');
    });

    // Settings toggle теперь управляется чисто через CSS :has(.settings-checkbox:checked)
    // JS больше не устанавливает data-settings-open атрибут

    it('should handle missing elements gracefully', () => {
      expect(() => bindSettingsControls({}, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize)).not.toThrow();
    });
  });

  describe('_bindKeyboard', () => {
    beforeEach(() => {
      controller._bindKeyboard();
    });

    it('should register keydown handler on document', () => {
      const call = registeredListeners.find(
        (l) => l.element === document && l.event === 'keydown'
      );
      expect(call).toBeDefined();
    });

    it('should store keydown handler in _boundHandlers', () => {
      expect(controller._boundHandlers.keydown).toBeDefined();
    });

    it('should call onFlip(PREV) on ArrowLeft', () => {
      const handler = controller._boundHandlers.keydown;
      const event = {
        key: 'ArrowLeft',
        target: { tagName: 'DIV' },
        preventDefault: vi.fn(),
      };

      handler(event);

      expect(mockCallbacks.onFlip).toHaveBeenCalledWith('prev');
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should call onFlip(NEXT) on ArrowRight', () => {
      const handler = controller._boundHandlers.keydown;
      const event = {
        key: 'ArrowRight',
        target: { tagName: 'DIV' },
        preventDefault: vi.fn(),
      };

      handler(event);

      expect(mockCallbacks.onFlip).toHaveBeenCalledWith('next');
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should call onTOCClick(0) on Home when opened', () => {
      mockCallbacks.isOpened.mockReturnValue(true);

      const handler = controller._boundHandlers.keydown;
      const event = {
        key: 'Home',
        target: { tagName: 'DIV' },
        preventDefault: vi.fn(),
      };

      handler(event);

      expect(mockCallbacks.onTOCClick).toHaveBeenCalledWith(0);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not call onTOCClick on Home when not opened', () => {
      mockCallbacks.isOpened.mockReturnValue(false);

      const handler = controller._boundHandlers.keydown;
      const event = {
        key: 'Home',
        target: { tagName: 'DIV' },
        preventDefault: vi.fn(),
      };

      handler(event);

      expect(mockCallbacks.onTOCClick).not.toHaveBeenCalled();
    });

    it('should call onTOCClick(-1) on End when opened', () => {
      mockCallbacks.isOpened.mockReturnValue(true);

      const handler = controller._boundHandlers.keydown;
      const event = {
        key: 'End',
        target: { tagName: 'DIV' },
        preventDefault: vi.fn(),
      };

      handler(event);

      expect(mockCallbacks.onTOCClick).toHaveBeenCalledWith(-1);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should toggle debug on Ctrl+D', () => {
      const handler = controller._boundHandlers.keydown;
      const event = {
        key: 'd',
        ctrlKey: true,
        target: { tagName: 'DIV' },
        preventDefault: vi.fn(),
      };

      handler(event);

      expect(mockCallbacks.onSettings).toHaveBeenCalledWith('debug', 'toggle');
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not toggle debug on D without Ctrl', () => {
      const handler = controller._boundHandlers.keydown;
      const event = {
        key: 'd',
        ctrlKey: false,
        target: { tagName: 'DIV' },
        preventDefault: vi.fn(),
      };

      handler(event);

      expect(mockCallbacks.onSettings).not.toHaveBeenCalled();
    });

    it('should not handle keys when busy', () => {
      mockCallbacks.isBusy.mockReturnValue(true);

      const handler = controller._boundHandlers.keydown;
      const event = {
        key: 'ArrowRight',
        target: { tagName: 'DIV' },
        preventDefault: vi.fn(),
      };

      handler(event);

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });

    it('should not handle keys when focus is on INPUT', () => {
      const handler = controller._boundHandlers.keydown;
      const event = {
        key: 'ArrowRight',
        target: { tagName: 'INPUT' },
        preventDefault: vi.fn(),
      };

      handler(event);

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });

    it('should not handle keys when focus is on SELECT', () => {
      const handler = controller._boundHandlers.keydown;
      const event = {
        key: 'ArrowRight',
        target: { tagName: 'SELECT' },
        preventDefault: vi.fn(),
      };

      handler(event);

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });

    it('should not handle keys when focus is on TEXTAREA', () => {
      const handler = controller._boundHandlers.keydown;
      const event = {
        key: 'ArrowRight',
        target: { tagName: 'TEXTAREA' },
        preventDefault: vi.fn(),
      };

      handler(event);

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });
  });

  describe('_bindTouch', () => {
    beforeEach(() => {
      controller._bindTouch();
    });

    it('should register touchstart handler on book', () => {
      const call = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'touchstart'
      );
      expect(call).toBeDefined();
      expect(call.options).toEqual({ passive: true });
    });

    it('should register touchend handler on book', () => {
      const call = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'touchend'
      );
      expect(call).toBeDefined();
    });

    it('should store touch coordinates on touchstart', () => {
      const touchstartHandler = controller._boundHandlers.touchstart;

      const event = {
        touches: [{ clientX: 100, clientY: 200 }],
        target: mockBook,
      };
      touchstartHandler(event);

      expect(controller.touchStartX).toBe(100);
      expect(controller.touchStartY).toBe(200);
    });

    it('should not store coordinates when busy', () => {
      mockCallbacks.isBusy.mockReturnValue(true);
      const touchstartHandler = controller._boundHandlers.touchstart;

      const event = {
        touches: [{ clientX: 100, clientY: 200 }],
        target: mockBook,
      };
      touchstartHandler(event);

      expect(controller.touchStartX).toBe(0);
      expect(controller.touchStartY).toBe(0);
    });

    it('should not store coordinates when touching corner zone', () => {
      const cornerZone = document.createElement('div');
      cornerZone.className = 'corner-zone';
      mockBook.appendChild(cornerZone);

      const touchstartHandler = controller._boundHandlers.touchstart;

      const event = {
        touches: [{ clientX: 100, clientY: 200 }],
        target: cornerZone,
      };
      touchstartHandler(event);

      expect(controller.touchStartX).toBe(0);
      expect(controller.touchStartY).toBe(0);
    });

    it('should call onFlip(NEXT) on left swipe', () => {
      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      // Start touch at x=200
      touchstartHandler({
        touches: [{ clientX: 200, clientY: 100 }],
        target: mockBook,
      });

      // End touch at x=100 (swipe left, dx = -100)
      touchendHandler({
        changedTouches: [{ clientX: 100, clientY: 100 }],
        target: mockBook,
      });

      expect(mockCallbacks.onFlip).toHaveBeenCalledWith('next');
    });

    it('should call onFlip(PREV) on right swipe', () => {
      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      // Start touch at x=100
      touchstartHandler({
        touches: [{ clientX: 100, clientY: 100 }],
        target: mockBook,
      });

      // End touch at x=200 (swipe right, dx = 100)
      touchendHandler({
        changedTouches: [{ clientX: 200, clientY: 100 }],
        target: mockBook,
      });

      expect(mockCallbacks.onFlip).toHaveBeenCalledWith('prev');
    });

    it('should not flip on swipe below threshold', () => {
      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      // Start touch at x=100
      touchstartHandler({
        touches: [{ clientX: 100, clientY: 100 }],
        target: mockBook,
      });

      // End touch at x=110 (dx = 10, below threshold of 20)
      touchendHandler({
        changedTouches: [{ clientX: 110, clientY: 100 }],
        target: mockBook,
      });

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });

    it('should not flip on vertical swipe exceeding limit', () => {
      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      // Start touch at y=100
      touchstartHandler({
        touches: [{ clientX: 100, clientY: 100 }],
        target: mockBook,
      });

      // End touch at y=150 (dy = 50, exceeds limit of 30)
      touchendHandler({
        changedTouches: [{ clientX: 200, clientY: 150 }],
        target: mockBook,
      });

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });

    it('should not flip when busy on touchend', () => {
      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      touchstartHandler({
        touches: [{ clientX: 200, clientY: 100 }],
        target: mockBook,
      });

      mockCallbacks.isBusy.mockReturnValue(true);

      touchendHandler({
        changedTouches: [{ clientX: 100, clientY: 100 }],
        target: mockBook,
      });

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });

    it('should not flip when touchend is on corner zone', () => {
      const cornerZone = document.createElement('div');
      cornerZone.className = 'corner-zone';
      mockBook.appendChild(cornerZone);

      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      touchstartHandler({
        touches: [{ clientX: 200, clientY: 100 }],
        target: mockBook,
      });

      touchendHandler({
        changedTouches: [{ clientX: 100, clientY: 100 }],
        target: cornerZone,
      });

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });
  });

  describe('updateFontSizeDisplay (via bindSettingsControls)', () => {
    it('должен обновлять текст элемента текущим значением из настроек', () => {
      const elements = {
        increaseBtn: document.createElement('button'),
        fontSizeValue: document.createElement('span'),
      };
      elements.fontSizeValue.textContent = '18';
      mockCallbacks.getFontSize.mockReturnValue(19);

      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.increaseBtn
      ).handler;
      handler();

      expect(elements.fontSizeValue.textContent).toBe('19');
    });

    it('должен корректно обрабатывать null fontSizeValue', () => {
      const elements = {
        increaseBtn: document.createElement('button'),
        fontSizeValue: null,
      };

      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.increaseBtn
      ).handler;
      expect(() => handler()).not.toThrow();
    });

    it('должен использовать getFontSize как источник правды', () => {
      const elements = {
        increaseBtn: document.createElement('button'),
        fontSizeValue: document.createElement('span'),
      };
      elements.fontSizeValue.textContent = '20';
      mockCallbacks.getFontSize.mockReturnValue(18);

      bindSettingsControls(elements, mockEventManager, mockCallbacks.onSettings, mockCallbacks.getFontSize);

      const handler = registeredListeners.find(
        (l) => l.element === elements.increaseBtn
      ).handler;
      handler();

      expect(elements.fontSizeValue.textContent).toBe('18');
    });
  });

  describe('destroy', () => {
    it('should clear bound handlers', () => {
      controller._bindKeyboard();
      controller._bindTouch();

      expect(Object.keys(controller._boundHandlers).length).toBeGreaterThan(0);

      controller.destroy();

      expect(controller._boundHandlers).toEqual({});
    });
  });
});

describe('EventController edge cases', () => {
  let controller;
  let mockBook;
  let mockEventManager;

  beforeEach(() => {
    mockBook = createSizedElement(800, 600);
    document.body.appendChild(mockBook);

    mockEventManager = {
      add: vi.fn(),
      remove: vi.fn(),
    };

    controller = new EventController({
      book: mockBook,
      eventManager: mockEventManager,
      onFlip: vi.fn(),
      onTOCClick: vi.fn(),
      onOpen: vi.fn(),
      onSettings: vi.fn(),
      isBusy: vi.fn(() => false),
      isOpened: vi.fn(() => true),
    });
  });

  afterEach(() => {
    controller?.destroy();
    document.body.innerHTML = '';
  });

  // Fullscreen button state теперь управляется через CSS :fullscreen псевдокласс
  // JS больше не переключает .is-fullscreen класс

  it('should handle click on non-TOC element inside book', () => {
    const registeredListeners = [];
    mockEventManager.add = vi.fn((el, event, handler) => {
      registeredListeners.push({ el, event, handler });
    });

    controller._bindBookInteractions();

    const clickHandler = registeredListeners.find(
      (l) => l.el === mockBook && l.event === 'click'
    ).handler;

    const randomElement = document.createElement('div');
    mockBook.appendChild(randomElement);

    const event = {
      target: randomElement,
      preventDefault: vi.fn(),
    };

    clickHandler(event);

    // Should not call onTOCClick or preventDefault
    expect(controller.onTOCClick).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SPEC-BASED: EventController — additional coverage (spec-based)
// ═══════════════════════════════════════════════════════════════════════════

describe('EventController spec-based', () => {
  let controller;
  let mockBook;
  let mockEventManager;
  let mockCallbacks;
  let registeredListeners;

  beforeEach(() => {
    vi.useFakeTimers();
    registeredListeners = [];

    mockBook = createSizedElement(800, 600);
    mockBook.className = 'book';
    document.body.appendChild(mockBook);

    mockEventManager = {
      add: vi.fn((element, event, handler, options) => {
        registeredListeners.push({ element, event, handler, options });
      }),
      remove: vi.fn(),
      removeAll: vi.fn(),
    };

    mockCallbacks = {
      onFlip: vi.fn(),
      onTOCClick: vi.fn(),
      onOpen: vi.fn(),
      onSettings: vi.fn(),
      isBusy: vi.fn(() => false),
      isOpened: vi.fn(() => true),
      getFontSize: vi.fn(() => 18),
    };

    controller = new EventController({
      book: mockBook,
      eventManager: mockEventManager,
      ...mockCallbacks,
    });
  });

  afterEach(() => {
    controller?.destroy();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockMediaQueries.isMobile = false;
  });

  // ── continueBtn busy guard ──

  describe('continueBtn busy guard (spec-based)', () => {
    it('should not call onOpen when busy and continueBtn clicked', () => {
      const elements = {
        continueBtn: document.createElement('button'),
      };

      mockCallbacks.isBusy.mockReturnValue(true);
      controller._bindNavigationButtons(elements);

      const handler = registeredListeners.find(
        (l) => l.element === elements.continueBtn
      ).handler;
      handler();

      expect(mockCallbacks.onOpen).not.toHaveBeenCalled();
    });
  });

  // ── keyboard: non-Enter/Space keys on TOC ──

  describe('keyboard on TOC — only Enter and Space (spec-based)', () => {
    it('should not navigate on Tab key on TOC item', () => {
      controller._bindBookInteractions();

      const toc = document.createElement('ul');
      toc.className = 'toc';
      const li = document.createElement('li');
      li.dataset.chapter = '1';
      toc.appendChild(li);
      mockBook.appendChild(toc);

      const keyHandler = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'keydown'
      ).handler;

      const event = {
        key: 'Tab',
        target: li,
        preventDefault: vi.fn(),
      };
      keyHandler(event);

      expect(mockCallbacks.onTOCClick).not.toHaveBeenCalled();
    });

    it('should not navigate on keydown when target has no data-chapter', () => {
      controller._bindBookInteractions();

      const toc = document.createElement('ul');
      toc.className = 'toc';
      const div = document.createElement('div');
      toc.appendChild(div);
      mockBook.appendChild(toc);

      const keyHandler = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'keydown'
      ).handler;

      const event = {
        key: 'Enter',
        target: div,
        preventDefault: vi.fn(),
      };
      keyHandler(event);

      expect(mockCallbacks.onTOCClick).not.toHaveBeenCalled();
    });
  });

  // ── photo-album exclusion on desktop click ──

  describe('desktop click — photo-album exclusion (spec-based)', () => {
    beforeEach(() => {
      mockMediaQueries.isMobile = false;
    });

    it('should not flip when clicking on photo-album item', () => {
      controller._bindBookInteractions();

      const albumItem = document.createElement('div');
      albumItem.className = 'photo-album__item';
      mockBook.appendChild(albumItem);

      const pointerHandler = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'pointerdown'
      ).handler;

      const event = { clientX: 600, target: albumItem };
      pointerHandler(event);

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });
  });

  // ── desktop click direction: exact middle ──

  describe('desktop click — direction at exact middle (spec-based)', () => {
    beforeEach(() => {
      mockMediaQueries.isMobile = false;
    });

    it('should use clientX relative to book rect for direction', () => {
      // Книга позиционирована не с x=0
      vi.spyOn(mockBook, 'getBoundingClientRect').mockReturnValue({
        left: 200,
        right: 1000,
        width: 800,
        top: 0,
        bottom: 600,
        height: 600,
      });

      controller._bindBookInteractions();

      const pointerHandler = registeredListeners.find(
        (l) => l.element === mockBook && l.event === 'pointerdown'
      ).handler;

      // clientX=300, rect.left=200 → x=100, width=800, half=400 → 100<400 → PREV
      pointerHandler({ clientX: 300, target: mockBook });
      expect(mockCallbacks.onFlip).toHaveBeenCalledWith('prev');

      mockCallbacks.onFlip.mockClear();

      // clientX=700, rect.left=200 → x=500, width=800, half=400 → 500>=400 → NEXT
      pointerHandler({ clientX: 700, target: mockBook });
      expect(mockCallbacks.onFlip).toHaveBeenCalledWith('next');
    });
  });

  // ── touch: swipe threshold boundaries ──

  describe('touch — swipe threshold boundaries (spec-based)', () => {
    beforeEach(() => {
      controller._bindTouch();
    });

    it('should flip on swipe exactly at threshold', () => {
      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      // threshold = 20 (from mock)
      touchstartHandler({
        touches: [{ clientX: 100, clientY: 100 }],
        target: mockBook,
      });

      // dx = -20, exactly at threshold
      touchendHandler({
        changedTouches: [{ clientX: 80, clientY: 100 }],
        target: mockBook,
      });

      // abs(dx)=20, threshold=20 → 20 < 20 is false → should flip
      expect(mockCallbacks.onFlip).toHaveBeenCalledWith('next');
    });

    it('should NOT flip on swipe just below threshold', () => {
      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      touchstartHandler({
        touches: [{ clientX: 100, clientY: 100 }],
        target: mockBook,
      });

      // dx = -19, below threshold
      touchendHandler({
        changedTouches: [{ clientX: 81, clientY: 100 }],
        target: mockBook,
      });

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });

    it('should flip when vertical movement exactly equals limit', () => {
      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      // verticalLimit = 30 (from mock)
      touchstartHandler({
        touches: [{ clientX: 200, clientY: 100 }],
        target: mockBook,
      });

      // dx = -100 (good swipe), dy = 30 (exactly at limit)
      touchendHandler({
        changedTouches: [{ clientX: 100, clientY: 130 }],
        target: mockBook,
      });

      // abs(dy)=30 > 30 is false → passes vertical check → flip happens
      expect(mockCallbacks.onFlip).toHaveBeenCalledWith('next');
    });

    it('should NOT flip when vertical exceeds limit by 1', () => {
      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      touchstartHandler({
        touches: [{ clientX: 200, clientY: 100 }],
        target: mockBook,
      });

      // dx = -100, dy = 31 (exceeds limit)
      touchendHandler({
        changedTouches: [{ clientX: 100, clientY: 131 }],
        target: mockBook,
      });

      expect(mockCallbacks.onFlip).not.toHaveBeenCalled();
    });
  });

  // ── CSS variable names used for swipe config ──

  describe('swipe config reads CSS variables (spec-based)', () => {
    it('should read --swipe-threshold from cssVars on swipe', () => {
      controller._bindTouch();
      mockCssVars.getNumber.mockClear();

      // Trigger a swipe to cause CSS vars to be read
      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      touchstartHandler({
        touches: [{ clientX: 200, clientY: 100 }],
        target: mockBook,
      });
      touchendHandler({
        changedTouches: [{ clientX: 100, clientY: 100 }],
        target: mockBook,
      });

      const thresholdCall = mockCssVars.getNumber.mock.calls.find(
        (c) => c[0] === '--swipe-threshold'
      );
      expect(thresholdCall).toBeDefined();
    });

    it('should read --swipe-vertical-limit from cssVars on swipe', () => {
      controller._bindTouch();
      mockCssVars.getNumber.mockClear();

      const touchstartHandler = controller._boundHandlers.touchstart;
      const touchendHandler = controller._boundHandlers.touchend;

      touchstartHandler({
        touches: [{ clientX: 200, clientY: 100 }],
        target: mockBook,
      });
      touchendHandler({
        changedTouches: [{ clientX: 100, clientY: 100 }],
        target: mockBook,
      });

      const limitCall = mockCssVars.getNumber.mock.calls.find(
        (c) => c[0] === '--swipe-vertical-limit'
      );
      expect(limitCall).toBeDefined();
    });
  });
});
