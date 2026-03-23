import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { mapAppearanceToDto } from '../utils/mappers.js';
import type { AppearanceDetail, ThemeAppearance } from '../types/api.js';

/**
 * Get appearance settings for a book.
 */
export async function getAppearance(
  bookId: string,
): Promise<AppearanceDetail> {

  const prisma = getPrisma();
  const appearance = await prisma.bookAppearance.findUnique({
    where: { bookId },
  });

  if (!appearance) {
    throw new AppError(404, 'Appearance settings not found');
  }

  return mapAppearanceToDto(appearance);
}

/**
 * Update common appearance settings (fontMin, fontMax).
 */
export async function updateAppearance(
  bookId: string,
  data: { fontMin?: number; fontMax?: number },
): Promise<AppearanceDetail> {

  const prisma = getPrisma();
  const appearance = await prisma.bookAppearance.upsert({
    where: { bookId },
    create: {
      bookId,
      ...(data.fontMin !== undefined && { fontMin: data.fontMin }),
      ...(data.fontMax !== undefined && { fontMax: data.fontMax }),
    },
    update: {
      ...(data.fontMin !== undefined && { fontMin: data.fontMin }),
      ...(data.fontMax !== undefined && { fontMax: data.fontMax }),
    },
  });

  return mapAppearanceToDto(appearance);
}

/**
 * Update theme-specific appearance settings (light or dark).
 */
export async function updateThemeAppearance(
  bookId: string,
  theme: 'light' | 'dark',
  data: Partial<ThemeAppearance>,
): Promise<AppearanceDetail> {

  const prefix = theme;
  const updateData: Record<string, unknown> = {};

  if (data.coverBgStart !== undefined) updateData[`${prefix}CoverBgStart`] = data.coverBgStart;
  if (data.coverBgEnd !== undefined) updateData[`${prefix}CoverBgEnd`] = data.coverBgEnd;
  if (data.coverText !== undefined) updateData[`${prefix}CoverText`] = data.coverText;
  if (data.coverBgImageUrl !== undefined) updateData[`${prefix}CoverBgImageUrl`] = data.coverBgImageUrl;
  if (data.pageTexture !== undefined) updateData[`${prefix}PageTexture`] = data.pageTexture;
  if (data.customTextureUrl !== undefined) updateData[`${prefix}CustomTextureUrl`] = data.customTextureUrl;
  if (data.bgPage !== undefined) updateData[`${prefix}BgPage`] = data.bgPage;
  if (data.bgApp !== undefined) updateData[`${prefix}BgApp`] = data.bgApp;

  const prisma = getPrisma();
  const appearance = await prisma.bookAppearance.upsert({
    where: { bookId },
    create: { bookId, ...updateData },
    update: updateData,
  });

  return mapAppearanceToDto(appearance);
}
