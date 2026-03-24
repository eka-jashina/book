/**
 * CHAPTER DELEGATE
 * Управление главами книги.
 * 
 * Отвечает за:
 * - Определение текущей главы
 * - Обновление фона и UI главы
 * - Предзагрузку фонов следующих глав
 * 
 */

import { getConfig } from '../../config.js';
import { BaseDelegate } from './BaseDelegate.js';

export class ChapterDelegate extends BaseDelegate {
  /**
   * @param {Object} deps
   * @param {BackgroundManager} deps.backgroundManager
   * @param {DOMManager} deps.dom
   * @param {Object} deps.state - Объект состояния контроллера
   * @param {number} deps.state.index
   * @param {number[]} deps.state.chapterStarts
   */
  constructor(deps) {
    super(deps);
    this.lastPreloadedChapter = -1;
  }

  /**
   * Валидация зависимостей
   * @protected
   */
  _validateRequiredDependencies(deps) {
    this._validateDependencies(
      deps,
      ['backgroundManager', 'dom', 'state'],
      'ChapterDelegate'
    );
  }

  /**
   * Определить текущую главу по индексу страницы
   * @param {number} pageIndex
   * @returns {number}
   */
  getCurrentChapter(pageIndex = this.currentIndex) {
    let current = 0;
    for (let i = 0; i < this.chapterStarts.length; i++) {
      if (this.chapterStarts[i] <= pageIndex) {
        current = i;
      } else {
        break;
      }
    }
    return current;
  }

  /**
   * Получить следующую главу
   * @param {number} currentChapter
   * @returns {number|null}
   */
  getNextChapter(currentChapter) {
    const nextChapter = currentChapter + 1;
    return nextChapter < getConfig().CHAPTERS.length ? nextChapter : null;
  }

  /**
   * Обновить фон главы
   * @param {number} pageIndex - Индекс текущей страницы
   * @param {boolean} isMobile - Мобильный режим
   */
  updateBackground(pageIndex, isMobile) {
    // Страницы до первой главы (оглавление) используют фон обложки
    const firstChapterStart = this.chapterStarts[0] ?? 0;
    if (pageIndex < firstChapterStart) {
      const body = this.dom.get('body');
      if (body) {
        body.dataset.chapter = 'cover';
      }
      const coverBg = isMobile ? getConfig().COVER_BG_MOBILE : getConfig().COVER_BG;
      this.backgroundManager.setBackground(coverBg);
      return;
    }

    const currentChapter = this.getCurrentChapter(pageIndex);
    const chapterInfo = getConfig().CHAPTERS[currentChapter];

    if (!chapterInfo) return;

    // Обновить data-атрибут для стилей
    const body = this.dom.get('body');
    if (body) {
      body.dataset.chapter = chapterInfo.id;
    }

    // Установить фон главы (мобильная или полная версия).
    // Если фон не задан — очищаем, чтобы был виден bgApp (фон приложения).
    const bgUrl = isMobile ? chapterInfo.bgMobile : chapterInfo.bg;
    this.backgroundManager.setBackground(bgUrl || null);

    // Предзагрузить следующую главу
    this._preloadNextChapter(currentChapter, isMobile);
  }

  /**
   * Восстановить фон обложки (при закрытии книги)
   * @param {boolean} isMobile - Мобильный режим
   */
  restoreCoverBackground(isMobile) {
    const body = this.dom.get('body');
    if (body) {
      body.dataset.chapter = 'cover';
    }
    const coverBg = isMobile ? getConfig().COVER_BG_MOBILE : getConfig().COVER_BG;
    this.backgroundManager.setBackground(coverBg);
  }

  /**
   * Предзагрузить фон следующей главы
   * @private
   * @param {number} currentChapter
   * @param {boolean} isMobile - Мобильный режим
   */
  _preloadNextChapter(currentChapter, isMobile) {
    const nextChapter = this.getNextChapter(currentChapter);

    if (nextChapter !== null && nextChapter !== this.lastPreloadedChapter) {
      const nextChapterInfo = getConfig().CHAPTERS[nextChapter];
      const bgUrl = isMobile ? nextChapterInfo?.bgMobile : nextChapterInfo?.bg;

      if (bgUrl) {
        this.backgroundManager.preload(bgUrl);
        this.lastPreloadedChapter = nextChapter;
      }
    }
  }

  /**
   * Очистка
   */
  destroy() {
    this.lastPreloadedChapter = -1;
    super.destroy();
  }
}
