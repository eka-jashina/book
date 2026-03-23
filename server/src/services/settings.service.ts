import { getPrisma } from '../utils/prisma.js';
import { FONT_LIMITS, SETTINGS_VISIBILITY_DEFAULTS } from '../utils/defaults.js';
import { mapGlobalSettingsToDto } from '../utils/mappers.js';
import type { GlobalSettingsDetail, SettingsVisibility } from '../types/api.js';

const DEFAULTS: GlobalSettingsDetail = { ...FONT_LIMITS, settingsVisibility: { ...SETTINGS_VISIBILITY_DEFAULTS } };

export async function getGlobalSettings(userId: string): Promise<GlobalSettingsDetail> {
  const prisma = getPrisma();
  const settings = await prisma.globalSettings.findUnique({ where: { userId } });
  if (!settings) return DEFAULTS;
  return mapGlobalSettingsToDto(settings);
}

export async function updateGlobalSettings(userId: string, data: { fontMin?: number; fontMax?: number; settingsVisibility?: Partial<SettingsVisibility> }): Promise<GlobalSettingsDetail> {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};
  if (data.fontMin !== undefined) updateData.fontMin = data.fontMin;
  if (data.fontMax !== undefined) updateData.fontMax = data.fontMax;
  if (data.settingsVisibility) {
    const vis = data.settingsVisibility;
    if (vis.fontSize !== undefined) updateData.visFontSize = vis.fontSize;
    if (vis.theme !== undefined) updateData.visTheme = vis.theme;
    if (vis.font !== undefined) updateData.visFont = vis.font;
    if (vis.fullscreen !== undefined) updateData.visFullscreen = vis.fullscreen;
    if (vis.sound !== undefined) updateData.visSound = vis.sound;
    if (vis.ambient !== undefined) updateData.visAmbient = vis.ambient;
  }
  const settings = await prisma.globalSettings.upsert({ where: { userId }, create: { userId, ...updateData }, update: updateData });
  return mapGlobalSettingsToDto(settings);
}
