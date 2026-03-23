/**
 * Модуль экспорта/импорта конфигурации
 */
import { BaseModule } from './BaseModule.js';
import { trackExportConfig } from '../../utils/Analytics.js';
import { t } from '@i18n';

export class ExportModule extends BaseModule {
  cacheDOM() {
    this.exportBtn = document.getElementById('exportConfig');
    this.importInput = document.getElementById('importConfig');
    this.resetAllBtn = document.getElementById('resetAll');
    this.jsonPreview = document.getElementById('jsonPreview');
    this.copyJsonBtn = document.getElementById('copyJson');
  }

  bindEvents() {
    this.exportBtn.addEventListener('click', () => this._exportConfig());
    this.importInput.addEventListener('change', (e) => this._importConfig(e));
    this.resetAllBtn.addEventListener('click', () => this._resetAll());
    this.copyJsonBtn.addEventListener('click', () => this._copyJson());
  }

  render() {
    this.renderJsonPreview();
  }

  renderJsonPreview() {
    this.jsonPreview.textContent = this.store.exportJSON();
  }

  _exportConfig() {
    const json = this.store.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'flipbook-config.json';
    downloadLink.click();

    URL.revokeObjectURL(url);
    trackExportConfig();
    this._showToast(t('admin.export.downloaded'));
  }

  _importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.store.importJSON(reader.result);
        this.app._render();
        this._showToast(t('admin.export.loaded'));
      } catch {
        this._showToast(t('admin.export.invalidJson'));
      }
    };
    reader.readAsText(file);

    e.target.value = '';
  }

  async _resetAll() {
    const ok = await this._confirm(
      t('admin.export.resetMessage'),
      { title: t('admin.export.resetTitle'), okText: t('common.reset') },
    );
    if (!ok) return;

    this.store.clear();
    this.app._render();
    this._showToast(t('admin.export.resetDone'));
  }

  _copyJson() {
    navigator.clipboard.writeText(this.store.exportJSON()).then(() => {
      this._showToast(t('admin.export.copied'));
    });
  }
}
