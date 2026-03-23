/**
 * SETTINGS VALIDATOR
 * Валидация и санитизация значений настроек перед применением к DOM.
 *
 * Предотвращает попадание невалидных значений из localStorage или
 * повреждённых данных в CSS-переменные и data-атрибуты.
 */

/** Допустимые темы */
const VALID_THEMES = new Set(['light', 'dark', 'bw']);

/** Допустимые языки */
const VALID_LANGUAGES = new Set(['ru', 'en', 'es', 'fr', 'de', 'auto']);

/** Абсолютные границы размера шрифта (на случай повреждённого fontMin/fontMax) */
const FONT_SIZE_ABS_MIN = 8;
const FONT_SIZE_ABS_MAX = 72;

/** Регулярное выражение для CSS-цвета (#rgb, #rrggbb, #rrggbbaa) */
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Проверка, является ли значение конечным числом
 * @param {*} value
 * @returns {boolean}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Зажать число в диапазон [min, max]
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ─── Правила санитизации настроек ─────────────────────────────────────────────

/**
 * Санитизировать значение настройки. Возвращает корректное значение
 * или defaultValue если исправить невозможно.
 *
 * @param {string} key - Ключ настройки
 * @param {*} value - Входное значение
 * @param {*} defaultValue - Значение по умолчанию
 * @returns {*} Санитизированное значение
 */
export function sanitizeSetting(key, value, defaultValue) {
  const sanitizer = SANITIZERS[key];
  if (!sanitizer) return value;
  return sanitizer(value, defaultValue);
}

/**
 * Санитизировать объект настроек целиком.
 *
 * @param {Object} settings - Объект настроек
 * @param {Object} defaults - Значения по умолчанию
 * @returns {Object} Санитизированный объект
 */
export function sanitizeSettings(settings, defaults) {
  const result = { ...settings };
  for (const key of Object.keys(result)) {
    if (key in defaults) {
      result[key] = sanitizeSetting(key, result[key], defaults[key]);
    }
  }
  return result;
}

/**
 * Проверить, является ли значение допустимой CSS-цветовой строкой.
 * Поддерживает: hex (#rgb, #rrggbb), rgb(), rgba(), hsl(), hsla(),
 * именованные цвета (ограниченный набор).
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isValidCSSColor(value) {
  if (typeof value !== 'string' || value.length === 0) return false;

  // Hex
  if (value.startsWith('#')) return HEX_COLOR_RE.test(value);

  // rgb() / rgba() / hsl() / hsla()
  if (/^(rgb|rgba|hsl|hsla)\s*\(/.test(value)) return true;

  // Именованные цвета (базовый набор, покрывает типичные значения тем)
  if (CSS_NAMED_COLORS.has(value.toLowerCase())) return true;

  return false;
}

/**
 * Проверить, является ли значение допустимым для CSS font-size (конечное число > 0).
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isValidFontSize(value) {
  return isFiniteNumber(value) && value >= FONT_SIZE_ABS_MIN && value <= FONT_SIZE_ABS_MAX;
}

/**
 * Санитизировать значение font-size.
 *
 * @param {*} value
 * @param {number} defaultValue
 * @param {number} [min=FONT_SIZE_ABS_MIN]
 * @param {number} [max=FONT_SIZE_ABS_MAX]
 * @returns {number}
 */
export function sanitizeFontSize(value, defaultValue, min = FONT_SIZE_ABS_MIN, max = FONT_SIZE_ABS_MAX) {
  if (value === null || value === undefined) return defaultValue;
  const num = Number(value);
  if (!Number.isFinite(num)) return defaultValue;
  return clamp(Math.round(num), Math.max(min, FONT_SIZE_ABS_MIN), Math.min(max, FONT_SIZE_ABS_MAX));
}

/**
 * Санитизировать значение громкости (0..1).
 *
 * @param {*} value
 * @param {number} defaultValue
 * @returns {number}
 */
