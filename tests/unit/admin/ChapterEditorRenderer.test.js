/**
 * TESTS: ChapterEditorRenderer
 * Тесты для чистых рендер-функций карточек глав
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderChapterBody, renderSectionBody, renderBgSelector } from '../../../js/admin/modules/ChapterEditorRenderer.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

describe('ChapterEditorRenderer', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // renderChapterBody
  // ═══════════════════════════════════════════════════════════════════════════

  describe('renderChapterBody()', () => {
    it('should render id and title inputs', () => {
      const html = renderChapterBody({ id: 'ch1', title: 'Глава 1', file: '', htmlContent: null }, esc);
      expect(html).toContain('value="ch1"');
      expect(html).toContain('value="Глава 1"');
    });

    it('should show upload mode as active when no htmlContent', () => {
      const html = renderChapterBody({ id: 'ch1', title: '', file: '', htmlContent: null }, esc);
      expect(html).toContain('data-input-mode="upload"');
      // Кнопка upload должна быть active
      expect(html).toMatch(/chapter-inline-toggle-btn active.*data-input-mode="upload"/s);
    });

    it('should show editor mode as active when htmlContent exists', () => {
      const html = renderChapterBody({ id: 'ch1', title: '', file: '', htmlContent: '<p>Text</p>' }, esc);
      expect(html).toMatch(/chapter-inline-toggle-btn active.*data-input-mode="editor"/s);
    });

    it('should show file info when file exists', () => {
      const html = renderChapterBody({ id: 'ch1', title: '', file: 'chapter1.html', htmlContent: null }, esc);
      expect(html).toContain('chapter1.html');
      expect(html).toContain('chapter-inline-file-name');
    });

    it('should hide dropzone when file exists', () => {
      const html = renderChapterBody({ id: 'ch1', title: '', file: 'ch.html', htmlContent: null }, esc);
      expect(html).toContain('chapter-inline-file-dropzone" hidden');
    });

    it('should include save button', () => {
      const html = renderChapterBody({ id: 'ch1', title: '', file: '', htmlContent: null }, esc);
      expect(html).toContain('data-action-inline="save-chapter"');
    });

    it('should include bg selector', () => {
      const html = renderChapterBody({ id: 'ch1', title: '', file: '', bg: '', htmlContent: null }, esc);
      expect(html).toContain('data-chapter-bg-mode="none"');
    });

    it('should escape HTML in values', () => {
      const html = renderChapterBody({ id: '<script>', title: 'A&B', file: '', htmlContent: null }, esc);
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('A&amp;B');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // renderSectionBody
  // ═══════════════════════════════════════════════════════════════════════════

  describe('renderSectionBody()', () => {
    it('should render album title input', () => {
      const ch = { albumData: { title: 'Фото', hideTitle: true, pages: [] }, bg: '' };
      const html = renderSectionBody(ch, esc);
      expect(html).toContain('value="Фото"');
      expect(html).toContain('section-inline-title');
    });

    it('should check hideTitle checkbox when true', () => {
      const ch = { albumData: { title: '', hideTitle: true, pages: [] }, bg: '' };
      const html = renderSectionBody(ch, esc);
      expect(html).toContain('checked');
    });

    it('should not check hideTitle checkbox when false', () => {
      const ch = { albumData: { title: '', hideTitle: false, pages: [] }, bg: '' };
      const html = renderSectionBody(ch, esc);
      expect(html).not.toMatch(/section-inline-hide-title.*checked/s);
    });

    it('should include album action buttons', () => {
      const ch = { albumData: { title: '', hideTitle: true, pages: [] }, bg: '' };
      const html = renderSectionBody(ch, esc);
      expect(html).toContain('section-add-page');
      expect(html).toContain('section-bulk-upload');
    });

    it('should use defaults when albumData is null', () => {
      const html = renderSectionBody({ albumData: null, bg: '' }, esc);
      expect(html).toContain('section-inline-title');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // renderBgSelector
  // ═══════════════════════════════════════════════════════════════════════════

  describe('renderBgSelector()', () => {
    it('should mark "none" as active when no bg', () => {
      const html = renderBgSelector({ bg: '' }, esc);
      expect(html).toContain('chapter-bg-option active');
      expect(html).toContain('data-chapter-bg-mode="none"');
    });

    it('should mark upload as active when bg exists', () => {
      const html = renderBgSelector({ bg: 'http://example.com/bg.jpg' }, esc);
      expect(html).toMatch(/texture-option--upload chapter-bg-option active/);
    });

    it('should show thumbnail when bg exists', () => {
      const html = renderBgSelector({ bg: 'http://example.com/bg.jpg' }, esc);
      expect(html).toContain('background-image:url(http://example.com/bg.jpg)');
    });

    it('should show upload icon when no bg', () => {
      const html = renderBgSelector({ bg: '' }, esc);
      expect(html).toContain('svg');
      expect(html).toContain('texture-thumb--upload');
    });

    it('should include hidden input with bg value', () => {
      const html = renderBgSelector({ bg: 'test.jpg' }, esc);
      expect(html).toContain('chapter-inline-bg-value');
      expect(html).toContain('value="test.jpg"');
    });

    it('should hide custom info when no bg', () => {
      const html = renderBgSelector({ bg: '' }, esc);
      expect(html).toContain('chapter-bg-custom-info" hidden');
    });

    it('should show custom info when bg exists', () => {
      const html = renderBgSelector({ bg: 'bg.webp' }, esc);
      // Не должно быть hidden на custom-info
      expect(html).toMatch(/chapter-bg-custom-info"\s*>/);
    });
  });
});
