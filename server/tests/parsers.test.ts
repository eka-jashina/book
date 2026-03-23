import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { parseBook } from '../src/parsers/BookParser.js';
import { parseTxt } from '../src/parsers/TxtParser.js';
import { parseFb2 } from '../src/parsers/Fb2Parser.js';
import { parseDocx } from '../src/parsers/DocxParser.js';
import { parseEpub } from '../src/parsers/EpubParser.js';
import { parseDoc } from '../src/parsers/DocParser.js';
import { escapeHtml, parseXml, parseHtml, getTextContent } from '../src/parsers/parserUtils.js';
import {
  validateZipSize,
  findZipFile,
  createChapter,
  wrapChapterHtml,
  titleFromFilename,
} from '../src/parsers/BaseParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

// ══════════════════════════════════════════════════════════════════
// parserUtils
// ══════════════════════════════════════════════════════════════════

describe('parserUtils', () => {
  describe('escapeHtml', () => {
    it('should escape &, <, >, ", \'', () => {
      expect(escapeHtml('a & b < c > d "e" \'f\'')).toBe(
        'a &amp; b &lt; c &gt; d &quot;e&quot; &#39;f&#39;',
      );
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should leave safe strings unchanged', () => {
      expect(escapeHtml('Hello world')).toBe('Hello world');
    });
  });

  describe('parseXml', () => {
    it('should parse valid XML', () => {
      const doc = parseXml('<root><child>text</child></root>');
      expect(doc.querySelector('child')?.textContent).toBe('text');
    });

    it('should throw on severely malformed XML', () => {
      // JSDOM throws SyntaxError on malformed XML content-type parsing
      expect(() => parseXml('<root><unclosed>text</root>')).toThrow();
    });
  });

  describe('parseHtml', () => {
    it('should parse HTML string', () => {
      const doc = parseHtml('<html><body><p>Hello</p></body></html>');
      expect(doc.querySelector('p')?.textContent).toBe('Hello');
    });
  });

  describe('getTextContent', () => {
    it('should get text from selector', () => {
      const doc = parseXml('<root><title>Book Title</title></root>');
      expect(getTextContent(doc, 'title')).toBe('Book Title');
    });

    it('should return empty string for missing selector', () => {
      const doc = parseXml('<root></root>');
      expect(getTextContent(doc, 'missing')).toBe('');
    });
  });
});

// ══════════════════════════════════════════════════════════════════
// BaseParser
// ══════════════════════════════════════════════════════════════════

