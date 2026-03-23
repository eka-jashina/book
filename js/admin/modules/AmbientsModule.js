/**
 * Модуль управления атмосферными звуками (амбиентами)
 * Редактирование inline — раскрывающиеся карточки (по аналогии с главами).
 * Прослушивание — по аналогии с SoundsModule.
 *
 * Рендер карточек → ambients/AmbientsRenderer.js
 * Загрузка файлов → ambients/AmbientsFileHandler.js
 */
import { BaseModule } from './BaseModule.js';
import { t } from '@i18n';
import { renderAmbientCard, getDisplayLabel, getDisplayShortLabel, extractFileName } from './ambients/AmbientsRenderer.js';
import { handleInlineFileUpload, handleAmbientFileUpload } from './ambients/AmbientsFileHandler.js';

/** Максимум пользовательских (не builtin) атмосфер */
const MAX_CUSTOM_AMBIENTS = 5;

export class AmbientsModule extends BaseModule {
  constructor(app) {
    super(app);
    this._editingAmbientIndex = null;
    this._pendingAmbientDataUrl = null;
    /** Индекс раскрытой карточки (-1 = все свёрнуты) */
    this._expandedIndex = -1;
    /** Аудио для прослушивания */
    this._audio = null;
    this._playingIndex = null;
    /** Имя загруженного файла (для отображения) */
    this._pendingAmbientFileName = null;
  }

  cacheDOM() {
    this.ambientCards = document.getElementById('ambientCards');
    this.addAmbientBtn = document.getElementById('addAmbient');

    // Legacy: модальное окно (для совместимости с тестами)
    this.ambientModal = document.getElementById('ambientModal');
    this.ambientModalTitle = document.getElementById('ambientModalTitle');
    this.ambientForm = document.getElementById('ambientForm');
    this.cancelAmbientModal = document.getElementById('cancelAmbientModal');
    this.ambientLabelInput = document.getElementById('ambientLabel');
    this.ambientIconInput = document.getElementById('ambientIcon');
    this.ambientFileInput = document.getElementById('ambientFile');
    this.ambientFileUpload = document.getElementById('ambientFileUpload');
    this.ambientUploadLabel = document.getElementById('ambientUploadLabel');
  }

  bindEvents() {
    this.addAmbientBtn.addEventListener('click', () => this._addNewAmbient());

    // Legacy: модальные обработчики (для совместимости с тестами)
    if (this.cancelAmbientModal) {
      this.cancelAmbientModal.addEventListener('click', () => this.ambientModal.close());
    }
    if (this.ambientForm) {
      this.ambientForm.addEventListener('submit', (e) => this._handleAmbientSubmit(e));
    }
    if (this.ambientFileUpload) {
      this.ambientFileUpload.addEventListener('change', (e) => this._handleAmbientFileUpload(e));
    }
  }

  async render() {
    await this._renderAmbients();
  }

  // Делегируем к извлечённым модулям
  _getDisplayLabel(a) { return getDisplayLabel(a); }
  _getDisplayShortLabel(a) { return getDisplayShortLabel(a); }
  _extractFileName(fileUrl) { return extractFileName(fileUrl); }

  // ═══════════════════════════════════════════════════════════════════════════
  // РЕНДЕР КАРТОЧЕК
  // ═══════════════════════════════════════════════════════════════════════════

