/**
 * Обработчик файлов глав
 * Отвечает за валидацию, парсинг и drag-and-drop загрузку файлов глав.
 * Извлечён из ChaptersModule для разделения ответственности.
 */
import { BookParser } from '../BookParser.js';
import { setupDropzone } from './adminHelpers.js';
import { t } from '@i18n';

/** Максимальный размер загружаемого файла главы (10 МБ) */
const CHAPTER_FILE_MAX_SIZE = 10 * 1024 * 1024;
/** Допустимые расширения */
const CHAPTER_FILE_EXTENSIONS = ['.doc', '.docx', '.html', '.htm', '.txt'];

export class ChapterFileHandler {
  /**
   * @param {import('./ChaptersModule.js').ChaptersModule} host - Родительский модуль
   */
  constructor(host) {
    this._host = host;
  }

  /** Кэшировать DOM-элементы загрузки файлов */
  cacheDOM() {
    this.chapterFileInput = document.getElementById('chapterFileInput');
    this.chapterFileDropzone = document.getElementById('chapterFileDropzone');
    this.chapterFileInfo = document.getElementById('chapterFileInfo');
    this.chapterFileName = document.getElementById('chapterFileName');
    this.chapterFileRemove = document.getElementById('chapterFileRemove');
  }

  /** Привязать события загрузки файлов */
  bindEvents() {
    setupDropzone(this.chapterFileDropzone, this.chapterFileInput, (file) => this.processFile(file));
    this.chapterFileInput.addEventListener('change', (e) => this._handleFileSelect(e));
    this.chapterFileRemove.addEventListener('click', () => this.removeFile());
  }

  _handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    this.processFile(file);
  }

  async processFile(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!CHAPTER_FILE_EXTENSIONS.includes(ext)) {
      this._host._showToast(t('admin.chapters.unsupportedFormat', { formats: CHAPTER_FILE_EXTENSIONS.join(', ') }));
      this.chapterFileInput.value = '';
      return;
    }

    if (file.size > CHAPTER_FILE_MAX_SIZE) {
      this._host._showToast(t('admin.chapters.fileTooLarge', { size: CHAPTER_FILE_MAX_SIZE / (1024 * 1024) }));
      this.chapterFileInput.value = '';
      return;
    }

    try {
      this.chapterFileDropzone.classList.add('loading');

      let html;
      if (ext === '.html' || ext === '.htm') {
        html = await file.text();
      } else {
        // doc, docx, txt — через BookParser
        const parsed = await BookParser.parse(file);
        html = parsed.chapters.map(ch => ch.html).join('\n');
      }

      if (!html || !html.trim()) {
        this._host._showToast(t('admin.chapters.fileEmpty'));
        return;
      }

      this._host._pendingHtmlContent = html;
      this.showFileInfo(file.name);
      this._host._showToast(t('admin.chapters.fileLoaded'));
    } catch (err) {
      this._host._showToast(t('admin.chapters.fileReadError', { message: err.message }));
    } finally {
      this.chapterFileDropzone.classList.remove('loading');
      this.chapterFileInput.value = '';
    }
  }

  removeFile() {
    this._host._pendingHtmlContent = null;
    this.chapterFileInput.value = '';

    // Очистить редактор, если инициализирован
    const quill = this._host._editor?._quill ?? this._host._editor;
    if (quill?.isInitialized) {
      quill.clear();
    }

    // При редактировании — сбросить существующий контент
    const editIdx = this._host._expandedIndex ?? this._host._editingIndex ?? null;
    if (editIdx !== null && editIdx >= 0) {
      const existing = this._host.store.getChapters()[editIdx];
      if (existing?.file) {
        // Есть URL-путь — вернуть его отображение
        this.showFileInfo(existing.file);
        return;
      }
    }

    this.resetUI();
  }

  showFileInfo(name) {
    this.chapterFileDropzone.hidden = true;
    this.chapterFileInfo.hidden = false;
    this.chapterFileName.textContent = name;
  }

  resetUI() {
    this.chapterFileDropzone.hidden = false;
    this.chapterFileInfo.hidden = true;
    this.chapterFileName.textContent = '';
  }
}
