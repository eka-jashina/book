/**
 * INTEGRATION TEST: Quill Editor Wrapper
 * Инициализация, форматирование, получение HTML, вставка изображений, lifecycle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted — переменные доступны внутри vi.mock factories
const { mockQuillInstance, MockQuill } = vi.hoisted(() => {
  const mockQuillInstance = {
    clipboard: {
      convert: vi.fn(({ html }) => ({ ops: [{ insert: html }] })),
    },
    setContents: vi.fn(),
    getSemanticHTML: vi.fn().mockReturnValue('<p>Hello</p>'),
    getText: vi.fn().mockReturnValue('Hello'),
    setText: vi.fn(),
    getSelection: vi.fn().mockReturnValue({ index: 0 }),
    insertEmbed: vi.fn(),
    setSelection: vi.fn(),
  };
  const MockQuill = vi.fn(function () {
    Object.assign(this, mockQuillInstance);
  });
  return { mockQuillInstance, MockQuill };
});

vi.mock('quill', () => ({
  default: MockQuill,
}));

vi.mock('quill/dist/quill.snow.css', () => ({}));

import { QuillEditorWrapper } from '../../../js/admin/modules/QuillEditorWrapper.js';

describe('Quill Editor Integration', () => {
  let editor;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'editor-container';
    document.body.appendChild(container);

    editor = new QuillEditorWrapper();

    // Reset mocks between tests
    vi.clearAllMocks();
    mockQuillInstance.getSemanticHTML.mockReturnValue('<p>Hello</p>');
    mockQuillInstance.getText.mockReturnValue('Hello');
    mockQuillInstance.getSelection.mockReturnValue({ index: 0 });
  });

  afterEach(() => {
    if (editor) editor.destroy();
    document.body.innerHTML = '';
  });

  // ── Initialization ──────────────────────────────────────────

  describe('Initialization', () => {
    it('should not be initialized before init()', () => {
      expect(editor.isInitialized).toBe(false);
    });

    it('should initialize Quill with snow theme', async () => {
      await editor.init(container);

      expect(editor.isInitialized).toBe(true);
      expect(MockQuill).toHaveBeenCalledWith(container, expect.objectContaining({
        theme: 'snow',
        placeholder: 'Начните писать текст главы...',
      }));
    });

    it('should configure toolbar with required buttons', async () => {
      await editor.init(container);

      const config = MockQuill.mock.calls[0][1];
      const toolbar = config.modules.toolbar.container;
      const flat = toolbar.flat(Infinity);

      expect(flat).toContain('bold');
      expect(flat).toContain('italic');
      expect(flat).toContain('underline');
      expect(flat).toContain('strike');
      expect(flat).toContain('link');
      expect(flat).toContain('image');
      expect(flat).toContain('blockquote');
      expect(flat).toContain('code-block');
      expect(flat).toContain('clean');
    });

    it('should register custom image handler', async () => {
      await editor.init(container);

      const config = MockQuill.mock.calls[0][1];
      expect(config.modules.toolbar.handlers.image).toBeInstanceOf(Function);
    });

    it('should destroy previous instance on re-init', async () => {
      await editor.init(container);

      const newContainer = document.createElement('div');
      document.body.appendChild(newContainer);

      await editor.init(newContainer);

      // Should have cleared old container
      expect(container.innerHTML).toBe('');
    });
  });

  // ── Content operations ──────────────────────────────────────

  describe('Content operations', () => {
    beforeEach(async () => {
      await editor.init(container);
    });

    it('should set HTML content via clipboard converter', () => {
      editor.setHTML('<p>Test content</p>');

      expect(mockQuillInstance.clipboard.convert).toHaveBeenCalledWith({
        html: '<p>Test content</p>',
      });
      expect(mockQuillInstance.setContents).toHaveBeenCalled();
    });

    it('should get semantic HTML from editor', () => {
      const html = editor.getHTML();

      expect(mockQuillInstance.getSemanticHTML).toHaveBeenCalled();
      expect(html).toBe('<p>Hello</p>');
    });

    it('should check if editor is empty', () => {
      mockQuillInstance.getText.mockReturnValue('   ');

      expect(editor.isEmpty()).toBe(true);

      mockQuillInstance.getText.mockReturnValue('Some text');

      expect(editor.isEmpty()).toBe(false);
    });

    it('should clear content', () => {
      editor.clear();

      expect(mockQuillInstance.setText).toHaveBeenCalledWith('');
    });

    it('should return empty string from getHTML when not initialized', () => {
      const fresh = new QuillEditorWrapper();

      expect(fresh.getHTML()).toBe('');
    });

    it('should return true from isEmpty when not initialized', () => {
      const fresh = new QuillEditorWrapper();

      expect(fresh.isEmpty()).toBe(true);
    });

    it('should no-op setHTML when not initialized', () => {
      const fresh = new QuillEditorWrapper();

      // Should not throw
      fresh.setHTML('<p>test</p>');
    });

    it('should no-op clear when not initialized', () => {
      const fresh = new QuillEditorWrapper();

      // Should not throw
      fresh.clear();
    });
  });

  // ── Image insertion ─────────────────────────────────────────

  describe('Image insertion', () => {
    beforeEach(async () => {
      await editor.init(container);
    });

    it('should create file input with correct accept types', () => {
      const createSpy = vi.spyOn(document, 'createElement');

      editor._handleImageInsert();

      const inputCalls = createSpy.mock.results.filter(r =>
        r.value && r.value.tagName === 'INPUT');
      expect(inputCalls.length).toBeGreaterThan(0);
      const input = inputCalls[0].value;
      expect(input.type).toBe('file');
      expect(input.accept).toContain('image/png');
      expect(input.accept).toContain('image/jpeg');
    });

    it('should trigger click on created file input', () => {
      const originalCreate = document.createElement.bind(document);
      let capturedInput;
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = originalCreate(tag);
        if (tag === 'input') {
          capturedInput = el;
          el.click = vi.fn();
        }
        return el;
      });

      editor._handleImageInsert();

      expect(capturedInput).toBeTruthy();
      expect(capturedInput.click).toHaveBeenCalled();
    });
  });

  // ── Destroy ─────────────────────────────────────────────────

  describe('Destroy', () => {
    it('should clear container and null quill instance', async () => {
      await editor.init(container);

      editor.destroy();

      expect(editor.isInitialized).toBe(false);
      expect(container.innerHTML).toBe('');
    });

    it('should handle destroy when not initialized', () => {
      const fresh = new QuillEditorWrapper();

      // Should not throw
      fresh.destroy();
      expect(fresh.isInitialized).toBe(false);
    });
  });

  // ── Full lifecycle ──────────────────────────────────────────

  describe('Full lifecycle', () => {
    it('should support init → setHTML → getHTML → clear → destroy', async () => {
      // 1. Init
      await editor.init(container);
      expect(editor.isInitialized).toBe(true);

      // 2. Set content
      editor.setHTML('<h2>Title</h2><p>Body text</p>');
      expect(mockQuillInstance.setContents).toHaveBeenCalled();

      // 3. Get content
      const html = editor.getHTML();
      expect(html).toBeTruthy();

      // 4. Check non-empty
      mockQuillInstance.getText.mockReturnValue('Title Body text');
      expect(editor.isEmpty()).toBe(false);

      // 5. Clear
      editor.clear();
      expect(mockQuillInstance.setText).toHaveBeenCalledWith('');

      // 6. Destroy
      editor.destroy();
      expect(editor.isInitialized).toBe(false);
    });
  });
});
