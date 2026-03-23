/**
 * Обработка изображений фотоальбома:
 * сжатие, кадрирование, поворот, массовая загрузка
 */

import { t } from '@i18n';
import {
  LAYOUT_IMAGE_COUNT, IMAGE_MAX_DIMENSION, IMAGE_QUALITY,
  IMAGE_MAX_FILE_SIZE, ROTATION_VALUES, DEFAULT_FILTER_INTENSITY,
} from './albumConstants.js';

/**
 * Сжатие изображения через canvas: ресайз + перекодирование
 * @param {File} file - Файл изображения
 * @returns {Promise<string>} data URL сжатого изображения
 */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      // Масштабирование по длинной стороне
      if (w > IMAGE_MAX_DIMENSION || h > IMAGE_MAX_DIMENSION) {
        const ratio = Math.min(IMAGE_MAX_DIMENSION / w, IMAGE_MAX_DIMENSION / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      // PNG → сохраняем формат (прозрачность), остальные → JPEG
      const dataUrl = file.type === 'image/png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', IMAGE_QUALITY);

      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t('admin.album.imageLoadError')));
    };

    img.src = url;
  });
}

/**
 * Конвертировать data URL в File для загрузки на S3
 * @param {string} dataUrl
 * @param {string} filename
 * @returns {File}
 */
function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

/**
 * Загрузить data URL на S3 (если store поддерживает) или вернуть как есть
 * @param {Object} store
 * @param {string} dataUrl
 * @param {string} filename
 * @returns {Promise<string>} URL (S3 или data URL)
 */
async function uploadOrKeepDataUrl(store, dataUrl, filename) {
  const file = dataUrlToFile(dataUrl, filename);
  const uploadedUrl = await store.uploadImage(file);
  return uploadedUrl || dataUrl;
}

/**
 * Прочитать и сжать файл изображения, поместить в слот
 * @param {import('./AlbumManager.js').AlbumManager} manager
 */
export async function readPageImageFile(manager, file, pageIndex, imageIndex) {
  // Показать индикатор загрузки на слоте
  const slotEl = manager._getSlotElement(pageIndex, imageIndex);
  slotEl?.classList.add('loading');

  try {
    const dataUrl = await manager._compressImage(file);
    const imageUrl = await uploadOrKeepDataUrl(manager.store, dataUrl, file.name);
    const page = manager._albumPages[pageIndex];
    if (!page) return; // Страница могла быть удалена во время сжатия
    const prev = page.images[imageIndex];
    manager._isDirty = true;
    page.images[imageIndex] = {
      dataUrl: imageUrl,
      originalDataUrl: imageUrl,
      caption: prev?.caption || '',
      frame: prev?.frame || 'none',
      filter: prev?.filter || 'none',
      filterIntensity: prev?.filterIntensity ?? DEFAULT_FILTER_INTENSITY,
      rotation: prev?.rotation || 0,
    };
    manager._renderAlbumPages();
  } catch {
    slotEl?.classList.remove('loading');
    manager._module._showToast(t('admin.album.processingError'));
  }
}

/** Открыть диалог кадрирования для изображения */
export async function cropPageImage(manager, pageIndex, imageIndex) {
  const page = manager._albumPages[pageIndex];
  if (!page) return;
  const img = page.images[imageIndex];
  if (!img?.dataUrl) return;

  // Кадрировать из оригинала, чтобы не терять качество при повторном кадрировании
  const source = img.originalDataUrl || img.dataUrl;

  try {
    const cropped = await manager._cropper.crop(source);
    // null = пользователь отменил
    if (!cropped) return;
    // Страница могла быть удалена во время кадрирования
    if (!manager._albumPages[pageIndex]) return;
    manager._isDirty = true;
    const croppedUrl = await uploadOrKeepDataUrl(manager.store, cropped, `crop_${Date.now()}.jpg`);
    const target = manager._albumPages[pageIndex].images[imageIndex];
    target.dataUrl = croppedUrl;
    // Сохранить оригинал если его ещё нет
    if (!target.originalDataUrl) target.originalDataUrl = source;
    manager._renderAlbumPages();
  } catch {
    manager._module._showToast(t('admin.album.cropError'));
  }
}

/** Сбросить кадрирование — вернуть оригинальное изображение */
export function resetCrop(manager, pageIndex, imageIndex) {
  const page = manager._albumPages[pageIndex];
  if (!page) return;
  const img = page.images[imageIndex];
  if (!img?.originalDataUrl || img.dataUrl === img.originalDataUrl) return;

  manager._isDirty = true;
  img.dataUrl = img.originalDataUrl;
  manager._renderAlbumPages();
}

