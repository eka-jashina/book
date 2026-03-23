/**
 * Валидация данных глав
 * Проверка расширений файлов и содержимого глав перед сохранением.
 * Извлечён из ChaptersModule для разделения ответственности.
 */
import { t } from '@i18n';

/** Допустимые расширения для импорта книги */
export const IMPORT_EXTENSIONS = ['.epub', '.fb2', '.docx', '.doc', '.txt'];

/** Допустимые расширения для файла главы */
export const CHAPTER_FILE_EXTENSIONS = ['.doc', '.docx', '.html', '.htm', '.txt'];

export class ChapterValidator {
  /**
   * @param {import('./ChaptersModule.js').ChaptersModule} host - Родительский модуль
   */
  constructor(host) {
    this._host = host;
  }

  /**
   * Проверить расширение файла для импорта книги
   * @param {File} file
   * @returns {boolean}
   */
  validateImportFile(file) {
    const ext = this._getExtension(file.name);
    if (!IMPORT_EXTENSIONS.includes(ext)) {
      this._host._showToast(
        t('admin.chapters.unsupportedFormat', { formats: IMPORT_EXTENSIONS.join(', ') }),
      );
      return false;
    }
    return true;
  }

  /**
   * Проверить расширение файла главы (inline-загрузка)
   * @param {File} file
   * @returns {boolean}
   */
  validateChapterFile(file) {
    const ext = this._getExtension(file.name);
    if (!CHAPTER_FILE_EXTENSIONS.includes(ext)) {
      this._host._showToast(
        t('admin.chapters.unsupportedFormat', { formats: CHAPTER_FILE_EXTENSIONS.join(', ') }),
      );
      return false;
    }
    return true;
  }

  /**
   * Проверить, является ли файл HTML
   * @param {File} file
   * @returns {boolean}
   */
  isHtmlFile(file) {
    const ext = this._getExtension(file.name);
    return ext === '.html' || ext === '.htm';
  }

  /**
   * Проверить, что HTML-контент не пуст
   * @param {string} html
   * @returns {boolean}
   */
  validateHtmlContent(html) {
    if (!html || !html.trim()) {
      this._host._showToast(t('admin.chapters.fileEmpty'));
      return false;
    }
    return true;
  }

  /**
   * Извлечь расширение файла
   * @param {string} filename
   * @returns {string}
   */
  _getExtension(filename) {
    return filename.substring(filename.lastIndexOf('.')).toLowerCase();
  }
}
