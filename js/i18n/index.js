/**
 * I18N MODULE
 * Обёртка над i18next для мультиязычной поддержки.
 *
 * API:
 * - initI18n(language) — инициализация с указанным языком
 * - t(key, params?) — получить перевод
 * - setLanguage(code) — сменить язык (обновляет DOM)
 * - getLanguage() — текущий код языка
 * - detectLanguage() — определить язык браузера
 * - applyTranslations(root?) — обновить DOM-элементы с data-i18n атрибутами
 * - LANGUAGES — список доступных языков
 *
 * Локали загружаются лениво: при инициализации грузятся только
 * fallback (ru) и выбранный язык. Остальные — при переключении.
 */

import i18next from 'i18next';
import { ru, loadLocale } from './locales/index.js';
import { trackLanguageChanged } from '../utils/Analytics.js';

/** Список поддерживаемых языков */
export const LANGUAGES = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

const LANGUAGE_CODES = LANGUAGES.map(lang => lang.code);

/**
 * Инициализировать i18next
 * @param {string} language — код языка ('ru', 'en', ...) или 'auto'
 * @returns {Promise<void>}
 */
export async function initI18n(language = 'ru') {
  const lng = language === 'auto' ? detectLanguage() : language;

  // Базовый ресурс — fallback всегда доступен
  const resources = {
    ru: { translation: ru },
  };

  // Лениво загрузить выбранный язык (если не ru)
  if (lng !== 'ru') {
    const translations = await loadLocale(lng);
    resources[lng] = { translation: translations };
  }

  await i18next.init({
    lng,
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
    resources,
  });

  document.documentElement.lang = lng;
}

/**
 * Получить перевод по ключу
 * @param {string} key — ключ перевода (напр. 'reader.nextPage')
 * @param {Object} [params] — параметры интерполяции
 * @returns {string}
 */
export function t(key, params) {
  return i18next.t(key, params);
}

/**
 * Сменить язык и обновить DOM
 * @param {string} code — код языка
 * @returns {Promise<void>}
 */
export async function setLanguage(code) {
  if (!LANGUAGE_CODES.includes(code)) return;

  // Лениво загрузить локаль если ещё не добавлена в i18next
  if (!i18next.hasResourceBundle(code, 'translation')) {
    const translations = await loadLocale(code);
    i18next.addResourceBundle(code, 'translation', translations);
  }

  await i18next.changeLanguage(code);
  document.documentElement.lang = code;
  trackLanguageChanged(code);
  applyTranslations();
}

/**
 * Текущий язык
 * @returns {string}
 */
export function getLanguage() {
  return i18next.language || 'ru';
}

/**
 * Определить язык браузера из navigator.language
 * @returns {string} — код языка из LANGUAGES или 'ru'
 */
export function detectLanguage() {
  const nav = navigator.language || navigator.userLanguage || '';
  // Точное совпадение: 'en-US' → 'en', 'ru-RU' → 'ru'
  const prefix = nav.split('-')[0].toLowerCase();
  return LANGUAGE_CODES.includes(prefix) ? prefix : 'ru';
}

/**
 * Обновить DOM-элементы с data-i18n атрибутами
 *
 * Поддерживаемые атрибуты:
 * - data-i18n="key" → textContent
 * - data-i18n-placeholder="key" → placeholder
 * - data-i18n-aria-label="key" → aria-label
 * - data-i18n-title="key" → title
 * - data-i18n-html="key" → innerHTML (для строк с <br> и т.п.)
 *
 * @param {HTMLElement} [root=document.body] — корневой элемент для поиска
 */
export function applyTranslations(root = document.body) {
  if (!root) return;

  const mappings = [
    { attr: 'data-i18n', prop: 'textContent' },
    { attr: 'data-i18n-html', prop: 'innerHTML' },
    { attr: 'data-i18n-placeholder', domAttr: 'placeholder' },
    { attr: 'data-i18n-aria-label', domAttr: 'aria-label' },
    { attr: 'data-i18n-title', domAttr: 'title' },
  ];

  for (const { attr, prop, domAttr } of mappings) {
    const elements = root.querySelectorAll(`[${attr}]`);
    for (const el of elements) {
      const key = el.getAttribute(attr);
      if (!key) continue;
      const translated = t(key);
      if (prop) {
        el[prop] = translated;
      } else if (domAttr) {
        el.setAttribute(domAttr, translated);
      }
    }
  }

  // Также обработать сам root-элемент если у него есть data-i18n
  for (const { attr, prop, domAttr } of mappings) {
    const key = root.getAttribute?.(attr);
    if (!key) continue;
    const translated = t(key);
    if (prop) {
      root[prop] = translated;
    } else if (domAttr) {
      root.setAttribute(domAttr, translated);
    }
  }
}
