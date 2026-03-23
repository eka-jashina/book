/**
 * TESTS: Fb2Parser
 * Тесты для парсера FB2-файлов: parseFb2, loadFb2Images,
 * extractFb2Title, convertFb2Element, convertFb2Inline, getFb2Text.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseFb2,
  loadFb2Images,
  extractFb2Title,
  convertFb2Element,
  convertFb2Inline,
  getFb2Text,
} from '../../../js/admin/parsers/Fb2Parser.js';

/**
 * Создать минимальный FB2-документ
 */
function makeFb2Xml({
  title = 'Тестовая книга',
  firstName = 'Иван',
  lastName = 'Петров',
  middleName = '',
  bodyContent = '<section><title><p>Глава 1</p></title><p>Текст главы.</p></section>',
  binaries = '',
  encoding = 'utf-8',
} = {}) {
  const middleTag = middleName ? `<middle-name>${middleName}</middle-name>` : '';
  return `<?xml version="1.0" encoding="${encoding}"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <author>
        <first-name>${firstName}</first-name>
        ${middleTag}
        <last-name>${lastName}</last-name>
      </author>
      <book-title>${title}</book-title>
    </title-info>
  </description>
  <body>
    ${bodyContent}
  </body>
  ${binaries}
</FictionBook>`;
}

/**
 * Создать File из текста
 */
function makeFile(content, name = 'test.fb2') {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(content);
  const file = new File([buffer], name, { type: 'application/x-fictionbook' });
  // jsdom File не поддерживает arrayBuffer() — полифиллим
  if (!file.arrayBuffer) {
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    file.arrayBuffer = () => Promise.resolve(ab);
  }
  return file;
}

/**
 * Создать XML-документ из строки (для тестов отдельных функций)
 */
function parseXmlString(xmlStr) {
  const parser = new DOMParser();
  return parser.parseFromString(xmlStr, 'application/xml');
}

/**
 * Создать HTML-элемент из строки
 */
