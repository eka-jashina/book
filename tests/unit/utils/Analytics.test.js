import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════
// Тесты для Analytics — обёртка над Plausible
// ═══════════════════════════════════════════

import {
  setAnalyticsApiClient,
  trackEvent,
  trackBookOpened,
  trackChapterCompleted,
  trackReadingSessionStart,
  updateReadingPage,
  trackReadingSessionEnd,
  trackSettingsChanged,
  trackThemeChanged,
  trackFontChanged,
  trackGuestRegistered,
  trackBookPublished,
  trackBookImported,
  trackExportConfig,
  trackLanguageChanged,
  initAnalytics,
} from '@utils/Analytics.js';

describe('Analytics', () => {
  let plausibleMock;

  beforeEach(() => {
    plausibleMock = vi.fn();
    window.plausible = plausibleMock;

    // Сбрасываем состояние сессии
    trackReadingSessionEnd();
    setAnalyticsApiClient(null);
    plausibleMock.mockClear();
  });

  afterEach(() => {
    delete window.plausible;
  });

  // ═══════════════════════════════════════════
  // trackEvent
  // ═══════════════════════════════════════════

  describe('trackEvent', () => {
    it('вызывает window.plausible с именем и пропсами', () => {
      trackEvent('test_event', { key: 'value' });

      expect(plausibleMock).toHaveBeenCalledWith('test_event', {
        props: { key: 'value' },
      });
    });

    it('конвертирует значения пропсов в строки', () => {
      trackEvent('test_event', { num: 42, bool: true });

      expect(plausibleMock).toHaveBeenCalledWith('test_event', {
        props: { num: '42', bool: 'true' },
      });
    });

    it('не падает если plausible не определён', () => {
      delete window.plausible;

      expect(() => trackEvent('test_event', { key: 'value' })).not.toThrow();
    });

    it('вызывает plausible без пропсов если они не переданы', () => {
      trackEvent('simple_event');

      expect(plausibleMock).toHaveBeenCalledWith('simple_event');
    });

    it('не вызывает plausible если он не функция', () => {
      window.plausible = 'not_a_function';

      expect(() => trackEvent('test_event')).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // Простые обёртки над trackEvent
  // ═══════════════════════════════════════════

  describe('trackBookOpened', () => {
    it('отправляет событие book_opened с book_id', () => {
      trackBookOpened('book-123');

      expect(plausibleMock).toHaveBeenCalledWith('book_opened', {
        props: { book_id: 'book-123' },
      });
    });
  });

  describe('trackChapterCompleted', () => {
    it('отправляет событие chapter_completed с book_id и chapter_index', () => {
      trackChapterCompleted('book-1', 3);

      expect(plausibleMock).toHaveBeenCalledWith('chapter_completed', {
        props: { book_id: 'book-1', chapter_index: '3' },
      });
    });
  });

  describe('trackSettingsChanged', () => {
    it('отправляет событие settings_changed', () => {
      trackSettingsChanged('fontSize', 18);

      expect(plausibleMock).toHaveBeenCalledWith('settings_changed', {
        props: { setting: 'fontSize', value: '18' },
      });
    });
  });

  describe('trackThemeChanged', () => {
    it('отправляет событие theme_changed', () => {
      trackThemeChanged('dark');

      expect(plausibleMock).toHaveBeenCalledWith('theme_changed', {
        props: { theme: 'dark' },
      });
    });
  });

  describe('trackFontChanged', () => {
    it('отправляет событие font_changed', () => {
      trackFontChanged('Georgia');

      expect(plausibleMock).toHaveBeenCalledWith('font_changed', {
        props: { font: 'Georgia' },
      });
    });
  });

  describe('trackGuestRegistered', () => {
    it('отправляет событие guest_registered', () => {
      trackGuestRegistered('google');

      expect(plausibleMock).toHaveBeenCalledWith('guest_registered', {
        props: { method: 'google' },
      });
    });
  });

  describe('trackBookPublished', () => {
    it('отправляет событие book_published', () => {
      trackBookPublished('book-42');

      expect(plausibleMock).toHaveBeenCalledWith('book_published', {
        props: { book_id: 'book-42' },
      });
    });
  });

  describe('trackBookImported', () => {
    it('отправляет событие book_imported', () => {
      trackBookImported('epub');

      expect(plausibleMock).toHaveBeenCalledWith('book_imported', {
        props: { format: 'epub' },
      });
    });
  });

  describe('trackExportConfig', () => {
    it('отправляет событие export_config', () => {
      trackExportConfig();

      expect(plausibleMock).toHaveBeenCalledWith('export_config');
    });
  });

  describe('trackLanguageChanged', () => {
    it('отправляет событие language_changed', () => {
      trackLanguageChanged('ru');

      expect(plausibleMock).toHaveBeenCalledWith('language_changed', {
        props: { language: 'ru' },
      });
    });
  });

  // ═══════════════════════════════════════════
  // Сессии чтения
  // ═══════════════════════════════════════════

  describe('trackReadingSessionStart', () => {
    it('отправляет событие reading_session_start и сохраняет состояние сессии', () => {
      trackReadingSessionStart('book-1', 5);

      expect(plausibleMock).toHaveBeenCalledWith('reading_session_start', {
        props: { book_id: 'book-1' },
      });
    });
  });

  describe('updateReadingPage', () => {
    it('обновляет текущую страницу сессии', () => {
      trackReadingSessionStart('book-1', 1);
      updateReadingPage(10);

      // Проверяем через завершение сессии — pages_read должно учитывать новую страницу
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60000);
      plausibleMock.mockClear();

      trackReadingSessionEnd();

      expect(plausibleMock).toHaveBeenCalledWith(
        'reading_session_end',
        expect.objectContaining({
          props: expect.objectContaining({
            pages_read: '9',
          }),
        }),
      );

      vi.restoreAllMocks();
    });
  });

  describe('trackReadingSessionEnd', () => {
    it('возвращает раньше если нет активной сессии', () => {
      trackReadingSessionEnd();

      // Не должно быть вызова reading_session_end
      expect(plausibleMock).not.toHaveBeenCalledWith(
        'reading_session_end',
        expect.anything(),
      );
    });

    it('отправляет событие с длительностью и прочитанными страницами', () => {
      const startTime = 1000000;
      vi.spyOn(Date, 'now').mockReturnValue(startTime);

      trackReadingSessionStart('book-5', 3);
      updateReadingPage(8);

      // Перематываем время на 120 секунд вперёд
      Date.now.mockReturnValue(startTime + 120000);
      plausibleMock.mockClear();

      trackReadingSessionEnd();

      expect(plausibleMock).toHaveBeenCalledWith('reading_session_end', {
        props: {
          book_id: 'book-5',
          duration_sec: '120',
          pages_read: '5',
        },
      });

      vi.restoreAllMocks();
    });

    it('вызывает apiClient.saveReadingSession если клиент установлен', async () => {
      const mockApiClient = {
        saveReadingSession: vi.fn().mockResolvedValue({}),
      };
      setAnalyticsApiClient(mockApiClient);

      const startTime = 2000000;
      vi.spyOn(Date, 'now').mockReturnValue(startTime);

      trackReadingSessionStart('book-7', 1);
      updateReadingPage(5);

      Date.now.mockReturnValue(startTime + 60000);

      trackReadingSessionEnd();

      expect(mockApiClient.saveReadingSession).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('очищает состояние сессии после завершения', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000);
      trackReadingSessionStart('book-1', 1);
      Date.now.mockReturnValue(2000);

      trackReadingSessionEnd();
      plausibleMock.mockClear();

      // Повторный вызов не должен отправлять событие
      trackReadingSessionEnd();
      expect(plausibleMock).not.toHaveBeenCalledWith(
        'reading_session_end',
        expect.anything(),
      );

      vi.restoreAllMocks();
    });
  });

  // ═══════════════════════════════════════════
  // initAnalytics
  // ═══════════════════════════════════════════

  describe('initAnalytics', () => {
    it('добавляет обработчики beforeunload и visibilitychange', () => {
      const windowSpy = vi.spyOn(window, 'addEventListener');
      const docSpy = vi.spyOn(document, 'addEventListener');

      initAnalytics();

      const windowEvents = windowSpy.mock.calls.map((call) => call[0]);
      const docEvents = docSpy.mock.calls.map((call) => call[0]);
      expect(windowEvents).toContain('beforeunload');
      expect(docEvents).toContain('visibilitychange');

      windowSpy.mockRestore();
      docSpy.mockRestore();
    });
  });
});