  async _renderAmbients() {
    this._stopPreview();

    const ambients = await this.store.getAmbients();
    const customCount = ambients.filter(a => !a.builtin).length;

    this.ambientCards.innerHTML = ambients.map((a, i) => renderAmbientCard(this, a, i)).join('');

    // Обновить состояние кнопки «Добавить»
    this.addAmbientBtn.disabled = customCount >= MAX_CUSTOM_AMBIENTS;
    this.addAmbientBtn.title = customCount >= MAX_CUSTOM_AMBIENTS
      ? t('admin.ambients.limitReached')
      : '';

    // Делегирование событий
    this.ambientCards.onclick = async (e) => {
      // Прослушивание
      const previewBtn = e.target.closest('[data-ambient-preview]');
      if (previewBtn) {
        e.stopPropagation();
        const idx = parseInt(previewBtn.dataset.ambientPreview, 10);
        await this._togglePreview(idx);
        return;
      }

      // Клик по тоглу видимости
      const toggle = e.target.closest('[data-ambient-toggle]');
      if (toggle) {
        e.stopPropagation();
        const idx = parseInt(toggle.dataset.ambientToggle, 10);
        await this.store.updateAmbient(idx, { visible: toggle.checked });
        await this._renderAmbients();
        await this.app.settings.render();
        this._renderJsonPreview();
        this._showToast(toggle.checked ? t('admin.ambients.shown') : t('admin.ambients.hidden'));
        return;
      }

      // Клик по кнопке удаления
      const deleteBtn = e.target.closest('[data-ambient-delete]');
      if (deleteBtn) {
        e.stopPropagation();
        this._confirm(t('admin.ambients.deleteConfirm')).then(async (ok) => {
          if (!ok) return;
          const idx = parseInt(deleteBtn.dataset.ambientDelete, 10);
          this._stopPreview();
          if (this._expandedIndex === idx) {
            this._expandedIndex = -1;
          } else if (this._expandedIndex > idx) {
            this._expandedIndex--;
          }
          await this.store.removeAmbient(idx);
          await this._renderAmbients();
          await this.app.settings.render();
          this._renderJsonPreview();
          this._showToast(t('admin.ambients.deleted'));
        });
        return;
      }

      // Клик по заголовку карточки → раскрыть/свернуть
      const header = e.target.closest('[data-ambient-toggle-expand]');
      if (header) {
        const idx = parseInt(header.dataset.ambientToggleExpand, 10);
        this._toggleExpand(idx);
        return;
      }

      // Кнопка «Сохранить» внутри раскрытой карточки
      const saveBtn = e.target.closest('[data-ambient-save]');
      if (saveBtn) {
        await this._saveExpanded();
        return;
      }

      // Загрузка файла внутри раскрытой карточки
      const uploadLabel = e.target.closest('.ambient-inline-upload-label');
      if (uploadLabel) {
        const fileInput = this.ambientCards.querySelector('.ambient-inline-file-upload');
        if (fileInput) fileInput.click();
      }
    };

    // Обработчик загрузки файла внутри раскрытой карточки
    this.ambientCards.onchange = async (e) => {
      const fileInput = e.target.closest('.ambient-inline-file-upload');
      if (fileInput) {
        await this._handleInlineFileUpload(e);
      }
    };

    // Если есть раскрытая карточка — прокрутить к ней
    if (this._expandedIndex >= 0) {
      const card = this.ambientCards.querySelector(`.ambient-card[data-index="${this._expandedIndex}"]`);
      if (card?.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ПРОСЛУШИВАНИЕ
  // ═══════════════════════════════════════════════════════════════════════════

  /** Прослушать/остановить амбиент по индексу */
  async _togglePreview(index) {
    // Тот же звук — остановить
    if (this._audio && this._playingIndex === index) {
      this._stopPreview();
      return;
    }

    this._stopPreview();

    const ambients = await this.store.getAmbients();
    const ambient = ambients[index];
    if (!ambient?.file) return;

    // Резолвим путь: data:/http — как есть, иначе относительный
    const src = (ambient.file.startsWith('data:') || ambient.file.startsWith('http'))
      ? ambient.file
      : (import.meta.env.BASE_URL || '/') + ambient.file;

    this._audio = new Audio(src);
    this._playingIndex = index;

    // Обновить иконки кнопки
    const btn = this.ambientCards.querySelector(`[data-ambient-preview="${index}"]`);
    if (btn) {
      const playIcon = btn.querySelector('.sound-preview-play');
      const stopIcon = btn.querySelector('.sound-preview-stop');
      if (playIcon) playIcon.hidden = true;
      if (stopIcon) stopIcon.hidden = false;
      btn.classList.add('playing');
    }

    this._audio.addEventListener('ended', () => this._stopPreview());
    this._audio.addEventListener('error', () => this._stopPreview());

    try {
      await this._audio.play();
    } catch {
      this._stopPreview();
    }
  }

  /** Остановить прослушивание */
  _stopPreview() {
    if (this._audio) {
      this._audio.pause();
      this._audio = null;
    }

    if (this._playingIndex !== null) {
      const btn = this.ambientCards.querySelector(`[data-ambient-preview="${this._playingIndex}"]`);
      if (btn) {
        const playIcon = btn.querySelector('.sound-preview-play');
        const stopIcon = btn.querySelector('.sound-preview-stop');
        if (playIcon) playIcon.hidden = false;
        if (stopIcon) stopIcon.hidden = true;
        btn.classList.remove('playing');
      }
      this._playingIndex = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ДЕЙСТВИЯ
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Раскрыть/свернуть карточку амбиента
   */
  async _toggleExpand(index) {
    this._stopPreview();

    if (this._expandedIndex === index) {
      // Свернуть
      this._expandedIndex = -1;
      this._pendingAmbientDataUrl = null;
      this._pendingAmbientFileName = null;
    } else {
      // Раскрыть новую
      this._expandedIndex = index;
      this._pendingAmbientDataUrl = null;
      this._pendingAmbientFileName = null;

      // Подготовить pending data URL для upload-ных файлов
      const ambients = await this.store.getAmbients();
      const ambient = ambients[index];
      if (ambient?.file && (ambient.file.startsWith('data:') || ambient.file.startsWith('http'))) {
        this._pendingAmbientDataUrl = ambient.file;
      }
    }
    await this._renderAmbients();
  }

  /**
   * Добавить новый амбиент и раскрыть его карточку
   */
  async _addNewAmbient() {
    // Проверка лимита
    const currentAmbients = await this.store.getAmbients();
    const customCount = currentAmbients.filter(a => !a.builtin).length;
    if (customCount >= MAX_CUSTOM_AMBIENTS) {
      this._showToast(t('admin.ambients.limitReached'));
      return;
    }

    this._stopPreview();

    const id = `custom_${Date.now()}`;
    const defaultLabel = t('admin.ambients.newAmbientName') || 'New ambient';
    await this.store.addAmbient({
      id, label: defaultLabel, shortLabel: defaultLabel, icon: '🎵', file: null, visible: true, builtin: false,
    });

    const ambients = await this.store.getAmbients();
    this._expandedIndex = ambients.length - 1;
    this._pendingAmbientDataUrl = null;
    await this._renderAmbients();
    this.app.settings.render();
    this._renderJsonPreview();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ЗАГРУЗКА ФАЙЛОВ (делегирование)
  // ═══════════════════════════════════════════════════════════════════════════

  async _handleInlineFileUpload(e) {
    await handleInlineFileUpload(this, e);
  }

  /** @deprecated */
  async _handleAmbientFileUpload(e) {
    await handleAmbientFileUpload(this, e);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // СОХРАНЕНИЕ
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Сохранить содержимое раскрытой карточки
   */
  async _saveExpanded() {
    if (this._expandedIndex < 0) return;

    const card = this.ambientCards.querySelector(`.ambient-card[data-index="${this._expandedIndex}"]`);
    if (!card) return;

    const label = card.querySelector('.ambient-inline-label')?.value.trim() || '';
    const icon = card.querySelector('.ambient-inline-icon')?.value.trim() || '';

    if (!label || !icon) {
      this._showToast(t('admin.ambients.validationRequired'));
      return;
    }

    const ambients = await this.store.getAmbients();
    const existing = ambients[this._expandedIndex];
    const file = this._pendingAmbientDataUrl || existing?.file || null;
    if (!file) {
      this._showToast(t('admin.ambients.validationRequired'));
      return;
    }

    const id = existing?.id || `custom_${Date.now()}`;
    const shortLabel = label.length > 8 ? label.slice(0, 8) : label;

    const ambient = { id, label, shortLabel, icon, file, visible: existing?.visible ?? true, builtin: false };
    await this.store.updateAmbient(this._expandedIndex, ambient);

    this._expandedIndex = -1;
    this._pendingAmbientDataUrl = null;
    this._pendingAmbientFileName = null;
    await this._renderAmbients();
    this.app.settings.render();
    this._renderJsonPreview();
    this._showToast(t('admin.ambients.updated'));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Legacy: модальное окно (для совместимости с тестами)
  // ═══════════════════════════════════════════════════════════════════════════

  /** @deprecated Используйте _toggleExpand() */
  async _openAmbientModal(editIndex = null) {
    if (editIndex !== null) {
      await this._toggleExpand(editIndex);
    } else {
      await this._addNewAmbient();
    }
  }

  /** @deprecated */
  async _handleAmbientSubmit(e) {
    e.preventDefault();

    const label = this.ambientLabelInput?.value.trim();
    const icon = this.ambientIconInput?.value.trim();
    const filePath = this.ambientFileInput?.value.trim();

    if (!label || !icon) return;

    const file = this._pendingAmbientDataUrl || filePath || null;
    if (!file) {
      this._showToast(t('admin.ambients.validationRequired'));
      return;
    }

    let id;
    if (this._editingAmbientIndex !== null) {
      const ambients = await this.store.getAmbients();
      id = ambients[this._editingAmbientIndex].id;
    } else {
      id = `custom_${Date.now()}`;
    }

    const shortLabel = label.length > 8 ? label.slice(0, 8) : label;
    const ambient = { id, label, shortLabel, icon, file, visible: true, builtin: false };

    if (this._editingAmbientIndex !== null) {
      this.store.updateAmbient(this._editingAmbientIndex, ambient);
      this._showToast(t('admin.ambients.updated'));
    } else {
      this.store.addAmbient(ambient);
      this._showToast(t('admin.ambients.added'));
    }

    if (this.ambientModal) this.ambientModal.close();
    this._renderAmbients();
    this.app.settings.render();
    this._renderJsonPreview();
  }
}
