/**
 * TESTS: ErrorHandler
 * Тесты для централизованной обработки и отображения ошибок
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandler, ErrorCategory } from '@utils/ErrorHandler.js';
import { CONFIG } from '../../../js/config.js';

const ERROR_HIDE_TIMEOUT = CONFIG.UI.ERROR_HIDE_TIMEOUT;

describe('ErrorHandler', () => {
  let errorElement;
  let textElement;

  beforeEach(() => {
    vi.useFakeTimers();

    // Создаём DOM-элементы для отображения ошибок
    errorElement = document.createElement('div');
    errorElement.id = 'errorMessage';
    errorElement.hidden = true;

    textElement = document.createElement('span');
    textElement.id = 'errorText';

    errorElement.appendChild(textElement);
    document.body.appendChild(errorElement);
  });

  afterEach(() => {
    vi.useRealTimers();

    // Очищаем DOM и статический таймер
    document.body.innerHTML = '';
    ErrorHandler._hideTimer = null;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // show()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('show()', () => {
    it('should set error text', () => {
      ErrorHandler.show('Test error message');

      expect(textElement.textContent).toBe('Test error message');
    });

    it('should unhide error container', () => {
      expect(errorElement.hidden).toBe(true);

      ErrorHandler.show('Error');

      expect(errorElement.hidden).toBe(false);
    });

    it('should auto-hide after 5 seconds', () => {
      ErrorHandler.show('Temporary error');

      expect(errorElement.hidden).toBe(false);

      vi.advanceTimersByTime(ERROR_HIDE_TIMEOUT);

      expect(errorElement.hidden).toBe(true);
    });

    it('should not hide before 5 seconds', () => {
      ErrorHandler.show('Error');

      vi.advanceTimersByTime(4999);

      expect(errorElement.hidden).toBe(false);
    });

    it('should handle multiple show calls', () => {
      ErrorHandler.show('First error');
      ErrorHandler.show('Second error');

      expect(textElement.textContent).toBe('Second error');
      expect(errorElement.hidden).toBe(false);
    });

    it('should handle empty message', () => {
      ErrorHandler.show('');

      expect(textElement.textContent).toBe('');
      expect(errorElement.hidden).toBe(false);
    });

    it('should handle long message', () => {
      const longMessage = 'A'.repeat(1000);
      ErrorHandler.show(longMessage);

      expect(textElement.textContent).toBe(longMessage);
    });

    it('should handle special characters', () => {
      const specialMessage = '<script>alert("xss")</script>';
      ErrorHandler.show(specialMessage);

      // textContent автоматически экранирует HTML
      expect(textElement.textContent).toBe(specialMessage);
    });

    it('should handle unicode characters', () => {
      const unicodeMessage = 'Ошибка: 文件未找到 🚫';
      ErrorHandler.show(unicodeMessage);

      expect(textElement.textContent).toBe(unicodeMessage);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // show() - FALLBACK
  // ═══════════════════════════════════════════════════════════════════════════

  describe('show() fallback', () => {
    beforeEach(() => {
      // Удаляем стандартные элементы
      document.body.innerHTML = '';
    });

    it('should log error when container not found', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Fallback error');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error message container not found in DOM');

      consoleErrorSpy.mockRestore();
    });

    it('should create fallback element', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Fallback message');

      const fallback = document.querySelector('.error-message');
      expect(fallback).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should set message in fallback element', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Fallback text');

      const fallback = document.querySelector('.error-message');
      expect(fallback.textContent).toBe('Fallback text');

      consoleErrorSpy.mockRestore();
    });

    it('should set role="alert" on fallback element', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Accessible error');

      const fallback = document.querySelector('.error-message');
      expect(fallback.getAttribute('role')).toBe('alert');

      consoleErrorSpy.mockRestore();
    });

    it('should append fallback to body', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Body error');

      const fallback = document.body.querySelector('.error-message');
      expect(fallback).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should remove fallback after 5 seconds', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Temporary fallback');

      expect(document.querySelector('.error-message')).not.toBeNull();

      vi.advanceTimersByTime(ERROR_HIDE_TIMEOUT);

      expect(document.querySelector('.error-message')).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should use fallback when only errorMessage missing', () => {
      // Есть errorText но нет errorMessage
      const orphanText = document.createElement('span');
      orphanText.id = 'errorText';
      document.body.appendChild(orphanText);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Partial missing');

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(document.querySelector('.error-message')).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should use fallback when only errorText missing', () => {
      // Есть errorMessage но нет errorText
      const container = document.createElement('div');
      container.id = 'errorMessage';
      document.body.appendChild(container);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.show('Text missing');

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(document.querySelector('.error-message')).not.toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ErrorCategory
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ErrorCategory', () => {
    it('should have network category', () => {
      expect(ErrorCategory.NETWORK).toBe('network');
    });

    it('should have validation category', () => {
      expect(ErrorCategory.VALIDATION).toBe('validation');
    });

    it('should have runtime category', () => {
      expect(ErrorCategory.RUNTIME).toBe('runtime');
    });

    it('should be frozen', () => {
      expect(Object.isFrozen(ErrorCategory)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // classify()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('classify()', () => {
    it('should classify "Failed to fetch" TypeError as network', () => {
      const error = new TypeError('Failed to fetch');
      expect(ErrorHandler.classify(error)).toBe(ErrorCategory.NETWORK);
    });

    it('should classify AbortError as network', () => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      expect(ErrorHandler.classify(error)).toBe(ErrorCategory.NETWORK);
    });

    it('should classify object with status as network', () => {
      expect(ErrorHandler.classify({ status: 500, message: 'Internal Server Error' })).toBe(ErrorCategory.NETWORK);
    });

    it('should classify RangeError as validation', () => {
      expect(ErrorHandler.classify(new RangeError('out of range'))).toBe(ErrorCategory.VALIDATION);
    });

    it('should classify URIError as validation', () => {
      expect(ErrorHandler.classify(new URIError('bad uri'))).toBe(ErrorCategory.VALIDATION);
    });

    it('should classify SyntaxError as validation', () => {
      expect(ErrorHandler.classify(new SyntaxError('unexpected token'))).toBe(ErrorCategory.VALIDATION);
    });

    it('should classify ValidationError by name as validation', () => {
      const error = new Error('field invalid');
      error.name = 'ValidationError';
      expect(ErrorHandler.classify(error)).toBe(ErrorCategory.VALIDATION);
    });

    it('should classify generic Error as runtime', () => {
      expect(ErrorHandler.classify(new Error('something broke'))).toBe(ErrorCategory.RUNTIME);
    });

    it('should classify null as runtime', () => {
      expect(ErrorHandler.classify(null)).toBe(ErrorCategory.RUNTIME);
    });

    it('should classify undefined as runtime', () => {
      expect(ErrorHandler.classify(undefined)).toBe(ErrorCategory.RUNTIME);
    });

    it('should classify regular TypeError (not fetch) as runtime', () => {
      expect(ErrorHandler.classify(new TypeError('Cannot read properties of null'))).toBe(ErrorCategory.RUNTIME);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // handle()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('handle()', () => {
    it('should log error to console with category', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');

      ErrorHandler.handle(error, 'User message');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[runtime] Error:', error);

      consoleErrorSpy.mockRestore();
    });

    it('should show user message', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.handle(new Error('Internal'), 'Something went wrong');

      expect(textElement.textContent).toBe('Something went wrong');

      consoleErrorSpy.mockRestore();
    });

    it('should use default message if not provided', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.handle(new Error('Test'));

      expect(textElement.textContent).toBe('Произошла ошибка');

      consoleErrorSpy.mockRestore();
    });

    it('should unhide error container', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.handle(new Error('Test'), 'Error');

      expect(errorElement.hidden).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should auto-classify network errors', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fetchError = new TypeError('Failed to fetch');

      ErrorHandler.handle(fetchError, 'Network issue');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[network] Error:', fetchError);

      consoleErrorSpy.mockRestore();
    });

    it('should accept explicit category override', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('bad input');

      ErrorHandler.handle(error, 'Invalid data', ErrorCategory.VALIDATION);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[validation] Error:', error);

      consoleErrorSpy.mockRestore();
    });

    it('should handle Error subclasses', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const typeError = new TypeError('Type mismatch');

      ErrorHandler.handle(typeError, 'Type error occurred');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[runtime] Error:', typeError);
      expect(textElement.textContent).toBe('Type error occurred');

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error objects', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.handle('string error', 'String error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[runtime] Error:', 'string error');

      ErrorHandler.handle({ code: 500 }, 'Object error');
      // Object without status field → runtime
      expect(consoleErrorSpy).toHaveBeenCalledWith('[runtime] Error:', { code: 500 });

      consoleErrorSpy.mockRestore();
    });

    it('should handle null error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      ErrorHandler.handle(null, 'Null error');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[runtime] Error:', null);
      expect(textElement.textContent).toBe('Null error');

      consoleErrorSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _showFallback()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_showFallback()', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should create div element', () => {
      ErrorHandler._showFallback('Test');

      const fallback = document.querySelector('div.error-message');
      expect(fallback).not.toBeNull();
    });

    it('should set error-message class', () => {
      ErrorHandler._showFallback('Test');

      const fallback = document.querySelector('.error-message');
      expect(fallback.className).toBe('error-message');
    });

    it('should set message as textContent', () => {
      ErrorHandler._showFallback('Fallback text content');

      const fallback = document.querySelector('.error-message');
      expect(fallback.textContent).toBe('Fallback text content');
    });

    it('should set role="alert" attribute', () => {
      ErrorHandler._showFallback('Alert message');

      const fallback = document.querySelector('.error-message');
      expect(fallback.getAttribute('role')).toBe('alert');
    });

    it('should append to document body', () => {
      ErrorHandler._showFallback('Body child');

      expect(document.body.children.length).toBe(1);
      expect(document.body.firstChild.classList.contains('error-message')).toBe(true);
    });

    it('should remove element after 5 seconds', () => {
      ErrorHandler._showFallback('Temporary');

      expect(document.querySelector('.error-message')).not.toBeNull();

      vi.advanceTimersByTime(ERROR_HIDE_TIMEOUT);

      expect(document.querySelector('.error-message')).toBeNull();
    });

    it('should handle multiple fallback calls', () => {
      ErrorHandler._showFallback('First');
      ErrorHandler._showFallback('Second');
      ErrorHandler._showFallback('Third');

      const fallbacks = document.querySelectorAll('.error-message');
      expect(fallbacks.length).toBe(3);

      vi.advanceTimersByTime(ERROR_HIDE_TIMEOUT);

      expect(document.querySelectorAll('.error-message').length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMING INTERACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('timing interactions', () => {
    it('should reset hide timer on consecutive show calls', () => {
      // Каждый новый вызов show() сбрасывает предыдущий таймер
      ErrorHandler.show('First');
      vi.advanceTimersByTime(3000);

      ErrorHandler.show('Second');
      vi.advanceTimersByTime(2000);

      // Второй вызов сбросил таймер — прошло только 2000 из 5000мс нового таймера
      expect(errorElement.hidden).toBe(false);
      expect(textElement.textContent).toBe('Second');

      // После оставшегося времени — скрывается
      vi.advanceTimersByTime(ERROR_HIDE_TIMEOUT - 2000);
      expect(errorElement.hidden).toBe(true);
    });

    it('should handle rapid show/hide cycles', () => {
      for (let i = 0; i < 3; i++) {
        ErrorHandler.show(`Error ${i}`);
      }

      // Сразу после вызовов элемент видим
      expect(errorElement.hidden).toBe(false);
      expect(textElement.textContent).toBe('Error 2');

      // После ERROR_HIDE_TIMEOUT первый таймер скроет элемент
      vi.advanceTimersByTime(ERROR_HIDE_TIMEOUT);
      expect(errorElement.hidden).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle show being called without init', () => {
      // Recreate fresh DOM without elements
      document.body.innerHTML = '';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => ErrorHandler.show('No DOM')).not.toThrow();

      consoleErrorSpy.mockRestore();
    });

    it('should handle handle being called without init', () => {
      document.body.innerHTML = '';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => ErrorHandler.handle(new Error('No DOM'), 'Message')).not.toThrow();

      consoleErrorSpy.mockRestore();
    });

    it('should escape HTML in fallback textContent', () => {
      document.body.innerHTML = '';

      ErrorHandler._showFallback('<img src=x onerror=alert(1)>');

      const fallback = document.querySelector('.error-message');
      // textContent не интерпретирует HTML
      expect(fallback.innerHTML).not.toContain('<img');
      expect(fallback.textContent).toBe('<img src=x onerror=alert(1)>');
    });
  });
});
