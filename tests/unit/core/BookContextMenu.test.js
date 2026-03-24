import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════
// Тесты для BookContextMenu — контекстное меню книги
// ═══════════════════════════════════════════

import { BookContextMenu } from '@core/BookContextMenu.js';

function createContainer(...bookIds) {
  const container = document.createElement('div');

  for (const bookId of bookIds) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('bookshelf-book-wrapper');
    wrapper.dataset.bookId = bookId;

    const menu = document.createElement('div');
    menu.classList.add('bookshelf-book-menu');
    menu.hidden = true;

    wrapper.appendChild(menu);
    container.appendChild(wrapper);
  }

  return container;
}

describe('BookContextMenu', () => {
  let container;
  let contextMenu;

  beforeEach(() => {
    vi.useFakeTimers();
    container = createContainer('book-1', 'book-2', 'book-3');
    document.body.appendChild(container);
    contextMenu = new BookContextMenu(container);
  });

  afterEach(() => {
    contextMenu.close();
    container.remove();
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // Конструктор
  // ═══════════════════════════════════════════

  describe('constructor', () => {
    it('создаётся с контейнером', () => {
      expect(contextMenu).toBeTruthy();
    });

    it('изначально нет открытого меню', () => {
      expect(contextMenu.openBookId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // Геттер openBookId
  // ═══════════════════════════════════════════

  describe('openBookId', () => {
    it('возвращает null когда меню закрыто', () => {
      expect(contextMenu.openBookId).toBeNull();
    });

    it('возвращает id открытой книги', () => {
      contextMenu.open('book-1');

      expect(contextMenu.openBookId).toBe('book-1');
    });
  });

  // ═══════════════════════════════════════════
  // open
  // ═══════════════════════════════════════════

  describe('open', () => {
    it('открывает меню для указанной книги', () => {
      contextMenu.open('book-1');

      const wrapper = container.querySelector('[data-book-id="book-1"]');
      expect(wrapper.classList.contains('menu-open')).toBe(true);
    });

    it('показывает элемент меню (hidden=false)', () => {
      contextMenu.open('book-1');

      const menu = container.querySelector(
        '[data-book-id="book-1"] .bookshelf-book-menu',
      );
      expect(menu.hidden).toBe(false);
    });

    it('закрывает предыдущее меню при открытии нового', () => {
      contextMenu.open('book-1');
      contextMenu.open('book-2');

      const wrapper1 = container.querySelector('[data-book-id="book-1"]');
      const wrapper2 = container.querySelector('[data-book-id="book-2"]');

      expect(wrapper1.classList.contains('menu-open')).toBe(false);
      expect(wrapper2.classList.contains('menu-open')).toBe(true);
    });

    it('обновляет openBookId', () => {
      contextMenu.open('book-2');

      expect(contextMenu.openBookId).toBe('book-2');
    });

    it('добавляет обработчик клика на документ после setTimeout(0)', () => {
      const addSpy = vi.spyOn(document, 'addEventListener');

      contextMenu.open('book-1');

      // До срабатывания таймера — обработчик ещё не добавлен
      expect(addSpy).not.toHaveBeenCalledWith(
        'click',
        expect.any(Function),
      );

      // Выполняем setTimeout(0)
      vi.advanceTimersByTime(0);

      expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));

      addSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════
  // close
  // ═══════════════════════════════════════════

  describe('close', () => {
    it('удаляет класс menu-open', () => {
      contextMenu.open('book-1');
      contextMenu.close();

      const wrapper = container.querySelector('[data-book-id="book-1"]');
      expect(wrapper.classList.contains('menu-open')).toBe(false);
    });

    it('скрывает меню (hidden=true)', () => {
      contextMenu.open('book-1');
      contextMenu.close();

      const menu = container.querySelector(
        '[data-book-id="book-1"] .bookshelf-book-menu',
      );
      expect(menu.hidden).toBe(true);
    });

    it('сбрасывает openBookId в null', () => {
      contextMenu.open('book-1');
      contextMenu.close();

      expect(contextMenu.openBookId).toBeNull();
    });

    it('ничего не ломает при вызове без открытого меню', () => {
      expect(() => contextMenu.close()).not.toThrow();
    });

    it('удаляет обработчик клика на документе', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      contextMenu.open('book-1');
      vi.advanceTimersByTime(0);

      contextMenu.close();

      expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));

      removeSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════
  // Закрытие по клику вне меню
  // ═══════════════════════════════════════════

  describe('закрытие по клику на документе', () => {
    it('закрывает меню при клике вне него', () => {
      contextMenu.open('book-1');
      vi.advanceTimersByTime(0);

      // Кликаем вне контейнера
      document.body.click();

      expect(contextMenu.openBookId).toBeNull();
    });
  });
});
