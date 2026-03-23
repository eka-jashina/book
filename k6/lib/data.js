/**
 * Генераторы тестовых данных для k6.
 * Все данные соответствуют Zod-схемам из server/src/schemas.ts.
 */

/**
 * Случайное целое число в диапазоне [min, max].
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Уникальные данные для регистрации пользователя.
 * Username: lowercase, 3-40 символов, буквы/цифры/дефис, начинается с буквы.
 * @param {number} vuId — идентификатор VU
 * @param {number} iter — номер итерации
 * @returns {{ email: string, password: string, displayName: string, username: string }}
 */
export function generateUser(vuId, iter) {
  const ts = Date.now();
  const suffix = randomInt(100, 999);
  return {
    email: `k6-vu${vuId}-${ts}-${suffix}@loadtest.local`,
    password: 'K6LoadTest123!',
    displayName: `Load Test User ${vuId}`,
    username: `k6u${vuId}t${ts}i${iter}`.substring(0, 39).toLowerCase(),
  };
}

/**
 * Данные для создания книги (соответствует createBookSchema).
 * @param {number} index
 * @returns {{ title: string, author: string }}
 */
export function generateBook(index) {
  return {
    title: `K6 Test Book ${index} - ${Date.now()}`,
    author: `Load Test Author ${index}`,
  };
}

/**
 * Данные для создания главы (соответствует createChapterSchema).
 * Генерирует HTML-контент умеренного размера.
 * @param {number} index
 * @returns {{ title: string, htmlContent: string }}
 */
export function generateChapter(index) {
  const paragraph =
    '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. </p>';
  return {
    title: `Chapter ${index}`,
    htmlContent: `<article><h2>Chapter ${index}</h2>${paragraph.repeat(5)}</article>`,
  };
}

/**
 * Данные для сохранения прогресса чтения (соответствует upsertProgressSchema).
 * Все поля обязательны.
 * @param {number} [page]
 * @returns {object}
 */
export function generateProgress(page) {
  return {
    page: page || randomInt(0, 100),
    font: 'georgia',
    fontSize: randomInt(14, 22),
    theme: ['light', 'dark', 'bw'][randomInt(0, 2)],
    soundEnabled: true,
    soundVolume: 0.3,
    ambientType: 'none',
    ambientVolume: 0.5,
  };
}

/**
 * Данные для обновления внешнего вида (соответствует updateAppearanceSchema).
 * fontMin должен быть <= fontMax.
 * @returns {{ fontMin: number, fontMax: number }}
 */
export function generateAppearanceUpdate() {
  const fontMin = randomInt(10, 16);
  const fontMax = randomInt(18, 36);
  return { fontMin, fontMax };
}

/**
 * Данные для создания шрифта (соответствует createFontSchema).
 * @param {number} index
 * @returns {object}
 */
export function generateFont(index) {
  const ts = Date.now();
  return {
    fontKey: `k6font${index}t${ts}`,
    label: `K6 Font ${index}`,
    family: `"K6 Font Family ${index}", serif`,
    builtin: true,
    enabled: true,
  };
}

/**
 * Данные для создания эмбиента (соответствует createAmbientSchema).
 * @param {number} index
 * @returns {object}
 */
export function generateAmbient(index) {
  const ts = Date.now();
  return {
    ambientKey: `k6amb${index}t${ts}`,
    label: `K6 Ambient ${index}`,
    shortLabel: `Amb${index}`,
    icon: '🎵',
    visible: true,
    builtin: false,
  };
}

/**
 * Данные для обновления глобальных настроек (соответствует updateSettingsSchema).
 * @returns {object}
 */
export function generateSettingsUpdate() {
  return {
    fontMin: 12,
    fontMax: 28,
    settingsVisibility: {
      fontSize: true,
      theme: true,
      font: true,
      fullscreen: true,
      sound: true,
      ambient: true,
    },
  };
}
