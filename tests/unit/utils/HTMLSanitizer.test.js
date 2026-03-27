/**
 * TESTS: HTMLSanitizer
 * Тесты для защиты от XSS при загрузке HTML-контента
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTMLSanitizer, sanitizer } from '@utils/HTMLSanitizer.js';

/**
 * Создаём новый экземпляр перед каждым тестом, чтобы конструктор
 * читал актуальные значения модульных констант (важно для mutation testing).
 */
let freshSanitizer;

describe('HTMLSanitizer', () => {
  beforeEach(() => {
    freshSanitizer = new HTMLSanitizer();
  });
  // ═══════════════════════════════════════════════════════════════════════════
  // XSS PROTECTION - DANGEROUS TAGS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('XSS protection - dangerous tags', () => {
    it('should remove script tags', () => {
      const dirty = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('</script>');
      expect(clean).not.toContain('alert');
      expect(clean).toContain('<p>Hello</p>');
      expect(clean).toContain('<p>World</p>');
    });

    it('should remove style tags', () => {
      const dirty = '<style>body{display:none}</style><p>Text</p>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('<style');
      expect(clean).not.toContain('display:none');
      expect(clean).toContain('<p>Text</p>');
    });

    it('should remove iframe tags', () => {
      const dirty = '<iframe src="https://evil.com"></iframe><p>Safe</p>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('<iframe');
      expect(clean).not.toContain('evil.com');
      expect(clean).toContain('<p>Safe</p>');
    });

    it('should remove form tags', () => {
      const dirty = '<form action="/steal"><input type="text"></form><p>OK</p>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('<form');
      expect(clean).not.toContain('<input');
      expect(clean).toContain('<p>OK</p>');
    });

    it('should remove object and embed tags', () => {
      const dirty = '<object data="malware.swf"></object><embed src="bad.swf"><p>OK</p>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('<object');
      expect(clean).not.toContain('<embed');
      expect(clean).toContain('<p>OK</p>');
    });

    it('should remove link and meta tags', () => {
      const dirty = '<link rel="stylesheet" href="evil.css"><meta http-equiv="refresh"><p>OK</p>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('<link');
      expect(clean).not.toContain('<meta');
      expect(clean).toContain('<p>OK</p>');
    });

    it('should remove template and slot tags', () => {
      const dirty = '<template><script>alert(1)</script></template><slot name="x"><p>OK</p>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('<template');
      expect(clean).not.toContain('<slot');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // XSS PROTECTION - EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('XSS protection - event handlers', () => {
    it('should remove onclick handler', () => {
      const dirty = '<p onclick="alert(1)">Click me</p>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('onclick');
      expect(clean).toContain('<p>Click me</p>');
    });

    it('should remove onerror handler', () => {
      const dirty = '<img src="x" onerror="alert(1)">';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('onerror');
    });

    it('should remove onload handler', () => {
      const dirty = '<img src="img.jpg" onload="alert(1)">';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('onload');
    });

    it('should remove onmouseover handler', () => {
      const dirty = '<div onmouseover="alert(1)">Hover</div>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('onmouseover');
    });

    it('should remove onfocus handler', () => {
      const dirty = '<div onfocus="alert(1)" tabindex="0">Focus</div>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('onfocus');
    });

    it('should remove multiple event handlers', () => {
      const dirty = '<div onclick="a()" onmouseover="b()" onmouseout="c()">Text</div>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('onclick');
      expect(clean).not.toContain('onmouseover');
      expect(clean).not.toContain('onmouseout');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // XSS PROTECTION - DANGEROUS URLS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('XSS protection - dangerous URLs', () => {
    it('should remove javascript: URLs in href', () => {
      const dirty = '<a href="javascript:alert(1)">Click</a>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('javascript:');
    });

    it('should remove javascript: URLs in src', () => {
      const dirty = '<img src="javascript:alert(1)">';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('javascript:');
    });

    it('should remove data: URLs in href', () => {
      const dirty = '<a href="data:text/html,<script>alert(1)</script>">X</a>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('data:');
    });

    it('should remove data: URLs in src', () => {
      const dirty = '<img src="data:image/svg+xml,<script>alert(1)</script>">';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('data:');
    });

    it('should remove vbscript: URLs', () => {
      const dirty = '<a href="vbscript:msgbox(1)">Click</a>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('vbscript:');
    });

    it('should remove blob: URLs', () => {
      const dirty = '<a href="blob:http://evil.com/123">Click</a>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('blob:');
    });

    it('should preserve safe URLs in img src', () => {
      const safe = '<img src="/images/photo.jpg" alt="Photo">';
      const clean = sanitizer.sanitize(safe);

      expect(clean).toContain('src="/images/photo.jpg"');
    });

    it('should preserve safe URLs in anchor href', () => {
      const safe = '<a href="/pages/about.html">About</a>';
      const clean = sanitizer.sanitize(safe);

      expect(clean).toContain('href="/pages/about.html"');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // XSS PROTECTION - HTML COMMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('XSS protection - HTML comments', () => {
    it('should remove HTML comments', () => {
      const dirty = '<p>Text</p><!-- comment --><p>More</p>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('<!--');
      expect(clean).not.toContain('-->');
      expect(clean).toContain('<p>Text</p>');
      expect(clean).toContain('<p>More</p>');
    });

    it('should remove IE conditional comments', () => {
      const dirty = '<p>OK</p><!--[if IE]><script>alert(1)</script><![endif]-->';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('<!--');
      expect(clean).not.toContain('script');
      expect(clean).toContain('<p>OK</p>');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ALLOWED CONTENT - TAGS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('allowed content - tags', () => {
    it('should preserve structural tags', () => {
      const safe = '<article><section><div><p>Text</p></div></section></article>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('<article>');
      expect(result).toContain('<section>');
      expect(result).toContain('<div>');
      expect(result).toContain('<p>');
    });

    it('should preserve heading tags', () => {
      const safe = '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('<h1>');
      expect(result).toContain('<h2>');
      expect(result).toContain('<h3>');
      expect(result).toContain('<h4>');
      expect(result).toContain('<h5>');
      expect(result).toContain('<h6>');
    });

    it('should preserve text formatting tags', () => {
      const safe = '<strong>Bold</strong><em>Italic</em><u>Under</u><s>Strike</s><mark>Marked</mark>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
      expect(result).toContain('<u>');
      expect(result).toContain('<s>');
      expect(result).toContain('<mark>');
    });

    it('should preserve list tags', () => {
      const safe = '<ul><li>Item</li></ul><ol><li>Item</li></ol><dl><dt>Term</dt><dd>Def</dd></dl>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('<ul>');
      expect(result).toContain('<ol>');
      expect(result).toContain('<li>');
      expect(result).toContain('<dl>');
      expect(result).toContain('<dt>');
      expect(result).toContain('<dd>');
    });

    it('should preserve table tags', () => {
      const safe = '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('<table>');
      expect(result).toContain('<thead>');
      expect(result).toContain('<tbody>');
      expect(result).toContain('<tr>');
      expect(result).toContain('<th>');
      expect(result).toContain('<td>');
    });

    it('should preserve semantic tags', () => {
      const safe = '<header>H</header><footer>F</footer><nav>N</nav><main>M</main><aside>A</aside>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('<header>');
      expect(result).toContain('<footer>');
      expect(result).toContain('<nav>');
      expect(result).toContain('<main>');
      expect(result).toContain('<aside>');
    });

    it('should preserve figure and figcaption', () => {
      const safe = '<figure><img src="img.jpg" alt=""><figcaption>Caption</figcaption></figure>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('<figure>');
      expect(result).toContain('<figcaption>');
    });

    it('should preserve blockquote, pre, code', () => {
      const safe = '<blockquote>Quote</blockquote><pre><code>code</code></pre>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('<blockquote>');
      expect(result).toContain('<pre>');
      expect(result).toContain('<code>');
    });

    it('should preserve br and hr', () => {
      const safe = '<p>Line1<br>Line2</p><hr>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('<br>');
      expect(result).toContain('<hr>');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ALLOWED CONTENT - ATTRIBUTES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('allowed content - attributes', () => {
    it('should preserve global attributes', () => {
      const safe = '<p class="intro" id="p1" title="Paragraph" lang="ru" dir="ltr">Text</p>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('class="intro"');
      expect(result).toContain('id="p1"');
      expect(result).toContain('title="Paragraph"');
      expect(result).toContain('lang="ru"');
      expect(result).toContain('dir="ltr"');
    });

    it('should preserve img attributes', () => {
      const safe = '<img src="photo.jpg" alt="Photo" width="100" height="100" loading="lazy">';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('src="photo.jpg"');
      expect(result).toContain('alt="Photo"');
      expect(result).toContain('width="100"');
      expect(result).toContain('height="100"');
      expect(result).toContain('loading="lazy"');
    });

    it('should preserve link attributes', () => {
      // External links automatically get rel="noopener noreferrer" and target="_blank"
      const safe = '<a href="https://example.com">Link</a>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('rel="noopener noreferrer"');
      expect(result).toContain('target="_blank"');
    });

    it('should preserve allowed data attributes', () => {
      const safe = '<div data-chapter="1" data-chapter-start="0" data-index="5">Content</div>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('data-chapter="1"');
      expect(result).toContain('data-chapter-start="0"');
      expect(result).toContain('data-index="5"');
    });

    it('should remove non-allowed data attributes', () => {
      const dirty = '<div data-custom="x" data-other="y">Content</div>';
      const result = sanitizer.sanitize(dirty);

      expect(result).not.toContain('data-custom');
      expect(result).not.toContain('data-other');
    });

    it('should preserve table cell attributes', () => {
      const safe = '<table><tr><td colspan="2" rowspan="2">Cell</td><th scope="col">H</th></tr></table>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('colspan="2"');
      expect(result).toContain('rowspan="2"');
      expect(result).toContain('scope="col"');
    });

    it('should preserve ordered list attributes', () => {
      const safe = '<ol start="5" type="A" reversed><li>Item</li></ol>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('start="5"');
      expect(result).toContain('type="A"');
      expect(result).toContain('reversed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should return empty string for null input', () => {
      expect(sanitizer.sanitize(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(sanitizer.sanitize(undefined)).toBe('');
    });

    it('should return empty string for empty string input', () => {
      expect(sanitizer.sanitize('')).toBe('');
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizer.sanitize(123)).toBe('');
      expect(sanitizer.sanitize({})).toBe('');
      expect(sanitizer.sanitize([])).toBe('');
    });

    it('should handle deeply nested content', () => {
      const dirty = '<div><div><div><script>alert(1)</script><p>Deep</p></div></div></div>';
      const clean = sanitizer.sanitize(dirty);

      expect(clean).not.toContain('<script');
      expect(clean).toContain('<p>Deep</p>');
    });

    it('should handle mixed safe and dangerous content', () => {
      const dirty = `
        <article>
          <h2>Title</h2>
          <script>alert(1)</script>
          <p onclick="alert(2)">Text</p>
          <a href="javascript:alert(3)">Link</a>
          <img src="photo.jpg" onerror="alert(4)">
        </article>
      `;
      const clean = sanitizer.sanitize(dirty);

      expect(clean).toContain('<article>');
      expect(clean).toContain('<h2>Title</h2>');
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('onclick');
      expect(clean).not.toContain('javascript:');
      expect(clean).not.toContain('onerror');
      expect(clean).toContain('src="photo.jpg"');
    });

    it('should preserve text content', () => {
      const safe = '<p>Hello, World! Привет мир! 你好世界!</p>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('Hello, World!');
      expect(result).toContain('Привет мир!');
      expect(result).toContain('你好世界!');
    });

    it('should handle self-closing tags', () => {
      const safe = '<p>Text<br/><hr/></p>';
      const result = sanitizer.sanitize(safe);

      expect(result).toContain('<br');
      expect(result).toContain('<hr');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ALLOWED TAGS WHITELIST (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('allowed tags whitelist - completeness', () => {
    const allExpectedTags = [
      'article', 'section', 'div', 'span', 'main', 'aside',
      'header', 'footer', 'nav', 'p', 'h1', 'h2', 'h3', 'h4',
      'h5', 'h6', 'strong', 'em', 'b', 'i', 'u', 's', 'mark',
      'small', 'sub', 'sup', 'ol', 'ul', 'li', 'dl', 'dt', 'dd',
      'blockquote', 'pre', 'code', 'br', 'hr', 'figure',
      'figcaption', 'img', 'a', 'table', 'thead', 'tbody', 'tfoot',
      'tr', 'th', 'td', 'caption',
    ];

    // Void-элементы (не могут иметь детей)
    const voidTags = new Set(['br', 'hr', 'img']);
    // Теги, требующие определённого родителя для корректного парсинга
    const tableChildTags = new Set(['thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption']);

    for (const tag of allExpectedTags) {
      if (tableChildTags.has(tag)) continue; // проверяются в "preserve table tags"
      if (voidTags.has(tag)) {
        it(`should allow <${tag}> (void)`, () => {
          const html = tag === 'img'
            ? `<${tag} src="test.jpg" alt="test">`
            : `<${tag}>`;
          const result = freshSanitizer.sanitize(html);
          expect(result).toContain(`<${tag}`);
        });
      } else {
        it(`should allow <${tag}>`, () => {
          const html = `<${tag}>content</${tag}>`;
          const result = freshSanitizer.sanitize(html);
          expect(result).toContain(`<${tag}>`);
        });
      }
    }

    it('should reject tags not in the whitelist', () => {
      const forbidden = ['script', 'style', 'iframe', 'form', 'input', 'button',
                         'select', 'textarea', 'object', 'embed', 'link', 'meta',
                         'template', 'slot', 'svg', 'math', 'video', 'audio', 'source'];
      for (const tag of forbidden) {
        const html = `<${tag}>content</${tag}>`;
        const result = freshSanitizer.sanitize(html);
        expect(result, `<${tag}> should be removed`).not.toContain(`<${tag}`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL ATTRIBUTES WHITELIST (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('global attributes whitelist - completeness', () => {
    const allowedGlobalAttrs = ['class', 'id', 'title', 'lang', 'dir'];

    for (const attr of allowedGlobalAttrs) {
      it(`should preserve global attr "${attr}" on any tag`, () => {
        const html = `<p ${attr}="test-value">Text</p>`;
        const result = freshSanitizer.sanitize(html);
        expect(result).toContain(`${attr}="test-value"`);
      });
    }

    it('should remove non-whitelisted global attributes', () => {
      const forbidden = ['style', 'tabindex', 'accesskey', 'contenteditable', 'draggable', 'role'];
      for (const attr of forbidden) {
        const html = `<p ${attr}="x">Text</p>`;
        const result = freshSanitizer.sanitize(html);
        expect(result, `attr "${attr}" should be removed`).not.toContain(`${attr}=`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PER-TAG ATTRIBUTE RESTRICTIONS (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('per-tag attribute restrictions', () => {
    it('should allow src on img but not on div', () => {
      const html = '<div src="http://evil.com">text</div>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('src=');
    });

    it('should allow href on a but not on div', () => {
      const html = '<div href="http://evil.com">text</div>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('href=');
    });

    it('should allow colspan on td but not on div', () => {
      const html = '<div colspan="2">text</div>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('colspan=');
    });

    it('should allow start on ol but not on ul', () => {
      const html = '<ul start="5"><li>Item</li></ul>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('start=');
    });

    it('should allow width/height on img but not on div', () => {
      const html = '<div width="100" height="100">text</div>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('width=');
      expect(result).not.toContain('height=');
    });

    it('should allow loading on img but not on div', () => {
      const html = '<div loading="lazy">text</div>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('loading=');
    });

    it('should allow scope on th but not on td', () => {
      const html = '<table><tr><td scope="col">text</td></tr></table>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('scope=');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA ATTRIBUTES WHITELIST (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('data attributes whitelist - completeness', () => {
    const allowedDataAttrs = [
      'data-chapter', 'data-chapter-start', 'data-index',
      'data-layout', 'data-filter', 'data-filter-intensity', 'data-rotation',
    ];

    for (const attr of allowedDataAttrs) {
      it(`should preserve "${attr}"`, () => {
        const html = `<div ${attr}="value">Text</div>`;
        const result = freshSanitizer.sanitize(html);
        expect(result).toContain(`${attr}="value"`);
      });
    }

    it('should remove arbitrary data-* attributes', () => {
      const forbidden = ['data-x', 'data-evil', 'data-bind', 'data-action',
                         'data-controller', 'data-src', 'data-href'];
      for (const attr of forbidden) {
        const html = `<div ${attr}="x">Text</div>`;
        const result = freshSanitizer.sanitize(html);
        expect(result, `${attr} should be removed`).not.toContain(`${attr}=`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA URI SECURITY (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('data URI security', () => {
    const safeImageFormats = ['png', 'jpeg', 'jpg', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'ico', 'avif'];

    for (const fmt of safeImageFormats) {
      it(`should allow safe data:image/${fmt} in img src`, () => {
        const dataUri = `data:image/${fmt};base64,AAAA`;
        const html = `<img src="${dataUri}" alt="test">`;
        const result = freshSanitizer.sanitize(html);
        expect(result, `data:image/${fmt} should be preserved`).toContain(`src="${dataUri}"`);
      });
    }

    it('should block data:image/svg+xml in img src (can contain script)', () => {
      const html = '<img src="data:image/svg+xml;base64,PHN2Zz4=" alt="test">';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('data:image/svg');
    });

    it('should block data:text/html in img src', () => {
      const html = '<img src="data:text/html,<script>alert(1)</script>" alt="test">';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('data:text');
    });

    it('should block data:application/javascript in img src', () => {
      const html = '<img src="data:application/javascript,alert(1)" alt="test">';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('data:application');
    });

    it('should block unsafe data: URI in href', () => {
      const html = '<a href="data:text/html,<script>alert(1)</script>">XSS</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('data:');
    });

    it('should block data: URI without proper base64 marker', () => {
      const html = '<img src="data:image/png,rawdata" alt="test">';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('data:image/png,rawdata');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // URL SCHEME SECURITY (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('URL scheme security', () => {
    it('should allow http:// URLs in href', () => {
      const html = '<a href="http://example.com">Link</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).toContain('href="http://example.com"');
    });

    it('should allow https:// URLs in href', () => {
      const html = '<a href="https://example.com">Link</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).toContain('href="https://example.com"');
    });

    it('should allow mailto: URLs', () => {
      const html = '<a href="mailto:user@example.com">Email</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).toContain('href="mailto:user@example.com"');
    });

    it('should allow tel: URLs', () => {
      const html = '<a href="tel:+1234567890">Call</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).toContain('href="tel:+1234567890"');
    });

    it('should allow relative URLs', () => {
      const html = '<a href="/page">Link</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).toContain('href="/page"');
    });

    it('should allow anchor URLs', () => {
      const html = '<a href="#section">Link</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).toContain('href="#section"');
    });

    it('should block javascript: in any case', () => {
      const variants = ['javascript:', 'JAVASCRIPT:', 'JavaScript:', 'jAvAsCrIpT:'];
      for (const scheme of variants) {
        const html = `<a href="${scheme}alert(1)">XSS</a>`;
        const result = freshSanitizer.sanitize(html);
        expect(result, `${scheme} should be blocked`).not.toContain(scheme.toLowerCase());
      }
    });

    it('should block vbscript: in any case', () => {
      const html = '<a href="VBSCRIPT:MsgBox(1)">XSS</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('vbscript');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTERNAL LINK HARDENING (spec-based)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('external link hardening', () => {
    it('should add rel and target to https:// links', () => {
      const html = '<a href="https://external.com">Link</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).toContain('rel="noopener noreferrer"');
      expect(result).toContain('target="_blank"');
    });

    it('should add rel and target to http:// links', () => {
      const html = '<a href="http://external.com">Link</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).toContain('rel="noopener noreferrer"');
      expect(result).toContain('target="_blank"');
    });

    it('should NOT add rel/target to relative links', () => {
      const html = '<a href="/internal">Link</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('noopener');
    });

    it('should NOT add rel/target to anchor links', () => {
      const html = '<a href="#top">Link</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('noopener');
    });

    it('should NOT add rel/target to mailto links', () => {
      const html = '<a href="mailto:a@b.com">Link</a>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('target="_blank"');
    });

    it('should only harden <a> tags, not other elements', () => {
      const html = '<div>text</div><p>text</p>';
      const result = freshSanitizer.sanitize(html);
      expect(result).not.toContain('noopener');
      expect(result).not.toContain('target=');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOM OPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('custom options', () => {
    it('should allow custom allowed tags', () => {
      const customSanitizer = new HTMLSanitizer({
        allowedTags: ['p', 'span'],
      });

      const html = '<p>OK</p><div>Removed</div><span>OK</span><article>Removed</article>';
      const result = customSanitizer.sanitize(html);

      expect(result).toContain('<p>OK</p>');
      expect(result).toContain('<span>OK</span>');
      expect(result).not.toContain('<div>');
      expect(result).not.toContain('<article>');
    });

    it('should allow custom global attributes', () => {
      const customSanitizer = new HTMLSanitizer({
        allowedAttrsGlobal: ['class'],
      });

      const html = '<p class="x" id="y" title="z">Text</p>';
      const result = customSanitizer.sanitize(html);

      expect(result).toContain('class="x"');
      expect(result).not.toContain('id="y"');
      expect(result).not.toContain('title="z"');
    });

    it('should allow custom data attributes', () => {
      const customSanitizer = new HTMLSanitizer({
        allowedDataAttrs: ['data-custom', 'data-special'],
      });

      const html = '<div data-custom="1" data-special="2" data-other="3">Text</div>';
      const result = customSanitizer.sanitize(html);

      expect(result).toContain('data-custom="1"');
      expect(result).toContain('data-special="2"');
      expect(result).not.toContain('data-other');
    });

    it('should allow custom tag-specific attributes', () => {
      // Нужно добавить <a> в allowedTags, иначе тег будет удалён
      const customSanitizer = new HTMLSanitizer({
        allowedTags: ['img', 'a', 'p', 'div'],
        allowedAttrsByTag: {
          img: ['src', 'alt'],
          a: ['href'],
        },
      });

      const html = '<img src="x.jpg" alt="X" width="100"><a href="/" target="_blank">Link</a>';
      const result = customSanitizer.sanitize(html);

      expect(result).toContain('src="x.jpg"');
      expect(result).toContain('alt="X"');
      expect(result).not.toContain('width="100"');
      expect(result).toContain('href="/"');
      expect(result).not.toContain('target=');
    });
  });
});
