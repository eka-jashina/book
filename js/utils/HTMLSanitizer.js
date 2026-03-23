/**
 * HTML SANITIZER
 * Защита от XSS при загрузке внешнего HTML-контента.
 *
 * Использует DOMPurify как основной движок санитизации с дополнительной
 * пост-обработкой для фильтрации атрибутов по тегам и защиты внешних ссылок.
 *
 * Особенности:
 * - DOMPurify — battle-tested движок (поддерживает защиту от mXSS, namespace pollution и др.)
 * - Белый список разрешённых тегов и атрибутов
 * - Фильтрация data-* атрибутов по белому списку
 * - Фильтрация атрибутов по конкретному тегу (src только для img, href только для a и т.д.)
 * - Блокировка опасных URI-схем (javascript:, vbscript:, data:text/html, blob: и др.)
 * - Разрешение безопасных растровых data:image/ URI (PNG, JPEG, WebP, GIF и др.)
 * - Добавление rel="noopener noreferrer" и target="_blank" на внешние ссылки
 */

import DOMPurify from 'dompurify';

const DEFAULT_ALLOWED_TAGS = [
  "article", "section", "div", "span", "main", "aside",
  "header", "footer", "nav", "p", "h1", "h2", "h3", "h4",
  "h5", "h6", "strong", "em", "b", "i", "u", "s", "mark",
  "small", "sub", "sup", "ol", "ul", "li", "dl", "dt", "dd",
  "blockquote", "pre", "code", "br", "hr", "figure",
  "figcaption", "img", "a", "table", "thead", "tbody", "tfoot",
  "tr", "th", "td", "caption",
];

const DEFAULT_ALLOWED_ATTRS_GLOBAL = ["class", "id", "title", "lang", "dir"];

const DEFAULT_ALLOWED_ATTRS_BY_TAG = {
  img: ["src", "alt", "width", "height", "loading"],
  a: ["href", "rel", "target"],
  ol: ["start", "type", "reversed"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"],
};

const DEFAULT_ALLOWED_DATA_ATTRS = ["data-chapter", "data-chapter-start", "data-index", "data-layout", "data-filter", "data-filter-intensity", "data-rotation"];

// Разрешённые URI-схемы: стандартные протоколы + безопасные растровые data:image/ URI.
// SVG в data: URL намеренно не разрешён — может содержать <script>.
// Важно: в последней альтернативе `:` включён в exclusion-set `[^a-z+\-.:]`,
// чтобы `data:...` не попадал под паттерн для относительных URL.
const ALLOWED_URI_REGEXP =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|data:image\/(?:png|jpe?g|gif|webp|bmp|tiff?|ico|avif);base64,|[^a-z]|[a-z+\-.]+(?:[^a-z+\-.:]|$))/i;

// Безопасные растровые data: URI — разрешены для встроенных изображений из EPUB/FB2.
// DOMPurify разрешает data: URI для тегов из DATA_URI_TAGS (включая img) безусловно,
// поэтому проверяем MIME-тип явно в пост-обработке.
const SAFE_IMAGE_DATA_URI_RE = /^data:image\/(?:png|jpe?g|gif|webp|bmp|tiff?|ico|avif);base64,/i;

const EXTERNAL_URL_RE = /^https?:\/\//i;

export class HTMLSanitizer {
  /**
   * @param {Object} options - Опции настройки
   * @param {string[]} [options.allowedTags] - Разрешённые HTML-теги
   * @param {string[]} [options.allowedAttrsGlobal] - Глобально разрешённые атрибуты
   * @param {Object} [options.allowedAttrsByTag] - Атрибуты, разрешённые для конкретных тегов
   * @param {string[]} [options.allowedDataAttrs] - Разрешённые data-* атрибуты
   */
  constructor(options = {}) {
    /** @type {Set<string>} */
    this.ALLOWED_TAGS = new Set(options.allowedTags || DEFAULT_ALLOWED_TAGS);
    /** @type {Set<string>} */
    this.ALLOWED_ATTRS_GLOBAL = new Set(options.allowedAttrsGlobal || DEFAULT_ALLOWED_ATTRS_GLOBAL);
    /** @type {Object<string, string[]>} */
    this.ALLOWED_ATTRS_BY_TAG = options.allowedAttrsByTag || DEFAULT_ALLOWED_ATTRS_BY_TAG;
    /** @type {Set<string>} */
    this.ALLOWED_DATA_ATTRS = new Set(options.allowedDataAttrs || DEFAULT_ALLOWED_DATA_ATTRS);
  }