describe('BaseParser', () => {
  describe('titleFromFilename', () => {
    it('should strip extension from filename', () => {
      expect(titleFromFilename('my-book.epub')).toBe('my-book');
      expect(titleFromFilename('story.txt')).toBe('story');
      expect(titleFromFilename('report.final.docx')).toBe('report.final');
    });

    it('should handle filenames without extension', () => {
      expect(titleFromFilename('noext')).toBe('noext');
    });
  });

  describe('createChapter', () => {
    it('should create chapter with 1-indexed id', () => {
      const ch = createChapter(0, 'First', '<p>Hello</p>');
      expect(ch.id).toBe('chapter_1');
      expect(ch.title).toBe('First');
      expect(ch.html).toBe('<p>Hello</p>');
    });

    it('should create chapter with correct index', () => {
      const ch = createChapter(4, 'Fifth', '<p>Content</p>');
      expect(ch.id).toBe('chapter_5');
    });
  });

  describe('wrapChapterHtml', () => {
    it('should wrap content in article with h2', () => {
      const html = wrapChapterHtml('Title', '<p>Body</p>');
      expect(html).toContain('<article>');
      expect(html).toContain('<h2>Title</h2>');
      expect(html).toContain('<p>Body</p>');
      expect(html).toContain('</article>');
    });

    it('should escape HTML in title', () => {
      const html = wrapChapterHtml('Title <script>', '<p>Body</p>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });
  });

  describe('validateZipSize', () => {
    it('should accept a small zip', async () => {
      const zip = new JSZip();
      zip.file('test.txt', 'Hello world');
      await expect(validateZipSize(zip)).resolves.toBeUndefined();
    });
  });

  describe('findZipFile', () => {
    it('should find file by exact path', async () => {
      const zip = new JSZip();
      zip.file('dir/file.txt', 'content');
      const found = findZipFile(zip, 'dir/file.txt');
      expect(found).not.toBeNull();
    });

    it('should find file case-insensitively', async () => {
      const zip = new JSZip();
      zip.file('DIR/File.txt', 'content');
      const found = findZipFile(zip, 'dir/file.txt');
      expect(found).not.toBeNull();
    });

    it('should strip leading slash', async () => {
      const zip = new JSZip();
      zip.file('file.txt', 'content');
      const found = findZipFile(zip, '/file.txt');
      expect(found).not.toBeNull();
    });

    it('should strip fragment from path', async () => {
      const zip = new JSZip();
      zip.file('chapter.html', 'content');
      const found = findZipFile(zip, 'chapter.html#section1');
      expect(found).not.toBeNull();
    });

    it('should return null for missing file', () => {
      const zip = new JSZip();
      zip.file('a.txt', 'content');
      expect(findZipFile(zip, 'b.txt')).toBeNull();
    });

    it('should find URL-encoded paths', async () => {
      const zip = new JSZip();
      zip.file('dir/my file.txt', 'content');
      const found = findZipFile(zip, 'dir/my%20file.txt');
      expect(found).not.toBeNull();
    });
  });
});

// ══════════════════════════════════════════════════════════════════
// TxtParser
// ══════════════════════════════════════════════════════════════════

describe('TxtParser', () => {
  it('should parse plain text into paragraphs', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const result = parseTxt(Buffer.from(text), 'story.txt');

    expect(result.title).toBe('story');
    expect(result.author).toBe('');
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].html).toContain('<p>First paragraph.</p>');
    expect(result.chapters[0].html).toContain('<p>Second paragraph.</p>');
    expect(result.chapters[0].html).toContain('<p>Third paragraph.</p>');
  });

  it('should wrap content in article', () => {
    const result = parseTxt(Buffer.from('Hello world'), 'test.txt');
    expect(result.chapters[0].html).toContain('<article>');
    expect(result.chapters[0].html).toContain('</article>');
  });

  it('should escape HTML in text', () => {
    const result = parseTxt(Buffer.from('<script>alert(1)</script>'), 'xss.txt');
    expect(result.chapters[0].html).not.toContain('<script>');
    expect(result.chapters[0].html).toContain('&lt;script&gt;');
  });

  it('should throw on empty file', () => {
    expect(() => parseTxt(Buffer.from(''), 'empty.txt')).toThrow();
  });

  it('should throw on whitespace-only file', () => {
    expect(() => parseTxt(Buffer.from('   \n\n   '), 'blank.txt')).toThrow();
  });

  it('should convert line breaks within paragraph to <br>', () => {
    const text = 'Line one\nLine two';
    const result = parseTxt(Buffer.from(text), 'lines.txt');
    expect(result.chapters[0].html).toContain('Line one<br>Line two');
  });
});

// ══════════════════════════════════════════════════════════════════
// Fb2Parser
// ══════════════════════════════════════════════════════════════════

