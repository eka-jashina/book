/**
 * TESTS: AppearancePreview
 * Тесты для компонента живого превью оформления
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AppearancePreview } from '../../../js/admin/modules/AppearancePreview.js';

function createMockElements() {
  return {
    coverTextPreview: document.createElement('div'),
    previewCover: document.createElement('div'),
    previewPage: document.createElement('div'),
    previewTitle: document.createElement('span'),
    previewAuthor: document.createElement('span'),
  };
}

describe('AppearancePreview', () => {
  let elements;
  let preview;

  beforeEach(() => {
    elements = createMockElements();
    preview = new AppearancePreview(elements);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // update
  // ═══════════════════════════════════════════════════════════════════════════

  describe('update()', () => {
    const baseParams = {
      coverBgStart: '#ff0000',
      coverBgEnd: '#0000ff',
      coverText: '#ffffff',
      bgPage: '#fdfcf8',
      coverBgImage: null,
      coverTitle: 'Книга',
      coverAuthor: 'Автор',
      editTheme: 'light',
    };

    it('should set gradient on coverTextPreview', () => {
      preview.update(baseParams);
      expect(elements.coverTextPreview.style.background).toContain('linear-gradient');
    });

    it('should set text color on coverTextPreview', () => {
      preview.update(baseParams);
      expect(elements.coverTextPreview.style.color).toBe('rgb(255, 255, 255)');
    });

    it('should set title text on coverTextPreview', () => {
      preview.update(baseParams);
      expect(elements.coverTextPreview.textContent).toBe('Книга');
    });

    it('should use fallback when title is empty', () => {
      preview.update({ ...baseParams, coverTitle: '' });
      // Fallback из i18n — ключ 'admin.appearance.previewTitleFallback'
      expect(elements.coverTextPreview.textContent).toBe('Заголовок');
    });

    it('should set color on previewCover', () => {
      preview.update(baseParams);
      expect(elements.previewCover.style.color).toBe('rgb(255, 255, 255)');
    });

    it('should set coverBgImage when provided', () => {
      preview.update({ ...baseParams, coverBgImage: 'http://example.com/bg.jpg' });
      expect(elements.previewCover.style.backgroundImage).toContain('http://example.com/bg.jpg');
    });

    it('should clear coverBgImage when null', () => {
      elements.previewCover.style.backgroundImage = 'url(old.jpg)';
      preview.update(baseParams);
      expect(elements.previewCover.style.backgroundImage).toBe('');
    });

    it('should set title and author in preview', () => {
      preview.update(baseParams);
      expect(elements.previewTitle.textContent).toBe('Книга');
      expect(elements.previewAuthor.textContent).toBe('Автор');
    });

    it('should set page background color', () => {
      preview.update(baseParams);
      expect(elements.previewPage.style.backgroundColor).toBe('rgb(253, 252, 248)');
    });

    it('should set dark text color for light theme', () => {
      preview.update({ ...baseParams, editTheme: 'light' });
      expect(elements.previewPage.style.color).toBe('rgb(51, 51, 51)');
    });

    it('should set light text color for dark theme', () => {
      preview.update({ ...baseParams, editTheme: 'dark' });
      expect(elements.previewPage.style.color).toBe('rgb(221, 221, 221)');
    });

    it('should use author fallback when author is empty', () => {
      preview.update({ ...baseParams, coverAuthor: '' });
      expect(elements.previewAuthor.textContent).toBe('Автор');
    });
  });
});
