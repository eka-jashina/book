/**
 * FLIPBOOK TYPE DEFINITIONS
 *
 * JSDoc @typedef определения для ключевых интерфейсов проекта.
 * Импортируется через: @type {import('./types.js').AppConfig}
 *
 * Содержит типы для:
 * - AppConfig — полная конфигурация приложения
 * - Chapter, DefaultSettings, AppearanceConfig и связанные
 * - AdminConfig — конфигурация админ-панели
 * - BookControllerState — состояние ридера
 * - SettingsState — персистентные настройки пользователя
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CORE CONFIG — возвращается createConfig() / createConfigFromAPI()
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} AppConfig
 * @property {string} STORAGE_KEY - Ключ localStorage для настроек ('reader-settings' или 'reader-settings:{bookId}')
 * @property {string} [BOOK_ID] - ID книги (только в API-режиме)
 * @property {string|null} COVER_BG - URL фона обложки (десктоп)
 * @property {string|null} COVER_BG_MOBILE - URL фона обложки (мобильная версия)
 * @property {Chapter[]} CHAPTERS - Массив глав
 * @property {Record<string, string>} FONTS - Карта id → CSS font-family
 * @property {FontMeta[]|null} FONTS_LIST - Метаданные шрифтов для <select>
 * @property {CustomFont[]} CUSTOM_FONTS - Кастомные шрифты (требуют FontFace загрузки)
 * @property {DecorativeFont|null} DECORATIVE_FONT - Декоративный шрифт для заголовков
 * @property {SoundsConfig} SOUNDS - Звуковые эффекты
 * @property {Record<string, AmbientConfig>} AMBIENT - Фоновые звуки (ключ → конфиг)
 * @property {DefaultSettings} DEFAULT_SETTINGS - Настройки по умолчанию
 * @property {AppearanceConfig} APPEARANCE - Оформление книги
 * @property {SettingsVisibility} SETTINGS_VISIBILITY - Видимость элементов настроек
 * @property {{ cacheLimit: number }} VIRTUALIZATION - Лимит LRU-кэша страниц
 * @property {{ MIN_PAGE_WIDTH_RATIO: number, SETTLE_DELAY: number }} LAYOUT - Параметры лейаута
 * @property {number} TIMING_SAFETY_MARGIN - Запас для анимационных таймингов (мс)
 * @property {{ FLIP_THROTTLE: number }} TIMING - Троттлинг анимаций
 * @property {{ ERROR_HIDE_TIMEOUT: number }} UI - UI-таймауты
 * @property {{ MAX_RETRIES: number, INITIAL_RETRY_DELAY: number, FETCH_TIMEOUT: number }} NETWORK - Сетевые параметры
 * @property {{ VISIBILITY_RESUME_DELAY: number }} AUDIO - Аудио-параметры
 */

/**
 * @typedef {Object} Chapter
 * @property {string} id - Уникальный идентификатор главы
 * @property {string} title - Заголовок главы
 * @property {string} file - URL файла с контентом (относительный или абсолютный)
 * @property {string|null} [htmlContent] - Встроенный HTML-контент (вместо file)
 * @property {boolean} [_idb] - Флаг: контент хранится в IndexedDB
 * @property {boolean} [_hasHtmlContent] - Флаг: контент доступен на сервере (API-режим)
 * @property {string} bg - URL фонового изображения (десктоп)
 * @property {string} bgMobile - URL фонового изображения (мобильная версия)
 * @property {AlbumData} [albumData] - Данные фотоальбома (если глава — альбом)
 */

/**
 * @typedef {Object} AlbumData
 * @property {AlbumPage[]} pages - Массив страниц альбома
 */

/**
 * @typedef {Object} AlbumPage
 * @property {string} id - ID страницы
 * @property {AlbumImage[]} images - Изображения на странице
 */