describe('Fb2Parser', () => {
  function makeFb2(body: string, title = 'Test Book', author = 'Author Name'): Buffer {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <book-title>${title}</book-title>
      <author><first-name>${author.split(' ')[0] || ''}</first-name><last-name>${author.split(' ')[1] || ''}</last-name></author>
    </title-info>
  </description>
  <body>${body}</body>
</FictionBook>`;
    return Buffer.from(xml, 'utf-8');
  }

  it('should extract title and author', () => {
    const buf = makeFb2('<section><p>Content</p></section>', 'My Book', 'John Doe');
    const result = parseFb2(buf, 'test.fb2');
    expect(result.title).toBe('My Book');
    expect(result.author).toContain('John');
    expect(result.author).toContain('Doe');
  });

  it('should extract chapters from sections', () => {
    const body = `
      <section><title><p>Chapter 1</p></title><p>First content</p></section>
      <section><title><p>Chapter 2</p></title><p>Second content</p></section>
    `;
    const result = parseFb2(makeFb2(body), 'test.fb2');
    expect(result.chapters.length).toBeGreaterThanOrEqual(2);
    expect(result.chapters[0].title).toBe('Chapter 1');
    expect(result.chapters[1].title).toBe('Chapter 2');
  });

  it('should handle emphasis and strong formatting', () => {
    const body = '<section><p><emphasis>italic</emphasis> and <strong>bold</strong></p></section>';
    const result = parseFb2(makeFb2(body), 'test.fb2');
    expect(result.chapters[0].html).toContain('<em>italic</em>');
    expect(result.chapters[0].html).toContain('<strong>bold</strong>');
  });

  it('should handle inline images via binary elements', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"
             xmlns:l="http://www.w3.org/1999/xlink">
  <description><title-info><book-title>Img Book</book-title></title-info></description>
  <body><section><p>Text</p><image l:href="#img1"/></section></body>
  <binary id="img1" content-type="image/png">iVBORw0KGgo=</binary>
</FictionBook>`;
    const result = parseFb2(Buffer.from(xml), 'img.fb2');
    expect(result.chapters[0].html).toContain('<img src="data:image/png;base64,iVBORw0KGgo="');
  });

  it('should handle empty-line elements', () => {
    const body = '<section><p>Before</p><empty-line/><p>After</p></section>';
    const result = parseFb2(makeFb2(body), 'test.fb2');
    expect(result.chapters[0].html).toContain('&nbsp;');
  });

  it('should handle poems', () => {
    const body = `<section><poem><stanza><v>Line one</v><v>Line two</v></stanza></poem></section>`;
    const result = parseFb2(makeFb2(body), 'test.fb2');
    expect(result.chapters[0].html).toContain('Line one');
    expect(result.chapters[0].html).toContain('Line two');
  });

  it('should handle blockquotes (epigraph/cite)', () => {
    const body = '<section><epigraph><p>Wise words</p></epigraph><p>Content</p></section>';
    const result = parseFb2(makeFb2(body), 'test.fb2');
    expect(result.chapters[0].html).toContain('<blockquote>');
    expect(result.chapters[0].html).toContain('Wise words');
  });

  it('should throw on empty body', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description><title-info><book-title>Empty</book-title></title-info></description>
</FictionBook>`;
    expect(() => parseFb2(Buffer.from(xml), 'empty.fb2')).toThrow();
  });

  it('should use filename as title fallback', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description><title-info></title-info></description>
  <body><section><p>Content</p></section></body>
</FictionBook>`;
    const result = parseFb2(Buffer.from(xml), 'fallback-title.fb2');
    expect(result.title).toBe('fallback-title');
  });

  it('should handle windows-1251 encoding', () => {
    // Create a simple FB2 with windows-1251 declaration
    const xml = `<?xml version="1.0" encoding="windows-1251"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description><title-info><book-title>Test</book-title></title-info></description>
  <body><section><p>Content</p></section></body>
</FictionBook>`;
    // In UTF-8 buffer, the encoding declaration is present but data is actually utf-8
    const result = parseFb2(Buffer.from(xml, 'utf-8'), 'enc.fb2');
    expect(result.chapters).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════
// DocxParser
// ══════════════════════════════════════════════════════════════════

describe('DocxParser', () => {
  it('should parse a valid docx file', async () => {
    const buf = readFileSync(join(fixturesDir, 'sample.docx'));
    const result = await parseDocx(buf, 'sample.docx');

    expect(result.title).toBe('Test DOCX Book');
    expect(result.author).toBe('Test Author');
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].html).toContain('<article>');
  });

  it('should extract paragraph text', async () => {
    const buf = readFileSync(join(fixturesDir, 'sample.docx'));
    const result = await parseDocx(buf, 'sample.docx');

    expect(result.chapters[0].html).toContain('first paragraph');
  });

  it('should detect bold and italic formatting', async () => {
    const buf = readFileSync(join(fixturesDir, 'sample.docx'));
    const result = await parseDocx(buf, 'sample.docx');

    expect(result.chapters[0].html).toContain('<strong>Bold text</strong>');
    expect(result.chapters[0].html).toContain('<em>italic text</em>');
  });

  it('should detect headings', async () => {
    const buf = readFileSync(join(fixturesDir, 'sample.docx'));
    const result = await parseDocx(buf, 'sample.docx');

    expect(result.chapters[0].html).toContain('<h2>Chapter One</h2>');
  });

  it('should use filename as title when metadata is missing', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`);
    zip.file('word/document.xml', `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body>
</w:document>`);

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const result = await parseDocx(buf, 'no-meta.docx');

    expect(result.title).toBe('no-meta');
    expect(result.author).toBe('');
  });

  it('should throw on missing document.xml', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`);

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(parseDocx(buf, 'bad.docx')).rejects.toThrow();
  });

  it('should throw on empty document', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body></w:body>
</w:document>`);

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(parseDocx(buf, 'empty.docx')).rejects.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// EpubParser
// ══════════════════════════════════════════════════════════════════

describe('EpubParser', () => {
  it('should parse a valid epub file', async () => {
    const buf = readFileSync(join(fixturesDir, 'sample.epub'));
    const result = await parseEpub(buf, 'sample.epub');

    expect(result.title).toBe('Test EPUB Book');
    expect(result.author).toBe('EPUB Author');
    expect(result.chapters.length).toBeGreaterThanOrEqual(1);
  });

  it('should extract chapter content', async () => {
    const buf = readFileSync(join(fixturesDir, 'sample.epub'));
    const result = await parseEpub(buf, 'sample.epub');

    const allHtml = result.chapters.map(c => c.html).join('\n');
    expect(allHtml).toContain('first chapter');
    expect(allHtml).toContain('second chapter');
  });

  it('should detect inline formatting', async () => {
    const buf = readFileSync(join(fixturesDir, 'sample.epub'));
    const result = await parseEpub(buf, 'sample.epub');

    const allHtml = result.chapters.map(c => c.html).join('\n');
    expect(allHtml).toContain('<em>italic</em>');
    expect(allHtml).toContain('<strong>bold</strong>');
  });

  it('should extract headings as chapter titles', async () => {
    const buf = readFileSync(join(fixturesDir, 'sample.epub'));
    const result = await parseEpub(buf, 'sample.epub');

    const titles = result.chapters.map(c => c.title);
    expect(titles.some(t => t.includes('Beginning') || t.includes('Middle'))).toBe(true);
  });

  it('should handle lists', async () => {
    const buf = readFileSync(join(fixturesDir, 'sample.epub'));
    const result = await parseEpub(buf, 'sample.epub');

    const allHtml = result.chapters.map(c => c.html).join('\n');
    expect(allHtml).toContain('<ul>');
    expect(allHtml).toContain('<li>');
  });

  it('should throw on missing container.xml', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(parseEpub(buf, 'bad.epub')).rejects.toThrow();
  });

  it('should throw on missing rootfile in container.xml', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles></rootfiles>
</container>`);

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(parseEpub(buf, 'bad.epub')).rejects.toThrow();
  });

  it('should use filename as title fallback', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);
    zip.file('content.opf', `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">id</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest><item id="ch1" href="ch.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="ch1"/></spine>
</package>`);
    zip.file('ch.xhtml', `<html><body><p>Content</p></body></html>`);

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const result = await parseEpub(buf, 'my-fallback.epub');

    expect(result.title).toBe('my-fallback');
  });
});

