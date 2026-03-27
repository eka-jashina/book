/**
 * INTEGRATION TEST: ServerAdminConfigStore Sync
 * Тестирование синхронизации конфигурации с сервером:
 * - Локальное редактирование → API вызовы
 * - Отложенное создание книги (pending book)
 * - Обработка ошибок API
 * - Экспорт/импорт конфигурации
 * - Операции с ресурсами (главы, звуки, шрифты, оформление)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerAdminConfigStore } from '../../../js/admin/ServerAdminConfigStore.js';

describe('ServerAdminConfigStore Sync', () => {
  let store;
  let mockApi;

  const createMockApi = () => ({
    // Книги
    getBooks: vi.fn().mockResolvedValue({ books: [
      { id: 'book-1', title: 'Книга 1', author: 'Автор 1', type: 'book', chaptersCount: 3 },
      { id: 'book-2', title: 'Книга 2', author: 'Автор 2', type: 'album', chaptersCount: 0 },
    ]}),
    getBook: vi.fn().mockResolvedValue({
      id: 'book-1', title: 'Книга 1', author: 'Автор 1',
      cover: { bg: 'bg.jpg', bgMobile: 'bg_m.jpg' },
    }),
    createBook: vi.fn().mockResolvedValue({ id: 'book-3', title: 'Новая', author: 'Новый', type: 'book' }),
    updateBook: vi.fn().mockResolvedValue({}),
    deleteBook: vi.fn().mockResolvedValue({}),
    reorderBooks: vi.fn().mockResolvedValue({}),

    // Главы
    getChapters: vi.fn().mockResolvedValue([
      { id: 'ch-1', title: 'Глава 1', index: 0 },
      { id: 'ch-2', title: 'Глава 2', index: 1 },
    ]),
    createChapter: vi.fn().mockResolvedValue({ id: 'ch-3' }),
    updateChapter: vi.fn().mockResolvedValue({}),
    deleteChapter: vi.fn().mockResolvedValue({}),
    moveChapter: vi.fn().mockResolvedValue({}),

    // Звуки
    getSounds: vi.fn().mockResolvedValue({ pageFlip: 'flip.mp3', bookOpen: 'open.mp3', bookClose: 'close.mp3' }),
    updateSounds: vi.fn().mockResolvedValue({}),

    // Амбиенты
    getAmbients: vi.fn().mockResolvedValue([
      { id: 'none', label: 'Без звука', icon: '✕', fileUrl: null },
      { id: 'rain', label: 'Дождь', icon: '🌧️', fileUrl: 'rain.mp3' },
    ]),
    createAmbient: vi.fn().mockResolvedValue({ id: 'amb-new' }),
    updateAmbient: vi.fn().mockResolvedValue({}),
    deleteAmbient: vi.fn().mockResolvedValue({}),

    // Настройки
    getDefaultSettings: vi.fn().mockResolvedValue({ font: 'georgia', fontSize: 18 }),
    updateDefaultSettings: vi.fn().mockResolvedValue({}),
    getSettings: vi.fn().mockResolvedValue({ fontMin: 14, fontMax: 22, settingsVisibility: {
      fontSize: true, theme: true, font: true, fullscreen: true, sound: true, ambient: true,
    }}),
    updateSettings: vi.fn().mockResolvedValue({}),

    // Шрифты
    getFonts: vi.fn().mockResolvedValue([
      { id: 'f1', label: 'Georgia', family: 'georgia', builtin: true, enabled: true },
    ]),
    createFont: vi.fn().mockResolvedValue({ id: 'f-new' }),
    updateFont: vi.fn().mockResolvedValue({}),
    deleteFont: vi.fn().mockResolvedValue({}),

    // Декоративный шрифт
    getDecorativeFont: vi.fn().mockResolvedValue({ name: 'Fancy', fileUrl: 'fancy.woff2' }),
    setDecorativeFont: vi.fn().mockResolvedValue({}),
    deleteDecorativeFont: vi.fn().mockResolvedValue({}),

    // Оформление
    getAppearance: vi.fn().mockResolvedValue({ light: {}, dark: {} }),
    updateAppearance: vi.fn().mockResolvedValue({}),
    updateAppearanceTheme: vi.fn().mockResolvedValue({}),

    // Экспорт/импорт
    exportConfig: vi.fn().mockResolvedValue({ books: [], fonts: [] }),
    importConfig: vi.fn().mockResolvedValue({}),

    // Загрузка файлов
    uploadImage: vi.fn().mockResolvedValue({ fileUrl: 'https://s3/image.jpg' }),
    uploadSound: vi.fn().mockResolvedValue({ fileUrl: 'https://s3/sound.mp3' }),
    uploadFont: vi.fn().mockResolvedValue({ fileUrl: 'https://s3/font.woff2' }),
  });

  beforeEach(async () => {
    mockApi = createMockApi();
    store = await ServerAdminConfigStore.create(mockApi);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // ИНИЦИАЛИЗАЦИЯ
  // ═══════════════════════════════════════════

  describe('Initialization', () => {
    it('should load books from API on create', () => {
      expect(mockApi.getBooks).toHaveBeenCalled();
      expect(store.getBooks()).toHaveLength(2);
    });

    it('should set first book as active', () => {
      expect(store.getActiveBookId()).toBe('book-1');
    });

    it('should handle empty books list', async () => {
      mockApi.getBooks.mockResolvedValueOnce({ books: [] });
      const emptyStore = await ServerAdminConfigStore.create(mockApi);

      expect(emptyStore.getBooks()).toHaveLength(0);
      expect(emptyStore.getActiveBookId()).toBeNull();
    });

    it('should map book data correctly', () => {
      const books = store.getBooks();
      expect(books[0]).toEqual({
        id: 'book-1', title: 'Книга 1', author: 'Автор 1', type: 'book', chaptersCount: 3,
      });
      expect(books[1]).toEqual({
        id: 'book-2', title: 'Книга 2', author: 'Автор 2', type: 'album', chaptersCount: 0,
      });
    });
  });

  // ═══════════════════════════════════════════
  // ОПЕРАЦИИ С КНИГАМИ
  // ═══════════════════════════════════════════

  describe('Book CRUD → API sync', () => {
    it('should create book via API and add to local list', async () => {
      const created = await store.addBook({ cover: { title: 'Новая', author: 'Новый' } });

      expect(mockApi.createBook).toHaveBeenCalledWith({
        title: 'Новая', author: 'Новый',
      });
      expect(created.id).toBe('book-3');
      expect(store.getBooks()).toHaveLength(3);
    });

    it('should create book with chapters', async () => {
      await store.addBook({
        cover: { title: 'С главами', author: 'Автор' },
        chapters: [{ title: 'Гл 1', content: 'Текст' }],
      });

      expect(mockApi.createBook).toHaveBeenCalled();
      // createChapter вызван для каждой главы
      // (через ServerConfigOperations.createChapter)
    });

    it('should remove book via API and update local list', async () => {
      await store.removeBook('book-1');

      expect(mockApi.deleteBook).toHaveBeenCalledWith('book-1');
      expect(store.getBooks()).toHaveLength(1);
      // Активная книга должна переключиться
      expect(store.getActiveBookId()).toBe('book-2');
    });

    it('should update book meta via API', async () => {
      await store.updateBookMeta('book-1', { title: 'Обновлённая' });

      expect(mockApi.updateBook).toHaveBeenCalledWith('book-1', { title: 'Обновлённая', author: undefined });
      const books = store.getBooks();
      expect(books[0].title).toBe('Обновлённая');
    });

    it('should switch active book', () => {
      store.setActiveBook('book-2');

      expect(store.getActiveBookId()).toBe('book-2');
    });

    it('should not switch to non-existent book', () => {
      store.setActiveBook('non-existent');

      expect(store.getActiveBookId()).toBe('book-1');
    });
  });

  // ═══════════════════════════════════════════
  // ОТЛОЖЕННОЕ СОЗДАНИЕ КНИГИ (PENDING BOOK)
  // ═══════════════════════════════════════════

  describe('Pending book (deferred creation)', () => {
    it('should store pending book without API call', () => {
      store.setPendingBook({ cover: { title: 'Черновик', author: 'Я' } });

      expect(store.isPendingBook()).toBe(true);
      expect(mockApi.createBook).not.toHaveBeenCalled();
      // Активная книга сбрасывается
      expect(store.getActiveBookId()).toBeNull();
    });

    it('should return pending book type', () => {
      store.setPendingBook({ cover: { title: 'Альбом' }, type: 'album' });

      expect(store.getBookType()).toBe('album');
    });

    it('should return pending cover data', async () => {
      store.setPendingBook({ cover: { title: 'Черновик', author: 'Я', bg: 'test.jpg' } });

      const cover = await store.getCover();
      expect(cover.title).toBe('Черновик');
      expect(cover.author).toBe('Я');
      expect(cover.bg).toBe('test.jpg');
    });

    it('should create book on server on first save (addChapter)', async () => {
      store.setPendingBook({ cover: { title: 'Черновик', author: 'Я' } });

      await store.addChapter({ title: 'Глава 1', content: 'Текст' });

      // Книга должна быть создана на сервере
      expect(mockApi.createBook).toHaveBeenCalledWith({
        title: 'Черновик', author: 'Я',
      });
      expect(store.isPendingBook()).toBe(false);
      expect(store.getActiveBookId()).toBe('book-3');
    });

    it('should create book on server on first save (updateCover)', async () => {
      store.setPendingBook({ cover: { title: 'Черновик', author: 'Я' } });

      await store.updateCover({ title: 'Обновлённая' });

      expect(mockApi.createBook).toHaveBeenCalled();
      expect(store.isPendingBook()).toBe(false);
    });

    it('should discard pending book without API call', () => {
      store.setPendingBook({ cover: { title: 'Черновик' } });
      store.discardPendingBook();

      expect(store.isPendingBook()).toBe(false);
      expect(mockApi.createBook).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // ОБРАБОТКА ОШИБОК API
  // ═══════════════════════════════════════════

  describe('API error handling', () => {
    it('should throw and propagate error on failed book creation', async () => {
      mockApi.createBook.mockRejectedValueOnce(new Error('Server error'));

      await expect(store.addBook({ cover: { title: 'Fail' } }))
        .rejects.toThrow('Server error');

      // Книга не должна быть добавлена в локальный список
      expect(store.getBooks()).toHaveLength(2);
    });

    it('should throw on failed book deletion', async () => {
      mockApi.deleteBook.mockRejectedValueOnce(new Error('Forbidden'));

      await expect(store.removeBook('book-1'))
        .rejects.toThrow('Forbidden');

      // Книга должна остаться в списке
      expect(store.getBooks()).toHaveLength(2);
    });

    it('should call onError callback on API failure', async () => {
      const onError = vi.fn();
      store.onError = onError;

      mockApi.updateBook.mockRejectedValueOnce(new Error('Network error'));

      await expect(store.updateBookMeta('book-1', { title: 'X' }))
        .rejects.toThrow();

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Не удалось обновить книгу'));
    });

    it('should rollback moveBook on API failure', async () => {
      mockApi.reorderBooks.mockRejectedValueOnce(new Error('Reorder failed'));

      const booksBefore = store.getBooks().map(b => b.id);

      await expect(store.moveBook(0, 1)).rejects.toThrow();

      // Порядок должен быть восстановлен
      const booksAfter = store.getBooks().map(b => b.id);
      expect(booksAfter).toEqual(booksBefore);
    });
  });

  // ═══════════════════════════════════════════
  // ОПЕРАЦИИ С РЕСУРСАМИ
  // ═══════════════════════════════════════════

  describe('Resource operations sync', () => {
    it('should fetch chapters via API', async () => {
      const chapters = await store.getChapters();

      expect(chapters).toBeDefined();
    });

    it('should return empty chapters when no active book', async () => {
      const emptyApi = {
        ...createMockApi(),
        getBooks: vi.fn().mockResolvedValue({ books: [] }),
      };
      const emptyStore = await ServerAdminConfigStore.create(emptyApi);

      const chapters = await emptyStore.getChapters();
      expect(chapters).toEqual([]);
    });

    it('should sync sounds update to API', async () => {
      await store.updateSounds({ pageFlip: 'new-flip.mp3' });

      expect(mockApi.updateSounds).toHaveBeenCalledWith('book-1', {
        pageFlipUrl: 'new-flip.mp3',
      });
    });

    it('should sync default settings update to API', async () => {
      await store.updateDefaultSettings({ font: 'inter', fontSize: 20 });

      expect(mockApi.updateDefaultSettings).toHaveBeenCalledWith('book-1', {
        font: 'inter', fontSize: 20,
      });
    });

    it('should sync decorative font set to API', async () => {
      await store.setDecorativeFont({ name: 'Decorative', dataUrl: 'data:...' });

      expect(mockApi.setDecorativeFont).toHaveBeenCalledWith('book-1', {
        name: 'Decorative', fileUrl: 'data:...',
      });
    });

    it('should sync decorative font removal to API', async () => {
      await store.setDecorativeFont(null);

      expect(mockApi.deleteDecorativeFont).toHaveBeenCalledWith('book-1');
    });

    it('should return null decorative font when API returns null', async () => {
      mockApi.getDecorativeFont.mockResolvedValueOnce(null);

      const font = await store.getDecorativeFont();
      expect(font).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // ОФОРМЛЕНИЕ И ВИДИМОСТЬ НАСТРОЕК
  // ═══════════════════════════════════════════

  describe('Appearance and settings visibility', () => {
    it('should reject invalid theme names', async () => {
      await store.updateAppearanceTheme('invalid', { bgPage: '#fff' });

      expect(mockApi.updateAppearanceTheme).not.toHaveBeenCalled();
    });

    it('should sync light theme update to API', async () => {
      await store.updateAppearanceTheme('light', { bgPage: '#ffffff' });

      expect(mockApi.updateAppearanceTheme).toHaveBeenCalledWith(
        'book-1', 'light', expect.any(Object)
      );
    });

    it('should sync dark theme update to API', async () => {
      await store.updateAppearanceTheme('dark', { bgPage: '#1a1a1a' });

      expect(mockApi.updateAppearanceTheme).toHaveBeenCalledWith(
        'book-1', 'dark', expect.any(Object)
      );
    });

    it('should fetch settings visibility from API', async () => {
      const visibility = await store.getSettingsVisibility();

      expect(visibility).toEqual(expect.objectContaining({
        fontSize: true, theme: true, font: true,
      }));
    });

    it('should sync settings visibility update to API', async () => {
      await store.updateSettingsVisibility({ fontSize: false });

      expect(mockApi.updateSettings).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // ЭКСПОРТ/ИМПОРТ
  // ═══════════════════════════════════════════

  describe('Export/Import', () => {
    it('should export config as JSON string', async () => {
      const json = await store.exportJSON();

      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
      expect(mockApi.exportConfig).toHaveBeenCalled();
    });

    it('should import config and refresh books list', async () => {
      const importData = JSON.stringify({ books: [{ title: 'Imported' }] });

      mockApi.getBooks.mockResolvedValueOnce({ books: [
        { id: 'imp-1', title: 'Imported', author: 'Imp', type: 'book', chaptersCount: 1 },
      ]});

      await store.importJSON(importData);

      expect(mockApi.importConfig).toHaveBeenCalled();
      // Книги обновлены
      expect(store.getBooks()).toHaveLength(1);
      expect(store.getBooks()[0].title).toBe('Imported');
    });

    it('should throw on invalid JSON import', async () => {
      await expect(store.importJSON('not-json'))
        .rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // ЗАГРУЗКА ФАЙЛОВ
  // ═══════════════════════════════════════════

  describe('File uploads', () => {
    it('should upload image and return URL', async () => {
      const file = new File(['data'], 'image.jpg', { type: 'image/jpeg' });
      const url = await store.uploadImage(file);

      expect(mockApi.uploadImage).toHaveBeenCalledWith(file);
      expect(url).toBe('https://s3/image.jpg');
    });

    it('should upload sound and return URL', async () => {
      const file = new File(['data'], 'sound.mp3', { type: 'audio/mpeg' });
      const url = await store.uploadSound(file);

      expect(mockApi.uploadSound).toHaveBeenCalledWith(file);
      expect(url).toBe('https://s3/sound.mp3');
    });

    it('should upload font and return URL', async () => {
      const file = new File(['data'], 'font.woff2', { type: 'font/woff2' });
      const url = await store.uploadFont(file);

      expect(mockApi.uploadFont).toHaveBeenCalledWith(file);
      expect(url).toBe('https://s3/font.woff2');
    });
  });

  // ═══════════════════════════════════════════
  // SAVE/ERROR CALLBACKS
  // ═══════════════════════════════════════════

  describe('Save and error notifications', () => {
    it('should call onSave callback on successful operations', async () => {
      const onSave = vi.fn();
      store.onSave = onSave;

      await store.addBook({ cover: { title: 'Test' } });

      expect(onSave).toHaveBeenCalled();
    });

    it('should call onSave after book removal', async () => {
      const onSave = vi.fn();
      store.onSave = onSave;

      await store.removeBook('book-1');

      expect(onSave).toHaveBeenCalled();
    });

    it('should call onSave after sounds update', async () => {
      const onSave = vi.fn();
      store.onSave = onSave;

      await store.updateSounds({ pageFlip: 'x.mp3' });

      expect(onSave).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════

  describe('Reset (clear all data)', () => {
    it('should delete all books via API and clear local list', async () => {
      await store.reset();

      expect(mockApi.deleteBook).toHaveBeenCalledTimes(2); // 2 книги
      expect(store.getBooks()).toHaveLength(0);
      expect(store.getActiveBookId()).toBe('');
    });
  });
});