export function sanitizeVolume(value, defaultValue) {
  if (value === null || value === undefined) return defaultValue;
  const num = Number(value);
  if (!Number.isFinite(num)) return defaultValue;
  return clamp(num, 0, 1);
}

/**
 * Проверить, является ли значение допустимой темой.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isValidTheme(value) {
  return VALID_THEMES.has(value);
}

/**
 * Проверить, является ли значение допустимым языком.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isValidLanguage(value) {
  return VALID_LANGUAGES.has(value);
}

// ─── Маппинг санитайзеров по ключам ──────────────────────────────────────────

const SANITIZERS = {
  fontSize(value, defaultValue) {
    return sanitizeFontSize(value, defaultValue);
  },

  theme(value, defaultValue) {
    return isValidTheme(value) ? value : defaultValue;
  },

  font(value, defaultValue) {
    return (typeof value === 'string' && value.length > 0) ? value : defaultValue;
  },

  page(value, defaultValue) {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0) return defaultValue;
    return num;
  },

  soundEnabled(value, defaultValue) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return defaultValue;
  },

  soundVolume(value, defaultValue) {
    return sanitizeVolume(value, defaultValue);
  },

  ambientType(value, defaultValue) {
    return (typeof value === 'string' && value.length > 0) ? value : defaultValue;
  },

  ambientVolume(value, defaultValue) {
    return sanitizeVolume(value, defaultValue);
  },

  language(value, defaultValue) {
    return VALID_LANGUAGES.has(value) ? value : defaultValue;
  },
};

// ─── Формальная JSON-схема настроек ─────────────────────────────────────────

/**
 * Декларативная схема настроек ридера.
 *
 * Служит единым источником правды о типах и ограничениях.
 * Если новое поле добавлено в defaults, но не описано в схеме и SANITIZERS —
 * validateSettingsSchema() предупредит об этом.
 */
export const SETTINGS_SCHEMA = Object.freeze({
  font:          { type: 'string' },
  fontSize:      { type: 'number' },
  theme:         { type: 'string' },
  language:      { type: 'string' },
  page:          { type: 'number' },
  soundEnabled:  { type: 'boolean' },
  soundVolume:   { type: 'number' },
  ambientType:   { type: 'string' },
  ambientVolume: { type: 'number' },
});

/**
 * Валидировать объект настроек по формальной схеме.
 *
 * Проверяет:
 * 1. Наличие всех ожидаемых ключей
 * 2. Правильность типов значений
 * 3. Наличие санитайзера для каждого ключа в defaults
 *
 * Возвращает массив строк-ошибок. Пустой массив = валидно.
 *
 * @param {Object} settings - Санитизированный объект настроек
 * @param {Object} defaults - Значения по умолчанию
 * @returns {string[]} Массив ошибок (пуст если всё валидно)
 */
export function validateSettingsSchema(settings, defaults) {
  const errors = [];

  // Проверить что для каждого ключа в defaults есть санитайзер
  for (const key of Object.keys(defaults)) {
    if (!SANITIZERS[key]) {
      errors.push(`Нет санитайзера для ключа "${key}"`);
    }
  }

  // Проверить типы по схеме
  for (const [key, rule] of Object.entries(SETTINGS_SCHEMA)) {
    if (!(key in settings)) {
      errors.push(`Отсутствует ключ "${key}"`);
      continue;
    }
    const value = settings[key];
    if (typeof value !== rule.type) {
      errors.push(`"${key}" должен быть ${rule.type}, получено ${typeof value}`);
    }
  }

  return errors;
}

// ─── Набор именованных CSS-цветов ───────────────────────────────────────────

const CSS_NAMED_COLORS = new Set([
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
  'gray', 'grey', 'brown', 'pink', 'cyan', 'magenta', 'lime', 'olive',
  'navy', 'teal', 'aqua', 'maroon', 'silver', 'fuchsia', 'transparent',
  'currentcolor', 'inherit',
]);
