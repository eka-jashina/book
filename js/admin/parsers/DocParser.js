/**
 * DocParser
 *
 * Парсер DOC-файлов (бинарный формат Microsoft Word 97-2003).
 * Использует OLE2Parser для разбора контейнера, затем извлекает текст
 * через Piece Table из потока WordDocument.
 *
 * Формат DOC (Word Binary File Format):
 * 1. OLE2 контейнер → потоки WordDocument, 0Table/1Table
 * 2. FIB (File Information Block) → метаданные документа
 * 3. Piece Table (CLX) → маппинг логических позиций на физические
 * 4. Текст: Unicode (UTF-16LE) или сжатый (CP1252)
 */

import { escapeHtml } from './parserUtils.js';
import { createChapter, wrapChapterHtml, titleFromFilename } from './BaseParser.js';
import { parseOLE2 } from './OLE2Parser.js';

// ═══════════════════════════════════════════════════════════════════════════
// Константы Word Binary Format
// ═══════════════════════════════════════════════════════════════════════════

/** Идентификатор Word документа в FIB */
const WORD_IDENT = 0xA5EC;

/** Бит сжатия в fc поля PCD (Piece Descriptor) */
const FC_COMPRESSED_BIT = 0x40000000;

/** Индекс пары fcClx/lcbClx в FibRgFcLcb97 */
const CLX_PAIR_INDEX = 33;

/** Маркер Pcdt в CLX-структуре */
const PCDT_MARKER = 0x02;

/** Маркер Grpprl (PRC) в CLX-структуре */
const GRPPRL_MARKER = 0x01;

// ═══════════════════════════════════════════════════════════════════════════
// CP1252 → Unicode (диапазон 0x80–0x9F)
// ═══════════════════════════════════════════════════════════════════════════

/** @type {Record<number, number>} */
const CP1252_MAP = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E,
  0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6,
  0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152,
  0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C,
  0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A,
  0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178,
};

// ═══════════════════════════════════════════════════════════════════════════
// Главный API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Парсинг DOC файла
 * @param {File} file
 * @returns {Promise<import('../BookParser.js').ParsedBook>}
 */
export async function parseDoc(file) {
  const title = titleFromFilename(file.name);
  const buffer = await file.arrayBuffer();
  const text = extractDocText(buffer);

  if (!text.trim()) {
    throw new Error('Не удалось извлечь текст из DOC');
  }

  const paragraphs = text.split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const html = paragraphs
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return {
    title,
    author: '',
    chapters: [createChapter(0, title, wrapChapterHtml(title, html))],
  };
}

/**
 * Извлечь текст из бинарного DOC файла.
 * Пробует структурный парсинг OLE2 → FIB → Piece Table,
 * при неудаче использует эвристический fallback.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function extractDocText(buffer) {
  // Попытка структурного парсинга
  const structured = extractDocTextStructured(buffer);
  if (structured) return structured;

  // Fallback: эвристическое извлечение
  return extractDocTextFallback(new Uint8Array(buffer));
}

// Re-export parseOLE2 для обратной совместимости
export { parseOLE2 } from './OLE2Parser.js';

// ═══════════════════════════════════════════════════════════════════════════
// Структурный парсинг: OLE2 → FIB → Piece Table
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Структурное извлечение текста через OLE2 и Piece Table.
 * @param {ArrayBuffer} buffer
 * @returns {string|null} — текст или null если структурный парсинг не удался
 */
function extractDocTextStructured(buffer) {
  const ole2 = parseOLE2(buffer);
  if (!ole2) return null;

  const wordDocEntry = ole2.findEntry('WordDocument');
  if (!wordDocEntry) return null;

  const wordDocData = ole2.readStream(wordDocEntry);
  if (!wordDocData || wordDocData.length < 68) return null;

  const fib = readFIB(wordDocData);
  if (!fib) return null;

  const tableName = fib.fWhichTblStm ? '1Table' : '0Table';
  const tableEntry = ole2.findEntry(tableName);
  if (!tableEntry) return null;

  const tableData = ole2.readStream(tableEntry);
  if (!tableData || tableData.length === 0) return null;

  const pieces = parsePieceTable(tableData, fib.fcClx, fib.lcbClx);
  if (!pieces || pieces.length === 0) return null;

  const text = extractTextFromPieces(wordDocData, pieces, fib.ccpText);
  if (!text.trim()) return null;

  return cleanDocText(text);
}

