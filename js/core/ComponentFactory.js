/**
 * COMPONENT FACTORY
 * Фабрика для создания всех компонентов приложения.
 *
 * Поддерживает создание сервисных групп:
 * - CoreServices: DOM, events, timers, storage
 * - AudioServices: звуковые эффекты, ambient
 * - RenderServices: renderer, animator, paginator
 * - ContentServices: content loader, backgrounds
 */

import { getConfig } from "../config.js";
import { BookStateMachine, SettingsManager } from "../managers/index.js";
import { DebugPanel } from "./DebugPanel.js";
import { EventController } from "./EventController.js";
import {
  CoreServices,
  AudioServices,
  RenderServices,
  ContentServices,
} from "./services/index.js";

export class ComponentFactory {
  /**
   * @param {CoreServices} core - Сервис ядра
   */
  constructor(core) {
    this.core = core;
  }

  // ═══════════════════════════════════════════
  // СЕРВИСНЫЕ ГРУППЫ
  // ═══════════════════════════════════════════

  /**
   * Создать CoreServices (инфраструктура)
   * @static
   * @returns {CoreServices}
   */
  static createCoreServices() {
    return new CoreServices();
  }

  /**
   * Создать AudioServices (звук)
   * @param {SettingsManager} settings
   * @returns {AudioServices}
   */
  createAudioServices(settings) {
    return new AudioServices(settings);
  }

  /**
   * Создать RenderServices (рендеринг)
   * @returns {RenderServices}
   */
  createRenderServices() {
    return new RenderServices(this.core);
  }

  /**
   * Создать ContentServices (контент)
   * @param {Object} [options]
   * @param {import('../utils/ApiClient.js').ApiClient} [options.apiClient]
   * @param {string} [options.bookId]
   * @param {boolean} [options.publicMode]
   * @returns {ContentServices}
   */
  createContentServices(options = {}) {
    return new ContentServices(options);
  }

  // ═══════════════════════════════════════════
  // ОТДЕЛЬНЫЕ КОМПОНЕНТЫ
  // ═══════════════════════════════════════════

  /**
   * Создать менеджер состояния
   * @returns {BookStateMachine}
   */
  createStateMachine() {
    return new BookStateMachine();
  }

  /**
   * Создать менеджер настроек
   * @param {Object} [options] - { apiClient, bookId }
   * @returns {SettingsManager}
   */
  createSettingsManager(options = {}) {
    return new SettingsManager(this.core.storage, getConfig().DEFAULT_SETTINGS, options);
  }

  /**
   * Создать панель отладки
   * @returns {DebugPanel}
   */
  createDebugPanel() {
    const {
      debugInfo,
      debugState,
      debugTotal,
      debugCurrent,
      debugCache,
      debugMemory,
      debugListeners,
    } = this.core.dom.getMultiple(
      "debugInfo",
      "debugState",
      "debugTotal",
      "debugCurrent",
      "debugCache",
      "debugMemory",
      "debugListeners",
    );

    return new DebugPanel({
      container: debugInfo,
      state: debugState,
      total: debugTotal,
      current: debugCurrent,
      cache: debugCache,
      memory: debugMemory,
      listeners: debugListeners,
    });
  }

  /**
   * Создать контроллер событий
   * @param {Object} handlers - Обработчики событий
   * @returns {EventController}
   */
  createEventController(handlers) {
    return new EventController({
      book: this.core.dom.get("book"),
      eventManager: this.core.eventManager,
      ...handlers,
    });
  }
}
