/**
 * Модуль управления звуками
 */
import { BaseModule } from './BaseModule.js';
import { uploadWithFallback } from './adminHelpers.js';
import { t } from '@i18n';

/** Дефолтные пути звуков */
const SOUND_DEFAULTS = {
  pageFlip: 'sounds/page-flip.mp3',
  bookOpen: 'sounds/cover-flip.mp3',
  bookClose: 'sounds/cover-flip.mp3',
};

/** Конфигурация звуковых карточек */
function getSoundCards() {
  return [
    { key: 'pageFlip', label: t('admin.sounds.pageFlip'), defaultPath: SOUND_DEFAULTS.pageFlip },
    { key: 'bookOpen', label: t('admin.sounds.bookOpen'), defaultPath: SOUND_DEFAULTS.bookOpen },
    { key: 'bookClose', label: t('admin.sounds.bookClose'), defaultPath: SOUND_DEFAULTS.bookClose },
  ];
}

export class SoundsModule extends BaseModule {
  cacheDOM() {
    this.soundCardsGrid = document.getElementById('soundCardsGrid');
    this._renderSoundCardsHTML();

    // Кэшируем сгенерированные элементы
    this._modes = {};
    this._options = {};
    this._uploads = {};
    this._customInfos = {};
    this._customNames = {};
    this._removeButtons = {};
    this._previewButtons = {};
    for (const { key } of getSoundCards()) {
      this._modes[key] = document.getElementById(`sound-${key}-mode`);
      this._options[key] = this.soundCardsGrid.querySelectorAll(`[data-sound-key="${key}"] .sound-option[data-sound-mode]`);
      this._uploads[key] = document.getElementById(`sound-${key}-upload`);
      this._customInfos[key] = document.getElementById(`sound-${key}-custom-info`);
      this._customNames[key] = document.getElementById(`sound-${key}-custom-name`);
      this._removeButtons[key] = document.getElementById(`sound-${key}-remove`);
      this._previewButtons[key] = document.getElementById(`sound-${key}-preview`);
    }

    this.saveSoundsBtn = document.getElementById('saveSounds');
    this.resetSoundsBtn = document.getElementById('resetSounds');

    // Аудио-элемент для прослушивания
    this._audio = null;
    this._playingKey = null;
  }

  /** Сгенерировать звуковые карточки из HTML-шаблона */
  _renderSoundCardsHTML() {
    const tmpl = document.getElementById('tmpl-admin-sound-card');
    const frag = document.createDocumentFragment();

    for (const { key, label } of getSoundCards()) {
      const clone = tmpl.content.cloneNode(true);
      const card = clone.querySelector('.setting-card--sound');
      card.dataset.soundKey = key;
      card.querySelector('.setting-label').textContent = label;

      // Уникальные id для кэширования
      const upload = card.querySelector('.sound-upload-input');
      upload.id = `sound-${key}-upload`;

      const customInfo = card.querySelector('.sound-custom-info');
      customInfo.id = `sound-${key}-custom-info`;

      const customName = card.querySelector('.sound-custom-name');
      customName.id = `sound-${key}-custom-name`;

      const removeBtn = card.querySelector('.sound-custom-remove');
      removeBtn.id = `sound-${key}-remove`;
      removeBtn.title = t('admin.sounds.removeCustom');

      const previewBtn = card.querySelector('.sound-preview-btn');
      previewBtn.id = `sound-${key}-preview`;
      previewBtn.title = t('admin.sounds.preview');
      previewBtn.querySelector('.sound-preview-label').textContent = t('admin.sounds.preview');

      const modeInput = card.querySelector('.sound-mode-input');
      modeInput.id = `sound-${key}-mode`;

      frag.appendChild(clone);
    }

    this.soundCardsGrid.innerHTML = '';
    this.soundCardsGrid.appendChild(frag);
  }

