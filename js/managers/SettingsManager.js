/**
 * SETTINGS MANAGER
 * Управление настройками с персистентностью.
 *
 * Особенности:
 * - Автоматическое сохранение в localStorage
 * - Слияние defaults с сохранёнными настройками
 * - Предотвращение лишних сохранений при одинаковых значениях
 * - Валидация значений перед сохранением (защита от невалидных данных в localStorage)
 * - Фаза 3: debounced sync прогресса на сервер (PUT /api/books/:bookId/progress)
 * - navigator.sendBeacon() для финальной синхронизации при закрытии вкладки
 */

import { sanitizeSettings, sanitizeSetting, validateSettingsSchema } from '../utils/SettingsValidator.js';

/** Задержка перед отправкой на сервер (мс) */
const SYNC_DEBOUNCE = 5000;

export class SettingsManager {
  /**
   * @param {StorageManager} storage - Менеджер хранилища
   * @param {import('../types.js').DefaultSettings} defaults - Значения по умолчанию
   * @param {Object} [options]
   * @param {import('../utils/ApiClient.js').ApiClient} [options.apiClient] - API клиент (Фаза 3)
   * @param {string} [options.bookId] - ID книги для sync прогресса
   */
  constructor(storage, defaults = {}, { apiClient, bookId } = {}) {
    this.storage = storage;
    this._defaults = defaults;
    this._api = apiClient || null;
    this._bookId = bookId || null;
    this._syncTimer = null;
    this._dirty = false;
    /** @type {number} Incremented on each local set() — prevents server overwriting local changes */
    this._localVersion = 0;
    this._onSyncStateChange = null;
    this._boundBeforeUnload = this._onBeforeUnload.bind(this);

    // Сохранённые настройки перезаписывают defaults,
    // затем санитизируются для защиты от повреждённых данных в localStorage
    const merged = { ...defaults, ...storage.load() };
    this.settings = sanitizeSettings(merged, defaults);

    // Проверка формальной схемы — предупреждение при расхождении
    const schemaErrors = validateSettingsSchema(this.settings, defaults);
    if (schemaErrors.length > 0) {
      console.warn('SettingsManager: расхождение со схемой настроек:', schemaErrors);
    }

    // Привязываем sendBeacon при закрытии вкладки
    if (this._api && this._bookId) {
      window.addEventListener('beforeunload', this._boundBeforeUnload);
    }
  }

  /**
   * Инициализировать настройки из серверного прогресса.
   * Вызывается после создания, когда доступны данные с сервера.
   *
   * @param {Object} serverProgress - Прогресс чтения с сервера
   */
  applyServerProgress(serverProgress) {
    if (!serverProgress) return;

    // Не перезаписывать, если пользователь уже менял настройки локально
    // (это предотвращает гонку, когда серверные данные загружаются дольше,
    // чем пользователь начинает взаимодействовать с UI)
    if (this._localVersion > 0) return;

    // Серверный прогресс перезаписывает локальные настройки,
    // но для page берём максимум из локального и серверного значений:
    // это защищает от гонки (sync не успел) и от устаревших серверных данных.
    const localPage = this.settings.page ?? 0;
    const serverPage = serverProgress.page ?? 0;

    const merged = { ...this._defaults, ...serverProgress };
    merged.page = Math.max(localPage, serverPage);

    this.settings = sanitizeSettings(merged, this._defaults);

    // Сохранить в localStorage для быстрого доступа
    this.storage.save(this.settings);
  }

  /**
   * Получить значение настройки
   * @param {string} key - Ключ настройки
   * @returns {*} Значение настройки
   */
  get(key) {
    return this.settings[key];
  }

