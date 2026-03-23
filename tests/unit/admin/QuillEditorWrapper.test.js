/**
 * TESTS: QuillEditorWrapper
 * Тесты обёртки WYSIWYG-редактора Quill
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Создать мок-экземпляр через vi.hoisted чтобы он был доступен в vi.mock
const mockQuillInstance = vi.hoisted(() => ({
  clipboard: {
    convert: vi.fn(() => ({ ops: [{ insert: 'converted' }] })),
  },
  setContents: vi.fn(),
  getSemanticHTML: vi.fn(() => '<p>Hello</p>'),
  getText: vi.fn(() => 'Hello'),
  setText: vi.fn(),
  getSelection: vi.fn(() => ({ index: 0 })),
  insertEmbed: vi.fn(),
  setSelection: vi.fn(),
}));

vi.mock('quill', () => ({
  default: function MockQuill() { return mockQuillInstance; },
}));

vi.mock('quill/dist/quill.snow.css', () => ({}));

const { QuillEditorWrapper } = await import('../../../js/admin/modules/QuillEditorWrapper.js');

describe('QuillEditorWrapper', () => {
  let wrapper;
  let container;

  beforeEach(() => {
    vi.clearAllMocks();
    wrapper = new QuillEditorWrapper();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // isInitialized
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isInitialized', () => {
    it('should be false before init', () => {
      expect(wrapper.isInitialized).toBe(false);
    });

    it('should be true after init', async () => {
      await wrapper.init(container);
      expect(wrapper.isInitialized).toBe(true);
    });

    it('should be false after destroy', async () => {
      await wrapper.init(container);
      wrapper.destroy();
      expect(wrapper.isInitialized).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // init
  // ═══════════════════════════════════════════════════════════════════════════

  describe('init()', () => {
    it('should create Quill instance', async () => {
      await wrapper.init(container);

      expect(wrapper.isInitialized).toBe(true);
    });

    it('should destroy previous instance before re-init', async () => {
      await wrapper.init(container);
      const spy = vi.spyOn(wrapper, 'destroy');

      await wrapper.init(container);

      expect(spy).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setHTML
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setHTML()', () => {
    it('should convert HTML and set contents', async () => {
      await wrapper.init(container);

      wrapper.setHTML('<p>Test</p>');

      expect(mockQuillInstance.clipboard.convert).toHaveBeenCalledWith({ html: '<p>Test</p>' });
      expect(mockQuillInstance.setContents).toHaveBeenCalled();
    });

    it('should do nothing if not initialized', () => {
      wrapper.setHTML('<p>Test</p>');

      expect(mockQuillInstance.clipboard.convert).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getHTML
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getHTML()', () => {
    it('should return semantic HTML from editor', async () => {
      await wrapper.init(container);

      const html = wrapper.getHTML();

      expect(html).toBe('<p>Hello</p>');
      expect(mockQuillInstance.getSemanticHTML).toHaveBeenCalled();
    });

    it('should return empty string if not initialized', () => {
      expect(wrapper.getHTML()).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // isEmpty
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isEmpty()', () => {
    it('should return false when editor has text', async () => {
      await wrapper.init(container);
      mockQuillInstance.getText.mockReturnValue('Some text');

      expect(wrapper.isEmpty()).toBe(false);
    });

    it('should return true when editor is empty', async () => {
      await wrapper.init(container);
      mockQuillInstance.getText.mockReturnValue('  \n  ');

      expect(wrapper.isEmpty()).toBe(true);
    });

    it('should return true if not initialized', () => {
      expect(wrapper.isEmpty()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // clear
  // ═══════════════════════════════════════════════════════════════════════════

  describe('clear()', () => {
    it('should set text to empty string', async () => {
      await wrapper.init(container);

      wrapper.clear();

      expect(mockQuillInstance.setText).toHaveBeenCalledWith('');
    });

    it('should do nothing if not initialized', () => {
      wrapper.clear();
      expect(mockQuillInstance.setText).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // destroy
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroy()', () => {
    it('should clear container and null quill', async () => {
      await wrapper.init(container);
      container.innerHTML = '<div class="ql-editor">content</div>';

      wrapper.destroy();

      expect(container.innerHTML).toBe('');
      expect(wrapper.isInitialized).toBe(false);
    });

    it('should be safe to call when not initialized', () => {
      expect(() => wrapper.destroy()).not.toThrow();
    });
  });
});
