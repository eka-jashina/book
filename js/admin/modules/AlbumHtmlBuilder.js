/**
 * Генерация HTML-разметки фотоальбома из структурированных данных
 */

import { getPageSlots, computeFilterStyle, DEFAULT_FILTER_INTENSITY } from './albumConstants.js';

/**
 * Сгенерировать HTML-разметку мульти-страничного фотоальбома
 * @param {Object} albumData - { title, hideTitle, pages }
 * @param {Function} escapeHtml - функция экранирования HTML
 * @returns {string} HTML-строка
 */
export function buildAlbumHtml(albumData, escapeHtml) {
  const h2Class = albumData.hideTitle ? ' class="sr-only"' : '';

  const albumDivs = albumData.pages.map(page => {
    const figures = getPageSlots(page).filter(img => img?.dataUrl).map(img => {
      const caption = img.caption
        ? `<figcaption>${escapeHtml(img.caption)}</figcaption>`
        : '';
      const modifiers = buildItemModifiers(img);
      const imgStyles = buildImgInlineStyle(img);
      const styleAttr = imgStyles ? ` style="${imgStyles}"` : '';
      const dataAttrs = buildImgDataAttrs(img);
      return `<figure class="photo-album__item${modifiers}"><img src="${img.dataUrl}" alt="${escapeHtml(img.caption || '')}"${styleAttr}${dataAttrs}>${caption}</figure>`;
    });
    return `<div class="photo-album" data-layout="${page.layout}">${figures.join('')}</div>`;
  });

  return `<article><h2${h2Class}>${escapeHtml(albumData.title)}</h2>${albumDivs.join('')}</article>`;
}

/** Собрать CSS-модификаторы рамки и фильтра для figure */
export function buildItemModifiers(img) {
  let cls = '';
  if (img.frame && img.frame !== 'none') cls += ` photo-album__item--frame-${img.frame}`;
  if (img.filter && img.filter !== 'none') cls += ` photo-album__item--filter-${img.filter}`;
  return cls;
}

/** Собрать inline style для <img>: rotation + filter с учётом интенсивности */
export function buildImgInlineStyle(img) {
  const parts = [];
  if (img.rotation) parts.push(`transform:rotate(${img.rotation}deg)`);
  const filterStyle = computeFilterStyle(img.filter, img.filterIntensity);
  if (filterStyle) parts.push(`filter:${filterStyle}`);
  return parts.join(';');
}

/**
 * Собрать data-атрибуты для <img>, чтобы стили выжили после HTML-санитизации.
 * Санитайзер удаляет inline style, но data-атрибуты из белого списка сохраняются.
 * AsyncPaginator после санитизации восстанавливает inline-стили из этих атрибутов.
 */
export function buildImgDataAttrs(img) {
  const attrs = [];
  if (img.filter && img.filter !== 'none') {
    attrs.push(`data-filter="${img.filter}"`);
    attrs.push(`data-filter-intensity="${img.filterIntensity ?? DEFAULT_FILTER_INTENSITY}"`);
  }
  if (img.rotation) {
    attrs.push(`data-rotation="${img.rotation}"`);
  }
  return attrs.length ? ` ${attrs.join(' ')}` : '';
}
