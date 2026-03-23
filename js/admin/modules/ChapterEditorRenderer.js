/**
 * Рендер-функции для карточек глав
 *
 * Чистые функции: принимают данные главы, возвращают HTML-строку.
 * Извлечены из ChapterEditor для разделения рендеринга и бизнес-логики.
 */
import { t } from '@i18n';

/**
 * HTML тела раскрытой карточки обычной главы
 * @param {Object} ch - Данные главы
 * @param {function} esc - Функция экранирования HTML
 * @returns {string} HTML-строка
 */
export function renderChapterBody(ch, esc) {
  const hasHtml = !!ch.htmlContent;
  const hasFile = !!ch.file;
  const uploadActive = !hasHtml ? 'active' : '';
  const editorActive = hasHtml ? 'active' : '';

  return `
      <div class="form-group">
        <label class="form-label">${t('admin.modal.chapter.idLabel')}</label>
        <input class="form-input chapter-inline-id" type="text" value="${esc(ch.id)}" placeholder="${t('admin.modal.chapter.idPlaceholder')}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('admin.modal.chapter.titleLabel')}</label>
        <input class="form-input chapter-inline-title" type="text" value="${esc(ch.title || '')}" placeholder="${t('admin.modal.chapter.titlePlaceholder')}">
      </div>
      <div class="form-group">
        <label class="form-label">${t('admin.modal.chapter.contentLabel')}</label>
        <div class="chapter-inline-toggle">
          <button type="button" class="chapter-inline-toggle-btn ${uploadActive}" data-input-mode="upload">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
            ${t('admin.modal.chapter.uploadMode')}
          </button>
          <button type="button" class="chapter-inline-toggle-btn ${editorActive}" data-input-mode="editor">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            ${t('admin.modal.chapter.editorMode')}
          </button>
        </div>
        <!-- Режим: загрузка файла -->
        <div class="chapter-inline-upload-panel" ${hasHtml ? 'hidden' : ''}>
          <input type="file" class="chapter-inline-file-input" accept=".doc,.docx,.html,.htm,.txt" hidden>
          <div class="chapter-inline-file-dropzone" ${hasFile ? 'hidden' : ''}>
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
            </svg>
            <p class="chapter-file-text">${t('admin.modal.chapter.dropzoneText')}</p>
            <p class="chapter-file-hint">${t('admin.modal.chapter.dropzoneHint')}</p>
          </div>
          <div class="chapter-inline-file-info" ${hasFile ? '' : 'hidden'}>
            <span class="chapter-inline-file-name">${hasFile ? esc(ch.file) : ''}</span>
            <button type="button" class="chapter-file-remove" data-action-inline="remove-file" title="${t('admin.modal.chapter.removeFile')}">&times;</button>
          </div>
        </div>
        <!-- Режим: WYSIWYG-редактор -->
        <div class="chapter-inline-editor-panel" ${hasHtml ? '' : 'hidden'}>
          <div class="chapter-inline-editor-container"></div>
        </div>
      </div>
      ${renderBgSelector(ch, esc)}
      <div class="chapter-save-row">
        <button type="button" class="btn btn-primary chapter-save-btn" data-action-inline="save-chapter">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          ${t('admin.chapters.saveChapter')}
        </button>
      </div>`;
}

/**
 * HTML тела раскрытого раздела альбома
 * @param {Object} ch - Данные главы с albumData
 * @param {function} esc - Функция экранирования HTML
 * @returns {string} HTML-строка
 */
export function renderSectionBody(ch, esc) {
  const data = ch.albumData || { title: '', hideTitle: true, pages: [] };

  return `
      <div class="form-group">
        <label class="form-label">${t('admin.album.titleLabel')}</label>
        <input class="form-input section-inline-title" type="text" value="${esc(data.title || '')}" placeholder="${t('admin.album.titlePlaceholder')}">
      </div>
      <div class="form-group">
        <label class="admin-toggle album-hide-toggle">
          <input type="checkbox" class="section-inline-hide-title" ${data.hideTitle !== false ? 'checked' : ''}>
          <span class="admin-toggle-slider"></span>
        </label>
        <span class="album-hide-label">${t('admin.album.hideTitleLabel')}</span>
        <span class="form-hint">${t('admin.album.hideTitleHint')}</span>
      </div>
      <div class="section-inline-album-pages"></div>
      <div class="album-actions-row">
        <button class="btn btn-secondary album-add-page-btn section-add-page" type="button">${t('admin.album.addPage')}</button>
        <button class="btn btn-secondary album-bulk-upload-btn section-bulk-upload" type="button">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
          <span>${t('admin.album.bulkUpload')}</span>
        </button>
      </div>
      ${renderBgSelector(ch, esc)}
      <div class="chapter-save-row">
        <button type="button" class="btn btn-primary chapter-save-btn" data-action-inline="save-chapter">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          ${t('admin.chapters.saveChapter')}
        </button>
      </div>`;
}

/**
 * HTML селектора фона (для глав и разделов)
 * @param {Object} ch - Данные главы
 * @param {function} esc - Функция экранирования HTML
 * @returns {string} HTML-строка
 */
export function renderBgSelector(ch, esc) {
  return `
      <div class="form-group setting-card--texture">
        <label class="form-label">${t('admin.modal.chapter.bgLabel')}</label>
        <div class="texture-selector">
          <div class="texture-options">
            <button class="texture-option chapter-bg-option ${!ch.bg ? 'active' : ''}" type="button" data-chapter-bg-mode="none">
              <span class="texture-thumb texture-thumb--none"></span>
              <span class="texture-option-label">${t('admin.modal.chapter.bgNone')}</span>
            </button>
            <label class="texture-option texture-option--upload chapter-bg-option ${ch.bg ? 'active' : ''}">
              <span class="texture-thumb texture-thumb--upload chapter-bg-thumb" ${ch.bg ? `style="background-image:url(${esc(ch.bg)})"` : ''}>
                ${ch.bg ? '' : `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>`}
              </span>
              <span class="texture-option-label">${t('admin.modal.chapter.bgCustom')}</span>
              <input type="file" class="chapter-bg-file-input" accept="image/*" hidden>
            </label>
          </div>
          <div class="texture-custom-info chapter-bg-custom-info" ${ch.bg ? '' : 'hidden'}>
            <span class="texture-custom-name chapter-bg-custom-name">${t('admin.modal.chapter.bgCustomImageName')}</span>
            <button class="texture-custom-remove chapter-bg-remove" type="button" title="${t('admin.modal.chapter.bgCustomImageRemove')}">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>
        <input type="hidden" class="chapter-inline-bg-value" value="${esc(ch.bg || '')}">
      </div>`;
}
