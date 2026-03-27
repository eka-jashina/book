/**
 * Тесты для LoadingIndicator
 * Управление оверлеем загрузки
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LoadingIndicator } from '../../../js/core/LoadingIndicator.js';

describe('LoadingIndicator', () => {
  let indicator;
  let mockOverlay;
  let mockProgressEl;

  beforeEach(() => {
    mockOverlay = { hidden: true, querySelector: () => null };
    mockProgressEl = { textContent: '' };
    indicator = new LoadingIndicator(mockOverlay, mockProgressEl);
  });

  describe('show', () => {
    it('should set overlay hidden to false', () => {
      indicator.show();
      expect(mockOverlay.hidden).toBe(false);
    });
  });

  describe('hide', () => {
    it('should set overlay hidden to true', () => {
      mockOverlay.hidden = false;
      indicator.hide();
      expect(mockOverlay.hidden).toBe(true);
    });
  });

  describe('setProgress', () => {
    it('should set progress text', () => {
      indicator.setProgress('Loading...');
      expect(mockProgressEl.textContent).toBe('Loading...');
    });

    it('should handle empty string', () => {
      indicator.setProgress('');
      expect(mockProgressEl.textContent).toBe('');
    });
  });

  describe('setPhase', () => {
    it('should set sanitize phase text', () => {
      indicator.setPhase('sanitize', 0);
      expect(mockProgressEl.textContent).toBe('Подготовка...');
    });

    it('should set parse phase text', () => {
      indicator.setPhase('parse', 10);
      expect(mockProgressEl.textContent).toBe('Парсинг...');
    });

    it('should set layout phase text', () => {
      indicator.setPhase('layout', 20);
      expect(mockProgressEl.textContent).toBe('Разметка...');
    });

    it('should set content phase text with progress', () => {
      indicator.setPhase('content', 45);
      expect(mockProgressEl.textContent).toBe('Обработка контента: 45%');
    });

    it('should set align phase text', () => {
      indicator.setPhase('align', 65);
      expect(mockProgressEl.textContent).toBe('Выравнивание...');
    });

    it('should set chapters phase text', () => {
      indicator.setPhase('chapters', 70);
      expect(mockProgressEl.textContent).toBe('Анализ глав...');
    });

    it('should set slice phase text with calculated progress', () => {
      indicator.setPhase('slice', 75);
      expect(mockProgressEl.textContent).toBe('Нарезка страниц: 0%');

      indicator.setPhase('slice', 87);
      expect(mockProgressEl.textContent).toBe('Нарезка страниц: 48%');

      indicator.setPhase('slice', 100);
      expect(mockProgressEl.textContent).toBe('Нарезка страниц: 100%');
    });

    it('should set complete phase text', () => {
      indicator.setPhase('complete', 100);
      expect(mockProgressEl.textContent).toBe('Готово!');
    });

    it('should fallback to percentage for unknown phase', () => {
      indicator.setPhase('unknown', 42);
      expect(mockProgressEl.textContent).toBe('42%');
    });
  });
});
