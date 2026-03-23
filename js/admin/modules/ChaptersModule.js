/**
 * Модуль управления главами, обложкой и книгами
 * Делегирует:
 *   список глав → ChapterListManager
 *   редактирование → ChapterEditor
 *   импорт → ChapterImporter
 *   валидацию → ChapterValidator
 *   фотоальбом → AlbumManager
 *   загрузку книг → BookUploadManager
 *   переключатель книг → BookSelectorManager
 *   обложку → CoverManager
 *   файлы глав → ChapterFileHandler
 *
 * Главы редактируются inline — раскрывающиеся карточки вместо модального окна.
 */
import { BaseModule } from './BaseModule.js';
import { AlbumManager } from './AlbumManager.js';
import { BookUploadManager } from './BookUploadManager.js';
import { BookSelectorManager } from './BookSelectorManager.js';
import { CoverManager } from './CoverManager.js';
import { ChapterFileHandler } from './ChapterFileHandler.js';
import { ChapterListManager } from './ChapterListManager.js';
import { ChapterEditor } from './ChapterEditor.js';
import { ChapterImporter } from './ChapterImporter.js';
import { ChapterValidator } from './ChapterValidator.js';
import { setupDropzone } from './adminHelpers.js';
import { t } from '@i18n';

export class ChaptersModule extends BaseModule {
  constructor(app) {
    super(app);
    /** Индекс раскрытой главы (-1 = все свёрнуты) */
    this._expandedIndex = -1;

    // Делегаты глав
    this._validator = new ChapterValidator(this);
    this._editor = new ChapterEditor(this);
    this._importer = new ChapterImporter(this);
    this._listManager = new ChapterListManager(this);

    // Прочие делегаты
    this._album = new AlbumManager(this);
    this._bookUpload = new BookUploadManager(this);
    this._bookSelector = new BookSelectorManager(this);
    this._cover = new CoverManager(this);
    this._fileHandler = new ChapterFileHandler(this);
  }

  cacheDOM() {
    // Главы
    this.chaptersList = document.getElementById('chaptersList');
    this.chaptersEmpty = document.getElementById('chaptersEmpty');
    this.addChapterBtn = document.getElementById('addChapter');
    this.addAlbumBtn = document.getElementById('addAlbum');

    // Дропзона импорта книги (в табе глав)
    this.importDropzone = document.getElementById('chaptersImportDropzone');
    this.importFileInput = document.getElementById('chaptersImportFileInput');

    // Модальное окно главы (legacy — сохраняем ссылки для совместимости с тестами)
    this.modal = document.getElementById('chapterModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.chapterForm = document.getElementById('chapterForm');
    this.cancelModal = document.getElementById('cancelModal');
    this.inputId = document.getElementById('chapterId');
    this.inputTitle = document.getElementById('chapterTitle');
    this.inputBg = document.getElementById('chapterBg');

    // Переключатель режима ввода (legacy — для совместимости)
    this.chapterInputToggle = document.getElementById('chapterInputToggle');
    this.chapterUploadPanel = document.getElementById('chapterUploadPanel');
    this.chapterEditorPanel = document.getElementById('chapterEditorPanel');
    this.chapterEditorContainer = document.getElementById('chapterEditorContainer');

    // Делегаты
    this._bookSelector.cacheDOM();
    this._cover.cacheDOM();
    this._fileHandler.cacheDOM();
    this._album.cacheDOM();
    this._bookUpload.cacheDOM();

    // Прокси-ссылки на DOM-элементы делегатов (совместимость с тестами)
    this.bookSelector = this._bookSelector.bookSelector;
    this.deleteBookBtn = this._bookSelector.deleteBookBtn;
    this.coverTitle = this._cover.coverTitle;
    this.coverAuthor = this._cover.coverAuthor;
    this.bgCoverMode = this._cover.bgCoverMode;
    this.bgCoverOptions = this._cover.bgCoverOptions;
    this.bgCoverFileInput = this._cover.bgCoverFileInput;
    this.bgCoverThumb = this._cover.bgCoverThumb;
    this.bgCoverCustomInfo = this._cover.bgCoverCustomInfo;
    this.bgCoverCustomName = this._cover.bgCoverCustomName;
    this.bgCoverRemove = this._cover.bgCoverRemove;
    this.saveCoverBtn = this._cover.saveCoverBtn;
    this.chapterFileInput = this._fileHandler.chapterFileInput;
    this.chapterFileDropzone = this._fileHandler.chapterFileDropzone;
    this.chapterFileInfo = this._fileHandler.chapterFileInfo;
    this.chapterFileName = this._fileHandler.chapterFileName;
    this.chapterFileRemove = this._fileHandler.chapterFileRemove;
  }

  bindEvents() {
    // Добавить главу / раздел — создаёт пустую и раскрывает
    this.addChapterBtn.addEventListener('click', () => {
      const isAlbum = this._isAlbumBook();
      if (isAlbum) {
        this._listManager.addNewSection();
      } else {
        this._listManager.addNewChapter();
      }
    });

    // Альбом — кнопка в табе «Главы» (добавить альбом-раздел inline)
    this.addAlbumBtn.addEventListener('click', () => {
      this._listManager.addNewSection();
    });

    // Дропзона импорта файла книги
    if (this.importDropzone && this.importFileInput) {
      setupDropzone(this.importDropzone, this.importFileInput, (file) => this._importer.importBookFile(file));
      this.importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this._importer.importBookFile(file);
      });
    }

