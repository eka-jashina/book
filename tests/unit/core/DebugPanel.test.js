/**
 * Unit tests for DebugPanel
 * Debug UI panel for displaying application state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebugPanel } from '../../../js/core/DebugPanel.js';

describe('DebugPanel', () => {
  let panel;
  let mockElements;

  beforeEach(() => {
    // Create mock DOM elements
    mockElements = {
      container: document.createElement('div'),
      state: document.createElement('span'),
      total: document.createElement('span'),
      current: document.createElement('span'),
      cache: document.createElement('span'),
      listeners: document.createElement('span'),
      memory: document.createElement('span'),
    };

    panel = new DebugPanel(mockElements);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up body dataset
    delete document.body.dataset.debug;
  });

  describe('constructor', () => {
    it('should store container reference', () => {
      expect(panel.container).toBe(mockElements.container);
    });

    it('should store all elements', () => {
      expect(panel.elements).toBe(mockElements);
    });

    it('should initialize visible as false', () => {
      expect(panel.visible).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should toggle visibility from false to true', () => {
      panel.toggle();
      expect(panel.visible).toBe(true);
    });

    it('should toggle visibility from true to false', () => {
      panel.visible = true;
      panel.toggle();
      expect(panel.visible).toBe(false);
    });

    it('should add visible class when showing', () => {
      panel.toggle();
      expect(mockElements.container.classList.contains('visible')).toBe(true);
    });

    it('should remove visible class when hiding', () => {
      mockElements.container.classList.add('visible');
      panel.visible = true;
      panel.toggle();
      expect(mockElements.container.classList.contains('visible')).toBe(false);
    });

    it('should set body debug attribute when showing', () => {
      panel.toggle();
      expect(document.body.dataset.debug).toBe('true');
    });

    it('should set body debug attribute to false when hiding', () => {
      document.body.dataset.debug = 'true';
      panel.visible = true;
      panel.toggle();
      expect(document.body.dataset.debug).toBe('false');
    });

    it('should toggle back and forth correctly', () => {
      panel.toggle(); // Show
      expect(panel.visible).toBe(true);
      expect(mockElements.container.classList.contains('visible')).toBe(true);

      panel.toggle(); // Hide
      expect(panel.visible).toBe(false);
      expect(mockElements.container.classList.contains('visible')).toBe(false);

      panel.toggle(); // Show again
      expect(panel.visible).toBe(true);
      expect(mockElements.container.classList.contains('visible')).toBe(true);
    });
  });

  describe('update', () => {
    const testData = {
      state: 'OPENED',
      totalPages: 100,
      currentPage: 42,
      listenerCount: 15,
    };

    it('should not update if panel is not visible', () => {
      panel.visible = false;
      panel.update(testData);

      expect(mockElements.state.textContent).toBe('');
      expect(mockElements.total.textContent).toBe('');
    });

    it('should update state element', () => {
      panel.visible = true;
      panel.update(testData);

      expect(mockElements.state.textContent).toBe('OPENED');
    });

    it('should update total pages element', () => {
      panel.visible = true;
      panel.update(testData);

      expect(mockElements.total.textContent).toBe('100');
    });

    it('should update current page element', () => {
      panel.visible = true;
      panel.update(testData);

      expect(mockElements.current.textContent).toBe('42');
    });

    it('should update cache element with viewport reuse label', () => {
      panel.visible = true;
      panel.update(testData);

      expect(mockElements.cache.textContent).toBe('viewport reuse');
    });

    it('should update listeners element', () => {
      panel.visible = true;
      panel.update(testData);

      expect(mockElements.listeners.textContent).toBe('15');
    });

    it('should update memory if performance.memory is available', () => {
      // Mock performance.memory
      const originalPerformance = global.performance;
      global.performance = {
        ...originalPerformance,
        memory: {
          usedJSHeapSize: 52428800, // 50 MB in bytes
        },
      };

      panel.visible = true;
      panel.update(testData);

      expect(mockElements.memory.textContent).toBe('50.0 MB');

      // Restore
      global.performance = originalPerformance;
    });

    it('should not update memory if performance.memory is not available', () => {
      // Ensure performance.memory is undefined (default in jsdom)
      const originalPerformance = global.performance;
      global.performance = {
        ...originalPerformance,
        memory: undefined,
      };

      mockElements.memory.textContent = 'initial';
      panel.visible = true;
      panel.update(testData);

      expect(mockElements.memory.textContent).toBe('initial');

      // Restore
      global.performance = originalPerformance;
    });

    it('should handle different state values', () => {
      panel.visible = true;

      const states = ['CLOSED', 'OPENING', 'OPENED', 'FLIPPING', 'CLOSING'];
      states.forEach((state) => {
        panel.update({ ...testData, state });
        expect(mockElements.state.textContent).toBe(state);
      });
    });

    it('should handle zero values', () => {
      panel.visible = true;
      panel.update({
        state: 'CLOSED',
        totalPages: 0,
        currentPage: 0,
        listenerCount: 0,
      });

      expect(mockElements.total.textContent).toBe('0');
      expect(mockElements.current.textContent).toBe('0');
      expect(mockElements.cache.textContent).toBe('viewport reuse');
      expect(mockElements.listeners.textContent).toBe('0');
    });

    it('should handle large numbers', () => {
      panel.visible = true;
      panel.update({
        state: 'OPENED',
        totalPages: 10000,
        currentPage: 5000,
        listenerCount: 999,
      });

      expect(mockElements.total.textContent).toBe('10000');
      expect(mockElements.current.textContent).toBe('5000');
      expect(mockElements.cache.textContent).toBe('viewport reuse');
      expect(mockElements.listeners.textContent).toBe('999');
    });

    it('should format memory correctly for different sizes', () => {
      const originalPerformance = global.performance;

      // Small heap
      global.performance = {
        ...originalPerformance,
        memory: { usedJSHeapSize: 1048576 }, // 1 MB
      };

      panel.visible = true;
      panel.update(testData);
      expect(mockElements.memory.textContent).toBe('1.0 MB');

      // Large heap
      global.performance = {
        ...originalPerformance,
        memory: { usedJSHeapSize: 104857600 }, // 100 MB
      };

      panel.update(testData);
      expect(mockElements.memory.textContent).toBe('100.0 MB');

      // Fractional
      global.performance = {
        ...originalPerformance,
        memory: { usedJSHeapSize: 26214400 }, // 25 MB
      };

      panel.update(testData);
      expect(mockElements.memory.textContent).toBe('25.0 MB');

      // Restore
      global.performance = originalPerformance;
    });
  });

  describe('integration scenarios', () => {
    it('should work correctly when toggled on then updated', () => {
      const testData = {
        state: 'FLIPPING',
        totalPages: 50,
        currentPage: 25,
        listenerCount: 8,
      };

      panel.toggle(); // Enable
      panel.update(testData);

      expect(mockElements.state.textContent).toBe('FLIPPING');
      expect(mockElements.current.textContent).toBe('25');
    });

    it('should stop updating after toggle off', () => {
      const testData = {
        state: 'OPENED',
        totalPages: 100,
        currentPage: 1,
        listenerCount: 5,
      };

      panel.toggle(); // Enable
      panel.update(testData);
      expect(mockElements.current.textContent).toBe('1');

      panel.toggle(); // Disable
      panel.update({ ...testData, currentPage: 99 });

      // Should not have updated
      expect(mockElements.current.textContent).toBe('1');
    });
  });
});