// ═══════════════════════════════════════════════════════════════════════════
// FIB (File Information Block)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Прочитать FIB из потока WordDocument.
 * @param {Uint8Array} data — содержимое потока WordDocument
 * @returns {{ fWhichTblStm: number, ccpText: number, fcClx: number, lcbClx: number }|null}
 */
function readFIB(data) {
  if (data.length < 68) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // FibBase (32 байта)
  const wIdent = view.getUint16(0, true);
  if (wIdent !== WORD_IDENT) return null;

  const flags = view.getUint16(10, true);
  const fWhichTblStm = (flags >> 9) & 1;

  // Навигация через поля с размерами
  let pos = 32; // конец FibBase

  // FibRgW: csw (uint16) + csw*2 байт
  if (pos + 2 > data.length) return null;
  const csw = view.getUint16(pos, true);
  pos += 2 + csw * 2;

  // FibRgLw: cslw (uint16) + cslw*4 байт
  if (pos + 2 > data.length) return null;
  const cslw = view.getUint16(pos, true);
  pos += 2;

  const fibRgLwStart = pos;

  // ccpText — индекс 3 в FibRgLw97 (поля: cbMac, reserved1, reserved2, ccpText)
  if (cslw < 4 || fibRgLwStart + 4 * 4 > data.length) return null;
  const ccpText = view.getUint32(fibRgLwStart + 3 * 4, true);

  pos += cslw * 4;

  // FibRgFcLcb: cbRgFcLcb (uint16) + cbRgFcLcb*8 байт (пары fc/lcb)
  if (pos + 2 > data.length) return null;
  const cbRgFcLcb = view.getUint16(pos, true);
  pos += 2;

  const fibRgFcLcbStart = pos;

  // fcClx/lcbClx — пара с индексом CLX_PAIR_INDEX (33)
  if (cbRgFcLcb <= CLX_PAIR_INDEX) return null;
  const clxOffset = fibRgFcLcbStart + CLX_PAIR_INDEX * 8;
  if (clxOffset + 8 > data.length) return null;

  const fcClx = view.getUint32(clxOffset, true);
  const lcbClx = view.getUint32(clxOffset + 4, true);

  if (lcbClx === 0) return null;

  return { fWhichTblStm, ccpText, fcClx, lcbClx };
}

// ═══════════════════════════════════════════════════════════════════════════
// Piece Table
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} PieceDescriptor
 * @property {number} cpStart — начальная позиция символов
 * @property {number} cpEnd — конечная позиция символов
 * @property {number} fileOffset — смещение в потоке WordDocument (байты)
 * @property {boolean} unicode — true если UTF-16LE, false если CP1252
 */

/**
 * Разобрать Piece Table из CLX-структуры в Table stream.
 * CLX = [PRC...] + Pcdt
 * PRC: маркер 0x01, cbGrpprl (int16), данные
 * Pcdt: маркер 0x02, lcb (uint32), PlcPcd
 * PlcPcd: (n+1) CP (uint32) + n PCD (8 байт)
 *
 * @param {Uint8Array} tableData — содержимое Table stream
 * @param {number} fcClx — смещение CLX в Table stream
 * @param {number} lcbClx — размер CLX
 * @returns {PieceDescriptor[]|null}
 */
