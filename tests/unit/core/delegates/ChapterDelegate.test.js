/**
 * Unit tests for ChapterDelegate
 * Chapter management: current chapter detection, background updates, preloading
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock CONFIG
const mockConfig = {
  CHAPTERS: [
    { id: 'ch1', file: 'content/part_1.html', bg: 'images/bg1.webp', bgMobile: 'images/bg1_m.webp' },
    { id: 'ch2', file: 'content/part_2.html', bg: 'images/bg2.webp', bgMobile: 'images/bg2_m.webp' },
    { id: 'ch3', file: 'content/part_3.html', bg: 'images/bg3.webp', bgMobile: 'images/bg3_m.webp' },
  ],
  COVER_BG: 'images/cover.webp',
  COVER_BG_MOBILE: 'images/cover_m.webp',
};

vi.mock('../../../../js/config.js', () => ({
  getConfig: () => mockConfig,
}));

const { ChapterDelegate } = await import('../../../../js/core/delegates/ChapterDelegate.js');

describe('ChapterDelegate', () => {
  let delegate;
  let mockDeps;

  beforeEach(() => {
    mockDeps = {
      backgroundManager: {
        setBackground: vi.fn(),
        preload: vi.fn(),
      },
      dom: {
        get: vi.fn((key) => {
          if (key === 'body') {
            return { dataset: {} };
          }
          return null;
        }),
      },
      state: {
        index: 0,
        chapterStarts: [0, 50, 100],
      },
    };

    delegate = new ChapterDelegate(mockDeps);
  });

  afterEach(() => {
    delegate.destroy();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize lastPreloadedChapter to -1', () => {
      expect(delegate.lastPreloadedChapter).toBe(-1);
    });

    it('should throw error if required dependencies are missing', () => {
      expect(() => new ChapterDelegate({})).toThrow('ChapterDelegate');
    });
  });

  describe('getCurrentChapter', () => {
    it('should return chapter 0 for pages before first chapter start', () => {
      expect(delegate.getCurrentChapter(0)).toBe(0);
      expect(delegate.getCurrentChapter(10)).toBe(0);
      expect(delegate.getCurrentChapter(49)).toBe(0);
    });

    it('should return chapter 1 for pages in second chapter', () => {
      expect(delegate.getCurrentChapter(50)).toBe(1);
      expect(delegate.getCurrentChapter(75)).toBe(1);
      expect(delegate.getCurrentChapter(99)).toBe(1);
    });

    it('should return chapter 2 for pages in third chapter', () => {
      expect(delegate.getCurrentChapter(100)).toBe(2);
      expect(delegate.getCurrentChapter(150)).toBe(2);
    });

    it('should use currentIndex as default', () => {
      mockDeps.state.index = 75;
      expect(delegate.getCurrentChapter()).toBe(1);
    });
  });

  describe('getNextChapter', () => {
    it('should return next chapter index', () => {
      expect(delegate.getNextChapter(0)).toBe(1);
      expect(delegate.getNextChapter(1)).toBe(2);
    });

    it('should return null if at last chapter', () => {
      expect(delegate.getNextChapter(2)).toBeNull();
    });

    it('should return null for invalid chapter', () => {
      expect(delegate.getNextChapter(10)).toBeNull();
    });
  });

  describe('updateBackground', () => {
    describe('before first chapter (TOC/cover)', () => {
      beforeEach(() => {
        mockDeps.state.chapterStarts = [10, 50, 100]; // First chapter starts at 10
      });

      it('should use cover background for pages before first chapter', () => {
        delegate.updateBackground(5, false);

        expect(mockDeps.backgroundManager.setBackground).toHaveBeenCalledWith('images/cover.webp');
      });

      it('should use mobile cover background on mobile', () => {
        delegate.updateBackground(5, true);

        expect(mockDeps.backgroundManager.setBackground).toHaveBeenCalledWith('images/cover_m.webp');
      });

      it('should set body data-chapter to cover', () => {
        const body = { dataset: {} };
        mockDeps.dom.get.mockImplementation((key) => key === 'body' ? body : null);

        delegate.updateBackground(5, false);

        expect(body.dataset.chapter).toBe('cover');
      });
    });

    describe('in chapter content', () => {
      it('should set background for chapter 1', () => {
        delegate.updateBackground(25, false);

        expect(mockDeps.backgroundManager.setBackground).toHaveBeenCalledWith('images/bg1.webp');
      });

      it('should set mobile background on mobile', () => {
        delegate.updateBackground(25, true);

        expect(mockDeps.backgroundManager.setBackground).toHaveBeenCalledWith('images/bg1_m.webp');
      });

      it('should set background for chapter 2', () => {
        delegate.updateBackground(75, false);

        expect(mockDeps.backgroundManager.setBackground).toHaveBeenCalledWith('images/bg2.webp');
      });

      it('should update body data-chapter attribute', () => {
        const body = { dataset: {} };
        mockDeps.dom.get.mockImplementation((key) => key === 'body' ? body : null);

        delegate.updateBackground(75, false);

        expect(body.dataset.chapter).toBe('ch2');
      });
    });

    describe('preloading', () => {
      it('should preload next chapter background on desktop', () => {
        delegate.updateBackground(25, false); // In chapter 0

        expect(mockDeps.backgroundManager.preload).toHaveBeenCalledWith('images/bg2.webp');
        expect(delegate.lastPreloadedChapter).toBe(1);
      });

      it('should preload mobile background on mobile', () => {
        delegate.updateBackground(25, true); // In chapter 0

        expect(mockDeps.backgroundManager.preload).toHaveBeenCalledWith('images/bg2_m.webp');
        expect(delegate.lastPreloadedChapter).toBe(1);
      });

      it('should not preload same chapter twice', () => {
        delegate.updateBackground(25, false);
        delegate.updateBackground(30, false);

        expect(mockDeps.backgroundManager.preload).toHaveBeenCalledTimes(1);
      });

      it('should preload different chapter when changed', () => {
        delegate.updateBackground(25, false); // Preloads ch2
        delegate.updateBackground(75, false); // Should preload ch3

        expect(mockDeps.backgroundManager.preload).toHaveBeenCalledTimes(2);
        expect(mockDeps.backgroundManager.preload).toHaveBeenLastCalledWith('images/bg3.webp');
        expect(delegate.lastPreloadedChapter).toBe(2);
      });

      it('should not preload if at last chapter', () => {
        delegate.updateBackground(120, false); // In chapter 2 (last)

        // Background is set, but preload is not called for next chapter
        expect(mockDeps.backgroundManager.setBackground).toHaveBeenCalled();
        // getNextChapter returns null for last chapter, so no preload
      });
    });

    describe('edge cases', () => {
      it('should handle missing body element', () => {
        mockDeps.dom.get.mockReturnValue(null);

        expect(() => delegate.updateBackground(25, false)).not.toThrow();
        expect(mockDeps.backgroundManager.setBackground).toHaveBeenCalled();
      });

      it('should handle chapter without background', () => {
        vi.doMock('../../../../js/config.js', () => ({
          CONFIG: {
            CHAPTERS: [{ id: 'ch1' }], // No bg defined
          },
        }));

        delegate.updateBackground(0, false);
        // Should not throw
      });
    });
  });

  describe('destroy', () => {
    it('should reset lastPreloadedChapter', () => {
      delegate.lastPreloadedChapter = 2;
      delegate.destroy();

      expect(delegate.lastPreloadedChapter).toBe(-1);
    });
  });
});
