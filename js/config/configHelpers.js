/**
 * CONFIG HELPERS
 * Чистые вспомогательные функции для построения конфигурации.
 *
 * Используются в createConfig() и createConfigFromAPI() для
 * резолвинга путей, построения шрифтов, амбиентов и т.д.
 */

import { StorageManager } from '../utils/StorageManager.js';

// Vite подставляет base URL для production
export const BASE_URL = import.meta.env.BASE_URL || '/';

/** StorageManager для конфига админки — используется в нескольких модулях */
export const adminConfigStorage = new StorageManager('flipbook-admin-config');

// ─── Загрузка и хранение ──────────────────────────────────────────────────────

/**
 * Загрузка конфига админки из localStorage (если есть)
 * @returns {Object|null}
 */
export function loadAdminConfig() {
  const data = adminConfigStorage.load();
  return Object.keys(data).length > 0 ? data : null;
}

// ─── Иммутабельность ──────────────────────────────────────────────────────────

/**
 * Рекурсивная заморозка объекта (глубокий Object.freeze).
 * Предотвращает случайные мутации вложенных объектов конфигурации.
 * @param {Object} obj
 * @returns {Readonly<Object>}
 */
export function deepFreeze(obj) {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

// ─── Резолвинг путей ──────────────────────────────────────────────────────────

// Резолвить путь к ресурсу (data: / http / относительный)
export function resolveAssetPath(value) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('http')) return value;
  return `${BASE_URL}${value}`;
}

// Получить активную книгу из конфига админки
export function getActiveBook(config) {
  if (!config) return null;

  // Новый формат: books[] + activeBookId
  if (Array.isArray(config.books) && config.books.length > 0) {
    const active = config.books.find(b => b.id === config.activeBookId);
    return active || config.books[0];
  }

  // Старый формат: cover + chapters на верхнем уровне
  if (config.chapters?.length) {
    return { cover: config.cover || {}, chapters: config.chapters };
  }

  return null;
}

// Фон обложки: из админки (с добавлением BASE_URL) или дефолтный
export function resolveCoverBg(value, fallback) {
  if (!value) return `${BASE_URL}${fallback}`;
  return value.startsWith('http') ? value : `${BASE_URL}${value}`;
}

// Фон-подложка под книгу: поддержка режимов default/none/custom
export function resolveCoverBgFromCover(cover, fallback) {
  if (cover.bgMode === 'none') return null;
  if (cover.bgMode === 'custom' && cover.bgCustomData) return cover.bgCustomData;
  // Для обратной совместимости (старый формат: текстовый путь)
  const legacyPath = fallback.includes('mobile') ? cover.bgMobile : cover.bg;
  return resolveCoverBg(legacyPath, fallback);
}

// Звук: из админки (data URL / http / путь) или дефолтный
export function resolveSound(value, fallback) {
  if (!value) return `${BASE_URL}${fallback}`;
  if (value.startsWith('data:') || value.startsWith('http')) return value;
  return `${BASE_URL}${value}`;
}

// ─── Дефолтные значения секций ────────────────────────────────────────────────

/** Дефолтные оформления тем — используются в createConfig и createConfigFromAPI */
const LIGHT_THEME_DEFAULTS = {
  coverBgStart: '#3a2d1f', coverBgEnd: '#2a2016', coverText: '#f2e9d8',
  coverBgImage: null, pageTexture: 'default', customTextureData: null,
  bgPage: '#fdfcf8', bgApp: '#e6e3dc',
};

const DARK_THEME_DEFAULTS = {
  coverBgStart: '#111111', coverBgEnd: '#000000', coverText: '#eaeaea',
  coverBgImage: null, pageTexture: 'none', customTextureData: null,
  bgPage: '#1e1e1e', bgApp: '#121212',
};

/** Дефолтная карта шрифтов */
const DEFAULT_FONTS = {
  georgia: "Georgia, serif",
  merriweather: '"Merriweather", serif',
  "libre-baskerville": '"Libre Baskerville", serif',
  inter: "Inter, sans-serif",
  roboto: "Roboto, sans-serif",
  "open-sans": '"Open Sans", sans-serif',
};

/** Дефолтные амбиенты */
function getDefaultAmbients() {
  return {
    none: { label: "Без звука", shortLabel: "Нет", icon: "✕", file: null },
    rain: { label: "Дождь", shortLabel: "Дождь", icon: "🌧️", file: `${BASE_URL}sounds/ambient/rain.mp3` },
    fireplace: { label: "Камин", shortLabel: "Камин", icon: "🔥", file: `${BASE_URL}sounds/ambient/fireplace.mp3` },
    cafe: { label: "Кафе", shortLabel: "Кафе", icon: "☕", file: `${BASE_URL}sounds/ambient/cafe.mp3` },
  };
}

// ─── Построение конфиг-секций ─────────────────────────────────────────────────

/**
 * Построить DEFAULT_SETTINGS из источника (adminDefaults / API defaults).
 * @param {Object} src - Источник настроек ({ font, fontSize, theme, ... })
 * @returns {import('../types.js').DefaultSettings}
 */
