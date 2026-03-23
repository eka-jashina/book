import { describe, it, expect } from 'vitest';
import {
  mapAppearanceToDto,
  mapAppearanceToCoverDto,
  mapSoundsToDto,
  mapDefaultSettingsToDto,
  mapAmbientToDto,
  mapChapterToListItem,
  mapChapterToDetail,
  mapDecorativeFontToDto,
  mapReadingFontToDto,
  mapGlobalSettingsToDto,
  mapReadingProgressToDto,
  mapUserToDto,
  mapUserToPublicAuthor,
  mapBookToPublicCard,
  mapBookToListItem,
} from '../src/utils/mappers.js';

describe('Mappers', () => {
  // ── mapAppearanceToDto ───────────────────────────────────────

  describe('mapAppearanceToDto', () => {
    it('should map appearance DB record to DTO', () => {
      const appearance = {
        id: '1', bookId: 'b1',
        fontMin: 14, fontMax: 22,
        lightCoverBgStart: '#fff', lightCoverBgEnd: '#eee', lightCoverText: '#000',
        lightCoverBgImageUrl: null, lightPageTexture: 'paper', lightCustomTextureUrl: null,
        lightBgPage: '#fafafa', lightBgApp: '#f0f0f0',
        darkCoverBgStart: '#111', darkCoverBgEnd: '#222', darkCoverText: '#fff',
        darkCoverBgImageUrl: 'http://img.com/dark.jpg', darkPageTexture: 'dark-paper',
        darkCustomTextureUrl: 'http://img.com/tex.jpg', darkBgPage: '#1a1a1a', darkBgApp: '#0a0a0a',
      };

      const dto = mapAppearanceToDto(appearance as any);

      expect(dto.fontMin).toBe(14);
      expect(dto.fontMax).toBe(22);
      expect(dto.light.coverBgStart).toBe('#fff');
      expect(dto.light.coverBgEnd).toBe('#eee');
      expect(dto.light.coverText).toBe('#000');
      expect(dto.light.coverBgImageUrl).toBeNull();
      expect(dto.dark.coverBgStart).toBe('#111');
      expect(dto.dark.coverBgImageUrl).toBe('http://img.com/dark.jpg');
      expect(dto.dark.customTextureUrl).toBe('http://img.com/tex.jpg');
    });
  });

  // ── mapAppearanceToCoverDto ──────────────────────────────────

  describe('mapAppearanceToCoverDto', () => {
    it('should extract only light cover fields', () => {
      const appearance = {
        lightCoverBgStart: '#aaa',
        lightCoverBgEnd: '#bbb',
        lightCoverText: '#ccc',
      };

      const dto = mapAppearanceToCoverDto(appearance);

      expect(dto).toEqual({
        light: {
          coverBgStart: '#aaa',
          coverBgEnd: '#bbb',
          coverText: '#ccc',
        },
      });
    });
  });

  // ── mapSoundsToDto ───────────────────────────────────────────

  describe('mapSoundsToDto', () => {
    it('should map sounds DB record to DTO', () => {
      const sounds = {
        id: '1', bookId: 'b1',
        pageFlipUrl: '/sounds/flip.mp3',
        bookOpenUrl: '/sounds/open.mp3',
        bookCloseUrl: '/sounds/close.mp3',
      };

      const dto = mapSoundsToDto(sounds as any);

      expect(dto.pageFlip).toBe('/sounds/flip.mp3');
      expect(dto.bookOpen).toBe('/sounds/open.mp3');
      expect(dto.bookClose).toBe('/sounds/close.mp3');
    });
  });

  // ── mapDefaultSettingsToDto ──────────────────────────────────

  describe('mapDefaultSettingsToDto', () => {
    it('should map default settings', () => {
      const ds = {
        id: '1', bookId: 'b1',
        font: 'georgia', fontSize: 18, theme: 'light',
        soundEnabled: true, soundVolume: 0.3,
        ambientType: 'none', ambientVolume: 0.5,
      };

      const dto = mapDefaultSettingsToDto(ds as any);

      expect(dto.font).toBe('georgia');
      expect(dto.fontSize).toBe(18);
      expect(dto.theme).toBe('light');
      expect(dto.soundEnabled).toBe(true);
      expect(dto.soundVolume).toBe(0.3);
      expect(dto.ambientType).toBe('none');
      expect(dto.ambientVolume).toBe(0.5);
    });
  });

  // ── mapAmbientToDto ──────────────────────────────────────────

  describe('mapAmbientToDto', () => {
    it('should map ambient DB record to DTO', () => {
      const ambient = {
        id: 'a1', bookId: 'b1',
        ambientKey: 'rain', label: 'Rain', shortLabel: 'Rain',
        icon: '🌧', fileUrl: '/sounds/rain.mp3',
        visible: true, builtin: true, position: 0,
      };

      const dto = mapAmbientToDto(ambient as any);

      expect(dto.id).toBe('a1');
      expect(dto.ambientKey).toBe('rain');
      expect(dto.label).toBe('Rain');
      expect(dto.shortLabel).toBe('Rain');
      expect(dto.icon).toBe('🌧');
      expect(dto.fileUrl).toBe('/sounds/rain.mp3');
      expect(dto.visible).toBe(true);
      expect(dto.builtin).toBe(true);
      expect(dto.position).toBe(0);
    });

    it('should handle null optional fields', () => {
      const ambient = {
        id: 'a2', bookId: 'b1',
        ambientKey: 'custom', label: 'Custom', shortLabel: null,
        icon: null, fileUrl: null,
        visible: false, builtin: false, position: 1,
      };

      const dto = mapAmbientToDto(ambient as any);

      expect(dto.shortLabel).toBeNull();
      expect(dto.icon).toBeNull();
      expect(dto.fileUrl).toBeNull();
    });
  });

  // ── mapChapterToListItem / mapChapterToDetail ────────────────

  describe('mapChapterToListItem', () => {
    it('should map chapter to list item with hasHtmlContent', () => {
      const chapter = {
        id: 'c1', bookId: 'b1', title: 'Chapter 1',
        position: 0, filePath: null,
        htmlContent: '<p>Content</p>',
        bg: '/images/bg.jpg', bgMobile: '/images/bg-m.jpg',
      };

      const dto = mapChapterToListItem(chapter as any);

      expect(dto.id).toBe('c1');
      expect(dto.title).toBe('Chapter 1');
      expect(dto.position).toBe(0);
      expect(dto.filePath).toBeNull();
      expect(dto.hasHtmlContent).toBe(true);
      expect(dto.bg).toBe('/images/bg.jpg');
      expect(dto.bgMobile).toBe('/images/bg-m.jpg');
    });

    it('should set hasHtmlContent to false when htmlContent is null', () => {
      const chapter = {
        id: 'c2', bookId: 'b1', title: 'Chapter 2',
        position: 1, filePath: '/content/ch2.html',
        htmlContent: null,
        bg: '', bgMobile: '',
      };

      const dto = mapChapterToListItem(chapter as any);

      expect(dto.hasHtmlContent).toBe(false);
    });
  });

  describe('mapChapterToDetail', () => {
    it('should include htmlContent in detail DTO', () => {
      const chapter = {
        id: 'c1', bookId: 'b1', title: 'Chapter 1',
        position: 0, filePath: null,
        htmlContent: '<p>Full content here</p>',
        bg: '', bgMobile: '',
      };

      const dto = mapChapterToDetail(chapter as any);

      expect(dto.htmlContent).toBe('<p>Full content here</p>');
      expect(dto.hasHtmlContent).toBe(true);
    });
  });

  // ── mapDecorativeFontToDto ───────────────────────────────────

  describe('mapDecorativeFontToDto', () => {
    it('should map decorative font', () => {
      const df = { id: '1', bookId: 'b1', name: 'Fancy', fileUrl: '/fonts/fancy.woff2' };
      const dto = mapDecorativeFontToDto(df as any);

      expect(dto).toEqual({ name: 'Fancy', fileUrl: '/fonts/fancy.woff2' });
    });
  });

  // ── mapReadingFontToDto ──────────────────────────────────────

  describe('mapReadingFontToDto', () => {
    it('should map reading font', () => {
      const font = {
        id: 'f1', userId: 'u1',
        fontKey: 'custom-serif', label: 'Custom Serif', family: 'CustomSerif, serif',
        builtin: false, enabled: true, fileUrl: '/fonts/custom.woff2', position: 0,
      };

      const dto = mapReadingFontToDto(font as any);

      expect(dto.id).toBe('f1');
      expect(dto.fontKey).toBe('custom-serif');
      expect(dto.label).toBe('Custom Serif');
      expect(dto.family).toBe('CustomSerif, serif');
      expect(dto.builtin).toBe(false);
      expect(dto.enabled).toBe(true);
      expect(dto.fileUrl).toBe('/fonts/custom.woff2');
      expect(dto.position).toBe(0);
    });
  });

  // ── mapGlobalSettingsToDto ───────────────────────────────────

  describe('mapGlobalSettingsToDto', () => {
    it('should map global settings with visibility flags', () => {
      const settings = {
        id: '1', userId: 'u1',
        fontMin: 12, fontMax: 24,
        visFontSize: true, visTheme: true, visFont: false,
        visFullscreen: true, visSound: true, visAmbient: false,
      };

      const dto = mapGlobalSettingsToDto(settings as any);

      expect(dto.fontMin).toBe(12);
      expect(dto.fontMax).toBe(24);
      expect(dto.settingsVisibility).toEqual({
        fontSize: true,
        theme: true,
        font: false,
        fullscreen: true,
        sound: true,
        ambient: false,
      });
    });
  });

  // ── mapReadingProgressToDto ──────────────────────────────────

  describe('mapReadingProgressToDto', () => {
    it('should map progress with preferences', () => {
      const progress = {
        id: '1', userId: 'u1', bookId: 'b1',
        page: 42,
        updatedAt: new Date('2024-01-15T10:00:00Z'),
      };

      const preferences = {
        id: '1', userId: 'u1', bookId: 'b1',
        font: 'times', fontSize: 20, theme: 'dark',
        soundEnabled: false, soundVolume: 0.1,
        ambientType: 'rain', ambientVolume: 0.8,
      };

      const dto = mapReadingProgressToDto(progress as any, preferences as any);

      expect(dto.page).toBe(42);
      expect(dto.font).toBe('times');
      expect(dto.fontSize).toBe(20);
      expect(dto.theme).toBe('dark');
      expect(dto.soundEnabled).toBe(false);
      expect(dto.soundVolume).toBe(0.1);
      expect(dto.ambientType).toBe('rain');
      expect(dto.ambientVolume).toBe(0.8);
      expect(dto.updatedAt).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should use defaults when preferences is null', () => {
      const progress = {
        id: '1', userId: 'u1', bookId: 'b1',
        page: 0,
        updatedAt: new Date('2024-01-15T10:00:00Z'),
      };

      const dto = mapReadingProgressToDto(progress as any, null);

      expect(dto.font).toBe('georgia');
      expect(dto.fontSize).toBe(18);
      expect(dto.theme).toBe('light');
      expect(dto.soundEnabled).toBe(true);
      expect(dto.soundVolume).toBe(0.3);
      expect(dto.ambientType).toBe('none');
      expect(dto.ambientVolume).toBe(0.5);
    });
  });

  // ── mapUserToDto ─────────────────────────────────────────────

  describe('mapUserToDto', () => {
    it('should map user with passwordHash', () => {
      const user = {
        id: 'u1', email: 'test@example.com',
        displayName: 'Test User', avatarUrl: null,
        username: 'testuser', bio: 'Hello',
        googleId: null, passwordHash: '$2b$10$hash',
      };

      const dto = mapUserToDto(user);

      expect(dto.id).toBe('u1');
      expect(dto.email).toBe('test@example.com');
      expect(dto.displayName).toBe('Test User');
      expect(dto.username).toBe('testuser');
      expect(dto.bio).toBe('Hello');
      expect(dto.hasPassword).toBe(true);
      expect(dto.hasGoogle).toBe(false);
      // Should not expose passwordHash
      expect(dto).not.toHaveProperty('passwordHash');
    });

    it('should map user with Google account', () => {
      const user = {
        id: 'u2', email: 'google@example.com',
        displayName: 'Google User', avatarUrl: 'http://img.com/avatar.jpg',
        username: null, bio: null,
        googleId: 'google-123', passwordHash: null,
      };

      const dto = mapUserToDto(user);

      expect(dto.hasPassword).toBe(false);
      expect(dto.hasGoogle).toBe(true);
      expect(dto.avatarUrl).toBe('http://img.com/avatar.jpg');
    });

    it('should prefer hasPassword flag over passwordHash', () => {
      const user = {
        id: 'u3', email: 'test@example.com',
        displayName: null, avatarUrl: null,
        googleId: null, hasPassword: true,
      };

      const dto = mapUserToDto(user);

      expect(dto.hasPassword).toBe(true);
    });

    it('should default username and bio to null', () => {
      const user = {
        id: 'u4', email: 'test@example.com',
        displayName: null, avatarUrl: null,
        googleId: null, passwordHash: null,
      };

      const dto = mapUserToDto(user);

      expect(dto.username).toBeNull();
      expect(dto.bio).toBeNull();
    });
  });

  // ── mapUserToPublicAuthor ────────────────────────────────────

  describe('mapUserToPublicAuthor', () => {
    it('should map user to public author', () => {
      const user = {
        username: 'author1',
        displayName: 'Author One',
        avatarUrl: 'http://img.com/a.jpg',
        bio: 'I write books',
      };

      const dto = mapUserToPublicAuthor(user);

      expect(dto).toEqual({
        username: 'author1',
        displayName: 'Author One',
        avatarUrl: 'http://img.com/a.jpg',
        bio: 'I write books',
      });
    });
  });

  // ── mapBookToPublicCard ──────────────────────────────────────

  describe('mapBookToPublicCard', () => {
    it('should map book to public card', () => {
      const book = {
        id: 'b1', title: 'Great Book', author: 'Author',
        description: 'A description', slug: 'great-book', publishedAt: new Date('2024-06-01T00:00:00Z'),
        _count: { chapters: 5 },
        appearance: {
          lightCoverBgStart: '#aaa',
          lightCoverBgEnd: '#bbb',
          lightCoverText: '#000',
        },
      };

      const dto = mapBookToPublicCard(book);

      expect(dto.id).toBe('b1');
      expect(dto.title).toBe('Great Book');
      expect(dto.author).toBe('Author');
      expect(dto.description).toBe('A description');
      expect(dto.slug).toBe('great-book');
      expect(dto.publishedAt).toBe('2024-06-01T00:00:00.000Z');
      expect(dto.chaptersCount).toBe(5);
      expect(dto.appearance).toEqual({
        light: { coverBgStart: '#aaa', coverBgEnd: '#bbb', coverText: '#000' },
      });
    });

    it('should handle null publishedAt and appearance', () => {
      const book = {
        id: 'b2', title: 'Draft Book', author: 'Author',
        description: null, slug: null, publishedAt: null,
        _count: { chapters: 0 },
        appearance: null,
      };

      const dto = mapBookToPublicCard(book);

      expect(dto.publishedAt).toBeNull();
      expect(dto.appearance).toBeNull();
      expect(dto.description).toBeNull();
    });
  });

  // ── mapBookToListItem ────────────────────────────────────────

  describe('mapBookToListItem', () => {
    it('should map book with reading progress', () => {
      const book = {
        id: 'b1', title: 'My Book', author: 'Me',
        position: 0, visibility: 'draft',
        description: null, slug: null, coverBgMode: 'default',
        _count: { chapters: 3 },
        appearance: {
          lightCoverBgStart: '#fff',
          lightCoverBgEnd: '#eee',
          lightCoverText: '#000',
        },
        readingProgress: [{ page: 42, updatedAt: new Date('2024-01-15T10:00:00Z') }],
      };

      const dto = mapBookToListItem(book);

      expect(dto.id).toBe('b1');
      expect(dto.position).toBe(0);
      expect(dto.chaptersCount).toBe(3);
      expect(dto.coverBgMode).toBe('default');
      expect(dto.readingProgress).toEqual({
        page: 42,
        updatedAt: '2024-01-15T10:00:00.000Z',
      });
    });

    it('should handle empty reading progress', () => {
      const book = {
        id: 'b2', title: 'New Book', author: 'Me',
        position: 1, visibility: 'draft',
        description: null, slug: null, coverBgMode: 'default',
        _count: { chapters: 0 },
        appearance: null,
        readingProgress: [],
      };

      const dto = mapBookToListItem(book);

      expect(dto.readingProgress).toBeNull();
      expect(dto.appearance).toBeNull();
    });
  });
});
