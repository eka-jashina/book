/**
 * BOOK DI CONFIG
 *
 * Конфигурация связывания зависимостей (DI wiring) для BookController.
 *
 * Отделяет описание зависимостей делегатов от жизненного цикла контроллера.
 * BookController отвечает за lifecycle (init/destroy), а этот модуль —
 * за знание о том, какие зависимости нужны каждому делегату.
 *
 * Позволяет:
 * - Тестировать DI-конфигурацию отдельно от жизненного цикла
 * - Переиспользовать wiring при создании альтернативных контроллеров
 * - Снизить когнитивную нагрузку BookController (God Object → координатор)
 */

import { mediaQueries } from '../utils/index.js';
import {
  NavigationDelegate,
  SettingsDelegate,
  LifecycleDelegate,
  ChapterDelegate,
  DragDelegate,
} from './delegates/index.js';

/**
 * Создать все делегаты с DI-зависимостями.
 *
 * @param {Object} deps
 * @param {Object} deps.core - CoreServices
 * @param {Object} deps.audio - AudioServices
 * @param {Object} deps.render - RenderServices
 * @param {Object} deps.content - ContentServices
 * @param {Object} deps.stateMachine - BookStateMachine
 * @param {Object} deps.settings - SettingsManager
 * @param {Object} deps.debugPanel - DebugPanel
 * @param {Object} deps.state - Shared state object
 * @returns {{ chapter: ChapterDelegate, navigation: NavigationDelegate, lifecycle: LifecycleDelegate, settings: SettingsDelegate, drag: DragDelegate }}
 */
export function createBookDelegates({ core, audio, render, content, stateMachine, settings, debugPanel, state }) {
  const { dom, eventManager } = core;
  const { soundManager, ambientManager } = audio;
  const { renderer, animator, paginator, loadingIndicator } = render;
  const { contentLoader, backgroundManager } = content;

  return {
    chapter: new ChapterDelegate({
      backgroundManager,
      dom,
      state,
    }),

    navigation: new NavigationDelegate({
      stateMachine,
      renderer,
      animator,
      settings,
      soundManager,
      mediaQueries,
      state,
    }),

    lifecycle: new LifecycleDelegate({
      stateMachine,
      backgroundManager,
      contentLoader,
      paginator,
      renderer,
      animator,
      loadingIndicator,
      soundManager,
      ambientManager,
      settings,
      dom,
      mediaQueries,
      state,
    }),

    settings: new SettingsDelegate({
      dom,
      settings,
      soundManager,
      ambientManager,
      debugPanel,
      stateMachine,
      mediaQueries,
      state,
    }),

    drag: new DragDelegate({
      stateMachine,
      renderer,
      animator,
      soundManager,
      dom,
      eventManager,
      mediaQueries,
      state,
    }),
  };
}