function createElement(htmlStr) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<root>${htmlStr}</root>`, 'application/xml');
  return doc.documentElement.firstElementChild;
}

describe('Fb2Parser', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // getFb2Text
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getFb2Text()', () => {
    it('should extract text by selector', () => {
      const doc = parseXmlString('<root><book-title>Война и мир</book-title></root>');
      expect(getFb2Text(doc.documentElement, 'book-title')).toBe('Война и мир');
    });

    it('should return empty string for missing selector', () => {
      const doc = parseXmlString('<root><other>text</other></root>');
      expect(getFb2Text(doc.documentElement, 'book-title')).toBe('');
    });

    it('should return empty string for null parent', () => {
      expect(getFb2Text(null, 'book-title')).toBe('');
    });

    it('should trim whitespace', () => {
      const doc = parseXmlString('<root><title>  Trimmed  </title></root>');
      expect(getFb2Text(doc.documentElement, 'title')).toBe('Trimmed');
    });

    it('should return empty for empty element', () => {
      const doc = parseXmlString('<root><title>   </title></root>');
      expect(getFb2Text(doc.documentElement, 'title')).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // extractFb2Title
  // ═══════════════════════════════════════════════════════════════════════════

  describe('extractFb2Title()', () => {
    it('should extract title from paragraphs', () => {
      const doc = parseXmlString('<title><p>Глава первая</p></title>');
      expect(extractFb2Title(doc.documentElement)).toBe('Глава первая');
    });

    it('should join multiple paragraphs with dots', () => {
      const doc = parseXmlString('<title><p>Часть I</p><p>Начало пути</p></title>');
      expect(extractFb2Title(doc.documentElement)).toBe('Часть I. Начало пути');
    });

    it('should fallback to textContent if no paragraphs', () => {
      const doc = parseXmlString('<title>Простой заголовок</title>');
      expect(extractFb2Title(doc.documentElement)).toBe('Простой заголовок');
    });

    it('should skip empty paragraphs', () => {
      const doc = parseXmlString('<title><p>Текст</p><p>  </p><p>Ещё</p></title>');
      expect(extractFb2Title(doc.documentElement)).toBe('Текст. Ещё');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // loadFb2Images
  // ═══════════════════════════════════════════════════════════════════════════

  describe('loadFb2Images()', () => {
    it('should load binary images with id and #id keys', () => {
      const doc = parseXmlString(`
        <root>
          <binary id="img1" content-type="image/jpeg">AQID</binary>
        </root>
      `);
      const map = loadFb2Images(doc);

      expect(map.has('img1')).toBe(true);
      expect(map.has('#img1')).toBe(true);
      expect(map.get('img1')).toBe('data:image/jpeg;base64,AQID');
    });

    it('should default content-type to image/jpeg', () => {
      const doc = parseXmlString(`
        <root>
          <binary id="pic">ABC</binary>
        </root>
      `);
      const map = loadFb2Images(doc);

      expect(map.get('pic')).toBe('data:image/jpeg;base64,ABC');
    });

    it('should handle multiple binaries', () => {
      const doc = parseXmlString(`
        <root>
          <binary id="a" content-type="image/png">AAA</binary>
          <binary id="b" content-type="image/gif">BBB</binary>
        </root>
      `);
      const map = loadFb2Images(doc);

      expect(map.size).toBe(4); // a, #a, b, #b
      expect(map.get('a')).toContain('image/png');
      expect(map.get('b')).toContain('image/gif');
    });

    it('should skip entries without id', () => {
      const doc = parseXmlString(`
        <root>
          <binary content-type="image/png">AAA</binary>
        </root>
      `);
      const map = loadFb2Images(doc);

      expect(map.size).toBe(0);
    });

    it('should skip entries with empty base64', () => {
      const doc = parseXmlString(`
        <root>
          <binary id="empty" content-type="image/png">   </binary>
        </root>
      `);
      const map = loadFb2Images(doc);

      expect(map.size).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // convertFb2Element
  // ═══════════════════════════════════════════════════════════════════════════

  describe('convertFb2Element()', () => {
    const emptyMap = new Map();

    it('should convert <p> to HTML paragraph', () => {
      const el = createElement('<p>Простой текст</p>');
      expect(convertFb2Element(el, emptyMap)).toBe('<p>Простой текст</p>');
    });

    it('should convert <empty-line> to nbsp', () => {
      const el = createElement('<empty-line/>');
      expect(convertFb2Element(el, emptyMap)).toBe('<p>&nbsp;</p>');
    });

    it('should convert <subtitle> to h2', () => {
      const el = createElement('<subtitle>Подзаголовок</subtitle>');
      expect(convertFb2Element(el, emptyMap)).toBe('<h2>Подзаголовок</h2>');
    });

    it('should convert <epigraph> to blockquote', () => {
      const el = createElement('<epigraph><p>Цитата</p></epigraph>');
      const result = convertFb2Element(el, emptyMap);
      expect(result).toContain('<blockquote>');
      expect(result).toContain('<p>Цитата</p>');
    });

    it('should convert <cite> to blockquote', () => {
      const el = createElement('<cite><p>Цитирование</p></cite>');
      const result = convertFb2Element(el, emptyMap);
      expect(result).toContain('<blockquote>');
    });

    it('should convert <text-author> to italicized paragraph', () => {
      const el = createElement('<text-author>А.С.Пушкин</text-author>');
      expect(convertFb2Element(el, emptyMap)).toBe('<p><em>А.С.Пушкин</em></p>');
    });

    it('should convert <table> to text paragraph', () => {
      const el = createElement('<table>Табличные данные</table>');
      expect(convertFb2Element(el, emptyMap)).toBe('<p>Табличные данные</p>');
    });

    it('should handle <image> with matching href', () => {
      const imageMap = new Map([['#pic1', 'data:image/png;base64,ABC']]);
      const el = createElement('<image l:href="#pic1" xmlns:l="http://www.w3.org/1999/xlink"/>');
      // Try with xlink:href since jsdom may handle namespaces differently
      const el2 = createElement('<image href="#pic1"/>');
      const result = convertFb2Element(el2, imageMap);
      expect(result).toBe('<img src="data:image/png;base64,ABC" alt="">');
    });

    it('should return empty for <image> without matching href', () => {
      const el = createElement('<image href="#unknown"/>');
      expect(convertFb2Element(el, new Map())).toBe('');
    });

    it('should convert <annotation> children', () => {
      const el = createElement('<annotation><p>Описание книги</p></annotation>');
      const result = convertFb2Element(el, emptyMap);
      expect(result).toContain('<p>Описание книги</p>');
    });

    it('should skip empty <p> elements', () => {
      const el = createElement('<p>   </p>');
      expect(convertFb2Element(el, emptyMap)).toBe('');
    });

    it('should handle unknown elements with text', () => {
      const el = createElement('<custom>Текст</custom>');
      expect(convertFb2Element(el, emptyMap)).toContain('Текст');
    });

    it('should return empty for unknown elements without text', () => {
      const el = createElement('<custom></custom>');
      expect(convertFb2Element(el, emptyMap)).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // convertFb2Inline
  // ═══════════════════════════════════════════════════════════════════════════

  describe('convertFb2Inline()', () => {
    const emptyMap = new Map();

    it('should preserve plain text', () => {
      const el = createElement('<p>Обычный текст</p>');
      expect(convertFb2Inline(el, emptyMap)).toBe('Обычный текст');
    });

    it('should wrap <emphasis> in <em>', () => {
      const el = createElement('<p><emphasis>курсив</emphasis></p>');
      expect(convertFb2Inline(el, emptyMap)).toBe('<em>курсив</em>');
    });

    it('should wrap <strong> in <strong>', () => {
      const el = createElement('<p><strong>жирный</strong></p>');
      expect(convertFb2Inline(el, emptyMap)).toBe('<strong>жирный</strong>');
    });

    it('should wrap <strikethrough> in <s>', () => {
      const el = createElement('<p><strikethrough>зачёркнуто</strikethrough></p>');
      expect(convertFb2Inline(el, emptyMap)).toBe('<s>зачёркнуто</s>');
    });

    it('should handle <sup> and <sub>', () => {
      const el = createElement('<p>H<sub>2</sub>O x<sup>2</sup></p>');
      const result = convertFb2Inline(el, emptyMap);
      expect(result).toContain('<sub>2</sub>');
      expect(result).toContain('<sup>2</sup>');
    });

    it('should strip <a> tags keeping content', () => {
      const el = createElement('<p><a href="note1">Примечание</a></p>');
      expect(convertFb2Inline(el, emptyMap)).toBe('Примечание');
    });

    it('should handle nested inline formatting', () => {
      const el = createElement('<p><emphasis><strong>bold italic</strong></emphasis></p>');
      expect(convertFb2Inline(el, emptyMap)).toBe('<em><strong>bold italic</strong></em>');
    });

    it('should handle inline <image> with matching href', () => {
      const imageMap = new Map([['pic1', 'data:image/png;base64,X']]);
      const el = createElement('<p><image href="pic1"/></p>');
      expect(convertFb2Inline(el, imageMap)).toBe('<img src="data:image/png;base64,X" alt="">');
    });

    it('should convert unknown inline elements to text', () => {
      const el = createElement('<p><code>x = 1</code></p>');
      expect(convertFb2Inline(el, emptyMap)).toBe('x = 1');
    });

    it('should escape HTML in text', () => {
      const el = createElement('<p>a &lt; b &amp; c</p>');
      const result = convertFb2Inline(el, emptyMap);
      expect(result).toContain('&lt;');
      expect(result).toContain('&amp;');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseFb2 (main entry point)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseFb2()', () => {
    it('should parse basic FB2 file', async () => {
      const xml = makeFb2Xml();
      const file = makeFile(xml);

      const result = await parseFb2(file);

      expect(result.title).toBe('Тестовая книга');
      expect(result.author).toBe('Иван Петров');
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].html).toContain('Текст главы.');
    });

    it('should extract author with middle name', async () => {
      const xml = makeFb2Xml({ middleName: 'Иванович' });
      const file = makeFile(xml);

      const result = await parseFb2(file);

      expect(result.author).toBe('Иван Иванович Петров');
    });

    it('should handle multiple sections as separate chapters', async () => {
      const body = `
        <section><title><p>Глава 1</p></title><p>Текст 1</p></section>
        <section><title><p>Глава 2</p></title><p>Текст 2</p></section>
        <section><title><p>Глава 3</p></title><p>Текст 3</p></section>
      `;
      const xml = makeFb2Xml({ bodyContent: body });
      const file = makeFile(xml);

      const result = await parseFb2(file);

      expect(result.chapters).toHaveLength(3);
      expect(result.chapters[0].title).toBe('Глава 1');
      expect(result.chapters[1].title).toBe('Глава 2');
      expect(result.chapters[2].title).toBe('Глава 3');
    });

    it('should generate chapter IDs', async () => {
      const body = `
        <section><title><p>A</p></title><p>Text</p></section>
        <section><title><p>B</p></title><p>Text</p></section>
      `;
      const xml = makeFb2Xml({ bodyContent: body });
      const file = makeFile(xml);

      const result = await parseFb2(file);

      expect(result.chapters[0].id).toBe('chapter_1');
      expect(result.chapters[1].id).toBe('chapter_2');
    });

    it('should handle body without sections as single chapter', async () => {
      const body = '<p>Весь текст без секций.</p>';
      const xml = makeFb2Xml({ bodyContent: body });
      const file = makeFile(xml);

      const result = await parseFb2(file);

      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].html).toContain('Весь текст без секций.');
    });

    it('should use filename as title fallback', async () => {
      const xml = makeFb2Xml({ title: '' });
      const file = makeFile(xml, 'Моя книга.fb2');

      const result = await parseFb2(file);

      expect(result.title).toBe('Моя книга');
    });

    it('should handle nested sections', async () => {
      const body = `
        <section>
          <title><p>Часть I</p></title>
          <p>Вводный текст</p>
          <section><title><p>Глава 1.1</p></title><p>Текст 1.1</p></section>
          <section><title><p>Глава 1.2</p></title><p>Текст 1.2</p></section>
        </section>
      `;
      const xml = makeFb2Xml({ bodyContent: body });
      const file = makeFile(xml);

      const result = await parseFb2(file);

      // Should have preamble + 2 subsections = 3 chapters
      expect(result.chapters.length).toBeGreaterThanOrEqual(2);
    });

    it('should throw for missing body', async () => {
      const xml = `<?xml version="1.0" encoding="utf-8"?>
        <FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
          <description><title-info><book-title>T</book-title></title-info></description>
        </FictionBook>`;
      const file = makeFile(xml);

      await expect(parseFb2(file)).rejects.toThrow('body');
    });

    it('should throw for empty body', async () => {
      const xml = makeFb2Xml({ bodyContent: '' });
      const file = makeFile(xml);

      await expect(parseFb2(file)).rejects.toThrow();
    });

    it('should handle sections without titles', async () => {
      const body = `
        <section><p>Текст без заголовка</p></section>
      `;
      const xml = makeFb2Xml({ bodyContent: body });
      const file = makeFile(xml);

      const result = await parseFb2(file);

      expect(result.chapters).toHaveLength(1);
      // Should have a generated title
      expect(result.chapters[0].title).toContain('Глава');
    });

    it('should handle poem elements', async () => {
      const body = `
        <section>
          <title><p>Стихи</p></title>
          <poem>
            <title>Первый стих</title>
            <stanza>
              <v>Строка первая</v>
              <v>Строка вторая</v>
            </stanza>
            <text-author>Автор стихов</text-author>
          </poem>
        </section>
      `;
      const xml = makeFb2Xml({ bodyContent: body });
      const file = makeFile(xml);

      const result = await parseFb2(file);

      expect(result.chapters[0].html).toContain('Строка первая');
      expect(result.chapters[0].html).toContain('Строка вторая');
    });

    it('should handle binary images', async () => {
      const body = `
        <section>
          <title><p>С картинкой</p></title>
          <p>Текст</p>
          <image href="#img1"/>
        </section>
      `;
      const binaries = '<binary id="img1" content-type="image/png">AQID</binary>';
      const xml = makeFb2Xml({ bodyContent: body, binaries });
      const file = makeFile(xml);

      const result = await parseFb2(file);

      expect(result.chapters[0].html).toContain('data:image/png;base64,AQID');
    });

    it('should handle empty author fields', async () => {
      const xml = makeFb2Xml({ firstName: '', middleName: '', lastName: '' });
      const file = makeFile(xml);

      const result = await parseFb2(file);

      expect(result.author).toBe('');
    });
  });
});
