/**
 * Константы и чистые утилиты фотоальбома
 */
import { t } from '@i18n';

/** Количество изображений для каждого шаблона */
export const LAYOUT_IMAGE_COUNT = {
  '1': 1, '2': 2, '2h': 2,
  '3': 3, '3r': 3, '3t': 3, '3b': 3,
  '4': 4,
};

/** Максимальный размер длинной стороны изображения (px) */
export const IMAGE_MAX_DIMENSION = 1920;

/** Качество JPEG-сжатия (0–1) */
export const IMAGE_QUALITY = 0.85;

/** Максимальный размер загружаемого файла до сжатия (10 МБ) */
export const IMAGE_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Доступные рамки для фотографий (вызывать как функцию — label зависит от текущего языка) */
export function getFrameOptions() {
  return [
    { id: 'none', label: t('admin.album.frameNone') },
    { id: 'thin', label: t('admin.album.frameThin') },
    { id: 'shadow', label: t('admin.album.frameShadow') },
    { id: 'polaroid', label: 'Polaroid' },
    { id: 'rounded', label: t('admin.album.frameRounded') },
    { id: 'double', label: t('admin.album.frameDouble') },
  ];
}

/** Доступные фильтры для фотографий (вызывать как функцию — label зависит от текущего языка) */
export function getFilterOptions() {
  return [
    { id: 'none', label: t('admin.album.filterNone') },
    { id: 'grayscale', label: t('admin.album.filterGrayscale') },
    { id: 'sepia', label: t('admin.album.filterSepia') },
    { id: 'contrast', label: t('admin.album.filterContrast') },
    { id: 'warm', label: t('admin.album.filterWarm') },
    { id: 'cool', label: t('admin.album.filterCool') },
  ];
}

/** Допустимые значения поворота (градусы) */
export const ROTATION_VALUES = [0, 90, 180, 270];

/** Интенсивность фильтра по умолчанию (100 = максимальный эффект) */
export const DEFAULT_FILTER_INTENSITY = 100;

/**
 * Получить слоты изображений для страницы — всегда length === LAYOUT_IMAGE_COUNT
 */
export function getPageSlots(page) {
  const count = LAYOUT_IMAGE_COUNT[page.layout] || 1;
  return Array.from({ length: count }, (_, i) => page.images[i] || null);
}

/**
 * Вычислить inline CSS filter для изображения
 * @param {string} filter - id фильтра (none, grayscale, sepia, contrast, warm, cool)
 * @param {number} intensity - интенсивность 0–100
 * @returns {string} значение CSS filter или пустая строка
 */
export function computeFilterStyle(filter, intensity) {
  if (!filter || filter === 'none') return '';
  const normalizedIntensity = Math.max(0, Math.min(100, intensity ?? DEFAULT_FILTER_INTENSITY)) / 100;
  switch (filter) {
    case 'grayscale': return `grayscale(${normalizedIntensity})`;
    case 'sepia': return `sepia(${+(normalizedIntensity * 0.75).toFixed(3)})`;
    case 'contrast': return `contrast(${+(1 + normalizedIntensity * 0.35).toFixed(3)})`;
    case 'warm': return `saturate(${+(1 + normalizedIntensity * 0.3).toFixed(3)}) hue-rotate(${+(-normalizedIntensity * 10).toFixed(2)}deg)`;
    case 'cool': return `saturate(${+(1 + normalizedIntensity * 0.1).toFixed(3)}) hue-rotate(${+(normalizedIntensity * 15).toFixed(2)}deg) brightness(${+(1 + normalizedIntensity * 0.05).toFixed(3)})`;
    default: return '';
  }
}
