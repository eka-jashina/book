/**
 * SMOKE TEST - Integration Infrastructure
 * Проверяет, что инфраструктура интеграционных тестов работает корректно
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createFullBookDOM,
  cleanupIntegrationDOM,
  waitForState,
  waitForEvent,
  createChapterContent,
  setupFetchMock,
  setupFetchError,
  clickNext,
  clickPrev,
  pressKey,
  clickCover,
  changeFont,
  changeFontSize,
  expectBookState,
  expectCurrentPage,
  expectLoadingHidden,
  expectLoadingVisible,
} from '../helpers/integrationUtils.js';
import { EventEmitter } from '../../js/utils/EventEmitter.js';

describe('Integration Test Infrastructure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('createFullBookDOM', () => {
    it('should create all required DOM elements', () => {
      const dom = createFullBookDOM();

      // Основные элементы книги
      expect(dom.book).toBeInstanceOf(HTMLElement);
      expect(dom.book.id).toBe('book');
      expect(dom.book.dataset.state).toBe('closed');

      // Обложка
      expect(dom.cover).toBeInstanceOf(HTMLElement);
      expect(dom.cover.className).toBe('book-cover');

      // Страницы
      expect(dom.pages).toBeInstanceOf(HTMLElement);
      expect(dom.leftA).toBeInstanceOf(HTMLElement);
      expect(dom.leftB).toBeInstanceOf(HTMLElement);
      expect(dom.rightA).toBeInstanceOf(HTMLElement);
      expect(dom.rightB).toBeInstanceOf(HTMLElement);

      // Анимированный лист
      expect(dom.sheet).toBeInstanceOf(HTMLElement);
      expect(dom.sheetFront).toBeInstanceOf(HTMLElement);
      expect(dom.sheetBack).toBeInstanceOf(HTMLElement);

      // Навигация
      expect(dom.prevButton).toBeInstanceOf(HTMLButtonElement);
      expect(dom.nextButton).toBeInstanceOf(HTMLButtonElement);

      // Индикаторы
      expect(dom.loadingIndicator).toBeInstanceOf(HTMLElement);
      expect(dom.progressBar).toBeInstanceOf(HTMLElement);
      expect(dom.pageInfo).toBeInstanceOf(HTMLElement);

      // Настройки
      expect(dom.settingsPanel).toBeInstanceOf(HTMLElement);
      expect(dom.fontSelector).toBeInstanceOf(HTMLSelectElement);
      expect(dom.fontSizeSlider).toBeInstanceOf(HTMLInputElement);
      expect(dom.themeToggle).toBeInstanceOf(HTMLButtonElement);

      // Аудио контролы
      expect(dom.soundToggle).toBeInstanceOf(HTMLButtonElement);
      expect(dom.volumeSlider).toBeInstanceOf(HTMLInputElement);
    });

    it('should set custom dimensions', () => {
      const dom = createFullBookDOM({
        bookWidth: 1000,
        bookHeight: 800,
        pageWidth: 450,
      });

      // createSizedElement mocks clientWidth/clientHeight (jsdom doesn't support real layout)
      expect(dom.book.clientWidth).toBe(1000);
      expect(dom.book.clientHeight).toBe(800);
      expect(dom.leftA.clientWidth).toBe(450);
    });

    it('should attach elements to document.body', () => {
      createFullBookDOM();

      expect(document.getElementById('book')).not.toBeNull();
      expect(document.getElementById('sheet')).not.toBeNull();
      expect(document.getElementById('loadingIndicator')).not.toBeNull();
      expect(document.getElementById('prevButton')).not.toBeNull();
      expect(document.getElementById('nextButton')).not.toBeNull();
    });
  });

  describe('cleanupIntegrationDOM', () => {
    it('should remove all DOM elements', () => {
      createFullBookDOM();
      expect(document.body.children.length).toBeGreaterThan(0);

      cleanupIntegrationDOM();
      expect(document.body.innerHTML).toBe('');
      expect(document.head.innerHTML).toBe('');
    });
  });

  describe('waitForState', () => {
    it('should resolve immediately if already in target state', async () => {
      const mockStateMachine = {
        state: 'opened',
        subscribe: vi.fn(),
      };

      await expect(waitForState(mockStateMachine, 'opened')).resolves.toBeUndefined();
      expect(mockStateMachine.subscribe).not.toHaveBeenCalled();
    });

    it('should wait for state transition', async () => {
      let callback;
      const mockStateMachine = {
        state: 'closed',
        subscribe: vi.fn((cb) => {
          callback = cb;
          return vi.fn();
        }),
      };

      const promise = waitForState(mockStateMachine, 'opened', 1000);

      // Симулируем переход состояния
      callback('opened');

      await expect(promise).resolves.toBeUndefined();
    });

    it('should timeout if state not reached', async () => {
      const mockStateMachine = {
        state: 'closed',
        subscribe: vi.fn(() => vi.fn()),
      };

      const promise = waitForState(mockStateMachine, 'opened', 100);

      vi.advanceTimersByTime(150);

      await expect(promise).rejects.toThrow('Timeout waiting for state "opened"');
    });
  });

  describe('waitForEvent', () => {
    it('should wait for event and return data', async () => {
      const emitter = new EventEmitter();

      const promise = waitForEvent(emitter, 'test-event', 1000);

      emitter.emit('test-event', { value: 42 });

      const result = await promise;
      expect(result).toEqual({ value: 42 });
    });

    it('should timeout if event not emitted', async () => {
      const emitter = new EventEmitter();

      const promise = waitForEvent(emitter, 'test-event', 100);

      vi.advanceTimersByTime(150);

      await expect(promise).rejects.toThrow('Timeout waiting for event "test-event"');
    });
  });

  describe('createChapterContent', () => {
    it('should create content with default options', () => {
      const html = createChapterContent();

      // Должно быть 3 главы по умолчанию
      expect(html).toContain('data-chapter="0"');
      expect(html).toContain('data-chapter="1"');
      expect(html).toContain('data-chapter="2"');
      expect(html).toContain('Глава 1');
      expect(html).toContain('Глава 2');
      expect(html).toContain('Глава 3');
    });

    it('should create content with custom options', () => {
      const html = createChapterContent({ chapters: 2, paragraphsPerChapter: 5 });

      expect(html).toContain('data-chapter="0"');
      expect(html).toContain('data-chapter="1"');
      expect(html).not.toContain('data-chapter="2"');

      // Проверяем количество параграфов
      const matches = html.match(/Параграф \d+ главы 1/g);
      expect(matches).toHaveLength(5);
    });
  });

  describe('setupFetchMock', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should mock fetch with static content', async () => {
      const testHtml = '<p>Test content</p>';
      setupFetchMock(testHtml);

      const response = await fetch('/test.html');
      const text = await response.text();

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(text).toBe(testHtml);
    });

    it('should mock fetch with dynamic content based on URL', async () => {
      setupFetchMock((url) => `Content for ${url}`);

      const response1 = await fetch('/part_1.html');
      const response2 = await fetch('/part_2.html');

      expect(await response1.text()).toBe('Content for /part_1.html');
      expect(await response2.text()).toBe('Content for /part_2.html');
    });
  });

  describe('setupFetchError', () => {
    it('should mock fetch to return error', async () => {
      setupFetchError(404, 'Not Found');

      const response = await fetch('/nonexistent.html');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('User action simulators', () => {
    let dom;

    beforeEach(() => {
      // Используем реальные таймеры для тестов действий (flushPromises использует setTimeout)
      vi.useRealTimers();
      dom = createFullBookDOM();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('clickNext should trigger click on next button', async () => {
      const clickHandler = vi.fn();
      dom.nextButton.addEventListener('click', clickHandler);

      await clickNext(dom.nextButton);

      expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    it('clickPrev should trigger click on prev button', async () => {
      const clickHandler = vi.fn();
      dom.prevButton.addEventListener('click', clickHandler);

      await clickPrev(dom.prevButton);

      expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    it('pressKey should dispatch keyboard event', async () => {
      const keyHandler = vi.fn();
      document.addEventListener('keydown', keyHandler);

      await pressKey('ArrowRight');

      expect(keyHandler).toHaveBeenCalledTimes(1);
      expect(keyHandler.mock.calls[0][0].key).toBe('ArrowRight');

      document.removeEventListener('keydown', keyHandler);
    });

    it('clickCover should trigger click on cover', async () => {
      const clickHandler = vi.fn();
      dom.cover.addEventListener('click', clickHandler);

      await clickCover(dom.cover);

      expect(clickHandler).toHaveBeenCalledTimes(1);
    });

    it('changeFont should update font selector value', async () => {
      const changeHandler = vi.fn();
      dom.fontSelector.addEventListener('change', changeHandler);

      await changeFont(dom.fontSelector, 'inter');

      expect(dom.fontSelector.value).toBe('inter');
      expect(changeHandler).toHaveBeenCalledTimes(1);
    });

    it('changeFontSize should update font size slider', async () => {
      const inputHandler = vi.fn();
      dom.fontSizeSlider.addEventListener('input', inputHandler);

      await changeFontSize(dom.fontSizeSlider, 20);

      expect(dom.fontSizeSlider.value).toBe('20');
      expect(inputHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Assertions', () => {
    let dom;

    beforeEach(() => {
      dom = createFullBookDOM();
    });

    it('expectBookState should check book state', () => {
      dom.book.dataset.state = 'opened';
      expect(() => expectBookState(dom.book, 'opened')).not.toThrow();
      expect(() => expectBookState(dom.book, 'closed')).toThrow();
    });

    it('expectCurrentPage should check displayed page', () => {
      dom.currentPage.textContent = '5';
      expect(() => expectCurrentPage(dom.currentPage, 5)).not.toThrow();
      expect(() => expectCurrentPage(dom.currentPage, 3)).toThrow();
    });

    it('expectLoadingHidden should check loading indicator is hidden', () => {
      dom.loadingIndicator.hidden = true;
      expect(() => expectLoadingHidden(dom.loadingIndicator)).not.toThrow();

      dom.loadingIndicator.hidden = false;
      expect(() => expectLoadingHidden(dom.loadingIndicator)).toThrow();
    });

    it('expectLoadingVisible should check loading indicator is visible', () => {
      dom.loadingIndicator.hidden = false;
      expect(() => expectLoadingVisible(dom.loadingIndicator)).not.toThrow();

      dom.loadingIndicator.hidden = true;
      expect(() => expectLoadingVisible(dom.loadingIndicator)).toThrow();
    });
  });
});
