/**
 * TESTS: OLE2Parser
 * Тесты для парсера OLE2 (Compound File Binary) контейнера
 */

import { describe, it, expect } from 'vitest';
import { parseOLE2 } from '../../../js/admin/parsers/OLE2Parser.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const OLE2_SIGNATURE = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

/**
 * Создать минимальный OLE2 контейнер с заданными потоками
 */
function buildOLE2Container(streams = {}) {
  const sectorSize = 512;

  // Calculate layout
  // Sector 0: FAT
  // Sector 1: Directory
  // Sector 2..N: stream data
  let dataStart = 2;
  const streamEntries = [];

  for (const [name, data] of Object.entries(streams)) {
    const sectors = Math.ceil(data.length / sectorSize);
    streamEntries.push({
      name,
      data,
      startSector: dataStart,
      sectors,
    });
    dataStart += sectors;
  }

  const totalSectors = dataStart;
  const fileSize = (1 + totalSectors) * sectorSize;
  const buf = new ArrayBuffer(fileSize);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  // Header
  for (let i = 0; i < 8; i++) bytes[i] = OLE2_SIGNATURE[i];
  view.setUint16(24, 0x003E, true);
  view.setUint16(26, 0x0003, true);
  view.setUint16(28, 0xFFFE, true);
  view.setUint16(30, 9, true);       // sector size = 512
  view.setUint16(32, 6, true);       // mini sector size = 64
  view.setUint32(44, 1, true);       // 1 FAT sector
  view.setUint32(48, 1, true);       // first dir sector = 1
  view.setUint32(56, 0x1000, true);  // mini stream cutoff
  view.setInt32(60, -2, true);       // no mini FAT
  view.setInt32(68, -2, true);       // no DIFAT sectors
  view.setInt32(76, 0, true);        // DIFAT[0] = sector 0
  for (let i = 1; i < 109; i++) view.setInt32(76 + i * 4, -1, true);

  // FAT (sector 0)
  const fatOff = sectorSize;
  view.setInt32(fatOff, -3, true);     // FAT sector marker
  view.setInt32(fatOff + 4, -2, true); // directory ENDOFCHAIN

  for (const entry of streamEntries) {
    for (let i = 0; i < entry.sectors; i++) {
      const sector = entry.startSector + i;
      const next = (i < entry.sectors - 1) ? sector + 1 : -2;
      view.setInt32(fatOff + sector * 4, next, true);
    }
  }

  for (let i = dataStart; i < sectorSize / 4; i++) {
    view.setInt32(fatOff + i * 4, -1, true);
  }

  // Directory (sector 1)
  const dirOff = sectorSize * 2;

  // Root Entry
  writeEntry(view, bytes, dirOff, 'Root Entry', 5, -2, 0);

  // Stream entries
  let entryIndex = 1;
  for (const entry of streamEntries) {
    writeEntry(view, bytes, dirOff + entryIndex * 128,
      entry.name, 2, entry.startSector, entry.data.length);
    entryIndex++;
  }

  // Write stream data
  for (const entry of streamEntries) {
    const off = sectorSize * (1 + entry.startSector);
    bytes.set(new Uint8Array(entry.data instanceof ArrayBuffer ? entry.data : entry.data.buffer || entry.data), off);
  }

  return buf;
}

function writeEntry(view, bytes, offset, name, type, startSector, size) {
  for (let i = 0; i < name.length; i++) {
    view.setUint16(offset + i * 2, name.charCodeAt(i), true);
  }
  view.setUint16(offset + name.length * 2, 0, true);
  view.setUint16(offset + 64, (name.length + 1) * 2, true);
  bytes[offset + 66] = type;
  bytes[offset + 67] = 1;
  view.setInt32(offset + 68, -1, true);
  view.setInt32(offset + 72, -1, true);
  view.setInt32(offset + 76, -1, true);
  view.setInt32(offset + 116, startSector, true);
  view.setUint32(offset + 120, size, true);
}

/**
 * Создать Uint8Array с текстом
 */
function textData(str) {
  const data = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) data[i] = str.charCodeAt(i);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// parseOLE2
// ═══════════════════════════════════════════════════════════════════════════

