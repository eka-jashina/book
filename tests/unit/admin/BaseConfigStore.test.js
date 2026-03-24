import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { BaseConfigStore } from '@/admin/BaseConfigStore.js';

describe('BaseConfigStore', () => {
  let store;

  beforeEach(() => {
    store = new BaseConfigStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // КОНСТРУКТОР
  // ═══════════════════════════════════════════

  describe('constructor', () => {
    it('должен инициализировать _savePromise как null', () => {
      expect(store._savePromise).toBeNull();
    });

    it('должен инициализировать _onError как null', () => {
      expect(store._onError).toBeNull();
    });

    it('должен инициализировать _onSave как null', () => {
      expect(store._onSave).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // ГЕТТЕРЫ/СЕТТЕРЫ onError
  // ═══════════════════════════════════════════

  describe('onError', () => {
    it('должен установить и вернуть обработчик ошибок', () => {
      const handler = vi.fn();
      store.onError = handler;
      expect(store.onError).toBe(handler);
    });

    it('должен вернуть null по умолчанию', () => {
      expect(store.onError).toBeNull();
    });

    it('должен перезаписать предыдущий обработчик', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      store.onError = handler1;
      store.onError = handler2;
      expect(store.onError).toBe(handler2);
    });
  });

  // ═══════════════════════════════════════════
  // ГЕТТЕРЫ/СЕТТЕРЫ onSave
  // ═══════════════════════════════════════════

  describe('onSave', () => {
    it('должен установить и вернуть обработчик сохранения', () => {
      const handler = vi.fn();
      store.onSave = handler;
      expect(store.onSave).toBe(handler);
    });

    it('должен вернуть null по умолчанию', () => {
      expect(store.onSave).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _handleError()
  // ═══════════════════════════════════════════

  describe('_handleError()', () => {
    it('должен логировать ошибку в консоль', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('test error');

      store._handleError('save', error);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('должен вызвать callback _onError с сообщением', () => {
      const onError = vi.fn();
      store.onError = onError;
      const error = new Error('test error');

      store._handleError('save', error);

      expect(onError).toHaveBeenCalled();
      // Проверяем что передано сообщение (строка)
      const arg = onError.mock.calls[0][0];
      expect(typeof arg).toBe('string');
    });

    it('не должен падать если _onError не установлен', () => {
      const error = new Error('test error');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => store._handleError('load', error)).not.toThrow();
      consoleSpy.mockRestore();
    });

    it('должен включить название действия в сообщение', () => {
      const onError = vi.fn();
      store.onError = onError;

      store._handleError('delete', new Error('fail'));

      const msg = onError.mock.calls[0][0];
      expect(msg).toContain('delete');
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _notifySave()
  // ═══════════════════════════════════════════

  describe('_notifySave()', () => {
    it('должен вызвать callback _onSave если установлен', () => {
      const onSave = vi.fn();
      store.onSave = onSave;

      store._notifySave();

      expect(onSave).toHaveBeenCalledOnce();
    });

    it('не должен падать если _onSave не установлен', () => {
      expect(() => store._notifySave()).not.toThrow();
    });

    it('не должен вызывать _onSave если он null', () => {
      store.onSave = null;
      // Просто проверяем что не бросает ошибку
      expect(() => store._notifySave()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД waitForSave()
  // ═══════════════════════════════════════════

  describe('waitForSave()', () => {
    it('должен разрешиться немедленно если нет активного сохранения', async () => {
      const result = await store.waitForSave();
      expect(result).toBeUndefined();
    });

    it('должен дождаться завершения _savePromise', async () => {
      let resolveSave;
      store._savePromise = new Promise(resolve => {
        resolveSave = resolve;
      });

      let resolved = false;
      const waitPromise = store.waitForSave().then(() => {
        resolved = true;
      });

      // Ещё не разрешён
      await Promise.resolve();
      expect(resolved).toBe(false);

      // Разрешаем
      resolveSave();
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it('должен обработать отклонённый _savePromise', async () => {
      store._savePromise = Promise.reject(new Error('save failed'));

      // waitForSave может либо проглотить ошибку, либо пробросить
      // Проверяем что не виснет
      try {
        await store.waitForSave();
      } catch {
        // Допустимо — ошибка проброшена
      }
    });
  });
});
