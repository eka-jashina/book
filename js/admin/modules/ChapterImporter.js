/**
 * Импорт глав из файлов
 * Парсинг книг (epub, fb2, docx, doc, txt) и обработка файлов глав.
 * Извлечён из ChaptersModule для разделения ответственности.
 */
import { BookParser } from '../BookParser.js';
import { t } from '@i18n';

export class ChapterImporter {
  /**
   * @param {import('./ChaptersModule.js').ChaptersModule} host - Родительский модуль
   */
  constructor(host) {
    this._host = host;
  }

  /**
   * Импорт книги из файла — парсинг и добавление всех глав
   * @param {File} file
   */
  async importBookFile(file) {
    if (!this._host._validator.validateImportFile(file)) {
      if (this._host.importFileInput) this._host.importFileInput.value = '';
      return;
    }

    try {
      this._host.importDropzone.classList.add('loading');
      const parsed = await BookParser.parse(file);

      for (const ch of parsed.chapters) {
        await this._host.store.addChapter({
          id: ch.id || `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: ch.title || '',
          file: '',
          htmlContent: ch.html || '',
          bg: '',
          bgMobile: '',
        });
      }

      await this._host._listManager.renderChapters();
      this._host._renderJsonPreview();
      this._host._showToast(t('admin.chapters.importSuccess', { count: parsed.chapters.length }));
    } catch (err) {
      this._host._showToast(t('admin.chapters.fileReadError', { message: err.message }));
    } finally {
      this._host.importDropzone.classList.remove('loading');
      if (this._host.importFileInput) this._host.importFileInput.value = '';
    }
  }

  /**
   * Обработка файла в inline-дропзоне раскрытой карточки
   * @param {File} file
   * @param {HTMLElement} body - Тело карточки
   */
  async processInlineFile(file, body) {
    if (!this._host._validator.validateChapterFile(file)) {
      return;
    }

    const dropzone = body.querySelector('.chapter-inline-file-dropzone');
    const fileInfo = body.querySelector('.chapter-inline-file-info');
    const fileName = body.querySelector('.chapter-inline-file-name');

    try {
      if (dropzone) dropzone.classList.add('loading');

      let html;
      if (this._host._validator.isHtmlFile(file)) {
        html = await file.text();
      } else {
        const parsed = await BookParser.parse(file);
        html = parsed.chapters.map(ch => ch.html).join('\n');
      }

      if (!this._host._validator.validateHtmlContent(html)) {
        return;
      }

      this._host._editor._pendingHtmlContent = html;
      if (dropzone) dropzone.hidden = true;
      if (fileInfo) fileInfo.hidden = false;
      if (fileName) fileName.textContent = file.name;
      this._host._showToast(t('admin.chapters.fileLoaded'));
    } catch (err) {
      this._host._showToast(t('admin.chapters.fileReadError', { message: err.message }));
    } finally {
      if (dropzone) dropzone.classList.remove('loading');
    }
  }
}