  /**
   * Установить значение настройки
   * Автоматически валидирует и сохраняет в storage
   * @param {string} key - Ключ настройки
   * @param {*} value - Новое значение
   */
  set(key, value) {
    // Санитизировать значение перед сохранением
    const defaultValue = this._defaults ? this._defaults[key] : undefined;
    const sanitized = sanitizeSetting(key, value, defaultValue);

    const oldValue = this.settings[key];
    // Не делаем ничего если значение не изменилось
    if (oldValue === sanitized) return;

    this.settings[key] = sanitized;
    this._localVersion++;
    this.storage.save({ [key]: sanitized });

    // Фаза 3: debounced sync на сервер
    if (this._api && this._bookId) {
      this._dirty = true;
      this._scheduleSyncToServer();
    }
  }

  /**
   * Установить колбэк для отслеживания состояния синхронизации.
   * @param {Function} callback - (state: 'syncing'|'synced'|'error') => void
   */
  set onSyncStateChange(callback) {
    this._onSyncStateChange = callback;
  }

  /**
   * Уведомить о смене состояния синхронизации
   * @private
   * @param {'syncing'|'synced'|'error'} state
   */
  _notifySyncState(state) {
    if (this._onSyncStateChange) {
      this._onSyncStateChange(state);
    }
  }

  /**
   * Запланировать отправку прогресса на сервер
   * @private
   */
  _scheduleSyncToServer() {
    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
    }
    this._notifySyncState('syncing');
    this._syncTimer = setTimeout(() => {
      this._syncToServer();
    }, SYNC_DEBOUNCE);
  }

  /**
   * Отправить текущий прогресс на сервер
   * @private
   */
  async _syncToServer() {
    if (!this._dirty || !this._api || !this._bookId) return;

    const data = {
      page: this.settings.page ?? 0,
      font: this.settings.font || 'georgia',
      fontSize: this.settings.fontSize || 18,
      theme: this.settings.theme || 'light',
      soundEnabled: this.settings.soundEnabled ?? true,
      soundVolume: this.settings.soundVolume ?? 0.3,
      ambientType: this.settings.ambientType || 'none',
      ambientVolume: this.settings.ambientVolume ?? 0.5,
    };

    try {
      await this._api.saveProgress(this._bookId, data);
      this._dirty = false;
      this._notifySyncState('synced');
    } catch (err) {
      console.warn('SettingsManager: не удалось сохранить прогресс на сервер', err);
      this._notifySyncState('error');
      // Прогресс сохранён в localStorage — не критично.
      // Dirty-флаг остаётся true, следующее изменение запустит повторную попытку.
    }
  }

  /**
   * Финальная синхронизация при закрытии вкладки через sendBeacon
   * @private
   */
  _onBeforeUnload() {
    if (!this._dirty || !this._bookId) return;
    this._sendBeaconSync();
  }

  /**
   * Освободить ресурсы
   */
  destroy() {
    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
      this._syncTimer = null;
    }

    // Финальная синхронизация через sendBeacon (гарантирует доставку даже при закрытии вкладки).
    // Async _syncToServer() не подходит — при unload промисы обрываются.
    if (this._dirty && this._bookId) {
      this._sendBeaconSync();
    }

    window.removeEventListener('beforeunload', this._boundBeforeUnload);

    this.storage = null;
    this.settings = null;
    this._defaults = null;
    this._api = null;
    this._bookId = null;
  }

  /**
   * Отправить прогресс через sendBeacon (синхронно, не обрывается при unload)
   * @private
   */
  _sendBeaconSync() {
    if (!this.settings || !this._bookId) return;
    try {
      const data = {
        page: this.settings.page ?? 0,
        font: this.settings.font || 'georgia',
        fontSize: this.settings.fontSize || 18,
        theme: this.settings.theme || 'light',
        soundEnabled: this.settings.soundEnabled ?? true,
        soundVolume: this.settings.soundVolume ?? 0.3,
        ambientType: this.settings.ambientType || 'none',
        ambientVolume: this.settings.ambientVolume ?? 0.5,
      };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      navigator.sendBeacon(`/api/v1/books/${this._bookId}/progress`, blob);
      this._dirty = false;
    } catch (err) {
      console.debug('SettingsManager: sendBeacon не удался', err);
    }
  }
}
