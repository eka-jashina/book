/**
 * VITEST SETUP
 * Глобальные моки и настройки для тестового окружения Flipbook
 */

/* global vi, beforeEach, afterEach */
import { initI18n } from '@i18n';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK: localStorage
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создаёт мок localStorage с отслеживанием вызовов
 */
const createLocalStorageMock = () => {
  let store = {};

  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index) => Object.keys(store)[index] ?? null),

    // Вспомогательный метод для тестов — доступ к внутреннему хранилищу
    __getStore: () => store,
    __setStore: (newStore) => {
      store = { ...newStore };
    },
  };
};

const localStorageMock = createLocalStorageMock();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCK: sessionStorage
// ═══════════════════════════════════════════════════════════════════════════

const sessionStorageMock = createLocalStorageMock();

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCK: CSS Custom Properties (getComputedStyle)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Значения CSS переменных по умолчанию (из css/variables.css)
 */
const cssVariableDefaults = {
  // Тайминги анимаций
  '--timing-lift': '240ms',
  '--timing-rotate': '900ms',
  '--timing-drop': '160ms',
  '--timing-cover': '1200ms',
  '--timing-settings': '300ms',

  // Размеры и отступы
  '--font-default': '18px',
  '--swipe-threshold': '20px',
  '--perspective': '1600px',

  // Пагинация
  '--pages-per-flip': '2',

  // Цвета (для тестов тем)
  '--bg-page': '#fdfcf8',
  '--text-main': '#1f1f1f',
  '--bg-primary': '#f5f5f5',
};

/**
 * Позволяет переопределить CSS переменные в тестах
 */
let cssVariableOverrides = {};

global.__setCSSVariable = (name, value) => {
  cssVariableOverrides[name] = value;
};

global.__resetCSSVariables = () => {
  cssVariableOverrides = {};
};

const originalGetComputedStyle = global.getComputedStyle;

