/**
 * Live-превью оформления книги
 *
 * Изолированный компонент, управляющий DOM-элементами предпросмотра обложки и страницы.
 * Извлечён из AppearanceModule для разделения логики превью и формы.
 */
import { t } from '@i18n';

export class AppearancePreview {
  /**
   * @param {Object} elements - DOM-элементы превью
   * @param {HTMLElement} elements.coverTextPreview - Текстовый превью обложки (верхний блок)
   * @param {HTMLElement} elements.previewCover - Обложка в живом превью
   * @param {HTMLElement} elements.previewPage - Страница в живом превью
   * @param {HTMLElement} elements.previewTitle - Заголовок в превью
   * @param {HTMLElement} elements.previewAuthor - Автор в превью
   */
  constructor(elements) {
    this._coverTextPreview = elements.coverTextPreview;
    this._previewCover = elements.previewCover;
    this._previewPage = elements.previewPage;
    this._previewTitle = elements.previewTitle;
    this._previewAuthor = elements.previewAuthor;
  }

  /**
   * Обновить превью на основе текущих значений формы и данных из store.
   *
   * @param {Object} params
   * @param {string} params.coverBgStart - Начальный цвет градиента
   * @param {string} params.coverBgEnd - Конечный цвет градиента
   * @param {string} params.coverText - Цвет текста обложки
   * @param {string} params.bgPage - Цвет фона страницы
   * @param {string|null} params.coverBgImage - URL фонового изображения обложки
   * @param {string} params.coverTitle - Заголовок книги
   * @param {string} params.coverAuthor - Автор книги
   * @param {string} params.editTheme - Текущая тема ('light'|'dark')
   */
  update({ coverBgStart, coverBgEnd, coverText, bgPage, coverBgImage, coverTitle, coverAuthor, editTheme }) {
    const bg = `linear-gradient(135deg, ${coverBgStart}, ${coverBgEnd})`;

    // Текстовый превью обложки
    this._coverTextPreview.style.background = bg;
    this._coverTextPreview.style.color = coverText;
    this._coverTextPreview.textContent = coverTitle || t('admin.appearance.previewTitleFallback');

    // Live-превью — обложка
    this._previewCover.style.background = bg;
    this._previewCover.style.color = coverText;
    this._previewCover.style.backgroundImage = coverBgImage ? `url(${coverBgImage})` : '';
    this._previewTitle.textContent = coverTitle || t('admin.appearance.previewTitleFallback');
    this._previewAuthor.textContent = coverAuthor || t('admin.appearance.previewAuthorFallback');

    // Live-превью — страница
    this._previewPage.style.backgroundColor = bgPage;
    this._previewPage.style.color = editTheme === 'dark' ? '#ddd' : '#333';
  }
}
