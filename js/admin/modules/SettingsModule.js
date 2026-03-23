/**
 * Модуль настроек по умолчанию и видимости настроек
 */
import { BaseModule } from './BaseModule.js';
import { t } from '@i18n';

/** Конфигурация переключателей видимости */
function getVisibilityToggles() {
  return [
    { key: 'fontSize', label: t('admin.settings.fontSize') },
    { key: 'theme', label: t('admin.settings.theme') },
    { key: 'font', label: t('admin.settings.font') },
    { key: 'fullscreen', label: t('admin.settings.fullscreen') },
    { key: 'sound', label: t('admin.settings.sound') },
    { key: 'ambient', label: t('admin.settings.ambient') },
  ];
}

export class SettingsModule extends BaseModule {
  cacheDOM() {
    this.defaultFont = document.getElementById('defaultFont');
    this.defaultFontSize = document.getElementById('defaultFontSize');
    this.fontSizeValue = document.getElementById('fontSizeValue');
    this.defaultThemeBtns = document.querySelectorAll('#defaultTheme .setting-theme-btn');
    this.defaultSound = document.getElementById('defaultSound');
    this.soundLabel = document.getElementById('soundLabel');
    this.defaultVolume = document.getElementById('defaultVolume');
    this.volumeValue = document.getElementById('volumeValue');
    this.defaultAmbientGroup = document.getElementById('defaultAmbient');
    this.saveSettingsBtn = document.getElementById('saveSettings');
    this.resetSettingsBtn = document.getElementById('resetSettings');

    // Видимость настроек — контейнер + генерация переключателей
    this.visibilityToggles = document.getElementById('visibilityToggles');
    this._renderVisibilityTogglesHTML();
  }

  bindEvents() {
    this.defaultFontSize.addEventListener('input', () => {
      this.fontSizeValue.textContent = `${this.defaultFontSize.value}px`;
    });

    this.defaultSound.addEventListener('change', () => {
      this.soundLabel.textContent = this.defaultSound.checked ? t('admin.settings.enabled') : t('admin.settings.disabled');
    });

    this.defaultVolume.addEventListener('input', () => {
      this.volumeValue.textContent = `${this.defaultVolume.value}%`;
    });

    this.defaultThemeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.defaultThemeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    this.defaultAmbientGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.setting-ambient-btn');
      if (!btn) return;
      this.defaultAmbientGroup.querySelectorAll('.setting-ambient-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    this.saveSettingsBtn.addEventListener('click', () => this._saveSettings());
    this.resetSettingsBtn.addEventListener('click', () => this._resetSettings());

    // Видимость настроек
    this.visibilityToggles.addEventListener('change', (e) => {
      const input = e.target.closest('[data-visibility]');
      if (!input) return;
      this.store.updateSettingsVisibility({ [input.dataset.visibility]: input.checked });
      this._renderJsonPreview();
      this._showToast(input.checked ? t('admin.settings.shown') : t('admin.settings.hidden'));
    });
  }

  async render() {
    await this._renderSettings();
    await this._renderSettingsVisibility();
  }

  async _renderSettings() {
    const settings = await this.store.getDefaultSettings();

    this.defaultFont.value = settings.font;
    this.defaultFontSize.value = settings.fontSize;
    this.fontSizeValue.textContent = `${settings.fontSize}px`;

    this.defaultThemeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });

    this.defaultSound.checked = settings.soundEnabled;
    this.soundLabel.textContent = settings.soundEnabled ? t('admin.settings.enabled') : t('admin.settings.disabled');
    this.defaultVolume.value = Math.round(settings.soundVolume * 100);
    this.volumeValue.textContent = `${Math.round(settings.soundVolume * 100)}%`;

    // Динамически заполнить кнопки амбиентов (только видимые)
    const allAmbients = await this.store.getAmbients();
    const ambients = allAmbients.filter(ambient => ambient.visible);
    const ambientTmpl = document.getElementById('tmpl-admin-ambient-btn');
    const ambientFrag = document.createDocumentFragment();

    for (const ambient of ambients) {
      const clone = ambientTmpl.content.cloneNode(true);
      const btn = clone.querySelector('.setting-ambient-btn');
      btn.dataset.ambient = ambient.id;
      btn.textContent = `${ambient.icon} ${ambient.shortLabel || ambient.label}`;
      if (ambient.id === settings.ambientType) btn.classList.add('active');
      ambientFrag.appendChild(clone);
    }

    this.defaultAmbientGroup.innerHTML = '';
    this.defaultAmbientGroup.appendChild(ambientFrag);
  }

  /** Сгенерировать переключатели видимости из HTML-шаблона */
  _renderVisibilityTogglesHTML() {
    const tmpl = document.getElementById('tmpl-admin-visibility-toggle');
    const frag = document.createDocumentFragment();

    for (const { key, label } of getVisibilityToggles()) {
      const clone = tmpl.content.cloneNode(true);
      clone.querySelector('.visibility-toggle-label').textContent = label;
      clone.querySelector('input[type="checkbox"]').dataset.visibility = key;
      frag.appendChild(clone);
    }

    this.visibilityToggles.innerHTML = '';
    this.visibilityToggles.appendChild(frag);
  }

  async _renderSettingsVisibility() {
    const v = await this.store.getSettingsVisibility();
    const inputs = this.visibilityToggles.querySelectorAll('[data-visibility]');
    inputs.forEach(input => {
      const key = input.dataset.visibility;
      if (key in v) {
        input.checked = v[key];
      }
    });
  }

  _saveSettings() {
    const activeTheme = document.querySelector('#defaultTheme .setting-theme-btn.active');
    const activeAmbient = document.querySelector('#defaultAmbient .setting-ambient-btn.active');

    this.store.updateDefaultSettings({
      font: this.defaultFont.value,
      fontSize: parseInt(this.defaultFontSize.value, 10),
      theme: activeTheme ? activeTheme.dataset.theme : 'light',
      soundEnabled: this.defaultSound.checked,
      soundVolume: parseInt(this.defaultVolume.value, 10) / 100,
      ambientType: activeAmbient ? activeAmbient.dataset.ambient : 'none',
    });

    this._renderJsonPreview();
    this._showToast(t('admin.settings.saved'));
  }

  async _resetSettings() {
    await this.store.updateDefaultSettings({
      font: 'georgia',
      fontSize: 18,
      theme: 'light',
      soundEnabled: true,
      soundVolume: 0.3,
      ambientType: 'none',
      ambientVolume: 0.5,
    });

    await this.store.updateSettingsVisibility({
      fontSize: true,
      theme: true,
      font: true,
      fullscreen: true,
      sound: true,
      ambient: true,
    });

    await this._renderSettings();
    await this._renderSettingsVisibility();
    this._renderJsonPreview();
    this._showToast(t('admin.settings.reset'));
  }

  /** Обновить select шрифтов в настройках по умолчанию */
  async updateFontSelect() {
    const allFonts = await this.store.getReadingFonts();
    const fonts = allFonts.filter(f => f.enabled);
    const current = this.defaultFont.value;
    this.defaultFont.innerHTML = fonts.map(f =>
      `<option value="${this._escapeHtml(f.id)}">${this._escapeHtml(f.label)}</option>`
    ).join('');

    const hasCurrentFont = fonts.some(f => f.id === current);
    if (hasCurrentFont) {
      this.defaultFont.value = current;
    } else if (fonts.length > 0) {
      this.defaultFont.value = fonts[0].id;
    }
  }
}