/**
 * @typedef {Object} AlbumImage
 * @property {string} id - ID изображения
 * @property {string} src - URL или data URL изображения
 * @property {string} [caption] - Подпись к изображению
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS & APPEARANCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Настройки чтения по умолчанию (персистентные).
 * @typedef {Object} DefaultSettings
 * @property {string} font - Идентификатор шрифта ('georgia', 'inter', ...)
 * @property {number} fontSize - Размер шрифта в px (14–22)
 * @property {'light'|'dark'|'bw'} theme - Цветовая тема
 * @property {string} [language] - Код языка ('ru', 'en', 'auto', ...)
 * @property {number} page - Последняя прочитанная страница
 * @property {boolean} soundEnabled - Звуковые эффекты включены
 * @property {number} soundVolume - Громкость звуков (0.0–1.0)
 * @property {string} ambientType - Тип фонового звука ('none', 'rain', 'fireplace', ...)
 * @property {number} ambientVolume - Громкость фона (0.0–1.0)
 */

/**
 * Оформление книги (тема + обложка).
 * @typedef {Object} AppearanceConfig
 * @property {string} coverTitle - Заголовок на обложке
 * @property {string} coverAuthor - Автор на обложке
 * @property {number} fontMin - Минимальный размер шрифта
 * @property {number} fontMax - Максимальный размер шрифта
 * @property {ThemeAppearance} light - Оформление для светлой темы
 * @property {ThemeAppearance} dark - Оформление для тёмной темы
 */

/**
 * Оформление для конкретной темы (light/dark).
 * @typedef {Object} ThemeAppearance
 * @property {string} coverBgStart - Начальный цвет градиента обложки
 * @property {string} coverBgEnd - Конечный цвет градиента обложки
 * @property {string} coverText - Цвет текста на обложке
 * @property {string|null} coverBgImage - URL фонового изображения обложки
 * @property {string} pageTexture - Текстура страниц ('default', 'none', ...)
 * @property {string|null} customTextureData - Data URL кастомной текстуры
 * @property {string} bgPage - Цвет фона страницы
 * @property {string} bgApp - Цвет фона приложения
 * @property {boolean} [_idbCoverBgImage] - Флаг: изображение обложки в IndexedDB
 * @property {boolean} [_idbCustomTexture] - Флаг: кастомная текстура в IndexedDB
 */

/**
 * Видимость элементов настроек в UI.
 * @typedef {Object} SettingsVisibility
 * @property {boolean} fontSize - Показывать ползунок размера шрифта
 * @property {boolean} theme - Показывать переключатель темы
 * @property {boolean} font - Показывать выбор шрифта
 * @property {boolean} fullscreen - Показывать кнопку полноэкранного режима
 * @property {boolean} sound - Показывать управление звуком
 * @property {boolean} ambient - Показывать управление фоновыми звуками
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SOUNDS & AMBIENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} SoundsConfig
 * @property {string} pageFlip - URL звука перелистывания страницы
 * @property {string} bookOpen - URL звука открытия книги
 * @property {string} bookClose - URL звука закрытия книги
 */

/**
 * @typedef {Object} AmbientConfig
 * @property {string} label - Полная метка ('Дождь', 'Камин', ...)
 * @property {string} shortLabel - Короткая метка для компактного UI
 * @property {string} icon - Иконка-эмодзи
 * @property {string|null} file - URL аудиофайла (null для 'none')
 * @property {boolean} [_idb] - Флаг: файл хранится в IndexedDB
 */

// ═══════════════════════════════════════════════════════════════════════════════
// FONTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Метаданные шрифта для UI-списка.
 * @typedef {Object} FontMeta
 * @property {string} id - Уникальный идентификатор ('georgia', 'custom-1', ...)
 * @property {string} label - Отображаемое название
 * @property {string} family - CSS font-family
 * @property {boolean} builtin - Встроенный шрифт (не требует загрузки)
 * @property {boolean} enabled - Включён для использования
 * @property {string} [dataUrl] - Data URL файла шрифта (для кастомных)
 * @property {boolean} [_idb] - Флаг: шрифт хранится в IndexedDB
 */

/**
 * Кастомный шрифт, требующий загрузки через FontFace API.
 * @typedef {Object} CustomFont
 * @property {string} id - Уникальный идентификатор
 * @property {string} label - Отображаемое название
 * @property {string} family - CSS font-family
 * @property {string|null} dataUrl - Data URL файла шрифта
 * @property {boolean} [_idb] - Флаг: шрифт хранится в IndexedDB
 */

