/**
 * DRAG DOM PREPARER
 * Подготовка и очистка DOM-элементов при drag-перелистывании.
 *
 * Отвечает за:
 * - Подготовку буфера, sheet и видимости страниц перед drag
 * - Очистку sheet после завершения drag-анимации
 * - Очистку атрибутов страниц после перелистывания/отмены
 *
 * Инкапсулирует всю логику переключения data-атрибутов
 * (noTransition, buffer, dragVisible, dragHidden, phase, direction, dragging).
 */

import { BookState, FlipPhase, Direction, BoolStr } from "../../config.js";

export class DragDOMPreparer {
  /**
   * @param {DOMManager} dom - Менеджер DOM-элементов
   * @param {BookRenderer} renderer - Рендерер страниц
   */
  constructor(dom, renderer) {
    this.dom = dom;
    this.renderer = renderer;

    /** @type {Object|null} Ссылки на страницы текущей drag-операции */
    this._pageRefs = null;
  }

  /**
   * Подготовить DOM к drag-перелистыванию:
   * - Отключить transitions для мгновенного обновления
   * - Подготовить буфер с целевой страницей
   * - Настроить sheet для drag-режима
   * - Показать страницу "под" текущей
   *
   * @param {string} direction - Направление: 'next' или 'prev'
   * @param {number} currentIndex - Текущий индекс страницы
   * @param {number} pagesPerFlip - Количество страниц за переворот
   * @param {boolean} isMobile - Мобильный режим
   */
  prepare(direction, currentIndex, pagesPerFlip, isMobile) {
    const nextIndex =
      direction === Direction.NEXT
        ? currentIndex + pagesPerFlip
        : currentIndex - pagesPerFlip;

    const book = this.dom.get("book");

    // Отключаем transitions ДО изменения видимости страниц,
    // чтобы избежать мигания белого фона на мобильных
    if (book) {
      book.dataset.noTransition = BoolStr.TRUE;
    }

    this.renderer.prepareBuffer(nextIndex, isMobile);
    this.renderer.prepareSheet(currentIndex, nextIndex, direction, isMobile);
    this._showUnderPage(direction, isMobile);

    const sheet = this.dom.get("sheet");

    if (sheet) {
      sheet.dataset.direction = direction;
      sheet.dataset.phase = FlipPhase.DRAG;
      sheet.classList.add("no-transition");
    }

    if (book) {
      book.dataset.state = BookState.FLIPPING;
      book.dataset.dragging = "";
    }
  }

  /**
   * Очистить sheet и book.dragging после завершения drag-анимации.
   * Вызывается перед completeFlip/cancelFlip.
   */
  cleanupSheet() {
    const sheet = this.dom.get("sheet");
    if (sheet) {
      sheet.classList.remove("no-transition");
      // Убираем inline transform (ставился напрямую в _render для perf)
      sheet.style.removeProperty("transform");
      delete sheet.dataset.phase;
      delete sheet.dataset.direction;
    }

    const book = this.dom.get("book");
    if (book) delete book.dataset.dragging;
  }

  /**
   * Очистить DOM-атрибуты страниц после перелистывания.
   * При отмене восстанавливает buffer-атрибуты, при успехе — нет
   * (swapBuffers уже корректно настроил их).
   *
   * @param {boolean} completed - Было ли перелистывание успешным
   */
  cleanupPages(completed) {
    const book = this.dom.get("book");

    // При успешном флипе устанавливаем noTransition для swapBuffers
    if (completed && book) {
      book.dataset.noTransition = BoolStr.TRUE;
    }

    if (book) book.dataset.state = BookState.OPENED;

    if (this._pageRefs) {
      const { leftActive, rightActive, leftBuffer, rightBuffer } = this._pageRefs;

      // Убираем скрытие для страниц
      if (leftActive) delete leftActive.dataset.dragHidden;
      if (rightActive) delete rightActive.dataset.dragHidden;

      // Удаляем dragVisible
      if (leftBuffer) delete leftBuffer.dataset.dragVisible;
      if (rightBuffer) delete rightBuffer.dataset.dragVisible;

      // Атрибуты buffer устанавливаем только при отмене флипа.
      // При успешном флипе swapBuffers() уже корректно настроил атрибуты,
      // и изменение их по старым ссылкам скроет активную страницу.
      if (!completed) {
        if (leftBuffer) leftBuffer.dataset.buffer = BoolStr.TRUE;
        if (rightBuffer) rightBuffer.dataset.buffer = BoolStr.TRUE;
      }
    }

    if (book) {
      requestAnimationFrame(() => {
        if (book) delete book.dataset.noTransition;
      });
    }

    this._pageRefs = null;
  }

  /**
   * Показать страницу "под" текущей (целевую страницу).
   * Буферная страница становится видимой, активная скрывается.
   * @private
   * @param {string} direction - Направление: 'next' или 'prev'
   * @param {boolean} isMobile - Мобильный режим
   */
  _showUnderPage(direction, isMobile) {
    const { leftActive, rightActive, leftBuffer, rightBuffer } = this.renderer.elements;
    this._pageRefs = { leftActive, rightActive, leftBuffer, rightBuffer };

    if (isMobile) {
      if (rightBuffer) {
        rightBuffer.dataset.buffer = BoolStr.FALSE;
        rightBuffer.dataset.dragVisible = BoolStr.TRUE;
      }
      if (rightActive) rightActive.dataset.dragHidden = BoolStr.TRUE;
    } else if (direction === Direction.NEXT) {
      if (rightBuffer) {
        rightBuffer.dataset.buffer = BoolStr.FALSE;
        rightBuffer.dataset.dragVisible = BoolStr.TRUE;
      }
      if (rightActive) rightActive.dataset.dragHidden = BoolStr.TRUE;
    } else {
      if (leftBuffer) {
        leftBuffer.dataset.buffer = BoolStr.FALSE;
        leftBuffer.dataset.dragVisible = BoolStr.TRUE;
      }
      if (leftActive) leftActive.dataset.dragHidden = BoolStr.TRUE;
    }
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    this._pageRefs = null;
    this.dom = null;
    this.renderer = null;
  }
}
