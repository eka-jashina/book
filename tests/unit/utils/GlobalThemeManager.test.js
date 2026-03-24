import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════
// Тесты для GlobalThemeManager — управление глобальной темой
// ═══════════════════════════════════════════

import {
  getGlobalTheme,
  setGlobalTheme,
  applyGlobalTheme,
  getNextTheme,
  cycleGlobalTheme,
} from '@utils/GlobalThemeManager.js';

const STORAGE_KEY = 'flipbook-theme';

describe('GlobalThemeManager', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // getGlobalTheme
  // ═══════════════════════════════════════════

  describe('getGlobalTheme', () => {
    it('возвращает light по умолчанию если ничего не сохранено', () => {
      expect(getGlobalTheme()).toBe('light');
    });

    it('возвращает сохранённую тему из localStorage', () => {
      localStorage.setItem(STORAGE_KEY, 'dark');

      expect(getGlobalTheme()).toBe('dark');
    });

    it('возвращает bw если сохранена тема bw', () => {
      localStorage.setItem(STORAGE_KEY, 'bw');

      expect(getGlobalTheme()).toBe('bw');
    });

    it('возвращает light для невалидного значения', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-theme');

      expect(getGlobalTheme()).toBe('light');
    });

    it('возвращает light при ошибке localStorage', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage disabled');
      });

      expect(getGlobalTheme()).toBe('light');
    });
  });

  // ═══════════════════════════════════════════
  // setGlobalTheme
  // ═══════════════════════════════════════════

  describe('setGlobalTheme', () => {
    it('сохраняет тему dark в localStorage', () => {
      setGlobalTheme('dark');

      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    });

    it('сохраняет тему bw в localStorage', () => {
      setGlobalTheme('bw');

      expect(localStorage.getItem(STORAGE_KEY)).toBe('bw');
    });

    it('удаляет ключ из localStorage для light (значение по умолчанию)', () => {
      localStorage.setItem(STORAGE_KEY, 'dark');

      setGlobalTheme('light');

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('применяет тему к документу', () => {
      setGlobalTheme('dark');

      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('не сохраняет невалидную тему', () => {
      setGlobalTheme('invalid');

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // applyGlobalTheme
  // ═══════════════════════════════════════════

  describe('applyGlobalTheme', () => {
    it('устанавливает data-theme на documentElement', () => {
      applyGlobalTheme('dark');

      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('устанавливает пустую строку для light', () => {
      document.documentElement.dataset.theme = 'dark';

      applyGlobalTheme('light');

      expect(document.documentElement.dataset.theme).toBe('');
    });

    it('диспатчит CustomEvent flipbook:theme-changed', () => {
      const handler = vi.fn();
      document.addEventListener('flipbook:theme-changed', handler);

      applyGlobalTheme('dark');

      expect(handler).toHaveBeenCalledTimes(1);

      document.removeEventListener('flipbook:theme-changed', handler);
    });

    it('читает тему из localStorage если аргумент не передан', () => {
      localStorage.setItem(STORAGE_KEY, 'bw');

      applyGlobalTheme();

      expect(document.documentElement.dataset.theme).toBe('bw');
    });
  });

  // ═══════════════════════════════════════════
  // getNextTheme
  // ═══════════════════════════════════════════

  describe('getNextTheme', () => {
    it('циклирует light → dark', () => {
      expect(getNextTheme()).toBe('dark');
    });

    it('циклирует dark → bw', () => {
      localStorage.setItem(STORAGE_KEY, 'dark');

      expect(getNextTheme()).toBe('bw');
    });

    it('циклирует bw → light', () => {
      localStorage.setItem(STORAGE_KEY, 'bw');

      expect(getNextTheme()).toBe('light');
    });
  });

  // ═══════════════════════════════════════════
  // cycleGlobalTheme
  // ═══════════════════════════════════════════

  describe('cycleGlobalTheme', () => {
    it('переключает тему и возвращает новую', () => {
      const result = cycleGlobalTheme();

      expect(result).toBe('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('проходит полный цикл light → dark → bw → light', () => {
      const first = cycleGlobalTheme();
      expect(first).toBe('dark');

      const second = cycleGlobalTheme();
      expect(second).toBe('bw');

      const third = cycleGlobalTheme();
      expect(third).toBe('light');
    });
  });
});