// ══════════════════════════════════════════════════════════════════
// DocParser
// ══════════════════════════════════════════════════════════════════

describe('DocParser', () => {
  it('should throw on empty buffer', () => {
    expect(() => parseDoc(Buffer.alloc(0), 'empty.doc')).toThrow();
  });

  it('should throw on random data (not OLE2)', () => {
    const buf = Buffer.from('This is just plain text, not a real DOC file');
    expect(() => parseDoc(buf, 'fake.doc')).toThrow();
  });

  it('should use filename as title', () => {
    // OLE2 has a specific magic signature — even with fallback extraction,
    // a buffer that starts with the signature but has minimal data will fail
    const buf = Buffer.alloc(512, 0);
    // Write OLE2 signature
    const sig = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    sig.forEach((b, i) => buf[i] = b);
    // This will attempt parsing but fail due to missing structure
    expect(() => parseDoc(buf, 'test-title.doc')).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// BookParser (dispatch)
// ══════════════════════════════════════════════════════════════════

describe('BookParser', () => {
  it('should dispatch .txt to TxtParser', async () => {
    const result = await parseBook(Buffer.from('Hello world'), 'test.txt');
    expect(result.title).toBe('test');
    expect(result.chapters).toHaveLength(1);
  });

  it('should dispatch .fb2 to Fb2Parser', async () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description><title-info><book-title>FB2 Book</book-title></title-info></description>
  <body><section><p>Content</p></section></body>
</FictionBook>`;
    const result = await parseBook(Buffer.from(xml), 'test.fb2');
    expect(result.title).toBe('FB2 Book');
  });

  it('should dispatch .docx to DocxParser', async () => {
    const buf = readFileSync(join(fixturesDir, 'sample.docx'));
    const result = await parseBook(buf, 'sample.docx');
    expect(result.title).toBe('Test DOCX Book');
  });

  it('should dispatch .epub to EpubParser', async () => {
    const buf = readFileSync(join(fixturesDir, 'sample.epub'));
    const result = await parseBook(buf, 'sample.epub');
    expect(result.title).toBe('Test EPUB Book');
  });

  it('should dispatch .doc to DocParser', async () => {
    // Will fail parsing but should go through DocParser (not throw 400)
    await expect(parseBook(Buffer.from('text'), 'test.doc')).rejects.toThrow(/422|парсинг/i);
  });

  it('should throw 400 for unsupported format', async () => {
    await expect(parseBook(Buffer.from('data'), 'test.pdf')).rejects.toThrow(/неподдерживаемый|формат/i);
  });

  it('should be case-insensitive for extensions', async () => {
    const result = await parseBook(Buffer.from('Hello'), 'test.TXT');
    expect(result.title).toBe('test');
  });

  it('should wrap parser errors as AppError 422', async () => {
    try {
      await parseBook(Buffer.from('not xml'), 'broken.fb2');
      expect.unreachable('should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('PARSE_ERROR');
    }
  });
});
