/**
 * CONFIGURATION
 *
 * Централизованное хранилище настроек.
 *
 * API:
 * - createConfig(adminConfig) — чистая фабричная функция, не обращается к localStorage.
 *   Используется для тестирования и создания конфигурации с явными данными.
 * - createConfigFromAPI(bookDetail, globalSettings, readingFonts) — создание конфига
 *   из серверных данных (Фаза 3).
 * - loadConfigFromAPI(apiClient, bookId) — загрузка конфига из API.
 * - CONFIG — синглтон для production. Вычисляется один раз при загрузке модуля.
 *   Единственный side effect этого модуля: читает localStorage через loadAdminConfig().
 */

import {
  BASE_URL,
  loadAdminConfig,
  deepFreeze,
  resolveCoverBgFromCover,
  resolveCoverBgPair,
  getActiveBook,
  buildAmbientConfig,
  buildFontsConfig,
  buildCommonConfig,
  buildDefaultSettings,
  buildAppearanceTheme,
  buildSettingsVisibility,
  buildSoundsConfig,
  normalizeChapters,
} from './config/configHelpers.js';

export { enrichConfigFromIDB } from './config/enrichConfigFromIDB.js';

// ─── Фабричная функция (из localStorage / admin config) ─────────────────────

/**
 * Создать конфигурацию приложения на основе данных из админки.
 *
 * Чистая функция: принимает adminConfig явно, без обращения к localStorage.
 * Используйте её в тестах и везде, где нужна воспроизводимость результата.
 *
 * @param {import('./types.js').AdminConfig|null} adminConfig - Конфиг из AdminConfigStore или null для дефолтного
 * @returns {Readonly<import('./types.js').AppConfig>} Замороженный объект конфигурации
 */
export function createConfig(adminConfig = null) {
  const activeBook = getActiveBook(adminConfig);

  // Главы: из активной книги или дефолтные (Хоббит)
  const DEFAULT_CHAPTERS = [
    { id: "part_1", title: '', file: 'content/part_1.html', bg: 'images/backgrounds/part_1.webp', bgMobile: 'images/backgrounds/part_1-mobile.webp' },
    { id: "part_2", title: '', file: 'content/part_2.html', bg: 'images/backgrounds/part_2.webp', bgMobile: 'images/backgrounds/part_2-mobile.webp' },
    { id: "part_3", title: '', file: 'content/part_3.html', bg: 'images/backgrounds/part_3.webp', bgMobile: 'images/backgrounds/part_3-mobile.webp' },
  ];
  const CHAPTERS = normalizeChapters(activeBook?.chapters, DEFAULT_CHAPTERS.map(ch => ({ ...ch, file: `${BASE_URL}${ch.file}`, htmlContent: null, _idb: false, bg: `${BASE_URL}${ch.bg}`, bgMobile: `${BASE_URL}${ch.bgMobile}` })));

  const bookAppearance = activeBook?.appearance || {};
  const adminCover = activeBook?.cover || {};
  const fontsResult = buildFontsConfig(adminConfig?.readingFonts);

  return deepFreeze({
    STORAGE_KEY: activeBook?.id ? `reader-settings:${activeBook.id}` : "reader-settings",
    COVER_BG: resolveCoverBgFromCover(adminCover, 'images/backgrounds/bg-cover.webp'),
    COVER_BG_MOBILE: resolveCoverBgFromCover(adminCover, 'images/backgrounds/bg-cover-mobile.webp'),

    CHAPTERS,

    FONTS: fontsResult.fonts,
    FONTS_LIST: fontsResult.fontsList,
    CUSTOM_FONTS: fontsResult.customFonts || [],
    DECORATIVE_FONT: activeBook?.decorativeFont || null,

    SOUNDS: buildSoundsConfig(activeBook?.sounds),
    AMBIENT: buildAmbientConfig(activeBook?.ambients),
    DEFAULT_SETTINGS: buildDefaultSettings(activeBook?.defaultSettings),

    APPEARANCE: {
      coverTitle: adminCover.title || 'Sample Book',
      coverAuthor: adminCover.author || 'Flipbook Demo',
      fontMin: adminConfig?.fontMin ?? adminConfig?.appearance?.fontMin ?? 14,
      fontMax: adminConfig?.fontMax ?? adminConfig?.appearance?.fontMax ?? 22,
      light: {
        ...buildAppearanceTheme('light', bookAppearance.light),
        _idbCoverBgImage: bookAppearance.light?._idbCoverBgImage || false,
        _idbCustomTexture: bookAppearance.light?._idbCustomTexture || false,
      },
      dark: {
        ...buildAppearanceTheme('dark', bookAppearance.dark),
        _idbCoverBgImage: bookAppearance.dark?._idbCoverBgImage || false,
        _idbCustomTexture: bookAppearance.dark?._idbCustomTexture || false,
      },
    },

    SETTINGS_VISIBILITY: buildSettingsVisibility(adminConfig?.settingsVisibility),

    ...buildCommonConfig(),
  });
}

