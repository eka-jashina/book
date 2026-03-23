/**
 * Тесты для BaseDelegate
 * Базовый класс для всех делегатов
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseDelegate } from '../../../../js/core/delegates/BaseDelegate.js';

// Mock CSSVariables
vi.mock('../../../../js/utils/CSSVariables.js', () => ({
  cssVars: {
    getNumber: vi.fn().mockReturnValue(2),
  },
}));

import { cssVars } from '../../../../js/utils/CSSVariables.js';

describe('BaseDelegate', () => {
  let delegate;
  let mockDeps;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDeps = {
      stateMachine: {
        isOpened: true,
        isBusy: false,
      },
      renderer: { render: vi.fn() },
      animator: { animate: vi.fn() },
      settings: { get: vi.fn() },
      soundManager: { play: vi.fn() },
      ambientManager: { play: vi.fn() },
      mediaQueries: {
        get: vi.fn().mockReturnValue(false),
        get isMobile() { return this.get("mobile"); }
      },
      dom: { get: vi.fn() },
      backgroundManager: { setBackground: vi.fn() },
      state: {
        index: 5,
        chapterStarts: [0, 10, 20],
      },
    };

    delegate = new BaseDelegate(mockDeps);
  });

  describe('constructor', () => {
    it('should store dependencies', () => {
      expect(delegate._deps).toBe(mockDeps);
    });

    it('should call _validateRequiredDependencies', () => {
      const validateSpy = vi.spyOn(BaseDelegate.prototype, '_validateRequiredDependencies');
      new BaseDelegate(mockDeps);
      expect(validateSpy).toHaveBeenCalledWith(mockDeps);
    });
  });

  describe('_validateDependencies', () => {
    it('should not throw if all required deps present', () => {
      expect(() => {
        delegate._validateDependencies(mockDeps, ['stateMachine', 'renderer'], 'TestClass');
      }).not.toThrow();
    });

    it('should throw if required deps missing', () => {
      expect(() => {
        delegate._validateDependencies(mockDeps, ['stateMachine', 'missingDep'], 'TestClass');
      }).toThrow('TestClass: Missing required dependencies: missingDep');
    });

    it('should list all missing deps', () => {
      expect(() => {
        delegate._validateDependencies(mockDeps, ['missing1', 'missing2'], 'TestClass');
      }).toThrow('TestClass: Missing required dependencies: missing1, missing2');
    });
  });

  describe('getters', () => {
    describe('stateMachine', () => {
      it('should return stateMachine from deps', () => {
        expect(delegate.stateMachine).toBe(mockDeps.stateMachine);
      });
    });

    describe('renderer', () => {
      it('should return renderer from deps', () => {
        expect(delegate.renderer).toBe(mockDeps.renderer);
      });
    });

    describe('animator', () => {
      it('should return animator from deps', () => {
        expect(delegate.animator).toBe(mockDeps.animator);
      });
    });

    describe('settings', () => {
      it('should return settings from deps', () => {
        expect(delegate.settings).toBe(mockDeps.settings);
      });
    });

    describe('soundManager', () => {
      it('should return soundManager from deps', () => {
        expect(delegate.soundManager).toBe(mockDeps.soundManager);
      });
    });

    describe('ambientManager', () => {
      it('should return ambientManager from deps', () => {
        expect(delegate.ambientManager).toBe(mockDeps.ambientManager);
      });
    });

    describe('mediaQueries', () => {
      it('should return mediaQueries from deps', () => {
        expect(delegate.mediaQueries).toBe(mockDeps.mediaQueries);
      });
    });

    describe('dom', () => {
      it('should return dom from deps', () => {
        expect(delegate.dom).toBe(mockDeps.dom);
      });
    });

    describe('backgroundManager', () => {
      it('should return backgroundManager from deps', () => {
        expect(delegate.backgroundManager).toBe(mockDeps.backgroundManager);
      });
    });

    describe('state', () => {
      it('should return state from deps', () => {
        expect(delegate.state).toBe(mockDeps.state);
      });
    });
  });

  describe('computed properties', () => {
    describe('isMobile', () => {
      it('should return false when not mobile', () => {
        mockDeps.mediaQueries.get.mockImplementation((key) => key === "mobile" ? false : null);
        expect(delegate.isMobile).toBe(false);
      });

      it('should return true when mobile', () => {
        mockDeps.mediaQueries.get.mockImplementation((key) => key === "mobile" ? true : null);
        expect(delegate.isMobile).toBe(true);
      });

      it('should return false if mediaQueries is undefined', () => {
        delegate._deps.mediaQueries = undefined;
        expect(delegate.isMobile).toBe(false);
      });
    });

    describe('currentIndex', () => {
      it('should return index from state', () => {
        expect(delegate.currentIndex).toBe(5);
      });

      it('should return 0 if state is undefined', () => {
        delegate._deps.state = undefined;
        expect(delegate.currentIndex).toBe(0);
      });
    });

    describe('chapterStarts', () => {
      it('should return chapterStarts from state', () => {
        expect(delegate.chapterStarts).toEqual([0, 10, 20]);
      });

      it('should return empty array if state is undefined', () => {
        delegate._deps.state = undefined;
        expect(delegate.chapterStarts).toEqual([]);
      });
    });

    describe('isOpened', () => {
      it('should return isOpened from stateMachine', () => {
        expect(delegate.isOpened).toBe(true);
      });

      it('should return false if stateMachine is undefined', () => {
        delegate._deps.stateMachine = undefined;
        expect(delegate.isOpened).toBe(false);
      });
    });

    describe('isBusy', () => {
      it('should return isBusy from stateMachine', () => {
        expect(delegate.isBusy).toBe(false);
      });

      it('should return false if stateMachine is undefined', () => {
        delegate._deps.stateMachine = undefined;
        expect(delegate.isBusy).toBe(false);
      });
    });

    describe('pagesPerFlip', () => {
      it('should get value from CSS variables', () => {
        cssVars.getNumber.mockReturnValue(2);
        expect(delegate.pagesPerFlip).toBe(2);
      });

      it('should use mobile default (1) when mobile', () => {
        mockDeps.mediaQueries.get.mockReturnValue(true);
        expect(delegate.pagesPerFlip);
        expect(cssVars.getNumber).toHaveBeenCalledWith('--pages-per-flip', 1);
      });

      it('should use desktop default (2) when not mobile', () => {
        mockDeps.mediaQueries.get.mockReturnValue(false);
        expect(delegate.pagesPerFlip);
        expect(cssVars.getNumber).toHaveBeenCalledWith('--pages-per-flip', 2);
      });
    });
  });

  describe('_playFlipSound', () => {
    it('should play pageFlip sound with random playback rate', () => {
      delegate._playFlipSound();

      expect(mockDeps.soundManager.play).toHaveBeenCalledWith(
        'pageFlip',
        expect.objectContaining({
          playbackRate: expect.any(Number),
        })
      );
    });

    it('should use playback rate between 0.9 and 1.1', () => {
      delegate._playFlipSound();

      const call = mockDeps.soundManager.play.mock.calls[0];
      const playbackRate = call[1].playbackRate;

      expect(playbackRate).toBeGreaterThanOrEqual(0.9);
      expect(playbackRate).toBeLessThanOrEqual(1.1);
    });

    it('should not fail if soundManager is undefined', () => {
      delegate._deps.soundManager = undefined;
      expect(() => delegate._playFlipSound()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should null out deps and remove listeners', () => {
      const handler = vi.fn();
      delegate.on('testEvent', handler);

      delegate.destroy();

      expect(delegate._deps).toBeNull();

      // Listeners should be removed
      delegate.emit('testEvent');
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
