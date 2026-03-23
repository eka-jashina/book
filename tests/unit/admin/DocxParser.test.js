/**
 * TESTS: DocxParser
 * Тесты для парсера DOCX-файлов
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Мокаем JSZip для тестирования parseDocx
vi.mock('jszip', () => {
  return {
    default: {
      loadAsync: vi.fn(),
    },
  };
});

import JSZip from 'jszip';
import { parseDocx } from '../../../js/admin/parsers/DocxParser.js';

/**
 * Создать мок ZIP-архива с файлами
 */
function createMockZip(files = {}) {
  const zipFiles = {};

  for (const [path, content] of Object.entries(files)) {
    zipFiles[path] = {
      dir: false,
      async: vi.fn().mockResolvedValue(content),
      _data: { uncompressedSize: content.length || 100 },
    };
  }

  return {
    files: zipFiles,
    file: vi.fn((path) => zipFiles[path] || null),
  };
}

describe('DocxParser', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseDocx — basic
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseDocx', () => {
    it('should parse basic DOCX with text', async () => {
      const documentXml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r><w:t>Hello World</w:t></w:r>
            </w:p>
          </w:body>
        </w:document>`;

      const mockZip = createMockZip({
        'word/document.xml': documentXml,
      });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'test.docx');
      const result = await parseDocx(file);

      expect(result.title).toBe('test');
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].html).toContain('Hello World');
    });

    it('should extract metadata from docProps/core.xml', async () => {
      const coreXml = `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>My Book</dc:title>
          <dc:creator>John Author</dc:creator>
        </cp:coreProperties>`;

      const documentXml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>Content</w:t></w:r></w:p>
          </w:body>
        </w:document>`;

      const mockZip = createMockZip({
        'docProps/core.xml': coreXml,
        'word/document.xml': documentXml,
      });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'test.docx');
      const result = await parseDocx(file);

      expect(result.title).toBe('My Book');
      expect(result.author).toBe('John Author');
    });

    it('should handle bold and italic text', async () => {
      const documentXml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r>
                <w:rPr><w:b/></w:rPr>
                <w:t>Bold text</w:t>
              </w:r>
              <w:r>
                <w:rPr><w:i/></w:rPr>
                <w:t>Italic text</w:t>
              </w:r>
            </w:p>
          </w:body>
        </w:document>`;

      const mockZip = createMockZip({ 'word/document.xml': documentXml });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'test.docx');
      const result = await parseDocx(file);

      expect(result.chapters[0].html).toContain('<strong>Bold text</strong>');
      expect(result.chapters[0].html).toContain('<em>Italic text</em>');
    });

    it('should convert heading styles to h2', async () => {
      const documentXml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
              <w:r><w:t>Chapter Title</w:t></w:r>
            </w:p>
            <w:p><w:r><w:t>Body text</w:t></w:r></w:p>
          </w:body>
        </w:document>`;

      const mockZip = createMockZip({ 'word/document.xml': documentXml });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'test.docx');
      const result = await parseDocx(file);

      expect(result.chapters[0].html).toContain('<h2>Chapter Title</h2>');
      expect(result.chapters[0].html).toContain('<p>Body text</p>');
    });

    it('should throw if word/document.xml is missing', async () => {
      const mockZip = createMockZip({});
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'test.docx');

      await expect(parseDocx(file)).rejects.toThrow('word/document.xml');
    });

    it('should throw if no text extracted', async () => {
      const documentXml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body></w:body>
        </w:document>`;

      const mockZip = createMockZip({ 'word/document.xml': documentXml });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'test.docx');

      await expect(parseDocx(file)).rejects.toThrow('Не удалось извлечь текст');
    });

    it('should handle tables by extracting text', async () => {
      const documentXml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:tbl>
              <w:tr>
                <w:tc><w:p><w:r><w:t>Cell 1</w:t></w:r></w:p></w:tc>
                <w:tc><w:p><w:r><w:t>Cell 2</w:t></w:r></w:p></w:tc>
              </w:tr>
            </w:tbl>
          </w:body>
        </w:document>`;

      const mockZip = createMockZip({ 'word/document.xml': documentXml });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'test.docx');
      const result = await parseDocx(file);

      expect(result.chapters[0].html).toContain('Cell 1');
      expect(result.chapters[0].html).toContain('Cell 2');
    });

    it('should use filename as title when no core metadata', async () => {
      const documentXml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>Content</w:t></w:r></w:p>
          </w:body>
        </w:document>`;

      const mockZip = createMockZip({ 'word/document.xml': documentXml });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'My Document.docx');
      const result = await parseDocx(file);

      expect(result.title).toBe('My Document');
    });

    it('should handle line breaks (w:br)', async () => {
      const documentXml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r><w:t>Line 1</w:t><w:br/><w:t>Line 2</w:t></w:r>
            </w:p>
          </w:body>
        </w:document>`;

      const mockZip = createMockZip({ 'word/document.xml': documentXml });
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'test.docx');
      const result = await parseDocx(file);

      expect(result.chapters[0].html).toContain('<br>');
    });

    it('should handle images with relationships', async () => {
      const documentXml = `<?xml version="1.0"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                    xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                    xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <w:body>
            <w:p>
              <w:r>
                <w:drawing>
                  <a:blip r:embed="rId1"/>
                </w:drawing>
              </w:r>
            </w:p>
            <w:p><w:r><w:t>Some text</w:t></w:r></w:p>
          </w:body>
        </w:document>`;

      const relsXml = `<?xml version="1.0"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Target="media/image1.png"/>
        </Relationships>`;

      const mockZip = createMockZip({
        'word/document.xml': documentXml,
        'word/_rels/document.xml.rels': relsXml,
        'word/media/image1.png': 'base64data',
      });

      // Для загрузки изображений нужен base64 async
      mockZip.files['word/media/image1.png'].async = vi.fn()
        .mockImplementation((type) => {
          if (type === 'base64') return Promise.resolve('abc123');
          return Promise.resolve('data');
        });

      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'test.docx');
      const result = await parseDocx(file);

      expect(result.chapters[0].html).toContain('Some text');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ZIP bomb protection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ZIP bomb protection', () => {
    it('should reject archives exceeding size limit', async () => {
      const mockZip = {
        files: {
          'word/document.xml': {
            dir: false,
            _data: { uncompressedSize: 200 * 1024 * 1024 }, // 200MB
          },
        },
        file: vi.fn(),
      };
      JSZip.loadAsync.mockResolvedValue(mockZip);

      const file = new File(['data'], 'bomb.docx');

      await expect(parseDocx(file)).rejects.toThrow('лимит');
    });
  });
});