// ─── Фабричная функция (из серверного API) ──────────────────────────────────

/**
 * Создать конфигурацию из серверных данных (Фаза 3).
 *
 * Принимает данные из API (BookDetail, GlobalSettings, ReadingFont[])
 * и формирует CONFIG в том же формате, что createConfig().
 *
 * @param {Object} bookDetail - Полная информация о книге из GET /api/books/:bookId
 * @param {Object|null} globalSettings - Глобальные настройки из GET /api/settings
 * @param {Array} readingFonts - Шрифты для чтения из GET /api/fonts
 * @returns {Readonly<import('./types.js').AppConfig>}
 */
export function createConfigFromAPI(bookDetail, globalSettings, readingFonts) {
  // Главы: из API (filePath → file через normalizeChapter)
  const CHAPTERS = normalizeChapters(bookDetail.chapters);

  const cover = bookDetail.cover || {};
  const appearance = bookDetail.appearance || {};

  // Обложка: единая функция для резолвинга пары coverBg / coverBgMobile
  const { coverBg, coverBgMobile } = resolveCoverBgPair(cover);

  // Маппинг полей API → CONFIG для appearance
  const apiFieldMap = {
    coverBgImage: 'coverBgImageUrl',
    customTextureData: 'customTextureUrl',
  };

  const fontsResult = buildFontsConfig(readingFonts);

  return deepFreeze({
    STORAGE_KEY: `reader-settings:${bookDetail.id}`,
    BOOK_ID: bookDetail.id,
    COVER_BG: coverBg,
    COVER_BG_MOBILE: coverBgMobile,

    CHAPTERS,

    FONTS: fontsResult.fonts,
    FONTS_LIST: fontsResult.fontsList,
    CUSTOM_FONTS: fontsResult.customFonts,
    DECORATIVE_FONT: bookDetail.decorativeFont
      ? { name: bookDetail.decorativeFont.name, dataUrl: bookDetail.decorativeFont.fileUrl }
      : null,

    SOUNDS: buildSoundsConfig(bookDetail.sounds),
    AMBIENT: buildAmbientConfig(bookDetail.ambients),
    DEFAULT_SETTINGS: buildDefaultSettings(bookDetail.defaultSettings),

    APPEARANCE: {
      coverTitle: bookDetail.title || '',
      coverAuthor: bookDetail.author || '',
      fontMin: appearance.fontMin ?? globalSettings?.fontMin ?? 14,
      fontMax: appearance.fontMax ?? globalSettings?.fontMax ?? 22,
      light: buildAppearanceTheme('light', appearance.light, apiFieldMap),
      dark: buildAppearanceTheme('dark', appearance.dark, apiFieldMap),
    },

    SETTINGS_VISIBILITY: buildSettingsVisibility(globalSettings?.settingsVisibility),

    ...buildCommonConfig(),
  });
}

/**
 * Загрузить конфигурацию из серверного API.
 *
 * @param {import('./utils/ApiClient.js').ApiClient} apiClient
 * @param {string} bookId - ID книги для загрузки
 * @returns {Promise<Readonly<Object>>} CONFIG
 */