global.getComputedStyle = vi.fn((element) => {
  // Если это реальный элемент в jsdom, используем оригинал для обычных свойств
  const original = originalGetComputedStyle?.(element) || {};

  return {
    ...original,
    getPropertyValue: vi.fn((prop) => {
      // Сначала проверяем переопределения
      if (prop in cssVariableOverrides) {
        return cssVariableOverrides[prop];
      }
      // Затем значения по умолчанию
      if (prop in cssVariableDefaults) {
        return cssVariableDefaults[prop];
      }
      // Для остальных свойств возвращаем пустую строку
      return '';
    }),
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCK: requestAnimationFrame / cancelAnimationFrame
// ═══════════════════════════════════════════════════════════════════════════

let rafId = 0;
const rafCallbacks = new Map();

global.requestAnimationFrame = vi.fn((callback) => {
  rafId++;
  const id = rafId;

  // Симулируем асинхронный вызов через setTimeout
  const timeoutId = setTimeout(() => {
    rafCallbacks.delete(id);
    callback(performance.now());
  }, 16); // ~60fps

  rafCallbacks.set(id, timeoutId);
  return id;
});

global.cancelAnimationFrame = vi.fn((id) => {
  const timeoutId = rafCallbacks.get(id);
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId);
    rafCallbacks.delete(id);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCK: matchMedia (для MediaQueryManager)
// ═══════════════════════════════════════════════════════════════════════════

const mediaQueryListeners = new Map();

/**
 * Позволяет симулировать изменение media query в тестах
 */
global.__setMediaQuery = (query, matches) => {
  const listeners = mediaQueryListeners.get(query) || [];
  listeners.forEach((listener) => {
    listener({ matches, media: query });
  });
};

global.matchMedia = vi.fn((query) => {
  // По умолчанию desktop (не mobile)
  const defaultMatches = {
    '(max-width: 768px)': false,
    '(max-width: 1024px)': false,
    '(prefers-color-scheme: dark)': false,
    '(prefers-reduced-motion: reduce)': false,
  };

  const matches = defaultMatches[query] ?? false;

  return {
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn((listener) => {
      // Устаревший метод, но нужен для совместимости
      if (!mediaQueryListeners.has(query)) {
        mediaQueryListeners.set(query, []);
      }
      mediaQueryListeners.get(query).push(listener);
    }),
    removeListener: vi.fn((listener) => {
      const listeners = mediaQueryListeners.get(query) || [];
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }),
    addEventListener: vi.fn((event, listener) => {
      if (event === 'change') {
        if (!mediaQueryListeners.has(query)) {
          mediaQueryListeners.set(query, []);
        }
        mediaQueryListeners.get(query).push(listener);
      }
    }),
    removeEventListener: vi.fn((event, listener) => {
      if (event === 'change') {
        const listeners = mediaQueryListeners.get(query) || [];
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }),
    dispatchEvent: vi.fn(),
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCK: Audio (для SoundManager)
// ═══════════════════════════════════════════════════════════════════════════

global.Audio = vi.fn().mockImplementation((src) => {
  const audio = {
    src: src || '',
    volume: 1,
    currentTime: 0,
    duration: 0,
    paused: true,
    ended: false,
    loop: false,
    muted: false,

    // Обработчики событий
    _listeners: {},

    play: vi.fn().mockImplementation(() => {
      audio.paused = false;
      return Promise.resolve();
    }),

    pause: vi.fn().mockImplementation(() => {
      audio.paused = true;
    }),

    load: vi.fn(),

    addEventListener: vi.fn((event, handler) => {
      if (!audio._listeners[event]) {
        audio._listeners[event] = [];
      }
      audio._listeners[event].push(handler);
    }),

    removeEventListener: vi.fn((event, handler) => {
      if (audio._listeners[event]) {
        const index = audio._listeners[event].indexOf(handler);
        if (index > -1) {
          audio._listeners[event].splice(index, 1);
        }
      }
    }),

    // Вспомогательный метод для симуляции событий в тестах
    __emit: (event, data = {}) => {
      const handlers = audio._listeners[event] || [];
      handlers.forEach((h) => h(data));
    },
  };

  return audio;
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCK: fetch (для ContentLoader)
// ═══════════════════════════════════════════════════════════════════════════

global.fetch = vi.fn().mockImplementation((url) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve('<article><h2>Test Chapter</h2><p>Content</p></article>'),
    json: () => Promise.resolve({}),
    headers: new Headers(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOCK: ResizeObserver
// ═══════════════════════════════════════════════════════════════════════════

global.ResizeObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ═══════════════════════════════════════════════════════════════════════════
// MOCK: IntersectionObserver
// ═══════════════════════════════════════════════════════════════════════════

global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS: Очистка между тестами
// ═══════════════════════════════════════════════════════════════════════════

beforeEach(async () => {
  // Инициализируем i18n (русский язык по умолчанию для тестов)
  await initI18n('ru');

  // Очищаем все моки
  vi.clearAllMocks();

  // Сбрасываем localStorage
  localStorageMock.clear();
  localStorageMock.__setStore({});

  // Сбрасываем sessionStorage
  sessionStorageMock.clear();
  sessionStorageMock.__setStore({});

  // Сбрасываем CSS переменные
  cssVariableOverrides = {};

  // Очищаем RAF callbacks
  rafCallbacks.forEach((timeoutId) => clearTimeout(timeoutId));
  rafCallbacks.clear();
  rafId = 0;

  // Очищаем media query listeners
  mediaQueryListeners.clear();

  // Очищаем DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

afterEach(() => {
  // Восстанавливаем моки
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// CONSOLE SUPPRESSION (опционально)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Подавление console.warn и console.error в тестах
 * Включите при необходимости для чистого вывода
 */
// vi.spyOn(console, 'warn').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT: Вспомогательные утилиты
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ожидание выполнения всех промисов в очереди
 */
export const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Продвижение таймеров и ожидание промисов
 */
export const advanceTimersAndFlush = async (ms) => {
  vi.advanceTimersByTime(ms);
  await flushPromises();
};

/**
 * Создание DOM-элемента с заданными размерами
 */
export const createSizedElement = (width, height, tag = 'div') => {
  const element = document.createElement(tag);

  // jsdom не поддерживает реальные размеры, используем моки
  Object.defineProperties(element, {
    clientWidth: { value: width, configurable: true },
    clientHeight: { value: height, configurable: true },
    offsetWidth: { value: width, configurable: true },
    offsetHeight: { value: height, configurable: true },
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
      }),
      configurable: true,
    },
  });

  return element;
};
