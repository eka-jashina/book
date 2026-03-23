/**
 * SUBSCRIPTION MANAGER
 * Управляет подписками на события различных компонентов.
 * 
 * Преимущества:
 * - Централизованная отписка при уничтожении
 * - Явное управление жизненным циклом подписок
 * - Предотвращение утечек памяти
 */

import { cssVars } from '../utils/CSSVariables.js';
import { mediaQueries } from '../utils/MediaQueryManager.js';
import { BookState } from '../config.js';
import { SwipeHint } from '../utils/SwipeHint.js';

export class SubscriptionManager {
  constructor() {
    this.subscriptions = [];
  }

  /**
   * Подписаться на изменения состояния книги
   * @param {BookStateMachine} stateMachine
   * @param {DOMManager} dom
   * @param {Function} updateDebugFn
   */
  subscribeToState(stateMachine, dom, updateDebugFn) {
    const unsub = stateMachine.subscribe(state => {
      dom.get('book').dataset.state = state;
      updateDebugFn();
    });
    
    this.subscriptions.push(unsub);
  }

  /**
   * Подписаться на прогресс пагинации
   * @param {AsyncPaginator} paginator
   * @param {LoadingIndicator} loadingIndicator
   */
  subscribeToPagination(paginator, loadingIndicator) {
    const unsub = paginator.on("progress", ({ phase, progress }) => {
      loadingIndicator.setPhase(phase, progress);
    });
    
    this.subscriptions.push(unsub);
  }

  /**
   * Подписаться на изменения media queries
   * @param {Function} repaginateFn
   * @param {Function} isOpenedFn
   */
  subscribeToMediaQueries(repaginateFn, isOpenedFn) {
    const unsub = mediaQueries.subscribe(() => {
      cssVars.invalidateCache();
      if (isOpenedFn()) {
        repaginateFn(true);
      }
    });
    
    this.subscriptions.push(unsub);
  }

  /**
   * Подписаться на показ подсказки свайпа при первом открытии книги
   * @param {BookStateMachine} stateMachine
   */
  subscribeToSwipeHint(stateMachine) {
    const hint = new SwipeHint();
    const unsub = stateMachine.subscribe(state => {
      if (state === BookState.OPENED) {
        hint.showIfNeeded();
      }
    });

    this.subscriptions.push(unsub);
  }

  /**
   * Отписаться от всех событий
   */
  unsubscribeAll() {
    this.subscriptions.forEach(unsub => {
      if (typeof unsub === "function") {
        unsub();
      }
    });
    
    this.subscriptions = [];
  }

}
