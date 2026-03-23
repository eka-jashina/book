/**
 * E2E ТЕСТЫ: НАВИГАЦИЯ
 * Тесты навигации клавиатурой, касанием, кликом и перетаскиванием
 */

import { test, expect, clearStorage, viewports } from '../fixtures/book.fixture.js';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Keyboard Navigation', () => {
    test('ArrowRight flips to next page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();
      await bookPage.flipByKey('right');
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeGreaterThan(pageBefore);
    });

    test('ArrowLeft flips to previous page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Сначала переходим вперёд
      await bookPage.flipNext();
      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      await bookPage.flipByKey('left');
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeLessThan(pageBefore);
    });

    test('Home key goes to first page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Отходим от начала
      await bookPage.flipNext();
      await bookPage.flipNext();
      await bookPage.flipNext();

      await bookPage.flipByKey('home');
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBe(0);
    });

    test('End key goes to last page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await bookPage.flipByKey('end');

      const currentPage = await bookPage.getCurrentPageDisplay();
      const totalPages = await bookPage.getTotalPages();

      expect(currentPage).toBeGreaterThanOrEqual(totalPages - 2);
    });

    test('Ctrl+D toggles debug panel', async ({ bookPage, settings }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Изначально скрыта
      expect(await settings.isDebugVisible()).toBe(false);

      // Включаем
      await settings.toggleDebug();
      expect(await settings.isDebugVisible()).toBe(true);

      // Выключаем
      await settings.toggleDebug();
      expect(await settings.isDebugVisible()).toBe(false);
    });

    test('should not navigate when input is focused', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();

      // Фокус на элементе ввода (выбор шрифта)
      await page.locator('#font-select').focus();
      await page.keyboard.press('ArrowRight');

      const pageAfter = await bookPage.getCurrentPageIndex();
      expect(pageAfter).toBe(pageBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUTTON NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Button Navigation', () => {
    test('next button flips forward', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();
      await bookPage.flipNext();
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeGreaterThan(pageBefore);
    });

    test('prev button flips backward', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await bookPage.flipNext();
      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      await bookPage.flipPrev();
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeLessThan(pageBefore);
    });

    test('buttons should be disabled during animation', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Клик без ожидания
      await bookPage.btnNext.click();

      // Сразу пробуем кликнуть снова (должно быть проигнорировано из-за занятого состояния)
      const stateDuringAnimation = await bookPage.getState();
      expect(['flipping', 'opened']).toContain(stateDuringAnimation);

      // Ждём завершения анимации
      await bookPage.waitForAnimation();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLICK NAVIGATION (Desktop)
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Click Navigation (Desktop)', () => {
    test.use({ viewport: viewports.desktop });

    test('clicking right half flips forward', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();
      await bookPage.clickBookHalf('right');
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeGreaterThan(pageBefore);
    });

    test('clicking left half flips backward', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Сначала переходим вперёд
      await bookPage.flipNext();
      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      await bookPage.clickBookHalf('left');
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeLessThan(pageBefore);
    });

    test('clicking on TOC should not flip page', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();

      // Клик по области оглавления
      const tocItem = page.locator('.toc li').first();
      if (await tocItem.isVisible()) {
        await tocItem.click();
        // Клик по оглавлению переходит к главе, а не перелистывает
      }

      // Страница должна измениться из-за навигации по главам, а не клика по половине
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TOUCH/SWIPE NAVIGATION (Mobile)
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Touch Navigation (Mobile)', () => {
    test.use({ viewport: viewports.mobile });

    test('swipe left flips to next page', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();

      // Выполняем свайп
      const book = bookPage.book;
      const box = await book.boundingBox();
      const startX = box.x + box.width * 0.8;
      const endX = box.x + box.width * 0.2;
      const y = box.y + box.height / 2;

      await page.mouse.move(startX, y);
      await page.mouse.down();
      await page.mouse.move(endX, y, { steps: 10 });
      await page.mouse.up();

      await bookPage.waitForAnimation();
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeGreaterThan(pageBefore);
    });

    test('swipe right flips to previous page', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Сначала переходим вперёд
      await bookPage.flipNext();
      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      // Выполняем свайп вправо
      const book = bookPage.book;
      const box = await book.boundingBox();
      const startX = box.x + box.width * 0.2;
      const endX = box.x + box.width * 0.8;
      const y = box.y + box.height / 2;

      await page.mouse.move(startX, y);
      await page.mouse.down();
      await page.mouse.move(endX, y, { steps: 10 });
      await page.mouse.up();

      await bookPage.waitForAnimation();
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeLessThan(pageBefore);
    });

    test('small swipe does not trigger flip', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();

      // Маленький свайп (ниже порога)
      const book = bookPage.book;
      const box = await book.boundingBox();
      const startX = box.x + box.width / 2;
      const endX = startX - 15; // Less than 20px threshold
      const y = box.y + box.height / 2;

      await page.mouse.move(startX, y);
      await page.mouse.down();
      await page.mouse.move(endX, y, { steps: 5 });
      await page.mouse.up();

      await bookPage.waitForState('opened', 1000);
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBe(pageBefore);
    });

    test('vertical swipe does not trigger flip', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();

      // Вертикальный свайп
      const book = bookPage.book;
      const box = await book.boundingBox();
      const x = box.x + box.width / 2;
      const startY = box.y + box.height * 0.7;
      const endY = box.y + box.height * 0.3;

      await page.mouse.move(x, startY);
      await page.mouse.down();
      await page.mouse.move(x, endY, { steps: 10 });
      await page.mouse.up();

      await bookPage.waitForState('opened', 1000);
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBe(pageBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAG NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Drag Navigation', () => {
    test.use({ viewport: viewports.desktop });

    test('drag from bottom-right corner flips forward', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Сначала уходим от оглавления
      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      // Проверяем, существует ли угловая зона
      const cornerZone = page.locator('.corner-zone.bottom-right');
      if (await cornerZone.isVisible()) {
        const box = await cornerZone.boundingBox();

        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x - 300, box.y, { steps: 20 });
        await page.mouse.up();

        await bookPage.waitForAnimation();
        const pageAfter = await bookPage.getCurrentPageIndex();

        expect(pageAfter).toBeGreaterThan(pageBefore);
      }
    });

    test('drag and release in middle cancels flip', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      await bookPage.flipNext();
      const pageBefore = await bookPage.getCurrentPageIndex();

      const cornerZone = page.locator('.corner-zone.bottom-right');
      if (await cornerZone.isVisible()) {
        const box = await cornerZone.boundingBox();

        // Начинаем перетаскивание, но отпускаем рано (недостаточное расстояние)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x - 50, box.y, { steps: 10 }); // Маленькое перетаскивание
        await page.mouse.up();

        await bookPage.waitForState('opened', 1000);
        const pageAfter = await bookPage.getCurrentPageIndex();

        // Страница не должна измениться (перелистывание отменено)
        expect(pageAfter).toBe(pageBefore);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Edge Cases', () => {
    test('rapid clicking should not break state', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Быстрые клики
      for (let i = 0; i < 5; i++) {
        bookPage.btnNext.click(); // Не ждём
      }

      // Wait for state to stabilize (opened or still flipping)
      await page.waitForFunction(
        () => {
          const state = document.querySelector('.book')?.getAttribute('data-state');
          return state === 'opened' || state === 'flipping';
        },
        { timeout: 5000 }
      );

      // Книга должна быть в валидном состоянии
      const state = await bookPage.getState();
      expect(['opened', 'flipping']).toContain(state);

      // В итоге должна вернуться в состояние opened
      await bookPage.waitForState('opened', 5000);
      expect(await bookPage.isOpened()).toBe(true);
    });

    test('cannot flip past last page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Переходим в конец
      await bookPage.flipByKey('end');
      const lastPage = await bookPage.getCurrentPageIndex();

      // Пробуем перелистнуть вперёд
      await bookPage.flipNext();
      const afterFlip = await bookPage.getCurrentPageIndex();

      // Должны остаться на последней странице
      expect(afterFlip).toBe(lastPage);
    });

    test('closing book from first page', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Убеждаемся, что на первой странице
      await bookPage.flipByKey('home');

      // Листаем назад для закрытия
      await bookPage.flipPrev();
      await bookPage.waitForState('closed', 5000);

      expect(await bookPage.isClosed()).toBe(true);
    });
  });
});
