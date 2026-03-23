/**
 * Менеджер обложки книги
 * Отвечает за редактирование метаданных обложки и фонового изображения.
 * Извлечён из ChaptersModule для разделения ответственности.
 */
import { uploadWithFallback } from './adminHelpers.js';
import { t } from '@i18n';

export class CoverManager {
  /**
   * @param {import('./ChaptersModule.js').ChaptersModule} host - Родительский модуль
   */
  constructor(host) {
    this._host = host;
  }

  /** Кэшировать DOM-элементы обложки */
  cacheDOM() {
    this.coverTitle = document.getElementById('coverTitle');
    this.coverAuthor = document.getElementById('coverAuthor');
    this.bgCoverMode = document.getElementById('bgCoverMode');
    this.bgCoverOptions = document.querySelectorAll('.texture-option[data-bg-mode]');
    this.bgCoverFileInput = document.getElementById('bgCoverFileInput');
    this.bgCoverThumb = document.getElementById('bgCoverThumb');
    this.bgCoverCustomInfo = document.getElementById('bgCoverCustomInfo');
    this.bgCoverCustomName = document.getElementById('bgCoverCustomName');
    this.bgCoverRemove = document.getElementById('bgCoverRemove');
    this.saveCoverBtn = document.getElementById('saveCover');
  }

  /** Привязать события обложки */
  bindEvents() {
    this.bgCoverOptions.forEach(btn => {
      btn.addEventListener('click', () => this._selectBgMode(btn.dataset.bgMode));
    });
    this.bgCoverFileInput.addEventListener('change', (e) => this._handleBgUpload(e));
    this.bgCoverRemove.addEventListener('click', () => this._removeBgCustom());
    this.saveCoverBtn.addEventListener('click', () => this._saveCover());
  }

  /** Рендер обложки */
  async render() {
    const cover = await this._host.store.getCover();
    this.coverTitle.value = cover.title;
    this.coverAuthor.value = cover.author;
    this._renderBgModeSelector(cover.bgMode || 'default', cover.bgCustomData);
  }

  _renderBgModeSelector(modeValue, customData) {
    const uploadOption = this.bgCoverOptions[this.bgCoverOptions.length - 1]?.closest('label');

    this.bgCoverOptions.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.bgMode === modeValue);
    });

    if (uploadOption) {
      uploadOption.classList.toggle('active', modeValue === 'custom');
    }

    this.bgCoverMode.value = modeValue;

    if (customData) {
      this.bgCoverThumb.style.backgroundImage = `url(${customData})`;
      this.bgCoverThumb.classList.add('has-image');
      this.bgCoverCustomInfo.hidden = false;
      this.bgCoverCustomName.textContent = t('admin.cover.customImageName');
    } else {
      this.bgCoverThumb.style.backgroundImage = '';
      this.bgCoverThumb.classList.remove('has-image');
      this.bgCoverCustomInfo.hidden = true;
    }
  }

  async _selectBgMode(value) {
    const cover = await this._host.store.getCover();
    this._renderBgModeSelector(value, cover.bgCustomData);
  }

  async _handleBgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._host._validateFile(file, { maxSize: 2 * 1024 * 1024, mimePrefix: 'image/', inputEl: e.target })) return;

    const imageData = await uploadWithFallback(this._host.store, file, 'image');

    this._host.store.updateCover({ bgMode: 'custom', bgCustomData: imageData });
    this._renderBgModeSelector('custom', imageData);
    this._host._renderJsonPreview();
    this._host._showToast(t('admin.chapters.bgLoaded'));
    e.target.value = '';
  }

  _removeBgCustom() {
    this._host.store.updateCover({ bgMode: 'default', bgCustomData: null });
    this._renderBgModeSelector('default', null);
    this._host._renderJsonPreview();
    this._host._showToast(t('admin.chapters.bgRemoved'));
  }

  _saveCover() {
    this._host.store.updateCover({
      title: this.coverTitle.value.trim(),
      author: this.coverAuthor.value.trim(),
      bgMode: this.bgCoverMode.value,
    });

    // Обновить заголовок редактора
    this._host.app.editorTitle.textContent = this.coverTitle.value.trim() || t('admin.bookEditor');

    this._host._bookSelector.render();
    this._host._renderJsonPreview();
    this._host._showToast(t('admin.chapters.coverSaved'));
  }
}
