/**
 * Менеджер фотоальбомов
 * Управляет созданием и редактированием мульти-страничных фотоальбомов с раскладками.
 * Работает как inline-редактор внутри раскрытой карточки раздела (ChaptersModule).
 *
 * Делегирует рендеринг, обработку изображений и генерацию HTML подмодулям:
 * - albumConstants.js      — константы и чистые утилиты
 * - AlbumPageRenderer.js   — рендеринг UI страниц и слотов
 * - AlbumImageProcessor.js — сжатие, кадрирование, поворот, массовая загрузка
 * - AlbumHtmlBuilder.js    — генерация HTML из структурированных данных
 */

import { t } from '@i18n';
import { PhotoCropper } from './PhotoCropper.js';
import { LAYOUT_IMAGE_COUNT, DEFAULT_FILTER_INTENSITY, getPageSlots, computeFilterStyle } from './albumConstants.js';
import { buildAlbumHtml, buildItemModifiers, buildImgInlineStyle, buildImgDataAttrs } from './AlbumHtmlBuilder.js';
import {
  compressImage, readPageImageFile, cropPageImage, resetCrop,
  rotatePageImage, bulkUpload, bulkUploadToPage,
  distributeBulkFiles, processBulkFiles,
} from './AlbumImageProcessor.js';
import {
  renderAlbumPages, buildLayoutButtons, buildOptionSelect,
  applyFilterPreview, getSlotElement,
} from './AlbumPageRenderer.js';

export class AlbumManager {
  constructor(chaptersModule) {
    this._module = chaptersModule;
    this._albumPages = []; // [{ layout: '1', images: [{dataUrl, caption, frame, filter, filterIntensity}] }]
    /** @type {number|null} Индекс редактируемой главы (null = создание новой) */
    this._editingChapterIndex = null;
    /** @type {boolean} Были ли внесены изменения с момента открытия/сохранения */
    this._isDirty = false;
    this._cropper = new PhotoCropper();
    /** @type {HTMLElement|null} Контейнер для рендеринга страниц (устанавливается ChaptersModule) */
    this.albumPagesEl = null;
  }

  get store() { return this._module.store; }

  /** @deprecated Отдельный вид альбома удалён — DOM-элементы больше не нужны */
  cacheDOM() {}

  /** @deprecated Отдельный вид альбома удалён — события привязываются inline */
  bindEvents() {}

  // ─── Управление страницами ──────────────────────────────────────────

  _addAlbumPage() {
    this._isDirty = true;
    this._albumPages.push({ layout: '1', images: [] });
    this._renderAlbumPages();
  }

  _removeAlbumPage(pageIndex) {
    if (this._albumPages.length <= 1) return;
    this._isDirty = true;
    this._albumPages.splice(pageIndex, 1);
    this._renderAlbumPages();
  }

  /** Переместить страницу вверх */
  _movePageUp(pageIndex) {
    if (pageIndex <= 0) return;
    this._isDirty = true;
    const pages = this._albumPages;
    [pages[pageIndex - 1], pages[pageIndex]] = [pages[pageIndex], pages[pageIndex - 1]];
    this._renderAlbumPages();
  }

  /** Переместить страницу вниз */
  _movePageDown(pageIndex) {
    if (pageIndex >= this._albumPages.length - 1) return;
    this._isDirty = true;
    const pages = this._albumPages;
    [pages[pageIndex], pages[pageIndex + 1]] = [pages[pageIndex + 1], pages[pageIndex]];
    this._renderAlbumPages();
  }

  async _selectPageLayout(pageIndex, layout) {
    const page = this._albumPages[pageIndex];
    const count = LAYOUT_IMAGE_COUNT[layout] || 1;

    // Проверить, будут ли потеряны загруженные фото
    const lostImages = page.images.slice(count).filter(img => img?.dataUrl);
    if (lostImages.length > 0) {
      const msg = lostImages.length === 1
        ? t('admin.album.layoutPhotoLoss_one', { count: 1 })
        : t('admin.album.layoutPhotoLoss_other', { count: lostImages.length });
      const ok = await this._module._confirm(msg);
      if (!ok) return;
    }

    this._isDirty = true;
    page.layout = layout;
    page.images = page.images.slice(0, count);

    this._renderAlbumPages();
  }

  /** Гарантировать наличие объекта изображения в слоте */
  _ensureImageData(page, index) {
    this._isDirty = true;
    if (!page.images[index]) {
      page.images[index] = { dataUrl: '', caption: '', frame: 'none', filter: 'none', filterIntensity: DEFAULT_FILTER_INTENSITY, rotation: 0 };
    }
  }

  // ─── Делегирование: рендеринг ─────────────────────────────────────

  _renderAlbumPages() { renderAlbumPages(this); }
  _buildLayoutButtons(layout) { return buildLayoutButtons(layout); }
  _buildOptionSelect(opts, activeId, cb) { return buildOptionSelect(opts, activeId, cb); }
  _applyFilterPreview(slot, img) { applyFilterPreview(slot, img); }
  _getSlotElement(pi, ii) { return getSlotElement(this, pi, ii); }
  _getPageSlots(page) { return getPageSlots(page); }

  // ─── Делегирование: обработка изображений ─────────────────────────

  _compressImage(file) { return compressImage(file); }
  _readPageImageFile(file, pi, ii) { return readPageImageFile(this, file, pi, ii); }
  _cropPageImage(pi, ii) { return cropPageImage(this, pi, ii); }
  _resetCrop(pi, ii) { resetCrop(this, pi, ii); }
  _rotatePageImage(pi, ii) { rotatePageImage(this, pi, ii); }
  _bulkUpload() { bulkUpload(this); }
  _bulkUploadToPage(pi) { bulkUploadToPage(this, pi); }
  _distributeBulkFiles(files) { return distributeBulkFiles(this, files); }
  _processBulkFiles(files, slots) { return processBulkFiles(this, files, slots); }

  // ─── Делегирование: генерация HTML ────────────────────────────────

  _buildAlbumHtml(data) { return buildAlbumHtml(data, (s) => this._module._escapeHtml(s)); }
  _buildItemModifiers(img) { return buildItemModifiers(img); }
  _buildImgInlineStyle(img) { return buildImgInlineStyle(img); }
  _buildImgDataAttrs(img) { return buildImgDataAttrs(img); }
  _computeFilterStyle(filter, intensity) { return computeFilterStyle(filter, intensity); }
}