export function buildDefaultSettings(src = {}) {
  return {
    font: src.font || "georgia",
    fontSize: src.fontSize || 18,
    theme: src.theme || "light",
    language: src.language || "auto",
    page: 0,
    soundEnabled: src.soundEnabled ?? true,
    soundVolume: src.soundVolume ?? 0.3,
    ambientType: src.ambientType || 'none',
    ambientVolume: src.ambientVolume ?? 0.5,
  };
}

/**
 * Построить тему оформления (light/dark) с дефолтами.
 * @param {'light'|'dark'} theme - Тема
 * @param {Object} src - Исходные данные темы
 * @param {Object} [fieldMap] - Маппинг полей API → CONFIG (для coverBgImageUrl → coverBgImage и т.д.)
 * @returns {import('../types.js').ThemeAppearance}
 */
export function buildAppearanceTheme(theme, src = {}, fieldMap = null) {
  const defaults = theme === 'dark' ? DARK_THEME_DEFAULTS : LIGHT_THEME_DEFAULTS;
  const result = {};

  for (const key of Object.keys(defaults)) {
    // Если передан маппинг полей (API формат) — сначала ищем по маппингу
    const srcKey = fieldMap?.[key] || key;
    result[key] = src[srcKey] ?? defaults[key];
  }

  return result;
}

/**
 * Построить SETTINGS_VISIBILITY из источника.
 * @param {Object} src - Источник видимости настроек
 * @returns {import('../types.js').SettingsVisibility}
 */
export function buildSettingsVisibility(src = {}) {
  return {
    fontSize: src.fontSize ?? true,
    theme: src.theme ?? true,
    font: src.font ?? true,
    fullscreen: src.fullscreen ?? true,
    sound: src.sound ?? true,
    ambient: src.ambient ?? true,
  };
}

/**
 * Построить SOUNDS из источника.
 * @param {Object} src - Источник звуков ({ pageFlip, bookOpen, bookClose })
 * @returns {import('../types.js').SoundsConfig}
 */
export function buildSoundsConfig(src = {}) {
  return {
    pageFlip: resolveSound(src.pageFlip, 'sounds/page-flip.mp3'),
    bookOpen: resolveSound(src.bookOpen, 'sounds/cover-flip.mp3'),
    bookClose: resolveSound(src.bookClose, 'sounds/cover-flip.mp3'),
  };
}

// ─── Нормализация данных (admin → unified, API → unified) ────────────────────

/**
 * Нормализовать шрифт из любого источника в единый формат.
 * Admin: { id, family, label, builtin, enabled, dataUrl, _idb }
 * API:   { fontKey, family, label, builtin, enabled, fileUrl }
 * @param {Object} f - Шрифт из admin или API
 * @returns {{ id: string, family: string, label: string, builtin: boolean, enabled: boolean, dataUrl: string|null, _idb: boolean }}
 */
function normalizeFont(f) {
  return {
    id: f.fontKey || f.id,
    family: f.family,
    label: f.label,
    builtin: f.builtin ?? false,
    enabled: f.enabled ?? true,
    dataUrl: f.dataUrl || f.fileUrl || null,
    _idb: f._idb || false,
  };
}

/**
 * Нормализовать амбиент из любого источника в единый формат.
 * Admin: { id, label, shortLabel, icon, file, visible, _idb }
 * API:   { id, ambientKey, label, shortLabel, icon, fileUrl, visible }
 * @param {Object} a - Амбиент из admin или API
 * @returns {{ key: string, label: string, shortLabel: string, icon: string, file: string|null, _idb: boolean }}
 */
function normalizeAmbient(a) {
  // Резолвим путь к файлу: поддержка file (admin) и fileUrl (API)
  const rawFile = a.file ?? a.fileUrl ?? null;
  return {
    key: a.ambientKey || a.id,
    label: a.label,
    shortLabel: a.shortLabel || a.label,
    icon: a.icon,
    file: rawFile ? resolveAssetPath(rawFile) : null,
    _idb: a._idb || false,
  };
}

// ─── Построение амбиентов (единая функция для обоих источников) ───────────────

/**
 * Построить AMBIENT из массива амбиентов (admin или API формат).
 * @param {Array|null|undefined} ambients - Амбиенты из любого источника
 * @returns {Object}
 */
export function buildAmbientConfig(ambients) {
  if (!Array.isArray(ambients) || ambients.length === 0) {
    return getDefaultAmbients();
  }

  const result = {};
  for (const a of ambients) {
    if (!a.visible) continue;
    const norm = normalizeAmbient(a);
    result[norm.key] = {
      label: norm.label,
      shortLabel: norm.shortLabel,
      icon: norm.icon,
      file: norm.file,
      ...(norm._idb && { _idb: true }),
    };
  }
  return Object.keys(result).length > 0 ? result : getDefaultAmbients();
}

// Обратная совместимость: buildAmbientConfigFromAPI теперь — алиас
export const buildAmbientConfigFromAPI = buildAmbientConfig;

// ─── Построение шрифтов (единая функция для обоих источников) ─────────────────