    // Делегаты
    this._bookSelector.bindEvents();
    this._cover.bindEvents();
    this._fileHandler.bindEvents();
    this._album.bindEvents();
    this._bookUpload.bindEvents();
  }

  /** Является ли текущая книга альбомом */
  _isAlbumBook() {
    return this.store.getBookType?.() === 'album';
  }

  async render() {
    this._bookSelector.render();
    await this._cover.render();
    this._updateAlbumModeUI();
    await this._listManager.renderChapters();
  }

  /** Обновить UI кнопок и надписей для режима альбома */
  _updateAlbumModeUI() {
    const isAlbum = this._isAlbumBook();
    // Переименовать кнопку «Добавить главу» → «Добавить раздел»
    const addLabel = this.addChapterBtn.querySelector('span');
    if (addLabel) {
      addLabel.textContent = isAlbum ? t('admin.sections.addSection') : t('admin.chapters.addChapter');
    }
    // Скрыть кнопку «Фотоальбом» для альбомных книг (там все разделы — альбомные)
    if (this.addAlbumBtn) {
      this.addAlbumBtn.hidden = isAlbum;
    }
    // Обновить пустое состояние
    const emptyTitle = this.chaptersEmpty?.querySelector('[data-i18n="admin.chapters.emptyTitle"]')
      || this.chaptersEmpty?.querySelector('p:first-of-type');
    const emptyHint = this.chaptersEmpty?.querySelector('[data-i18n="admin.chapters.emptyHint"]')
      || this.chaptersEmpty?.querySelector('.empty-hint');
    if (emptyTitle) emptyTitle.textContent = isAlbum ? t('admin.sections.emptyTitle') : t('admin.chapters.emptyTitle');
    if (emptyHint) emptyHint.textContent = isAlbum ? t('admin.sections.emptyHint') : t('admin.chapters.emptyHint');
  }

  // ═══════════════════════════════════════════
  // Legacy: модальное окно (для совместимости с тестами)
  // ═══════════════════════════════════════════

  /** @deprecated Используйте _editor.toggleChapter() */
  async _openModal(editIndex = null) {
    if (editIndex !== null) {
      await this._editor.toggleChapter(editIndex);
    } else {
      await this._listManager.addNewChapter();
    }
  }

  /** Прокси для _inputMode (совместимость с тестами и внешними вызовами) */
  get _inputMode() { return this._editor._inputMode; }
  set _inputMode(v) { this._editor._inputMode = v; }

  /** Прокси для _pendingHtmlContent (совместимость с тестами и внешними вызовами) */
  get _pendingHtmlContent() { return this._editor._pendingHtmlContent; }
  set _pendingHtmlContent(v) { this._editor._pendingHtmlContent = v; }

  /** @deprecated */
  async _switchInputMode(mode) {
    this._editor._inputMode = mode;
  }

  /** @deprecated */
  async _handleChapterSubmit(e) {
    if (e) e.preventDefault();
    await this._editor.saveExpandedChapter();
  }

  // --- Прокси-методы для делегатов (совместимость с тестами и внешними вызовами) ---

  /** @see ChapterListManager#renderChapters */
  _renderChapters() { return this._listManager.renderChapters(); }

  /** @see ChapterEditor#toggleChapter */
  _toggleChapter(index) { return this._editor.toggleChapter(index); }

  /** @see ChapterEditor#collapseAll */
  _collapseAll() { this._editor.collapseAll(); }

  /** @see ChapterEditor#saveExpandedChapter */
  _saveExpandedChapter() { return this._editor.saveExpandedChapter(); }

  /** @see ChapterEditor#handleSaveChapterClick */
  _handleSaveChapterClick() { return this._editor.handleSaveChapterClick(); }

  /** @see ChapterEditor#destroyInlineEditor */
  _destroyInlineEditor() { this._editor.destroyInlineEditor(); }

  /** @see ChapterListManager#addNewChapter */
  _addNewChapter() { return this._listManager.addNewChapter(); }

  /** @see ChapterListManager#addNewSection */
  _addNewSection() { return this._listManager.addNewSection(); }

  /** @see ChapterImporter#importBookFile */
  _importBookFile(file) { return this._importer.importBookFile(file); }

  /** @see BookSelectorManager#render */
  _renderBookSelector() { this._bookSelector.render(); }

  /** @see BookSelectorManager#_handleSelectBook */
  _handleSelectBook(bookId) { this._bookSelector._handleSelectBook(bookId); }

  /** @see BookSelectorManager#_handleDeleteBook */
  _handleDeleteBook(bookId) { return this._bookSelector._handleDeleteBook(bookId); }

  /** @see CoverManager#render */
  _renderCover() { this._cover.render(); }

  /** @see CoverManager#_renderBgModeSelector */
  _renderBgModeSelector(mode, data) { this._cover._renderBgModeSelector(mode, data); }

  /** @see CoverManager#_selectBgMode */
  _selectBgMode(value) { this._cover._selectBgMode(value); }

  /** @see CoverManager#_handleBgUpload */
  _handleBgUpload(e) { return this._cover._handleBgUpload(e); }

  /** @see CoverManager#_removeBgCustom */
  _removeBgCustom() { this._cover._removeBgCustom(); }

  /** @see CoverManager#_saveCover */
  _saveCover() { this._cover._saveCover(); }

  /** @see ChapterFileHandler#processFile */
  _processChapterFile(file) { return this._fileHandler.processFile(file); }

  /** @see ChapterFileHandler#removeFile */
  _removeChapterFile() { this._fileHandler.removeFile(); }

  /** @see ChapterFileHandler#showFileInfo */
  _showChapterFileInfo(name) { this._fileHandler.showFileInfo(name); }

  /** @see ChapterFileHandler#resetUI */
  _resetChapterFileUI() { this._fileHandler.resetUI(); }
}
