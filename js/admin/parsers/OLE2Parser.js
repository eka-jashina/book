/**
 * OLE2 COMPOUND FILE BINARY PARSER
 *
 * Парсер OLE2 (CFB) контейнера — бинарного формата Microsoft.
 * Используется в DOC-файлах (Word 97-2003) и других форматах MS Office.
 *
 * Структура OLE2:
 * 1. 512-байтный заголовок с сигнатурой D0CF11E0A1B11AE1
 * 2. DIFAT → FAT (таблица размещения секторов)
 * 3. Directory entries (каталог потоков)
 * 4. Mini FAT + Mini stream (для мелких потоков < 4096 байт)
 *
 * Экспортирует parseOLE2() — возвращает объект с методами findEntry() и readStream().
 */

/** Сигнатура OLE2 Compound File Binary (CFB) */
const OLE2_SIGNATURE = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

/** Маркер конца цепочки секторов */
const ENDOFCHAIN = -2; // 0xFFFFFFFE как int32

/**
 * Парсинг OLE2 (CFB) контейнера.
 * @param {ArrayBuffer} buffer
 * @returns {{ directories: Array, findEntry: (name: string) => object|null, readStream: (entry: object) => Uint8Array|null }|null}
 */
export function parseOLE2(buffer) {
  if (buffer.byteLength < 512) return null;

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Проверка сигнатуры
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

  /** Смещение сектора в файле (сектор 0 начинается после 512-байтного заголовка) */
  const sectorOffset = (sector) => (sector + 1) * sectorSize;

  // ───────────────────────────────────────────────────────────────────────
  // DIFAT → FAT
  // ───────────────────────────────────────────────────────────────────────

  const difat = [];
  // Первые 109 записей DIFAT в заголовке (offset 76)
  for (let i = 0; i < 109; i++) {
    const sector = view.getInt32(76 + i * 4, true);
    if (sector >= 0) difat.push(sector);
  }

  // Дополнительные DIFAT-секторы (для файлов >6.8MB)
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

  // Собрать FAT из DIFAT-секторов
  const fat = [];
  for (const fatSector of difat) {
    const off = sectorOffset(fatSector);
    if (off + sectorSize > buffer.byteLength) break;
    for (let i = 0; i < sectorSize / 4; i++) {
      fat.push(view.getInt32(off + i * 4, true));
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Directory entries
  // ───────────────────────────────────────────────────────────────────────

  const directories = [];
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

  // ───────────────────────────────────────────────────────────────────────
  // Чтение потоков (streams)
  // ───────────────────────────────────────────────────────────────────────

  /** Прочитать данные по цепочке FAT-секторов */
  function readChain(startSector, size, fatTable, sectorSz, getOffset) {
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

  // Root entry — контейнер mini stream
  const rootEntry = directories.find(d => d.type === 5);

  // Mini FAT
  const miniFAT = [];
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

  // Контейнер mini stream (данные root entry)
  let miniStreamData = null;
  function getMiniStream() {
    if (miniStreamData) return miniStreamData;
    if (!rootEntry || rootEntry.startSector < 0) return null;
    miniStreamData = readChain(
      rootEntry.startSector, rootEntry.size, fat, sectorSize, sectorOffset,
    );
    return miniStreamData;
  }

  /** Прочитать stream по directory entry */
  function readStream(entry) {
    if (!entry || entry.size === 0) return null;
    if (entry.startSector < 0) return null;

    // Mini stream: потоки < miniStreamCutoff (обычно 4096) для не-root entries
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
      // Fallback: некоторые файлы хранят мелкие потоки в обычных секторах
    }

    // Regular stream
    return readChain(entry.startSector, entry.size, fat, sectorSize, sectorOffset);
  }

  /** Найти directory entry по имени (stream, type=2) */
  function findEntry(name) {
    return directories.find(d => d.name === name && d.type === 2) || null;
  }

  return { directories, findEntry, readStream };
}
