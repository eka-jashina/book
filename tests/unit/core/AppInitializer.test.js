/**
 * UNIT TEST: AppInitializer
 * Тестирование процесса инициализации приложения
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock зависимости перед импортом
vi.mock('../../../js/utils/ErrorHandler.js', () => ({
  ErrorHandler: {
    handle: vi.fn(),
  },
}));

vi.mock('../../../js/utils/AmbientManager.js', () => ({
  AmbientManager: {
    TYPE_NONE: 'none',
  },
}));

import { AppInitializer } from '../../../js/core/AppInitializer.js';
import { ErrorHandler } from '../../../js/utils/ErrorHandler.js';

describe('AppInitializer', () => {
  let initializer;
  let mockContext;
  let mockElements;

  beforeEach(() => {
    // Мок document.fonts.ready
    document.fonts = { ready: Promise.resolve() };

    // Добавляем <template> для ambient-pill (используется в _populateAmbientPills)
    if (!document.getElementById('tmpl-ambient-pill')) {
      const tmpl = document.createElement('template');
      tmpl.id = 'tmpl-ambient-pill';
      tmpl.innerHTML = `
        <button type="button" class="ambient-pill" role="radio">
          <span class="ambient-pill-icon"></span>
          <span class="ambient-pill-label"></span>
        </button>
      `;
      document.body.appendChild(tmpl);
    }

    // Создаём реальные DOM-элементы
    mockElements = {
      body: document.createElement('div'),
      continueBtn: document.createElement('button'),
      fontSelect: (() => {
        const select = document.createElement('select');
        const opt = document.createElement('option');
        opt.value = 'georgia';
        select.appendChild(opt);
        return select;
      })(),
      fontSizeValue: document.createElement('span'),
      themeSegmented: (() => {
        const el = document.createElement('div');
        const seg = document.createElement('button');
        seg.className = 'theme-segment';
        seg.dataset.theme = 'light';
        el.appendChild(seg);
        return el;
      })(),
      soundToggle: document.createElement('input'),
      volumeSlider: document.createElement('input'),
      ambientPills: document.createElement('div'),
      ambientVolume: document.createElement('input'),
      ambientVolumeWrapper: document.createElement('div'),
      pageVolumeControl: document.createElement('div'),
    };

    mockContext = {
      dom: {
        get: vi.fn((id) => mockElements[id] || null),
        elements: mockElements,
      },
      settings: {
        get: vi.fn((key) => {
          const defaults = {
            page: 0,
            font: 'georgia',
            fontSize: 18,
            theme: 'light',
            soundEnabled: true,
            soundVolume: 0.3,
            ambientType: 'none',
            ambientVolume: 0.5,
          };
          return defaults[key];
        }),
      },
      settingsDelegate: {
        apply: vi.fn(),
      },
      backgroundManager: {
        setBackground: vi.fn(),
      },
      eventController: {
        bind: vi.fn(),
      },
      dragDelegate: {
        bind: vi.fn(),
      },
      lifecycleDelegate: {
        init: vi.fn().mockResolvedValue(undefined),
      },
    };

    initializer = new AppInitializer(mockContext);
  });

  describe('constructor', () => {
    it('should store all context references', () => {
      expect(initializer.dom).toBe(mockContext.dom);
      expect(initializer.settings).toBe(mockContext.settings);
      expect(initializer.settingsDelegate).toBe(mockContext.settingsDelegate);
      expect(initializer.backgroundManager).toBe(mockContext.backgroundManager);
      expect(initializer.eventController).toBe(mockContext.eventController);
      expect(initializer.dragDelegate).toBe(mockContext.dragDelegate);
      expect(initializer.lifecycleDelegate).toBe(mockContext.lifecycleDelegate);
    });
  });

  describe('initialize', () => {
    it('should apply settings', async () => {
      await initializer.initialize();
      expect(mockContext.settingsDelegate.apply).toHaveBeenCalled();
    });

    it('should set cover background', async () => {
      await initializer.initialize();
      expect(mockContext.backgroundManager.setBackground).toHaveBeenCalled();
    });

    it('should set body chapter to cover', async () => {
      await initializer.initialize();
      expect(mockElements.body.dataset.chapter).toBe('cover');
    });

    it('should bind event controller', async () => {
      await initializer.initialize();
      expect(mockContext.eventController.bind).toHaveBeenCalled();
    });

    it('should bind drag delegate', async () => {
      await initializer.initialize();
      expect(mockContext.dragDelegate.bind).toHaveBeenCalled();
    });

    it('should wait for fonts.ready', async () => {
      let fontsResolved = false;
      document.fonts = {
        ready: new Promise(resolve => {
          setTimeout(() => {
            fontsResolved = true;
            resolve();
          }, 10);
        }),
      };

      await initializer.initialize();
      expect(fontsResolved).toBe(true);
    });

    it('should call lifecycleDelegate.init', async () => {
      await initializer.initialize();
      expect(mockContext.lifecycleDelegate.init).toHaveBeenCalled();
    });

    it('should handle initialization error', async () => {
      const error = new Error('Init failed');
      mockContext.lifecycleDelegate.init.mockRejectedValue(error);

      await expect(initializer.initialize()).rejects.toThrow('Init failed');
      expect(ErrorHandler.handle).toHaveBeenCalledWith(error, 'Ошибка инициализации');
    });
  });

  describe('_setupUI', () => {
    it('should keep continue button hidden when page is 0', async () => {
      mockContext.settings.get = vi.fn((key) => key === 'page' ? 0 : 'georgia');
      mockElements.continueBtn.hidden = true;

      await initializer.initialize();
      expect(mockElements.continueBtn.hidden).toBe(true);
    });

    it('should show continue button when saved page > 0', async () => {
      mockContext.settings.get = vi.fn((key) => {
        if (key === 'page') return 5;
        if (key === 'font') return 'georgia';
        if (key === 'fontSize') return 18;
        if (key === 'theme') return 'light';
        if (key === 'soundEnabled') return true;
        if (key === 'soundVolume') return 0.3;
        if (key === 'ambientType') return 'none';
        if (key === 'ambientVolume') return 0.5;
        return null;
      });
      mockElements.continueBtn.hidden = true;

      await initializer.initialize();
      expect(mockElements.continueBtn.hidden).toBe(false);
    });

    it('should sync font select value', async () => {
      await initializer.initialize();
      expect(mockElements.fontSelect.value).toBe('georgia');
    });

    it('should sync font size display', async () => {
      await initializer.initialize();
      expect(mockElements.fontSizeValue.textContent).toBe('18');
    });

    it('should sync sound toggle', async () => {
      await initializer.initialize();
      expect(mockElements.soundToggle.checked).toBe(true);
    });

    it('should sync volume slider', async () => {
      await initializer.initialize();
      expect(mockElements.volumeSlider.value).toBe('30');
    });

    it('should populate ambient pills from CONFIG', async () => {
      await initializer.initialize();

      const pills = mockElements.ambientPills.querySelectorAll('.ambient-pill');
      expect(pills.length).toBeGreaterThan(0);
    });

    it('should set ARIA attributes on ambient pills', async () => {
      await initializer.initialize();

      const pills = mockElements.ambientPills.querySelectorAll('.ambient-pill');
      pills.forEach(pill => {
        expect(pill.getAttribute('role')).toBe('radio');
        expect(pill.getAttribute('aria-label')).toBeTruthy();
      });
    });

    it('should mark active ambient pill', async () => {
      await initializer.initialize();

      const nonePill = mockElements.ambientPills.querySelector('[data-type="none"]');
      expect(nonePill.dataset.active).toBe('true');
      expect(nonePill.getAttribute('aria-checked')).toBe('true');
    });
  });
});
