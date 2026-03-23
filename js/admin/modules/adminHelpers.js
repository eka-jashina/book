/**
 * Общие хелперы для admin-модулей
 * Извлечены из повторяющихся паттернов в ChaptersModule, FontsModule,
 * SoundsModule, AmbientsModule, AppearanceModule, BookUploadManager
 */

/**
 * Прочитать файл как data URL через FileReader
 * @param {File} file
 * @returns {Promise<string>} data URL
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Загрузить файл на сервер, при неудаче — вернуть data URL.
 *
 * Централизует повторяющийся паттерн «попробуй upload, иначе data URL»,
 * используемый в ChapterEditor, AppearanceModule, FontsModule, SoundsModule,
 * CoverManager, AmbientsFileHandler.
 *
 * @param {Object} store - Store с методами uploadImage/uploadSound/uploadFont
 * @param {File} file - Загружаемый файл
 * @param {'image'|'sound'|'font'} [type='image'] - Тип загрузки
 * @returns {Promise<string>} URL (серверный) или data URL (локальный)
 */
export async function uploadWithFallback(store, file, type = 'image') {
  const methodMap = { image: 'uploadImage', sound: 'uploadSound', font: 'uploadFont' };
  const method = methodMap[type];
  if (method && typeof store[method] === 'function') {
    const url = await store[method](file);
    if (url) return url;
  }
  return readFileAsDataURL(file);
}

/**
 * Настроить dropzone: клик → file input, drag-and-drop → callback
 * @param {HTMLElement} dropzoneEl - Зона перетаскивания
 * @param {HTMLInputElement} fileInputEl - Скрытый file input
 * @param {(file: File) => void} onFile - Callback при выборе файла
 */
export function setupDropzone(dropzoneEl, fileInputEl, onFile) {
  dropzoneEl.addEventListener('click', () => fileInputEl.click());

  dropzoneEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzoneEl.classList.add('dragover');
  });

  dropzoneEl.addEventListener('dragleave', () => {
    dropzoneEl.classList.remove('dragover');
  });

  dropzoneEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzoneEl.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  });
}
