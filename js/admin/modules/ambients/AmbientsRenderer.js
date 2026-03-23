/**
 * AMBIENTS RENDERER
 *
 * Генерация HTML для карточек и тела раскрытой карточки амбиента.
 * Функции вызываются с контекстом модуля (bind/call) или принимают модуль как параметр.
 */

import { t } from '@i18n';

/** i18n-ключи для builtin-амбиентов */
const BUILTIN_I18N = {
  none: { label: 'ambient.none', short: 'ambient.noneShort' },
  rain: { label: 'ambient.rain', short: 'ambient.rainShort' },
  fireplace: { label: 'ambient.fireplace', short: 'ambient.fireplaceShort' },
  cafe: { label: 'ambient.cafe', short: 'ambient.cafeShort' },
};

/**
 * Получить отображаемый label для амбиента.
 * @param {Object} a - амбиент
 * @returns {string}
 */
export function getDisplayLabel(ambient) {
  const keys = ambient.builtin ? BUILTIN_I18N[ambient.id] : null;
  return keys ? t(keys.label) : ambient.label;
}

/**
 * Получить отображаемый short label для амбиента.
 * @param {Object} a - амбиент
 * @returns {string}
 */
export function getDisplayShortLabel(ambient) {
  const keys = ambient.builtin ? BUILTIN_I18N[ambient.id] : null;
  return keys ? t(keys.short) : (ambient.shortLabel || ambient.label);
}

/**
 * Извлечь имя файла из URL или пути
 * @param {string} fileUrl
 * @returns {string|null}
 */
export function extractFileName(fileUrl) {
  if (!fileUrl) return null;
  if (fileUrl.startsWith('data:')) return t('admin.ambients.fileLoaded');
  try {
    const url = new URL(fileUrl, window.location.origin);
    const path = url.pathname;
    return path.substring(path.lastIndexOf('/') + 1) || t('admin.ambients.fileLoaded');
  } catch {
    // Относительный путь
    return fileUrl.substring(fileUrl.lastIndexOf('/') + 1) || fileUrl;
  }
}

/**
 * Генерировать HTML одной карточки амбиента
 * @param {Object} module - AmbientsModule instance
 * @param {Object} ambient - амбиент
 * @param {number} index - индекс
 * @returns {string} HTML
 */
export function renderAmbientCard(module, ambient, index) {
  const isNone = ambient.id === 'none';
  const isUploaded = ambient.file && (ambient.file.startsWith('data:') || ambient.file.startsWith('http'));
  const meta = ambient.file
    ? module._escapeHtml(isUploaded ? t('admin.ambients.uploadedFile') : ambient.file)
    : t('admin.ambients.noFile');
  const isExpanded = module._expandedIndex === index;
  const canExpand = !ambient.builtin;
  const hasFile = ambient.file && !isNone;
  const isPlaying = module._playingIndex === index;
  const displayLabel = getDisplayLabel(ambient);

  return `
    <div class="ambient-card${ambient.visible ? '' : ' hidden-ambient'}${isExpanded ? ' ambient-card--expanded' : ''}" data-index="${index}">
      <div class="ambient-card-header"${canExpand ? ` data-ambient-toggle-expand="${index}"` : ''}>
        ${canExpand ? `
          <svg class="ambient-expand-icon" viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
          </svg>
        ` : ''}
        <div class="ambient-card-icon">${module._escapeHtml(ambient.icon)}</div>
        <div class="ambient-card-info">
          <div class="ambient-card-label">${module._escapeHtml(displayLabel)}</div>
          <div class="ambient-card-meta">${meta}</div>
        </div>
        <div class="ambient-card-actions">
          ${hasFile ? `
            <button class="sound-preview-btn${isPlaying ? ' playing' : ''}" type="button" data-ambient-preview="${index}" title="${t('admin.sounds.preview')}">
              <svg class="sound-preview-play" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"${isPlaying ? ' hidden' : ''}>
                <path fill="currentColor" d="M8 5v14l11-7z"/>
              </svg>
              <svg class="sound-preview-stop" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"${isPlaying ? '' : ' hidden'}>
                <path fill="currentColor" d="M6 6h12v12H6z"/>
              </svg>
              <span class="sound-preview-label">${t('admin.sounds.preview')}</span>
            </button>
          ` : ''}
          ${!isNone ? `
            <label class="admin-toggle" title="${ambient.visible ? t('admin.ambients.hide') : t('admin.ambients.show')}">
              <input type="checkbox" data-ambient-toggle="${index}" ${ambient.visible ? 'checked' : ''}>
              <span class="admin-toggle-slider"></span>
            </label>
          ` : ''}
          ${!ambient.builtin ? `
            <button class="chapter-action-btn delete" data-ambient-delete="${index}" title="${t('common.delete')}">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          ` : ''}
        </div>
      </div>
      <div class="ambient-card-body">
        ${isExpanded ? renderAmbientBody(module, ambient) : ''}
      </div>
    </div>
  `;
}

/**
 * HTML тела раскрытой карточки
 * @param {Object} module - AmbientsModule instance
 * @param {Object} ambient - амбиент
 * @returns {string} HTML
 */
export function renderAmbientBody(module, ambient) {
  const hasFile = !!ambient.file;
  const fileName = module._pendingAmbientFileName
    || (hasFile ? extractFileName(ambient.file) : null);

  return `
    <div class="form-group">
      <label class="form-label">${t('admin.modal.ambient.nameLabel')}</label>
      <input class="form-input ambient-inline-label" type="text" value="${module._escapeHtml(ambient.label)}" placeholder="${t('admin.modal.ambient.namePlaceholder')}" required>
    </div>
    <div class="form-group">
      <label class="form-label">${t('admin.modal.ambient.iconLabel')}</label>
      <input class="form-input ambient-inline-icon" type="text" value="${module._escapeHtml(ambient.icon)}" placeholder="🌊" required maxlength="4">
      <span class="form-hint">${t('admin.modal.ambient.iconHint')}</span>
    </div>
    <div class="form-group">
      <label class="btn btn-secondary upload-btn ambient-inline-upload-label">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
        </svg>
        <span class="ambient-inline-upload-text">${t('admin.ambients.selectFile')}</span>
        <input type="file" class="ambient-inline-file-upload" accept="audio/*" hidden>
      </label>
      <span class="form-hint">${t('admin.modal.ambient.fileSizeHint')}</span>
      ${fileName ? `
        <div class="decorative-font-info" style="display:flex">
          <span class="decorative-font-name">${module._escapeHtml(fileName)}</span>
        </div>
      ` : ''}
    </div>
    <div class="chapter-save-row">
      <button type="button" class="btn btn-primary chapter-save-btn" data-ambient-save>
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
        ${t('common.save')}
      </button>
    </div>`;
}
