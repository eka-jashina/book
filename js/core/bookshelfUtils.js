/**
 * Утилиты и константы для BookshelfScreen
 * Вынесены для повторного использования и тестируемости.
 */
import { t } from '@i18n';

/** Количество книг на одной полке */
export const BOOKS_PER_SHELF = 5;

/** Циклическое переключение видимости */
export const VISIBILITY_NEXT = {
  draft: 'published',
  published: 'unlisted',
  unlisted: 'draft',
};

/**
 * Метки видимости — вызываются как функции для актуального перевода.
 * @param {string} vis - draft | unlisted | published
 * @returns {string}
 */
export function visibilityLabel(vis) {
  const map = {
    draft: 'bookshelf.visibilityDraft',
    unlisted: 'bookshelf.visibilityUnlisted',
    published: 'bookshelf.visibilityPublished',
  };
  return t(map[vis] || map.draft);
}

/**
 * Дефолтная книга для полки (когда нет конфига)
 * @returns {Object}
 */
export function getDefaultBook() {
  return {
    id: 'default',
    title: t('bookshelf.defaultTitle'),
    author: t('bookshelf.defaultAuthor'),
    appearance: {
      light: {
        coverBgStart: '#3a2d1f',
        coverBgEnd: '#2a2016',
        coverText: '#f2e9d8',
      },
    },
  };
}

/**
 * Форматирование количества книг с учётом правил склонения
 * @param {number} count
 * @returns {string}
 */
export function formatBooksCount(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  let suffix;
  if (mod10 === 1 && mod100 !== 11) {
    suffix = 'one';
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    suffix = 'few';
  } else {
    suffix = 'many';
  }

  return t(`bookshelf.booksCount_${suffix}`, { count });
}
