import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════
// Тесты для ThemeToggle — кнопка переключения темы
// ═══════════════════════════════════════════

vi.mock('@utils/GlobalThemeManager.js', () => ({
  getGlobalTheme: vi.fn(() => 'light'),
  cycleGlobalTheme: vi.fn(() => 'dark'),
}));

import { ThemeToggle } from '@utils/ThemeToggle.js';
import { getGlobalTheme, cycleGlobalTheme } from '@utils/GlobalThemeManager.js';

describe('ThemeToggle', () => {
  let toggle;

  beforeEach(() => {
    vi.clearAllMocks();
    getGlobalTheme.mockReturnValue('light');
    cycleGlobalTheme.mockReturnValue('dark');
  });

  afterEach(() => {
    if (toggle) {
      toggle.destroy();
      toggle = null;
    }
  });

  // ═══════════════════════════════════════════
  // Конструктор и создание элемента
  // ═══════════════════════════════════════════

  describe('constructor', () => {
    it('создаёт кнопку-элемент', () => {
      toggle = new ThemeToggle({});

      expect(toggle.element).toBeInstanceOf(HTMLButtonElement);
    });

    it('применяет переданный className', () => {
      toggle = new ThemeToggle({ className: 'my-theme-btn' });

      expect(toggle.element.classList.contains('my-theme-btn')).toBe(true);
    });

    it('работает без параметров', () => {
      toggle = new ThemeToggle({});

      expect(toggle.element).toBeTruthy();
    });

    it('вызывает _updateIcon при создании', () => {
      toggle = new ThemeToggle({});

      expect(getGlobalTheme).toHaveBeenCalled();
      expect(toggle.element.dataset.currentTheme).toBe('light');
    });

    it('устанавливает SVG-иконку в innerHTML', () => {
      toggle = new ThemeToggle({});

      expect(toggle.element.innerHTML).toContain('svg');
    });
  });

  // ═══════════════════════════════════════════
  // Геттер element
  // ═══════════════════════════════════════════

  describe('element', () => {
    it('возвращает кнопку', () => {
      toggle = new ThemeToggle({});

      const el = toggle.element;
      expect(el.tagName).toBe('BUTTON');
    });
  });

  // ═══════════════════════════════════════════
  // Обработка клика
  // ═══════════════════════════════════════════

  describe('клик по кнопке', () => {
    it('вызывает cycleGlobalTheme при клике', () => {
      toggle = new ThemeToggle({});

      toggle.element.click();

      expect(cycleGlobalTheme).toHaveBeenCalledTimes(1);
    });

    it('предотвращает стандартное действие и всплытие', () => {
      toggle = new ThemeToggle({});

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      const stopSpy = vi.spyOn(event, 'stopPropagation');

      toggle.element.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // Реакция на событие смены темы
  // ═══════════════════════════════════════════

  describe('flipbook:theme-changed', () => {
    it('обновляет иконку при смене темы через событие', () => {
      toggle = new ThemeToggle({});

      getGlobalTheme.mockReturnValue('dark');

      document.dispatchEvent(new CustomEvent('flipbook:theme-changed'));

      expect(toggle.element.dataset.currentTheme).toBe('dark');
    });

    it('обновляет dataset.currentTheme для каждой темы', () => {
      toggle = new ThemeToggle({});

      // dark
      getGlobalTheme.mockReturnValue('dark');
      document.dispatchEvent(new CustomEvent('flipbook:theme-changed'));
      expect(toggle.element.dataset.currentTheme).toBe('dark');

      // bw
      getGlobalTheme.mockReturnValue('bw');
      document.dispatchEvent(new CustomEvent('flipbook:theme-changed'));
      expect(toggle.element.dataset.currentTheme).toBe('bw');

      // light
      getGlobalTheme.mockReturnValue('light');
      document.dispatchEvent(new CustomEvent('flipbook:theme-changed'));
      expect(toggle.element.dataset.currentTheme).toBe('light');
    });
  });

  // ═══════════════════════════════════════════
  // destroy
  // ═══════════════════════════════════════════

  describe('destroy', () => {
    it('обнуляет ссылку на элемент', () => {
      toggle = new ThemeToggle({});
      toggle.destroy();

      expect(toggle.element).toBeNull();
      toggle = null; // Чтобы afterEach не вызывал destroy повторно
    });

    it('удаляет элемент из DOM', () => {
      toggle = new ThemeToggle({});
      document.body.appendChild(toggle.element);

      toggle.destroy();

      expect(document.body.querySelector('button[data-current-theme]')).toBeNull();
      toggle = null;
    });

    it('перестаёт реагировать на события после destroy', () => {
      toggle = new ThemeToggle({});
      const el = toggle.element;

      toggle.destroy();

      // Событие не должно вызывать ошибок
      expect(() => {
        document.dispatchEvent(new CustomEvent('flipbook:theme-changed'));
      }).not.toThrow();

      toggle = null;
    });
  });
});