/**
 * Построить FONTS, FONTS_LIST, CUSTOM_FONTS из массива шрифтов (admin или API формат).
 * @param {Array|null|undefined} rawFonts - Шрифты из любого источника
 * @returns {{ fonts: Object, fontsList: Array|null, customFonts: Array }}
 */
export function buildFontsConfig(rawFonts) {
  if (!Array.isArray(rawFonts) || rawFonts.length === 0) {
    return { fonts: DEFAULT_FONTS, fontsList: null, customFonts: [] };
  }

  const fonts = {};
  const fontsList = [];
  const customFonts = [];

  for (const raw of rawFonts) {
    const f = normalizeFont(raw);
    if (!f.enabled) continue;

    fonts[f.id] = f.family;
    fontsList.push({ id: f.id, label: f.label, family: f.family, builtin: f.builtin, enabled: f.enabled });

    if (!f.builtin && (f.dataUrl || f._idb)) {
      customFonts.push({ id: f.id, label: f.label, family: f.family, dataUrl: f.dataUrl, ...(f._idb && { _idb: true }) });
    }
  }

  // Если массив передан, но все шрифты отключены — вернуть пустой набор (без fallback).
  // Fallback на DEFAULT_FONTS происходит только когда массив не передан / пустой (строка 279).
  return {
    fonts: Object.keys(fonts).length > 0 ? fonts : {},
    fontsList: fontsList.length > 0 ? fontsList : null,
    customFonts,
  };
}

// Обратная совместимость: buildFontsConfigFromAPI теперь — алиас
export const buildFontsConfigFromAPI = buildFontsConfig;

// ─── Нормализация глав ───────────────────────────────────────────────────────

/**
 * Нормализовать главу из любого источника в единый формат CONFIG.
 * Admin: { id, title, file, htmlContent, _idb, bg, bgMobile }
 * API:   { id, title, filePath, hasHtmlContent, bg, bgMobile }
 * @param {Object} ch - Глава из admin или API
 * @returns {Object}
 */
export function normalizeChapter(ch) {
  return {
    id: ch.id,
    title: ch.title || '',
    file: resolveAssetPath(ch.file || ch.filePath),
    htmlContent: ch.htmlContent || null,
    _idb: ch._idb || false,
    ...(ch.hasHtmlContent !== undefined && { _hasHtmlContent: ch.hasHtmlContent }),
    bg: resolveAssetPath(ch.bg),
    bgMobile: resolveAssetPath(ch.bgMobile),
  };
}

/**
 * Нормализовать массив глав из любого источника.
 * @param {Array|null|undefined} chapters - Главы из admin или API
 * @param {Array} defaultChapters - Дефолтные главы (если chapters пусто)
 * @returns {Array}
 */
export function normalizeChapters(chapters, defaultChapters = []) {
  if (!Array.isArray(chapters) || chapters.length === 0) return defaultChapters;
  return chapters.map(normalizeChapter);
}

/**
 * Резолвить фон обложки с поддержкой режимов (default / none / custom).
 * Используется в обоих createConfig и createConfigFromAPI.
 * @param {Object} cover - Объект обложки { bg, bgMobile, bgMode, bgCustomUrl, bgCustomData }
 * @returns {{ coverBg: string|null, coverBgMobile: string|null }}
 */
export function resolveCoverBgPair(cover = {}) {
  const defaultBg = `${BASE_URL}images/backgrounds/bg-cover.webp`;
  const defaultBgMobile = `${BASE_URL}images/backgrounds/bg-cover-mobile.webp`;

  if (cover.bgMode === 'none') {
    return { coverBg: null, coverBgMobile: null };
  }
  if (cover.bgMode === 'custom') {
    const customUrl = cover.bgCustomUrl || cover.bgCustomData || null;
    if (customUrl) return { coverBg: customUrl, coverBgMobile: customUrl };
  }

  return {
    coverBg: cover.bg ? resolveAssetPath(cover.bg) : (cover.bgMobile ? defaultBg : resolveCoverBg(cover.bg, 'images/backgrounds/bg-cover.webp')),
    coverBgMobile: cover.bgMobile ? resolveAssetPath(cover.bgMobile) : (cover.bg ? defaultBgMobile : resolveCoverBg(cover.bgMobile, 'images/backgrounds/bg-cover-mobile.webp')),
  };
}

// ─── Общие настройки (timing, layout, UI и т.д.) ──────────────────────────────

export function buildCommonConfig() {
  return {
    VIRTUALIZATION: { cacheLimit: 50 },
    LAYOUT: { MIN_PAGE_WIDTH_RATIO: 0.4, SETTLE_DELAY: 100 },
    TIMING_SAFETY_MARGIN: 100,
    TIMING: { FLIP_THROTTLE: 100 },
    UI: { ERROR_HIDE_TIMEOUT: 5000 },
    NETWORK: { MAX_RETRIES: 3, INITIAL_RETRY_DELAY: 1000, FETCH_TIMEOUT: 10000 },
    AUDIO: { VISIBILITY_RESUME_DELAY: 100 },
  };
}
