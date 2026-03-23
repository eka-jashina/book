import type {
  BookAppearance,
  BookSounds,
  BookDefaultSettings,
  Ambient,
  Chapter,
  DecorativeFont,
  ReadingFont,
  GlobalSettings,
  ReadingProgress,
  ReadingPreferences,
  User,
} from '@prisma/client';
import type {
  AppearanceDetail,
  SoundsDetail,
  DefaultSettings,
  AmbientItem,
  ChapterListItem,
  ChapterDetail,
  DecorativeFontDetail,
  ReadingFontItem,
  GlobalSettingsDetail,
  ReadingProgressDetail,
  UserResponse,
  PublicAuthor,
  PublicBookCard,
  BookListItem,
  BookDetail,
} from '../types/api.js';

// ── Appearance ──────────────────────────────────────────────────

export function mapAppearanceToDto(appearance: BookAppearance): AppearanceDetail {
  return {
    fontMin: appearance.fontMin,
    fontMax: appearance.fontMax,
    light: {
      coverBgStart: appearance.lightCoverBgStart,
      coverBgEnd: appearance.lightCoverBgEnd,
      coverText: appearance.lightCoverText,
      coverBgImageUrl: appearance.lightCoverBgImageUrl,
      pageTexture: appearance.lightPageTexture,
      customTextureUrl: appearance.lightCustomTextureUrl,
      bgPage: appearance.lightBgPage,
      bgApp: appearance.lightBgApp,
    },
    dark: {
      coverBgStart: appearance.darkCoverBgStart,
      coverBgEnd: appearance.darkCoverBgEnd,
      coverText: appearance.darkCoverText,
      coverBgImageUrl: appearance.darkCoverBgImageUrl,
      pageTexture: appearance.darkPageTexture,
      customTextureUrl: appearance.darkCustomTextureUrl,
      bgPage: appearance.darkBgPage,
      bgApp: appearance.darkBgApp,
    },
  };
}

/** Map appearance to cover-only subset (for book lists / cards). */
export function mapAppearanceToCoverDto(appearance: {
  lightCoverBgStart: string;
  lightCoverBgEnd: string;
  lightCoverText: string;
}): BookListItem['appearance'] {
  return {
    light: {
      coverBgStart: appearance.lightCoverBgStart,
      coverBgEnd: appearance.lightCoverBgEnd,
      coverText: appearance.lightCoverText,
    },
  };
}

// ── Sounds ──────────────────────────────────────────────────────

export function mapSoundsToDto(sounds: BookSounds): SoundsDetail {
  return {
    pageFlip: sounds.pageFlipUrl,
    bookOpen: sounds.bookOpenUrl,
    bookClose: sounds.bookCloseUrl,
  };
}

// ── Default Settings ────────────────────────────────────────────

export function mapDefaultSettingsToDto(defaultSettings: BookDefaultSettings): DefaultSettings {
  return {
    font: defaultSettings.font,
    fontSize: defaultSettings.fontSize,
    theme: defaultSettings.theme,
    soundEnabled: defaultSettings.soundEnabled,
    soundVolume: defaultSettings.soundVolume,
    ambientType: defaultSettings.ambientType,
    ambientVolume: defaultSettings.ambientVolume,
  };
}

// ── Ambients ────────────────────────────────────────────────────

export function mapAmbientToDto(ambient: Ambient): AmbientItem {
  return {
    id: ambient.id,
    ambientKey: ambient.ambientKey,
    label: ambient.label,
    shortLabel: ambient.shortLabel,
    icon: ambient.icon,
    fileUrl: ambient.fileUrl,
    visible: ambient.visible,
    builtin: ambient.builtin,
    position: ambient.position,
  };
}

// ── Chapters ────────────────────────────────────────────────────

export function mapChapterToListItem(chapter: Chapter): ChapterListItem {
  return {
    id: chapter.id,
    title: chapter.title,
    position: chapter.position,
    filePath: chapter.filePath,
    hasHtmlContent: chapter.htmlContent !== null,
    bg: chapter.bg,
    bgMobile: chapter.bgMobile,
    albumData: chapter.albumData as Record<string, unknown> | null,
  };
}

export function mapChapterToDetail(chapter: Chapter): ChapterDetail {
  return {
    ...mapChapterToListItem(chapter),
    htmlContent: chapter.htmlContent,
  };
}

// ── Decorative Font ─────────────────────────────────────────────

export function mapDecorativeFontToDto(decorativeFont: DecorativeFont): DecorativeFontDetail {
  return {
    name: decorativeFont.name,
    fileUrl: decorativeFont.fileUrl,
  };
}

// ── Reading Font ────────────────────────────────────────────────

export function mapReadingFontToDto(font: ReadingFont): ReadingFontItem {
  return {
    id: font.id,
    fontKey: font.fontKey,
    label: font.label,
    family: font.family,
    builtin: font.builtin,
    enabled: font.enabled,
    fileUrl: font.fileUrl,
    position: font.position,
  };
}

// ── Global Settings ─────────────────────────────────────────────

