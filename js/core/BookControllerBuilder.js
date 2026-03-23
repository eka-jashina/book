/**
 * BOOK CONTROLLER BUILDER
 * Чистая фабрика: создание и связывание сервисов, компонентов, делегатов.
 *
 * Выделена из BookController для разделения ответственности:
 * - BookControllerBuilder: чистая конструкция графа зависимостей (фазы 1-3)
 * - BookController: жизненный цикл, медиатор, публичный API (фазы 4-5)
 *
 * Граф зависимостей:
 *
 *   buildServices()        — фаза 1: корневая, без зависимостей
 *        ↓
 *   buildComponents()      — фаза 2: зависит от factory
 *        ↓
 *   buildDelegates()       — фаза 3: зависит от services + components
 */

import { ComponentFactory } from './ComponentFactory.js';
import { createBookDelegates } from './BookDIConfig.js';

/**
 * Создать read-only Proxy для объекта состояния.
 * Делегаты получают эту обёртку и могут только читать state.index / state.chapterStarts.
 * Попытка записи бросает ошибку — запись допускается только в DelegateMediator.
 *
 * @param {Object} state - Оригинальное состояние { index, chapterStarts }
 * @returns {Proxy} Read-only view состояния
 */
export function createReadOnlyState(state) {
  return new Proxy(state, {
    set(_, prop) {
      throw new Error(`State is read-only for delegates. Cannot set "${prop}".`);
    },
    deleteProperty(_, prop) {
      throw new Error(`State is read-only for delegates. Cannot delete "${prop}".`);
    },
  });
}

/**
 * Проверить наличие обязательных зависимостей для фазы.
 * @param {Object<string, *>} deps - Объект { имя: значение } зависимостей
 * @param {string} phase - Имя фазы для сообщения об ошибке
 * @throws {Error} Если хотя бы одна зависимость null/undefined
 */
function assertDependencies(deps, phase) {
  const missing = Object.entries(deps)
    .filter(([, value]) => value === null || value === undefined)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `BookControllerBuilder.${phase}: отсутствуют зависимости: ${missing.join(', ')}.`
    );
  }
}

/**
 * Создать полный граф зависимостей приложения (фазы 1-3).
 *
 * Чистая функция: не обращается к DOM напрямую, не хранит состояние.
 * Все побочные эффекты (sync indicator, mediator) остаются в BookController.
 *
 * @param {Object} options
 * @param {Object} options.state - Разделяемое состояние { index, chapterStarts }
 * @param {import('../utils/ApiClient.js').ApiClient|null} [options.apiClient]
 * @param {string|null} [options.bookId]
 * @param {Object|null} [options.serverProgress]
 * @param {'owner'|'guest'|'embed'} [options.readerMode='owner'] - Режим ридера (Phase 6)
 * @returns {{
 *   core: Object, factory: ComponentFactory, settings: Object,
 *   audio: Object, render: Object, content: Object,
 *   stateMachine: Object, debugPanel: Object, delegates: Object
 * }}
 */
export function buildBookComponents({ state, apiClient = null, bookId = null, serverProgress = null, readerMode = 'owner' }) {
  // ── Фаза 1: Сервисные группы (корневая, без зависимостей) ──

  const core = ComponentFactory.createCoreServices();
  const factory = new ComponentFactory(core);
  const publicMode = readerMode === 'guest' || readerMode === 'embed';
  const settings = factory.createSettingsManager(publicMode ? {} : { apiClient, bookId });

  if (serverProgress) {
    settings.applyServerProgress(serverProgress);
  }

  const audio = factory.createAudioServices(settings);
  const render = factory.createRenderServices();
  const content = factory.createContentServices({ apiClient, bookId, publicMode });

  audio.setupAmbientLoadingCallbacks(core.dom.get('ambientPills'));

  // ── Фаза 2: Компоненты (зависят от factory) ──

  assertDependencies({ factory }, 'buildComponents');

  const stateMachine = factory.createStateMachine();
  const debugPanel = factory.createDebugPanel();

  // ── Фаза 3: Делегаты (зависят от services + components) ──

  assertDependencies({
    core, audio, render, content, stateMachine, settings, debugPanel,
  }, 'buildDelegates');

  // Делегаты получают read-only view состояния.
  // DelegateMediator использует оригинальный state для записи.
  const readOnlyState = createReadOnlyState(state);

  const delegates = createBookDelegates({
    core, audio, render, content, stateMachine, settings, debugPanel, state: readOnlyState,
  });

  return {
    core, factory, settings, audio, render, content,
    stateMachine, debugPanel, delegates,
  };
}