function parsePieceTable(tableData, fcClx, lcbClx) {
  if (fcClx + lcbClx > tableData.length) return null;

  const view = new DataView(tableData.buffer, tableData.byteOffset, tableData.byteLength);
  let pos = fcClx;
  const endPos = fcClx + lcbClx;

  // Пропустить PRC записи (маркер 0x01)
  let guard = 0;
  while (pos < endPos && guard++ < 1000) {
    if (tableData[pos] === PCDT_MARKER) break;
    if (tableData[pos] === GRPPRL_MARKER) {
      pos += 1;
      if (pos + 2 > endPos) return null;
      const cbGrpprl = view.getInt16(pos, true);
      pos += 2 + cbGrpprl;
    } else {
      // Неожиданный маркер
      return null;
    }
  }

  // Pcdt: маркер + lcb + PlcPcd
  if (pos >= endPos || tableData[pos] !== PCDT_MARKER) return null;
  pos += 1;

  if (pos + 4 > endPos) return null;
  const pcdtSize = view.getUint32(pos, true);
  pos += 4;

  if (pos + pcdtSize > tableData.length) return null;

  // PlcPcd: (n+1) CPs (uint32) + n PCDs (8 байт)
  // pcdtSize = (n+1)*4 + n*8 = 4n + 4 + 8n = 12n + 4
  // n = (pcdtSize - 4) / 12
  const n = (pcdtSize - 4) / 12;
  if (n < 1 || !Number.isInteger(n)) return null;

  const cpArrayStart = pos;
  const pcdArrayStart = pos + (n + 1) * 4;

  const pieces = [];
  for (let i = 0; i < n; i++) {
    const cpStart = view.getUint32(cpArrayStart + i * 4, true);
    const cpEnd = view.getUint32(cpArrayStart + (i + 1) * 4, true);

    // PCD: 2 байта unused + 4 байта fc + 2 байта prm
    const pcdOff = pcdArrayStart + i * 8;
    if (pcdOff + 6 > tableData.length) break;

    const fcRaw = view.getUint32(pcdOff + 2, true);
    const compressed = (fcRaw & FC_COMPRESSED_BIT) !== 0;

    let fileOffset;
    if (compressed) {
      // Сжатый: байтовое смещение = (fc без бита 30) / 2
      fileOffset = (fcRaw & ~FC_COMPRESSED_BIT) >>> 1;
    } else {
      // Unicode: fc — это байтовое смещение напрямую
      fileOffset = fcRaw;
    }

    pieces.push({
      cpStart,
      cpEnd,
      fileOffset,
      unicode: !compressed,
    });
  }

  return pieces.length > 0 ? pieces : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Извлечение текста из Piece Descriptors
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Извлечь текст из WordDocument stream по piece descriptors.
 * @param {Uint8Array} wordDocData — содержимое потока WordDocument
 * @param {PieceDescriptor[]} pieces — дескрипторы фрагментов
 * @param {number} ccpText — количество символов основного текста
 * @returns {string}
 */
function extractTextFromPieces(wordDocData, pieces, ccpText) {
  const result = [];
  let totalChars = 0;

  for (const piece of pieces) {
    // Ограничиваем извлечение основным текстом (без сносок, колонтитулов)
    if (totalChars >= ccpText) break;

    const charCount = piece.cpEnd - piece.cpStart;
    const charsToRead = Math.min(charCount, ccpText - totalChars);

    if (piece.unicode) {
      const byteLen = charsToRead * 2;
      if (piece.fileOffset + byteLen > wordDocData.length) break;
      for (let j = 0; j < charsToRead; j++) {
        const off = piece.fileOffset + j * 2;
        const code = wordDocData[off] | (wordDocData[off + 1] << 8);
        result.push(String.fromCharCode(code));
      }
    } else {
      if (piece.fileOffset + charsToRead > wordDocData.length) break;
      for (let j = 0; j < charsToRead; j++) {
        const b = wordDocData[piece.fileOffset + j];
        result.push(decodeCp1252Char(b));
      }
    }

    totalChars += charsToRead;
  }

  return result.join('');
}

/**
 * Декодировать один байт CP1252 в символ Unicode.
 * @param {number} byte
 * @returns {string}
 */
function decodeCp1252Char(byte) {
  if (byte >= 0x80 && byte <= 0x9F) {
    const mapped = CP1252_MAP[byte];
    return mapped ? String.fromCharCode(mapped) : String.fromCharCode(byte);
  }
  return String.fromCharCode(byte);
}

// ═══════════════════════════════════════════════════════════════════════════
// Очистка текста
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Очистить извлечённый текст от специальных символов Word.
 * @param {string} text
 * @returns {string}
 */
function cleanDocText(text) {
  let result = '';
  let inField = false;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    // Поля Word: 0x13 (начало) ... 0x14 (разделитель) ... 0x15 (конец)
    if (code === 0x13) { inField = true; continue; }
    if (code === 0x15) { inField = false; continue; }
    if (code === 0x14) continue;
    if (inField) continue;

    // Спецсимволы
    if (code === 0x0D) { result += '\n'; continue; }    // Paragraph mark → newline
    if (code === 0x0B) { result += '\n'; continue; }    // Soft return → newline
    if (code === 0x0C) { result += '\n\n'; continue; }  // Page break → double newline
    if (code === 0x07) { result += '\t'; continue; }    // Cell/row end → tab
    if (code === 0x01 || code === 0x08) continue;        // Inline picture / drawn object → skip

    // Остальные управляющие символы (кроме tab и newline) → пропуск
    if (code < 0x20 && code !== 0x09 && code !== 0x0A) continue;

    result += text[i];
  }

  // Нормализация: убрать лишние пустые строки, trim
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/\t+/g, ' ');
  result = result.trim();

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Fallback: эвристическое извлечение (улучшенная версия)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Эвристическое извлечение текста для файлов,
 * которые не удалось разобрать структурно.
 * Собирает все достаточно длинные фрагменты текста.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function extractDocTextFallback(bytes) {
  // UTF-16LE
  const utf16Text = extractUTF16Chunks(bytes);
  if (utf16Text) return utf16Text;

  // ASCII/Latin-1
  return extractAsciiChunks(bytes);
}