export function mapGlobalSettingsToDto(globalSettings: GlobalSettings): GlobalSettingsDetail {
  return {
    fontMin: globalSettings.fontMin,
    fontMax: globalSettings.fontMax,
    settingsVisibility: {
      fontSize: globalSettings.visFontSize,
      theme: globalSettings.visTheme,
      font: globalSettings.visFont,
      fullscreen: globalSettings.visFullscreen,
      sound: globalSettings.visSound,
      ambient: globalSettings.visAmbient,
    },
  };
}

// ── Reading Progress ────────────────────────────────────────────

export function mapReadingProgressToDto(
  progress: ReadingProgress,
  preferences: ReadingPreferences | null,
): ReadingProgressDetail {
  return {
    page: progress.page,
    font: preferences?.font ?? 'georgia',
    fontSize: preferences?.fontSize ?? 18,
    theme: preferences?.theme ?? 'light',
    soundEnabled: preferences?.soundEnabled ?? true,
    soundVolume: preferences?.soundVolume ?? 0.3,
    ambientType: preferences?.ambientType ?? 'none',
    ambientVolume: preferences?.ambientVolume ?? 0.5,
    updatedAt: progress.updatedAt.toISOString(),
  };
}

// ── User ────────────────────────────────────────────────────────

/**
 * Format a User model for the API response.
 * Accepts both Prisma user (with passwordHash) and Express.User (with hasPassword).
 */
export function mapUserToDto(user: {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  username?: string | null;
  bio?: string | null;
  googleId: string | null;
  passwordHash?: string | null;
  hasPassword?: boolean;
}): UserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    username: user.username ?? null,
    bio: user.bio ?? null,
    hasPassword: user.hasPassword ?? (user.passwordHash !== null),
    hasGoogle: user.googleId !== null,
  };
}

// ── Public (author / book card) ─────────────────────────────────

export function mapUserToPublicAuthor(user: {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}): PublicAuthor {
  return {
    username: user.username!,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
  };
}

/** Map a book with _count + appearance (cover subset) to a PublicBookCard. */
export function mapBookToPublicCard(book: {
  id: string;
  title: string;
  author: string;
  type: string;
  description: string | null;
  slug: string | null;
  publishedAt: Date | null;
  _count: { chapters: number };
  appearance: { lightCoverBgStart: string; lightCoverBgEnd: string; lightCoverText: string } | null;
}): PublicBookCard {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    type: book.type,
    description: book.description,
    slug: book.slug,
    publishedAt: book.publishedAt?.toISOString() ?? null,
    chaptersCount: book._count.chapters,
    appearance: book.appearance ? mapAppearanceToCoverDto(book.appearance) : null,
  };
}

// ── Book (full detail) ──────────────────────────────────────────

type BookWithRelations = {
  id: string;
  title: string;
  author: string;
  type: string;
  visibility: string;
  description: string | null;
  slug: string | null;
  publishedAt: Date | null;
  coverBg: string;
  coverBgMobile: string;
  coverBgMode: string;
  coverBgCustomUrl: string | null;
  chapters: Chapter[];
  defaultSettings: BookDefaultSettings | null;
  appearance: BookAppearance | null;
  sounds: BookSounds | null;
  ambients: Ambient[];
  decorativeFont: DecorativeFont | null;
};

export function mapBookToDetail(book: BookWithRelations): BookDetail {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    type: book.type,
    visibility: book.visibility,
    description: book.description,
    slug: book.slug,
    publishedAt: book.publishedAt?.toISOString() ?? null,
    cover: {
      bg: book.coverBg,
      bgMobile: book.coverBgMobile,
      bgMode: book.coverBgMode,
      bgCustomUrl: book.coverBgCustomUrl,
    },
    chapters: book.chapters.map(mapChapterToListItem),
    defaultSettings: book.defaultSettings
      ? mapDefaultSettingsToDto(book.defaultSettings)
      : null,
    appearance: book.appearance
      ? mapAppearanceToDto(book.appearance)
      : null,
    sounds: book.sounds
      ? mapSoundsToDto(book.sounds)
      : null,
    ambients: book.ambients.map(mapAmbientToDto),
    decorativeFont: book.decorativeFont
      ? mapDecorativeFontToDto(book.decorativeFont)
      : null,
  };
}

// ── Book List Item ──────────────────────────────────────────────

type BookForList = {
  id: string;
  title: string;
  author: string;
  type: string;
  position: number;
  visibility: string;
  description: string | null;
  slug: string | null;
  coverBgMode: string;
  _count: { chapters: number };
  appearance: { lightCoverBgStart: string; lightCoverBgEnd: string; lightCoverText: string } | null;
  readingProgress: { page: number; updatedAt: Date }[];
};

export function mapBookToListItem(book: BookForList): BookListItem {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    type: book.type,
    position: book.position,
    visibility: book.visibility,
    description: book.description,
    slug: book.slug,
    chaptersCount: book._count.chapters,
    coverBgMode: book.coverBgMode,
    appearance: book.appearance ? mapAppearanceToCoverDto(book.appearance) : null,
    readingProgress: book.readingProgress.length > 0
      ? {
          page: book.readingProgress[0].page,
          updatedAt: book.readingProgress[0].updatedAt.toISOString(),
        }
      : null,
  };
}
