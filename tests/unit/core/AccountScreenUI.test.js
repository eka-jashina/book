/**
 * Тесты для AccountScreenUI
 * UI-утилиты: toast, save indicator, confirm dialog
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../js/i18n/index.js', () => ({
  t: vi.fn((key) => key),
}));

import {
  cacheUIElements,
  showToast,
  showSaveIndicator,
  showSaveError,
  confirm,
} from '../../../js/core/AccountScreenUI.js';

describe('AccountScreenUI', () => {
  let container;
  let ui;

  beforeEach(() => {
    vi.useFakeTimers();

    container = document.createElement('div');
    container.innerHTML = `
      <div id="toast" hidden>
        <span id="toastMessage"></span>
        <svg><path id="toastIconPath" d=""/></svg>
      </div>
      <div id="saveIndicator">
        <span id="saveIndicatorText"></span>
      </div>
      <dialog id="confirmDialog">
        <div id="confirmTitle"></div>
        <div id="confirmMessage"></div>
        <button id="confirmOk"></button>
        <button id="confirmCancel"></button>
      </dialog>
      <div class="screen-view active" data-view="editor"></div>
    `;
    document.body.innerHTML = '';
    document.body.appendChild(container);

    ui = cacheUIElements(container);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cacheUIElements', () => {
    it('should return all required UI elements', () => {
      expect(ui.toast).not.toBeNull();
      expect(ui.toastMessage).not.toBeNull();
      expect(ui.toastIconPath).not.toBeNull();
      expect(ui.saveIndicator).not.toBeNull();
      expect(ui.saveIndicatorText).not.toBeNull();
      expect(ui.confirmDialog).not.toBeNull();
      expect(ui.confirmTitle).not.toBeNull();
      expect(ui.confirmMessage).not.toBeNull();
      expect(ui.confirmOk).not.toBeNull();
      expect(ui.confirmCancel).not.toBeNull();
    });
  });

  describe('showToast', () => {
    it('should show toast with message', () => {
      const timerRef = { timer: null };
      showToast(ui, 'Test message', 'success', timerRef);

      expect(ui.toastMessage.textContent).toBe('Test message');
      expect(ui.toast.hidden).toBe(false);
    });

    it('should set type and icon for known types', () => {
      const timerRef = { timer: null };
      showToast(ui, 'Error!', 'error', timerRef);

      expect(ui.toast.dataset.type).toBe('error');
      expect(ui.toastIconPath.getAttribute('d')).toBeTruthy();
    });

    it('should remove type for unknown type', () => {
      const timerRef = { timer: null };
      ui.toast.dataset.type = 'old';
      showToast(ui, 'No type', undefined, timerRef);

      expect(ui.toast.dataset.type).toBeUndefined();
    });

    it('should hide toast after timeout', () => {
      const timerRef = { timer: null };
      showToast(ui, 'Temp', 'success', timerRef);

      vi.advanceTimersByTime(2500);
      expect(ui.toast.classList.contains('visible')).toBe(false);
    });

    it('should clear previous timer', () => {
      const timerRef = { timer: null };
      showToast(ui, 'First', 'success', timerRef);
      const firstTimer = timerRef.timer;
      showToast(ui, 'Second', 'success', timerRef);

      expect(timerRef.timer).not.toBe(firstTimer);
    });
  });

  describe('showSaveIndicator', () => {
    it('should show save indicator when editor is active', () => {
      const timerRef = { timer: null };
      showSaveIndicator(container, ui, timerRef);

      expect(ui.saveIndicator.classList.contains('visible')).toBe(true);
      expect(ui.saveIndicator.classList.contains('save-indicator--saved')).toBe(true);
    });

    it('should not show if editor view is not active', () => {
      const editorView = container.querySelector('.screen-view[data-view="editor"]');
      editorView.classList.remove('active');

      const timerRef = { timer: null };
      showSaveIndicator(container, ui, timerRef);

      expect(ui.saveIndicator.classList.contains('visible')).toBe(false);
    });

    it('should fade out after timeout', () => {
      const timerRef = { timer: null };
      showSaveIndicator(container, ui, timerRef);

      vi.advanceTimersByTime(2000);
      expect(ui.saveIndicator.classList.contains('fade-out')).toBe(true);
    });
  });

  describe('showSaveError', () => {
    it('should show error state on save indicator', () => {
      const timerRef = { timer: null };
      showSaveError(ui, timerRef);

      expect(ui.saveIndicator.classList.contains('visible')).toBe(true);
      expect(ui.saveIndicator.classList.contains('save-indicator--error')).toBe(true);
    });

    it('should fade out after 4 seconds', () => {
      const timerRef = { timer: null };
      showSaveError(ui, timerRef);

      vi.advanceTimersByTime(4000);
      expect(ui.saveIndicator.classList.contains('fade-out')).toBe(true);
    });
  });

  describe('confirm', () => {
    it('should show dialog with message', () => {
      ui.confirmDialog.showModal = vi.fn();

      confirm(ui, 'Are you sure?');

      expect(ui.confirmMessage.textContent).toBe('Are you sure?');
      expect(ui.confirmDialog.showModal).toHaveBeenCalled();
    });

    it('should resolve true when OK clicked', async () => {
      ui.confirmDialog.showModal = vi.fn();
      ui.confirmDialog.close = vi.fn();

      const promise = confirm(ui, 'Delete?');
      ui.confirmOk.click();

      const result = await promise;
      expect(result).toBe(true);
    });

    it('should resolve false when Cancel clicked', async () => {
      ui.confirmDialog.showModal = vi.fn();
      ui.confirmDialog.close = vi.fn();

      const promise = confirm(ui, 'Delete?');
      ui.confirmCancel.click();

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should use custom title and okText', () => {
      ui.confirmDialog.showModal = vi.fn();

      confirm(ui, 'msg', { title: 'Custom Title', okText: 'Yes' });

      expect(ui.confirmTitle.textContent).toBe('Custom Title');
      expect(ui.confirmOk.textContent).toBe('Yes');
    });
  });
});
