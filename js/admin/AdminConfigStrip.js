/**
 * AdminConfigStrip
 *
 * Чистые функции для подготовки снимка конфигурации к сохранению в localStorage.
 * Заменяют тяжёлые data URL маркерами _idb — ридер дозагрузит из IndexedDB.
 *
 * Извлечены из AdminConfigStore для лучшей разделённости ответственности.
 */

/**
 * Заменить data URL маркером _idb в объекте.
 * Мутирует объект, удаляя указанное поле и выставляя маркер.
 * @param {Object} obj - Объект для модификации
 * @param {string} field - Имя поля с data URL
 * @param {string} [markerField='_idb'] - Имя поля-маркера
 */
export function stripDataUrl(obj, field, markerField = '_idb') {
  if (obj[field]?.startsWith?.('data:')) {
    obj[markerField] = true;
    delete obj[field];
  }
}

/**
 * Подготовить снимок книги для localStorage — убрать тяжёлые data URL.
 * Мутирует переданный объект.
 * @param {Object} book
 */
export function stripBookDataUrls(book) {
  // Главы: htmlContent
  if (book.chapters) {
    for (const ch of book.chapters) {
      if (ch.htmlContent) {
        ch._idb = true;
        delete ch.htmlContent;
      }
    }
  }

  // Декоративный шрифт
  if (book.decorativeFont?.dataUrl) {
    book.decorativeFont = { name: book.decorativeFont.name, _idb: true };
  }

  // Амбиенты
  if (book.ambients) {
    for (const a of book.ambients) {
      stripDataUrl(a, 'file');
    }
  }

  // Оформление: coverBgImage, customTextureData
  if (book.appearance) {
    for (const theme of ['light', 'dark']) {
      const themeData = book.appearance[theme];
      if (!themeData) continue;
      stripDataUrl(themeData, 'coverBgImage', '_idbCoverBgImage');
      stripDataUrl(themeData, 'customTextureData', '_idbCustomTexture');
    }
  }
}
