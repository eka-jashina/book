/**
 * Данные и генерация карточек выбора режима создания книги.
 * Используются в admin (index.js) и reader (BookshelfScreen.js).
 */

import { t } from '@i18n';

/** Конфигурация карточек типов (Книга / Альбом) */
export const MODE_CARDS = [
  {
    mode: 'book',
    icon: '<path fill="currentColor" d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>',
    titleKey: 'admin.mode.bookTitle',
    descKey: 'admin.mode.bookDesc',
  },
  {
    mode: 'album',
    icon: '<path fill="currentColor" d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>',
    titleKey: 'admin.mode.albumTitle',
    descKey: 'admin.mode.albumDesc',
  },
];

/**
 * Генерирует HTML карточек режимов и вставляет в контейнер.
 * @param {HTMLElement} container - контейнер для вставки
 * @param {string} cardClass - CSS-класс кнопки ('mode-card' для admin, 'bookshelf-mode-card' для reader)
 * @param {string} iconClass - CSS-класс иконки ('mode-card-icon' / 'bookshelf-mode-card-icon')
 * @param {string} titleClass - CSS-класс заголовка ('mode-card-title' / 'bookshelf-mode-card-title')
 * @param {string} descClass - CSS-класс описания ('mode-card-desc' / 'bookshelf-mode-card-desc')
 */
export function renderModeCards(container, {
  cardClass = 'mode-card',
  iconClass = 'mode-card-icon',
  titleClass = 'mode-card-title',
  descClass = 'mode-card-desc',
} = {}) {
  container.innerHTML = MODE_CARDS.map(card => `
    <button type="button" class="${cardClass}" data-mode="${card.mode}">
      <div class="${iconClass}">
        <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">${card.icon}</svg>
      </div>
      <div class="${titleClass}" data-i18n="${card.titleKey}">${t(card.titleKey)}</div>
      <div class="${descClass}" data-i18n="${card.descKey}">${t(card.descKey)}</div>
    </button>
  `).join('');
}
