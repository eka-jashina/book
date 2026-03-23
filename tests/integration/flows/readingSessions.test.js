/**
 * INTEGRATION TEST: Reading Sessions & Analytics
 * Трекинг сессий чтения, Web Vitals, агрегация данных,
 * интеграция с Plausible и серверным API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '../../helpers/testUtils.js';
import {
  trackEvent,
  trackBookOpened,
  trackChapterCompleted,
  trackReadingSessionStart,
  trackReadingSessionEnd,
  updateReadingPage,
  trackSettingsChanged,
  trackThemeChanged,
  trackFontChanged,
  trackGuestRegistered,
  trackBookPublished,
  trackBookImported,
  trackExportConfig,
  trackLanguageChanged,
  setAnalyticsApiClient,
  initAnalytics,
} from '../../../js/utils/Analytics.js';

describe('Reading Sessions & Analytics Integration', () => {
  let plausibleMock;

  beforeEach(() => {
    // Mock Plausible
    plausibleMock = vi.fn();
    window.plausible = plausibleMock;

    // Reset internal state by calling trackReadingSessionEnd
    trackReadingSessionEnd();
    plausibleMock.mockClear();
  });

  afterEach(() => {
    delete window.plausible;
    setAnalyticsApiClient(null);
    vi.restoreAllMocks();
  });

  describe('trackEvent (Plausible)', () => {
    it('should send event to Plausible', () => {
      trackEvent('test_event');

      expect(plausibleMock).toHaveBeenCalledWith('test_event');
    });

    it('should send event with string-coerced props', () => {
      trackEvent('test_event', { count: 42, active: true });

      expect(plausibleMock).toHaveBeenCalledWith('test_event', {
        props: { count: '42', active: 'true' },
      });
    });

    it('should be no-op if Plausible is not loaded', () => {
      delete window.plausible;

      expect(() => trackEvent('test_event')).not.toThrow();
    });
  });

  describe('Typed event helpers', () => {
    it('trackBookOpened should send book_opened', () => {
      trackBookOpened('book-1');

      expect(plausibleMock).toHaveBeenCalledWith('book_opened', {
        props: { book_id: 'book-1' },
      });
    });

    it('trackChapterCompleted should send chapter_completed', () => {
      trackChapterCompleted('book-1', 3);

      expect(plausibleMock).toHaveBeenCalledWith('chapter_completed', {
        props: { book_id: 'book-1', chapter_index: '3' },
      });
    });

    it('trackSettingsChanged should send settings_changed', () => {
      trackSettingsChanged('font', 'georgia');

      expect(plausibleMock).toHaveBeenCalledWith('settings_changed', {
        props: { setting: 'font', value: 'georgia' },
      });
    });

    it('trackThemeChanged should send theme_changed', () => {
      trackThemeChanged('dark');

      expect(plausibleMock).toHaveBeenCalledWith('theme_changed', {
        props: { theme: 'dark' },
      });
    });

    it('trackFontChanged should send font_changed', () => {
      trackFontChanged('merriweather');

      expect(plausibleMock).toHaveBeenCalledWith('font_changed', {
        props: { font: 'merriweather' },
      });
    });

    it('trackGuestRegistered should send guest_registered', () => {
      trackGuestRegistered('email');

      expect(plausibleMock).toHaveBeenCalledWith('guest_registered', {
        props: { method: 'email' },
      });
    });

    it('trackBookPublished should send book_published', () => {
      trackBookPublished('book-42');

      expect(plausibleMock).toHaveBeenCalledWith('book_published', {
        props: { book_id: 'book-42' },
      });
    });

    it('trackBookImported should send book_imported', () => {
      trackBookImported('epub');

      expect(plausibleMock).toHaveBeenCalledWith('book_imported', {
        props: { format: 'epub' },
      });
    });

    it('trackExportConfig should send export_config', () => {
      trackExportConfig();

      expect(plausibleMock).toHaveBeenCalledWith('export_config');
    });

    it('trackLanguageChanged should send language_changed', () => {
      trackLanguageChanged('fr');

      expect(plausibleMock).toHaveBeenCalledWith('language_changed', {
        props: { language: 'fr' },
      });
    });
  });

  describe('Reading session lifecycle', () => {
    it('should start a reading session', () => {
      trackReadingSessionStart('book-1', 5);

      expect(plausibleMock).toHaveBeenCalledWith('reading_session_start', {
        props: { book_id: 'book-1' },
      });
    });

    it('should end a session with duration and pages read', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValue(now + 60000);

      trackReadingSessionStart('book-1', 0);
      plausibleMock.mockClear();

      updateReadingPage(10);
      trackReadingSessionEnd();

      expect(plausibleMock).toHaveBeenCalledWith('reading_session_end', {
        props: {
          book_id: 'book-1',
          pages_read: '10',
          duration_sec: '60',
        },
      });
    });

    it('should not send end event if no session was started', () => {
      trackReadingSessionEnd();

      expect(plausibleMock).not.toHaveBeenCalled();
    });

    it('should reset internal state after session end', () => {
      trackReadingSessionStart('book-1', 0);
      updateReadingPage(5);
      trackReadingSessionEnd();
      plausibleMock.mockClear();

      // Second end call should be no-op
      trackReadingSessionEnd();
      expect(plausibleMock).not.toHaveBeenCalled();
    });

    it('should calculate pages read correctly (forward)', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValue(now + 5000);

      trackReadingSessionStart('book-1', 10);
      updateReadingPage(25);
      plausibleMock.mockClear();

      trackReadingSessionEnd();

      expect(plausibleMock).toHaveBeenCalledWith('reading_session_end', {
        props: expect.objectContaining({ pages_read: '15' }),
      });
    });

    it('should calculate pages read correctly (backward)', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValue(now + 5000);

      trackReadingSessionStart('book-1', 20);
      updateReadingPage(5);
      plausibleMock.mockClear();

      trackReadingSessionEnd();

      // Math.abs(5 - 20) = 15
      expect(plausibleMock).toHaveBeenCalledWith('reading_session_end', {
        props: expect.objectContaining({ pages_read: '15' }),
      });
    });

    it('should track page updates during session', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValue(now + 1000);

      trackReadingSessionStart('book-1', 0);
      updateReadingPage(3);
      updateReadingPage(7);
      updateReadingPage(12);
      plausibleMock.mockClear();

      trackReadingSessionEnd();

      expect(plausibleMock).toHaveBeenCalledWith('reading_session_end', {
        props: expect.objectContaining({ pages_read: '12' }),
      });
    });
  });

  describe('Server persistence', () => {
    it('should save session to server when apiClient is set and pages > 0', async () => {
      const mockApi = {
        saveReadingSession: vi.fn().mockResolvedValue({}),
      };
      setAnalyticsApiClient(mockApi);

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValue(now + 30000);

      trackReadingSessionStart('book-1', 0);
      updateReadingPage(5);
      trackReadingSessionEnd();

      await flushPromises();

      expect(mockApi.saveReadingSession).toHaveBeenCalledWith('book-1', {
        startPage: 0,
        endPage: 5,
        pagesRead: 5,
        durationSec: 30,
        startedAt: expect.any(String),
      });
    });

    it('should NOT save to server if pages_read is 0', async () => {
      const mockApi = {
        saveReadingSession: vi.fn().mockResolvedValue({}),
      };
      setAnalyticsApiClient(mockApi);

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValue(now + 1000);

      trackReadingSessionStart('book-1', 5);
      // Don't update page — stays at startPage
      trackReadingSessionEnd();

      await flushPromises();

      expect(mockApi.saveReadingSession).not.toHaveBeenCalled();
    });

    it('should NOT save to server if no apiClient set', () => {
      setAnalyticsApiClient(null);

      trackReadingSessionStart('book-1', 0);
      updateReadingPage(5);
      trackReadingSessionEnd();

      // No errors, just silently skips
    });

    it('should handle server save failure gracefully', async () => {
      const mockApi = {
        saveReadingSession: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      setAnalyticsApiClient(mockApi);

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValue(now + 1000);

      trackReadingSessionStart('book-1', 0);
      updateReadingPage(3);

      // Should not throw
      expect(() => trackReadingSessionEnd()).not.toThrow();
      await flushPromises();
    });
  });

  describe('initAnalytics', () => {
    it('should register beforeunload and visibilitychange listeners', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const docAddSpy = vi.spyOn(document, 'addEventListener');

      initAnalytics();

      expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(docAddSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('Graceful degradation', () => {
    it('should not throw when Plausible is blocked (ad blocker)', () => {
      delete window.plausible;

      expect(() => {
        trackBookOpened('book-1');
        trackChapterCompleted('book-1', 0);
        trackReadingSessionStart('book-1', 0);
        updateReadingPage(5);
        trackReadingSessionEnd();
        trackSettingsChanged('font', 'georgia');
        trackThemeChanged('dark');
      }).not.toThrow();
    });
  });

  describe('Full reading session flow', () => {
    it('should track complete reading flow: open → read → page updates → close', async () => {
      const mockApi = { saveReadingSession: vi.fn().mockResolvedValue({}) };
      setAnalyticsApiClient(mockApi);

      const now = Date.now();
      let callCount = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => now + (callCount++) * 10000);

      // 1. Open book
      trackBookOpened('book-1');
      expect(plausibleMock).toHaveBeenCalledWith('book_opened', expect.anything());

      // 2. Start session
      trackReadingSessionStart('book-1', 0);

      // 3. Read pages
      updateReadingPage(5);
      updateReadingPage(10);

      // 4. Change settings during reading
      trackSettingsChanged('fontSize', '20');
      trackThemeChanged('dark');

      // 5. Complete chapter
      trackChapterCompleted('book-1', 0);

      // 6. End session
      plausibleMock.mockClear();
      trackReadingSessionEnd();

      expect(plausibleMock).toHaveBeenCalledWith('reading_session_end', expect.anything());

      await flushPromises();
      expect(mockApi.saveReadingSession).toHaveBeenCalledWith('book-1', expect.objectContaining({
        pagesRead: 10,
        startPage: 0,
        endPage: 10,
      }));
    });
  });
});
