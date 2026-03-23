/**
 * Редактирование контента глав
 * Inline-редактирование, Quill-интеграция, селектор фона, сохранение.
 * Извлечён из ChaptersModule для разделения ответственности.
 */
import { QuillEditorWrapper } from './QuillEditorWrapper.js';
import { uploadWithFallback, setupDropzone } from './adminHelpers.js';
import { renderChapterBody, renderSectionBody, renderBgSelector } from './ChapterEditorRenderer.js';
import { t } from '@i18n';

export class ChapterEditor {
  /**
   * @param {import('./ChaptersModule.js').ChaptersModule} host - Родительский модуль
   */
  constructor(host) {
    this._host = host;
    /** HTML-контент, загруженный через файл (pending до сохранения) */
    this._pendingHtmlContent = null;
    /** @type {QuillEditorWrapper} */
    this._quill = new QuillEditorWrapper(host.store);
    /** @type {'upload'|'editor'} Текущий режим ввода контента */
    this._inputMode = 'upload';
  }

  // ═══════════════════════════════════════════
  // РАСКРЫТИЕ / СВЁРТЫВАНИЕ
  // ═══════════════════════════════════════════

  /**
   * Раскрыть карточку главы для редактирования
   * @param {number} index
   */
  async toggleChapter(index) {
    const host = this._host;
    const chapters = await host.store.getChapters();
    const chapter = chapters[index];

    if (host._expandedIndex === index) {
      // Свернуть — сохранить и закрыть
      await this.saveExpandedChapter();
      this.collapseAll();
      return;
    }

    // Сохранить предыдущую раскрытую (если есть)
    await this.saveExpandedChapter();
    this.collapseAll();

    // Подгрузить htmlContent, если на сервере есть контент, но он не загружен
    if (chapter._hasHtmlContent && !chapter.htmlContent && host.store.getChapterContent) {
      chapter.htmlContent = await host.store.getChapterContent(index);
    }

    // Раскрыть новую
    host._expandedIndex = index;
    const card = host.chaptersList.querySelector(`.chapter-card[data-index="${index}"]`);
    if (!card) return;

    card.classList.add('chapter-card--expanded');
    const body = card.querySelector('.chapter-card-body');

    if (chapter?.albumData) {
      // Альбомный раздел — инициализируем inline-редактор альбома
      body.innerHTML = this._renderSectionBody(chapter, index);
      this._initInlineSectionControls(body, chapter, index);
    } else {
      body.innerHTML = this._renderChapterBody(chapter, index);
      // Инициализировать файловую дропзону и переключатель режимов
      this._initInlineControls(body, chapter);
    }
  }

  /** Свернуть все карточки */
  collapseAll() {
    const host = this._host;
    host._expandedIndex = -1;
    this.destroyInlineEditor();
    this._pendingHtmlContent = null;
    this._inputMode = 'upload';
    // Восстановить albumPagesEl, если был inline-режим альбома
    if (host._restoreAlbumPagesEl) {
      host._restoreAlbumPagesEl();
      host._restoreAlbumPagesEl = null;
    }
    host.chaptersList.querySelectorAll('.chapter-card--expanded').forEach(card => {
      card.classList.remove('chapter-card--expanded');
      const body = card.querySelector('.chapter-card-body');
      if (body) body.innerHTML = '';
    });
  }

  // ═══════════════════════════════════════════
  // РЕНДЕР ТЕЛА КАРТОЧКИ
  // ═══════════════════════════════════════════

  /** @see renderChapterBody — делегирует в ChapterEditorRenderer */
  _renderChapterBody(ch, _index) {
    return renderChapterBody(ch, (s) => this._host._escapeHtml(s));
  }

  /** @see renderSectionBody — делегирует в ChapterEditorRenderer */
  _renderSectionBody(ch, _index) {
    return renderSectionBody(ch, (s) => this._host._escapeHtml(s));
  }

  /** @see renderBgSelector — делегирует в ChapterEditorRenderer */
  _renderBgSelector(ch) {
    return renderBgSelector(ch, (s) => this._host._escapeHtml(s));
  }

  // ═══════════════════════════════════════════
  // ИНИЦИАЛИЗАЦИЯ КОНТРОЛОВ
  // ═══════════════════════════════════════════

