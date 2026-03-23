/**
 * TEST UTILITIES
 * Вспомогательные функции для тестирования Flipbook
 */

import { vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ожидание выполнения всех промисов в очереди microtask
 * @returns {Promise<void>}
 */
export const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Продвижение fake timers и ожидание промисов
 * @param {number} ms - Время в миллисекундах
 * @returns {Promise<void>}
 */
export const advanceTimersAndFlush = async (ms) => {
  vi.advanceTimersByTime(ms);
  await flushPromises();
};

/**
 * Ожидание выполнения условия с таймаутом
 * @param {Function} condition - Функция, возвращающая boolean
 * @param {number} timeout - Таймаут в мс (default: 1000)
 * @param {number} interval - Интервал проверки в мс (default: 10)
 * @returns {Promise<void>}
 */
export const waitFor = async (condition, timeout = 1000, interval = 10) => {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`waitFor timed out after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

/**
 * Ожидание N requestAnimationFrame циклов
 * @param {number} frames - Количество кадров
 * @returns {Promise<void>}
 */
export const waitForFrames = async (frames = 1) => {
  for (let i = 0; i < frames; i++) {
    await advanceTimersAndFlush(16);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// DOM HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создание DOM-элемента с заданными размерами
 * jsdom не поддерживает реальные размеры, поэтому мокаем их
 *
 * @param {number} width - Ширина элемента
 * @param {number} height - Высота элемента
 * @param {string} tag - Тег элемента (default: 'div')
 * @returns {HTMLElement}
 */
export const createSizedElement = (width, height, tag = 'div') => {
  const element = document.createElement(tag);

  Object.defineProperties(element, {
    clientWidth: { value: width, configurable: true },
    clientHeight: { value: height, configurable: true },
    offsetWidth: { value: width, configurable: true },
    offsetHeight: { value: height, configurable: true },
    scrollWidth: { value: width, configurable: true },
    scrollHeight: { value: height, configurable: true },
    getBoundingClientRect: {
      value: () => ({
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
      configurable: true,
    },
  });

  return element;
};

/**
 * Создание элемента страницы книги для тестов пагинации
 * @param {number} width - Ширина страницы (default: 400)
 * @param {number} height - Высота страницы (default: 600)
 * @returns {HTMLElement}
 */
export const createPageElement = (width = 400, height = 600) => {
  const page = createSizedElement(width, height);
  page.className = 'page';
  return page;
};

/**
 * Создание минимальной DOM-структуры книги
 * @returns {Object} - { book, pages, sheet, cover }
 */
export const createBookDOM = () => {
  const book = document.createElement('div');
  book.className = 'book';
  book.dataset.state = 'closed';

  const pages = document.createElement('div');
  pages.className = 'pages';

  const pageLeft = createPageElement();
  pageLeft.className = 'page page-left';

  const pageRight = createPageElement();
  pageRight.className = 'page page-right';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const cover = document.createElement('div');
  cover.className = 'book-cover';

  pages.appendChild(pageLeft);
  pages.appendChild(pageRight);
  book.appendChild(pages);
  book.appendChild(sheet);
  book.appendChild(cover);

  document.body.appendChild(book);

  return {
    book,
    pages,
    pageLeft,
    pageRight,
    sheet,
    cover,
  };
};

/**
 * Очистка DOM после теста
 */
export const cleanupDOM = () => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создание кастомного события с данными
 * @param {string} type - Тип события
 * @param {Object} detail - Данные события
 * @returns {CustomEvent}
 */
export const createCustomEvent = (type, detail = {}) => {
  return new CustomEvent(type, { detail, bubbles: true, cancelable: true });
};

/**
 * Создание события клавиатуры
 * @param {string} type - Тип события (keydown, keyup)
 * @param {string} key - Код клавиши
 * @param {Object} options - Дополнительные опции (ctrlKey, shiftKey, etc.)
 * @returns {KeyboardEvent}
 */
export const createKeyboardEvent = (type, key, options = {}) => {
  return new KeyboardEvent(type, {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
};

/**
 * Создание события мыши
 * @param {string} type - Тип события (click, mousedown, mouseup)
 * @param {Object} options - Координаты и опции
 * @returns {MouseEvent}
 */
export const createMouseEvent = (type, options = {}) => {
  const defaults = {
    clientX: 0,
    clientY: 0,
    button: 0,
    bubbles: true,
    cancelable: true,
  };
  return new MouseEvent(type, { ...defaults, ...options });
};

/**
 * Создание touch-события
 * @param {string} type - Тип события (touchstart, touchmove, touchend)
 * @param {Object} options - Координаты и опции
 * @returns {TouchEvent}
 */
export const createTouchEvent = (type, options = {}) => {
  const { x = 0, y = 0 } = options;

  const touch = {
    identifier: Date.now(),
    target: options.target || document.body,
    clientX: x,
    clientY: y,
    pageX: x,
    pageY: y,
    screenX: x,
    screenY: y,
  };

  return new TouchEvent(type, {
    touches: type === 'touchend' ? [] : [touch],
    targetTouches: type === 'touchend' ? [] : [touch],
    changedTouches: [touch],
    bubbles: true,
    cancelable: true,
  });
};

/**
 * Симуляция drag жеста
 * @param {HTMLElement} element - Элемент для drag
 * @param {Object} from - Начальные координаты { x, y }
 * @param {Object} to - Конечные координаты { x, y }
 */
export const simulateDrag = async (element, from, to) => {
  element.dispatchEvent(createTouchEvent('touchstart', { x: from.x, y: from.y, target: element }));
  await flushPromises();

  element.dispatchEvent(createTouchEvent('touchmove', { x: to.x, y: to.y, target: element }));
  await flushPromises();

  element.dispatchEvent(createTouchEvent('touchend', { x: to.x, y: to.y, target: element }));
  await flushPromises();
};

// ═══════════════════════════════════════════════════════════════════════════
// MOCK HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создание мока StorageManager
 * @param {Object} initialData - Начальные данные
 * @returns {Object}
 */
export const createStorageMock = (initialData = {}) => {
  let data = { ...initialData };

  return {
    load: vi.fn(() => ({ ...data })),
    save: vi.fn((newData) => {
      data = { ...data, ...newData };
    }),
    clear: vi.fn(() => {
      data = {};
    }),
    __getData: () => ({ ...data }),
    __setData: (newData) => {
      data = { ...newData };
    },
  };
};

/**
 * Создание мока EventEmitter
 * @returns {Object}
 */
export const createEventEmitterMock = () => {
  const handlers = new Map();

  return {
    on: vi.fn((event, handler) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event).add(handler);
      return () => handlers.get(event)?.delete(handler);
    }),
    off: vi.fn((event, handler) => {
      handlers.get(event)?.delete(handler);
    }),
    emit: vi.fn((event, ...args) => {
      handlers.get(event)?.forEach((h) => h(...args));
    }),
    destroy: vi.fn(() => {
      handlers.clear();
    }),
    __getHandlers: () => handlers,
  };
};

/**
 * Создание мока BookStateMachine
 * @param {string} initialState - Начальное состояние
 * @returns {Object}
 */
export const createStateMachineMock = (initialState = 'CLOSED') => {
  let state = initialState;
  const listeners = new Set();

  return {
    get state() { return state; },
    get isClosed() { return state === 'CLOSED'; },
    get isOpened() { return state === 'OPENED'; },
    get isFlipping() { return state === 'FLIPPING'; },
    get isBusy() { return ['OPENING', 'CLOSING', 'FLIPPING'].includes(state); },

    transitionTo: vi.fn((newState) => {
      const oldState = state;
      state = newState;
      listeners.forEach((l) => l(newState, oldState));
      return true;
    }),

    forceTransitionTo: vi.fn((newState) => {
      const oldState = state;
      state = newState;
      listeners.forEach((l) => l(newState, oldState));
    }),

    canTransitionTo: vi.fn(() => true),

    subscribe: vi.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),

    reset: vi.fn((newState) => {
      state = newState;
    }),

    destroy: vi.fn(() => {
      listeners.clear();
    }),

    __setState: (newState) => {
      state = newState;
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// ASSERTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Проверка, что функция была вызвана с определённым контекстом this
 * @param {Function} mockFn - Mock функция
 * @param {Object} expectedContext - Ожидаемый контекст
 */
export const expectCalledWithContext = (mockFn, expectedContext) => {
  expect(mockFn.mock.contexts).toContainEqual(expectedContext);
};

/**
 * Проверка, что событие было вызвано на элементе
 * @param {HTMLElement} element - DOM элемент
 * @param {string} eventType - Тип события
 * @returns {boolean}
 */
export const wasEventDispatched = (element, eventType) => {
  const events = element.__events || [];
  return events.some((e) => e.type === eventType);
};

// ═══════════════════════════════════════════════════════════════════════════
// HTML CONTENT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создание тестового HTML контента для пагинатора
 * @param {number} chapters - Количество глав
 * @param {number} paragraphs - Параграфов на главу
 * @returns {string}
 */
export const createTestHTML = (chapters = 2, paragraphs = 3) => {
  let html = '';

  for (let c = 0; c < chapters; c++) {
    html += `<article data-chapter="${c}">`;
    html += `<h2>Chapter ${c + 1}</h2>`;

    for (let p = 0; p < paragraphs; p++) {
      html += `<p>Paragraph ${p + 1} of chapter ${c + 1}. Lorem ipsum dolor sit amet.</p>`;
    }

    html += '</article>';
  }

  return html;
};

/**
 * Создание HTML с XSS-атаками для тестирования HTMLSanitizer
 * @returns {Object} - { dirty, expectedClean }
 */
export const createXSSTestCases = () => {
  return [
    {
      name: 'script tag',
      dirty: '<script>alert("xss")</script><p>Safe</p>',
      shouldNotContain: ['<script', 'alert'],
      shouldContain: ['<p>Safe</p>'],
    },
    {
      name: 'onclick handler',
      dirty: '<p onclick="alert(1)">Click</p>',
      shouldNotContain: ['onclick'],
      shouldContain: ['<p>Click</p>'],
    },
    {
      name: 'javascript URL',
      dirty: '<a href="javascript:alert(1)">Link</a>',
      shouldNotContain: ['javascript:'],
    },
    {
      name: 'data URL',
      dirty: '<img src="data:text/html,<script>alert(1)</script>">',
      shouldNotContain: ['data:'],
    },
    {
      name: 'iframe',
      dirty: '<iframe src="https://evil.com"></iframe><p>OK</p>',
      shouldNotContain: ['<iframe'],
      shouldContain: ['<p>OK</p>'],
    },
  ];
};
