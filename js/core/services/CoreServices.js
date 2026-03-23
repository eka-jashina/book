/**
 * CORE SERVICES
 * Группирует базовые инфраструктурные зависимости.
 *
 * Содержит:
 * - DOMManager - кэширование DOM элементов
 * - EventListenerManager - управление слушателями событий
 * - TimerManager - управление таймерами с debounce
 * - StorageManager - абстракция localStorage
 */

import { DOMManager } from '../DOMManager.js';
import {
  EventListenerManager,
  TimerManager,
  StorageManager
} from '../../utils/index.js';
import { getConfig } from '../../config.js';

export class CoreServices {
  constructor() {
    this.dom = new DOMManager();
    this.eventManager = new EventListenerManager();
    this.timerManager = new TimerManager();
    this.storage = new StorageManager(getConfig().STORAGE_KEY);

    // Уведомить пользователя при переполнении localStorage
    this.storage.onQuotaExceeded = (key) => {
      console.warn(`Хранилище переполнено (${key}). Настройки могут не сохраниться.`);
      this._showStorageWarning();
    };
  }

  /**
   * Показать визуальное предупреждение о переполнении хранилища.
   * Создаёт временный элемент уведомления в DOM.
   * @private
   */
  _showStorageWarning() {
    // Избегаем дублирования уведомлений
    if (document.getElementById('storage-quota-warning')) return;

    const el = document.createElement('div');
    el.id = 'storage-quota-warning';
    el.setAttribute('role', 'alert');
    el.textContent = 'Хранилище браузера переполнено. Настройки могут не сохраняться.';
    Object.assign(el.style, {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      padding: '12px 24px', background: '#d32f2f', color: '#fff',
      borderRadius: '8px', zIndex: '10000', fontSize: '14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    });
    document.body.appendChild(el);

    setTimeout(() => el.remove(), 8000);
  }

  /**
   * Очистить все ресурсы
   */
  destroy() {
    this.eventManager.clear();
    this.timerManager.clear();
    this.dom.clearPages();

    this.dom = null;
    this.eventManager = null;
    this.timerManager = null;
    this.storage = null;
  }
}
