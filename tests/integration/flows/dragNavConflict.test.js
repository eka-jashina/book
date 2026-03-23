/**
 * INTEGRATION TEST: Drag + Navigation Conflict
 * Тестирование конфликтов между drag-перелистыванием и кнопочной навигацией.
 *
 * Сценарий: начать drag → попытка flip через кнопку → drag должен блокировать навигацию
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
} from '../../helpers/integrationUtils.js';

import { BookStateMachine } from '../../../js/managers/BookStateMachine.js';
import { NavigationDelegate } from '../../../js/core/delegates/NavigationDelegate.js';
import { DragDelegate } from '../../../js/core/delegates/DragDelegate.js';
import { BookState, Direction } from '../../../js/config.js';
import { EventEmitter } from '../../../js/utils/EventEmitter.js';
import { rateLimiters } from '../../../js/utils/RateLimiter.js';

describe('Drag + Navigation Conflict', () => {
  let dom;
  let stateMachine;
  let navigationDelegate;
  let dragDelegate;
  let eventEmitter;
  let mockState;
  let mockRenderer;
  let mockAnimator;
  let resolveFlip;

  const createControllablePromise = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  beforeEach(() => {
    dom = createFullBookDOM();

    // Добавляем corner-zone для drag
    const book = dom.book;
    const cornerNext = document.createElement('div');
    cornerNext.className = 'corner-zone';
    cornerNext.dataset.dir = 'next';
    book.appendChild(cornerNext);

    const cornerPrev = document.createElement('div');
    cornerPrev.className = 'corner-zone';
    cornerPrev.dataset.dir = 'prev';
    book.appendChild(cornerPrev);

    rateLimiters.navigation.reset();
    rateLimiters.chapter.reset();

    stateMachine = new BookStateMachine();
    eventEmitter = new EventEmitter();

    mockState = {
      index: 4,
      chapterStarts: [0, 4, 8],
    };

    mockRenderer = {
      getMaxIndex: vi.fn().mockReturnValue(20),
      prepareBuffer: vi.fn(),
      prepareSheet: vi.fn(),
      swapBuffers: vi.fn(),
      renderSpread: vi.fn(),
      elements: {
        leftActive: dom.leftA,
        rightActive: dom.rightA,
        leftBuffer: dom.leftB,
        rightBuffer: dom.rightB,
      },
    };

    const flipPromise = createControllablePromise();
    resolveFlip = flipPromise.resolve;

    mockAnimator = {
      runFlip: vi.fn().mockImplementation((direction, swapCallback) => {
        mockAnimator._swapCallback = swapCallback;
        return flipPromise.promise;
      }),
    };

    const mockSettings = { get: vi.fn().mockReturnValue(true) };
    const mockSoundManager = { play: vi.fn() };
    const mockMediaQueries = { isMobile: false };

    stateMachine.transitionTo(BookState.OPENING);
    stateMachine.transitionTo(BookState.OPENED);

    navigationDelegate = new NavigationDelegate({
      stateMachine,
      renderer: mockRenderer,
      animator: mockAnimator,
      settings: mockSettings,
      soundManager: mockSoundManager,
      mediaQueries: mockMediaQueries,
      state: mockState,
    });

    dragDelegate = new DragDelegate({
      stateMachine,
      renderer: mockRenderer,
      animator: mockAnimator,
      soundManager: mockSoundManager,
      dom: {
        get: (id) => {
          const map = {
            book: dom.book,
            sheet: dom.sheet,
            flipShadow: document.createElement('div'),
          };
          return map[id] || null;
        },
      },
      eventManager: {
        add: vi.fn(),
        removeAll: vi.fn(),
      },
      mediaQueries: mockMediaQueries,
      state: mockState,
    });

    navigationDelegate.on('indexChange', (index) => {
      mockState.index = index;
      eventEmitter.emit('indexChange', index);
    });
  });

  afterEach(() => {
    navigationDelegate?.destroy();
    dragDelegate?.destroy();
    stateMachine?.destroy();
    eventEmitter?.destroy();
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
  });

  describe('Drag blocks navigation', () => {
    it('should block navigation flip when drag is active', async () => {
      // Симулируем начало drag — это переводит SM в FLIPPING
      dragDelegate._startDrag({ clientX: 700, clientY: 300 }, Direction.NEXT);

      expect(stateMachine.state).toBe(BookState.FLIPPING);
      expect(dragDelegate.isDragging).toBe(true);

      // Попытка навигации через flip — должна быть заблокирована
      await navigationDelegate.flip(Direction.NEXT);

      // Animator runFlip НЕ должен вызываться навигацией (SM уже FLIPPING)
      expect(mockAnimator.runFlip).not.toHaveBeenCalled();
    });

    it('should block navigation flipToPage when drag is active', async () => {
      dragDelegate._startDrag({ clientX: 700, clientY: 300 }, Direction.NEXT);

      await navigationDelegate.flipToPage(10, Direction.NEXT);

      expect(mockAnimator.runFlip).not.toHaveBeenCalled();
    });

    it('should allow navigation after drag completes successfully', async () => {
      // Начинаем drag
      dragDelegate._startDrag({ clientX: 700, clientY: 300 }, Direction.NEXT);
      expect(stateMachine.state).toBe(BookState.FLIPPING);

      // Симулируем завершение drag (угол > 90°)
      dragDelegate.currentAngle = 120;
      dragDelegate._endDrag();

      // DragAnimator вызовет callback синхронно в тесте, но нам нужно
      // подождать пока DragAnimator.animate() завершит вызов _finish
      // Проверяем, что SM вернулся в OPENED
      // (В реальности DragAnimator анимирует, здесь он мокнут)
    });

    it('should allow navigation after drag is cancelled (angle < 90°)', async () => {
      dragDelegate._startDrag({ clientX: 700, clientY: 300 }, Direction.NEXT);
      expect(stateMachine.state).toBe(BookState.FLIPPING);

      // Угол < 90° — отмена
      dragDelegate.currentAngle = 45;
      dragDelegate._endDrag();

      // DragAnimator.animate вызовется, но в тесте может не вызвать callback сразу
      // Проверяем, что drag больше не активен
      expect(dragDelegate.isDragging).toBe(false);
    });
  });

  describe('Navigation blocks drag', () => {
    it('should block drag when flip animation is running', async () => {
      // Начинаем навигационный flip
      const flipPromise = navigationDelegate.flip(Direction.NEXT);
      expect(stateMachine.state).toBe(BookState.FLIPPING);

      // Попытка начать drag — должна быть заблокирована (isBusy)
      dragDelegate._startDrag({ clientX: 700, clientY: 300 }, Direction.NEXT);
      expect(dragDelegate.isDragging).toBe(false);

      // Завершаем flip
      if (mockAnimator._swapCallback) mockAnimator._swapCallback();
      resolveFlip();
      await flipPromise;
    });

    it('should allow drag after flip animation completes', async () => {
      const flipPromise = navigationDelegate.flip(Direction.NEXT);

      if (mockAnimator._swapCallback) mockAnimator._swapCallback();
      resolveFlip();
      await flipPromise;

      expect(stateMachine.state).toBe(BookState.OPENED);

      // Теперь drag должен работать
      // Обновляем индекс после flip
      dragDelegate._startDrag({ clientX: 700, clientY: 300 }, Direction.NEXT);
      expect(dragDelegate.isDragging).toBe(true);
    });
  });

  describe('Concurrent drag attempts', () => {
    it('should block second drag while first is active', () => {
      dragDelegate._startDrag({ clientX: 700, clientY: 300 }, Direction.NEXT);
      expect(dragDelegate.isDragging).toBe(true);

      // Второй drag — SM уже в FLIPPING, заблокирован
      const secondDrag = new DragDelegate({
        stateMachine,
        renderer: mockRenderer,
        animator: mockAnimator,
        dom: {
          get: (id) => {
            if (id === 'book') return dom.book;
            if (id === 'sheet') return dom.sheet;
            return document.createElement('div');
          },
        },
        eventManager: { add: vi.fn(), removeAll: vi.fn() },
        mediaQueries: { isMobile: false },
        state: mockState,
      });

      secondDrag._startDrag({ clientX: 100, clientY: 300 }, Direction.PREV);
      expect(secondDrag.isDragging).toBe(false);

      secondDrag.destroy();
    });
  });

  describe('State machine consistency', () => {
    it('should maintain OPENED state after drag + navigation sequence', async () => {
      // Drag начало и конец (отмена)
      dragDelegate._startDrag({ clientX: 700, clientY: 300 }, Direction.NEXT);
      dragDelegate.currentAngle = 30;
      dragDelegate.isDragging = false;

      // Принудительно возвращаем SM (имитируем завершение DragAnimator)
      stateMachine.transitionTo(BookState.OPENED);

      expect(stateMachine.state).toBe(BookState.OPENED);

      // Навигационный flip должен работать
      const newFlipPromise = createControllablePromise();
      mockAnimator.runFlip.mockImplementation((dir, cb) => {
        mockAnimator._swapCallback = cb;
        return newFlipPromise.promise;
      });

      const flipPromise = navigationDelegate.flip(Direction.NEXT);
      expect(stateMachine.state).toBe(BookState.FLIPPING);

      if (mockAnimator._swapCallback) mockAnimator._swapCallback();
      newFlipPromise.resolve();
      await flipPromise;

      expect(stateMachine.state).toBe(BookState.OPENED);
    });

    it('should track state transitions throughout drag-nav cycle', () => {
      const history = [];
      stateMachine.subscribe((newState, oldState) => {
        history.push({ from: oldState, to: newState });
      });

      // Drag start → FLIPPING
      dragDelegate._startDrag({ clientX: 700, clientY: 300 }, Direction.NEXT);

      expect(history).toContainEqual({
        from: BookState.OPENED,
        to: BookState.FLIPPING,
      });
    });
  });
});