/**
 * Извлечь UTF-16LE текстовые фрагменты из бинарных данных.
 * Собирает все фрагменты (не только самый длинный).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function extractUTF16Chunks(bytes) {
  const chunks = [];
  let current = '';
  let consecutivePrintable = 0;

  for (let i = 0; i < bytes.length - 1; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);

    if (isPrintableChar(code)) {
      current += String.fromCharCode(code);
      consecutivePrintable++;
    } else {
      if (consecutivePrintable > 40) {
        chunks.push(current);
      }
      current = '';
      consecutivePrintable = 0;
    }
  }

  if (consecutivePrintable > 40) {
    chunks.push(current);
  }

  if (chunks.length === 0) return '';

  // Объединить все значимые фрагменты, разделяя пустыми строками
  const text = chunks.join('\n\n');
  return cleanFallbackText(text);
}

/**
 * Извлечь ASCII текстовые фрагменты.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function extractAsciiChunks(bytes) {
  const chunks = [];
  let current = '';
  let consecutivePrintable = 0;

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 0x20 && b <= 0x7E) || b === 0x0A || b === 0x0D || b === 0x09) {
      current += String.fromCharCode(b);
      consecutivePrintable++;
    } else {
      if (consecutivePrintable > 50) {
        chunks.push(current);
      }
      current = '';
      consecutivePrintable = 0;
    }
  }

  if (consecutivePrintable > 50) {
    chunks.push(current);
  }

  if (chunks.length === 0) return '';

  const text = chunks.join('\n\n');
  return cleanFallbackText(text);
}

/**
 * Проверка: является ли код печатным символом.
 * @param {number} code — Unicode code point
 * @returns {boolean}
 */
function isPrintableChar(code) {
  if (code === 0x0A || code === 0x0D || code === 0x09) return true;
  if (code < 0x20) return false;
  if (code === 0xFFFE || code === 0xFFFF) return false;
  return true;
}

/**
 * Очистка текста, полученного эвристическим методом.
 * @param {string} text
 * @returns {string}
 */
function cleanFallbackText(text) {
  // eslint-disable-next-line no-control-regex
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// Экспортируемые функции для тестов (обратная совместимость)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Используйте extractDocText (включает структурный парсинг + fallback)
 */
export function extractDocTextAscii(bytes) {
  return extractAsciiChunks(bytes);
}
