/**
 * ADMIN TEMPLATES FOR TESTS
 * Минимальные шаблоны <template>, необходимые модулям в тестовой среде.
 * Вызов setupAdminTemplates() добавляет все admin-шаблоны в document.body.
 */

const TEMPLATES = {
  'tmpl-admin-sound-card': `
    <div class="setting-card setting-card--sound" data-sound-key="">
      <label class="setting-label"></label>
      <div class="sound-selector">
        <div class="sound-options">
          <button class="sound-option active" type="button" data-sound-mode="default">
            <span class="sound-option-icon"></span>
            <span class="sound-option-label" data-i18n="admin.sounds.soundDefault"></span>
          </button>
          <label class="sound-option sound-option--upload" data-sound-mode="custom">
            <span class="sound-option-icon sound-option-icon--upload"></span>
            <span class="sound-option-label" data-i18n="admin.sounds.soundCustom"></span>
            <input type="file" class="sound-upload-input" accept="audio/*" hidden>
          </label>
        </div>
        <div class="sound-custom-info" hidden>
          <span class="sound-custom-name" data-i18n="admin.sounds.uploadedHint"></span>
          <button class="sound-custom-remove" type="button"></button>
        </div>
        <button class="sound-preview-btn" type="button">
          <svg class="sound-preview-play" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
          <svg class="sound-preview-stop" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" hidden><path fill="currentColor" d="M6 6h12v12H6z"/></svg>
          <span class="sound-preview-label"></span>
        </button>
      </div>
      <input type="hidden" class="sound-mode-input" value="default">
    </div>`,

  'tmpl-admin-chapter-card': `
    <div class="chapter-card">
      <div class="chapter-card-header" data-action="toggle">
        <div class="chapter-drag"></div>
        <svg class="chapter-expand-icon" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
        <div class="chapter-info">
          <div class="chapter-title"></div>
          <div class="chapter-meta"></div>
        </div>
        <div class="chapter-actions">
          <button class="chapter-action-btn chapter-move-up-btn" data-action="up" type="button" hidden></button>
          <button class="chapter-action-btn chapter-move-down-btn" data-action="down" type="button" hidden></button>
          <button class="chapter-action-btn delete" data-action="delete" type="button"></button>
        </div>
      </div>
      <div class="chapter-card-body"></div>
    </div>`,

  'tmpl-admin-book-card': `
    <div class="book-card" tabindex="0" role="button">
      <div class="book-card-info">
        <div class="book-card-title"></div>
        <div class="book-card-meta"></div>
      </div>
      <div class="book-card-actions">
        <div class="book-card-sort">
          <button class="chapter-action-btn book-move-up-btn" data-book-move="up" type="button" hidden></button>
          <button class="chapter-action-btn book-move-down-btn" data-book-move="down" type="button" hidden></button>
        </div>
        <span class="book-card-active-badge" hidden></span>
        <button class="chapter-action-btn delete book-delete-btn" type="button" hidden></button>
      </div>
    </div>`,

  'tmpl-admin-reading-font-card': `
    <div class="reading-font-card">
      <div class="reading-font-preview"></div>
      <div class="reading-font-info">
        <div class="reading-font-label"></div>
        <div class="reading-font-meta"></div>
      </div>
      <div class="reading-font-actions">
        <label class="admin-toggle">
          <input type="checkbox" class="font-toggle-input">
          <span class="admin-toggle-slider"></span>
        </label>
        <button class="chapter-action-btn delete font-delete-btn" type="button" hidden></button>
      </div>
    </div>`,

  'tmpl-admin-visibility-toggle': `
    <div class="visibility-toggle-row">
      <span class="visibility-toggle-label"></span>
      <label class="admin-toggle">
        <input type="checkbox" checked>
        <span class="admin-toggle-slider"></span>
      </label>
    </div>`,

  'tmpl-admin-ambient-btn': `
    <button class="setting-ambient-btn" type="button" data-ambient=""></button>`,

  'tmpl-admin-album-page-card': `
    <div class="album-page-card">
      <div class="album-page-header">
        <span class="album-page-title"></span>
        <span class="album-page-move">
          <button class="album-page-move-btn album-page-move-up" type="button" hidden></button>
          <button class="album-page-move-btn album-page-move-down" type="button" hidden></button>
        </span>
        <button class="album-page-remove" type="button" hidden></button>
        <button class="album-page-bulk-btn" type="button"></button>
      </div>
      <div class="album-layouts"></div>
      <div class="album-images"></div>
    </div>`,

  'tmpl-album-image-slot': `
    <span class="album-image-slot-placeholder">
      <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/></svg>
      <span class="album-image-slot-placeholder-text"></span>
    </span>
    <span class="album-image-slot-num"></span>
    <button class="album-image-slot-rotate" type="button" title="Повернуть на 90°"></button>
    <button class="album-image-slot-crop" type="button" title="Кадрировать"></button>
    <button class="album-image-slot-uncrop" type="button" title="Сбросить кадрирование"></button>
    <button class="album-image-slot-remove" type="button" title="Удалить">&times;</button>`,

  'tmpl-bookshelf-type-option': `
    <button type="button" class="bookshelf-type-option">
      <div class="bookshelf-type-option-icon">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"></svg>
      </div>
      <div class="bookshelf-type-option-label"></div>
    </button>`,

  'tmpl-profile-preview': `
    <div class="profile-header profile-header--preview">
      <div class="profile-header-avatar">
        <span class="profile-header-initial"></span>
      </div>
      <div class="profile-header-info">
        <h2 class="profile-header-name"></h2>
        <span class="profile-header-username"></span>
        <p class="profile-header-bio"></p>
      </div>
    </div>`,
};

/**
 * Добавить указанные шаблоны в DOM
 * @param {...string} ids — ID шаблонов (без 'tmpl-' префикса не требуется, передавайте полный id)
 */
export function setupTemplates(...ids) {
  for (const id of ids) {
    if (!TEMPLATES[id]) {
      throw new Error(`Unknown template: ${id}`);
    }
    // Не дублируем
    if (document.getElementById(id)) continue;

    const tmpl = document.createElement('template');
    tmpl.id = id;
    tmpl.innerHTML = TEMPLATES[id];
    document.body.appendChild(tmpl);
  }
}

/**
 * Добавить все admin-шаблоны в DOM
 */
export function setupAllAdminTemplates() {
  setupTemplates(...Object.keys(TEMPLATES));
}

/**
 * Удалить все шаблоны из DOM
 */
export function cleanupTemplates() {
  document.querySelectorAll('template').forEach(t => t.remove());
}
