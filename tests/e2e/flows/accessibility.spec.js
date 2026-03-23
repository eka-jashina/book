/**
 * E2E ТЕСТЫ: ДОСТУПНОСТЬ (Accessibility)
 * Автоматические проверки WCAG с axe-core и ручные проверки
 * skip-link, клавиатурной навигации, ARIA-атрибутов, фокуса
 */

import AxeBuilder from '@axe-core/playwright';
import { test, expect, clearStorage, viewports } from '../fixtures/book.fixture.js';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AXE-CORE AUTOMATED WCAG AUDIT
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Axe-core WCAG Audit', () => {
    test('closed book page has no critical accessibility violations', async ({ bookPage }) => {
      await bookPage.goto();

      const results = await new AxeBuilder({ page: bookPage.page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const critical = results.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(critical, formatViolations(critical)).toHaveLength(0);
    });

    test('opened book page has no critical accessibility violations', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const results = await new AxeBuilder({ page: bookPage.page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const critical = results.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(critical, formatViolations(critical)).toHaveLength(0);
    });

    test('settings panel has no critical accessibility violations', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Открываем настройки
      const settingsCheckbox = page.locator('#settings-checkbox');
      await settingsCheckbox.click();
      await page.locator('.settings-pod').waitFor({ state: 'visible', timeout: 1000 });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const critical = results.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(critical, formatViolations(critical)).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SKIP NAVIGATION LINK
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Skip Navigation', () => {
    test('skip link is present and hidden by default', async ({ bookPage, page }) => {
      await bookPage.goto();

      const skipLink = page.locator('.skip-link');
      await expect(skipLink).toBeAttached();

      // Ссылка скрыта визуально (top: -100%)
      const box = await skipLink.boundingBox();
      expect(box.y).toBeLessThan(0);
    });

    test('skip link becomes visible on focus', async ({ bookPage, page }) => {
      await bookPage.goto();

      // Tab для фокуса на skip-link
      await page.keyboard.press('Tab');

      const skipLink = page.locator('.skip-link');
      await expect(skipLink).toBeFocused();

      // Ссылка должна стать видимой
      const box = await skipLink.boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(0);
    });

    test('skip link points to book region', async ({ bookPage, page }) => {
      await bookPage.goto();

      const skipLink = page.locator('.skip-link');
      const href = await skipLink.getAttribute('href');

      expect(href).toBe('#book');

      // Целевой элемент существует
      const target = page.locator(href);
      await expect(target).toBeAttached();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ARIA ATTRIBUTES
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('ARIA Attributes', () => {
    test('book region has correct ARIA role and label', async ({ bookPage, page }) => {
      await bookPage.goto();

      const book = page.locator('#book');
      await expect(book).toHaveAttribute('role', 'region');
      await expect(book).toHaveAttribute('aria-label', 'Книга');
    });

    test('cover has button role and label', async ({ bookPage, page }) => {
      await bookPage.goto();

      const cover = page.locator('#cover');
      await expect(cover).toHaveAttribute('role', 'button');
      await expect(cover).toHaveAttribute('aria-label', 'Открыть книгу');
      await expect(cover).toHaveAttribute('tabindex', '0');
    });

    test('navigation buttons have accessible labels', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const prevBtn = page.locator('#prev');
      const nextBtn = page.locator('#next');

      await expect(prevBtn).toHaveAttribute('aria-label', 'Предыдущая страница');
      await expect(nextBtn).toHaveAttribute('aria-label', 'Следующая страница');
    });

    test('progress bar has correct ARIA attributes', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const progressBar = page.locator('#reading-progress');
      await expect(progressBar).toHaveAttribute('role', 'progressbar');
      await expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      await expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      await expect(progressBar).toHaveAttribute('aria-label', 'Прогресс чтения');

      // aria-valuenow должно быть числом
      const valuenow = await progressBar.getAttribute('aria-valuenow');
      expect(Number(valuenow)).toBeGreaterThanOrEqual(0);
    });

    test('theme selector has radiogroup role', async ({ bookPage, page }) => {
      await bookPage.goto();

      const themeGroup = page.locator('.theme-segmented');
      await expect(themeGroup).toHaveAttribute('role', 'radiogroup');
      await expect(themeGroup).toHaveAttribute('aria-label', 'Выбор темы');

      // Каждая тема — radio
      const segments = page.locator('.theme-segment');
      const count = await segments.count();

      for (let i = 0; i < count; i++) {
        await expect(segments.nth(i)).toHaveAttribute('role', 'radio');
      }
    });

    test('only one theme radio is checked at a time', async ({ bookPage, page }) => {
      await bookPage.goto();

      const segments = page.locator('.theme-segment');
      const count = await segments.count();

      let checkedCount = 0;
      for (let i = 0; i < count; i++) {
        const checked = await segments.nth(i).getAttribute('aria-checked');
        if (checked === 'true') checkedCount++;
      }

      expect(checkedCount).toBe(1);
    });

    test('ambient pills have radiogroup role', async ({ bookPage, page }) => {
      await bookPage.goto();

      const ambientGroup = page.locator('.ambient-pills');
      await expect(ambientGroup).toHaveAttribute('role', 'radiogroup');
      await expect(ambientGroup).toHaveAttribute('aria-label', 'Выбор фоновой музыки');
    });

    test('page counter has live region', async ({ bookPage, page }) => {
      await bookPage.goto();

      const counter = page.locator('.page-counter');
      await expect(counter).toHaveAttribute('role', 'status');
      await expect(counter).toHaveAttribute('aria-live', 'polite');
    });

    test('loading overlay has status role and live region', async ({ bookPage, page }) => {
      await bookPage.goto();

      const loading = page.locator('#loadingOverlay');
      await expect(loading).toHaveAttribute('role', 'status');
      await expect(loading).toHaveAttribute('aria-live', 'polite');
    });

    test('error message has alert role', async ({ bookPage, page }) => {
      await bookPage.goto();

      const error = page.locator('#errorMessage');
      await expect(error).toHaveAttribute('role', 'alert');
    });

    test('decorative SVG icons are hidden from assistive technology', async ({ bookPage, page }) => {
      await bookPage.goto();

      // SVG внутри кнопок навигации должны быть скрыты
      const navSvgs = page.locator('.nav-btn svg');
      const count = await navSvgs.count();

      for (let i = 0; i < count; i++) {
        await expect(navSvgs.nth(i)).toHaveAttribute('aria-hidden', 'true');
        await expect(navSvgs.nth(i)).toHaveAttribute('focusable', 'false');
      }
    });

    test('buffer pages are hidden from assistive technology', async ({ bookPage, page }) => {
      await bookPage.goto();

      const leftB = page.locator('#leftB');
      const rightB = page.locator('#rightB');

      await expect(leftB).toHaveAttribute('aria-hidden', 'true');
      await expect(rightB).toHaveAttribute('aria-hidden', 'true');
    });

    test('animated sheet is hidden from assistive technology', async ({ bookPage, page }) => {
      await bookPage.goto();

      const sheet = page.locator('#sheet');
      await expect(sheet).toHaveAttribute('aria-hidden', 'true');
    });

    test('settings group has correct ARIA label', async ({ bookPage, page }) => {
      await bookPage.goto();

      const settings = page.locator('.settings[role="group"]');
      await expect(settings).toHaveAttribute('aria-label', 'Настройки чтения');
    });

    test('controls aside has correct ARIA label', async ({ bookPage, page }) => {
      await bookPage.goto();

      const controls = page.locator('aside.controls');
      await expect(controls).toHaveAttribute('aria-label', 'Управление книгой');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN READER ANNOUNCER
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Screen Reader Announcer', () => {
    test('announcer element exists with correct ARIA attributes', async ({ bookPage, page }) => {
      await bookPage.goto();

      const announcer = page.locator('#sr-announcer');
      await expect(announcer).toBeAttached();
      await expect(announcer).toHaveAttribute('aria-live', 'polite');
      await expect(announcer).toHaveAttribute('aria-atomic', 'true');
      await expect(announcer).toHaveAttribute('role', 'status');
    });

    test('announcer is visually hidden but accessible', async ({ bookPage, page }) => {
      await bookPage.goto();

      const announcer = page.locator('#sr-announcer');
      await expect(announcer).toHaveClass(/sr-only/);

      // Проверяем CSS sr-only
      const styles = await announcer.evaluate(el => {
        const cs = window.getComputedStyle(el);
        return {
          position: cs.position,
          width: cs.width,
          height: cs.height,
          overflow: cs.overflow,
        };
      });

      expect(styles.position).toBe('absolute');
      expect(styles.width).toBe('1px');
      expect(styles.height).toBe('1px');
      expect(styles.overflow).toBe('hidden');
    });

    test('page navigation triggers screen reader announcement', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Перелистываем страницу
      await bookPage.flipNext();

      // Проверяем, что анонсер получил сообщение
      const announcerText = await page.locator('#sr-announcer').textContent();
      // Сообщение должно содержать номер страницы
      expect(announcerText.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Keyboard Accessibility', () => {
    test('cover can be activated with Enter key', async ({ bookPage, page }) => {
      await bookPage.goto();
      expect(await bookPage.isClosed()).toBe(true);

      // Фокусируем обложку
      const cover = page.locator('#cover');
      await cover.focus();
      await expect(cover).toBeFocused();

      // Активируем Enter
      await page.keyboard.press('Enter');
      await bookPage.waitForState('opened', 5000);

      expect(await bookPage.isOpened()).toBe(true);
    });

    test('cover can be activated with Space key', async ({ bookPage, page }) => {
      await bookPage.goto();
      expect(await bookPage.isClosed()).toBe(true);

      const cover = page.locator('#cover');
      await cover.focus();

      await page.keyboard.press('Space');
      await bookPage.waitForState('opened', 5000);

      expect(await bookPage.isOpened()).toBe(true);
    });

    test('all interactive controls are focusable with Tab', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Открываем настройки чтобы все контролы были видны
      const settingsCheckbox = page.locator('#settings-checkbox');
      await settingsCheckbox.click();
      await page.locator('.settings-pod').waitFor({ state: 'visible', timeout: 1000 });

      // Собираем все интерактивные элементы
      const focusableElements = await page.evaluate(() => {
        const elements = document.querySelectorAll(
          'button:not([hidden]):not([disabled]), ' +
          'a[href], ' +
          'input:not([hidden]):not([type="hidden"]), ' +
          'select:not([hidden]), ' +
          '[tabindex="0"]'
        );

        return Array.from(elements)
          .filter(el => {
            const style = window.getComputedStyle(el);
            const parent = el.closest('[hidden]');
            return style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   !parent;
          })
          .map(el => ({
            tag: el.tagName.toLowerCase(),
            id: el.id,
            className: el.className,
            ariaLabel: el.getAttribute('aria-label'),
          }));
      });

      // Должны быть интерактивные элементы
      expect(focusableElements.length).toBeGreaterThan(0);

      // Каждый должен иметь доступное имя
      for (const el of focusableElements) {
        const hasName = el.ariaLabel || el.id || el.tag === 'a';
        expect(hasName, `Element ${el.tag}.${el.className} missing accessible name`).toBeTruthy();
      }
    });

    test('arrow keys navigate pages when book is opened', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const pageBefore = await bookPage.getCurrentPageIndex();
      await bookPage.flipByKey('right');
      const pageAfter = await bookPage.getCurrentPageIndex();

      expect(pageAfter).toBeGreaterThan(pageBefore);
    });

    test('Home and End keys navigate to first and last pages', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // End — к последней странице
      await bookPage.flipByKey('end');
      const lastPage = await bookPage.getCurrentPageDisplay();
      const totalPages = await bookPage.getTotalPages();
      expect(lastPage).toBeGreaterThanOrEqual(totalPages - 2);

      // Home — к первой странице
      await bookPage.flipByKey('home');
      const firstPage = await bookPage.getCurrentPageIndex();
      expect(firstPage).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FOCUS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Focus Styles', () => {
    test('navigation buttons show visible focus indicator', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const nextBtn = page.locator('#next');
      await nextBtn.focus();

      // Проверяем, что стиль outline присутствует при focus-visible
      const outline = await nextBtn.evaluate(el => {
        // Принудительно добавляем :focus-visible для проверки
        el.classList.add('focus-visible');
        el.focus();
        return window.getComputedStyle(el).outlineStyle;
      });

      // Outline не должен быть 'none' (точный стиль зависит от :focus-visible поддержки)
      // Проверим через CSS rule наличие
      const hasFocusRule = await page.evaluate(() => {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.selectorText?.includes('.nav-btn:focus-visible')) {
                return true;
              }
            }
          } catch {
            // Кросс-доменные стили могут выбросить ошибку
          }
        }
        return false;
      });

      expect(hasFocusRule).toBe(true);
    });

    test('cover shows visible focus indicator', async ({ bookPage, page }) => {
      await bookPage.goto();

      const hasFocusRule = await page.evaluate(() => {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.selectorText?.includes('.cover:focus-visible')) {
                return true;
              }
            }
          } catch {
            // Кросс-доменные стили
          }
        }
        return false;
      });

      expect(hasFocusRule).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REDUCED MOTION
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Reduced Motion', () => {
    test('respects prefers-reduced-motion media query', async ({ bookPage, page }) => {
      // Эмулируем prefers-reduced-motion: reduce
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await bookPage.goto();

      const hasReducedMotionRule = await page.evaluate(() => {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSMediaRule &&
                  rule.conditionText?.includes('prefers-reduced-motion: reduce')) {
                return true;
              }
            }
          } catch {
            // Кросс-доменные стили
          }
        }
        return false;
      });

      expect(hasReducedMotionRule).toBe(true);
    });

    test('animations are disabled with reduced motion', async ({ bookPage, page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await bookPage.goto();
      await bookPage.openByCover();

      // Проверяем, что анимации выключены
      const animationDuration = await page.evaluate(() => {
        const sheet = document.querySelector('.sheet');
        if (!sheet) return null;
        return window.getComputedStyle(sheet).transitionDuration;
      });

      // transition-duration должен быть 0s (отключен)
      if (animationDuration) {
        expect(animationDuration).toBe('0s');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SEMANTIC STRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Semantic Structure', () => {
    test('page has correct lang attribute', async ({ bookPage, page }) => {
      await bookPage.goto();

      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBe('ru');
    });

    test('page has main landmark', async ({ bookPage, page }) => {
      await bookPage.goto();

      const main = page.locator('main');
      await expect(main).toBeAttached();
    });

    test('page has exactly one h1', async ({ bookPage, page }) => {
      await bookPage.goto();

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);
    });

    test('page has descriptive title', async ({ bookPage, page }) => {
      await bookPage.goto();

      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    test('form controls have associated labels', async ({ bookPage, page }) => {
      await bookPage.goto();

      // Все input/select должны иметь label или aria-label
      const unlabeledInputs = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input:not([type="hidden"]), select');
        const issues = [];

        inputs.forEach(input => {
          const id = input.id;
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);
          const hasAriaLabel = input.getAttribute('aria-label');
          const hasAriaLabelledBy = input.getAttribute('aria-labelledby');
          const parentLabel = input.closest('label');

          if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !parentLabel) {
            issues.push({
              tag: input.tagName,
              id: input.id,
              type: input.type,
            });
          }
        });

        return issues;
      });

      expect(unlabeledInputs, `Unlabeled inputs: ${JSON.stringify(unlabeledInputs)}`).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MOBILE ACCESSIBILITY
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe('Mobile Accessibility', () => {
    test.use({ viewport: viewports.mobile });

    test('mobile view has no critical axe violations', async ({ bookPage }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      const results = await new AxeBuilder({ page: bookPage.page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const critical = results.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(critical, formatViolations(critical)).toHaveLength(0);
    });

    test('touch targets have adequate size', async ({ bookPage, page }) => {
      await bookPage.goto();
      await bookPage.openByCover();

      // Кнопки навигации должны быть достаточного размера (минимум 44x44 по WCAG 2.5.5)
      const buttons = page.locator('.nav-btn');
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const box = await buttons.nth(i).boundingBox();
        if (box) {
          // WCAG рекомендует минимум 44x44px для touch targets
          expect(box.width, `Button ${i} width too small`).toBeGreaterThanOrEqual(44);
          expect(box.height, `Button ${i} height too small`).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Форматирование нарушений axe-core для удобного вывода
 * @param {Array} violations
 * @returns {string}
 */
function formatViolations(violations) {
  if (violations.length === 0) return 'No violations';

  return violations.map(v =>
    `[${v.impact}] ${v.id}: ${v.description}\n` +
    `  Help: ${v.helpUrl}\n` +
    `  Elements: ${v.nodes.map(n => n.html.slice(0, 80)).join(', ')}`
  ).join('\n\n');
}
