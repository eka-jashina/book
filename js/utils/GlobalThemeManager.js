/**
 * GLOBAL THEME MANAGER
 * Глобальное управление темой сайта (вне ридера).
 * Хранит выбранную тему в localStorage ('flipbook-theme').
 * Применяет data-theme на <html> и диспатчит событие 'flipbook:theme-changed'.
 */

const STORAGE_KEY = 'flipbook-theme';
const VALID_THEMES = ['light', 'dark', 'bw'];
const THEME_CYCLE = ['light', 'dark', 'bw'];

/**
 * Получить текущую глобальную тему
 * @returns {'light'|'dark'|'bw'}
 */
export function getGlobalTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID_THEMES.includes(saved)) return saved;
  } catch { /* localStorage недоступен */ }
  return 'light';
}

/**
 * Установить глобальную тему
 * @param {'light'|'dark'|'bw'} theme
 */
export function setGlobalTheme(theme) {
  const safe = VALID_THEMES.includes(theme) ? theme : 'light';
  try {
    if (safe === 'light') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, safe);
    }
  } catch { /* localStorage недоступен */ }

  applyGlobalTheme(safe);
}

/**
 * Применить тему к DOM без сохранения
 * @param {'light'|'dark'|'bw'} [theme]
 */
export function applyGlobalTheme(theme) {
  const t = theme || getGlobalTheme();
  document.documentElement.dataset.theme = t === 'light' ? '' : t;
  document.dispatchEvent(new CustomEvent('flipbook:theme-changed', { detail: { theme: t } }));
}

/**
 * Получить следующую тему в цикле
 * @returns {'light'|'dark'|'bw'}
 */
export function getNextTheme() {
  const current = getGlobalTheme();
  const idx = THEME_CYCLE.indexOf(current);
  return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
}

/**
 * Переключить тему на следующую в цикле light → dark → bw → light
 * @returns {'light'|'dark'|'bw'} Новая тема
 */
export function cycleGlobalTheme() {
  const next = getNextTheme();
  setGlobalTheme(next);
  return next;
}
