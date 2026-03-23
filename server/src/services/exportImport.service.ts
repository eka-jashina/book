import { z } from 'zod';
import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { RESOURCE_LIMITS } from '../utils/limits.js';
import { sanitizeHtml } from '../utils/sanitize.js';
import {
  READER_DEFAULTS,
  FONT_LIMITS,
  SETTINGS_VISIBILITY_DEFAULTS,
  SOUND_DEFAULTS,
  APPEARANCE_DEFAULTS,
  COVER_BG_MODE_DEFAULT,
} from '../utils/defaults.js';
import {
  mapBookToDetail,
  mapReadingFontToDto,
  mapGlobalSettingsToDto,
} from '../utils/mappers.js';
import type { BookDetail, ReadingFontItem, GlobalSettingsDetail, ExportData } from '../types/api.js';

// ── Zod schema for import payload validation ───────────────────

const importThemeSchema = z.object({
  coverBgStart: z.string().max(20).optional(),
  coverBgEnd: z.string().max(20).optional(),
  coverText: z.string().max(20).optional(),
  coverBgImageUrl: z.string().max(500).nullable().optional(),
  pageTexture: z.string().max(20).optional(),
  customTextureUrl: z.string().max(500).nullable().optional(),
  bgPage: z.string().max(20).optional(),
  bgApp: z.string().max(20).optional(),
}).optional();

const importAppearanceSchema = z.object({
  fontMin: z.number().int().min(8).max(72).optional(),
  fontMax: z.number().int().min(8).max(72).optional(),
  light: importThemeSchema,
  dark: importThemeSchema,
}).nullable().optional();

const importChapterSchema = z.object({
  title: z.string().max(500).default(''),
  filePath: z.string().max(500).nullable().optional(),
  hasHtmlContent: z.boolean().optional(),
  bg: z.string().max(500).default(''),
  bgMobile: z.string().max(500).default(''),
  htmlContent: z.string().max(2 * 1024 * 1024).nullable().optional(),
  albumData: z.any().nullable().optional(),
});

const importSoundsSchema = z.object({
  pageFlip: z.string().max(500).optional(),
  bookOpen: z.string().max(500).optional(),
  bookClose: z.string().max(500).optional(),
}).nullable().optional();

const importAmbientSchema = z.object({
  ambientKey: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  shortLabel: z.string().max(50).nullable().optional(),
  icon: z.string().max(20).nullable().optional(),
  fileUrl: z.string().max(500).nullable().optional(),
  visible: z.boolean().optional(),
  builtin: z.boolean().optional(),
});

const importDecorativeFontSchema = z.object({
  name: z.string().min(1).max(200),
  fileUrl: z.string().min(1).max(500),
}).nullable().optional();

const importDefaultSettingsSchema = z.object({
  font: z.string().max(100).optional(),
  fontSize: z.number().int().min(8).max(72).optional(),
  theme: z.string().max(20).optional(),
  soundEnabled: z.boolean().optional(),
  soundVolume: z.number().min(0).max(1).optional(),
  ambientType: z.string().max(100).optional(),
  ambientVolume: z.number().min(0).max(1).optional(),
}).nullable().optional();

const importBookSchema = z.object({
  title: z.string().max(500).default(''),
  author: z.string().max(500).default(''),
  cover: z.object({
    bg: z.string().max(500).default(''),
    bgMobile: z.string().max(500).default(''),
    bgMode: z.string().max(20).default(COVER_BG_MODE_DEFAULT),
    bgCustomUrl: z.string().max(500).nullable().default(null),
  }).optional(),
  chapters: z.array(importChapterSchema).max(RESOURCE_LIMITS.MAX_CHAPTERS_PER_BOOK).optional(),
  appearance: importAppearanceSchema,
  sounds: importSoundsSchema,
  ambients: z.array(importAmbientSchema).max(RESOURCE_LIMITS.MAX_AMBIENTS_PER_BOOK).optional(),
  decorativeFont: importDecorativeFontSchema,
  defaultSettings: importDefaultSettingsSchema,
});

const importFontSchema = z.object({
  fontKey: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  family: z.string().min(1).max(300),
  builtin: z.boolean().optional(),
  enabled: z.boolean().optional(),
  fileUrl: z.string().max(500).nullable().optional(),
});

const importSettingsVisibilitySchema = z.object({
  fontSize: z.boolean().optional(),
  theme: z.boolean().optional(),
  font: z.boolean().optional(),
  fullscreen: z.boolean().optional(),
  sound: z.boolean().optional(),
  ambient: z.boolean().optional(),
}).optional();

const importGlobalSettingsSchema = z.object({
  fontMin: z.number().int().min(8).max(72).optional(),
  fontMax: z.number().int().min(8).max(72).optional(),
  settingsVisibility: importSettingsVisibilitySchema,
}).nullable().optional();

