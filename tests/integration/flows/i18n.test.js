/**
 * INTEGRATION TEST: i18n (Internationalization)
 * Переключение языков (RU/EN/ES/FR/DE), применение переводов к DOM,
 * ленивая загрузка локалей, персистентность, detectLanguage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { flushPromises } from '../../helpers/testUtils.js';
import {
  initI18n, t, setLanguage, getLanguage, detectLanguage,
  applyTranslations, LANGUAGES,
} from '../../../js/i18n/index.js';

// Mock Analytics to avoid side effects
vi.mock('../../../js/utils/Analytics.js', () => ({
  trackLanguageChanged: vi.fn(),
}));

import { trackLanguageChanged } from '../../../js/utils/Analytics.js';

describe('i18n Integration', () => {
  beforeEach(async () => {
    // Re-initialize with ru for clean state
    await initI18n('ru');
  });

  afterEach(() => {
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with Russian by default', async () => {
      await initI18n('ru');

      expect(getLanguage()).toBe('ru');
      expect(document.documentElement.lang).toBe('ru');
    });

    it('should initialize with a non-default language', async () => {
      await initI18n('en');

      expect(getLanguage()).toBe('en');
      expect(document.documentElement.lang).toBe('en');
    });

    it('should support "auto" language detection', async () => {
      // navigator.language is set by jsdom
      Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });

      await initI18n('auto');

      expect(getLanguage()).toBe('fr');
    });

    it('should fall back to ru for unsupported browser language', async () => {
      Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true });

      await initI18n('auto');

      expect(getLanguage()).toBe('ru');
    });
  });

  describe('Translation function t()', () => {
    it('should return Russian translation for known key', () => {
      const result = t('common.save');

      expect(result).toBe('Сохранить');
    });

    it('should support interpolation', () => {
      const result = t('reader.pageAria', { current: 5, total: 100 });

      expect(result).toContain('5');
      expect(result).toContain('100');
    });

    it('should return key if translation is missing', () => {
      const result = t('nonexistent.key');

      expect(result).toBe('nonexistent.key');
    });
  });

  describe('Language switching', () => {
    it('should switch to English', async () => {
      await setLanguage('en');

      expect(getLanguage()).toBe('en');
      expect(document.documentElement.lang).toBe('en');

      const saveText = t('common.save');
      expect(saveText).toBe('Save');
    });

    it('should switch to Spanish', async () => {
      await setLanguage('es');

      expect(getLanguage()).toBe('es');
      expect(t('common.save')).toBe('Guardar');
    });

    it('should switch to French', async () => {
      await setLanguage('fr');

      expect(getLanguage()).toBe('fr');
      expect(t('common.save')).toBe('Enregistrer');
    });

    it('should switch to German', async () => {
      await setLanguage('de');

      expect(getLanguage()).toBe('de');
      expect(t('common.save')).toBe('Speichern');
    });

    it('should switch back to Russian from another language', async () => {
      await setLanguage('en');
      expect(t('common.save')).toBe('Save');

      await setLanguage('ru');
      expect(t('common.save')).toBe('Сохранить');
    });

    it('should ignore unsupported language codes', async () => {
      await setLanguage('zh'); // Not in LANGUAGES

      expect(getLanguage()).toBe('ru'); // Should stay at previous
    });

    it('should update document lang attribute on language change', async () => {
      await setLanguage('en');

      expect(document.documentElement.lang).toBe('en');
    });

    it('should handle rapid language switching', async () => {
      await setLanguage('en');
      await setLanguage('fr');
      await setLanguage('de');
      await setLanguage('es');

      expect(getLanguage()).toBe('es');
      expect(t('common.save')).toBe('Guardar');
    });
  });

  describe('applyTranslations (DOM)', () => {
    it('should translate elements with data-i18n attribute (textContent)', async () => {
      const el = document.createElement('span');
      el.setAttribute('data-i18n', 'common.save');
      document.body.appendChild(el);

      applyTranslations();

      expect(el.textContent).toBe('Сохранить');
    });

    it('should translate data-i18n-html (innerHTML)', async () => {
      const el = document.createElement('div');
      el.setAttribute('data-i18n-html', 'common.save');
      document.body.appendChild(el);

      applyTranslations();

      expect(el.innerHTML).toBe('Сохранить');
    });

    it('should translate data-i18n-placeholder', async () => {
      const input = document.createElement('input');
      input.setAttribute('data-i18n-placeholder', 'common.save');
      document.body.appendChild(input);

      applyTranslations();

      expect(input.getAttribute('placeholder')).toBe('Сохранить');
    });

    it('should translate data-i18n-aria-label', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('data-i18n-aria-label', 'common.close');
      document.body.appendChild(btn);

      applyTranslations();

      expect(btn.getAttribute('aria-label')).toBe('Закрыть');
    });

    it('should translate data-i18n-title', async () => {
      const el = document.createElement('div');
      el.setAttribute('data-i18n-title', 'common.delete');
      document.body.appendChild(el);

      applyTranslations();

      expect(el.getAttribute('title')).toBe('Удалить');
    });

    it('should translate within a specific root element', async () => {
      const root = document.createElement('div');
      const el = document.createElement('span');
      el.setAttribute('data-i18n', 'common.cancel');
      root.appendChild(el);

      const outside = document.createElement('span');
      outside.setAttribute('data-i18n', 'common.save');
      outside.textContent = 'untranslated';
      document.body.appendChild(outside);
      document.body.appendChild(root);

      applyTranslations(root);

      expect(el.textContent).toBe('Отмена');
      expect(outside.textContent).toBe('untranslated'); // Not translated
    });

    it('should translate the root element itself if it has data-i18n', async () => {
      const root = document.createElement('div');
      root.setAttribute('data-i18n', 'common.edit');
      document.body.appendChild(root);

      applyTranslations(root);

      expect(root.textContent).toBe('Редактировать');
    });

    it('should update translations when language changes', async () => {
      const el = document.createElement('span');
      el.setAttribute('data-i18n', 'common.save');
      document.body.appendChild(el);

      applyTranslations();
      expect(el.textContent).toBe('Сохранить');

      await setLanguage('en');
      // setLanguage calls applyTranslations automatically
      expect(el.textContent).toBe('Save');
    });

    it('should handle multiple translatable elements', async () => {
      const container = document.createElement('div');

      const el1 = document.createElement('span');
      el1.setAttribute('data-i18n', 'common.save');
      container.appendChild(el1);

      const el2 = document.createElement('span');
      el2.setAttribute('data-i18n', 'common.cancel');
      container.appendChild(el2);

      const el3 = document.createElement('button');
      el3.setAttribute('data-i18n-aria-label', 'common.close');
      container.appendChild(el3);

      document.body.appendChild(container);
      applyTranslations(container);

      expect(el1.textContent).toBe('Сохранить');
      expect(el2.textContent).toBe('Отмена');
      expect(el3.getAttribute('aria-label')).toBe('Закрыть');
    });

    it('should handle null root gracefully', () => {
      expect(() => applyTranslations(null)).not.toThrow();
    });
  });

  describe('detectLanguage()', () => {
    it('should detect from navigator.language', () => {
      Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
      expect(detectLanguage()).toBe('en');
    });

    it('should detect Spanish from es-MX', () => {
      Object.defineProperty(navigator, 'language', { value: 'es-MX', configurable: true });
      expect(detectLanguage()).toBe('es');
    });

    it('should fall back to ru for unknown language', () => {
      Object.defineProperty(navigator, 'language', { value: 'ja-JP', configurable: true });
      expect(detectLanguage()).toBe('ru');
    });

    it('should handle empty navigator.language', () => {
      Object.defineProperty(navigator, 'language', { value: '', configurable: true });
      expect(detectLanguage()).toBe('ru');
    });
  });

  describe('LANGUAGES constant', () => {
    it('should contain 5 languages', () => {
      expect(LANGUAGES).toHaveLength(5);
    });

    it('should have ru, en, es, fr, de', () => {
      const codes = LANGUAGES.map(l => l.code);
      expect(codes).toEqual(['ru', 'en', 'es', 'fr', 'de']);
    });

    it('should have labels for all languages', () => {
      for (const lang of LANGUAGES) {
        expect(lang.label).toBeTruthy();
        expect(typeof lang.label).toBe('string');
      }
    });
  });

  describe('Lazy locale loading', () => {
    it('should load locale on first switch and cache for second', async () => {
      // First switch to en — loads lazily
      await setLanguage('en');
      expect(t('common.save')).toBe('Save');

      // Switch away and back — should use cached locale
      await setLanguage('ru');
      await setLanguage('en');
      expect(t('common.save')).toBe('Save');
    });
  });

  describe('Full language roundtrip', () => {
    it('should translate DOM correctly through all 5 languages', async () => {
      const el = document.createElement('span');
      el.setAttribute('data-i18n', 'common.save');
      document.body.appendChild(el);

      const expectedTranslations = {
        ru: 'Сохранить',
        en: 'Save',
        es: 'Guardar',
        fr: 'Enregistrer',
        de: 'Speichern',
      };

      for (const [code, expected] of Object.entries(expectedTranslations)) {
        await setLanguage(code);
        expect(el.textContent).toBe(expected);
      }
    });
  });
});
