/**
 * Менеджер загрузки книг
 * Обрабатывает загрузку файлов (EPUB, FB2, DOCX, DOC, TXT),
 * парсинг через BookParser и добавление книги в store
 */

import { BookParser } from '../BookParser.js';
import { setupDropzone } from './adminHelpers.js';
import { trackBookImported } from '../../utils/Analytics.js';
import { t } from '@i18n';

export class BookUploadManager {
  constructor(chaptersModule) {
    this._module = chaptersModule;
    this._pendingParsedBook = null;
  }

  get store() { return this._module.store; }

  cacheDOM() {
    this.bookUploadArea = document.getElementById('bookUploadArea');
    this.bookDropzone = document.getElementById('bookDropzone');
    this.bookFileInput = document.getElementById('bookFileInput');
    this.bookUploadProgress = document.getElementById('bookUploadProgress');
    this.bookUploadStatus = document.getElementById('bookUploadStatus');
    this.bookUploadResult = document.getElementById('bookUploadResult');
    this.bookUploadTitle = document.getElementById('bookUploadTitle');
    this.bookUploadAuthor = document.getElementById('bookUploadAuthor');
    this.bookUploadChaptersCount = document.getElementById('bookUploadChaptersCount');
    this.bookUploadConfirm = document.getElementById('bookUploadConfirm');
    this.bookUploadCancel = document.getElementById('bookUploadCancel');
  }

  bindEvents() {
    setupDropzone(this.bookDropzone, this.bookFileInput, (file) => this._processBookFile(file));
    this.bookFileInput.addEventListener('change', (e) => this._handleBookUpload(e));
    this.bookUploadConfirm.addEventListener('click', () => this._applyParsedBook());
    this.bookUploadCancel.addEventListener('click', () => this._resetBookUpload());
  }

  _handleBookUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    this._processBookFile(file);
    e.target.value = '';
  }

  async _processBookFile(file) {
    const BOOK_EXTENSIONS = ['.epub', '.fb2', '.docx', '.doc', '.txt'];
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
    if (!BOOK_EXTENSIONS.includes(ext)) {
      const allowed = BOOK_EXTENSIONS.map(e => e.slice(1)).join(', ');
      this._module._showToast(t('admin.upload.unsupported', { formats: allowed }));
      return;
    }

    this.bookDropzone.hidden = true;
    this.bookUploadProgress.hidden = false;
    this.bookUploadResult.hidden = true;
    this.bookUploadStatus.textContent = t('admin.upload.processing');

    try {
      const parsed = await BookParser.parse(file);
      trackBookImported(ext.slice(1));
      this._pendingParsedBook = parsed;

      this.bookUploadProgress.hidden = true;
      this.bookUploadResult.hidden = false;
      this.bookUploadTitle.textContent = parsed.title || t('admin.upload.defaultTitle');
      this.bookUploadAuthor.textContent = parsed.author ? t('admin.upload.authorLabel', { author: parsed.author }) : '';
      this.bookUploadChaptersCount.textContent = t('admin.upload.chaptersCount', { count: parsed.chapters.length });
    } catch (err) {
      this._module._showToast(t('admin.upload.error', { message: err.message }));
      this._resetBookUpload();
    }
  }

  async _applyParsedBook() {
    if (!this._pendingParsedBook) return;

    const { title, author, chapters } = this._pendingParsedBook;

    const newChapters = chapters.map(ch => ({
      id: ch.id,
      title: ch.title || '',
      file: '',
      htmlContent: ch.html,
      bg: '',
      bgMobile: '',
    }));

    const clientId = `book_${Date.now()}`;

    const created = await this.store.addBook({
      id: clientId,
      cover: {
        title: title || t('admin.upload.defaultTitle'),
        author: author || '',
        bg: '',
        bgMobile: '',
      },
      chapters: newChapters,
    });

    try {
      await this.store.waitForSave();
    } catch {
      this.store.removeBook(created?.id || clientId);
      this._module._showToast(t('admin.upload.storageQuota'));
      return;
    }

    // Использовать серверный ID книги (если доступен), иначе клиентский
    const bookId = created?.id || clientId;

    this.store.setActiveBook(bookId);

    this._module.app._render();
    this._resetBookUpload();
    this._module._showToast(t('admin.upload.added', { title: title || t('admin.upload.defaultTitle'), count: chapters.length }));

    // Перейти к ридеру загруженной книги (или открыть редактор, если нет роутера)
    const router = this._module.app._router;
    if (router) {
      router.navigate(`/book/${bookId}`);
    } else {
      this._module.app.openEditor();
    }
  }

  _resetBookUpload() {
    this._pendingParsedBook = null;
    this.bookDropzone.hidden = false;
    this.bookUploadProgress.hidden = true;
    this.bookUploadResult.hidden = true;
  }
}
