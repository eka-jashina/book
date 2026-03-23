/**
 * INTEGRATION TEST UTILITIES
 * Хелперы для интеграционных тестов Flipbook
 *
 * В отличие от unit-тестов, интеграционные тесты используют
 * реальные компоненты (не моки) для проверки взаимодействия.
 */

import { vi } from 'vitest';
import { createSizedElement, flushPromises, advanceTimersAndFlush } from './testUtils.js';

// ═══════════════════════════════════════════════════════════════════════════
// DOM SETUP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создание полной DOM-структуры книги для интеграционных тестов
 * Включает все элементы, которые ожидает DOMManager
 *
 * @param {Object} options
 * @param {number} options.bookWidth - Ширина книги (default: 800)
 * @param {number} options.bookHeight - Высота книги (default: 600)
 * @param {number} options.pageWidth - Ширина страницы (default: 350)
 * @returns {Object} - Ссылки на созданные элементы
 */
export const createFullBookDOM = (options = {}) => {
  const {
    bookWidth = 800,
    bookHeight = 600,
    pageWidth = 350,
  } = options;

  // Очищаем существующий DOM
  document.body.innerHTML = '';

  // ─── Основной контейнер книги ───
  const book = createSizedElement(bookWidth, bookHeight);
  book.id = 'book';
  book.className = 'book';
  book.dataset.state = 'closed';

  // ─── Обложка ───
  const cover = document.createElement('div');
  cover.className = 'book-cover';
  book.appendChild(cover);

  // ─── Контейнер страниц ───
  const pages = document.createElement('div');
  pages.className = 'pages';

  // Страницы (левая сторона)
  const leftA = createSizedElement(pageWidth, bookHeight);
  leftA.id = 'leftA';
  leftA.className = 'page page-left page-a';

  const leftB = createSizedElement(pageWidth, bookHeight);
  leftB.id = 'leftB';
  leftB.className = 'page page-left page-b';

  // Страницы (правая сторона)
  const rightA = createSizedElement(pageWidth, bookHeight);
  rightA.id = 'rightA';
  rightA.className = 'page page-right page-a';

  const rightB = createSizedElement(pageWidth, bookHeight);
  rightB.id = 'rightB';
  rightB.className = 'page page-right page-b';

  pages.appendChild(leftA);
  pages.appendChild(leftB);
  pages.appendChild(rightA);
  pages.appendChild(rightB);
  book.appendChild(pages);

  // ─── Анимированный лист ───
  const sheet = document.createElement('div');
  sheet.id = 'sheet';
  sheet.className = 'sheet';

  const sheetFront = document.createElement('div');
  sheetFront.id = 'sheetFront';
  sheetFront.className = 'sheet-front';

  const sheetBack = document.createElement('div');
  sheetBack.id = 'sheetBack';
  sheetBack.className = 'sheet-back';

  sheet.appendChild(sheetFront);
  sheet.appendChild(sheetBack);
  book.appendChild(sheet);

  // ─── Индикатор загрузки ───
  const loadingIndicator = document.createElement('div');
  loadingIndicator.id = 'loadingIndicator';
  loadingIndicator.className = 'loading-indicator';
  loadingIndicator.hidden = true;
  book.appendChild(loadingIndicator);

  // ─── Контролы навигации ───
  const controls = document.createElement('div');
  controls.className = 'controls';

  const prevButton = document.createElement('button');
  prevButton.id = 'prevButton';
  prevButton.className = 'nav-button nav-prev';

  const nextButton = document.createElement('button');
  nextButton.id = 'nextButton';
  nextButton.className = 'nav-button nav-next';

  controls.appendChild(prevButton);
  controls.appendChild(nextButton);
  book.appendChild(controls);

  // ─── Прогресс-бар ───
  const progressBar = document.createElement('div');
  progressBar.id = 'progressBar';
  progressBar.className = 'progress-bar';

  const progressFill = document.createElement('div');
  progressFill.id = 'progressFill';
  progressFill.className = 'progress-fill';
  progressBar.appendChild(progressFill);

  // ─── Информация о страницах ───
  const pageInfo = document.createElement('div');
  pageInfo.id = 'pageInfo';
  pageInfo.className = 'page-info';

  const currentPage = document.createElement('span');
  currentPage.id = 'currentPage';
  currentPage.textContent = '0';

  const totalPages = document.createElement('span');
  totalPages.id = 'totalPages';
  totalPages.textContent = '0';

  pageInfo.appendChild(currentPage);
  pageInfo.appendChild(document.createTextNode(' / '));
  pageInfo.appendChild(totalPages);

  // ─── Сообщение об ошибке ───
  const errorMessage = document.createElement('div');
  errorMessage.id = 'errorMessage';
  errorMessage.className = 'error-message';
  errorMessage.hidden = true;

  const errorText = document.createElement('span');
  errorText.id = 'errorText';
  errorMessage.appendChild(errorText);

  // ─── Панель настроек ───
  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'settingsPanel';
  settingsPanel.className = 'settings-panel';

  // Селектор шрифта
  const fontSelector = document.createElement('select');
  fontSelector.id = 'fontSelector';
  ['georgia', 'merriweather', 'inter'].forEach(font => {
    const option = document.createElement('option');
    option.value = font;
    option.textContent = font;
    fontSelector.appendChild(option);
  });
  settingsPanel.appendChild(fontSelector);

  // Слайдер размера шрифта
  const fontSizeSlider = document.createElement('input');
  fontSizeSlider.id = 'fontSizeSlider';
  fontSizeSlider.type = 'range';
  fontSizeSlider.min = '14';
  fontSizeSlider.max = '22';
  fontSizeSlider.value = '18';
  settingsPanel.appendChild(fontSizeSlider);

  // Переключатель темы
  const themeToggle = document.createElement('button');
  themeToggle.id = 'themeToggle';
  themeToggle.dataset.theme = 'light';
  settingsPanel.appendChild(themeToggle);

  // ─── Аудио контролы ───
  const soundToggle = document.createElement('button');
  soundToggle.id = 'soundToggle';
  soundToggle.dataset.enabled = 'true';

  const volumeSlider = document.createElement('input');
  volumeSlider.id = 'volumeSlider';
  volumeSlider.type = 'range';
  volumeSlider.min = '0';
  volumeSlider.max = '1';
  volumeSlider.step = '0.1';
  volumeSlider.value = '0.3';

  const ambientPills = document.createElement('div');
  ambientPills.id = 'ambientPills';
  ambientPills.className = 'ambient-pills';

  // ─── Debug панель (скрыта по умолчанию) ───
  const debugPanel = document.createElement('div');
  debugPanel.id = 'debugPanel';
  debugPanel.className = 'debug-panel';
  debugPanel.hidden = true;

  // ─── Фон ───
  const background = document.createElement('div');
  background.id = 'background';
  background.className = 'background';

  // ─── Добавляем всё в document.body ───
  document.body.appendChild(background);
  document.body.appendChild(book);
  document.body.appendChild(progressBar);
  document.body.appendChild(pageInfo);
  document.body.appendChild(errorMessage);
  document.body.appendChild(settingsPanel);
  document.body.appendChild(soundToggle);
  document.body.appendChild(volumeSlider);
  document.body.appendChild(ambientPills);
  document.body.appendChild(debugPanel);

  return {
    book,
    cover,
    pages,
    leftA,
    leftB,
    rightA,
    rightB,
    sheet,
    sheetFront,
    sheetBack,
    loadingIndicator,
    prevButton,
    nextButton,
    progressBar,
    progressFill,
    pageInfo,
    currentPage,
    totalPages,
    errorMessage,
    errorText,
    settingsPanel,
    fontSelector,
    fontSizeSlider,
    themeToggle,
    soundToggle,
    volumeSlider,
    ambientPills,
    debugPanel,
    background,
  };
};

