/**
 * TESTS: parserUtils
 * Тесты для утилит парсеров (клиентские + shared)
 */

import { describe, it, expect } from 'vitest';
import { escapeHtml, getTextContent, parseXml, parseHtml } from '../../../js/admin/parsers/parserUtils.js';

// ═══════════════════════════════════════════════════════════════════════════
// escapeHtml
// ═══════════════════════════════════════════════════════════════════════════

describe('parserUtils', () => {
  describe('escapeHtml', () => {
    it('should escape ampersand', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('should escape less-than', () => {
      expect(escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('should escape greater-than', () => {
      expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('should escape all special characters together', () => {
      expect(escapeHtml('<a href="x">&\'</a>')).toBe(
        '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'
      );
    });

    it('should not escape regular text', () => {
      expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle string with only special characters', () => {
      expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;');
    });

    it('should handle Unicode characters', () => {
      expect(escapeHtml('Привет <мир>')).toBe('Привет &lt;мир&gt;');
    });

    it('should handle multiple consecutive ampersands', () => {
      expect(escapeHtml('&&&&')).toBe('&amp;&amp;&amp;&amp;');
    });

    it('should not double-escape already escaped content', () => {
      expect(escapeHtml('&amp;')).toBe('&amp;amp;');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getTextContent
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getTextContent', () => {
    it('should get text content by selector', () => {
      const doc = parseXml('<root><title>My Title</title></root>');
      expect(getTextContent(doc, 'title')).toBe('My Title');
    });

    it('should return empty string if selector not found', () => {
      const doc = parseXml('<root><other>text</other></root>');
      expect(getTextContent(doc, 'missing')).toBe('');
    });

    it('should trim whitespace', () => {
      const doc = parseXml('<root><title>  spaced  </title></root>');
      expect(getTextContent(doc, 'title')).toBe('spaced');
    });

    it('should return empty string for empty element', () => {
      const doc = parseXml('<root><title></title></root>');
      expect(getTextContent(doc, 'title')).toBe('');
    });

    it('should get nested text content', () => {
      const doc = parseXml('<root><div><span>nested</span></div></root>');
      expect(getTextContent(doc, 'div')).toBe('nested');
    });

    it('should concatenate text from multiple child elements', () => {
      const doc = parseXml('<root><p>Hello <em>world</em></p></root>');
      expect(getTextContent(doc, 'p')).toBe('Hello world');
    });

    it('should handle whitespace-only content', () => {
      const doc = parseXml('<root><title>   </title></root>');
      expect(getTextContent(doc, 'title')).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseXml
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseXml', () => {
    it('should parse valid XML', () => {
      const doc = parseXml('<root><child attr="val">text</child></root>');
      expect(doc.querySelector('child').textContent).toBe('text');
      expect(doc.querySelector('child').getAttribute('attr')).toBe('val');
    });

    it('should parse XML with namespaces', () => {
      const doc = parseXml('<root xmlns:ns="http://example.com"><ns:child>text</ns:child></root>');
      expect(doc).toBeDefined();
    });

    it('should fallback to HTML parsing on invalid XML', () => {
      // Unclosed tag — invalid XML but valid HTML
      const doc = parseXml('<div><p>text</div>');
      expect(doc).toBeDefined();
      expect(doc.querySelector('p')).not.toBeNull();
    });

    it('should parse self-closing tags', () => {
      const doc = parseXml('<root><empty/></root>');
      expect(doc.querySelector('empty')).not.toBeNull();
    });

    it('should handle XML with CDATA', () => {
      const doc = parseXml('<root><data><![CDATA[some <content>]]></data></root>');
      expect(doc.querySelector('data')).not.toBeNull();
    });

    it('should parse XML with multiple children', () => {
      const doc = parseXml('<root><a>1</a><b>2</b><c>3</c></root>');
      expect(doc.querySelectorAll('root > *')).toHaveLength(3);
    });

    it('should handle empty XML', () => {
      const doc = parseXml('<root/>');
      expect(doc.querySelector('root')).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseHtml
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseHtml', () => {
    it('should parse HTML into document', () => {
      const doc = parseHtml('<html><body><p>Hello</p></body></html>');
      expect(doc.querySelector('p').textContent).toBe('Hello');
    });

    it('should handle fragment HTML', () => {
      const doc = parseHtml('<p>fragment</p>');
      expect(doc.querySelector('p').textContent).toBe('fragment');
    });

    it('should handle unclosed tags (HTML tolerant)', () => {
      const doc = parseHtml('<div><p>text</div>');
      expect(doc.querySelector('p').textContent).toBe('text');
    });

    it('should parse nested elements', () => {
      const doc = parseHtml('<div><ul><li>Item 1</li><li>Item 2</li></ul></div>');
      const items = doc.querySelectorAll('li');
      expect(items).toHaveLength(2);
    });

    it('should handle attributes', () => {
      const doc = parseHtml('<img src="test.png" alt="photo">');
      const img = doc.querySelector('img');
      expect(img.getAttribute('src')).toBe('test.png');
      expect(img.getAttribute('alt')).toBe('photo');
    });

    it('should parse empty HTML', () => {
      const doc = parseHtml('');
      expect(doc).toBeDefined();
      expect(doc.body).toBeDefined();
    });

    it('should handle HTML entities', () => {
      const doc = parseHtml('<p>&amp; &lt; &gt;</p>');
      expect(doc.querySelector('p').textContent).toBe('& < >');
    });

    it('should preserve table structure', () => {
      const doc = parseHtml('<table><tr><td>Cell</td></tr></table>');
      expect(doc.querySelector('td').textContent).toBe('Cell');
    });
  });
});
