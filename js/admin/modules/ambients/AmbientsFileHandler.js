/**
 * AMBIENTS FILE HANDLER
 *
 * Обработка загрузки аудиофайлов для амбиентов.
 */

import { uploadWithFallback } from '../adminHelpers.js';

/**
 * Обработка загрузки файла в inline-карточке
 * @param {Object} mod - AmbientsModule instance
 * @param {Event} e - change event
 */
export async function handleInlineFileUpload(mod, e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!mod._validateFile(file, { maxSize: 3 * 1024 * 1024, mimePrefix: 'audio/', inputEl: e.target })) return;

  mod._pendingAmbientDataUrl = await uploadWithFallback(mod.store, file, 'sound');
  mod._pendingAmbientFileName = file.name;

  // Обновить UI: показать имя файла
  const infoEl = mod.ambientCards.querySelector('.decorative-font-info');
  if (infoEl) {
    infoEl.style.display = 'flex';
    infoEl.querySelector('.decorative-font-name').textContent = file.name;
  } else {
    // Инфо-блока нет — перерисовать карточку
    await mod._renderAmbients();
  }
  e.target.value = '';
}

/**
 * @deprecated Legacy: обработка загрузки через модальное окно
 * @param {Object} mod - AmbientsModule instance
 * @param {Event} e - change event
 */
export async function handleAmbientFileUpload(mod, e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!mod._validateFile(file, { maxSize: 3 * 1024 * 1024, mimePrefix: 'audio/', inputEl: e.target })) return;

  mod._pendingAmbientDataUrl = await uploadWithFallback(mod.store, file, 'sound');
  if (mod.ambientUploadLabel) {
    mod.ambientUploadLabel.textContent = file.name;
  }
  e.target.value = '';
}