  bindEvents() {
    for (const { key } of getSoundCards()) {
      // Клик по опциям выбора (default)
      this._options[key].forEach(btn => {
        if (btn.dataset.soundMode === 'default') {
          btn.addEventListener('click', () => this._selectMode(key, 'default'));
        }
      });

      // Загрузка своего файла
      this._uploads[key].addEventListener('change', (e) => this._handleSoundUpload(e, key));

      // Удаление кастомного звука
      this._removeButtons[key].addEventListener('click', () => this._removeCustom(key));

      // Прослушивание
      this._previewButtons[key].addEventListener('click', () => this._togglePreview(key));
    }

    this.saveSoundsBtn.addEventListener('click', () => this._saveSounds());
    this.resetSoundsBtn.addEventListener('click', () => this._resetSounds());
  }

  async render() {
    await this._renderSounds();
  }

  async _renderSounds() {
    const sounds = await this.store.getSounds();

    for (const { key } of getSoundCards()) {
      const value = sounds[key] || '';
      const isCustom = value.startsWith('data:') || value.startsWith('http');
      const mode = isCustom ? 'custom' : 'default';
      this._renderSoundSelector(key, mode);
    }
  }

  /** Отрисовать состояние селектора для конкретного звука */
  _renderSoundSelector(key, mode) {
    const uploadLabel = this._options[key][this._options[key].length - 1]?.closest('label');

    this._options[key].forEach(btn => {
      btn.classList.toggle('active', btn.dataset.soundMode === mode);
    });

    if (uploadLabel) {
      uploadLabel.classList.toggle('active', mode === 'custom');
    }

    this._modes[key].value = mode;

    if (mode === 'custom') {
      this._customInfos[key].hidden = false;
      this._customNames[key].textContent = t('admin.sounds.uploadedHint');
    } else {
      this._customInfos[key].hidden = true;
    }
  }

  /** Выбрать режим (default) */
  async _selectMode(key, mode) {
    if (mode === 'default') {
      this.store.updateSounds({ [key]: SOUND_DEFAULTS[key] });
      this._renderSoundSelector(key, 'default');
      this._renderJsonPreview();
    }
  }

  /** Обработка загрузки файла */
  async _handleSoundUpload(e, key) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._validateFile(file, { maxSize: 2 * 1024 * 1024, mimePrefix: 'audio/', inputEl: e.target })) return;

    const soundData = await uploadWithFallback(this.store, file, 'sound');

    this.store.updateSounds({ [key]: soundData });
    this._renderSoundSelector(key, 'custom');
    this._renderJsonPreview();
    this._showToast(t('admin.sounds.loaded'));
    e.target.value = '';
  }

  /** Удалить кастомный звук и вернуть дефолтный */
  _removeCustom(key) {
    this.store.updateSounds({ [key]: SOUND_DEFAULTS[key] });
    this._renderSoundSelector(key, 'default');
    this._renderJsonPreview();
    this._showToast(t('admin.sounds.reset'));
  }

  /** Прослушать текущий звук */
  async _togglePreview(key) {
    const btn = this._previewButtons[key];
    const playIcon = btn.querySelector('.sound-preview-play');
    const stopIcon = btn.querySelector('.sound-preview-stop');

    // Если тот же звук уже играет — остановить
    if (this._audio && this._playingKey === key) {
      this._stopPreview();
      return;
    }

    // Остановить предыдущий, если есть
    this._stopPreview();

    const sounds = await this.store.getSounds();
    const src = sounds[key];
    if (!src) return;

    this._audio = new Audio(src);
    this._playingKey = key;

    playIcon.hidden = true;
    stopIcon.hidden = false;
    btn.classList.add('playing');

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

    if (this._playingKey) {
      const btn = this._previewButtons[this._playingKey];
      if (btn) {
        const playIcon = btn.querySelector('.sound-preview-play');
        const stopIcon = btn.querySelector('.sound-preview-stop');
        if (playIcon) playIcon.hidden = false;
        if (stopIcon) stopIcon.hidden = true;
        btn.classList.remove('playing');
      }
      this._playingKey = null;
    }
  }

  async _saveSounds() {
    // Просто сохраняем текущее состояние (оно уже актуально в сторе)
    this._renderJsonPreview();
    this._showToast(t('admin.sounds.saved'));
  }

  _resetSounds() {
    this.store.updateSounds({ ...SOUND_DEFAULTS });
    this._renderSounds();
    this._renderJsonPreview();
    this._showToast(t('admin.sounds.reset'));
  }
}