const importDataSchema = z.object({
  books: z.array(importBookSchema).max(RESOURCE_LIMITS.MAX_BOOKS_PER_USER),
  readingFonts: z.array(importFontSchema).max(RESOURCE_LIMITS.MAX_FONTS_PER_USER).optional(),
  globalSettings: importGlobalSettingsSchema,
});

type ValidatedImportData = z.infer<typeof importDataSchema>;

// ── Export ──────────────────────────────────────────────────────

export async function exportUserConfig(userId: string): Promise<ExportData> {
  const prisma = getPrisma();

  const books = await prisma.book.findMany({
    where: { userId, deletedAt: null },
    orderBy: { position: 'asc' },
    include: {
      chapters: { orderBy: { position: 'asc' } },
      appearance: true,
      sounds: true,
      ambients: { orderBy: { position: 'asc' } },
      decorativeFont: true,
      defaultSettings: true,
    },
  });

  const bookDetails: BookDetail[] = books.map(mapBookToDetail);

  const fonts = await prisma.readingFont.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
  });
  const readingFonts: ReadingFontItem[] = fonts.map(mapReadingFontToDto);

  const settings = await prisma.globalSettings.findUnique({ where: { userId } });
  const globalSettings: GlobalSettingsDetail | null = settings
    ? mapGlobalSettingsToDto(settings)
    : null;

  return { books: bookDetails, readingFonts, globalSettings };
}

// ── Import ─────────────────────────────────────────────────────

