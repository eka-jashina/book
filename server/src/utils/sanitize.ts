import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Parameters<typeof DOMPurify>[0]);

/** data-* атрибуты, необходимые для фотоальбома и навигации по главам */
const ALLOWED_DATA_ATTRS = new Set([
  'data-layout',
  'data-filter',
  'data-filter-intensity',
  'data-rotation',
  'data-chapter',
  'data-chapter-start',
  'data-index',
]);

export function sanitizeHtml(html: string): string {
  const clean = purify.sanitize(html, {
    ALLOWED_TAGS: [
      'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'em', 'strong',
      'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'img', 'table',
      'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'span', 'div', 'hr', 'sup', 'sub',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'width', 'height'],
    ALLOW_DATA_ATTR: true,
  });

  // Фильтрация: оставить только разрешённые data-* атрибуты
  const dom = new JSDOM(clean);
  for (const el of dom.window.document.querySelectorAll('*')) {
    for (const { name } of [...el.attributes]) {
      if (name.startsWith('data-') && !ALLOWED_DATA_ATTRS.has(name)) {
        el.removeAttribute(name);
      }
    }
  }
  return dom.window.document.body.innerHTML;
}