  /**
   * Инициализировать интерактивные элементы в раскрытой карточке главы
   */
  _initInlineControls(body, ch) {
    const toggle = body.querySelector('.chapter-inline-toggle');
    const uploadPanel = body.querySelector('.chapter-inline-upload-panel');
    const editorPanel = body.querySelector('.chapter-inline-editor-panel');
    const fileInput = body.querySelector('.chapter-inline-file-input');
    const dropzone = body.querySelector('.chapter-inline-file-dropzone');
    const fileInfo = body.querySelector('.chapter-inline-file-info');
    const fileRemove = body.querySelector('[data-action-inline="remove-file"]');
    const editorContainer = body.querySelector('.chapter-inline-editor-container');

    // Запомнить текущий режим
    this._inputMode = ch.htmlContent ? 'editor' : 'upload';
    this._pendingHtmlContent = ch.htmlContent || null;

    // Переключатель режима
    toggle.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-input-mode]');
      if (!btn) return;
      const mode = btn.dataset.inputMode;
      if (mode === this._inputMode) return;

      this._inputMode = mode;
      toggle.querySelectorAll('.chapter-inline-toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.inputMode === mode);
      });
      uploadPanel.hidden = (mode !== 'upload');
      editorPanel.hidden = (mode !== 'editor');

      if (mode === 'editor') {
        if (!this._quill.isInitialized) {
          await this._quill.init(editorContainer);
        }
        if (this._pendingHtmlContent) {
          this._quill.setHTML(this._pendingHtmlContent);
        }
      }
    });

    // Дропзона загрузки файла
    if (dropzone && fileInput) {
      setupDropzone(dropzone, fileInput, (file) => this._host._importer.processInlineFile(file, body));
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this._host._importer.processInlineFile(file, body);
      });
    }

    // Удаление файла
    if (fileRemove) {
      fileRemove.addEventListener('click', () => {
        this._pendingHtmlContent = null;
        if (this._quill.isInitialized) this._quill.clear();
        if (dropzone) dropzone.hidden = false;
        if (fileInfo) fileInfo.hidden = true;
      });
    }

    // Кнопка «Сохранить главу»
    const saveBtn = body.querySelector('[data-action-inline="save-chapter"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSaveChapterClick());
    }

    // Если есть htmlContent — инициализировать Quill
    if (ch.htmlContent) {
      this._quill.init(editorContainer).then(() => {
        this._quill.setHTML(ch.htmlContent);
      });
    }

    // Селектор фона главы
    this._initChapterBgSelector(body);
  }

  /**
   * Инициализировать элементы управления для inline-раздела альбома
   */
  _initInlineSectionControls(body, ch, index) {
    const host = this._host;
    const pagesContainer = body.querySelector('.section-inline-album-pages');
    const addPageBtn = body.querySelector('.section-add-page');
    const bulkUploadBtn = body.querySelector('.section-bulk-upload');

    // Сохраняем ссылку на текущие данные страниц
    const albumData = ch.albumData || { title: '', hideTitle: true, pages: [{ layout: '1', images: [] }] };
    host._inlineAlbumPages = structuredClone(albumData.pages);

    // Настроить AlbumManager для работы с inline-контейнером
    host._album._albumPages = host._inlineAlbumPages;
    host._album._editingChapterIndex = index;
    host._album._isDirty = false;

    // Подменяем albumPagesEl на inline-контейнер
    const origPagesEl = host._album.albumPagesEl;
    host._album.albumPagesEl = pagesContainer;
    host._album._renderAlbumPages();

    // Восстанавливаем оригинал при сворачивании (через collapseAll hook)
    host._restoreAlbumPagesEl = () => {
      host._album.albumPagesEl = origPagesEl;
      host._inlineAlbumPages = null;
    };

    // Кнопка «+ Добавить страницу»
    addPageBtn.addEventListener('click', () => {
      host._album._addAlbumPage();
    });

    // Кнопка «Загрузить фото»
    bulkUploadBtn.addEventListener('click', () => {
      host._album._bulkUpload();
    });

    // Селектор фона раздела
    this._initChapterBgSelector(body);

    // Кнопка «Сохранить главу»
    const saveBtn = body.querySelector('[data-action-inline="save-chapter"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSaveChapterClick());
    }
  }

  // ═══════════════════════════════════════════
  // СЕЛЕКТОР ФОНА
  // ═══════════════════════════════════════════

  _initChapterBgSelector(body) {
    const noneBtn = body.querySelector('[data-chapter-bg-mode="none"]');
    const uploadLabel = body.querySelector('.texture-option--upload.chapter-bg-option');
    const bgFileInput = body.querySelector('.chapter-bg-file-input');
    const bgThumb = body.querySelector('.chapter-bg-thumb');
    const bgCustomInfo = body.querySelector('.chapter-bg-custom-info');
    const bgRemove = body.querySelector('.chapter-bg-remove');
    const bgHidden = body.querySelector('.chapter-inline-bg-value');

    // Выбор «Нет»
    noneBtn?.addEventListener('click', () => {
      bgHidden.value = '';
      noneBtn.classList.add('active');
      uploadLabel?.classList.remove('active');
      bgThumb.style.backgroundImage = '';
      bgThumb.classList.remove('has-image');
      bgThumb.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>';
      bgCustomInfo.hidden = true;
    });

    // Загрузка файла
    bgFileInput?.addEventListener('change', (e) => this._handleChapterBgUpload(e, body));

    // Удаление фона
    bgRemove?.addEventListener('click', () => {
      noneBtn?.click();
      this._host._showToast(t('admin.chapters.bgRemoved'));
    });
  }

  async _handleChapterBgUpload(e, body) {
    const file = e.target.files[0];
    if (!file) return;

    if (!this._host._validateFile(file, { maxSize: 2 * 1024 * 1024, mimePrefix: 'image/', inputEl: e.target })) return;

    const imageData = await uploadWithFallback(this._host.store, file, 'image');

    const noneBtn = body.querySelector('[data-chapter-bg-mode="none"]');
    const uploadLabel = body.querySelector('.texture-option--upload.chapter-bg-option');
    const bgThumb = body.querySelector('.chapter-bg-thumb');
    const bgCustomInfo = body.querySelector('.chapter-bg-custom-info');
    const bgHidden = body.querySelector('.chapter-inline-bg-value');

    bgHidden.value = imageData;
    noneBtn?.classList.remove('active');
    uploadLabel?.classList.add('active');
    bgThumb.style.backgroundImage = `url(${imageData})`;
    bgThumb.classList.add('has-image');
    bgThumb.innerHTML = '';
    bgCustomInfo.hidden = false;

    this._host._showToast(t('admin.chapters.bgLoaded'));
    e.target.value = '';
  }

  // ═══════════════════════════════════════════
  // СОХРАНЕНИЕ
  // ═══════════════════════════════════════════

  /**
   * Обработчик нажатия кнопки «Сохранить главу»
   */
  async handleSaveChapterClick() {
    const saveBtn = this._host.chaptersList.querySelector('[data-action-inline="save-chapter"]');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = t('common.saving');
    }
    try {
      await this.saveExpandedChapter();
      this._host._showToast(t('admin.chapters.chapterSaved'));
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg> ${t('admin.chapters.saveChapter')}`;
      }
    }
  }

  /**
   * Сохранить данные раскрытой карточки в store
   */
  async saveExpandedChapter() {
    const host = this._host;
    if (host._expandedIndex < 0) return;

    const card = host.chaptersList.querySelector(`.chapter-card[data-index="${host._expandedIndex}"]`);
    if (!card || !card.classList.contains('chapter-card--expanded')) return;

    const body = card.querySelector('.chapter-card-body');
    if (!body) return;

    const chapters = await host.store.getChapters();
    const existing = chapters[host._expandedIndex];
    if (!existing) return;

    // Сохранение inline-раздела альбома
    if (host._inlineAlbumPages) {
      const sectionTitle = body.querySelector('.section-inline-title')?.value.trim() || '';
      const hideTitle = body.querySelector('.section-inline-hide-title')?.checked ?? true;
      const background = body.querySelector('.chapter-inline-bg-value')?.value || '';

      const albumData = {
        title: sectionTitle,
        hideTitle,
        pages: structuredClone(host._album._albumPages),
      };

      // Сгенерировать HTML из альбомных данных
      const htmlContent = host._album._buildAlbumHtml(albumData);

      await host.store.updateChapter(host._expandedIndex, {
        ...existing,
        title: sectionTitle || existing.title,
        htmlContent,
        albumData,
        bg: background,
      });
      host._renderJsonPreview();
      return;
    }

    // Обычная глава
    const idInput = body.querySelector('.chapter-inline-id');
    const titleInput = body.querySelector('.chapter-inline-title');
    const bgHidden = body.querySelector('.chapter-inline-bg-value');

    const id = idInput?.value.trim();
    const title = titleInput?.value.trim() || '';
    const background = bgHidden?.value || '';

    // Собрать контент из Quill, если в режиме редактора
    if (this._inputMode === 'editor' && this._quill.isInitialized && !this._quill.isEmpty()) {
      this._pendingHtmlContent = this._quill.getHTML();
    }

    const chapter = {
      id: id || existing.id,
      title,
      file: existing.file || '',
      bg: background,
    };

    if (this._pendingHtmlContent) {
      chapter.htmlContent = this._pendingHtmlContent;
    } else if (existing.htmlContent) {
      chapter.htmlContent = existing.htmlContent;
    }

    // Сохраняем albumData, если есть
    if (existing.albumData) {
      chapter.albumData = existing.albumData;
    }

    await host.store.updateChapter(host._expandedIndex, chapter);
    host._renderJsonPreview();
  }

  /** Уничтожить inline-редактор Quill */
  destroyInlineEditor() {
    if (this._quill.isInitialized) {
      this._quill.destroy();
    }
    this._pendingHtmlContent = null;
  }
}