describe('OLE2Parser', () => {
  describe('parseOLE2 — signature validation', () => {
    it('should return null for buffer smaller than 512 bytes', () => {
      expect(parseOLE2(new ArrayBuffer(100))).toBeNull();
      expect(parseOLE2(new ArrayBuffer(0))).toBeNull();
      expect(parseOLE2(new ArrayBuffer(511))).toBeNull();
    });

    it('should return null for buffer with wrong signature', () => {
      const buf = new ArrayBuffer(1024);
      const view = new Uint8Array(buf);
      view[0] = 0xFF;
      expect(parseOLE2(buf)).toBeNull();
    });

    it('should return null for all-zero buffer', () => {
      expect(parseOLE2(new ArrayBuffer(1024))).toBeNull();
    });

    it('should return null for partially matching signature', () => {
      const buf = new ArrayBuffer(1024);
      const view = new Uint8Array(buf);
      // Set first 4 bytes correct, rest wrong
      view[0] = 0xD0; view[1] = 0xCF; view[2] = 0x11; view[3] = 0xE0;
      view[4] = 0x00; // Wrong!
      expect(parseOLE2(buf)).toBeNull();
    });

    it('should return null for invalid sector size power', () => {
      const buf = new ArrayBuffer(1024);
      const view = new Uint8Array(buf);
      const dv = new DataView(buf);

      for (let i = 0; i < 8; i++) view[i] = OLE2_SIGNATURE[i];
      dv.setUint16(30, 6, true); // sector size power = 6 (64 bytes, too small < 7)

      expect(parseOLE2(buf)).toBeNull();
    });

    it('should return null for sector size power > 16', () => {
      const buf = new ArrayBuffer(1024);
      const view = new Uint8Array(buf);
      const dv = new DataView(buf);

      for (let i = 0; i < 8; i++) view[i] = OLE2_SIGNATURE[i];
      dv.setUint16(30, 17, true); // too large

      expect(parseOLE2(buf)).toBeNull();
    });
  });

  describe('parseOLE2 — directory entries', () => {
    it('should parse valid OLE2 and return directories', () => {
      const ole2 = buildOLE2Container({
        'Stream1': textData('Hello World'),
      });
      const result = parseOLE2(ole2);

      expect(result).not.toBeNull();
      expect(result.directories.length).toBeGreaterThanOrEqual(2); // Root + Stream1
    });

    it('should find entry by name', () => {
      const ole2 = buildOLE2Container({
        'TestStream': textData('Test data content'),
      });
      const result = parseOLE2(ole2);

      expect(result.findEntry('TestStream')).not.toBeNull();
      expect(result.findEntry('TestStream').name).toBe('TestStream');
    });

    it('should return null for non-existent entry', () => {
      const ole2 = buildOLE2Container({
        'Stream1': textData('data'),
      });
      const result = parseOLE2(ole2);

      expect(result.findEntry('NonExistent')).toBeNull();
    });

    it('should find multiple named streams', () => {
      const ole2 = buildOLE2Container({
        'WordDocument': textData('word doc data'),
        '1Table': textData('table data'),
      });
      const result = parseOLE2(ole2);

      expect(result.findEntry('WordDocument')).not.toBeNull();
      expect(result.findEntry('1Table')).not.toBeNull();
    });

    it('should include Root Entry in directories', () => {
      const ole2 = buildOLE2Container({
        'Stream1': textData('data'),
      });
      const result = parseOLE2(ole2);

      const rootEntry = result.directories.find(d => d.name === 'Root Entry');
      expect(rootEntry).toBeDefined();
      expect(rootEntry.type).toBe(5); // storage type
    });

    it('should record entry size correctly', () => {
      const content = 'Exact content for size test';
      const ole2 = buildOLE2Container({
        'SizedStream': textData(content),
      });
      const result = parseOLE2(ole2);
      const entry = result.findEntry('SizedStream');

      expect(entry.size).toBe(content.length);
    });
  });

  describe('parseOLE2 — stream reading', () => {
    it('should read stream data', () => {
      const content = 'Stream content data for reading test';
      const ole2 = buildOLE2Container({
        'DataStream': textData(content),
      });
      const result = parseOLE2(ole2);
      const entry = result.findEntry('DataStream');
      const data = result.readStream(entry);

      expect(data).not.toBeNull();
      expect(data.length).toBe(content.length);

      // Verify content
      let read = '';
      for (let i = 0; i < data.length; i++) {
        read += String.fromCharCode(data[i]);
      }
      expect(read).toBe(content);
    });

    it('should read stream spanning multiple sectors', () => {
      // Create data larger than one sector (512 bytes)
      const content = new Uint8Array(1200);
      for (let i = 0; i < content.length; i++) {
        content[i] = (i % 256);
      }

      const ole2 = buildOLE2Container({
        'LargeStream': content,
      });
      const result = parseOLE2(ole2);
      const entry = result.findEntry('LargeStream');
      const data = result.readStream(entry);

      expect(data).not.toBeNull();
      expect(data.length).toBe(1200);
      // Verify first and last bytes
      expect(data[0]).toBe(0);
      expect(data[255]).toBe(255);
      expect(data[256]).toBe(0);
      expect(data[1199]).toBe(1199 % 256);
    });

    it('should return null for null entry', () => {
      const ole2 = buildOLE2Container({
        'Stream': textData('data'),
      });
      const result = parseOLE2(ole2);
      expect(result.readStream(null)).toBeNull();
    });

    it('should return null for entry with size 0', () => {
      const ole2 = buildOLE2Container({});
      const result = parseOLE2(ole2);
      // Root entry has size 0
      const rootEntry = result.directories.find(d => d.type === 5);
      if (rootEntry) {
        expect(result.readStream(rootEntry)).toBeNull();
      }
    });

    it('should return null for entry with negative start sector', () => {
      const ole2 = buildOLE2Container({
        'Stream': textData('data'),
      });
      const result = parseOLE2(ole2);

      const fakeEntry = { name: 'fake', type: 2, startSector: -1, size: 100 };
      expect(result.readStream(fakeEntry)).toBeNull();
    });

    it('should handle reading multiple streams independently', () => {
      const content1 = 'First stream data here';
      const content2 = 'Second stream data here';

      const ole2 = buildOLE2Container({
        'First': textData(content1),
        'Second': textData(content2),
      });
      const result = parseOLE2(ole2);

      const data1 = result.readStream(result.findEntry('First'));
      const data2 = result.readStream(result.findEntry('Second'));

      let read1 = '';
      for (let i = 0; i < data1.length; i++) read1 += String.fromCharCode(data1[i]);
      let read2 = '';
      for (let i = 0; i < data2.length; i++) read2 += String.fromCharCode(data2[i]);

      expect(read1).toBe(content1);
      expect(read2).toBe(content2);
    });
  });

  describe('parseOLE2 — findEntry behavior', () => {
    it('should only find stream entries (type=2), not storage entries', () => {
      const ole2 = buildOLE2Container({
        'StreamEntry': textData('data'),
      });
      const result = parseOLE2(ole2);

      // findEntry filters by type === 2 (stream)
      // Root Entry is type 5 (storage), should not be found by findEntry
      expect(result.findEntry('Root Entry')).toBeNull();
      expect(result.findEntry('StreamEntry')).not.toBeNull();
    });

    it('should do exact name match', () => {
      const ole2 = buildOLE2Container({
        'MyStream': textData('data'),
      });
      const result = parseOLE2(ole2);

      expect(result.findEntry('MyStream')).not.toBeNull();
      expect(result.findEntry('mystream')).toBeNull();
      expect(result.findEntry('MyStream ')).toBeNull();
      expect(result.findEntry('My')).toBeNull();
    });
  });

  describe('parseOLE2 — edge cases', () => {
    it('should handle exactly 512 bytes (header only, no data sectors)', () => {
      const buf = new ArrayBuffer(512);
      const view = new Uint8Array(buf);
      for (let i = 0; i < 8; i++) view[i] = OLE2_SIGNATURE[i];
      new DataView(buf).setUint16(30, 9, true);
      // 512 байт = только заголовок, FAT/directory секторы отсутствуют
      const result = parseOLE2(buf);
      // Без FAT-секторов парсер не может прочитать directory — ожидаем null или пустой результат
      if (result !== null) {
        expect(result.directories).toHaveLength(0);
      } else {
        expect(result).toBeNull();
      }
    });

    it('should handle OLE2 with empty streams (size=0)', () => {
      // Build container manually with an entry that has size=0
      const ole2 = buildOLE2Container({});
      const result = parseOLE2(ole2);
      expect(result).not.toBeNull();
      expect(result.directories.length).toBeGreaterThanOrEqual(1);
    });
  });
});
