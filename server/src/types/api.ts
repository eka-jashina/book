export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export interface UserResponse {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  username: string | null;
  bio: string | null;
  hasPassword: boolean;
  hasGoogle: boolean;
}

export interface AuthResponse {
  user: UserResponse;
}

export interface BookListItem {
  id: string;
  title: string;
  author: string;
  type: string;
  position: number;
  visibility: string;
  description: string | null;
  slug: string | null;
  chaptersCount: number;
  coverBgMode: string;
  appearance: {
    light: {
      coverBgStart: string;
      coverBgEnd: string;
      coverText: string;
    };
  } | null;
  readingProgress: {
    page: number;
    updatedAt: string;
  } | null;
}

export interface BookDetail {
  id: string;
  title: string;
  author: string;
  type: string;
  visibility: string;
  description: string | null;
  slug: string | null;
  publishedAt: string | null;
  cover: {
    bg: string;
    bgMobile: string;
    bgMode: string;
    bgCustomUrl: string | null;
  };
  chapters: ChapterListItem[];
  defaultSettings: DefaultSettings | null;
  appearance: AppearanceDetail | null;
  sounds: SoundsDetail | null;
  ambients: AmbientItem[];
  decorativeFont: { name: string; fileUrl: string } | null;
}

export interface ChapterListItem {
  id: string;
  title: string;
  position: number;
  filePath: string | null;
  hasHtmlContent: boolean;
  bg: string;
  bgMobile: string;
  albumData: Record<string, unknown> | null;
}

export interface ChapterDetail extends ChapterListItem {
  htmlContent: string | null;
}

export interface DefaultSettings {
  font: string;
  fontSize: number;
  theme: string;
  soundEnabled: boolean;
  soundVolume: number;
  ambientType: string;
  ambientVolume: number;
}

export interface AppearanceDetail {
  fontMin: number;
  fontMax: number;
  light: ThemeAppearance;
  dark: ThemeAppearance;
}

export interface ThemeAppearance {
  coverBgStart: string;
  coverBgEnd: string;
  coverText: string;
  coverBgImageUrl: string | null;
  pageTexture: string;
  customTextureUrl: string | null;
  bgPage: string;
  bgApp: string;
}

export interface SoundsDetail {
  pageFlip: string;
  bookOpen: string;
  bookClose: string;
}

export interface AmbientItem {
  id: string;
  ambientKey: string;
  label: string;
  shortLabel: string | null;
  icon: string | null;
  fileUrl: string | null;
  visible: boolean;
  builtin: boolean;
  position: number;
}

export interface ReadingProgressDetail {
  page: number;
  font: string;
  fontSize: number;
  theme: string;
  soundEnabled: boolean;
  soundVolume: number;
  ambientType: string;
  ambientVolume: number;
  updatedAt: string;
}

export interface SettingsVisibility {
  fontSize: boolean;
  theme: boolean;
  font: boolean;
  fullscreen: boolean;
  sound: boolean;
  ambient: boolean;
}

export interface GlobalSettingsDetail {
  fontMin: number;
  fontMax: number;
  settingsVisibility: SettingsVisibility;
}

export interface ReadingFontItem {
  id: string;
  fontKey: string;
  label: string;
  family: string;
  builtin: boolean;
  enabled: boolean;
  fileUrl: string | null;
  position: number;
}

export interface DecorativeFontDetail {
  name: string;
  fileUrl: string;
}

export interface UploadResponse {
  fileUrl: string;
}

export interface ExportData {
  books: BookDetail[];
  readingFonts: ReadingFontItem[];
  globalSettings: GlobalSettingsDetail | null;
}

// ── Public API types ──────────────────────────────

export interface PublicAuthor {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
}

export interface PublicBookCard {
  id: string;
  title: string;
  author: string;
  type: string;
  description: string | null;
  slug: string | null;
  publishedAt: string | null;
  chaptersCount: number;
  appearance: {
    light: {
      coverBgStart: string;
      coverBgEnd: string;
      coverText: string;
    };
  } | null;
}

export interface PublicShelf {
  author: PublicAuthor;
  books: PublicBookCard[];
}

export interface PublicBookDetail {
  id: string;
  title: string;
  author: string;
  type: string;
  description: string | null;
  slug: string | null;
  publishedAt: string | null;
  cover: {
    bg: string;
    bgMobile: string;
    bgMode: string;
    bgCustomUrl: string | null;
  };
  chapters: ChapterListItem[];
  defaultSettings: DefaultSettings | null;
  appearance: AppearanceDetail | null;
  sounds: SoundsDetail | null;
  ambients: AmbientItem[];
  decorativeFont: { name: string; fileUrl: string } | null;
  owner: PublicAuthor;
}

export interface DiscoverResult {
  books: (PublicBookCard & { owner: PublicAuthor })[];
  total: number;
  limit: number;
  offset: number;
}