export async function loadConfigFromAPI(apiClient, bookId) {
  const [bookDetail, globalSettings, fontsResult] = await Promise.all([
    apiClient.getBook(bookId),
    apiClient.getSettings().catch(() => null),
    apiClient.getFonts().catch(() => ({ fonts: [] })),
  ]);
  const readingFonts = fontsResult.fonts || fontsResult;

  return createConfigFromAPI(bookDetail, globalSettings, readingFonts);
}

/**
 * Загрузить конфигурацию из публичного API (для гостевого/embed режима).
 *
 * Использует публичные эндпоинты (не требуют авторизации).
 * Возвращает конфиг + данные автора для отображения в ридере.
 *
 * @param {import('./utils/ApiClient.js').ApiClient} apiClient
 * @param {string} bookId - ID книги
 * @returns {Promise<{ config: Readonly<Object>, owner: Object }>}
 */
export async function loadPublicConfigFromAPI(apiClient, bookId) {
  const bookDetail = await apiClient.getPublicBook(bookId);
  const config = createConfigFromAPI(bookDetail, null, []);
  return { config, owner: bookDetail.owner || null };
}

// ─── Управляемый синглтон ────────────────────────────────────────────────────

/**
 * Внутреннее хранилище конфигурации.
 * Заменяемо через setConfig() для тестирования и runtime-обновлений.
 * @type {Readonly<import('./types.js').AppConfig>}
 */
let _activeConfig = createConfig(loadAdminConfig());

/**
 * Конфигурация приложения, вычисленная из данных в localStorage.
 *
 * Для простоты — экспортируется как статичная ссылка (обратная совместимость).
 * Для тестирования и runtime-обновлений используйте getConfig() / setConfig().
 */
export const CONFIG = _activeConfig;

/**
 * Получить текущую активную конфигурацию.
 * В отличие от CONFIG (статичная ссылка), getConfig() всегда возвращает
 * актуальный объект, даже после вызова setConfig().
 *
 * Рекомендуется для новых компонентов и тестов.
 * @returns {Readonly<import('./types.js').AppConfig>}
 */
export function getConfig() {
  return _activeConfig;
}

/** Минимальный набор обязательных ключей конфигурации */
const REQUIRED_CONFIG_KEYS = [
  'CHAPTERS', 'FONTS', 'SOUNDS', 'DEFAULT_SETTINGS',
  'APPEARANCE', 'STORAGE_KEY',
];

/**
 * Заменить активную конфигурацию.
 *
 * Использование:
 * - В тестах: setConfig(createConfig(mockAdminConfig))
 * - При переключении книги (runtime): setConfig(createConfig(newAdminConfig))
 * - При загрузке с сервера: setConfig(createConfigFromAPI(...))
 *
 * @param {Readonly<import('./types.js').AppConfig>} config - Новый объект конфигурации
 * @throws {Error} Если конфигурация не содержит обязательных ключей
 */
export function setConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('setConfig: config must be a non-null object');
  }
  const missing = REQUIRED_CONFIG_KEYS.filter(key => !(key in config));
  if (missing.length > 0) {
    throw new Error(`setConfig: missing required keys: ${missing.join(', ')}`);
  }
  _activeConfig = config;
}

// ─── Константы (без side effects) ────────────────────────────────────────────

export const BookState = Object.freeze({
  CLOSED: "closed",
  OPENING: "opening",
  OPENED: "opened",
  FLIPPING: "flipping",
  CLOSING: "closing",
});

/**
 * Фазы анимации перелистывания страницы
 */
export const FlipPhase = Object.freeze({
  LIFT: "lift",
  ROTATE: "rotate",
  DROP: "drop",
  DRAG: "drag",
});

/**
 * Направления перелистывания
 */
export const Direction = Object.freeze({
  NEXT: "next",
  PREV: "prev",
});

/**
 * Строковые булевы значения для data-атрибутов
 */
export const BoolStr = Object.freeze({
  TRUE: "true",
  FALSE: "false",
});
