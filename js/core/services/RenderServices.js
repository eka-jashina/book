/**
 * RENDER SERVICES
 * Группирует компоненты для рендеринга и анимации.
 *
 * Содержит:
 * - BookRenderer - рендеринг страниц (double buffering, viewport reuse)
 * - BookAnimator - CSS анимации (lift, rotate, drop)
 * - AsyncPaginator - пагинация контента
 * - LoadingIndicator - индикатор загрузки
 */

import { BookRenderer } from '../BookRenderer.js';
import { BookAnimator } from '../BookAnimator.js';
import { LoadingIndicator } from '../LoadingIndicator.js';
import { AsyncPaginator } from '../../managers/AsyncPaginator.js';
import { sanitizer } from '../../utils/HTMLSanitizer.js';

export class RenderServices {
  /**
   * @param {Object} core - CoreServices
   */
  constructor(core) {
    this.renderer = this._createRenderer(core.dom);
    this.animator = this._createAnimator(core.dom, core.timerManager);
    this.paginator = this._createPaginator();
    this.loadingIndicator = this._createLoadingIndicator(core.dom);
  }

  /**
   * Создать рендерер страниц
   * @private
   */
  _createRenderer(dom) {
    const { leftA, rightA, leftB, rightB, sheetFront, sheetBack } =
      dom.getMultiple(
        "leftA",
        "rightA",
        "leftB",
        "rightB",
        "sheetFront",
        "sheetBack",
      );

    return new BookRenderer({
      leftActive: leftA,
      rightActive: rightA,
      leftBuffer: leftB,
      rightBuffer: rightB,
      sheetFront: sheetFront,
      sheetBack: sheetBack,
    });
  }

  /**
   * Создать аниматор
   * @private
   */
  _createAnimator(dom, timerManager) {
    const { book, bookWrap, cover, sheet } = dom.getMultiple(
      "book",
      "bookWrap",
      "cover",
      "sheet",
    );

    return new BookAnimator({
      book,
      bookWrap,
      cover,
      sheet,
      timerManager,
    });
  }

  /**
   * Создать пагинатор
   * @private
   */
  _createPaginator() {
    return new AsyncPaginator({ sanitizer });
  }

  /**
   * Создать индикатор загрузки
   * @private
   */
  _createLoadingIndicator(dom) {
    const { loadingOverlay, loadingProgress } = dom.getMultiple(
      "loadingOverlay",
      "loadingProgress",
    );

    return new LoadingIndicator(loadingOverlay, loadingProgress);
  }

  /**
   * Очистить ресурсы
   */
  destroy() {
    this.animator?.destroy?.();
    this.paginator?.destroy?.();

    this.renderer = null;
    this.animator = null;
    this.paginator = null;
    this.loadingIndicator = null;
  }
}
