/**
 * DEBUG PANEL
 * Панель отладки для отображения внутреннего состояния приложения.
 *
 * Показывает в реальном времени:
 * - Текущее состояние книги (state machine)
 * - Номер страницы и общее количество
 * - Размер кэша DOM-элементов
 * - Количество активных слушателей событий
 * - Использование памяти JS heap
 *
 * Активируется клавишей Ctrl+D.
 *
 * @example
 * const panel = new DebugPanel(debugElements);
 * panel.toggle(); // Показать/скрыть
 * panel.update({ state: 'OPENED', currentPage: 5, totalPages: 100, ... });
 */

/**
 * @typedef {Object} DebugElements
 * @property {HTMLElement} container - Контейнер панели
 * @property {HTMLElement} state - Элемент для отображения состояния
 * @property {HTMLElement} total - Элемент для общего количества страниц
 * @property {HTMLElement} current - Элемент для текущей страницы
 * @property {HTMLElement} cache - Элемент для информации о кэше
 * @property {HTMLElement} listeners - Элемент для количества слушателей
 * @property {HTMLElement} memory - Элемент для использования памяти
 */

/**
 * @typedef {Object} DebugData
 * @property {string} state - Текущее состояние (CLOSED, OPENED, FLIPPING, etc.)
 * @property {number} totalPages - Общее количество страниц
 * @property {number} currentPage - Номер текущей страницы
 * @property {number} listenerCount - Количество зарегистрированных слушателей
 */

export class DebugPanel {
  /**
   * Создаёт панель отладки
   * @param {DebugElements} elements - Объект с DOM-элементами панели
   */
  constructor(elements) {
    /** @type {HTMLElement} Контейнер панели */
    this.container = elements.container;
    /** @type {DebugElements} Все элементы панели */
    this.elements = elements;
    /** @type {boolean} Видимость панели */
    this.visible = false;
  }

  /**
   * Переключить видимость панели
   *
   * При включении также активирует debug-режим для визуализации drag-зон.
   */
  toggle() {
    this.visible = !this.visible;
    this.container.classList.toggle("visible", this.visible);
    
    // Включаем/выключаем debug режим для drag-зон
    document.body.dataset.debug = this.visible;
  }

  /**
   * Обновить отображаемые данные
   *
   * Обновление происходит только если панель видима (оптимизация).
   * Использование памяти отображается только если браузер поддерживает performance.memory.
   *
   * @param {DebugData} data - Данные для отображения
   */
  update(data) {
    if (!this.visible) return;

    this.elements.state.textContent = data.state;
    this.elements.total.textContent = data.totalPages;
    this.elements.current.textContent = data.currentPage;
    this.elements.cache.textContent = 'viewport reuse';
    this.elements.listeners.textContent = data.listenerCount;

    if (performance.memory) {
      const mb = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
      this.elements.memory.textContent = `${mb} MB`;
    }
  }
}

/**
 * ИСПОЛЬЗОВАНИЕ:
 * 
 * При включении debug режима (Ctrl+D):
 * - Панель отладки становится видимой
 * - Зоны drag подсвечиваются красным с анимацией
 * - Показываются метки направлений (next/prev)
 * 
 * Это помогает:
 * - Визуально проверить расположение зон
 * - Отладить взаимодействие
 * - Понять механику drag-перелистывания
 */
