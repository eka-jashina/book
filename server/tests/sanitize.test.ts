import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../src/utils/sanitize.js';

describe('sanitizeHtml', () => {
  // ── Allowed tags ─────────────────────────────────────────────

  describe('allowed tags', () => {
    it('should keep basic formatting tags', () => {
      const html = '<p>Hello <strong>world</strong> and <em>italic</em></p>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('should keep headings', () => {
      const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('should keep lists', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('should keep ordered lists', () => {
      const html = '<ol><li>First</li><li>Second</li></ol>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('should keep links with allowed attributes', () => {
      const html = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('should keep images with allowed attributes', () => {
      const html = '<img src="image.jpg" alt="Photo" width="100" height="100">';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('should keep tables', () => {
      const html = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('should keep blockquotes', () => {
      const html = '<blockquote>A wise quote</blockquote>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('should keep code blocks', () => {
      const html = '<pre><code>const x = 1;</code></pre>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('should keep figure and figcaption', () => {
      const html = '<figure><img src="img.jpg" alt="test"><figcaption>Caption</figcaption></figure>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('should keep br and hr', () => {
      const html = 'Line 1<br>Line 2<hr>';
      expect(sanitizeHtml(html)).toContain('<br>');
      expect(sanitizeHtml(html)).toContain('<hr>');
    });

    it('should keep sup and sub tags', () => {
      const html = 'H<sub>2</sub>O and x<sup>2</sup>';
      expect(sanitizeHtml(html)).toBe(html);
    });
  });

  // ── XSS protection ──────────────────────────────────────────

  describe('XSS protection', () => {
    it('should remove script tags', () => {
      const html = '<p>Hello</p><script>alert("xss")</script>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).toContain('<p>Hello</p>');
    });

    it('should remove event handlers', () => {
      const html = '<img src="x" onerror="alert(1)">';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('onerror');
    });

    it('should remove javascript: URLs', () => {
      const html = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('javascript:');
    });

    it('should remove style tags', () => {
      const html = '<style>body { display: none; }</style><p>Text</p>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('<style');
      expect(result).toContain('<p>Text</p>');
    });

    it('should remove iframe tags', () => {
      const html = '<iframe src="https://evil.com"></iframe>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('<iframe');
    });

    it('should remove form tags', () => {
      const html = '<form action="/steal"><input type="text"></form>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('<form');
      expect(result).not.toContain('<input');
    });

    it('should remove disallowed data-* attributes', () => {
      const html = '<div data-evil="payload">Content</div>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('data-evil');
    });

    it('should keep allowed photo album data-* attributes', () => {
      const html = '<div class="photo-album" data-layout="2h"><figure class="photo-album__item"><img src="img.jpg" alt="" data-filter="sepia" data-filter-intensity="75" data-rotation="90"></figure></div>';
      const result = sanitizeHtml(html);
      expect(result).toContain('data-layout="2h"');
      expect(result).toContain('data-filter="sepia"');
      expect(result).toContain('data-filter-intensity="75"');
      expect(result).toContain('data-rotation="90"');
    });

    it('should handle nested script injection attempts', () => {
      const html = '<p>Text<scr<script>ipt>alert(1)</scr</script>ipt></p>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('<script');
      // DOMPurify strips script tags but keeps surrounding text fragments as safe text
      expect(result).toContain('<p>');
    });

    it('should remove object and embed tags', () => {
      const html = '<object data="evil.swf"></object><embed src="evil.swf">';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('<object');
      expect(result).not.toContain('<embed');
    });
  });

  // ── Allowed attributes ───────────────────────────────────────

  describe('allowed attributes', () => {
    it('should keep class and id attributes', () => {
      const html = '<div class="chapter" id="ch1">Content</div>';
      const result = sanitizeHtml(html);
      expect(result).toContain('class="chapter"');
      expect(result).toContain('id="ch1"');
    });

    it('should keep title attribute', () => {
      const html = '<span title="Tooltip">Text</span>';
      expect(sanitizeHtml(html)).toContain('title="Tooltip"');
    });

    it('should remove disallowed attributes', () => {
      const html = '<div style="color:red" onclick="alert(1)">Text</div>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('style=');
      expect(result).not.toContain('onclick');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('should handle plain text', () => {
      expect(sanitizeHtml('Hello, world!')).toBe('Hello, world!');
    });

    it('should handle deeply nested tags', () => {
      const html = '<div><p><span><strong><em>Deep</em></strong></span></p></div>';
      expect(sanitizeHtml(html)).toBe(html);
    });
  });
});
