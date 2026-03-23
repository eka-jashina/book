/**
 * Реестр всех доступных локализаций
 *
 * Fallback-локаль (ru) экспортируется статически — нужна при инициализации.
 * Остальные локали загружаются лениво через loadLocale().
 */
export { default as ru } from './ru.js';

/**
 * Ленивая загрузка локали по коду языка.
 * Возвращает объект переводов. Fallback (ru) возвращается синхронно из кэша.
 *
 * @param {string} code — код языка ('en', 'es', 'fr', 'de', 'ru')
 * @returns {Promise<Object>} объект переводов
 */
const localeCache = {};

export async function loadLocale(code) {
  if (localeCache[code]) return localeCache[code];

  const loaders = {
    en: () => import('./en.js'),
    es: () => import('./es.js'),
    fr: () => import('./fr.js'),
    de: () => import('./de.js'),
  };

  const loader = loaders[code];
  if (!loader) {
    // Fallback: вернуть ru (уже загружен статически)
    const { ru } = await import('./ru.js');
    return ru;
  }

  const module = await loader();
  localeCache[code] = module.default;
  return module.default;
}
