/**
 * CONTENT SERVICES
 * Группирует компоненты для работы с контентом.
 *
 * Содержит:
 * - ContentLoader - загрузка HTML контента глав
 * - BackgroundManager - управление фоновыми изображениями
 */

import { ContentLoader, BackgroundManager } from '../../managers/index.js';

export class ContentServices {
  /**
   * @param {Object} [options]
   * @param {import('../../utils/ApiClient.js').ApiClient} [options.apiClient]
   * @param {string} [options.bookId]
   * @param {boolean} [options.publicMode] - Использовать публичные API (guest/embed)
   */
  constructor({ apiClient, bookId, publicMode } = {}) {
    this.contentLoader = new ContentLoader({ apiClient, bookId, publicMode });
    this.backgroundManager = new BackgroundManager();
  }

  /**
   * Очистить ресурсы
   */
  destroy() {
    this.contentLoader?.destroy?.();
    this.backgroundManager?.destroy?.();

    this.contentLoader = null;
    this.backgroundManager = null;
  }
}