export async function importUserConfig(
  userId: string,
  data: ExportData,
): Promise<{ imported: { books: number; fonts: number } }> {
  const prisma = getPrisma();

  // Validate entire import payload structure with Zod
  const parsed = importDataSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid import data', 'VALIDATION_ERROR', parsed.error.errors);
  }
  const validData = parsed.data;

  // Fast-fail: check resource limits outside transaction (non-authoritative, avoids unnecessary tx)
  const existingBooks = await prisma.book.count({ where: { userId, deletedAt: null } });
  if (existingBooks + validData.books.length > RESOURCE_LIMITS.MAX_BOOKS_PER_USER) {
    throw new AppError(
      403,
      `Import would exceed book limit (max ${RESOURCE_LIMITS.MAX_BOOKS_PER_USER})`,
    );
  }
  if (validData.readingFonts?.length) {
    const existingFonts = await prisma.readingFont.count({ where: { userId } });
    if (existingFonts + validData.readingFonts.length > RESOURCE_LIMITS.MAX_FONTS_PER_USER) {
      throw new AppError(
        403,
        `Import would exceed font limit (max ${RESOURCE_LIMITS.MAX_FONTS_PER_USER})`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    // Authoritative limit checks inside transaction to prevent race conditions
    const txBookCount = await tx.book.count({ where: { userId, deletedAt: null } });
    if (txBookCount + validData.books.length > RESOURCE_LIMITS.MAX_BOOKS_PER_USER) {
      throw new AppError(
        403,
        `Import would exceed book limit (max ${RESOURCE_LIMITS.MAX_BOOKS_PER_USER})`,
      );
    }
    if (validData.readingFonts?.length) {
      const txFontCount = await tx.readingFont.count({ where: { userId } });
      if (txFontCount + validData.readingFonts.length > RESOURCE_LIMITS.MAX_FONTS_PER_USER) {
        throw new AppError(
          403,
          `Import would exceed font limit (max ${RESOURCE_LIMITS.MAX_FONTS_PER_USER})`,
        );
      }
    }

    for (const bookData of validData.books) {
      const book = await tx.book.create({
        data: {
          userId,
          title: bookData.title || '',
          author: bookData.author || '',
          coverBg: bookData.cover?.bg || '',
          coverBgMobile: bookData.cover?.bgMobile || '',
          coverBgMode: bookData.cover?.bgMode || COVER_BG_MODE_DEFAULT,
          coverBgCustomUrl: bookData.cover?.bgCustomUrl || null,
        },
      });

      if (bookData.chapters?.length) {
        await tx.chapter.createMany({
          data: bookData.chapters.map((ch, i) => ({
            bookId: book.id,
            title: ch.title || '',
            position: i,
            filePath: ch.filePath || null,
            bg: ch.bg || '',
            bgMobile: ch.bgMobile || '',
            htmlContent: typeof ch.htmlContent === 'string'
              ? sanitizeHtml(ch.htmlContent)
              : null,
            albumData: ch.albumData ?? null,
          })),
        });
      }

      if (bookData.appearance) {
        const a = bookData.appearance;
        const ld = APPEARANCE_DEFAULTS.light;
        const dd = APPEARANCE_DEFAULTS.dark;
        await tx.bookAppearance.create({
          data: {
            bookId: book.id,
            fontMin: a.fontMin ?? FONT_LIMITS.fontMin,
            fontMax: a.fontMax ?? FONT_LIMITS.fontMax,
            lightCoverBgStart: a.light?.coverBgStart ?? ld.coverBgStart,
            lightCoverBgEnd: a.light?.coverBgEnd ?? ld.coverBgEnd,
            lightCoverText: a.light?.coverText ?? ld.coverText,
            lightCoverBgImageUrl: a.light?.coverBgImageUrl ?? null,
            lightPageTexture: a.light?.pageTexture ?? ld.pageTexture,
            lightCustomTextureUrl: a.light?.customTextureUrl ?? null,
            lightBgPage: a.light?.bgPage ?? ld.bgPage,
            lightBgApp: a.light?.bgApp ?? ld.bgApp,
            darkCoverBgStart: a.dark?.coverBgStart ?? dd.coverBgStart,
            darkCoverBgEnd: a.dark?.coverBgEnd ?? dd.coverBgEnd,
            darkCoverText: a.dark?.coverText ?? dd.coverText,
            darkCoverBgImageUrl: a.dark?.coverBgImageUrl ?? null,
            darkPageTexture: a.dark?.pageTexture ?? dd.pageTexture,
            darkCustomTextureUrl: a.dark?.customTextureUrl ?? null,
            darkBgPage: a.dark?.bgPage ?? dd.bgPage,
            darkBgApp: a.dark?.bgApp ?? dd.bgApp,
          },
        });
      }

      if (bookData.sounds) {
        await tx.bookSounds.create({
          data: {
            bookId: book.id,
            pageFlipUrl: bookData.sounds.pageFlip || SOUND_DEFAULTS.pageFlip,
            bookOpenUrl: bookData.sounds.bookOpen || SOUND_DEFAULTS.bookOpen,
            bookCloseUrl: bookData.sounds.bookClose || SOUND_DEFAULTS.bookClose,
          },
        });
      }

      if (bookData.ambients?.length) {
        await tx.ambient.createMany({
          data: bookData.ambients.map((amb, i) => ({
            bookId: book.id,
            ambientKey: amb.ambientKey,
            label: amb.label,
            shortLabel: amb.shortLabel || null,
            icon: amb.icon || null,
            fileUrl: amb.fileUrl || null,
            visible: amb.visible ?? true,
            builtin: amb.builtin ?? false,
            position: i,
          })),
        });
      }

      if (bookData.decorativeFont) {
        await tx.decorativeFont.create({
          data: {
            bookId: book.id,
            name: bookData.decorativeFont.name,
            fileUrl: bookData.decorativeFont.fileUrl,
          },
        });
      }

      if (bookData.defaultSettings) {
        const ds = bookData.defaultSettings;
        await tx.bookDefaultSettings.create({
          data: {
            bookId: book.id,
            font: ds.font || READER_DEFAULTS.font,
            fontSize: ds.fontSize ?? READER_DEFAULTS.fontSize,
            theme: ds.theme || READER_DEFAULTS.theme,
            soundEnabled: ds.soundEnabled ?? READER_DEFAULTS.soundEnabled,
            soundVolume: ds.soundVolume ?? READER_DEFAULTS.soundVolume,
            ambientType: ds.ambientType || READER_DEFAULTS.ambientType,
            ambientVolume: ds.ambientVolume ?? READER_DEFAULTS.ambientVolume,
          },
        });
      }
    }

    if (validData.readingFonts?.length) {
      await tx.readingFont.createMany({
        data: validData.readingFonts.map((f, i) => ({
          userId,
          fontKey: f.fontKey,
          label: f.label,
          family: f.family,
          builtin: f.builtin ?? false,
          enabled: f.enabled ?? true,
          fileUrl: f.fileUrl || null,
          position: i,
        })),
      });
    }

    if (validData.globalSettings) {
      const gs = validData.globalSettings;
      const visibilityData = {
        visFontSize: gs.settingsVisibility?.fontSize ?? SETTINGS_VISIBILITY_DEFAULTS.fontSize,
        visTheme: gs.settingsVisibility?.theme ?? SETTINGS_VISIBILITY_DEFAULTS.theme,
        visFont: gs.settingsVisibility?.font ?? SETTINGS_VISIBILITY_DEFAULTS.font,
        visFullscreen: gs.settingsVisibility?.fullscreen ?? SETTINGS_VISIBILITY_DEFAULTS.fullscreen,
        visSound: gs.settingsVisibility?.sound ?? SETTINGS_VISIBILITY_DEFAULTS.sound,
        visAmbient: gs.settingsVisibility?.ambient ?? SETTINGS_VISIBILITY_DEFAULTS.ambient,
      };
      const settingsData = {
        fontMin: gs.fontMin ?? FONT_LIMITS.fontMin,
        fontMax: gs.fontMax ?? FONT_LIMITS.fontMax,
        ...visibilityData,
      };
      await tx.globalSettings.upsert({
        where: { userId },
        create: { userId, ...settingsData },
        update: settingsData,
      });
    }
  });

  return {
    imported: {
      books: validData.books.length,
      fonts: validData.readingFonts?.length ?? 0,
    },
  };
}
