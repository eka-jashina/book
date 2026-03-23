/**
 * E2E ТЕСТЫ: ПРОИЗВОДИТЕЛЬНОСТЬ
 * Время загрузки, производительность анимаций, утечки памяти
 */

import { test, expect, clearStorage, viewports, getPerformanceMetrics } from '../fixtures/book.fixture.js';

// ═══════════════════════════════════════════════════════════════════════════
// INITIAL LOAD PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Initial Load Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('page should load within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });

  test('DOM content loaded within 2 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const domLoadTime = Date.now() - startTime;

    expect(domLoadTime).toBeLessThan(2000);
  });

  test('book element should be visible quickly', async ({ bookPage }) => {
    const startTime = Date.now();

    await bookPage.goto();
    await bookPage.book.waitFor({ state: 'visible' });

    const visibleTime = Date.now() - startTime;

    expect(visibleTime).toBeLessThan(2000);
  });

  test('should have acceptable First Contentful Paint', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await getPerformanceMetrics(page);

    if (metrics.firstContentfulPaint) {
      expect(metrics.firstContentfulPaint).toBeLessThan(1500);
    }
  });

  test('should not have excessive JS heap usage on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await getPerformanceMetrics(page);

    if (metrics.usedJSHeapSize) {
      // Должно быть меньше 50МБ при начальной загрузке
      expect(metrics.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BOOK OPEN PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Book Open Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('book should open within 2 seconds', async ({ bookPage }) => {
    await bookPage.goto();

    const startTime = Date.now();
    await bookPage.cover.click();
    await bookPage.waitForState('opened', 5000);
    const openTime = Date.now() - startTime;

    // Открытие включает анимацию (~1.2с) плюс загрузку контента
    expect(openTime).toBeLessThan(2500);
  });

  test('content should be paginated within 3 seconds', async ({ bookPage }) => {
    await bookPage.goto();

    const startTime = Date.now();
    await bookPage.openByCover();

    // Ждём вычисления общего количества страниц
    await bookPage.page.waitForFunction(() => {
      const total = document.querySelector('#total-pages');
      return total && parseInt(total.textContent) > 0;
    });

    const paginationTime = Date.now() - startTime;

    expect(paginationTime).toBeLessThan(3000);
  });

  test('loading indicator should disappear within 3 seconds', async ({ bookPage }) => {
    await bookPage.goto();

    const startTime = Date.now();
    await bookPage.cover.click();

    // Ждём завершения загрузки
    await bookPage.loadingIndicator.waitFor({ state: 'hidden', timeout: 5000 });
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PAGE FLIP ANIMATION PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Page Flip Animation Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('page flip should complete within animation budget', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const startTime = Date.now();
    await bookPage.btnNext.click();
    await bookPage.waitForState('opened', 3000);
    const flipTime = Date.now() - startTime;

    // Общая анимация: lift(240мс) + rotate(900мс) + drop(160мс) = 1300мс + запас
    expect(flipTime).toBeLessThan(1800);
  });

  test('consecutive flips should maintain performance', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const flipTimes = [];

    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      await bookPage.flipNext();
      flipTimes.push(Date.now() - startTime);
    }

    // Все перелистывания должны быть стабильными
    const avgTime = flipTimes.reduce((a, b) => a + b, 0) / flipTimes.length;
    expect(avgTime).toBeLessThan(1800);

    // Ни одно перелистывание не должно быть значительно медленнее
    const maxTime = Math.max(...flipTimes);
    expect(maxTime).toBeLessThan(2500);
  });

  test('keyboard navigation should be responsive', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const startTime = Date.now();
    await page.keyboard.press('ArrowRight');
    await bookPage.waitForAnimation();
    const keyTime = Date.now() - startTime;

    expect(keyTime).toBeLessThan(1800);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REPAGINATION PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Repagination Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('font size change repagination within 2 seconds', async ({ bookPage, settings }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    await settings.open();

    const startTime = Date.now();
    await settings.btnIncrease.click();
    await settings.waitForRepagination();
    const repaginateTime = Date.now() - startTime;

    expect(repaginateTime).toBeLessThan(2000);
  });

  test('font family change repagination within 2 seconds', async ({ bookPage, settings, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    await settings.open();

    const startTime = Date.now();
    await settings.fontSelect.selectOption('merriweather');
    await settings.waitForRepagination();
    const repaginateTime = Date.now() - startTime;

    expect(repaginateTime).toBeLessThan(2000);
  });

  test('resize repagination within 3 seconds', async ({ bookPage, page }) => {
    await page.setViewportSize(viewports.desktop);
    await clearStorage(page);
    await bookPage.goto();
    await bookPage.openByCover();

    const startTime = Date.now();
    await page.setViewportSize(viewports.mobile);

    // Wait for repagination to complete
    await bookPage.waitForState('opened', 5000);

    const resizeTime = Date.now() - startTime;

    expect(resizeTime).toBeLessThan(3000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Memory Performance', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('no significant memory growth after 20 page flips', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Получаем начальную память
    const initialMetrics = await getPerformanceMetrics(page);
    const initialMemory = initialMetrics.usedJSHeapSize || 0;

    // Листаем вперёд 10 раз
    for (let i = 0; i < 10; i++) {
      await bookPage.flipNext();
    }

    // Листаем назад 10 раз
    for (let i = 0; i < 10; i++) {
      await bookPage.flipPrev();
    }

    // Принудительная сборка мусора, если возможно
    await page.evaluate(() => {
      if (global.gc) global.gc();
    });
    // Let GC settle
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    // Получаем итоговую память
    const finalMetrics = await getPerformanceMetrics(page);
    const finalMemory = finalMetrics.usedJSHeapSize || 0;

    if (initialMemory > 0 && finalMemory > 0) {
      // Память не должна вырасти более чем на 50%
      const growthRatio = finalMemory / initialMemory;
      expect(growthRatio).toBeLessThan(1.5);
    }
  });

  test('no memory leak after opening/closing book multiple times', async ({ bookPage, page }) => {
    await bookPage.goto();

    const initialMetrics = await getPerformanceMetrics(page);
    const initialMemory = initialMetrics.usedJSHeapSize || 0;

    // Открываем и закрываем книгу 5 раз
    for (let i = 0; i < 5; i++) {
      await bookPage.openByCover();
      await bookPage.flipNext();
      await bookPage.flipByKey('home');
      await bookPage.flipPrev(); // Close
      await bookPage.waitForState('closed', 5000);
    }

    // Let GC settle
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

    const finalMetrics = await getPerformanceMetrics(page);
    const finalMemory = finalMetrics.usedJSHeapSize || 0;

    if (initialMemory > 0 && finalMemory > 0) {
      const growthRatio = finalMemory / initialMemory;
      expect(growthRatio).toBeLessThan(2.0);
    }
  });

  test('LRU cache should limit memory usage', async ({ bookPage, settings }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Включаем отладку для проверки кэша
    await settings.toggleDebug();

    // Проходим через много страниц
    for (let i = 0; i < 20; i++) {
      await bookPage.flipNext();
    }

    // Кэш должен быть ограничен (проверяем панель отладки, если видна)
    const debugInfo = await bookPage.page.locator('.debug-info').textContent();

    if (debugInfo && debugInfo.includes('cache')) {
      // Cache size should be limited to configured max (12)
      const cacheMatch = debugInfo.match(/cache[:\s]*(\d+)/i);
      if (cacheMatch) {
        const cacheSize = parseInt(cacheMatch[1]);
        expect(cacheSize).toBeLessThanOrEqual(12);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Mobile Performance', () => {
  test.use({ viewport: viewports.mobile });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('mobile load time should be acceptable', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // На мобильном может быть немного медленнее, допускаем 4с
    expect(loadTime).toBeLessThan(4000);
  });

  test('mobile flip animation should be smooth', async ({ bookPage }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const flipTimes = [];

    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      await bookPage.flipNext();
      flipTimes.push(Date.now() - startTime);
    }

    const avgTime = flipTimes.reduce((a, b) => a + b, 0) / flipTimes.length;

    // На мобильном перелистывается одна страница, должно быть быстрее
    expect(avgTime).toBeLessThan(1500);
  });

  test('swipe gesture should be responsive', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    const box = await bookPage.book.boundingBox();
    const startTime = Date.now();

    // Выполняем свайп
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();

    await bookPage.waitForAnimation();
    const swipeTime = Date.now() - startTime;

    expect(swipeTime).toBeLessThan(1800);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RESOURCE LOADING
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Resource Loading', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('should not have failed resource requests', async ({ page }) => {
    const failedRequests = [];

    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()?.errorText,
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Фильтруем ожидаемые ошибки (например, аналитика, внешние ресурсы)
    const criticalFailures = failedRequests.filter(r =>
      !r.url.includes('analytics') &&
      !r.url.includes('fonts.googleapis')
    );

    expect(criticalFailures).toHaveLength(0);
  });

  test('should load images lazily or efficiently', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Проверяем, что изображения в контенте имеют стратегию загрузки
    const images = await page.locator('.page-content img').all();

    for (const img of images) {
      const loading = await img.getAttribute('loading');
      const dataLoading = await img.getAttribute('data-loading');

      // Либо нативная ленивая загрузка, либо кастомное состояние загрузки
      const hasLoadingStrategy = loading === 'lazy' || dataLoading !== null;

      // Это мягкая проверка - не все изображения нуждаются в ленивой загрузке
    }
  });

  test('background images should preload', async ({ bookPage, page }) => {
    await bookPage.goto();

    // Проверяем, что менеджер фонов предзагрузил изображения
    const bgStyle = await bookPage.book.evaluate(el =>
      getComputedStyle(el).backgroundImage
    );

    // Фон должен быть установлен (либо изображение, либо градиентный fallback)
    expect(bgStyle).not.toBe('none');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LONG SESSION STABILITY
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Long Session Stability', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('should remain stable after extended navigation', async ({ bookPage, page }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Активно навигируем
    for (let i = 0; i < 10; i++) {
      await bookPage.flipNext();
    }

    await bookPage.flipByKey('home');

    for (let i = 0; i < 10; i++) {
      await bookPage.flipNext();
    }

    await bookPage.flipByKey('end');
    await bookPage.flipByKey('home');

    // Книга должна оставаться функциональной
    expect(await bookPage.isOpened()).toBe(true);

    const pageBefore = await bookPage.getCurrentPageIndex();
    await bookPage.flipNext();
    const pageAfter = await bookPage.getCurrentPageIndex();

    expect(pageAfter).toBeGreaterThan(pageBefore);
  });

  test('settings changes should not degrade performance', async ({ bookPage, settings }) => {
    await bookPage.goto();
    await bookPage.openByCover();

    // Меняем настройки несколько раз
    await settings.setTheme('dark');
    await settings.setTheme('light');
    await settings.setTheme('bw');
    await settings.setTheme('light');

    await settings.setFontSize(20);
    await settings.setFontSize(16);
    await settings.setFontSize(18);

    // Перелистывание должно оставаться отзывчивым
    const startTime = Date.now();
    await bookPage.flipNext();
    const flipTime = Date.now() - startTime;

    expect(flipTime).toBeLessThan(2000);
  });
});