/**
 * Декоративный шрифт (для заголовков на обложке).
 * @typedef {Object} DecorativeFont
 * @property {string} name - Название шрифта
 * @property {string} dataUrl - Data URL файла шрифта
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BOOK STATE — состояние ридера
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Состояние контроллера книги.
 * @typedef {Object} BookControllerState
 * @property {number} index - Текущий индекс страницы
 * @property {number[]} chapterStarts - Индексы начала каждой главы
 */

/**
 * Персистентные настройки чтения (хранятся в localStorage).
 * @typedef {Object} SettingsState
 * @property {string} font - Идентификатор шрифта
 * @property {number} fontSize - Размер шрифта в px
 * @property {'light'|'dark'|'bw'} theme - Цветовая тема
 * @property {number} page - Последняя прочитанная страница
 * @property {boolean} soundEnabled - Звуковые эффекты включены
 * @property {number} soundVolume - Громкость звуков (0.0–1.0)
 * @property {string} ambientType - Тип фонового звука
 * @property {number} ambientVolume - Громкость фонового звука (0.0–1.0)
 */

/**
 * Состояния конечного автомата книги.
 * @typedef {'closed'|'opening'|'opened'|'flipping'|'closing'} BookStateValue
 */

/**
 * Фаза анимации перелистывания.
 * @typedef {'lift'|'rotate'|'drop'|'drag'} FlipPhaseValue
 */

/**
 * Направление перелистывания.
 * @typedef {'next'|'prev'} DirectionValue
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN CONFIG — конфигурация админ-панели (localStorage)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Конфигурация админ-панели (flipbook-admin-config в localStorage).
 * @typedef {Object} AdminConfig
 * @property {AdminBook[]} books - Массив книг
 * @property {string|null} activeBookId - ID активной книги
 * @property {FontMeta[]} readingFonts - Шрифты для чтения
 * @property {SettingsVisibility} settingsVisibility - Видимость настроек
 * @property {number} fontMin - Минимальный размер шрифта
 * @property {number} fontMax - Максимальный размер шрифта
 */

/**
 * Книга в конфиге админки.
 * @typedef {Object} AdminBook
 * @property {string} id - Уникальный идентификатор книги
 * @property {AdminCover} cover - Обложка
 * @property {Chapter[]} chapters - Главы
 * @property {SoundsConfig} sounds - Звуковые эффекты
 * @property {AdminAmbient[]} ambients - Фоновые звуки
 * @property {AppearanceConfig} appearance - Оформление
 * @property {DecorativeFont|null} decorativeFont - Декоративный шрифт
 * @property {DefaultSettings} defaultSettings - Настройки по умолчанию
 */

/**
 * Обложка книги в конфиге админки.
 * @typedef {Object} AdminCover
 * @property {string} title - Заголовок
 * @property {string} author - Автор
 * @property {'default'|'none'|'custom'} [bgMode] - Режим фоновой подложки
 * @property {string} [bgCustomData] - Data URL кастомного фона
 * @property {string} [bg] - Legacy: URL десктопного фона
 * @property {string} [bgMobile] - Legacy: URL мобильного фона
 */

/**
 * Фоновый звук в конфиге админки.
 * @typedef {Object} AdminAmbient
 * @property {string} id - Уникальный идентификатор
 * @property {string} label - Полная метка
 * @property {string} shortLabel - Короткая метка
 * @property {string} icon - Иконка-эмодзи
 * @property {string|null} file - URL или data URL аудиофайла
 * @property {boolean} visible - Показывать в списке
 * @property {boolean} [builtin] - Встроенный (поставляется с приложением)
 * @property {boolean} [_idb] - Флаг: файл хранится в IndexedDB
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PARSED BOOK — результат парсинга файла книги
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Результат парсинга книжного файла.
 * @typedef {Object} ParsedBook
 * @property {string} title - Заголовок книги
 * @property {string} author - Автор
 * @property {ParsedChapter[]} chapters - Извлечённые главы
 */

/**
 * Глава, извлечённая из файла.
 * @typedef {Object} ParsedChapter
 * @property {string} id - Идентификатор главы
 * @property {string} title - Заголовок главы
 * @property {string} html - HTML-контент главы
 */

// Экспорт пустой для того, чтобы файл был ESM-модулем
export {};
