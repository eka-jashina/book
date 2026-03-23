/**
 * Single source of truth for all application default values.
 * Mirrors the @default values in schema.prisma.
 */

export const READER_DEFAULTS = {
  font: 'georgia',
  fontSize: 18,
  theme: 'light',
  soundEnabled: true,
  soundVolume: 0.3,
  ambientType: 'none',
  ambientVolume: 0.5,
} as const;

export const FONT_LIMITS = {
  fontMin: 14,
  fontMax: 22,
} as const;

export const SETTINGS_VISIBILITY_DEFAULTS = {
  fontSize: true,
  theme: true,
  font: true,
  fullscreen: true,
  sound: true,
  ambient: true,
} as const;

export const SOUND_DEFAULTS = {
  pageFlip: 'sounds/page-flip.mp3',
  bookOpen: 'sounds/cover-flip.mp3',
  bookClose: 'sounds/cover-flip.mp3',
} as const;

export const APPEARANCE_DEFAULTS = {
  light: {
    coverBgStart: '#3a2d1f',
    coverBgEnd: '#2a2016',
    coverText: '#f2e9d8',
    pageTexture: 'default',
    bgPage: '#fdfcf8',
    bgApp: '#e6e3dc',
  },
  dark: {
    coverBgStart: '#111111',
    coverBgEnd: '#000000',
    coverText: '#eaeaea',
    pageTexture: 'none',
    bgPage: '#1e1e1e',
    bgApp: '#121212',
  },
} as const;

export const COVER_BG_MODE_DEFAULT = 'default' as const;