/**
 * Очистка DOM после интеграционного теста
 */
export const cleanupIntegrationDOM = () => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
};

// ═══════════════════════════════════════════════════════════════════════════
// STATE WAITERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ожидание перехода state machine в определённое состояние
 *
 * @param {BookStateMachine} stateMachine
 * @param {string} targetState - Целевое состояние
 * @param {number} timeout - Таймаут в мс (default: 5000)
 * @returns {Promise<void>}
 */
export const waitForState = async (stateMachine, targetState, timeout = 5000) => {
  if (stateMachine.state === targetState) {
    return;
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error(
        `Timeout waiting for state "${targetState}". Current: "${stateMachine.state}"`
      ));
    }, timeout);

    const unsubscribe = stateMachine.subscribe((newState) => {
      if (newState === targetState) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve();
      }
    });
  });
};

/**
 * Ожидание события от EventEmitter
 *
 * @param {EventEmitter} emitter
 * @param {string} eventName
 * @param {number} timeout - Таймаут в мс (default: 5000)
 * @returns {Promise<any>} - Данные события
 */
export const waitForEvent = async (emitter, eventName, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timeout waiting for event "${eventName}"`));
    }, timeout);

    const unsubscribe = emitter.on(eventName, (data) => {
      clearTimeout(timeoutId);
      unsubscribe();
      resolve(data);
    });
  });
};

/**
 * Ожидание завершения всех анимаций (по таймингам из CSS)
 * Учитывает lift + rotate + drop фазы
 *
 * @param {number} safetyMargin - Дополнительный запас времени (default: 100)
 */
export const waitForAnimations = async (safetyMargin = 100) => {
  // CSS тайминги: lift(240) + rotate(900) + drop(160) + margin
  const totalTime = 240 + 900 + 160 + safetyMargin;
  await advanceTimersAndFlush(totalTime);
};

/**
 * Ожидание завершения анимации открытия книги
 */
export const waitForOpenAnimation = async () => {
  // cover animation: 1200ms + margin
  await advanceTimersAndFlush(1400);
};

/**
 * Ожидание завершения анимации закрытия книги
 */
export const waitForCloseAnimation = async () => {
  await advanceTimersAndFlush(1400);
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создание тестового HTML контента с разметкой глав
 *
 * @param {Object} options
 * @param {number} options.chapters - Количество глав (default: 3)
 * @param {number} options.paragraphsPerChapter - Параграфов на главу (default: 10)
 * @returns {string} HTML-контент
 */
export const createChapterContent = (options = {}) => {
  const { chapters = 3, paragraphsPerChapter = 10 } = options;

  let html = '';

  for (let c = 0; c < chapters; c++) {
    html += `<article data-chapter="${c}">`;
    html += `<h2>Глава ${c + 1}</h2>`;

    for (let p = 0; p < paragraphsPerChapter; p++) {
      html += `<p>Параграф ${p + 1} главы ${c + 1}. `;
      html += 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
      html += 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>';
    }

    html += '</article>';
  }

  return html;
};

/**
 * Настройка мока fetch для возврата тестового контента
 *
 * @param {string|Function} content - HTML или функция (url) => html
 */
export const setupFetchMock = (content) => {
  global.fetch = vi.fn().mockImplementation((url) => {
    const html = typeof content === 'function' ? content(url) : content;

    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(html),
    });
  });
};

/**
 * Настройка мока fetch для симуляции ошибки
 *
 * @param {number} status - HTTP статус (default: 500)
 * @param {string} message - Сообщение ошибки
 */
export const setupFetchError = (status = 500, message = 'Server Error') => {
  global.fetch = vi.fn().mockImplementation(() => {
    return Promise.resolve({
      ok: false,
      status,
      statusText: message,
    });
  });
};

/**
 * Настройка мока fetch для симуляции сетевой ошибки
 */
export const setupNetworkError = () => {
  global.fetch = vi.fn().mockImplementation(() => {
    return Promise.reject(new Error('Network error'));
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// USER ACTION SIMULATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Симуляция клика на кнопку "следующая страница"
 *
 * @param {HTMLElement} nextButton
 */
export const clickNext = async (nextButton) => {
  nextButton.click();
  await flushPromises();
};

/**
 * Симуляция клика на кнопку "предыдущая страница"
 *
 * @param {HTMLElement} prevButton
 */
export const clickPrev = async (prevButton) => {
  prevButton.click();
  await flushPromises();
};

/**
 * Симуляция нажатия клавиши
 *
 * @param {string} key - Код клавиши (ArrowRight, ArrowLeft, Home, End)
 * @param {Object} options - Дополнительные опции (ctrlKey, etc.)
 */
export const pressKey = async (key, options = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  document.dispatchEvent(event);
  await flushPromises();
};

/**
 * Симуляция клика на обложку книги (открытие)
 *
 * @param {HTMLElement} cover
 */
export const clickCover = async (cover) => {
  cover.click();
  await flushPromises();
};

/**
 * Симуляция изменения настройки шрифта
 *
 * @param {HTMLSelectElement} selector
 * @param {string} fontName
 */
export const changeFont = async (selector, fontName) => {
  selector.value = fontName;
  selector.dispatchEvent(new Event('change', { bubbles: true }));
  await flushPromises();
};

/**
 * Симуляция изменения размера шрифта
 *
 * @param {HTMLInputElement} slider
 * @param {number} size
 */
export const changeFontSize = async (slider, size) => {
  slider.value = String(size);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  await flushPromises();
};

// ═══════════════════════════════════════════════════════════════════════════
// ASSERTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Проверка, что книга находится в определённом состоянии
 *
 * @param {HTMLElement} book - Элемент книги
 * @param {string} expectedState - Ожидаемое состояние (closed, opened, etc.)
 */
export const expectBookState = (book, expectedState) => {
  expect(book.dataset.state).toBe(expectedState);
};

/**
 * Проверка отображаемой страницы
 *
 * @param {HTMLElement} currentPageElement
 * @param {number} expectedPage
 */
export const expectCurrentPage = (currentPageElement, expectedPage) => {
  expect(currentPageElement.textContent).toBe(String(expectedPage));
};

/**
 * Проверка, что индикатор загрузки скрыт
 *
 * @param {HTMLElement} loadingIndicator
 */
export const expectLoadingHidden = (loadingIndicator) => {
  expect(loadingIndicator.hidden).toBe(true);
};

/**
 * Проверка, что индикатор загрузки виден
 *
 * @param {HTMLElement} loadingIndicator
 */
export const expectLoadingVisible = (loadingIndicator) => {
  expect(loadingIndicator.hidden).toBe(false);
};
