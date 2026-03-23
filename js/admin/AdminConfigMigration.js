/**
 * AdminConfigMigration
 *
 * Чистые функции для миграции, нормализации и валидации
 * конфигурации админ-панели.
 *
 * Извлечены из AdminConfigStore для лучшей разделённости ответственности.
 */

import {
  LIGHT_DEFAULTS,
  DARK_DEFAULTS,
  DEFAULT_READING_FONTS,
  DEFAULT_BOOK_SETTINGS,
  DEFAULT_BOOK,
  DEFAULT_CONFIG,
  CONFIG_SCHEMA_VERSION,
} from './AdminConfigDefaults.js';

/**
 * Валидировать структуру конфигурации по формальной схеме.
 * Возвращает массив ошибок. Пустой массив = валидно.
 * @param {Object} config
 * @returns {string[]}
 */
export function validateSchema(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return ['Конфигурация должна быть объектом'];
  }
  if (!Array.isArray(config.books)) {
    errors.push('books должен быть массивом');
  } else {
    for (let i = 0; i < config.books.length; i++) {
      const book = config.books[i];
      if (!book.id) errors.push(`books[${i}]: отсутствует id`);
      if (!book.cover || typeof book.cover !== 'object') errors.push(`books[${i}]: отсутствует cover`);
      if (!Array.isArray(book.chapters)) errors.push(`books[${i}]: chapters должен быть массивом`);
    }
  }
  if (typeof config.activeBookId !== 'string') {
    errors.push('activeBookId должен быть строкой');
  }
  if (typeof config.fontMin !== 'number' || !Number.isFinite(config.fontMin)) {
    errors.push('fontMin должен быть конечным числом');
  }
  if (typeof config.fontMax !== 'number' || !Number.isFinite(config.fontMax)) {
    errors.push('fontMax должен быть конечным числом');
  }
  if (!Array.isArray(config.readingFonts)) {
    errors.push('readingFonts должен быть массивом');
  }
  if (!config.settingsVisibility || typeof config.settingsVisibility !== 'object') {
    errors.push('settingsVisibility должен быть объектом');
  }
  return errors;
}

/**
 * Миграция формата books из старой схемы (cover/chapters на верхнем уровне).
 * @param {Object} saved
 * @returns {Array}
 */
export function migrateBooks(saved) {
  if (Array.isArray(saved.books) && saved.books.length > 0) {
    return saved.books;
  }
  if (saved.cover || saved.chapters) {
    return [{
      id: 'default',
      cover: { ...structuredClone(DEFAULT_BOOK.cover), ...(saved.cover || {}) },
      chapters: Array.isArray(saved.chapters) ? saved.chapters : structuredClone(DEFAULT_BOOK.chapters),
    }];
  }
  return structuredClone(DEFAULT_CONFIG.books);
}

/**
 * Извлечь per-book настройки из верхнего уровня (старый формат) как fallback.
 * @param {Object} saved
 * @returns {Object}
 */
export function extractTopLevelFallback(saved) {
  return {
    defaultSettings: saved.defaultSettings || null,
    appearance: saved.appearance || null,
    sounds: saved.sounds || null,
    ambients: saved.ambients || null,
    decorativeFont: saved.decorativeFont !== undefined ? saved.decorativeFont : undefined,
  };
}

/**
 * Миграция данных между версиями схемы.
 * @param {Object} data
 * @param {number} fromVersion
 * @returns {Object}
 */
export function migrateSchema(data, fromVersion) {
  if (fromVersion < 2) {
    console.info(`AdminConfigStore: миграция схемы v${fromVersion} → v${CONFIG_SCHEMA_VERSION}`);
  }
  // Будущие миграции: if (fromVersion < 3) { ... }
  return data;
}

/**
 * Обеспечить наличие per-book настроек в объекте книги.
 * Мутирует переданный объект book.
 * @param {Object} book
 * @param {Object} fallback — значения из верхнего уровня (старый формат)
 */
export function ensureBookSettings(book, fallback) {
  if (!book.defaultSettings) {
    book.defaultSettings = {
      ...structuredClone(DEFAULT_BOOK_SETTINGS.defaultSettings),
      ...(fallback.defaultSettings || {}),
    };
  }

  if (!book.appearance) {
    const src = fallback.appearance || {};
    const hasPerTheme = src.light || src.dark;
    if (hasPerTheme) {
      book.appearance = {
        light: { ...structuredClone(LIGHT_DEFAULTS), ...(src.light || {}) },
        dark: { ...structuredClone(DARK_DEFAULTS), ...(src.dark || {}) },
      };
    } else {
      const rest = { ...src };
      delete rest.fontMin;
      delete rest.fontMax;
      book.appearance = {
        light: { ...structuredClone(LIGHT_DEFAULTS), ...rest },
        dark: structuredClone(DARK_DEFAULTS),
      };
    }
  } else {
    book.appearance.light = { ...structuredClone(LIGHT_DEFAULTS), ...(book.appearance.light || {}) };
    book.appearance.dark = { ...structuredClone(DARK_DEFAULTS), ...(book.appearance.dark || {}) };
  }

  if (!book.sounds) {
    book.sounds = { ...structuredClone(DEFAULT_BOOK_SETTINGS.sounds), ...(fallback.sounds || {}) };
  }

  if (!book.ambients) {
    book.ambients = Array.isArray(fallback.ambients)
      ? structuredClone(fallback.ambients)
      : structuredClone(DEFAULT_BOOK_SETTINGS.ambients);
  }

  if (book.decorativeFont === undefined) {
    book.decorativeFont = fallback.decorativeFont !== undefined
      ? (fallback.decorativeFont ? structuredClone(fallback.decorativeFont) : null)
      : null;
  }
}

/**
 * Гарантируем наличие всех полей после загрузки.
 * Оркестрирует все миграции и возвращает нормализованный конфиг.
 * @param {Object} saved — сырые данные из хранилища
 * @returns {Object} — нормализованный конфиг
 */
export function mergeWithDefaults(saved) {
  const savedVersion = saved._schemaVersion || 1;
  saved = migrateSchema(saved, savedVersion);

  const books = migrateBooks(saved);
  const topLevel = extractTopLevelFallback(saved);

  for (const book of books) {
    ensureBookSettings(book, topLevel);
  }

  const activeBookId = saved.activeBookId || (books.length > 0 ? books[0].id : 'default');

  // fontMin/fontMax: миграция из appearance (старый формат) на верхний уровень
  const fontMin = saved.fontMin ?? saved.appearance?.fontMin ?? DEFAULT_CONFIG.fontMin;
  const fontMax = saved.fontMax ?? saved.appearance?.fontMax ?? DEFAULT_CONFIG.fontMax;

  const result = {
    _schemaVersion: CONFIG_SCHEMA_VERSION,
    books,
    activeBookId,
    fontMin,
    fontMax,
    readingFonts: Array.isArray(saved.readingFonts)
      ? saved.readingFonts
      : structuredClone(DEFAULT_READING_FONTS),
    settingsVisibility: {
      ...structuredClone(DEFAULT_CONFIG.settingsVisibility),
      ...(saved.settingsVisibility || {}),
    },
  };

  const schemaErrors = validateSchema(result);
  if (schemaErrors.length > 0) {
    console.warn('AdminConfigStore: расхождение со схемой конфигурации:', schemaErrors);
  }

  return result;
}