  /**
   * Очистить HTML от потенциально опасного содержимого.
   *
   * Двухпроходной алгоритм:
   * 1. DOMPurify — удаляет опасные теги, обработчики событий, опасные URI-схемы,
   *    HTML-комментарии, namespace-атаки и mXSS-паттерны.
   * 2. Пост-обработка — ограничивает атрибуты по тегам, фильтрует data-*,
   *    добавляет защитные атрибуты на внешние ссылки.
   *
   * @param {string} html - Исходный HTML
   * @returns {string} Безопасный HTML
   */
  sanitize(html) {
    if (!html || typeof html !== 'string') return '';

    // Объединяем все разрешённые атрибуты для первого прохода DOMPurify.
    // DOMPurify применяет ALLOWED_ATTR глобально; пост-обработка сужает до per-tag.
    const allAllowedAttrs = [
      ...this.ALLOWED_ATTRS_GLOBAL,
      ...Object.values(this.ALLOWED_ATTRS_BY_TAG).flat(),
    ];

    // Проход 1: DOMPurify обрабатывает тяжёлую security-логику:
    // mXSS, namespace pollution, опасные теги, event-handler'ы, опасные URI
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [...this.ALLOWED_TAGS],
      ALLOWED_ATTR: allAllowedAttrs,
      ALLOW_DATA_ATTR: true,      // data-* фильтруем вручную на проходе 2
      ALLOWED_URI_REGEXP,
    });

    if (!clean) return '';

    // Проход 2: Пост-обработка DOM для per-tag фильтрации атрибутов,
    // выборочного разрешения data-*, и добавления защиты внешних ссылок
    const doc = new DOMParser().parseFromString(clean, 'text/html');
    this._postProcess(doc.body);
    return doc.body.innerHTML;
  }

  /**
   * Обойти все элементы и применить дополнительные ограничения
   * @private
   * @param {Element} root
   */
  _postProcess(root) {
    for (const el of root.querySelectorAll('*')) {
      this._filterAttributes(el);
      this._hardenExternalLink(el);
    }
  }

  /**
   * Убрать атрибуты, не разрешённые для данного тега, и запрещённые data-*
   * @private
   * @param {Element} el
   */
  _filterAttributes(el) {
    const tagName = el.tagName.toLowerCase();
    const toRemove = [];

    for (const { name } of el.attributes) {
      const lower = name.toLowerCase();

      if (lower.startsWith('data-')) {
        if (!this.ALLOWED_DATA_ATTRS.has(lower)) toRemove.push(name);
        continue;
      }

      if (this.ALLOWED_ATTRS_GLOBAL.has(lower)) continue;

      const tagAttrs = this.ALLOWED_ATTRS_BY_TAG[tagName];
      if (!tagAttrs?.includes(lower)) {
        toRemove.push(name);
        continue;
      }

      // Для URI-атрибутов: DOMPurify разрешает любые data: URI на img/audio/video
      // (внутренний DATA_URI_TAGS). Явно ограничиваем только безопасными растровыми форматами.
      if (lower === 'src' || lower === 'href') {
        const val = el.getAttribute(name);
        if (val && /^data:/i.test(val) && !SAFE_IMAGE_DATA_URI_RE.test(val)) {
          toRemove.push(name);
        }
      }
    }

    for (const name of toRemove) el.removeAttribute(name);
  }

  /**
   * Добавить rel="noopener noreferrer" и target="_blank" на внешние ссылки
   * @private
   * @param {Element} el
   */
  _hardenExternalLink(el) {
    if (el.tagName.toLowerCase() !== 'a') return;
    const href = el.getAttribute('href');
    if (href && EXTERNAL_URL_RE.test(href)) {
      el.setAttribute('rel', 'noopener noreferrer');
      el.setAttribute('target', '_blank');
    }
  }
}

export const sanitizer = new HTMLSanitizer();
