/**
 * DocParser
 *
 * Парсер DOC-файлов (бинарный формат Microsoft Word 97-2003).
 * Реализует парсинг OLE2 Compound Document и извлечение текста
 * через Piece Table из потока WordDocument.
 */

import { escapeHtml, type ParsedBook } from './parserUtils.js';
import { createChapter, wrapChapterHtml, titleFromFilename } from './BaseParser.js';

// ═══════════════════════════════════════════════════════════════════════════
// Константы OLE2
// ═══════════════════════════════════════════════════════════════════════════

const OLE2_SIGNATURE = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
const ENDOFCHAIN = -2;
const WORD_IDENT = 0xA5EC;
const FC_COMPRESSED_BIT = 0x40000000;
const CLX_PAIR_INDEX = 33;
const PCDT_MARKER = 0x02;
const GRPPRL_MARKER = 0x01;

const CP1252_MAP: Record<number, number> = {
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

export function parseDoc(buffer: Buffer, filename: string): ParsedBook {
  const title = titleFromFilename(filename);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const text = extractDocText(arrayBuffer);

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

function extractDocText(buffer: ArrayBuffer): string {
  const structured = extractDocTextStructured(buffer);
  if (structured) return structured;
  return extractDocTextFallback(new Uint8Array(buffer));
}

// ═══════════════════════════════════════════════════════════════════════════
// Структурный парсинг: OLE2 → FIB → Piece Table
// ═══════════════════════════════════════════════════════════════════════════

interface OLE2Container {
  findEntry: (name: string) => DirectoryEntry | null;
  readStream: (entry: DirectoryEntry) => Uint8Array | null;
}

interface DirectoryEntry {
  name: string;
  type: number;
  startSector: number;
  size: number;
  index: number;
}

interface FIBData {
  fWhichTblStm: number;
  ccpText: number;
  fcClx: number;
  lcbClx: number;
}

interface PieceDescriptor {
  cpStart: number;
  cpEnd: number;
  fileOffset: number;
  unicode: boolean;
}

function extractDocTextStructured(buffer: ArrayBuffer): string | null {
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
// OLE2 Compound File Binary парсер
// ═══════════════════════════════════════════════════════════════════════════

function parseOLE2(buffer: ArrayBuffer): OLE2Container | null {
  if (buffer.byteLength < 512) return null;

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== OLE2_SIGNATURE[i]) return null;
  }

  const sectorSizePow = view.getUint16(30, true);
  if (sectorSizePow < 7 || sectorSizePow > 16) return null;
  const sectorSize = 1 << sectorSizePow;

  const miniSectorSizePow = view.getUint16(32, true);
  const miniSectorSize = 1 << miniSectorSizePow;
  const firstDirSector = view.getInt32(48, true);
  const miniStreamCutoff = view.getUint32(56, true);
  const firstMiniFATSector = view.getInt32(60, true);
  const firstDIFATSector = view.getInt32(68, true);

  const sectorOffset = (sector: number) => (sector + 1) * sectorSize;

  // DIFAT → FAT
  const difat: number[] = [];
  for (let i = 0; i < 109; i++) {
    const sector = view.getInt32(76 + i * 4, true);
    if (sector >= 0) difat.push(sector);
  }

  let nextDIFAT = firstDIFATSector;
  let difatGuard = 0;
  while (nextDIFAT >= 0 && nextDIFAT !== ENDOFCHAIN && difatGuard++ < 1000) {
    const off = sectorOffset(nextDIFAT);
    if (off + sectorSize > buffer.byteLength) break;
    const entriesPerSector = (sectorSize / 4) - 1;
    for (let i = 0; i < entriesPerSector; i++) {
      const sector = view.getInt32(off + i * 4, true);
      if (sector >= 0) difat.push(sector);
    }
    nextDIFAT = view.getInt32(off + sectorSize - 4, true);
  }

  const fat: number[] = [];
  for (const fatSector of difat) {
    const off = sectorOffset(fatSector);
    if (off + sectorSize > buffer.byteLength) break;
    for (let i = 0; i < sectorSize / 4; i++) {
      fat.push(view.getInt32(off + i * 4, true));
    }
  }

  // Directory entries
  const directories: DirectoryEntry[] = [];
  let dirSector = firstDirSector;
  let dirGuard = 0;
  while (dirSector >= 0 && dirSector !== ENDOFCHAIN && dirGuard++ < 10000) {
    const off = sectorOffset(dirSector);
    if (off + sectorSize > buffer.byteLength) break;

    const entriesPerSector = sectorSize / 128;
    for (let i = 0; i < entriesPerSector; i++) {
      const entryOff = off + i * 128;
      if (entryOff + 128 > buffer.byteLength) break;

      const nameLen = view.getUint16(entryOff + 64, true);
      if (nameLen === 0 || nameLen > 64) continue;

      let name = '';
      const charCount = Math.max(0, (nameLen - 2) / 2);
      for (let j = 0; j < charCount; j++) {
        name += String.fromCharCode(view.getUint16(entryOff + j * 2, true));
      }

      const type = bytes[entryOff + 66];
      const startSector = view.getInt32(entryOff + 116, true);
      const size = view.getUint32(entryOff + 120, true);

      directories.push({ name, type, startSector, size, index: directories.length });
    }

    dirSector = fat[dirSector] ?? ENDOFCHAIN;
  }

  // Чтение потоков
  function readChain(startSector: number, size: number, fatTable: number[], sectorSz: number, getOffset: (s: number) => number): Uint8Array {
    const data = new Uint8Array(size);
    let sector = startSector;
    let written = 0;
    let guard = 0;
    while (sector >= 0 && sector !== ENDOFCHAIN && written < size && guard++ < 100000) {
      const off = getOffset(sector);
      const chunk = Math.min(sectorSz, size - written);
      if (off + chunk > buffer.byteLength) break;
      data.set(bytes.subarray(off, off + chunk), written);
      written += chunk;
      sector = fatTable[sector] ?? ENDOFCHAIN;
    }
    return written >= size ? data : data.subarray(0, written);
  }

  const rootEntry = directories.find(d => d.type === 5);

  const miniFAT: number[] = [];
  if (firstMiniFATSector >= 0) {
    let mfSector = firstMiniFATSector;
    let mfGuard = 0;
    while (mfSector >= 0 && mfSector !== ENDOFCHAIN && mfGuard++ < 10000) {
      const off = sectorOffset(mfSector);
      if (off + sectorSize > buffer.byteLength) break;
      for (let i = 0; i < sectorSize / 4; i++) {
        miniFAT.push(view.getInt32(off + i * 4, true));
      }
      mfSector = fat[mfSector] ?? ENDOFCHAIN;
    }
  }

  let miniStreamData: Uint8Array | null = null;
  function getMiniStream(): Uint8Array | null {
    if (miniStreamData) return miniStreamData;
    if (!rootEntry || rootEntry.startSector < 0) return null;
    miniStreamData = readChain(rootEntry.startSector, rootEntry.size, fat, sectorSize, sectorOffset);
    return miniStreamData;
  }

  function readStream(entry: DirectoryEntry): Uint8Array | null {
    if (!entry || entry.size === 0) return null;
    if (entry.startSector < 0) return null;

    if (entry.size < miniStreamCutoff && entry.type === 2) {
      const container = getMiniStream();
      if (container) {
        const data = new Uint8Array(entry.size);
        let sector = entry.startSector;
        let written = 0;
        let guard = 0;
        while (sector >= 0 && sector !== ENDOFCHAIN && written < entry.size && guard++ < 100000) {
          const off = sector * miniSectorSize;
          const chunk = Math.min(miniSectorSize, entry.size - written);
          if (off + chunk > container.length) break;
          data.set(container.subarray(off, off + chunk), written);
          written += chunk;
          sector = miniFAT[sector] ?? ENDOFCHAIN;
        }
        if (written >= entry.size) return data;
      }
    }

    return readChain(entry.startSector, entry.size, fat, sectorSize, sectorOffset);
  }

  function findEntry(name: string): DirectoryEntry | null {
    return directories.find(d => d.name === name && d.type === 2) || null;
  }

  return { findEntry, readStream };
}

// ═══════════════════════════════════════════════════════════════════════════
// FIB (File Information Block)
// ═══════════════════════════════════════════════════════════════════════════

function readFIB(data: Uint8Array): FIBData | null {
  if (data.length < 68) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const wIdent = view.getUint16(0, true);
  if (wIdent !== WORD_IDENT) return null;

  const flags = view.getUint16(10, true);
  const fWhichTblStm = (flags >> 9) & 1;

  let pos = 32;

  if (pos + 2 > data.length) return null;
  const csw = view.getUint16(pos, true);
  pos += 2 + csw * 2;

  if (pos + 2 > data.length) return null;
  const cslw = view.getUint16(pos, true);
  pos += 2;

  const fibRgLwStart = pos;

  if (cslw < 4 || fibRgLwStart + 4 * 4 > data.length) return null;
  const ccpText = view.getUint32(fibRgLwStart + 3 * 4, true);

  pos += cslw * 4;

  if (pos + 2 > data.length) return null;
  const cbRgFcLcb = view.getUint16(pos, true);
  pos += 2;

  const fibRgFcLcbStart = pos;

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

function parsePieceTable(tableData: Uint8Array, fcClx: number, lcbClx: number): PieceDescriptor[] | null {
  if (fcClx + lcbClx > tableData.length) return null;

  const view = new DataView(tableData.buffer, tableData.byteOffset, tableData.byteLength);
  let pos = fcClx;
  const endPos = fcClx + lcbClx;

  let guard = 0;
  while (pos < endPos && guard++ < 1000) {
    if (tableData[pos] === PCDT_MARKER) break;
    if (tableData[pos] === GRPPRL_MARKER) {
      pos += 1;
      if (pos + 2 > endPos) return null;
      const cbGrpprl = view.getInt16(pos, true);
      pos += 2 + cbGrpprl;
    } else {
      return null;
    }
  }

  if (pos >= endPos || tableData[pos] !== PCDT_MARKER) return null;
  pos += 1;

  if (pos + 4 > endPos) return null;
  const pcdtSize = view.getUint32(pos, true);
  pos += 4;

  if (pos + pcdtSize > tableData.length) return null;

  const n = (pcdtSize - 4) / 12;
  if (n < 1 || !Number.isInteger(n)) return null;

  const cpArrayStart = pos;
  const pcdArrayStart = pos + (n + 1) * 4;

  const pieces: PieceDescriptor[] = [];
  for (let i = 0; i < n; i++) {
    const cpStart = view.getUint32(cpArrayStart + i * 4, true);
    const cpEnd = view.getUint32(cpArrayStart + (i + 1) * 4, true);

    const pcdOff = pcdArrayStart + i * 8;
    if (pcdOff + 6 > tableData.length) break;

    const fcRaw = view.getUint32(pcdOff + 2, true);
    const compressed = (fcRaw & FC_COMPRESSED_BIT) !== 0;

    let fileOffset: number;
    if (compressed) {
      fileOffset = (fcRaw & ~FC_COMPRESSED_BIT) >>> 1;
    } else {
      fileOffset = fcRaw;
    }

    pieces.push({ cpStart, cpEnd, fileOffset, unicode: !compressed });
  }

  return pieces.length > 0 ? pieces : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Извлечение текста из Piece Descriptors
// ═══════════════════════════════════════════════════════════════════════════

function extractTextFromPieces(wordDocData: Uint8Array, pieces: PieceDescriptor[], ccpText: number): string {
  const result: string[] = [];
  let totalChars = 0;

  for (const piece of pieces) {
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

function decodeCp1252Char(byte: number): string {
  if (byte >= 0x80 && byte <= 0x9F) {
    const mapped = CP1252_MAP[byte];
    return mapped ? String.fromCharCode(mapped) : String.fromCharCode(byte);
  }
  return String.fromCharCode(byte);
}

// ═══════════════════════════════════════════════════════════════════════════
// Очистка текста
// ═══════════════════════════════════════════════════════════════════════════

function cleanDocText(text: string): string {
  let result = '';
  let inField = false;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    if (code === 0x13) { inField = true; continue; }
    if (code === 0x15) { inField = false; continue; }
    if (code === 0x14) continue;
    if (inField) continue;

    if (code === 0x0D) { result += '\n'; continue; }
    if (code === 0x0B) { result += '\n'; continue; }
    if (code === 0x0C) { result += '\n\n'; continue; }
    if (code === 0x07) { result += '\t'; continue; }
    if (code === 0x01 || code === 0x08) continue;

    if (code < 0x20 && code !== 0x09 && code !== 0x0A) continue;

    result += text[i];
  }

  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/\t+/g, ' ');
  result = result.trim();

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Fallback: эвристическое извлечение
// ═══════════════════════════════════════════════════════════════════════════

function extractDocTextFallback(bytes: Uint8Array): string {
  const utf16Text = extractUTF16Chunks(bytes);
  if (utf16Text) return utf16Text;
  return extractAsciiChunks(bytes);
}

function extractUTF16Chunks(bytes: Uint8Array): string {
  const chunks: string[] = [];
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

  const text = chunks.join('\n\n');
  return cleanFallbackText(text);
}

function extractAsciiChunks(bytes: Uint8Array): string {
  const chunks: string[] = [];
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

function isPrintableChar(code: number): boolean {
  if (code === 0x0A || code === 0x0D || code === 0x09) return true;
  if (code < 0x20) return false;
  if (code === 0xFFFE || code === 0xFFFF) return false;
  return true;
}

function cleanFallbackText(text: string): string {
  // eslint-disable-next-line no-control-regex
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}
