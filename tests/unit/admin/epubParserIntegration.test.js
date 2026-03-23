/**
 * TESTS: EpubParser — parseEpub integration
 * Тесты для основной функции parseEpub (парсинг полного EPUB-архива).
 * Отдельно от unit-тестов хелперов в EpubParser.test.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Мокаем JSZip до импорта EpubParser
vi.mock('jszip', () => {
  return {
    default: {
      loadAsync: vi.fn(),
    },
  };
});

import JSZip from 'jszip';
import { parseEpub } from '../../../js/admin/parsers/EpubParser.js';

/**
 * Создать мок ZIP-архива с файлами
 */
function createMockZip(files = {}) {
  const zipFiles = {};

  for (const [path, content] of Object.entries(files)) {
    zipFiles[path] = {
      dir: false,
      name: path,
      _data: { uncompressedSize: content.length },
      async: vi.fn((type) => {
        if (type === 'base64') {
          return btoa(content);
        }
        return content;
      }),
    };
  }

  return {
    files: zipFiles,
    file: vi.fn((path) => zipFiles[path] || null),
  };
}

/**
 * Создать стандартный container.xml
 */
function makeContainerXml(opfPath = 'OEBPS/content.opf') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

/**
 * Создать content.opf
 */
function makeOpf({
  title = 'Test Book',
  author = 'Test Author',
  manifestItems = [],
  spineItems = [],
} = {}) {
  const manifestHtml = manifestItems
    .map(({ id, href, mediaType }) =>
      `<item id="${id}" href="${href}" media-type="${mediaType}"/>`)
    .join('\n');

  const spineHtml = spineItems
    .map((idref) => `<itemref idref="${idref}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
  </metadata>
  <manifest>
    ${manifestHtml}
  </manifest>
  <spine>
    ${spineHtml}
  </spine>
</package>`;
}

/**
 * Создать HTML-контент главы
 */
function makeChapterHtml(title, body) {
  return `<!DOCTYPE html>
<html><head><title>${title}</title></head>
<body>
<h1>${title}</h1>
<p>${body}</p>
</body></html>`;
}

function makeFile(name = 'book.epub') {
  return new File(['epub content'], name, { type: 'application/epub+zip' });
}

describe('EpubParser — parseEpub', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse a simple EPUB with one chapter', async () => {
    const chapterContent = makeChapterHtml('Chapter 1', 'Hello World');

    const zip = createMockZip({
      'META-INF/container.xml': makeContainerXml(),
      'OEBPS/content.opf': makeOpf({
        title: 'My Book',
        author: 'Jane Doe',
        manifestItems: [
          { id: 'ch1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spineItems: ['ch1'],
      }),
      'OEBPS/chapter1.xhtml': chapterContent,
    });

    JSZip.loadAsync.mockResolvedValue(zip);

    const result = await parseEpub(makeFile());

    expect(result.title).toBe('My Book');
    expect(result.author).toBe('Jane Doe');
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].html).toContain('Hello World');
    expect(result.chapters[0].id).toBe('chapter_1');
  });

  it('should parse EPUB with multiple chapters', async () => {
    const ch1 = makeChapterHtml('Chapter 1', 'First chapter');
    const ch2 = makeChapterHtml('Chapter 2', 'Second chapter');

    const zip = createMockZip({
      'META-INF/container.xml': makeContainerXml(),
      'OEBPS/content.opf': makeOpf({
        manifestItems: [
          { id: 'ch1', href: 'ch1.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'ch2', href: 'ch2.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spineItems: ['ch1', 'ch2'],
      }),
      'OEBPS/ch1.xhtml': ch1,
      'OEBPS/ch2.xhtml': ch2,
    });

    JSZip.loadAsync.mockResolvedValue(zip);

    const result = await parseEpub(makeFile());

    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].html).toContain('First chapter');
    expect(result.chapters[1].html).toContain('Second chapter');
  });

  it('should throw when container.xml has no rootfile', async () => {
    const zip = createMockZip({
      'META-INF/container.xml': `<?xml version="1.0"?><container><rootfiles></rootfiles></container>`,
    });

    JSZip.loadAsync.mockResolvedValue(zip);

    await expect(parseEpub(makeFile())).rejects.toThrow('rootfile');
  });

  it('should use filename as title fallback', async () => {
    const ch = makeChapterHtml('Ch', 'content');

    const zip = createMockZip({
      'META-INF/container.xml': makeContainerXml('content.opf'),
      'content.opf': makeOpf({
        title: '',
        manifestItems: [
          { id: 'ch1', href: 'ch.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spineItems: ['ch1'],
      }),
      'ch.xhtml': ch,
    });

    JSZip.loadAsync.mockResolvedValue(zip);

    const result = await parseEpub(makeFile('Моя_книга.epub'));

    expect(result.title).toBe('Моя_книга');
  });

  it('should skip non-HTML spine items', async () => {
    const ch = makeChapterHtml('Chapter', 'text');

    const zip = createMockZip({
      'META-INF/container.xml': makeContainerXml('content.opf'),
      'content.opf': makeOpf({
        manifestItems: [
          { id: 'css', href: 'style.css', mediaType: 'text/css' },
          { id: 'ch1', href: 'ch.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spineItems: ['css', 'ch1'],
      }),
      'ch.xhtml': ch,
    });

    JSZip.loadAsync.mockResolvedValue(zip);

    const result = await parseEpub(makeFile());

    expect(result.chapters).toHaveLength(1);
  });

  it('should handle images from manifest', async () => {
    const ch = `<!DOCTYPE html><html><body>
      <h1>With Image</h1>
      <p><img src="img.jpg"/></p>
    </body></html>`;

    const zip = createMockZip({
      'META-INF/container.xml': makeContainerXml('content.opf'),
      'content.opf': makeOpf({
        manifestItems: [
          { id: 'ch1', href: 'ch.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'img', href: 'img.jpg', mediaType: 'image/jpeg' },
        ],
        spineItems: ['ch1'],
      }),
      'ch.xhtml': ch,
      'img.jpg': 'FAKE_IMAGE_DATA',
    });

    JSZip.loadAsync.mockResolvedValue(zip);

    const result = await parseEpub(makeFile());

    expect(result.chapters[0].html).toContain('data:image/jpeg;base64,');
  });

  it('should skip duplicate spine paths (same file with different fragments)', async () => {
    const ch = makeChapterHtml('Chapter', 'content');

    const zip = createMockZip({
      'META-INF/container.xml': makeContainerXml('content.opf'),
      'content.opf': makeOpf({
        manifestItems: [
          { id: 'ch1a', href: 'ch.xhtml#part1', mediaType: 'application/xhtml+xml' },
          { id: 'ch1b', href: 'ch.xhtml#part2', mediaType: 'application/xhtml+xml' },
        ],
        spineItems: ['ch1a', 'ch1b'],
      }),
      'ch.xhtml': ch,
    });

    JSZip.loadAsync.mockResolvedValue(zip);

    const result = await parseEpub(makeFile());

    // Should only process the file once
    expect(result.chapters).toHaveLength(1);
  });

  it('should skip unreadable spine files gracefully', async () => {
    const ch = makeChapterHtml('Chapter', 'good content');

    const zip = createMockZip({
      'META-INF/container.xml': makeContainerXml('content.opf'),
      'content.opf': makeOpf({
        manifestItems: [
          { id: 'missing', href: 'missing.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'ch1', href: 'ch.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spineItems: ['missing', 'ch1'],
      }),
      'ch.xhtml': ch,
    });

    JSZip.loadAsync.mockResolvedValue(zip);

    const result = await parseEpub(makeFile());

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].html).toContain('good content');
  });

  it('should throw when no text can be extracted', async () => {
    const zip = createMockZip({
      'META-INF/container.xml': makeContainerXml('content.opf'),
      'content.opf': makeOpf({
        manifestItems: [
          { id: 'ch1', href: 'ch.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spineItems: ['ch1'],
      }),
      'ch.xhtml': '<!DOCTYPE html><html><body></body></html>',
    });

    JSZip.loadAsync.mockResolvedValue(zip);

    await expect(parseEpub(makeFile())).rejects.toThrow('извлечь текст');
  });

  it('should reject ZIP bombs', async () => {
    const files = {};
    files['META-INF/container.xml'] = makeContainerXml();

    const zipFiles = {};
    // Simulate a zip bomb — entry with huge uncompressedSize
    zipFiles['META-INF/container.xml'] = {
      dir: false,
      name: 'META-INF/container.xml',
      _data: { uncompressedSize: 200 * 1024 * 1024 }, // 200MB
      async: vi.fn(() => makeContainerXml()),
    };

    const zip = {
      files: zipFiles,
      file: vi.fn((path) => zipFiles[path] || null),
    };

    JSZip.loadAsync.mockResolvedValue(zip);

    await expect(parseEpub(makeFile())).rejects.toThrow('лимит');
  });

  it('should split chapters by headings within a single spine file', async () => {
    const ch = `<!DOCTYPE html><html><body>
      <h1>Chapter One</h1>
      <p>First content</p>
      <h1>Chapter Two</h1>
      <p>Second content</p>
    </body></html>`;

    const zip = createMockZip({
      'META-INF/container.xml': makeContainerXml('content.opf'),
      'content.opf': makeOpf({
        manifestItems: [
          { id: 'ch1', href: 'ch.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spineItems: ['ch1'],
      }),
      'ch.xhtml': ch,
    });

    JSZip.loadAsync.mockResolvedValue(zip);

    const result = await parseEpub(makeFile());

    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].title).toBe('Chapter One');
    expect(result.chapters[1].title).toBe('Chapter Two');
  });

  it('should handle OPF in subdirectory', async () => {
    const ch = makeChapterHtml('Ch', 'content');

    const zip = createMockZip({
      'META-INF/container.xml': makeContainerXml('OEBPS/content.opf'),
      'OEBPS/content.opf': makeOpf({
        manifestItems: [
          { id: 'ch1', href: 'text/ch.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spineItems: ['ch1'],
      }),
      'OEBPS/text/ch.xhtml': ch,
    });

    JSZip.loadAsync.mockResolvedValue(zip);

    const result = await parseEpub(makeFile());

    expect(result.chapters).toHaveLength(1);
  });
});