/** Повернуть изображение на 90° по часовой стрелке */
export function rotatePageImage(manager, pageIndex, imageIndex) {
  const page = manager._albumPages[pageIndex];
  if (!page) return;
  const img = page.images[imageIndex];
  if (!img?.dataUrl) return;

  manager._isDirty = true;
  const current = img.rotation || 0;
  const next = ROTATION_VALUES[(ROTATION_VALUES.indexOf(current) + 1) % ROTATION_VALUES.length];
  img.rotation = next;
  manager._renderAlbumPages();
}

/**
 * Массовая загрузка фото на уровне альбома
 * Заполняет пустые слоты существующих страниц, затем создаёт новые (layout=4)
 */
export function bulkUpload(manager) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.addEventListener('change', () => {
    const files = [...input.files].filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    distributeBulkFiles(manager, files);
  });
  input.click();
}

/**
 * Массовая загрузка на уровне одной страницы
 * Заполняет пустые слоты только этой страницы
 */
export function bulkUploadToPage(manager, pageIndex) {
  const page = manager._albumPages[pageIndex];
  if (!page) return;
  const count = LAYOUT_IMAGE_COUNT[page.layout] || 1;
  const emptySlots = [];
  for (let i = 0; i < count; i++) {
    if (!page.images[i]?.dataUrl) emptySlots.push(i);
  }
  if (!emptySlots.length) {
    manager._module._showToast(t('admin.album.noEmptySlots'));
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.addEventListener('change', () => {
    const files = [...input.files].filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    // Ограничить количество файлов количеством пустых слотов
    const limited = files.slice(0, emptySlots.length);
    const slots = emptySlots.slice(0, limited.length).map(imageIndex => ({
      pageIndex,
      imageIndex,
    }));
    processBulkFiles(manager, limited, slots);
  });
  input.click();
}

/**
 * Распределить файлы по пустым слотам всех страниц, создать новые если нужно
 */
export async function distributeBulkFiles(manager, files) {
  // Валидация файлов
  const validFiles = files.filter(f =>
    manager._module._validateFile(f, { maxSize: IMAGE_MAX_FILE_SIZE, mimePrefix: 'image/' }),
  );
  if (!validFiles.length) return;

  // Собрать все пустые слоты существующих страниц
  const slots = [];
  for (let p = 0; p < manager._albumPages.length; p++) {
    const page = manager._albumPages[p];
    const count = LAYOUT_IMAGE_COUNT[page.layout] || 1;
    for (let i = 0; i < count; i++) {
      if (!page.images[i]?.dataUrl) {
        slots.push({ pageIndex: p, imageIndex: i });
      }
    }
  }

  // Создать новые страницы для оставшихся файлов
  let remaining = validFiles.length - slots.length;
  while (remaining > 0) {
    const pageIndex = manager._albumPages.length;
    manager._albumPages.push({ layout: '4', images: [] });
    const count = LAYOUT_IMAGE_COUNT['4'];
    for (let i = 0; i < count && remaining > 0; i++) {
      slots.push({ pageIndex, imageIndex: i });
      remaining--;
    }
  }

  manager._renderAlbumPages();
  await processBulkFiles(manager, validFiles, slots);
}

/**
 * Обработать массив файлов и загрузить в указанные слоты
 */
export async function processBulkFiles(manager, files, slots) {
  const promises = files.map(async (file, idx) => {
    const { pageIndex, imageIndex } = slots[idx];
    const slotEl = manager._getSlotElement(pageIndex, imageIndex);
    slotEl?.classList.add('loading');
    try {
      const dataUrl = await manager._compressImage(file);
      const imageUrl = await uploadOrKeepDataUrl(manager.store, dataUrl, file.name);
      const page = manager._albumPages[pageIndex];
      if (!page) return;
      manager._isDirty = true;
      const prev = page.images[imageIndex];
      page.images[imageIndex] = {
        dataUrl: imageUrl,
        originalDataUrl: imageUrl,
        caption: prev?.caption || '',
        frame: prev?.frame || 'none',
        filter: prev?.filter || 'none',
        filterIntensity: prev?.filterIntensity ?? DEFAULT_FILTER_INTENSITY,
        rotation: prev?.rotation || 0,
      };
    } catch (err) {
      console.debug('AlbumImageProcessor: ошибка при замене изображения', err);
      slotEl?.classList.remove('loading');
    }
  });

  await Promise.all(promises);
  manager._renderAlbumPages();
}
