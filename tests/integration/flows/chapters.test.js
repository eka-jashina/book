/**
 * INTEGRATION TEST: Chapter Navigation
 * Тестирование навигации по главам и обновления фонов
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
} from '../../helpers/integrationUtils.js';

import { ChapterDelegate } from '../../../js/core/delegates/ChapterDelegate.js';
import { CONFIG } from '../../../js/config.js';

describe('Chapter Navigation Integration', () => {
  let dom;
  let chapterDelegate;
  let mockBackgroundManager;
  let mockDom;
  let mockState;

  beforeEach(() => {
    dom = createFullBookDOM();

    // Mock background manager
    mockBackgroundManager = {
      setBackground: vi.fn(),
      preload: vi.fn(),
    };

    // Mock DOM manager
    mockDom = {
      get: vi.fn((id) => {
        if (id === 'body') return document.body;
        return dom[id] || null;
      }),
    };

    // State with chapter starts
    mockState = {
      index: 0,
      chapterStarts: [2, 50, 100], // Chapter 0 starts at page 2, etc.
    };

    chapterDelegate = new ChapterDelegate({
      backgroundManager: mockBackgroundManager,
      dom: mockDom,
      state: mockState,
    });
  });

  afterEach(() => {
    chapterDelegate?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('getCurrentChapter', () => {
    it('should return chapter 0 for pages before first chapter', () => {
      expect(chapterDelegate.getCurrentChapter(0)).toBe(0);
      expect(chapterDelegate.getCurrentChapter(1)).toBe(0);
    });

    it('should return correct chapter for page at chapter start', () => {
      expect(chapterDelegate.getCurrentChapter(2)).toBe(0);
      expect(chapterDelegate.getCurrentChapter(50)).toBe(1);
      expect(chapterDelegate.getCurrentChapter(100)).toBe(2);
    });

    it('should return correct chapter for pages within chapter', () => {
      expect(chapterDelegate.getCurrentChapter(25)).toBe(0);
      expect(chapterDelegate.getCurrentChapter(75)).toBe(1);
      expect(chapterDelegate.getCurrentChapter(150)).toBe(2);
    });

    it('should use current index when no argument provided', () => {
      mockState.index = 75;

      expect(chapterDelegate.getCurrentChapter()).toBe(1);
    });
  });

  describe('getNextChapter', () => {
    it('should return next chapter index', () => {
      expect(chapterDelegate.getNextChapter(0)).toBe(1);
      expect(chapterDelegate.getNextChapter(1)).toBe(2);
    });

    it('should return null for last chapter', () => {
      const lastChapter = CONFIG.CHAPTERS.length - 1;
      expect(chapterDelegate.getNextChapter(lastChapter)).toBe(null);
    });
  });

  describe('updateBackground - TOC pages', () => {
    it('should set cover background for pages before first chapter (desktop)', () => {
      chapterDelegate.updateBackground(0, false);

      expect(document.body.dataset.chapter).toBe('cover');
      expect(mockBackgroundManager.setBackground).toHaveBeenCalledWith(CONFIG.COVER_BG);
    });

    it('should set mobile cover background for pages before first chapter (mobile)', () => {
      chapterDelegate.updateBackground(1, true);

      expect(document.body.dataset.chapter).toBe('cover');
      expect(mockBackgroundManager.setBackground).toHaveBeenCalledWith(CONFIG.COVER_BG_MOBILE);
    });
  });

  describe('updateBackground - Chapter pages', () => {
    it('should set chapter background (desktop)', () => {
      const chapterInfo = CONFIG.CHAPTERS[0];

      chapterDelegate.updateBackground(10, false);

      expect(document.body.dataset.chapter).toBe(chapterInfo.id);
      expect(mockBackgroundManager.setBackground).toHaveBeenCalledWith(chapterInfo.bg);
    });

    it('should set mobile chapter background (mobile)', () => {
      const chapterInfo = CONFIG.CHAPTERS[0];

      chapterDelegate.updateBackground(10, true);

      expect(document.body.dataset.chapter).toBe(chapterInfo.id);
      expect(mockBackgroundManager.setBackground).toHaveBeenCalledWith(chapterInfo.bgMobile);
    });

    it('should update chapter ID on body element', () => {
      chapterDelegate.updateBackground(55, false);

      expect(document.body.dataset.chapter).toBe(CONFIG.CHAPTERS[1].id);
    });
  });

  describe('Background preloading', () => {
    it('should preload next chapter background', () => {
      chapterDelegate.updateBackground(10, false);

      const nextChapter = CONFIG.CHAPTERS[1];
      expect(mockBackgroundManager.preload).toHaveBeenCalledWith(nextChapter.bg);
    });

    it('should preload mobile background on mobile', () => {
      chapterDelegate.updateBackground(10, true);

      const nextChapter = CONFIG.CHAPTERS[1];
      expect(mockBackgroundManager.preload).toHaveBeenCalledWith(nextChapter.bgMobile);
    });

    it('should NOT preload same chapter twice', () => {
      // First call - should preload chapter 1
      chapterDelegate.updateBackground(10, false);
      expect(mockBackgroundManager.preload).toHaveBeenCalledTimes(1);

      // Second call on same chapter - should NOT preload again
      chapterDelegate.updateBackground(20, false);
      expect(mockBackgroundManager.preload).toHaveBeenCalledTimes(1);
    });

    it('should preload when moving to different chapter', () => {
      // Chapter 0
      chapterDelegate.updateBackground(10, false);
      expect(mockBackgroundManager.preload).toHaveBeenCalledTimes(1);

      // Move to chapter 1 - should preload chapter 2
      chapterDelegate.updateBackground(55, false);
      expect(mockBackgroundManager.preload).toHaveBeenCalledTimes(2);
    });

    it('should NOT preload when on last chapter', () => {
      const lastChapterStart = mockState.chapterStarts[mockState.chapterStarts.length - 1];

      chapterDelegate.updateBackground(lastChapterStart + 10, false);

      // Should not call preload (no next chapter)
      expect(mockBackgroundManager.preload).not.toHaveBeenCalled();
    });
  });

  describe('Chapter transitions', () => {
    it('should handle transition from TOC to chapter', () => {
      // Start at TOC
      chapterDelegate.updateBackground(0, false);
      expect(document.body.dataset.chapter).toBe('cover');

      // Move to first chapter
      chapterDelegate.updateBackground(5, false);
      expect(document.body.dataset.chapter).toBe(CONFIG.CHAPTERS[0].id);
    });

    it('should handle transition between chapters', () => {
      // Chapter 0
      chapterDelegate.updateBackground(10, false);
      expect(document.body.dataset.chapter).toBe(CONFIG.CHAPTERS[0].id);

      // Chapter 1
      chapterDelegate.updateBackground(55, false);
      expect(document.body.dataset.chapter).toBe(CONFIG.CHAPTERS[1].id);

      // Chapter 2
      chapterDelegate.updateBackground(110, false);
      expect(document.body.dataset.chapter).toBe(CONFIG.CHAPTERS[2].id);
    });

    it('should handle backward navigation through chapters', () => {
      // Start at chapter 2
      chapterDelegate.updateBackground(110, false);
      expect(document.body.dataset.chapter).toBe(CONFIG.CHAPTERS[2].id);

      // Go back to chapter 1
      chapterDelegate.updateBackground(55, false);
      expect(document.body.dataset.chapter).toBe(CONFIG.CHAPTERS[1].id);

      // Go back to chapter 0
      chapterDelegate.updateBackground(10, false);
      expect(document.body.dataset.chapter).toBe(CONFIG.CHAPTERS[0].id);
    });
  });

  describe('Edge cases', () => {
    it('should handle page index at exact chapter boundary', () => {
      // Exactly at chapter 1 start (page 50)
      chapterDelegate.updateBackground(50, false);

      expect(document.body.dataset.chapter).toBe(CONFIG.CHAPTERS[1].id);
    });

    it('should handle missing chapter info gracefully', () => {
      // Set chapter starts beyond CONFIG.CHAPTERS length
      mockState.chapterStarts = [2, 50, 100, 150, 200];

      // This should not throw
      expect(() => {
        chapterDelegate.updateBackground(175, false);
      }).not.toThrow();
    });

    it('should reset lastPreloadedChapter on destroy', () => {
      chapterDelegate.updateBackground(10, false);
      expect(chapterDelegate.lastPreloadedChapter).toBe(1);

      chapterDelegate.destroy();
      expect(chapterDelegate.lastPreloadedChapter).toBe(-1);
    });
  });

  describe('Mobile vs Desktop backgrounds', () => {
    it('should use correct background type based on mobile flag', () => {
      const chapter = CONFIG.CHAPTERS[0];

      // Desktop
      chapterDelegate.updateBackground(10, false);
      expect(mockBackgroundManager.setBackground).toHaveBeenLastCalledWith(chapter.bg);

      // Mobile
      chapterDelegate.updateBackground(10, true);
      expect(mockBackgroundManager.setBackground).toHaveBeenLastCalledWith(chapter.bgMobile);
    });

    it('should preload correct background type', () => {
      const nextChapter = CONFIG.CHAPTERS[1];

      // Reset preload tracking
      chapterDelegate.lastPreloadedChapter = -1;

      // Desktop preload
      chapterDelegate.updateBackground(10, false);
      expect(mockBackgroundManager.preload).toHaveBeenLastCalledWith(nextChapter.bg);

      // Reset for mobile test
      chapterDelegate.lastPreloadedChapter = -1;
      mockBackgroundManager.preload.mockClear();

      // Mobile preload
      chapterDelegate.updateBackground(10, true);
      expect(mockBackgroundManager.preload).toHaveBeenLastCalledWith(nextChapter.bgMobile);
    });
  });

  describe('Integration with state', () => {
    it('should read chapterStarts from state', () => {
      expect(chapterDelegate.chapterStarts).toEqual([2, 50, 100]);
    });

    it('should read currentIndex from state', () => {
      mockState.index = 42;
      expect(chapterDelegate.currentIndex).toBe(42);
    });

    it('should use state index for getCurrentChapter without arguments', () => {
      mockState.index = 55;

      const chapter = chapterDelegate.getCurrentChapter();

      expect(chapter).toBe(1); // Page 55 is in chapter 1
    });
  });
});
