import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { mapDefaultSettingsToDto } from '../utils/mappers.js';
import type { DefaultSettings } from '../types/api.js';

/**
 * Get default settings for a book.
 */
export async function getDefaultSettings(
  bookId: string,
): Promise<DefaultSettings> {

  const prisma = getPrisma();
  const settings = await prisma.bookDefaultSettings.findUnique({
    where: { bookId },
  });

  if (!settings) {
    throw new AppError(404, 'Default settings not found');
  }

  return mapDefaultSettingsToDto(settings);
}

/**
 * Update default settings for a book.
 */
export async function updateDefaultSettings(
  bookId: string,
  data: {
    font?: string;
    fontSize?: number;
    theme?: string;
    soundEnabled?: boolean;
    soundVolume?: number;
    ambientType?: string;
    ambientVolume?: number;
  },
): Promise<DefaultSettings> {

  const prisma = getPrisma();
  const settings = await prisma.bookDefaultSettings.upsert({
    where: { bookId },
    create: { bookId, ...data },
    update: data,
  });

  return mapDefaultSettingsToDto(settings);
}
